# Product Feature — Beginner-Friendly Guide

This document explains, step by step, how the **Fetch Product** and **Create Product**
features work in this App Builder project. It is written for someone new to Adobe
App Builder, React, and the Adobe Commerce API.

---

## 1. The big picture

This app has two halves that talk to each other:

```
   BROWSER (Frontend / UI)                 ADOBE I/O RUNTIME (Backend / Action)            ADOBE COMMERCE
 ┌───────────────────────────┐          ┌──────────────────────────────────────┐       ┌──────────────────┐
 │  React app (web-src/)      │   HTTP   │  "commerce" action                     │  REST │  Magento store   │
 │  - Products page with tabs │ ───────► │  actions/commerce/index.js  (main)     │ ────► │  /rest/V1/...    │
 │  - Fetch / Create forms    │   POST   │  + oauth1a.js  (signs the request)     │       │  products, stock │
 │                            │ ◄─────── │                                        │ ◄──── │  categories      │
 └───────────────────────────┘   JSON   └──────────────────────────────────────┘       └──────────────────┘
```

- **Frontend** = what the user sees and clicks (React + Adobe React Spectrum UI components).
- **Action** = a small serverless function that runs in the cloud (Adobe I/O Runtime).
  It is the "middleman" that securely talks to Adobe Commerce.
- **Adobe Commerce** = the actual store (Magento) that holds the products.

**Why do we need the middleman action?**
The Commerce credentials (secret keys) must never live in the browser. The browser
only calls *our* action; the action holds the secrets and signs the request to Commerce.

---

## 2. The files involved (and what each one does)

| File | Layer | Job |
|------|-------|-----|
| [web-src/src/components/product.js](web-src/src/components/product.js) | Frontend | The Products page UI: two tabs (Fetch / Create) and the input fields |
| [web-src/src/hooks/useCommerceProduct.js](web-src/src/hooks/useCommerceProduct.js) | Frontend | Hook that **fetches** a product when a SKU is submitted |
| [web-src/src/hooks/useCreateProduct.js](web-src/src/hooks/useCreateProduct.js) | Frontend | Hook that **creates** a product from form input |
| [web-src/src/hooks/createProductHelpers.js](web-src/src/hooks/createProductHelpers.js) | Frontend | Pure logic: validate input + build the payload (no React — easy to unit test) |
| [web-src/src/utils.js](web-src/src/utils.js) | Frontend | `callAction()` — the function that actually sends the HTTP request to our action |
| `web-src/src/config.json` | Frontend | A generated map of action name → action URL |
| [actions/commerce/index.js](actions/commerce/index.js) | Backend | The action's `main()` — decides get vs create and calls Commerce |
| [actions/oauth1a.js](actions/oauth1a.js) | Backend | Builds the Commerce client and **signs** every request (OAuth1) |
| [actions/utils.js](actions/utils.js) | Backend | Helpers: check for missing inputs, format error responses |
| [app.config.yaml](app.config.yaml) | Config | Registers the `commerce` action and its inputs/credentials |

---

## 3. Key idea: ONE action, an "operation" switch

Both Fetch and Create go to the **same** action (`commerce`). The frontend sends an
extra field called `operation` to tell the action what to do:

- `operation: "get"`    → read a product
- `operation: "create"` → make a new product

Inside [actions/commerce/index.js](actions/commerce/index.js):

```js
const operation = params.operation || 'get';   // default to "get"
...
if (operation === 'get') {
  // read a product
} else if (operation === 'create') {
  // create a product
} else {
  // unknown operation → return a 400 error
}
```

---

## 4. FETCH PRODUCT — step by step

**Goal:** type a SKU, click "Fetch Product", see the product name.

### What happens, in order

```
[User types SKU] → [clicks Fetch] → useCommerceProduct → callAction → commerce action
                                                                            │
                                              client.get("products/<sku>")  ▼
                                                            GET /rest/V1/products/<sku>
                                                                            │
[Product name shown] ◄── JSON product ◄── action returns {statusCode, body} ◄┘
```

1. **User input.** In [product.js](web-src/src/components/product.js), the *Fetch Product*
   tab has a text field bound to React state (`sku`). Clicking the button sets
   `submittedSku`.

2. **The hook reacts.** [useCommerceProduct.js](web-src/src/hooks/useCommerceProduct.js)
   watches `submittedSku`. When it changes, it calls:
   ```js
   const result = await callAction(props, 'adobeappbuilder/commerce', { sku })
   ```
   Note: no `operation` is sent, so the action defaults to `"get"`.

3. **callAction sends the HTTP request.** In [utils.js](web-src/src/utils.js),
   `callAction` does a `POST` to the action URL (looked up in `config.json`) with:
   - Header `authorization: Bearer <ims-token>` (proves the user is logged in to Adobe)
   - Body `{ "sku": "test-1" }`

4. **The action runs.** [actions/commerce/index.js](actions/commerce/index.js) `main()`:
   - Creates a logger.
   - **Validates** the request with `checkMissingRequestInputs` — needs a `sku` and an
     `Authorization` header. If missing → returns **400**.
   - Builds the Commerce client with `getClient(...)` (this reads the Commerce keys).
   - Calls `client.get(\`products/${params.sku}\`)`.

5. **oauth1a signs and calls Commerce.** In [oauth1a.js](actions/oauth1a.js),
   `client.get` builds the full URL `<COMMERCE_URL>V1/products/<sku>`, adds the signed
   `Authorization` header (OAuth1), and uses `fetch` to call Commerce with method `GET`.

6. **Commerce responds.** If the SKU exists, Commerce returns the product as JSON.
   The action wraps it: `{ statusCode: 200, body: <product> }` and returns it.

7. **Back to the UI.** Runtime sends the product JSON to the browser. The hook stores it,
   and the component shows `product.name`.

### Common results
- SKU **exists** → product name appears.
- SKU **does not exist** → Commerce returns `404` → the action's `catch` turns it into
  `500 server error` (so you may see nothing / an error).

---

## 5. CREATE PRODUCT — step by step

**Goal:** fill in SKU, Name, Price, (optional) Quantity and Categories, click
"Create Product", and a new product appears in Commerce.

### What happens, in order

```
[User fills form] → [clicks Create] → useCreateProduct
        │
        ├─ validateCreateInput(...)   (stop early if something is wrong)
        ├─ buildCreateProductParams(...)  → { operation:"create", sku, name, price, qty, categoryIds }
        ▼
   callAction → commerce action
        │
        ├─ build product JSON (incl. stock_item + category_links)
        ├─ client.post("products", body)      → POST /rest/V1/products
        └─ client.get("inventory/...salable-quantity/<sku>/1")  (best effort)
        ▼
[Green success box] ◄── created product + salable quantity ◄── action returns
```

1. **User input.** In the *Create Product* tab ([product.js](web-src/src/components/product.js)),
   each field (SKU, Name, Price, Quantity, Categories) is bound to React state.

2. **Validation first (no network call yet).**
   [useCreateProduct.js](web-src/src/hooks/useCreateProduct.js) calls
   `validateCreateInput(...)` from
   [createProductHelpers.js](web-src/src/hooks/createProductHelpers.js). Rules:
   - SKU is **required**
   - Name is **required**
   - Price is **required** and must be a number **> 0**
   - Quantity is optional, but if given must be a number **≥ 0**
   - Categories are optional; each ID must be a **positive whole number**

   If anything fails, the errors show in a **red box** and nothing is sent.

3. **Build the payload.** `buildCreateProductParams(...)` produces a clean object:
   ```js
   {
     operation: 'create',
     sku: 'shoe-1',
     name: 'Running Shoe',
     price: 49.99,
     qty: 25,
     categoryIds: ['3', '4']
   }
   ```
   (Strings are trimmed, price/qty are converted to numbers, categories are split on commas.)

4. **callAction sends it** to the same `commerce` action (same as fetch, but with
   `operation: "create"` and the extra fields).

5. **The action builds the Commerce product.** In
   [actions/commerce/index.js](actions/commerce/index.js), the `create` branch assembles
   the body Commerce expects:
   ```js
   {
     product: {
       sku, name, price,
       attribute_set_id: 4,     // "Default" attribute set
       status: 1,               // enabled
       visibility: 4,           // catalog + search
       type_id: 'simple',       // a simple product
       weight: 1,
       extension_attributes: {
         stock_item:   { qty, is_in_stock: qty > 0 },          // ← quantity
         category_links: [ { position, category_id } ... ]      // ← categories
       }
     }
   }
   ```
   It is sent with `client.post('products', body, '', { 'Content-Type': 'application/json' })`.

6. **oauth1a signs and POSTs** to `<COMMERCE_URL>V1/products`. Commerce creates the
   product and returns the full product object (with its new `id`).

7. **Salable quantity (bonus).** Right after creating, the action does a *best-effort*
   `GET inventory/get-product-salable-quantity/<sku>/1`.
   - **Quantity** = the stock you set.
   - **Salable quantity** = what Commerce *computes* is actually sellable
     (quantity minus reserved/ordered units). You **cannot set it directly**; for a brand
     new product it equals the quantity.
   - If the store doesn't support this endpoint, it's ignored and shown as `n/a`.

8. **Back to the UI.** A **green box** shows the created product's name, SKU, ID,
   quantity, salable quantity, and assigned categories.

### Common results
- All good → green success box, product visible in Commerce Admin.
- Duplicate SKU → Commerce returns `400` ("URL key / SKU already exists").
- Category ID that doesn't exist → Commerce returns `400` ("Could not assign product to category").

---

## 6. How security/authentication works (two different layers)

It's easy to confuse these — they are **two separate things**:

1. **User → Action (Adobe IMS):** the browser sends an Adobe IMS `Bearer` token so the
   action knows a real logged-in Adobe user is calling. This is required because
   `require-adobe-auth: true` is set for the `commerce` action in
   [app.config.yaml](app.config.yaml).

2. **Action → Commerce (OAuth1):** the action uses the Commerce **consumer key/secret +
   access token/secret** (from `.env`) to sign requests to the Magento REST API. This is
   handled entirely inside [oauth1a.js](actions/oauth1a.js). The browser never sees these.

---

## 7. The Commerce REST endpoints used

| Feature | HTTP | Endpoint |
|---------|------|----------|
| Fetch product | `GET`  | `/rest/V1/products/{sku}` |
| Create product | `POST` | `/rest/V1/products` |
| Salable quantity | `GET` | `/rest/V1/inventory/get-product-salable-quantity/{sku}/{stockId}` |

(`COMMERCE_URL` already ends in `/rest/`, and `oauth1a.js` adds the `V1/` version prefix.)

---

## 8. How to run and test it

### Run the app locally
```bash
aio app dev
```
Then open the app, go to the **Products** page, and use the two tabs.

> If you see `EADDRINUSE: ... :35729`, an old dev server is still running. Kill it:
> ```powershell
> Get-NetTCPConnection -LocalPort 35729 -ErrorAction SilentlyContinue |
>   Select-Object -Expand OwningProcess -Unique |
>   ForEach-Object { Stop-Process -Id $_ -Force }
> ```
> Then run `aio app dev` again. (Restarting matters: the dev server caches code,
> so after editing the action you must restart for changes to take effect.)

### Run the unit tests
The pure logic (validation + payload building) is covered by Jest tests:
```bash
npx jest test/createProduct.test.js
```
These live in [test/createProduct.test.js](test/createProduct.test.js) and test
[createProductHelpers.js](web-src/src/hooks/createProductHelpers.js) — no browser needed.

---

## 9. Glossary (quick definitions)

- **SKU** — *Stock Keeping Unit*; the unique code that identifies a product.
- **Action** — a serverless function that runs in Adobe I/O Runtime.
- **Hook** — a reusable React function (name starts with `use`) that holds logic/state.
- **OAuth1** — the signing method Magento uses to authenticate API calls.
- **IMS** — Adobe Identity Management System (how Adobe users log in).
- **attribute_set_id: 4** — Magento's built-in "Default" set of product fields.
- **Salable quantity** — the sellable amount Commerce computes (qty minus reservations).
- **category_links** — how a product is attached to categories (by category ID).

---

## 10. Known follow-ups (not done yet)

- The `commerce` action is set to `runtime: nodejs:16` in
  [app.config.yaml](app.config.yaml), but [oauth1a.js](actions/oauth1a.js) uses the global
  `fetch`, which only exists on Node **18+**. On a real deploy this would fail with
  `fetch is not defined` — bump it to `nodejs:22` (like the other actions).
- Line 54 of [index.js](actions/commerce/index.js) logs `Name:` but prints the
  `operation` value — a harmless mislabeled log.
