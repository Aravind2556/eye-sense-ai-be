const express = require("express");
const axios = require("axios");
const nodemailer = require("nodemailer");
require("dotenv").config();

const router = express.Router();

const url = process.env.ThinkSpeak_URL;
let canSendEmail = true;

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.ALERT_EMAIL,
        pass: process.env.ALERT_EMAIL_PASSWORD
    }
});

async function sendAlertEmail(allFields) {
    const htmlMessage = `
<div style="
    background: #f8f9fa;
    padding: 20px;
    border-radius: 10px;
    font-family: Arial, sans-serif;
    color: #333;
    border: 1px solid #ddd;
    max-width: 450px;
">
    <h2 style="color: #d9534f; text-align: center;">
        ⚠ Sensor Alert Triggered
    </h2>

    <p style="text-align:center; font-size: 14px; margin-bottom:20px;">
        Below are the current sensor readings:
    </p>

    <div style="
        background: white;
        padding: 15px;
        border-radius: 8px;
        border: 1px solid #ccc;
    ">
        ${Object.keys(allFields)
            .map(key => `
                <div style="
                    padding: 8px 0;
                    border-bottom: 1px solid #eee;
                    font-size: 14px;
                ">
                    <strong>${key}:</strong> ${allFields[key]}
                </div>
            `)
            .join("")}
    </div>

    <p style="margin-top: 20px; font-size: 12px; color: #777; text-align:center;">
        This is an automated emergency alert. Please take immediate action.
    </p>
</div>
`;

    try {
        await transporter.sendMail({
            from: process.env.ALERT_EMAIL,
            to: process.env.ALERT_TO,
            subject: "⚠ Emergency Alert - Sensor Threshold Exceeded",
            html: htmlMessage
        });

        canSendEmail = false;
        setTimeout(() => {
            canSendEmail = true;
        }, 60000);

    } catch (err) {
        console.log("❌ Email sending error:", err);
    }
}

// Check ThinkSpeak values
async function checkData() {
    try {
        const res = await axios.get(url);
        const data = res.data;
        if (!data?.feeds?.length) {
            console.log("⚠ No data found");
            return;
        }
        const recent = data.feeds[data.feeds.length - 1];
        const fields = {
            "Cervical Value": Number(recent.field1),
            "Thoracic Value": Number(recent.field2),
            "Lumber Value": Number(recent.field3),
            "Sacral Value": Number(recent.field4),
            "Left Shoulder Value": Number(recent.field5),
            "Right Shoulder Value": Number(recent.field6),
            "Left Hip Value": Number(recent.field7),
            "Right Hip Value": Number(recent.field8),
        };
        // Check if ANY field ≥ 2000
        const isAlert = Object.values(fields).some(v => v >= 2000);
        if (isAlert) {
            if (canSendEmail) {
                console.log("🚨 ALERT! Sending ONE combined email...");
                sendAlertEmail(fields);
            } else {
                console.log("⏳ Cooldown active → Email skipped");
            }
        } else {
            console.log("✔ All fields safe");
        }

    } catch (err) {
        console.log("❌ ThinkSpeak fetch error:", err);
    }
}

// Poll every 5 seconds
if (url) {
    console.log("✔ Polling ThinkSpeak every 5 seconds...");
    setInterval(checkData, 5000);
}

module.exports = router;
