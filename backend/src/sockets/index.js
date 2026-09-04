const jwt = require('jsonwebtoken');

let io = null;

function initSockets(server, corsOrigin) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    // Client authenticates by sending its JWT right after connecting.
    socket.on('auth', (token) => {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        socket.data.user = payload;

        // Everyone joins a personal room so we can target them directly.
        socket.join(`user_${payload.id}`);

        if (payload.role === 'shop_owner') {
          const db = require('../db/db');
          const shop = db.prepare('SELECT id FROM shops WHERE owner_id = ?').get(payload.id);
          if (shop) socket.join(`shop_${shop.id}`);
        }

        if (payload.role === 'delivery_boy') {
          // Delivery pool room: anyone here can see freshly packed orders to claim.
          socket.join('delivery_pool');
        }

        socket.emit('auth_ok');
      } catch (err) {
        socket.emit('auth_error', 'Invalid token');
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
