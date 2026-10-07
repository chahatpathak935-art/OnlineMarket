
const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for Supabase's connection pooler
});

// Lets db.transaction() make every query inside its callback share one connection,
// without having to pass that connection through every function manually.
const txnContext = new AsyncLocalStorage();
function getExecutor() {
  return txnContext.getStore() || pool;
}

// Converts SQLite-style "?" placeholders to Postgres-style "$1, $2, ..." so every
// existing query string elsewhere in the app can stay exactly as it's written.
function toPgSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function normalizeParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params;
}

function prepare(sql) {
  const trimmed = sql.trim();
  const pgSql = toPgSql(trimmed);
  const isInsert = /^INSERT/i.test(trimmed) && !/RETURNING/i.test(trimmed);
  const runSql = isInsert ? `${pgSql.replace(/;\s*$/, '')} RETURNING id` : pgSql;

  return {
    async get(...params) {
      const result = await getExecutor().query(pgSql, normalizeParams(params));
      return result.rows[0];
    },
    async all(...params) {
      const result = await getExecutor().query(pgSql, normalizeParams(params));
      return result.rows;
    },
    async run(...params) {
      const result = await getExecutor().query(runSql, normalizeParams(params));
      return {
        lastInsertRowid: result.rows[0] ? result.rows[0].id : undefined,
        changes: result.rowCount,
      };
    },
  };
}

// Mirrors better-sqlite3's db.transaction(fn) — call it, then call the function it
// returns. Every query run inside fn (even in nested function calls) is atomic.
function transaction(fn) {
  return async (...args) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await txnContext.run(client, () => fn(...args));
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {
        /* connection already broken; nothing more to do */
      }
      throw err;
    } finally {
      client.release();
    }
  };
}

async function exec(sql) {
  await pool.query(sql);
}

// ---------- Schema ----------
async function initSchema() {
  await exec(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin','shop_owner','delivery_boy','customer')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS shops (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT,
      description TEXT,
      address TEXT,
      latitude REAL,
      longitude REAL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      upi_id TEXT,
      upi_payee_name TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      unit TEXT DEFAULT 'pc',
      quantity INTEGER NOT NULL DEFAULT 0,
      image_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES users(id),
      shop_id INTEGER NOT NULL REFERENCES shops(id),
      delivery_boy_id INTEGER REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'placed' CHECK (status IN
        ('placed','accepted','packed','assigned','picked_up','delivered','cancelled')),
      items_total REAL NOT NULL,
      delivery_fee REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL,
      delivery_address TEXT NOT NULL,
      delivery_latitude REAL,
      delivery_longitude REAL,
      customer_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      payment_method TEXT NOT NULL DEFAULT 'cod',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      delivery_boy_lat REAL,
      delivery_boy_lng REAL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS delivery_earnings (
      id SERIAL PRIMARY KEY,
      delivery_boy_id INTEGER NOT NULL REFERENCES users(id),
      order_id INTEGER NOT NULL REFERENCES orders(id),
      amount REAL NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
    CREATE INDEX IF NOT EXISTS idx_orders_shop ON orders(shop_id);
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_delivery ON orders(delivery_boy_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

    CREATE TABLE IF NOT EXISTS otps (
      id SERIAL PRIMARY KEY,
      identifier TEXT NOT NULL,
      purpose TEXT NOT NULL CHECK (purpose IN ('register','login','reset')),
      code_hash TEXT NOT NULL,
      payload TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      expires_at BIGINT NOT NULL,
      created_at BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS otp_sends (
      id SERIAL PRIMARY KEY,
      identifier TEXT NOT NULL,
      purpose TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_otps_lookup ON otps(identifier, purpose);
    CREATE INDEX IF NOT EXISTS idx_otp_sends_lookup ON otp_sends(identifier, purpose, created_at);
  `);

  // Safe to run every startup — fills in columns if an older deploy is missing them.
  await exec(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS upi_id TEXT;`);
  await exec(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS upi_payee_name TEXT;`);
  await exec(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cod';`);
  await exec(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';`);
  await exec(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_boy_lat REAL;`);
  await exec(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_boy_lng REAL;`);
}

module.exports = { prepare, transaction, exec, initSchema, pool };
