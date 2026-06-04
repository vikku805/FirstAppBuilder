/* 
* <license header>
*/

const { setupActionMocks, describeCommonActionTests } = require('./helpers')
const deps = setupActionMocks()
const { fetch } = deps

const action = require('./../actions/commerce/index.js')

const fakeParams = { __ow_headers: { authorization: 'Bearer fake' } }

describeCommonActionTests('commerce', action, deps, fakeParams, "missing header(s) 'authorization'")

describe('commerce - action-specific', () => {
  test('should return an http reponse with the fetched content', async () => {
    const mockFetchResponse = {
      ok: true,
      json: () => Promise.resolve({ content: 'fake' })
    }
    fetch.mockResolvedValue(mockFetchResponse)
    const response = await action.main(fakeParams)
    expect(response).toEqual({
      statusCode: 200,
      body: { content: 'fake' }
    })
  })

  test('if returned service status code is not ok should return a 500 and log the status', async () => {
    const mockFetchResponse = {
      ok: false,
      status: 404
    }
    fetch.mockResolvedValue(mockFetchResponse)
    const response = await action.main(fakeParams)
    expect(response).toEqual({
      error: {
        statusCode: 500,
        body: { error: 'server error' }
      }
    })
    expect(deps.mockLoggerInstance.error).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('404') }))
  })
})
