/*
* <license header>
*/

/**
 * This is a sample action showcasing how to access an external API
 *
 * Note:
 * You might want to disable authentication and authorization checks against Adobe Identity Management System for a generic action. In that case:
 *   - Remove the require-adobe-auth annotation for this action in the manifest.yml of your application
 *   - Remove the Authorization header from the array passed in checkMissingRequestInputs
 *   - The two steps above imply that every client knowing the URL to this deployed action will be able to invoke it without any authentication and authorization checks against Adobe Identity Management System
 *   - Make sure to validate these changes against your security requirements before deploying the action
 */


const fetch = require('node-fetch')
const { Core } = require('@adobe/aio-sdk')
const { errorResponse, getBearerToken, stringParameters, checkMissingRequestInputs } = require('../utils')
const { getClient } = require('../oauth1a')

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })
  const operation = params.operation || 'get';
  try {
    // 'info' is the default level if not set
    logger.info('Calling the main action')

    // log parameters, only if params.LOG_LEVEL === 'debug'
    logger.debug(stringParameters(params))

    // check for missing request input parameters and headers
    const requiredParams = ['sku']
    const requiredHeaders = ['Authorization']
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders)
    if (errorMessage) {
      // return and log client errors
      return errorResponse(400, errorMessage, logger)
    }

  const client = getClient({
  params,
        url: params.COMMERCE_URL,
        consumerKey: params.COMMERCE_CONSUMER_KEY,
        consumerSecret: params.COMMERCE_CONSUMER_SECRET,
        accessToken: params.COMMERCE_ACCESS_TOKEN,
        accessTokenSecret: params.COMMERCE_ACCESS_TOKEN_SECRET
      }, logger)
    // Fetch data adobe commerce api
    logger.info(`URL: ${params.COMMERCE_URL}`)
    logger.info(`SKU: ${params.sku}`)
    logger.info(`Name: ${params.operation}`)
    let response
    if (operation === 'get') {
      const result = await client.get(`products/${params.sku}`)
      response = {
        statusCode: 200,
        body: result
      }
    } else if (operation === 'create') {
      const qty = Number(params.qty) || 0
      const categoryIds = Array.isArray(params.categoryIds) ? params.categoryIds : []
      const categoryLinks = categoryIds.map((id, position) => ({ position, category_id: `${id}` }))
      const body = JSON.stringify({
        product: {
          sku: params.sku,
          name: params.name,
          attribute_set_id: 4,
          price: params.price,
          status: 1,
          visibility: 4,
          type_id: 'simple',
          weight: 1,
          extension_attributes: {
            stock_item: {
              qty: qty,
              is_in_stock: qty > 0
            },
            category_links: categoryLinks
          }
        }
      })
      const result = await client.post('products', body, '', { 'Content-Type': 'application/json' })

      // Salable quantity is derived by Commerce (qty minus reservations), not set directly.
      // Fetch it best-effort for the default stock (id 1); ignore if MSI endpoint is unavailable.
      let salableQuantity = null
      try {
        salableQuantity = await client.get(`inventory/get-product-salable-quantity/${params.sku}/1`)
      } catch (e) {
        logger.info(`could not fetch salable quantity: ${e.message}`)
      }

      response = {
        statusCode: 200,
        body: { ...result, salable_quantity: salableQuantity }
      }
    } else if (operation === 'update') {
      // Only send the fields that were provided so blank fields stay unchanged.
      const product = { sku: params.sku }
      if (params.name !== undefined) {
        product.name = params.name
      }
      if (params.price !== undefined) {
        product.price = params.price
      }
      const extensionAttributes = {}
      if (params.qty !== undefined) {
        const qty = Number(params.qty) || 0
        extensionAttributes.stock_item = { qty, is_in_stock: qty > 0 }
      }
      if (Array.isArray(params.categoryIds)) {
        extensionAttributes.category_links = params.categoryIds.map((id, position) => ({ position, category_id: `${id}` }))
      }
      if (Object.keys(extensionAttributes).length > 0) {
        product.extension_attributes = extensionAttributes
      }

      const body = JSON.stringify({ product })
      const result = await client.put(`products/${params.sku}`, body, '', { 'Content-Type': 'application/json' })
      response = {
        statusCode: 200,
        body: result
      }
    } else {
      return errorResponse(400, `unsupported operation '${operation}'`, logger)
    }

    // log the response status code
    logger.info(`${response.statusCode}: successful request`)
    return response
  } catch (error) {
    // log any server errors
    logger.error(error)
    // return with 500
    return errorResponse(500, `server error: ${error.message}`, logger)
  }
}

exports.main = main
