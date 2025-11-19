const express = require("express");
const axios = require("axios");
const nodemailer = require("nodemailer");
require("dotenv").config();

const {
    NIR_RANGE_WARNING_MIN,
    NIR_RANGE_WARNING_MAX,
    RED_NESS_MIN,
    RED_NESS_RANGE_MAX,
    EYE_TEMPERATURE_RANGE_MIN,
    EYE_TEMPERATURE_RANGE_MAX,
    BLINK_COUNT_RANGE_MIN,
    BLINK_COUNT_RANGE_MAX,
    URL,
    URLTWO
} = require('../utils/Range')


const router = express.Router();

const url = URL;        // NIR, Redness, Temp
const urlTwo = URLTWO; // Blink

let canSendEmail = true;

const transporter = nodemailer.createTransport({ 
    service: "gmail",
    auth: {
        user: process.env.ALERT_EMAIL,
        pass: process.env.ALERT_EMAIL_PASSWORD,
    },
});

// Email sender
async function sendAlertEmail(values) {
    const htmlMessage = `
<div style="
    max-width: 480px;
    margin: auto;
    background: #ffffff;
    padding: 20px;
    border-radius: 12px;
    border: 1px solid #e5e5e5;
    font-family: Arial, sans-serif;
    color: #333;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
">

    <h2 style="
        color: #d9534f;
        text-align: center;
        margin-bottom: 10px;
    ">
        ⚠ Eye Sensor Alert
    </h2>

    <p style="
        text-align: center;
        font-size: 14px;
        color: #555;
        margin-bottom: 20px;
    ">
        Below are the latest sensor values:
    </p>

    <div style="
        background: #f8f9fa;
        padding: 15px;
        border-radius: 10px;
        border: 1px solid #ddd;
    ">
        <div style="padding: 8px 0; border-bottom: 1px solid #eee;">
            <strong>NIR Value:</strong> ${values.nir}
        </div>

        <div style="padding: 8px 0; border-bottom: 1px solid #eee;">
            <strong>Redness Value:</strong> ${values.redness}
        </div>

        <div style="padding: 8px 0; border-bottom: 1px solid #eee;">
            <strong>Temperature Value:</strong> ${values.temperature}
        </div>

        <div style="padding: 8px 0;">
            <strong>Blink Percentage:</strong> ${values.blink}
        </div>
    </div>

    <p style="
        margin-top: 20px;
        font-size: 12px;
        color: #777;
        text-align: center;
    ">
        This is an automated alert. Take necessary action.
    </p>
</div>
`;

    try {
        await transporter.sendMail({
            from: process.env.ALERT_EMAIL,
            to: process.env.ALERT_TO,
            subject: "⚠ Eye Sensor Alert Detected",
            html: htmlMessage,
        });

        // Cooldown 1 minute
        canSendEmail = false;
        setTimeout(() => (canSendEmail = true), 60000);

    } catch (err) {
        console.log("Email Error:", err);
    }
}

// MAIN CHECK FUNCTION
async function checkSensors() {
    try {
        const [res1, res2] = await Promise.all([
            axios.get(url),
            axios.get(urlTwo),
        ]);

        const data1 = res1.data.feeds.at(-1);
        const data2 = res2.data.feeds.at(-1);

        // Extract values
        const values = {
            nir: Number(data1.field2),
            redness: Number(data1.field3),
            temperature: Number(data1.field5),
            blink: Number(data2.field2),
        };

        // Threshold Check
        const alertTriggered =
            values.nir < Number(NIR_RANGE_WARNING_MIN) || values.nir > Number(NIR_RANGE_WARNING_MAX) ||
            values.redness < Number(RED_NESS_MIN) || values.redness > Number(RED_NESS_RANGE_MAX) ||
            values.temperature < Number(EYE_TEMPERATURE_RANGE_MIN) || values.temperature > Number(EYE_TEMPERATURE_RANGE_MAX) ||
            values.blink < Number(BLINK_COUNT_RANGE_MIN) || values.blink > Number(BLINK_COUNT_RANGE_MAX);

        if (alertTriggered) {
            if (canSendEmail) {
                console.log("🚨 Alert triggered — sending email...");
                sendAlertEmail(values);
            } else {
                console.log("⏳ Cooldown active, skipping email");
            }
        } else {
            console.log("✔ All values normal");
        }
    } catch (err) {
        console.log("Fetch Error:", err);
    }
}

// Run every 1 minute
if (url && urlTwo) {
    console.log("✔ Checking sensors every 1 minute...");
    setInterval(checkSensors, 60000);
}

module.exports = router;
