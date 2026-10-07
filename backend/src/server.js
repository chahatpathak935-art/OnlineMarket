require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');

const { initSchema } = require('./db/db');
const { initSockets } = require('./sockets/index');

const authRoutes = require('./routes/auth.routes');
const shopsRoutes = require('./routes/shops.routes');
const productsRoutes = require('./routes/products.routes');
const ordersRoutes = require('./routes/orders.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'mandi-market-backend' }));

app.use('/api/auth', authRoutes);
app.use('/api/shops', shopsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const server = http.createServer(app);
initSockets(server, corsOrigin);

const PORT = process.env.PORT || 4000;

(async () => {
  try {
    await initSchema();
    server.listen(PORT, () => {
      console.log(`Mandi Market API running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to initialize database schema:', err);
    process.exit(1);
  }
})();
