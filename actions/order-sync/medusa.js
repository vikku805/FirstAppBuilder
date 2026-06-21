/*
* <license header>
*/

/**
 * Minimal Medusa v2 Admin API client.
 *
 * Auth is either a secret API key (recommended for server-to-server) sent as
 * HTTP Basic, or an email/password exchanged for a JWT via the auth route.
 *
 * Orders placed manually go through the draft-order endpoint. Draft orders
 * accept custom line items (title + unit_price + quantity) with no variant_id,
 * so no product catalog needs to exist in Medusa for this demo.
 */

const fetch = require('node-fetch')

// Fail fast if Medusa is slow/unreachable instead of hanging the action.
const MEDUSA_TIMEOUT_MS = 20000

/**
 * Build the Authorization header. Prefers an API key (Basic); otherwise logs in
 * with email/password and returns a Bearer JWT.
 *
 * @param {object} cfg - { url, apiKey, email, password }
 * @returns {Promise<string>} the Authorization header value
 */
async function authHeader (cfg) {
  if (cfg.apiKey) {
    // Medusa secret API keys authenticate as HTTP Basic with the key as username.
    return 'Basic ' + Buffer.from(`${cfg.apiKey}:`).toString('base64')
  }

  const res = await fetch(`${cfg.url}/auth/user/emailpass`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cfg.email, password: cfg.password }),
    timeout: MEDUSA_TIMEOUT_MS
  })
  const json = await readJson(res)
  if (!res.ok || !json.token) {
    throw new Error(`Medusa auth failed: HTTP ${res.status} ${JSON.stringify(json)}`)
  }
  return `Bearer ${json.token}`
}

/**
 * Parse a response body as JSON, tolerating empty/non-JSON bodies.
 *
 * @param {object} res - node-fetch response
 * @returns {Promise<object>}
 */
async function readJson (res) {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch (e) {
    return { _raw: text }
  }
}

/**
 * Low level Admin API request. Throws on non-2xx with the response body.
 *
 * @param {object} ctx - { url, auth }
 * @param {string} method
 * @param {string} path - e.g. '/admin/draft-orders'
 * @param {object} [body]
 * @returns {Promise<object>}
 */
async function request (ctx, method, path, body) {
  const res = await fetch(`${ctx.url}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: ctx.auth
    },
    body: body ? JSON.stringify(body) : undefined,
    timeout: MEDUSA_TIMEOUT_MS
  })
  const json = await readJson(res)
  if (!res.ok) {
    throw new Error(`Medusa ${method} ${path} failed: HTTP ${res.status} ${JSON.stringify(json)}`)
  }
  return json
}

/**
 * Build an authenticated context for subsequent calls.
 *
 * @param {object} cfg - { url, apiKey, email, password, regionId, salesChannelId }
 * @returns {Promise<object>} ctx with a resolved auth header
 */
async function connect (cfg) {
  const auth = await authHeader(cfg)
  return { url: cfg.url, auth, regionId: cfg.regionId, salesChannelId: cfg.salesChannelId }
}

/**
 * Best-effort idempotency: find a draft order previously created for this Magento
 * order via its metadata. Returns the id or null. If the instance does not
 * support filtering by metadata, callers should treat a thrown error as "unknown"
 * and proceed to create.
 *
 * @param {object} ctx
 * @param {string} ref - Magento increment_id
 * @returns {Promise<string|null>}
 */
async function findDraftOrderByRef (ctx, ref) {
  const q = encodeURIComponent(JSON.stringify({ magento_increment_id: ref }))
  const json = await request(ctx, 'GET', `/admin/draft-orders?metadata=${q}&limit=1`)
  const orders = json.draft_orders || json.orders || []
  return orders.length > 0 ? orders[0].id : null
}

/**
 * Create a draft order from a Magento order.
 *
 * @param {object} ctx
 * @param {object} order - { email, ref, items, shippingAddress, billingAddress }
 * @returns {Promise<string>} the created draft order id
 */
async function createDraftOrder (ctx, { email, ref, items, shippingAddress, billingAddress }) {
  const body = {
    email,
    region_id: ctx.regionId,
    sales_channel_id: ctx.salesChannelId,
    items: items.map((i) => ({
      title: i.title,
      quantity: i.quantity,
      unit_price: i.unit_price
    })),
    metadata: { magento_increment_id: ref }
  }
  if (shippingAddress) body.shipping_address = shippingAddress
  if (billingAddress) body.billing_address = billingAddress

  const json = await request(ctx, 'POST', '/admin/draft-orders', body)
  const draft = json.draft_order || json.order || json
  return draft.id
}

/**
 * Convert a draft order into a real order so it appears on the (working) Orders
 * page. The draft-order admin page is buggy in some Medusa v2 versions, so we
 * promote drafts to real orders for visibility.
 *
 * @param {object} ctx
 * @param {string} draftId
 * @returns {Promise<object>}
 */
function convertToOrder (ctx, draftId) {
  return request(ctx, 'POST', `/admin/draft-orders/${draftId}/convert-to-order`, {})
}

module.exports = {
  authHeader,
  request,
  connect,
  findDraftOrderByRef,
  createDraftOrder,
  convertToOrder
}
