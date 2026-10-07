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

// ---------------------------------------------------------------- Registration
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
    if (await db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
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

router.post(
  '/register/verify',
  handle(async (req, res) => {
    const email = normEmail(req.body.email);
    const payload = await verifyOtp(email, 'register', req.body.otp);
    if (!payload) return res.status(400).json({ error: INVALID_CODE });

    if (await db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    const info = await db
      .prepare('INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(payload.name, payload.email, payload.phone, payload.passwordHash, payload.role);

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  })
);

// ----------------------------------------------------------------------- Login
router.post(
  '/login/request',
  handle(async (req, res) => {
    const email = normEmail(req.body.email);
    const { password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!user.is_active) return res.status(403).json({ error: 'This account has been deactivated' });

    const timing = await sendOtp(email, 'login');
    res.json({ message: 'Login code sent to your email', ...timing });
  })
);

router.post(
  '/login/verify',
  handle(async (req, res) => {
    const email = normEmail(req.body.email);
    if (!(await verifyOtp(email, 'login', req.body.otp))) {
      return res.status(400).json({ error: INVALID_CODE });
    }
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    if (!user.is_active) return res.status(403).json({ error: 'This account has been deactivated' });

    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

// -------------------------------------------------------------- Forgot password
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

router.get('/me', requireAuth, async (req, res) => {
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: publicUser(user) });
});

module.exports = router;
