// Seeds one admin account so you can log in and start adding real shops.
// Run with: npm run seed
const bcrypt = require('bcryptjs');
const db = require('./db');

const ADMIN_EMAIL = 'admin@mandimarket.local';
const ADMIN_PASSWORD = 'Admin@12345';

const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(ADMIN_EMAIL);

if (existing) {
  console.log('Admin already exists:', ADMIN_EMAIL);
} else {
  const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  db.prepare(
    `INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'admin')`
  ).run('Platform Admin', ADMIN_EMAIL, '0000000000', hash);
  console.log('Created admin account:');
  console.log('  email:   ', ADMIN_EMAIL);
  console.log('  password:', ADMIN_PASSWORD);
  console.log('Change this password after first login.');
}
