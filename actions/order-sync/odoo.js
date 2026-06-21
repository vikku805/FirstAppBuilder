/*
* <license header>
*/

/**
 * Minimal Odoo JSON-RPC client.
 *
 * Odoo exposes a JSON-RPC endpoint at `<host>/jsonrpc`. Auth is a two step flow:
 *   1. `common.login(db, user, password)` -> numeric uid
 *   2. `object.execute_kw(db, uid, password, model, method, args, kwargs)` -> CRUD
 *
 * This mirrors the proven PHP prototypes in the Magento module
 * (Order/Orchestration/Test/*.php).
 */

const fetch = require('node-fetch')

// Bound each request so a slow/unreachable Odoo (e.g. a remote host when the
// action is deployed to the cloud runtime) fails fast instead of hanging.
const ODOO_TIMEOUT_MS = 20000

/**
 * Low level JSON-RPC call. Throws on transport errors and on Odoo `error`
 * payloads (JSON-RPC returns HTTP 200 even for application errors).
 *
 * @param {string} url - the `/jsonrpc` endpoint
 * @param {string} service - 'common' | 'object'
 * @param {string} method - 'login' | 'execute_kw'
 * @param {Array} args - positional arguments for the service method
 * @returns {Promise<*>} the `result` field of the response
 */
async function rpc (url, service, method, args) {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    method: 'call',
    params: { service, method, args },
    id: Date.now()
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    timeout: ODOO_TIMEOUT_MS
  })

  if (!res.ok) {
    throw new Error(`Odoo request failed: HTTP ${res.status} ${res.statusText}`)
  }

  const json = await res.json()
  if (json.error) {
    const data = json.error.data || {}
    throw new Error(`Odoo error: ${data.message || json.error.message || 'unknown error'}`)
  }
  return json.result
}

/**
 * Authenticate and return the uid.
 *
 * @param {string} url
 * @param {string} db
 * @param {string} user
 * @param {string} password
 * @returns {Promise<number>}
 */
async function login (url, db, user, password) {
  const uid = await rpc(url, 'common', 'login', [db, user, password])
  if (!uid) {
    throw new Error('Odoo login failed: invalid credentials or database')
  }
  return uid
}

/**
 * Call a model method via object.execute_kw.
 *
 * @param {object} ctx - { url, db, uid, password }
 * @param {string} model - e.g. 'res.partner'
 * @param {string} method - e.g. 'search_read' | 'create'
 * @param {Array} args - positional args (domain or values)
 * @param {object} kwargs - keyword args (e.g. { fields, limit })
 * @returns {Promise<*>}
 */
function executeKw (ctx, model, method, args = [], kwargs = {}) {
  return rpc(ctx.url, 'object', 'execute_kw', [
    ctx.db, ctx.uid, ctx.password, model, method, args, kwargs
  ])
}

/**
 * Find an existing sale.order by client_order_ref (used for idempotency).
 *
 * @param {object} ctx
 * @param {string} ref - the Magento increment_id
 * @returns {Promise<number|null>} the sale.order id or null
 */
async function findSaleOrderByRef (ctx, ref) {
  const rows = await executeKw(
    ctx,
    'sale.order',
    'search_read',
    [[['client_order_ref', '=', ref]]],
    { fields: ['id'], limit: 1 }
  )
  return rows.length > 0 ? rows[0].id : null
}

/**
 * Resolve an Odoo res.country id from a 2 letter ISO code (Magento sends e.g. 'IN').
 *
 * @param {object} ctx
 * @param {string} code - ISO 3166-1 alpha-2 country code
 * @returns {Promise<number|null>}
 */
async function findCountryId (ctx, code) {
  if (!code) return null
  const rows = await executeKw(
    ctx,
    'res.country',
    'search_read',
    [[['code', '=', code]]],
    { fields: ['id'], limit: 1 }
  )
  return rows.length > 0 ? rows[0].id : null
}

/**
 * Resolve an Odoo res.country.state id by region name within a country.
 * Magento sends the region as a display name (e.g. 'Jharkhand', 'California').
 *
 * @param {object} ctx
 * @param {number} countryId
 * @param {string} region - region/state display name
 * @returns {Promise<number|null>}
 */
async function findStateId (ctx, countryId, region) {
  if (!countryId || !region) return null
  const rows = await executeKw(
    ctx,
    'res.country.state',
    'search_read',
    [[['country_id', '=', countryId], ['name', '=', region]]],
    { fields: ['id'], limit: 1 }
  )
  return rows.length > 0 ? rows[0].id : null
}

/**
 * Find a partner by email, creating one if none exists. On create, the country
 * (and state, when resolvable) are mapped from the address.
 *
 * @param {object} ctx
 * @param {object} customer - { email, firstname, lastname }
 * @param {object} [address] - { street: [..], city, postcode, telephone, country, region }
 * @returns {Promise<number>} the res.partner id
 */
async function ensurePartner (ctx, customer, address = {}) {
  const email = customer.email
  if (email) {
    const found = await executeKw(
      ctx,
      'res.partner',
      'search_read',
      [[['email', '=', email]]],
      { fields: ['id'], limit: 1 }
    )
    if (found.length > 0) {
      return found[0].id
    }
  }

  const name = [customer.firstname, customer.lastname].filter(Boolean).join(' ') || email || 'Magento Customer'
  const street = Array.isArray(address.street) ? address.street.filter(Boolean).join(', ') : address.street
  const vals = { name }
  if (email) vals.email = email
  if (street) vals.street = street
  if (address.city) vals.city = address.city
  if (address.postcode) vals.zip = address.postcode
  if (address.telephone) vals.phone = address.telephone

  // Map country/region. State is only meaningful within a known country.
  const countryId = await findCountryId(ctx, address.country)
  if (countryId) {
    vals.country_id = countryId
    const stateId = await findStateId(ctx, countryId, address.region)
    if (stateId) vals.state_id = stateId
  }

  return executeKw(ctx, 'res.partner', 'create', [vals])
}

/**
 * Find a product by SKU (default_code), creating one if none exists.
 *
 * @param {object} ctx
 * @param {object} item - { sku, name, price }
 * @returns {Promise<number>} the product.product id
 */
async function ensureProduct (ctx, item) {
  const found = await executeKw(
    ctx,
    'product.product',
    'search_read',
    [[['default_code', '=', item.sku]]],
    { fields: ['id'], limit: 1 }
  )
  if (found.length > 0) {
    return found[0].id
  }

  return executeKw(ctx, 'product.product', 'create', [{
    name: item.name || item.sku,
    default_code: item.sku,
    list_price: Number(item.price) || 0,
    type: 'consu'
  }])
}

/**
 * Create a sale.order with line items.
 *
 * @param {object} ctx
 * @param {object} order - { partnerId, ref, lines: [{ product_id, qty, price }] }
 * @returns {Promise<number>} the sale.order id
 */
function createSaleOrder (ctx, { partnerId, ref, lines }) {
  const orderLine = lines.map((l) => [0, 0, {
    product_id: l.product_id,
    product_uom_qty: l.qty,
    price_unit: l.price
  }])

  return executeKw(ctx, 'sale.order', 'create', [{
    partner_id: partnerId,
    client_order_ref: ref,
    order_line: orderLine
  }])
}

/**
 * Confirm a sale.order, moving it from draft (quotation) to a confirmed order.
 *
 * @param {object} ctx
 * @param {number} id - the sale.order id
 * @returns {Promise<*>}
 */
function confirmSaleOrder (ctx, id) {
  return executeKw(ctx, 'sale.order', 'action_confirm', [[id]])
}

module.exports = {
  rpc,
  login,
  executeKw,
  findSaleOrderByRef,
  ensurePartner,
  ensureProduct,
  createSaleOrder,
  confirmSaleOrder,
  findCountryId,
  findStateId
}
