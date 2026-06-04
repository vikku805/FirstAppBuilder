/* eslint-disable jest/no-export, jest/valid-title */

/*
* Shared test helpers to eliminate duplicated mock setup across action tests.
*/

/**
 * Sets up the standard @adobe/aio-sdk and node-fetch mocks used by action tests.
 * Returns the mock logger instance for assertions.
 */
function setupActionMocks () {
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

  beforeEach(() => {
    Core.Logger.mockClear()
    mockLoggerInstance.info.mockReset()
    mockLoggerInstance.debug.mockReset()
    mockLoggerInstance.error.mockReset()
  })

  return { Core, mockLoggerInstance, fetch }
}

/**
 * Generates common test cases for actions that follow the standard
 * createActionHandler pattern (logger setup, missing-params 400, server-error 500).
 *
 * @param {string} describeName  label for the describe block
 * @param {object} action        the action module (must export .main)
 * @param {object} deps          { Core, mockLoggerInstance, fetch }
 * @param {object} fakeParams    request params that satisfy all required inputs
 * @param {string} missingInputError expected error string when called with {}
 */
function describeCommonActionTests (describeName, action, deps, fakeParams, missingInputError) {
  const { Core, mockLoggerInstance, fetch } = deps

  describe(describeName, () => {
    test('main should be defined', () => {
      expect(action.main).toBeInstanceOf(Function)
    })

    test('should set logger to use LOG_LEVEL param', async () => {
      await action.main({ ...fakeParams, LOG_LEVEL: 'fakeLevel' })
      expect(Core.Logger).toHaveBeenCalledWith(expect.any(String), { level: 'fakeLevel' })
    })

    test('if there is an error should return a 500 and log the error', async () => {
      const fakeError = new Error('fake')
      fetch.mockRejectedValue(fakeError)
      const response = await action.main(fakeParams)
      expect(response).toEqual({
        error: {
          statusCode: 500,
          body: { error: 'server error' }
        }
      })
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(fakeError)
    })

    test('missing input request parameters, should return 400', async () => {
      const response = await action.main({})
      expect(response).toEqual({
        error: {
          statusCode: 400,
          body: { error: missingInputError }
        }
      })
    })
  })
}

module.exports = {
  setupActionMocks,
  describeCommonActionTests
}
