'use strict';

const nodemailer = require('nodemailer');
const LogService = require("./log");

function sendEmail(recipients, subject, body) {
    return new Promise(async (resolve, reject) => {
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
                reject(err);
            }
            else {
                LogService.log("Email sent successfully");
                resolve();
            }
        });
    });
}

module.exports = {
    sendEmail: sendEmail
};
