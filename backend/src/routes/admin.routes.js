const express = require('express');
const db = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/users', (req, res) => {
  const { role } = req.query;
  const rows = role
    ? db.prepare('SELECT id, name, email, phone, role, is_active, created_at FROM users WHERE role = ? ORDER BY created_at DESC').all(role)
    : db.prepare('SELECT id, name, email, phone, role, is_active, created_at FROM users ORDER BY created_at DESC').all();
  res.json({ users: rows });
});

router.patch('/users/:id/status', (req, res) => {
  const { is_active } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'admin') return res.status(400).json({ error: 'Cannot deactivate an admin account' });

  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, user.id);
  res.json({ success: true });
});

router.get('/stats', (req, res) => {
  const shops = db.prepare('SELECT COUNT(*) AS c FROM shops WHERE is_active = 1').get().c;
  const customers = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'customer'").get().c;
  const deliveryBoys = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'delivery_boy'").get().c;
  const ordersToday = db
    .prepare("SELECT COUNT(*) AS c FROM orders WHERE date(created_at) = date('now')")
    .get().c;
  const revenueToday = db
    .prepare("SELECT COALESCE(SUM(grand_total),0) AS s FROM orders WHERE date(created_at) = date('now') AND status != 'cancelled'")
    .get().s;
  const activeOrders = db
    .prepare("SELECT COUNT(*) AS c FROM orders WHERE status NOT IN ('delivered','cancelled')")
    .get().c;

  res.json({ shops, customers, deliveryBoys, ordersToday, revenueToday, activeOrders });
});

module.exports = router;
