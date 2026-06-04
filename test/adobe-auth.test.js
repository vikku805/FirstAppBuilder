/*
* <license header>
*/

const mockGetAccessToken = jest.fn(() => 'mock-access-token')
const mockGetHeaders = jest.fn(() => ({ Authorization: 'Bearer mock-access-token' }))

jest.mock('@adobe/aio-commerce-lib-auth', () => ({
  assertImsAuthParams: jest.fn(),
  getImsAuthProvider: jest.fn(() => ({
    getAccessToken: mockGetAccessToken,
    getHeaders: mockGetHeaders
  }))
}))

const { getAdobeAccessToken, getAdobeAccessHeaders } = require('../actions/commerce/utils/adobe-auth')
const { assertImsAuthParams, getImsAuthProvider } = require('@adobe/aio-commerce-lib-auth')

beforeEach(() => {
  jest.clearAllMocks()
})

const fakeParams = {
  OAUTH_CLIENT_ID: 'test-client-id',
  OAUTH_CLIENT_SECRET: 'test-client-secret',
  OAUTH_TECHNICAL_ACCOUNT_ID: 'test-tech-id',
  OAUTH_TECHNICAL_ACCOUNT_EMAIL: 'test@example.com',
  OAUTH_ORG_ID: 'test-org-id',
  AIO_CLI_ENV: 'stage'
}

describe('getAdobeAccessToken', () => {
  test('should return an access token', () => {
    const token = getAdobeAccessToken(fakeParams)
    expect(token).toBe('mock-access-token')
  })

  test('should call assertImsAuthParams with resolved config', () => {
    getAdobeAccessToken(fakeParams)
    expect(assertImsAuthParams).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'test-client-id',
        clientSecrets: ['test-client-secret'],
        technicalAccountId: 'test-tech-id',
        technicalAccountEmail: 'test@example.com',
        imsOrgId: 'test-org-id',
        environment: 'stage'
      })
    )
  })

  test('should call getImsAuthProvider with resolved config', () => {
    getAdobeAccessToken(fakeParams)
    expect(getImsAuthProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'test-client-id',
        imsOrgId: 'test-org-id'
      })
    )
  })

  test('should use prod as default environment when AIO_CLI_ENV is not set', () => {
    const paramsWithoutEnv = { ...fakeParams }
    delete paramsWithoutEnv.AIO_CLI_ENV
    getAdobeAccessToken(paramsWithoutEnv)
    expect(assertImsAuthParams).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: 'prod'
      })
    )
  })

  test('should set empty clientSecrets array when OAUTH_CLIENT_SECRET is not set', () => {
    const paramsWithoutSecret = { ...fakeParams }
    delete paramsWithoutSecret.OAUTH_CLIENT_SECRET
    getAdobeAccessToken(paramsWithoutSecret)
    expect(assertImsAuthParams).toHaveBeenCalledWith(
      expect.objectContaining({
        clientSecrets: []
      })
    )
  })

  test('should include default IMS scopes', () => {
    getAdobeAccessToken(fakeParams)
    expect(assertImsAuthParams).toHaveBeenCalledWith(
      expect.objectContaining({
        scopes: expect.arrayContaining([
          'AdobeID',
          'openid',
          'read_organizations',
          'adobeio_api',
          'commerce.accs'
        ])
      })
    )
  })
})

describe('getAdobeAccessHeaders', () => {
  test('should return headers with access token', () => {
    const headers = getAdobeAccessHeaders(fakeParams)
    expect(headers).toEqual({ Authorization: 'Bearer mock-access-token' })
  })

  test('should call assertImsAuthParams with resolved config', () => {
    getAdobeAccessHeaders(fakeParams)
    expect(assertImsAuthParams).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'test-client-id',
        imsOrgId: 'test-org-id'
      })
    )
  })

  test('should call getImsAuthProvider and getHeaders', () => {
    getAdobeAccessHeaders(fakeParams)
    expect(getImsAuthProvider).toHaveBeenCalled()
    expect(mockGetHeaders).toHaveBeenCalled()
  })
})
