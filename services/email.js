'use strict';

const nodemailer = require('nodemailer');
const LogService = require('services/log');

async function sendEmail(recipients, subject, body) {
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.BUGATONE_AUTO_GMAIL_USERNAME,
            pass: process.env.BUGATONE_AUTO_GMAIL_PASSWORD
        }
    });
    let mailOptions = {
        from: process.env.BUGATONE_AUTO_GMAIL_USERNAME,
        to: recipients,
        subject: subject,
        text: body
    };
    
    LogService.log("Sending email to: " + mailOptions.to);
    transporter.sendMail(mailOptions, (err) => {
        if (err) {
            LogService.error("Error sending email: " + err);
            throw err;
        }

        LogService.log("Email sent successfully");
    });
}

module.exports = {
    sendEmail: sendEmail
};
