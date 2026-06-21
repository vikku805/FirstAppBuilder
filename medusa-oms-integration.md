# Sending Magento Orders into Medusa (OMS) — A Friendly Guide

## What is this, in plain words?

When a customer places an order in **Magento**, we want that same order to **automatically
appear in Medusa** (an order management dashboard) — without anyone copying it by hand.

You already have this working for **Odoo** (your ERP). This guide adds **Medusa** as a *second*
place the order gets sent. So one order now shows up in **both** systems.

Think of it like sending one email to two people at once (CC). The order is the email; Odoo and
Medusa are the two recipients.

```
Customer buys in Magento
        │
        ▼
  order-sync action  ──►  Odoo   (your ERP — already done)
        │
        └────────────►  Medusa (your OMS — new in this guide)
```

> We call this **"fan-out"** — one incoming order is *fanned out* to multiple systems.

---

## A few words you'll keep seeing (mini-glossary)

| Term | What it means here |
|------|--------------------|
| **OMS** | Order Management System — a dashboard to view/manage orders. Medusa is our OMS. |
| **Draft order** | The way Medusa lets you create an order manually through its API. That's what we create. |
| **Region** | A Medusa setting (e.g. "Europe", "US") every order must belong to. We just need its id. |
| **Sales Channel** | Another required Medusa setting (e.g. "Default"). We just need its id. |
| **API key** | A password-like secret that lets our code log in to Medusa automatically. |
| **Best-effort** | If Medusa is down, we log the problem but **don't break** the Odoo order. Odoo always wins. |

---

## Part 1 — Install Medusa (you only do this once)

Medusa is its **own application** (separate from this project). It needs a **PostgreSQL**
database to store data.

**Step 1. Give Medusa a database** (using Docker, which you already run):
```powershell
docker run -d --name medusa_db -e POSTGRES_USER=medusa -e POSTGRES_PASSWORD=medusa -e POSTGRES_DB=medusa -p 5433:5432 postgres:16
```

**Step 2. Create and start Medusa:**
```powershell
npx create-medusa-app@latest my-oms --db-url "postgres://medusa:medusa@localhost:5433/medusa"
```
The installer will ask you a few questions:
- *Install the Next.js storefront?* → **No** (that's a shop website; we don't need it).
- *Install the Medusa plugin for Claude Code?* → **No** (optional, not needed).
- *Create an admin user* → enter an **email and password** — write these down, you'll log in with them.
- *Seed sample data?* → **Yes** (this auto-creates a Region and Sales Channel for you).

When it finishes, it opens the dashboard at **http://localhost:9000/app**.

> 💡 **`http://localhost:9000/` by itself shows nothing — that's normal.** Use `/app` for the
> dashboard. To check it's alive, open `http://localhost:9000/health` (it should say `OK`).

**To start Medusa again next time:**
```powershell
cd my-oms
npm run dev
```

---

## Part 2 — Get 3 things from Medusa

Log in to the dashboard (`http://localhost:9000/app`), then go to **Settings** and collect:

1. **API key** → *Settings → API Key Management* → create a **Secret** key. It looks like `sk_...`
2. **Region id** → *Settings → Regions* → open your region, copy its id. Looks like `reg_...`
3. **Sales Channel id** → *Settings → Sales Channels* → copy its id. Looks like `sc_...`

---

## Part 3 — Tell the App Builder action about Medusa

Open the [.env](.env) file and fill in the values you just collected:
```
MEDUSA_URL=http://localhost:9000
MEDUSA_API_KEY=sk_...               ← paste your key
MEDUSA_REGION_ID=reg_...            ← paste your region id
MEDUSA_SALES_CHANNEL_ID=sc_...      ← paste your sales channel id
```

Then **restart the dev server** (it does NOT pick up `.env` changes on its own):
```powershell
aio app dev
```

> If you leave `MEDUSA_API_KEY` empty, the integration simply **skips Medusa** and only sends to
> Odoo — nothing breaks. That's the safety switch.

---

## Part 4 — Test it end to end

1. Place an order in Magento.
2. Run the consumer so the order gets delivered:
   ```powershell
   docker exec -u www-data magento_app php bin/magento queue:consumers:start order.export.consumer --max-messages=10 --single-thread
   ```
3. Watch the **`aio app dev`** window. You should see **three** lines:
   - `Created Odoo sale.order id=…`
   - `Created Medusa draft order id=…`
   - `Converted Medusa order id=… to a real order`
4. Open Medusa → **Orders** (the normal Orders page, **not** Drafts). Your Magento order is there. 🎉
   (And it's still in Odoo too — we didn't break anything.)

> ℹ️ **Why "Orders" and not "Drafts"?** Medusa creates the order as a *draft* first. In this
> Medusa version the **Drafts admin page is buggy** (it crashes with
> `useLocation() may be used only in the context of a <Router>`). So the integration
> **converts the draft into a real order**, which shows on the normal Orders page that works fine.

---

## What I changed in your code (and why)

Only **4 places**, all small. The real code is shown below so you can see exactly what was added.

### 1. NEW file — [actions/order-sync/medusa.js](actions/order-sync/medusa.js)
The "translator" that talks to Medusa: logs in with your API key, then creates the draft order.
You don't edit this — it just works once `.env` is filled.

```js
const fetch = require('node-fetch')
const MEDUSA_TIMEOUT_MS = 20000   // fail fast if Medusa is unreachable

// Build the login header: an API key (Basic), else email/password -> JWT.
async function authHeader (cfg) {
  if (cfg.apiKey) {
    return 'Basic ' + Buffer.from(`${cfg.apiKey}:`).toString('base64')
  }
  const res = await fetch(`${cfg.url}/auth/user/emailpass`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cfg.email, password: cfg.password }),
    timeout: MEDUSA_TIMEOUT_MS
  })
  const json = await readJson(res)
  if (!res.ok || !json.token) throw new Error(`Medusa auth failed: HTTP ${res.status}`)
  return `Bearer ${json.token}`
}

// One reusable, authenticated request helper. Throws on any non-2xx.
async function request (ctx, method, path, body) {
  const res = await fetch(`${ctx.url}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: ctx.auth },
    body: body ? JSON.stringify(body) : undefined,
    timeout: MEDUSA_TIMEOUT_MS
  })
  const json = await readJson(res)
  if (!res.ok) throw new Error(`Medusa ${method} ${path} failed: HTTP ${res.status} ${JSON.stringify(json)}`)
  return json
}

// Log in once and return a context to reuse for the next calls.
async function connect (cfg) {
  const auth = await authHeader(cfg)
  return { url: cfg.url, auth, regionId: cfg.regionId, salesChannelId: cfg.salesChannelId }
}

// Don't create the same order twice (best-effort, via metadata we stamp on it).
async function findDraftOrderByRef (ctx, ref) {
  const q = encodeURIComponent(JSON.stringify({ magento_increment_id: ref }))
  const json = await request(ctx, 'GET', `/admin/draft-orders?metadata=${q}&limit=1`)
  const orders = json.draft_orders || json.orders || []
  return orders.length > 0 ? orders[0].id : null
}

// Create the draft order from the Magento order's items.
async function createDraftOrder (ctx, { email, ref, items, shippingAddress, billingAddress }) {
  const body = {
    email,
    region_id: ctx.regionId,
    sales_channel_id: ctx.salesChannelId,
    items: items.map((i) => ({ title: i.title, quantity: i.quantity, unit_price: i.unit_price })),
    metadata: { magento_increment_id: ref }
  }
  if (shippingAddress) body.shipping_address = shippingAddress
  if (billingAddress) body.billing_address = billingAddress
  const json = await request(ctx, 'POST', '/admin/draft-orders', body)
  return (json.draft_order || json.order || json).id
}

// Promote a draft to a real order (Drafts admin page is buggy in this Medusa version).
function convertToOrder (ctx, draftId) {
  return request(ctx, 'POST', `/admin/draft-orders/${draftId}/convert-to-order`, {})
}

module.exports = { authHeader, request, connect, findDraftOrderByRef, createDraftOrder, convertToOrder }
```

### 2. EDITED — [actions/order-sync/index.js](actions/order-sync/index.js)
This action already sent orders to Odoo. I added a helper that sends the same order to Medusa,
then called it *after* Odoo. The helper is wrapped in try/catch so **a Medusa failure never
breaks the Odoo order** (best-effort).

**Added near the top — imports + 3 small helpers:**
```js
const medusa = require('./medusa')

// Treat empty values and unresolved $VARs (dev mode) as "not set".
function cleanInput (value) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'string' && value.startsWith('$')) return undefined
  return value
}

// Convert a Magento address into Medusa's address shape.
function toMedusaAddress (addr, customer = {}) {
  if (!addr) return undefined
  const street = Array.isArray(addr.street) ? addr.street : [addr.street]
  return {
    first_name: addr.firstname || customer.firstname,
    last_name: addr.lastname || customer.lastname,
    address_1: street[0],
    address_2: street[1],
    city: addr.city,
    province: addr.region,
    postal_code: addr.postcode,
    country_code: addr.country ? String(addr.country).toLowerCase() : undefined,
    phone: addr.telephone
  }
}

// Best-effort fan-out to Medusa. Never throws — returns a status object.
async function syncToMedusa (params, logger) {
  const cfg = {
    url: cleanInput(params.MEDUSA_URL),
    apiKey: cleanInput(params.MEDUSA_API_KEY),
    email: cleanInput(params.MEDUSA_EMAIL),
    password: cleanInput(params.MEDUSA_PASSWORD),
    regionId: cleanInput(params.MEDUSA_REGION_ID),
    salesChannelId: cleanInput(params.MEDUSA_SALES_CHANNEL_ID)
  }
  if (!cfg.url || (!cfg.apiKey && !(cfg.email && cfg.password))) {
    logger.info('Medusa not configured, skipping OMS fan-out')
    return { skipped: true }
  }
  const incrementId = params.increment_id
  try {
    const ctx = await medusa.connect(cfg)
    let existing = null
    try { existing = await medusa.findDraftOrderByRef(ctx, incrementId) } catch (e) { logger.debug(`idempotency check skipped: ${e.message}`) }
    if (existing) return { created: false, draft_order_id: existing }

    const items = (Array.isArray(params.items) ? params.items : []).map((i) => ({
      title: i.name || i.sku, quantity: Number(i.qty) || 1, unit_price: Number(i.price) || 0
    }))
    const draftId = await medusa.createDraftOrder(ctx, {
      email: params.customer && params.customer.email,
      ref: incrementId, items,
      shippingAddress: toMedusaAddress(params.shipping_address, params.customer),
      billingAddress: toMedusaAddress(params.billing_address, params.customer)
    })
    logger.info(`Created Medusa draft order id=${draftId} for ${incrementId}`)

    // Promote draft -> real order so it shows on the working Orders page.
    try {
      await medusa.convertToOrder(ctx, draftId)
      logger.info(`Converted Medusa order id=${draftId} to a real order`)
      return { created: true, order_id: draftId, converted: true }
    } catch (e) {
      logger.error(`Medusa convert-to-order failed: ${e.message}`)
      return { created: true, order_id: draftId, converted: false }
    }
  } catch (error) {
    logger.error(`Medusa OMS fan-out failed: ${error.message}`)
    return { created: false, error: error.message }   // best-effort: don't fail the action
  }
}
```

**Inside `main()` — call Medusa after the Odoo result, and add it to the response:**
```js
    // --- Medusa OMS (secondary, best-effort) ---
    const medusaResult = await syncToMedusa(params, logger)

    return {
      statusCode: 200,
      body: {
        increment_id: incrementId,
        ...odooResult,          // odoo_sale_order_id, created, confirmed, ...
        medusa: medusaResult    // { created, order_id, converted } | { skipped } | { error }
      }
    }
```

### 3. EDITED — [app.config.yaml](app.config.yaml)
Registered the new settings as action inputs (added under `order-sync: inputs:`):
```yaml
              MEDUSA_URL: $MEDUSA_URL
              MEDUSA_API_KEY: $MEDUSA_API_KEY
              MEDUSA_EMAIL: $MEDUSA_EMAIL
              MEDUSA_PASSWORD: $MEDUSA_PASSWORD
              MEDUSA_REGION_ID: $MEDUSA_REGION_ID
              MEDUSA_SALES_CHANNEL_ID: $MEDUSA_SALES_CHANNEL_ID
```

### 4. EDITED — [.env](.env)
Added the secret values (this file is gitignored):
```
MEDUSA_URL=http://localhost:9000
MEDUSA_API_KEY=
MEDUSA_EMAIL=
MEDUSA_PASSWORD=
MEDUSA_REGION_ID=
MEDUSA_SALES_CHANNEL_ID=
```

### 5. EDITED — [test/order-sync.test.js](test/order-sync.test.js)
Added tests proving the fan-out behaves: order goes to **both** systems; **Medusa failure** keeps
the action successful (Odoo wins); Medusa is **skipped** when unconfigured. Run with `npm test`
(14 passing). Example:
```js
test('Medusa failure does not fail the action (Odoo still succeeds)', async () => {
  mockOdooCreateFlow()
  fetch
    .mockResolvedValueOnce(medusaRes({ draft_orders: [] }))                 // find -> none
    .mockResolvedValueOnce(medusaRes({ message: 'bad request' }, false, 400)) // create -> fails
  const response = await action.main({ ...fakeParams, ...medusaParams })
  expect(response.statusCode).toEqual(200)            // action still OK
  expect(response.body.odoo_sale_order_id).toEqual(42)
  expect(response.body.medusa.created).toEqual(false)
})
```

---

## If something doesn't work

| What you see | Likely cause | Fix |
|--------------|--------------|-----|
| `localhost:9000` blank | Normal — `/` has no page | Use `/app` and `/health` |
| `npm run dev` fails fast (turbo exit 1) on Windows | turbo wrapper issue | Run Medusa directly: `cd my-oms\apps\backend` then `npx medusa develop` |
| Drafts page crashes (`useLocation … <Router>`) | Known bug in `@medusajs/draft-order` admin | Expected — we convert drafts to real orders; look under **Orders**, not Drafts |
| No `Created Medusa draft order` line | `.env` not filled, or dev server not restarted | Fill `.env`, restart `aio app dev` |
| `Medusa OMS fan-out failed … HTTP 400` | Medusa wanted slightly different fields | Send me the error; I'll tweak `medusa.js` |
| Order in Medusa but not Odoo (or vice-versa) | One system was down | Check that window's logs; Odoo is primary |

---

## Good to know (current limits)

- The order is created as a **draft** and then **converted to a real order** (so it shows on the
  working Orders page; the Drafts admin page is buggy in this Medusa version).
- Products are added as simple line items (we don't match them to a Medusa product catalog).
- Start Medusa from `my-oms\apps\backend` with `npx medusa develop` (the root `npm run dev`/turbo
  wrapper fails on Windows here).
- `localhost` only works while developing on this PC. A cloud deployment would need a public
  Medusa address.
