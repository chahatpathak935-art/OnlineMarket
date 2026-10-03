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

// Sends the OTP by email. With no SMTP_HOST configured (local dev) the code is
// printed to the server console instead, so you can test without an email account.
async function sendOtpEmail(to, code, purpose, ttlMinutes) {
  if (!process.env.SMTP_HOST) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP is not configured: set SMTP_HOST in the environment');
    }
    console.log(`\n[DEV OTP] ${purpose} code for ${to}: ${code}\n`);
    return;
  }

  const action = PURPOSE_TEXT[purpose] || 'continue';
  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: `Your Mandi Market code: ${code}`,
    text:
      `Use this code to ${action}: ${code}\n\n` +
      `It expires in ${ttlMinutes} minutes. If you did not request it, ignore this email.`,
    html:
      `<p>Use this code to ${action}:</p>` +
      `<p style="font-size:28px;letter-spacing:6px;font-weight:bold">${code}</p>` +
      `<p>It expires in ${ttlMinutes} minutes. If you did not request it, ignore this email.</p>`,
  });
}

module.exports = { sendOtpEmail };
