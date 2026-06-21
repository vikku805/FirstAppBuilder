/*
* <license header>
*/

jest.mock('@adobe/aio-sdk', () => ({
  Core: {
    Logger: jest.fn()
  }
}))

const { Core } = require('@adobe/aio-sdk')
const mockLoggerInstance = { info: jest.fn(), debug: jest.fn(), error: jest.fn() }
Core.Logger.mockReturnValue(mockLoggerInstance)

jest.mock('node-fetch')
const fetch = require('node-fetch')
const action = require('./../actions/order-sync/index.js')

beforeEach(() => {
  Core.Logger.mockClear()
  mockLoggerInstance.info.mockReset()
  mockLoggerInstance.debug.mockReset()
  mockLoggerInstance.error.mockReset()
  fetch.mockReset()
})

// Odoo uses res.json(); Medusa uses res.text(). Build each accordingly.
const rpcResult = (result) => ({ ok: true, json: () => Promise.resolve({ result }) })
const rpcError = (message) => ({ ok: true, json: () => Promise.resolve({ error: { message, data: { message } } }) })
const medusaRes = (obj, ok = true, status = 200) => ({ ok, status, text: () => Promise.resolve(JSON.stringify(obj)) })

// find the parsed `execute_kw` value-object for a given model/method among fetch calls
const createdValuesFor = (model, method) => {
  for (const call of fetch.mock.calls) {
    let parsed
    try { parsed = JSON.parse(call[1].body) } catch (e) { continue }
    const args = parsed.params && parsed.params.args
    if (args && args[3] === model && args[4] === method) {
      return args[5][0] // the vals object passed to create
    }
  }
  return null
}

const odooParams = {
  ODOO_URL: 'http://localhost:8069/jsonrpc',
  ODOO_DB: 'orderorchestration',
  ODOO_USERNAME: 'user@example.com',
  ODOO_PASSWORD: 'secret'
}

const medusaParams = {
  MEDUSA_URL: 'http://localhost:9000',
  MEDUSA_API_KEY: 'sk_test',
  MEDUSA_REGION_ID: 'reg_1',
  MEDUSA_SALES_CHANNEL_ID: 'sc_1'
}

const fakeParams = {
  __ow_headers: { authorization: 'Bearer fake' },
  ...odooParams,
  increment_id: '000000005',
  customer: { email: 'jane@example.com', firstname: 'Jane', lastname: 'Doe' },
  billing_address: { street: ['123 Main St'], city: 'LA', postcode: '90001', telephone: '555' },
  items: [{ sku: 'test-1', name: 'Test product', qty: 2, price: 100 }]
}

// queue the 8 fetch responses for a full Odoo create+confirm flow
const mockOdooCreateFlow = () => {
  fetch
    .mockResolvedValueOnce(rpcResult(5)) // common.login -> uid
    .mockResolvedValueOnce(rpcResult([])) // sale.order.search_read -> none
    .mockResolvedValueOnce(rpcResult([])) // res.partner.search_read -> none
    .mockResolvedValueOnce(rpcResult(8)) // res.partner.create -> id
    .mockResolvedValueOnce(rpcResult([])) // product.product.search_read -> none
    .mockResolvedValueOnce(rpcResult(100)) // product.product.create -> id
    .mockResolvedValueOnce(rpcResult(42)) // sale.order.create -> id
    .mockResolvedValueOnce(rpcResult(true)) // sale.order.action_confirm
}

describe('order-sync', () => {
  test('main should be defined', () => {
    expect(action.main).toBeInstanceOf(Function)
  })

  test('should set logger to use LOG_LEVEL param', async () => {
    await action.main({ ...fakeParams, LOG_LEVEL: 'fakeLevel' })
    expect(Core.Logger).toHaveBeenCalledWith(expect.any(String), { level: 'fakeLevel' })
  })

  test('creates+confirms in Odoo and skips Medusa when unconfigured', async () => {
    mockOdooCreateFlow()

    const response = await action.main(fakeParams)

    expect(response).toEqual({
      statusCode: 200,
      body: {
        increment_id: '000000005',
        odoo_sale_order_id: 42,
        partner_id: 8,
        created: true,
        confirmed: true,
        medusa: { skipped: true }
      }
    })
    expect(fetch).toHaveBeenCalledTimes(8) // Odoo only
  })

  test('fans out to BOTH Odoo and Medusa (draft created + converted to order)', async () => {
    mockOdooCreateFlow()
    fetch
      .mockResolvedValueOnce(medusaRes({ draft_orders: [] })) // findDraftOrderByRef -> none
      .mockResolvedValueOnce(medusaRes({ draft_order: { id: 'draft_1' } })) // createDraftOrder
      .mockResolvedValueOnce(medusaRes({ order: { id: 'draft_1' } })) // convertToOrder

    const response = await action.main({ ...fakeParams, ...medusaParams })

    expect(response.statusCode).toEqual(200)
    expect(response.body.odoo_sale_order_id).toEqual(42)
    expect(response.body.medusa).toEqual({ created: true, order_id: 'draft_1', converted: true })
    expect(fetch).toHaveBeenCalledTimes(11) // 8 Odoo + 3 Medusa (find + create + convert)
  })

  test('Medusa failure does not fail the action (Odoo still succeeds)', async () => {
    mockOdooCreateFlow()
    fetch
      .mockResolvedValueOnce(medusaRes({ draft_orders: [] })) // findDraftOrderByRef -> none
      .mockResolvedValueOnce(medusaRes({ message: 'bad request' }, false, 400)) // createDraftOrder fails

    const response = await action.main({ ...fakeParams, ...medusaParams })

    expect(response.statusCode).toEqual(200)
    expect(response.body.odoo_sale_order_id).toEqual(42)
    expect(response.body.medusa.created).toEqual(false)
    expect(response.body.medusa.error).toEqual(expect.stringContaining('400'))
    expect(mockLoggerInstance.error).toHaveBeenCalled()
  })

  test('does not confirm Odoo when ODOO_AUTO_CONFIRM is false', async () => {
    fetch
      .mockResolvedValueOnce(rpcResult(5)) // login
      .mockResolvedValueOnce(rpcResult([])) // sale.order.search_read
      .mockResolvedValueOnce(rpcResult([])) // res.partner.search_read
      .mockResolvedValueOnce(rpcResult(8)) // res.partner.create
      .mockResolvedValueOnce(rpcResult([])) // product.product.search_read
      .mockResolvedValueOnce(rpcResult(100)) // product.product.create
      .mockResolvedValueOnce(rpcResult(42)) // sale.order.create

    const response = await action.main({ ...fakeParams, ODOO_AUTO_CONFIRM: 'false' })

    expect(response.body).toEqual({
      increment_id: '000000005',
      odoo_sale_order_id: 42,
      partner_id: 8,
      created: true,
      confirmed: false,
      medusa: { skipped: true }
    })
    expect(fetch).toHaveBeenCalledTimes(7) // no action_confirm call
  })

  test('maps country and region onto a newly created partner', async () => {
    fetch
      .mockResolvedValueOnce(rpcResult(5)) // login
      .mockResolvedValueOnce(rpcResult([])) // sale.order.search_read
      .mockResolvedValueOnce(rpcResult([])) // res.partner.search_read -> none
      .mockResolvedValueOnce(rpcResult([{ id: 104 }])) // res.country.search_read
      .mockResolvedValueOnce(rpcResult([{ id: 600 }])) // res.country.state.search_read
      .mockResolvedValueOnce(rpcResult(8)) // res.partner.create
      .mockResolvedValueOnce(rpcResult([])) // product.product.search_read
      .mockResolvedValueOnce(rpcResult(100)) // product.product.create
      .mockResolvedValueOnce(rpcResult(42)) // sale.order.create
      .mockResolvedValueOnce(rpcResult(true)) // action_confirm

    const params = {
      ...fakeParams,
      billing_address: { street: ['104 Bagun Nagar'], city: 'Jamshedpur', postcode: '831017', telephone: '012', country: 'IN', region: 'Jharkhand' }
    }
    const response = await action.main(params)

    expect(response.statusCode).toEqual(200)
    const partnerVals = createdValuesFor('res.partner', 'create')
    expect(partnerVals.country_id).toEqual(104)
    expect(partnerVals.state_id).toEqual(600)
  })

  test('is idempotent in Odoo: existing order is not recreated', async () => {
    fetch
      .mockResolvedValueOnce(rpcResult(5)) // common.login -> uid
      .mockResolvedValueOnce(rpcResult([{ id: 99 }])) // sale.order.search_read -> found

    const response = await action.main(fakeParams)

    expect(response).toEqual({
      statusCode: 200,
      body: { increment_id: '000000005', odoo_sale_order_id: 99, created: false, medusa: { skipped: true } }
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  test('reuses an existing partner and product', async () => {
    fetch
      .mockResolvedValueOnce(rpcResult(5)) // login
      .mockResolvedValueOnce(rpcResult([])) // sale.order.search_read -> none
      .mockResolvedValueOnce(rpcResult([{ id: 8 }])) // res.partner.search_read -> found
      .mockResolvedValueOnce(rpcResult([{ id: 100 }])) // product.product.search_read -> found
      .mockResolvedValueOnce(rpcResult(42)) // sale.order.create
      .mockResolvedValueOnce(rpcResult(true)) // action_confirm

    const response = await action.main(fakeParams)

    expect(response.statusCode).toEqual(200)
    expect(response.body.odoo_sale_order_id).toEqual(42)
    expect(fetch).toHaveBeenCalledTimes(6) // no partner/product create calls
  })

  test('missing increment_id should return 400', async () => {
    const { increment_id, ...noId } = fakeParams
    const response = await action.main(noId)
    expect(response.error.statusCode).toEqual(400)
    expect(response.error.body.error).toEqual(expect.stringContaining('increment_id'))
  })

  test('missing Authorization header should return 400', async () => {
    const response = await action.main({ ...fakeParams, __ow_headers: {} })
    expect(response.error.statusCode).toEqual(400)
    expect(response.error.body.error).toEqual(expect.stringContaining('authorization'))
  })

  test('missing Odoo config should return 500', async () => {
    const response = await action.main({ ...fakeParams, ODOO_URL: '$ODOO_URL' })
    expect(response).toEqual({
      error: { statusCode: 500, body: { error: 'server error' } }
    })
  })

  test('Odoo application error should return 500', async () => {
    fetch.mockResolvedValueOnce(rpcError('Access Denied'))
    const response = await action.main(fakeParams)
    expect(response).toEqual({
      error: { statusCode: 500, body: { error: 'server error' } }
    })
    expect(mockLoggerInstance.error).toHaveBeenCalled()
  })

  test('Odoo network failure should return 500', async () => {
    fetch.mockRejectedValue(new Error('ECONNREFUSED'))
    const response = await action.main(fakeParams)
    expect(response).toEqual({
      error: { statusCode: 500, body: { error: 'server error' } }
    })
    expect(mockLoggerInstance.error).toHaveBeenCalled()
  })
})
