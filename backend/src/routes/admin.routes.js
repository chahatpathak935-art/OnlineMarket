const express = require('express');
const db = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/users', async (req, res) => {
  const { role } = req.query;
  const rows = role
    ? await db.prepare('SELECT id, name, email, phone, role, is_active, created_at FROM users WHERE role = ? ORDER BY created_at DESC').all(role)
    : await db.prepare('SELECT id, name, email, phone, role, is_active, created_at FROM users ORDER BY created_at DESC').all();
  res.json({ users: rows });
});

router.patch('/users/:id/status', async (req, res) => {
  const { is_active } = req.body;
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'admin') return res.status(400).json({ error: 'Cannot deactivate an admin account' });

  await db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, user.id);
  res.json({ success: true });
});

router.get('/stats', async (req, res) => {
  const shopsRow = await db.prepare('SELECT COUNT(*) AS c FROM shops WHERE is_active = 1').get();
  const customersRow = await db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'customer'").get();
  const deliveryBoysRow = await db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'delivery_boy'").get();
  const ordersTodayRow = await db
    .prepare("SELECT COUNT(*) AS c FROM orders WHERE created_at::date = CURRENT_DATE")
    .get();
  const revenueTodayRow = await db
    .prepare("SELECT COALESCE(SUM(grand_total),0) AS s FROM orders WHERE created_at::date = CURRENT_DATE AND status != 'cancelled'")
    .get();
  const activeOrdersRow = await db
    .prepare("SELECT COUNT(*) AS c FROM orders WHERE status NOT IN ('delivered','cancelled')")
    .get();

  res.json({
    shops: Number(shopsRow.c),
    customers: Number(customersRow.c),
    deliveryBoys: Number(deliveryBoysRow.c),
    ordersToday: Number(ordersTodayRow.c),
    revenueToday: Number(revenueTodayRow.s),
    activeOrders: Number(activeOrdersRow.c),
  });
});

module.exports = router;
