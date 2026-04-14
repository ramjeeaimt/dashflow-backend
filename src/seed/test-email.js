const { Client } = require('pg');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

async function testEmail() {
  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.MAIL_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    tls: {
        rejectUnauthorized: false
    }
  });

  const mailOptions = {
    from: `"Difmo CRM Test" <${process.env.MAIL_USER}>`,
    to: 'ramjeekumaryadav558@gmail.com',
    subject: 'Difmo CRM Notification Test',
    text: 'If you receive this, the SMTP configuration for Difmo CRM is working correctly.',
    html: '<b>If you receive this, the SMTP configuration for Difmo CRM is working correctly.</b>'
  };

  try {
    console.log('Sending test email to ramjeekumaryadav558@gmail.com...');
    console.log('Using SMTP User:', process.env.MAIL_USER);
    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  } catch (error) {
    console.error('Error occurred:', error.message);
    if (error.code === 'EAUTH') {
        console.error('Authentication failed. Please check MAIL_USER and MAIL_PASS (App Password).');
    }
  }
}

testEmail();
