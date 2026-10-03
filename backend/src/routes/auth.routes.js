const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { sendOtp, verifyOtp } = require('../services/otp');

const router = express.Router();

// Broad per-IP brake on every auth endpoint (the OTP service adds per-account limits).
router.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again in a few minutes.' },
  })
);

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role };
}

const normEmail = (e) => String(e || '').trim().toLowerCase();
const INVALID_CODE = 'Invalid or expired code';

// Wraps async handlers so thrown errors (including OTP 429s) become JSON responses.
const handle = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  });

// ---------------------------------------------------------------- Registration
// Step 1: validate the form and email a code. No account exists yet.
router.post(
  '/register/request',
  handle(async (req, res) => {
    const { name, password, phone, role } = req.body;
    const email = normEmail(req.body.email);

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'name, email, password and role are required' });
    }
    const allowedSelfRoles = ['customer', 'shop_owner', 'delivery_boy'];
    if (!allowedSelfRoles.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${allowedSelfRoles.join(', ')}` });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const timing = await sendOtp(email, 'register', {
      name,
      email,
      phone: phone || null,
      passwordHash,
      role,
    });
    res.json({ message: 'Verification code sent to your email', ...timing });
  })
);

// Step 2: the correct code creates the account and logs the user in.
router.post(
  '/register/verify',
  handle(async (req, res) => {
    const email = normEmail(req.body.email);
    const payload = verifyOtp(email, 'register', req.body.otp);
    if (!payload) return res.status(400).json({ error: INVALID_CODE });

    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    const info = db
      .prepare('INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(payload.name, payload.email, payload.phone, payload.passwordHash, payload.role);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  })
);

// ----------------------------------------------------------------------- Login
// Step 1: check email + password, then email a code. No token is issued yet.
router.post(
  '/login/request',
  handle(async (req, res) => {
    const email = normEmail(req.body.email);
    const { password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!user.is_active) return res.status(403).json({ error: 'This account has been deactivated' });

    const timing = await sendOtp(email, 'login');
    res.json({ message: 'Login code sent to your email', ...timing });
  })
);

// Step 2: the correct code issues the JWT.
router.post(
  '/login/verify',
  handle(async (req, res) => {
    const email = normEmail(req.body.email);
    if (!verifyOtp(email, 'login', req.body.otp)) {
      return res.status(400).json({ error: INVALID_CODE });
    }
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    if (!user.is_active) return res.status(403).json({ error: 'This account has been deactivated' });

    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

// -------------------------------------------------------------- Forgot password
// Always answers 200 so the response never reveals whether an email is registered.
router.post(
  '/forgot/request',
  handle(async (req, res) => {
    const email = normEmail(req.body.email);
    if (!email) return res.status(400).json({ error: 'email is required' });

    const user = db.prepare('SELECT id, is_active FROM users WHERE email = ?').get(email);
    if (user && user.is_active) {
      try {
        await sendOtp(email, 'reset');
      } catch (err) {
        console.error('forgot/request:', err.message); // swallow: don't leak account existence
      }
    }
    res.json({
      message: 'If an account exists for that email, we sent a code to it.',
      expiresInSeconds: 300,
      resendInSeconds: 30,
    });
  })
);

router.post(
  '/forgot/reset',
  handle(async (req, res) => {
    const email = normEmail(req.body.email);
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (!verifyOtp(email, 'reset', req.body.otp)) {
      return res.status(400).json({ error: INVALID_CODE });
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(hash, email);
    res.json({ message: 'Password updated. You can now log in.' });
  })
);

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: publicUser(user) });
});

module.exports = router;
