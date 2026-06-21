# Adobe Commerce App Builder Integration

## Overview

This project demonstrates integration between Adobe Commerce (Magento) and Adobe App Builder using custom actions and Adobe I/O Events.

The solution includes:

* Generic App Builder Action
* Custom Commerce Action
* Adobe Commerce API Integration
* Custom Adobe I/O Event Provider
* Event Metadata Registration
* Event Publishing Workflow
* Local and Runtime Deployment

---

# Architecture

Adobe Commerce / Magento

↓

Adobe App Builder Commerce Action

↓

Adobe I/O Custom Event Provider

↓

Adobe I/O Events Registration

↓

Subscriber / Runtime Action

---

# Actions

## 1. Generic Action

The Generic Action is the default App Builder action created by the project template.

Purpose:

* Test App Builder deployment
* Verify Runtime configuration
* Validate Adobe Authentication

Example Endpoint:

```text
https://localhost:9080/api/v1/web/adobeappbuilder/generic
```

Runtime Endpoint:

```text
https://adobeioruntime.net/api/v1/namespaces/<namespace>/actions/adobeappbuilder/__secured_generic
```

---

## 2. Commerce Action

A custom App Builder action was added to integrate with Adobe Commerce.

### Create Action

```bash
aio app add action
```

### Purpose

* Authenticate with Magento using OAuth 1.0
* Fetch product data
* Return Commerce API responses
* Trigger custom Adobe Events

### OAuth Reference

Starter Kit:

https://github.com/adobe/commerce-integration-starter-kit/blob/main/actions/oauth1a.js

---

# Adobe Commerce Integration

## Configuration

Environment Variables:

```env
COMMERCE_URL=http://magento249.com/rest/
COMMERCE_CONSUMER_KEY=*****
COMMERCE_CONSUMER_SECRET=*****
COMMERCE_ACCESS_TOKEN=*****
COMMERCE_ACCESS_TOKEN_SECRET=*****
```

## Example Product Fetch

Request:

```json
{
  "sku": "test-1"
}
```

Code:

```javascript
const result = await client.get(`products/${params.sku}`)

return {
  statusCode: 200,
  body: result
}
```

Magento API:

```text
GET /rest/V1/products/{sku}
```

---

# Local vs Runtime

## Local Development

Start Development Server:

```bash
aio app dev
```

Example:

```text
https://localhost:9080/api/v1/web/adobeappbuilder/commerce
```

Characteristics:

* Uses local source code
* Reflects latest changes immediately
* Used for development and debugging

## Runtime

Deploy:

```bash
aio app deploy
```

Example:

```text
https://adobeioruntime.net/api/v1/namespaces/<namespace>/actions/adobeappbuilder/__secured_commerce
```

Characteristics:

* Uses deployed code
* Changes visible only after successful deployment

---

# Adobe I/O Events

## Create Event Provider

```bash
aio event provider create
```

Provider:

```text
firstappbuilderevent
```

## Create Event Metadata

```bash
aio event eventmetadata create <provider-id>
```

Example Event:

```text
Event Code:
com.postman.productsold

Label:
product sold
```

Verify:

```bash
aio event eventmetadata list <provider-id>
```

---

# Event Registration

Create Registration:

```bash
aio event registration create event.json
```

Registration connects:

* Event Provider
* Event Metadata
* Runtime Action

Runtime Action:

```text
adobeappbuilder/__secured_generic
```

---

# Publishing Custom Events

Adobe Event Ingress Endpoint:

```text
https://eventsingress.adobe.io
```

Cloud Event Payload:

```json
{
  "specversion": "1.0",
  "source": "urn:uuid:<provider-id>",
  "type": "com.postman.productsold",
  "id": "<event-id>",
  "data": {
    "sku": "test-1"
  }
}
```

---

# Useful Commands

## Workspace

```bash
aio where
aio app use
aio console workspace list
```

## Development

```bash
aio app dev
aio app deploy
aio app deploy --verbose
```

## Runtime

```bash
aio runtime action list
aio runtime action get adobeappbuilder/__secured_commerce
aio runtime action invoke adobeappbuilder/__secured_commerce --result
```

## Events

```bash
aio event provider list
aio event provider get <provider-id>
aio event eventmetadata list <provider-id>
aio event registration create event.json
```

---

# Notes

Adobe Commerce Eventing is available only for Adobe Commerce and not Magento Open Source.

For Magento Open Source, custom integrations can be implemented using:

* Magento Observers
* Magento Plugins
* App Builder Actions
* Adobe I/O Custom Events

This project demonstrates the custom event integration approach using App Builder and Adobe I/O Events.
#Custom Commerce Action Fetching Product Data by SKU

<img width="1907" height="862" alt="image" src="https://github.com/user-attachments/assets/4b2ab77f-a369-463f-9b05-58f965f3cf01" />

#Custom Adobe I/O Event Successfully Published and Processed

<img width="1901" height="813" alt="Screenshot 2026-06-04 151956" src="https://github.com/user-attachments/assets/1d88b4e0-e163-42fa-97d3-6a2036dcdd90" />

