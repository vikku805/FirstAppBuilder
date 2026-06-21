/*
* <license header>
*/

/**
 * Order sync action.
 *
 * Receives a Magento order (published by the Order/Orchestration module and
 * forwarded by its consumer) and fans it out to:
 *   1. Odoo ERP (primary)  - upsert customer + products, create & confirm a sale.order
 *   2. Medusa OMS (secondary, best-effort) - create a draft order
 *
 * Both are idempotent on the Magento increment_id so a re-delivered queue message
 * does not create duplicates. A Medusa failure never fails the action - the proven
 * Odoo path stays authoritative.
 */

const { Core } = require('@adobe/aio-sdk')
const { errorResponse, stringParameters, checkMissingRequestInputs } = require('../utils')
const odoo = require('./odoo')
const medusa = require('./medusa')

/**
 * Treat unresolved dev inputs ($VAR) and empty values as "not set".
 */
function cleanInput (value) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'string' && value.startsWith('$')) return undefined
  return value
}

/**
 * Map a Magento address to the Medusa address shape.
 */
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

/**
 * Best-effort fan-out to the Medusa OMS. Never throws - returns a status object.
 */
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

    // best-effort idempotency (metadata filtering may not be supported)
    let existing = null
    try {
      existing = await medusa.findDraftOrderByRef(ctx, incrementId)
    } catch (e) {
      logger.debug(`Medusa idempotency check skipped: ${e.message}`)
    }
    if (existing) {
      logger.info(`Medusa draft order already exists (id=${existing}) for ${incrementId}`)
      return { created: false, draft_order_id: existing }
    }

    const items = (Array.isArray(params.items) ? params.items : []).map((i) => ({
      title: i.name || i.sku,
      quantity: Number(i.qty) || 1,
      unit_price: Number(i.price) || 0
    }))

    const draftId = await medusa.createDraftOrder(ctx, {
      email: params.customer && params.customer.email,
      ref: incrementId,
      items,
      shippingAddress: toMedusaAddress(params.shipping_address, params.customer),
      billingAddress: toMedusaAddress(params.billing_address, params.customer)
    })
    logger.info(`Created Medusa draft order id=${draftId} for ${incrementId}`)

    // The draft-order admin page is buggy in this Medusa version, so promote the
    // draft to a real order — that shows on the working Orders page.
    try {
      await medusa.convertToOrder(ctx, draftId)
      logger.info(`Converted Medusa order id=${draftId} to a real order`)
      return { created: true, order_id: draftId, converted: true }
    } catch (e) {
      logger.error(`Medusa convert-to-order failed: ${e.message}`)
      return { created: true, order_id: draftId, converted: false }
    }
  } catch (error) {
    // best-effort: log and report, but do not fail the action
    logger.error(`Medusa OMS fan-out failed: ${error.message}`)
    return { created: false, error: error.message }
  }
}

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })

  try {
    logger.info('Calling the Order sync action')

    // log parameters, only if params.LOG_LEVEL === 'debug'
    logger.debug(stringParameters(params))
    logger.debug(`Request Payload:\n${JSON.stringify(params, null, 2)}`)

    // check for missing request input parameters and headers
    const requiredParams = ['increment_id', 'customer']
    const requiredHeaders = ['Authorization']
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders)
    if (errorMessage) {
      // return and log client errors
      return errorResponse(400, errorMessage, logger)
    }

    // validate Odoo configuration
    const missingConfig = ['ODOO_URL', 'ODOO_DB', 'ODOO_USERNAME', 'ODOO_PASSWORD']
      .filter((k) => !params[k] || params[k] === `$${k}`)
    if (missingConfig.length > 0) {
      logger.error(`Odoo configuration is missing: ${missingConfig.join(', ')}`)
      return errorResponse(500, 'server error', logger)
    }

    const incrementId = params.increment_id

    // --- Odoo (primary) ---
    const uid = await odoo.login(params.ODOO_URL, params.ODOO_DB, params.ODOO_USERNAME, params.ODOO_PASSWORD)
    const ctx = { url: params.ODOO_URL, db: params.ODOO_DB, uid, password: params.ODOO_PASSWORD }

    let odooResult
    const existingId = await odoo.findSaleOrderByRef(ctx, incrementId)
    if (existingId) {
      // idempotency: order already exists in Odoo
      logger.info(`Odoo sale.order already exists (id=${existingId}) for ${incrementId}, skipping`)
      odooResult = { odoo_sale_order_id: existingId, created: false }
    } else {
      // upsert the customer
      const partnerId = await odoo.ensurePartner(
        ctx,
        params.customer,
        params.billing_address || params.shipping_address || {}
      )

      // resolve (and create when missing) a product per order item
      const items = Array.isArray(params.items) ? params.items : []
      const lines = []
      for (const item of items) {
        const productId = await odoo.ensureProduct(ctx, item)
        lines.push({ product_id: productId, qty: Number(item.qty) || 1, price: Number(item.price) || 0 })
      }

      // create the sale order
      const saleOrderId = await odoo.createSaleOrder(ctx, { partnerId, ref: incrementId, lines })
      logger.info(`Created Odoo sale.order id=${saleOrderId} for ${incrementId} (partner_id=${partnerId}, lines=${lines.length})`)

      // confirm the order (draft -> confirmed) unless explicitly disabled
      const autoConfirm = params.ODOO_AUTO_CONFIRM !== 'false' && params.ODOO_AUTO_CONFIRM !== false
      let confirmed = false
      if (autoConfirm) {
        await odoo.confirmSaleOrder(ctx, saleOrderId)
        confirmed = true
        logger.info(`Confirmed Odoo sale.order id=${saleOrderId}`)
      }

      odooResult = { odoo_sale_order_id: saleOrderId, partner_id: partnerId, created: true, confirmed }
    }

    // --- Medusa OMS (secondary, best-effort) ---
    const medusaResult = await syncToMedusa(params, logger)

    return {
      statusCode: 200,
      body: {
        increment_id: incrementId,
        ...odooResult,
        medusa: medusaResult
      }
    }
  } catch (error) {
    // log any server errors
    logger.error(error)
    // return with 500
    return errorResponse(500, 'server error', logger)
  }
}

exports.main = main
