# Online Market

A district-wide, multi-shop marketplace: customers browse every shop in one place, order from a
single shop at a time, the shop owner packs it, and a delivery partner picks up and delivers it —
earning a fee per delivery. You, the admin, control which shops are on the platform.

## How it works

```
Customer                Shop owner              Delivery partner        Admin
--------                -----------              -----------------        -----
Browse shops     ─────▶  New order arrives
Add items,                (live notification)
place order                 │
                             ▼
                        Accept → Pack ──────▶  Sees it in the pickup pool
                                                Claims it
                                                Picks up from shop
                                                Delivers to customer
                                                Earns the delivery fee
                                                                        Adds/removes shops
                                                                        Manages all users
                                                                        Views platform stats
```

Order status flow: `placed → accepted → packed → assigned → picked_up → delivered`
(or `cancelled`, only while still `placed`).

## Project structure

```
mandi-market/
├── backend/     Node.js + Express + SQLite API, with Socket.io for live order updates
└── frontend/    React + Vite + Tailwind, with dashboards for all four roles
```

## Running it locally

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # already done for you; edit JWT_SECRET before going live
npm run seed               # creates the first admin login
npm run dev                 # starts the API on http://localhost:4000
```

The seed script prints an admin email/password — use it to log in and start adding real shops.
**Change that password (or the account) before deploying for real.**

The database is a single SQLite file at `backend/data/mandi.db` — no separate database server
to install. Delete that file any time to start fresh (you'll need to re-run `npm run seed`).

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env       # points the frontend at your API URL
npm run dev                  # starts the site on http://localhost:5173
```

Open http://localhost:5173. Register a **shop owner** account and a **delivery partner** account
from the sign-up page, then log in as admin (`/login`) and add a shop against the shop owner's
email on the Admin → Shops page.

## Typical first run, end to end

1. Log in as admin (from the seed output). Go to **Admin → Shops**.
2. Register a shop-owner account from `/register` in another browser/incognito window.
3. As admin, add a shop using that shop owner's email — this links the account to a real shop.
4. Log in as the shop owner, go to **Inventory**, add a few items with price/quantity.
5. Register a customer account, browse **Shops**, open the shop, add items, checkout with a
   delivery address.
6. Back in the shop owner's tab: the order appears instantly under **Orders** → Accept → Pack.
7. Register (or log in as) a delivery partner: the packed order appears in **Available for
   pickup** → Claim → Mark picked up → Mark delivered. The delivery fee lands in **Earnings**.
8. The customer can watch the status change live on **My orders**.

## OTP verification (registration, login, forgot password)

Every sign-up, login and password reset needs a 6-digit code sent by email.

- **Local dev**: leave `SMTP_HOST` empty in `backend/.env`. The code is printed in the backend console as `[DEV OTP] ...`.
- **Production**: set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` (any SMTP provider: Brevo, SES, Gmail app password, etc.).
- Codes are stored hashed, expire after 5 minutes, allow 5 wrong tries, are single-use, and can be resent every 30 seconds (max 6 per hour).
- **Admin**: the admin also logs in with a code, so seed with a real inbox: `ADMIN_EMAIL=you@example.com npm run seed`.
- After pulling these changes run `npm install` in `backend/` (adds `nodemailer` and `express-rate-limit`).

## Deploying for real

- **Backend**: any Node host works (Railway, Render, a VPS, etc.). Set real values for
  `JWT_SECRET` and `CORS_ORIGIN` (your frontend's deployed URL) in its environment variables.
  SQLite's file works fine for a single-server deployment; if you outgrow one server, swap
  `better-sqlite3` for a hosted Postgres/MySQL client — the SQL is close to standard and lives
  entirely in `backend/src/db/db.js` and the route files.
- **Frontend**: build with `npm run build` inside `frontend/` and host the `dist/` folder on
  any static host (Vercel, Netlify, etc.). Set `VITE_API_URL` to your deployed backend's `/api`
  URL before building.
- **Images for products/shops**: this version stores an optional `image_url` per product — wire
  it up to any image host or object storage (S3, Cloudinary) when you're ready; the UI already
  has the field.

## Extending it

Some things left as clear next steps rather than guesses about what you need:
- **Payments**: orders currently assume cash/pay-on-delivery. Add a payment step in `Cart.jsx`
  and an `orders.routes.js` webhook for whichever gateway you pick (Razorpay is common in India).
- **Delivery assignment**: delivery partners currently *claim* packed orders from a shared pool
  (first to claim gets it) rather than being auto-assigned by distance. If you want automatic
  nearest-partner assignment, that logic belongs in the `pack` route in `orders.routes.js`.
- **Notifications off-site**: Socket.io covers in-app live updates. SMS/WhatsApp/push
  notifications would need a provider (Twilio, Firebase) wired into the same event points.
- **Shop owner self-signup approval**: shops are currently only created by the admin (as you
  described). If you'd rather let shop owners request a shop and have the admin approve it,
  that's a small addition to `shops.routes.js`.
