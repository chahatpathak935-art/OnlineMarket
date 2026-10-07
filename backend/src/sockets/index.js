const jwt = require('jsonwebtoken');

let io = null;

function initSockets(server, corsOrigin) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    socket.on('auth', async (token) => {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        socket.data.user = payload;

        socket.join(`user_${payload.id}`);

        if (payload.role === 'shop_owner') {
          const db = require('../db/db');
          const shop = await db.prepare('SELECT id FROM shops WHERE owner_id = ?').get(payload.id);
          if (shop) socket.join(`shop_${shop.id}`);
        }

        if (payload.role === 'delivery_boy') {
          socket.join('delivery_pool');
        }

        socket.emit('auth_ok');
      } catch (err) {
        socket.emit('auth_error', 'Invalid token');
      }
    });

    socket.on('delivery_location_update', async ({ orderId, latitude, longitude }) => {
      try {
        const user = socket.data.user;
        if (!user || user.role !== 'delivery_boy' || !orderId || latitude == null || longitude == null) return;

        const db = require('../db/db');
        const order = await db
          .prepare("SELECT * FROM orders WHERE id = ? AND delivery_boy_id = ? AND status IN ('assigned','picked_up')")
          .get(orderId, user.id);
        if (!order) return;

        await db.prepare('UPDATE orders SET delivery_boy_lat = ?, delivery_boy_lng = ? WHERE id = ?').run(latitude, longitude, orderId);

        const payload = { orderId, latitude, longitude };
        io.to(`user_${order.customer_id}`).emit('delivery_location', payload);
        io.to(`shop_${order.shop_id}`).emit('delivery_location', payload);
      } catch (err) {
        console.error('delivery_location_update error:', err.message);
      }
    });
  });

  return io;
}

function getIo() {
  if (!io) throw new Error('Socket.io has not been initialized yet');
  return io;
}

module.exports = { initSockets, getIo };
