const express = require('express');
const db = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// ---------- Public: list / search shops (district-wide directory) ----------
router.get('/', (req, res) => {
  const { q, category } = req.query;
  let sql = `SELECT s.*, u.name AS owner_name FROM shops s
             JOIN users u ON u.id = s.owner_id
             WHERE s.is_active = 1`;
  const params = [];

  if (q) {
    sql += ` AND s.name LIKE ?`;
    params.push(`%${q}%`);
  }
  if (category) {
    sql += ` AND s.category = ?`;
    params.push(category);
  }
  sql += ` ORDER BY s.name ASC`;

  const shops = db.prepare(sql).all(...params);
  res.json({ shops });
});

router.get('/:id', (req, res) => {
  const shop = db
    .prepare(
      `SELECT s.*, u.name AS owner_name FROM shops s JOIN users u ON u.id = s.owner_id WHERE s.id = ?`
    )
    .get(req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  const products = db
    .prepare('SELECT * FROM products WHERE shop_id = ? AND is_active = 1 ORDER BY name ASC')
    .all(shop.id);
  res.json({ shop, products });
});

// ---------- Admin: create / deactivate any shop ----------
router.post('/', requireAuth, requireRole('admin'), (req, res) => {
  const { name, category, description, address, latitude, longitude, owner_email } = req.body;
  if (!name || !owner_email) {
    return res.status(400).json({ error: 'name and owner_email are required' });
  }

  const owner = db.prepare('SELECT * FROM users WHERE email = ?').get(owner_email.toLowerCase());
  if (!owner) {
    return res.status(404).json({
      error: 'No user found with that email. Ask the shop owner to register a "shop_owner" account first.',
    });
  }
  if (owner.role !== 'shop_owner') {
    return res.status(400).json({ error: 'That user is not registered with the shop_owner role' });
  }

  const info = db
    .prepare(
      `INSERT INTO shops (owner_id, name, category, description, address, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(owner.id, name, category || null, description || null, address || null, latitude || null, longitude || null);

  const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ shop });
});

router.patch('/mine/detail', requireAuth, requireRole('shop_owner'), (req, res) => {
  const shop = db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(req.user.id);
  if (!shop) return res.status(404).json({ error: 'No shop assigned to this account' });

  const { description, address, category, upi_id, upi_payee_name, latitude, longitude } = req.body;
  db.prepare(
    `UPDATE shops SET
      description = COALESCE(?, description),
      address = COALESCE(?, address),
      category = COALESCE(?, category),
      upi_id = COALESCE(?, upi_id),
      upi_payee_name = COALESCE(?, upi_payee_name),
      latitude = COALESCE(?, latitude),
      longitude = COALESCE(?, longitude)
     WHERE id = ?`
  ).run(description ?? null, address ?? null, category ?? null, upi_id ?? null, upi_payee_name ?? null, latitude ?? null, longitude ?? null, shop.id);

  res.json({ shop: db.prepare('SELECT * FROM shops WHERE id = ?').get(shop.id) });
});

// ---------- Shop owner: view / update own shop ----------
router.get('/mine/detail', requireAuth, requireRole('shop_owner'), (req, res) => {
  const shop = db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(req.user.id);
  if (!shop) return res.status(404).json({ error: 'No shop assigned to this account yet. Ask the admin to add your shop.' });
  const products = db.prepare('SELECT * FROM products WHERE shop_id = ? ORDER BY name ASC').all(shop.id);
  res.json({ shop, products });
});

router.patch('/mine/detail', requireAuth, requireRole('shop_owner'), (req, res) => {
  const shop = db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(req.user.id);
  if (!shop) return res.status(404).json({ error: 'No shop assigned to this account' });

  const { description, address, category } = req.body;
  db.prepare('UPDATE shops SET description = COALESCE(?, description), address = COALESCE(?, address), category = COALESCE(?, category) WHERE id = ?')
    .run(description ?? null, address ?? null, category ?? null, shop.id);

  res.json({ shop: db.prepare('SELECT * FROM shops WHERE id = ?').get(shop.id) });
});

module.exports = router;
