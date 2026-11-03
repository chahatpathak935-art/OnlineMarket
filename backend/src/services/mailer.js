const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

const PURPOSE_TEXT = {
  register: 'finish creating your Mandi Market account',
  login: 'log in to Mandi Market',
  reset: 'reset your Mandi Market password',
};

// Brevo's HTTPS API: works on hosts (like Render's free tier) that block SMTP ports.
async function sendViaBrevo(to, subject, text, html) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Mandi Market', email: process.env.MAIL_FROM_EMAIL },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo API ${res.status}: ${body}`);
  }
}

async function sendOtpEmail(to, code, purpose, ttlMinutes) {
  const action = PURPOSE_TEXT[purpose] || 'continue';
  const subject = `Your Mandi Market code: ${code}`;
  const text =
    `Use this code to ${action}: ${code}\n\n` +
    `It expires in ${ttlMinutes} minutes. If you did not request it, ignore this email.`;
  const html =
    `<p>Use this code to ${action}:</p>` +
    `<p style="font-size:28px;letter-spacing:6px;font-weight:bold">${code}</p>` +
    `<p>It expires in ${ttlMinutes} minutes. If you did not request it, ignore this email.</p>`;

  if (process.env.BREVO_API_KEY) {
    return sendViaBrevo(to, subject, text, html);
  }

  if (process.env.SMTP_HOST) {
    return getTransporter().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
    });
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Email is not configured: set BREVO_API_KEY (or SMTP_HOST) in the environment');
  }
  console.log(`\n[DEV OTP] ${purpose} code for ${to}: ${code}\n`);
}

module.exports = { sendOtpEmail };
