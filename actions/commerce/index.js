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


const { createActionHandler } = require('../utils')
const { getClient } = require('../oauth1a')

// main function that will be executed by Adobe I/O Runtime
const main = createActionHandler(
  {
    actionName: 'main',
    requiredParams: ['sku'],
    requiredHeaders: ['Authorization']
  },
  async (params, { logger }) => {
    const client = getClient({
      params,
      url: params.COMMERCE_URL,
      consumerKey: params.COMMERCE_CONSUMER_KEY,
      consumerSecret: params.COMMERCE_CONSUMER_SECRET,
      accessToken: params.COMMERCE_ACCESS_TOKEN,
      accessTokenSecret: params.COMMERCE_ACCESS_TOKEN_SECRET
    }, logger)

    logger.info(`URL: ${params.COMMERCE_URL}`)
    logger.info(`SKU: ${params.sku}`)

    const result = await client.get(`products/${params.sku}`)

    return {
      statusCode: 200,
      body: result
    }
  }
)

exports.main = main
