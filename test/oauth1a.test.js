/*
* <license header>
*/

const mockGetHeaders = jest.fn(() => ({ Authorization: 'OAuth mock-header' }))

jest.mock('@adobe/aio-commerce-lib-auth', () => ({
  getIntegrationAuthProvider: jest.fn(() => ({
    getHeaders: mockGetHeaders
  }))
}))

jest.mock('../utils/adobe-auth', () => ({
  getAdobeAccessToken: jest.fn(() => 'mock-ims-token')
}))

const { getClient } = require('../actions/oauth1a')
const { getIntegrationAuthProvider } = require('@adobe/aio-commerce-lib-auth')
const { getAdobeAccessToken } = require('../utils/adobe-auth')

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn()
})

afterEach(() => {
  delete global.fetch
})

const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn()
}

const baseClientOptions = {
  params: {
    COMMERCE_CONSUMER_KEY: 'test-consumer-key',
    COMMERCE_CONSUMER_SECRET: 'test-consumer-secret',
    COMMERCE_ACCESS_TOKEN: 'test-access-token',
    COMMERCE_ACCESS_TOKEN_SECRET: 'test-access-token-secret'
  },
  url: 'https://commerce.example.com/',
  consumerKey: 'test-consumer-key',
  consumerSecret: 'test-consumer-secret',
  accessToken: 'test-access-token',
  accessTokenSecret: 'test-access-token-secret'
}

describe('getClient', () => {
  test('should return a client object', () => {
    const client = getClient(baseClientOptions, mockLogger)
    expect(client).toBeDefined()
    expect(typeof client.get).toBe('function')
    expect(typeof client.post).toBe('function')
    expect(typeof client.put).toBe('function')
    expect(typeof client.delete).toBe('function')
    expect(typeof client.consumerToken).toBe('function')
  })

  test('should use Commerce OAuth1 authentication when COMMERCE_CONSUMER_KEY is set', () => {
    getClient(baseClientOptions, mockLogger)
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Commerce client is using Commerce OAuth1 authentication'
    )
    expect(getIntegrationAuthProvider).toHaveBeenCalledWith({
      consumerKey: 'test-consumer-key',
      consumerSecret: 'test-consumer-secret',
      accessToken: 'test-access-token',
      accessTokenSecret: 'test-access-token-secret'
    })
  })

  test('should use IMS OAuth when OAUTH_CLIENT_ID is set and COMMERCE_CONSUMER_KEY is not', () => {
    const imsOptions = {
      params: {
        OAUTH_CLIENT_ID: 'test-client-id',
        OAUTH_CLIENT_SECRET: 'test-client-secret'
      },
      url: 'https://commerce.example.com/'
    }
    getClient(imsOptions, mockLogger)
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Commerce client is using IMS OAuth authentication'
    )
  })

  test('should throw error when no auth type is configured', () => {
    const noAuthOptions = {
      params: {},
      url: 'https://commerce.example.com/'
    }
    expect(() => getClient(noAuthOptions, mockLogger)).toThrow(
      'Unknown auth type, supported IMS OAuth or Commerce OAuth1. Please review documented auth types'
    )
  })

  test('should throw error when COMMERCE_CONSUMER_KEY equals placeholder string', () => {
    const placeholderOptions = {
      params: {
        COMMERCE_CONSUMER_KEY: '$COMMERCE_CONSUMER_KEY'
      },
      url: 'https://commerce.example.com/'
    }
    expect(() => getClient(placeholderOptions, mockLogger)).toThrow(
      'Unknown auth type'
    )
  })

  test('should throw error when OAUTH_CLIENT_ID equals placeholder string', () => {
    const placeholderOptions = {
      params: {
        OAUTH_CLIENT_ID: '$OAUTH_CLIENT_ID'
      },
      url: 'https://commerce.example.com/'
    }
    expect(() => getClient(placeholderOptions, mockLogger)).toThrow(
      'Unknown auth type'
    )
  })
})

describe('client.get', () => {
  test('should make a GET request to the correct URL', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 1, name: 'Product' })
    })
    const client = getClient(baseClientOptions, mockLogger)
    const result = await client.get('products/sku-123')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://commerce.example.com/V1/products/sku-123',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Accept: 'application/json'
        })
      })
    )
    expect(result).toEqual({ id: 1, name: 'Product' })
  })

  test('should use provided request token instead of auth headers', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 1 })
    })
    const client = getClient(baseClientOptions, mockLogger)
    await client.get('products/sku-123', 'custom-token')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer custom-token'
        })
      })
    )
  })

  test('should throw on non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    })
    const client = getClient(baseClientOptions, mockLogger)
    await expect(client.get('products/nonexistent')).rejects.toThrow(
      'HTTP 404: Not Found'
    )
    expect(mockLogger.error).toHaveBeenCalled()
  })
})

describe('client.post', () => {
  test('should make a POST request with data', async () => {
    const postData = JSON.stringify({ name: 'New Product' })
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 2 })
    })
    const client = getClient(baseClientOptions, mockLogger)
    const result = await client.post('products', postData)
    expect(global.fetch).toHaveBeenCalledWith(
      'https://commerce.example.com/V1/products',
      expect.objectContaining({
        method: 'POST',
        body: postData,
        headers: expect.objectContaining({
          Accept: 'application/json'
        })
      })
    )
    expect(result).toEqual({ id: 2 })
  })

  test('should accept custom headers', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({})
    })
    const client = getClient(baseClientOptions, mockLogger)
    await client.post('products', '{}', '', { 'X-Custom': 'value' })
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Custom': 'value'
        })
      })
    )
  })
})

describe('client.put', () => {
  test('should make a PUT request with data', async () => {
    const putData = JSON.stringify({ name: 'Updated Product' })
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 1, name: 'Updated Product' })
    })
    const client = getClient(baseClientOptions, mockLogger)
    const result = await client.put('products/1', putData)
    expect(global.fetch).toHaveBeenCalledWith(
      'https://commerce.example.com/V1/products/1',
      expect.objectContaining({
        method: 'PUT',
        body: putData
      })
    )
    expect(result).toEqual({ id: 1, name: 'Updated Product' })
  })
})

describe('client.delete', () => {
  test('should make a DELETE request', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(true)
    })
    const client = getClient(baseClientOptions, mockLogger)
    const result = await client.delete('products/1')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://commerce.example.com/V1/products/1',
      expect.objectContaining({
        method: 'DELETE'
      })
    )
    expect(result).toBe(true)
  })
})

describe('client.consumerToken', () => {
  test('should make a POST request to integration/customer/token', async () => {
    const loginData = JSON.stringify({ username: 'user', password: 'pass' })
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve('token-value')
    })
    const client = getClient(baseClientOptions, mockLogger)
    const result = await client.consumerToken(loginData)
    expect(global.fetch).toHaveBeenCalledWith(
      'https://commerce.example.com/V1/integration/customer/token',
      expect.objectContaining({
        method: 'POST',
        body: loginData
      })
    )
    expect(result).toBe('token-value')
  })
})

describe('IMS OAuth authentication flow', () => {
  test('should call getAdobeAccessToken when using IMS OAuth', async () => {
    const imsOptions = {
      params: {
        OAUTH_CLIENT_ID: 'test-client-id',
        OAUTH_CLIENT_SECRET: 'test-client-secret'
      },
      url: 'https://commerce.example.com/'
    }
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 1 })
    })
    const client = getClient(imsOptions, mockLogger)
    await client.get('products/sku-123')
    expect(getAdobeAccessToken).toHaveBeenCalledWith(imsOptions.params)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-ims-token'
        })
      })
    )
  })
})
