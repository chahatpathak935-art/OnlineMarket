const crypto = require('crypto');
const db = require('../db/db');
const { sendOtpEmail } = require('./mailer');

const OTP_TTL_MS = 5 * 60 * 1000; // code is valid for 5 minutes
const RESEND_COOLDOWN_MS = 30 * 1000; // min gap between sends to the same address+purpose
const MAX_ATTEMPTS = 5; // wrong guesses allowed per code
const MAX_SENDS_PER_HOUR = 6; // per address+purpose

const hashCode = (code) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET).update(String(code)).digest('hex');

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

// Creates a fresh OTP (replacing any older one) and delivers it.
async function sendOtp(identifier, purpose, payload = null) {
  const now = Date.now();

  const last = await db
    .prepare('SELECT created_at FROM otp_sends WHERE identifier = ? AND purpose = ? ORDER BY id DESC LIMIT 1')
    .get(identifier, purpose);
  if (last && now - Number(last.created_at) < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (now - Number(last.created_at))) / 1000);
    throw httpError(429, `Please wait ${wait}s before requesting another code`);
  }

  const sendsRow = await db
    .prepare('SELECT COUNT(*) AS n FROM otp_sends WHERE identifier = ? AND purpose = ? AND created_at > ?')
    .get(identifier, purpose, now - 60 * 60 * 1000);
  if (Number(sendsRow.n) >= MAX_SENDS_PER_HOUR) {
    throw httpError(429, 'Too many codes requested. Try again in an hour.');
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

  await db.prepare('DELETE FROM otps WHERE identifier = ? AND purpose = ?').run(identifier, purpose);
  const info = await db
    .prepare(
      'INSERT INTO otps (identifier, purpose, code_hash, payload, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(identifier, purpose, hashCode(code), payload ? JSON.stringify(payload) : null, now + OTP_TTL_MS, now);
  await db
    .prepare('INSERT INTO otp_sends (identifier, purpose, created_at) VALUES (?, ?, ?)')
    .run(identifier, purpose, now);

  try {
    await sendOtpEmail(identifier, code, purpose, OTP_TTL_MS / 60000);
  } catch (err) {
    await db.prepare('DELETE FROM otps WHERE id = ?').run(info.lastInsertRowid);
    console.error('OTP delivery failed:', err.message);
    throw httpError(502, 'Could not send the code. Please try again shortly.');
  }

  return { expiresInSeconds: OTP_TTL_MS / 1000, resendInSeconds: RESEND_COOLDOWN_MS / 1000 };
}

// Returns the stored payload ({} if none) when the code is right, otherwise null.
async function verifyOtp(identifier, purpose, code) {
  const row = await db
    .prepare('SELECT * FROM otps WHERE identifier = ? AND purpose = ? ORDER BY id DESC LIMIT 1')
    .get(identifier, purpose);
  if (!row) return null;

  if (Number(row.expires_at) < Date.now() || row.attempts >= MAX_ATTEMPTS) {
    await db.prepare('DELETE FROM otps WHERE id = ?').run(row.id);
    return null;
  }

  const given = Buffer.from(hashCode(String(code || '').trim()));
  const stored = Buffer.from(row.code_hash);
  const ok = given.length === stored.length && crypto.timingSafeEqual(given, stored);

  if (!ok) {
    await db.prepare('UPDATE otps SET attempts = attempts + 1 WHERE id = ?').run(row.id);
    return null;
  }

  await db.prepare('DELETE FROM otps WHERE id = ?').run(row.id);
  return row.payload ? JSON.parse(row.payload) : {};
}

// Housekeeping: remove expired codes and old send-log rows.
async function purgeOldOtps() {
  try {
    const now = Date.now();
    await db.prepare('DELETE FROM otps WHERE expires_at < ?').run(now);
    await db.prepare('DELETE FROM otp_sends WHERE created_at < ?').run(now - 24 * 60 * 60 * 1000);
  } catch (err) {
    console.error('purgeOldOtps error:', err.message);
  }
}
setInterval(purgeOldOtps, 10 * 60 * 1000).unref();

module.exports = { sendOtp, verifyOtp };
