const express = require('express');
const db = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getIo } = require('../sockets/index');

const router = express.Router();
const DELIVERY_FEE = Number(process.env.PLATFORM_DELIVERY_FEE || 30);

async function orderWithItems(orderId) {
  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return null;
  const items = await db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
  return { ...order, items };
}

function safeEmit(event, room, payload) {
  try {
    getIo().to(room).emit(event, payload);
  } catch (err) {
    // Socket layer may not be ready in tests; never let this break the HTTP response.
  }
}

// ---------- Customer: place an order (single shop per order) ----------
router.post('/', requireAuth, requireRole('customer'), async (req, res) => {
  const { shop_id, items, delivery_address, delivery_latitude, delivery_longitude, customer_note, payment_method } = req.body;

  if (!shop_id || !Array.isArray(items) || items.length === 0 || !delivery_address) {
    return res.status(400).json({ error: 'shop_id, items[] and delivery_address are required' });
  }

  const method = payment_method === 'online' ? 'online' : 'cod';

  const shop = await db.prepare('SELECT * FROM shops WHERE id = ? AND is_active = 1').get(shop_id);
  if (!shop) return res.status(404).json({ error: 'Shop not found or not active' });

  if (method === 'online' && !shop.upi_id) {
    return res.status(400).json({ error: 'This shop has not set up online payment yet. Please choose Cash on Delivery.' });
  }

  const placeOrder = db.transaction(async () => {
    let itemsTotal = 0;
    const resolvedItems = [];

    for (const line of items) {
      const product = await db
        .prepare('SELECT * FROM products WHERE id = ? AND shop_id = ? AND is_active = 1')
        .get(line.product_id, shop_id);
      if (!product) throw new Error(`Product ${line.product_id} is not available in this shop`);
      const qty = Number(line.quantity);
      if (!qty || qty <= 0) throw new Error(`Invalid quantity for ${product.name}`);
      if (product.quantity < qty) throw new Error(`Only ${product.quantity} ${product.unit}(s) of ${product.name} left in stock`);

      itemsTotal += product.price * qty;
      resolvedItems.push({ product, qty });
    }

    const grandTotal = itemsTotal + DELIVERY_FEE;

    const orderInfo = await db
      .prepare(
        `INSERT INTO orders
          (customer_id, shop_id, status, items_total, delivery_fee, grand_total, delivery_address, delivery_latitude, delivery_longitude, customer_note, payment_method, payment_status)
         VALUES (?, ?, 'placed', ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
      )
      .run(req.user.id, shop_id, itemsTotal, DELIVERY_FEE, grandTotal, delivery_address, delivery_latitude || null, delivery_longitude || null, customer_note || null, method);

    const orderId = orderInfo.lastInsertRowid;

    for (const { product, qty } of resolvedItems) {
      await db
        .prepare(`INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity) VALUES (?, ?, ?, ?, ?)`)
        .run(orderId, product.id, product.name, product.price, qty);

      await db.prepare('UPDATE products SET quantity = quantity - ? WHERE id = ?').run(qty, product.id);
    }

    return orderId;
  });

  let orderId;
  try {
    orderId = await placeOrder();
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const order = await orderWithItems(orderId);
  safeEmit('new_order', `shop_${shop_id}`, order);
  res.status(201).json({ order, shop_upi_id: shop.upi_id, shop_upi_payee_name: shop.upi_payee_name || shop.name });
});

// ---------- Customer: my orders / cancel while still unaccepted ----------
router.get('/mine', requireAuth, requireRole('customer'), async (req, res) => {
  const orders = await db
    .prepare(
      `SELECT o.*, s.name AS shop_name, s.latitude AS shop_latitude, s.longitude AS shop_longitude
       FROM orders o JOIN shops s ON s.id = o.shop_id
       WHERE o.customer_id = ? ORDER BY o.created_at DESC`
    )
    .all(req.user.id);
  res.json({ orders });
});

router.patch('/:id/mark-paid', requireAuth, requireRole('customer'), async (req, res) => {
  const order = await db.prepare('SELECT * FROM orders WHERE id = ? AND customer_id = ?').get(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.payment_method !== 'online') {
    return res.status(400).json({ error: 'This order is Cash on Delivery, no online payment to confirm' });
  }
  if (order.payment_status !== 'pending') {
    return res.status(400).json({ error: `Payment is already marked as ${order.payment_status}` });
  }

  await db.prepare("UPDATE orders SET payment_status = 'claimed_paid', updated_at = NOW() WHERE id = ?").run(order.id);
  const updated = await orderWithItems(order.id);
  safeEmit('order_status_changed', `shop_${order.shop_id}`, updated);
  res.json({ order: updated });
});

router.patch('/:id/confirm-payment', requireAuth, requireRole('shop_owner'), async (req, res) => {
  const shop = await db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(req.user.id);
  if (!shop) return res.status(404).json({ error: 'No shop assigned to this account' });

  const order = await db.prepare('SELECT * FROM orders WHERE id = ? AND shop_id = ?').get(req.params.id, shop.id);
  if (!order) return res.status(404).json({ error: 'Order not found in your shop' });
  if (order.payment_status !== 'claimed_paid') {
    return res.status(400).json({ error: 'Customer has not claimed payment for this order yet' });
  }

  await db.prepare("UPDATE orders SET payment_status = 'confirmed', updated_at = NOW() WHERE id = ?").run(order.id);
  const updated = await orderWithItems(order.id);
  safeEmit('order_status_changed', `user_${order.customer_id}`, updated);
  res.json({ order: updated });
});

router.patch('/:id/cancel', requireAuth, requireRole('customer'), async (req, res) => {
  const order = await db.prepare('SELECT * FROM orders WHERE id = ? AND customer_id = ?').get(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'placed') {
    return res.status(400).json({ error: 'Order can only be cancelled before the shop accepts it' });
  }

  const cancel = db.transaction(async () => {
    const items = await db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    for (const item of items) {
      await db.prepare('UPDATE products SET quantity = quantity + ? WHERE id = ?').run(item.quantity, item.product_id);
    }
    await db.prepare("UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = ?").run(order.id);
  });
  await cancel();

  const updated = await orderWithItems(order.id);
  safeEmit('order_status_changed', `shop_${order.shop_id}`, updated);
  res.json({ order: updated });
});

// ---------- Shared: fetch one order ----------
router.get('/:id', requireAuth, async (req, res) => {
  const order = await orderWithItems(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const shop = await db.prepare('SELECT * FROM shops WHERE id = ?').get(order.shop_id);
  const isOwner = req.user.role === 'shop_owner' && shop.owner_id === req.user.id;
  const isCustomer = req.user.role === 'customer' && order.customer_id === req.user.id;
  const isDeliveryBoy = req.user.role === 'delivery_boy' && order.delivery_boy_id === req.user.id;
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isCustomer && !isDeliveryBoy && !isAdmin) {
    return res.status(403).json({ error: 'You do not have access to this order' });
  }

  res.json({ order, shop });
});

// ---------- Shop owner: incoming orders + accept + pack ----------
router.get('/shop/incoming', requireAuth, requireRole('shop_owner'), async (req, res) => {
  const shop = await db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(req.user.id);
  if (!shop) return res.status(404).json({ error: 'No shop assigned to this account' });

  const orders = await db
    .prepare(
      `SELECT * FROM orders WHERE shop_id = ? AND status IN ('placed','accepted','packed','assigned','picked_up')
       ORDER BY created_at ASC`
    )
    .all(shop.id);
  res.json({ orders });
});

router.get('/shop/history', requireAuth, requireRole('shop_owner'), async (req, res) => {
  const shop = await db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(req.user.id);
  if (!shop) return res.status(404).json({ error: 'No shop assigned to this account' });

  const orders = await db
    .prepare(`SELECT * FROM orders WHERE shop_id = ? AND status IN ('delivered','cancelled') ORDER BY created_at DESC`)
    .all(shop.id);
  res.json({ orders });
});

async function shopOwnerTransition(req, res, fromStatuses, toStatus, extraEvent) {
  const shop = await db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(req.user.id);
  if (!shop) return res.status(404).json({ error: 'No shop assigned to this account' });

  const order = await db.prepare('SELECT * FROM orders WHERE id = ? AND shop_id = ?').get(req.params.id, shop.id);
  if (!order) return res.status(404).json({ error: 'Order not found in your shop' });
  if (!fromStatuses.includes(order.status)) {
    return res.status(400).json({ error: `Order must be in status ${fromStatuses.join('/')} for this action` });
  }

  await db.prepare('UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?').run(toStatus, order.id);
  const updated = await orderWithItems(order.id);

  safeEmit('order_status_changed', `user_${order.customer_id}`, updated);
  safeEmit('order_status_changed', `shop_${shop.id}`, updated);
  if (extraEvent) safeEmit(extraEvent.name, extraEvent.room, updated);

  res.json({ order: updated });
}

router.patch('/:id/accept', requireAuth, requireRole('shop_owner'), async (req, res) => {
  await shopOwnerTransition(req, res, ['placed'], 'accepted');
});

router.patch('/:id/pack', requireAuth, requireRole('shop_owner'), async (req, res) => {
  const shop = await db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(req.user.id);
  if (shop) {
    const order = await db.prepare('SELECT * FROM orders WHERE id = ? AND shop_id = ?').get(req.params.id, shop.id);
    if (order && order.payment_method === 'online' && order.payment_status !== 'confirmed') {
      return res.status(400).json({ error: 'Please confirm you have received the UPI payment before packing this order' });
    }
  }
  await shopOwnerTransition(req, res, ['accepted'], 'packed', { name: 'order_available_for_pickup', room: 'delivery_pool' });
});

// ---------- Delivery boy ----------
router.get('/delivery/pool', requireAuth, requireRole('delivery_boy'), async (req, res) => {
  const orders = await db
    .prepare(
      `SELECT o.*, s.name AS shop_name, s.address AS shop_address, s.latitude AS shop_latitude, s.longitude AS shop_longitude
       FROM orders o JOIN shops s ON s.id = o.shop_id
       WHERE o.status = 'packed' ORDER BY o.updated_at ASC`
    )
    .all();
  res.json({ orders });
});

router.get('/delivery/mine', requireAuth, requireRole('delivery_boy'), async (req, res) => {
  const orders = await db
    .prepare(
      `SELECT o.*, s.name AS shop_name, s.address AS shop_address, s.latitude AS shop_latitude, s.longitude AS shop_longitude
       FROM orders o JOIN shops s ON s.id = o.shop_id
       WHERE o.delivery_boy_id = ? ORDER BY o.created_at DESC`
    )
    .all(req.user.id);
  res.json({ orders });
});

router.patch('/:id/claim', requireAuth, requireRole('delivery_boy'), async (req, res) => {
  const order = await db.prepare("SELECT * FROM orders WHERE id = ? AND status = 'packed'").get(req.params.id);
  if (!order) return res.status(409).json({ error: 'This order is no longer available for pickup (already claimed or not packed yet)' });

  const claim = db.transaction(async () => {
    const stillAvailable = await db.prepare("SELECT id FROM orders WHERE id = ? AND status = 'packed'").get(order.id);
    if (!stillAvailable) throw new Error('ALREADY_CLAIMED');
    await db
      .prepare("UPDATE orders SET status = 'assigned', delivery_boy_id = ?, updated_at = NOW() WHERE id = ?")
      .run(req.user.id, order.id);
  });

  try {
    await claim();
  } catch (err) {
    return res.status(409).json({ error: 'This order was just claimed by another delivery partner' });
  }

  const updated = await orderWithItems(order.id);
  safeEmit('order_status_changed', `user_${order.customer_id}`, updated);
  safeEmit('order_status_changed', `shop_${order.shop_id}`, updated);
  safeEmit('order_claimed', 'delivery_pool', { orderId: order.id });
  res.json({ order: updated });
});

router.patch('/:id/picked-up', requireAuth, requireRole('delivery_boy'), async (req, res) => {
  const order = await db.prepare('SELECT * FROM orders WHERE id = ? AND delivery_boy_id = ?').get(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: 'Order not found or not assigned to you' });
  if (order.status !== 'assigned') return res.status(400).json({ error: 'Order must be assigned before pickup' });

  await db.prepare("UPDATE orders SET status = 'picked_up', updated_at = NOW() WHERE id = ?").run(order.id);
  const updated = await orderWithItems(order.id);
  safeEmit('order_status_changed', `user_${order.customer_id}`, updated);
  safeEmit('order_status_changed', `shop_${order.shop_id}`, updated);
  res.json({ order: updated });
});

router.patch('/:id/delivered', requireAuth, requireRole('delivery_boy'), async (req, res) => {
  const order = await db.prepare('SELECT * FROM orders WHERE id = ? AND delivery_boy_id = ?').get(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: 'Order not found or not assigned to you' });
  if (order.status !== 'picked_up') return res.status(400).json({ error: 'Order must be picked up before it can be marked delivered' });

  const finish = db.transaction(async () => {
    await db.prepare("UPDATE orders SET status = 'delivered', updated_at = NOW() WHERE id = ?").run(order.id);
    await db
      .prepare('INSERT INTO delivery_earnings (delivery_boy_id, order_id, amount) VALUES (?, ?, ?)')
      .run(req.user.id, order.id, order.delivery_fee);
  });
  await finish();

  const updated = await orderWithItems(order.id);
  safeEmit('order_status_changed', `user_${order.customer_id}`, updated);
  safeEmit('order_status_changed', `shop_${order.shop_id}`, updated);
  res.json({ order: updated });
});

router.get('/delivery/earnings', requireAuth, requireRole('delivery_boy'), async (req, res) => {
  const rows = await db
    .prepare(
      `SELECT e.*, o.delivery_address FROM delivery_earnings e JOIN orders o ON o.id = e.order_id
       WHERE e.delivery_boy_id = ? ORDER BY e.created_at DESC`
    )
    .all(req.user.id);
  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  res.json({ total, entries: rows });
});

// ---------- Admin ----------
router.get('/admin/all', requireAuth, requireRole('admin'), async (req, res) => {
  const orders = await db
    .prepare(
      `SELECT o.*, s.name AS shop_name, c.name AS customer_name, d.name AS delivery_boy_name
       FROM orders o
       JOIN shops s ON s.id = o.shop_id
       JOIN users c ON c.id = o.customer_id
       LEFT JOIN users d ON d.id = o.delivery_boy_id
       ORDER BY o.created_at DESC LIMIT 200`
    )
    .all();
  res.json({ orders });
});

module.exports = router;
