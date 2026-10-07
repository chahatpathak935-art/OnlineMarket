const express = require('express');
const db = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

function getOwnShop(userId) {
  return db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(userId);
}

router.post('/', requireAuth, requireRole('shop_owner'), async (req, res) => {
  const shop = await getOwnShop(req.user.id);
  if (!shop) return res.status(404).json({ error: 'No shop assigned to this account' });

  const { name, description, price, unit, quantity, image_url } = req.body;
  if (!name || price == null || quantity == null) {
    return res.status(400).json({ error: 'name, price and quantity are required' });
  }
  if (price < 0 || quantity < 0) {
    return res.status(400).json({ error: 'price and quantity cannot be negative' });
  }

  const info = await db
    .prepare(
      `INSERT INTO products (shop_id, name, description, price, unit, quantity, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(shop.id, name, description || null, price, unit || 'pc', quantity, image_url || null);

  res.status(201).json({ product: await db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid) });
});

router.patch('/:id', requireAuth, requireRole('shop_owner'), async (req, res) => {
  const shop = await getOwnShop(req.user.id);
  if (!shop) return res.status(404).json({ error: 'No shop assigned to this account' });

  const product = await db.prepare('SELECT * FROM products WHERE id = ? AND shop_id = ?').get(req.params.id, shop.id);
  if (!product) return res.status(404).json({ error: 'Product not found in your shop' });

  const { name, description, price, unit, quantity, image_url, is_active } = req.body;
  if (price != null && price < 0) return res.status(400).json({ error: 'Price cannot be negative' });
  if (quantity != null && quantity < 0) return res.status(400).json({ error: 'Quantity cannot be negative' });

  await db
    .prepare(
      `UPDATE products SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        price = COALESCE(?, price),
        unit = COALESCE(?, unit),
        quantity = COALESCE(?, quantity),
        image_url = COALESCE(?, image_url),
        is_active = COALESCE(?, is_active)
       WHERE id = ?`
    )
    .run(
      name ?? null,
      description ?? null,
      price ?? null,
      unit ?? null,
      quantity ?? null,
      image_url ?? null,
      is_active == null ? null : is_active ? 1 : 0,
      product.id
    );

  res.json({ product: await db.prepare('SELECT * FROM products WHERE id = ?').get(product.id) });
});

router.patch('/:id/stock', requireAuth, requireRole('shop_owner'), async (req, res) => {
  const shop = await getOwnShop(req.user.id);
  if (!shop) return res.status(404).json({ error: 'No shop assigned to this account' });

  const product = await db.prepare('SELECT * FROM products WHERE id = ? AND shop_id = ?').get(req.params.id, shop.id);
  if (!product) return res.status(404).json({ error: 'Product not found in your shop' });

  const { delta } = req.body;
  if (typeof delta !== 'number') return res.status(400).json({ error: 'delta must be a number' });

  const newQty = product.quantity + delta;
  if (newQty < 0) return res.status(400).json({ error: 'Stock cannot go below zero' });

  await db.prepare('UPDATE products SET quantity = ? WHERE id = ?').run(newQty, product.id);
  res.json({ product: await db.prepare('SELECT * FROM products WHERE id = ?').get(product.id) });
});

router.delete('/:id', requireAuth, requireRole('shop_owner'), async (req, res) => {
  const shop = await getOwnShop(req.user.id);
  if (!shop) return res.status(404).json({ error: 'No shop assigned to this account' });

  const product = await db.prepare('SELECT * FROM products WHERE id = ? AND shop_id = ?').get(req.params.id, shop.id);
  if (!product) return res.status(404).json({ error: 'Product not found in your shop' });

  await db.prepare('DELETE FROM products WHERE id = ?').run(product.id);
  res.json({ success: true });
});

module.exports = router;
