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
const action = require('./../actions/generic/index.js')

beforeEach(() => {
  Core.Logger.mockClear()
  mockLoggerInstance.info.mockReset()
  mockLoggerInstance.debug.mockReset()
  mockLoggerInstance.error.mockReset()
})

const fakeParams = { __ow_headers: { authorization: 'Bearer fake' } }
describe('generic', () => {
  test('main should be defined', () => {
    expect(action.main).toBeInstanceOf(Function)
  })
  test('should set logger to use LOG_LEVEL param', async () => {
    await action.main({ ...fakeParams, LOG_LEVEL: 'fakeLevel' })
    expect(Core.Logger).toHaveBeenCalledWith(expect.any(String), { level: 'fakeLevel' })
  })
  test('should return a hard-coded response due to early return', async () => {
    const response = await action.main(fakeParams)
    expect(response).toEqual({
      sttatusCode: 200,
      body: { message: 'Hello ertrtrtrtrtrtrtrtrtrtrt' }
    })
  })
  test('should use default log level info when LOG_LEVEL not set', async () => {
    await action.main(fakeParams)
    expect(Core.Logger).toHaveBeenCalledWith(expect.any(String), { level: 'info' })
  })
  test('should log calling the main action', async () => {
    await action.main(fakeParams)
    expect(mockLoggerInstance.info).toHaveBeenCalledWith('Calling the main action')
  })
  test('should debug log stringified params', async () => {
    await action.main(fakeParams)
    expect(mockLoggerInstance.debug).toHaveBeenCalled()
  })
})
