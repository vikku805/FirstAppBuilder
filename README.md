# Firstappbuilder

Welcome to my Adobe I/O Application!

---

## 🚀 Order Orchestration (Magento → Odoo + Medusa)

> **Overview:** When a customer places an order in **Magento**, it is automatically delivered to
> **two** systems at once — **Odoo (ERP)** and **Medusa (OMS)** — via a message queue and the
> App Builder `order-sync` action (a "fan-out" pattern).

```
Magento → RabbitMQ → consumer → App Builder "order-sync" ─┬─► Odoo  (sale.order, confirmed)
                                                          └─► Medusa (order, on Orders page)
```

**Key pieces:** [actions/order-sync/index.js](actions/order-sync/index.js) (fan-out) ·
[odoo.js](actions/order-sync/odoo.js) (ERP client) ·
[medusa.js](actions/order-sync/medusa.js) (OMS client) ·
Magento module `Order/Orchestration` (observer + queue + consumer).

📖 **For more details:**
- **[order_orchestration_guide.md](order_orchestration_guide.md)** — full end-to-end master guide,
  every step from the Magento observer to Medusa (setup, run, verify, troubleshoot).
- **[medusa-oms-integration.md](medusa-oms-integration.md)** — Medusa OMS deep dive (install + code).

---

## Setup

- Populate the `.env` file in the project root and fill it as shown [below](#env)

## Local Dev

- `aio app run` to start your local Dev server
- App will run on `localhost:9080` by default

By default the UI will be served locally but actions will be deployed and served from Adobe I/O Runtime. To run your actions locally use the `aio app dev` option.

For more information on the difference between `aio app run` and `aio app dev`, see [here](https://developer.adobe.com/app-builder/docs/guides/development/#aio-app-dev-vs-aio-app-run)

## Test & Coverage

- Run `aio app test` to run unit tests for ui and actions
- Run `aio app test --e2e` to run e2e tests

## Deploy & Cleanup

- `aio app deploy` to build and deploy all actions on Runtime and static files to CDN
- `aio app undeploy` to undeploy the app

## Config

### `.env`

You can generate this file using the command `aio app use`. 

```bash
# This file must **not** be committed to source control

## please provide your Adobe I/O Runtime credentials
# AIO_RUNTIME_AUTH=
# AIO_RUNTIME_NAMESPACE=
```

### `app.config.yaml`

- Main configuration file that defines an application's implementation. 
- More information on this file, application configuration, and extension configuration 
  can be found [here](https://developer.adobe.com/app-builder/docs/guides/configuration/#appconfigyaml)

#### Action Dependencies

- You have two options to resolve your actions' dependencies:

  1. **Packaged action file**: Add your action's dependencies to the root
   `package.json` and install them using `npm install`. Then set the `function`
   field in `app.config.yaml` to point to the **entry file** of your action
   folder. We will use `webpack` to package your code and dependencies into a
   single minified js file. The action will then be deployed as a single file.
   Use this method if you want to reduce the size of your actions.

  2. **Zipped action folder**: In the folder containing the action code add a
     `package.json` with the action's dependencies. Then set the `function`
     field in `app.config.yaml` to point to the **folder** of that action. We will
     install the required dependencies within that directory and zip the folder
     before deploying it as a zipped action. Use this method if you want to keep
     your action's dependencies separated.

## Debugging in VS Code

While running your local server (`aio app dev`), both UI and actions can be debugged. To do so follow the instructions [here](https://developer.adobe.com/app-builder/docs/guides/development/#debugging)

## Typescript support for UI

To use typescript use `.tsx` extension for react components and add a `tsconfig.json` 
and make sure you have the below config added
```
 {
  "compilerOptions": {
      "jsx": "react"
    }
  } 
```
