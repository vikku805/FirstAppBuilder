/*
* <license header>
*/

/**
 * This is a sample action showcasing how to create a cloud event and publish to I/O Events
 *
 * Note:
 * You might want to disable authentication and authorization checks against Adobe Identity Management System for a generic action. In that case:
 *   - Remove the require-adobe-auth annotation for this action in the manifest.yml of your application
 *   - Remove the Authorization header from the array passed in checkMissingRequestInputs
 *   - The two steps above imply that every client knowing the URL to this deployed action will be able to invoke it without any authentication and authorization checks against Adobe Identity Management System
 *   - Make sure to validate these changes against your security requirements before deploying the action
 */


const { Events } = require('@adobe/aio-sdk')
const uuid = require('uuid')
const {
  CloudEvent
} = require("cloudevents");
const { createActionHandler } = require('../utils')

// main function that will be executed by Adobe I/O Runtime
const main = createActionHandler(
  {
    actionName: 'main',
    requiredParams: ['apiKey', 'providerId', 'eventCode', 'payload'],
    requiredHeaders: ['Authorization', 'x-gw-ims-org-id']
  },
  async (params, { logger, token }) => {
    // initialize the client
    const orgId = params.__ow_headers['x-gw-ims-org-id']
    const eventsClient = await Events.init(orgId, params.apiKey, token)

    // Create cloud event for the given payload
    const cloudEvent = createCloudEvent(params.providerId, params.eventCode, params.payload)

    // Publish to I/O Events
    const published = await eventsClient.publishEvent(cloudEvent)
    let statusCode = 200
    if (published === 'OK') {
      logger.info('Published successfully to I/O Events')
    } else if (published === undefined) {
      logger.info('Published to I/O Events but there were not interested registrations')
      statusCode = 204
    }

    return {
      statusCode: statusCode,
    }
  }
)

function createCloudEvent(providerId, eventCode, payload) {
  let cloudevent = new CloudEvent({
    source: 'urn:uuid:' + providerId,
    type: eventCode,
    datacontenttype: "application/json",
    data: payload,
    id: uuid.v4()
  });
  return cloudevent
}

exports.main = main
