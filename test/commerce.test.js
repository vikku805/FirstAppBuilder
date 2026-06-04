/* 
* <license header>
*/

const mockGetHeaders = jest.fn(() => ({ Authorization: 'Bearer mock-token' }))

jest.mock('@adobe/aio-commerce-lib-auth', () => ({
  getIntegrationAuthProvider: jest.fn(() => ({
    getHeaders: mockGetHeaders
  }))
}))

jest.mock('../utils/adobe-auth', () => ({
  getAdobeAccessToken: jest.fn(() => 'mock-access-token')
}))

jest.mock('@adobe/aio-sdk', () => ({
  Core: {
    Logger: jest.fn()
  }
}))

const { Core } = require('@adobe/aio-sdk')
const mockLoggerInstance = { info: jest.fn(), debug: jest.fn(), error: jest.fn() }
Core.Logger.mockReturnValue(mockLoggerInstance)

const action = require('./../actions/commerce/index.js')

beforeEach(() => {
  Core.Logger.mockClear()
  mockLoggerInstance.info.mockReset()
  mockLoggerInstance.debug.mockReset()
  mockLoggerInstance.error.mockReset()
  mockGetHeaders.mockClear()
  global.fetch = jest.fn()
})

afterEach(() => {
  delete global.fetch
})

const fakeParams = {
  __ow_headers: { authorization: 'Bearer fake' },
  sku: 'test-sku-123',
  COMMERCE_URL: 'https://commerce.example.com/',
  COMMERCE_CONSUMER_KEY: 'fake-consumer-key',
  COMMERCE_CONSUMER_SECRET: 'fake-consumer-secret',
  COMMERCE_ACCESS_TOKEN: 'fake-access-token',
  COMMERCE_ACCESS_TOKEN_SECRET: 'fake-access-token-secret'
}

describe('commerce', () => {
  test('main should be defined', () => {
    expect(action.main).toBeInstanceOf(Function)
  })

  test('should set logger to use LOG_LEVEL param', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ name: 'Test Product' })
    })
    await action.main({ ...fakeParams, LOG_LEVEL: 'fakeLevel' })
    expect(Core.Logger).toHaveBeenCalledWith(expect.any(String), { level: 'fakeLevel' })
  })

  test('should return an http response with the fetched content', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ name: 'Test Product', sku: 'test-sku-123' })
    })
    const response = await action.main(fakeParams)
    expect(response).toEqual({
      statusCode: 200,
      body: { name: 'Test Product', sku: 'test-sku-123' }
    })
  })

  test('if there is an error should return a 500 and log the error', async () => {
    const fakeError = new Error('fake')
    global.fetch = jest.fn().mockRejectedValue(fakeError)
    const response = await action.main(fakeParams)
    expect(response).toEqual({
      error: {
        statusCode: 500,
        body: { error: 'server error' }
      }
    })
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(fakeError)
  })

  test('if returned service status code is not ok should return a 500', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    })
    const response = await action.main(fakeParams)
    expect(response).toEqual({
      error: {
        statusCode: 500,
        body: { error: 'server error' }
      }
    })
    expect(mockLoggerInstance.error).toHaveBeenCalled()
  })

  test('missing input request parameters, should return 400', async () => {
    const response = await action.main({})
    expect(response).toEqual({
      error: {
        statusCode: 400,
        body: { error: "missing header(s) 'authorization' and missing parameter(s) 'sku'" }
      }
    })
  })

  test('missing sku parameter should return 400', async () => {
    const paramsWithoutSku = {
      __ow_headers: { authorization: 'Bearer fake' },
      COMMERCE_URL: 'https://commerce.example.com/',
      COMMERCE_CONSUMER_KEY: 'fake-consumer-key',
      COMMERCE_CONSUMER_SECRET: 'fake-consumer-secret',
      COMMERCE_ACCESS_TOKEN: 'fake-access-token',
      COMMERCE_ACCESS_TOKEN_SECRET: 'fake-access-token-secret'
    }
    const response = await action.main(paramsWithoutSku)
    expect(response).toEqual({
      error: {
        statusCode: 400,
        body: { error: "missing parameter(s) 'sku'" }
      }
    })
  })

  test('should use default log level info when LOG_LEVEL not set', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({})
    })
    await action.main(fakeParams)
    expect(Core.Logger).toHaveBeenCalledWith(expect.any(String), { level: 'info' })
  })
})
