const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { sendOtp, verifyOtp } = require('../services/otp');

const router = express.Router();

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

const handle = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  });

// ---------------------------------------------------------------- Registration (no code)
router.post(
  '/register',
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
    if (await db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const info = await db
      .prepare('INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(name, email, phone || null, hash, role);

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  })
);

// ---------------------------------------------------------------- Login (no code)
router.post(
  '/login',
  handle(async (req, res) => {
    const email = normEmail(req.body.email);
    const { password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!user.is_active) return res.status(403).json({ error: 'This account has been deactivated' });

    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

// ---------------------------------------------------------------- Forgot password (code by email)
// Always answers 200 so the response never reveals whether an email is registered.
router.post(
  '/forgot/request',
  handle(async (req, res) => {
    const email = normEmail(req.body.email);
    if (!email) return res.status(400).json({ error: 'email is required' });

    const user = await db.prepare('SELECT id, is_active FROM users WHERE email = ?').get(email);
    if (user && user.is_active) {
      try {
        await sendOtp(email, 'reset');
      } catch (err) {
        console.error('forgot/request:', err.message);
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
    if (!(await verifyOtp(email, 'reset', req.body.otp))) {
      return res.status(400).json({ error: INVALID_CODE });
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    await db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(hash, email);
    res.json({ message: 'Password updated. You can now log in.' });
  })
);

router.get(
  '/me',
  requireAuth,
  handle(async (req, res) => {
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: publicUser(user) });
  })
);

module.exports = router;
