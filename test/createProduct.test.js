/*
* <license header>
*/

const {
  parseCategoryIds,
  validateCreateInput,
  buildCreateProductParams,
  validateUpdateInput,
  buildUpdateProductParams
} = require('../web-src/src/hooks/createProductHelpers.js')

describe('parseCategoryIds', () => {
  test('splits, trims and drops empty entries', () => {
    expect(parseCategoryIds(' 3, 4 ,,5 ')).toEqual(['3', '4', '5'])
  })

  test('returns an empty array for blank/undefined input', () => {
    expect(parseCategoryIds('')).toEqual([])
    expect(parseCategoryIds(undefined)).toEqual([])
  })
})

describe('validateCreateInput', () => {
  test('returns no errors for valid input', () => {
    expect(validateCreateInput({ sku: 'abc', name: 'Test Product', price: '10' })).toEqual([])
  })

  test('requires sku', () => {
    expect(validateCreateInput({ sku: '', name: 'Test', price: '10' })).toContain('SKU is required')
  })

  test('treats whitespace-only name as missing', () => {
    expect(validateCreateInput({ sku: 'abc', name: '   ', price: '10' })).toContain('Name is required')
  })

  test('requires price', () => {
    expect(validateCreateInput({ sku: 'abc', name: 'Test', price: '' })).toContain('Price is required')
  })

  test('rejects non-numeric price', () => {
    expect(validateCreateInput({ sku: 'abc', name: 'Test', price: 'free' }))
      .toContain('Price must be a number greater than 0')
  })

  test('rejects zero and negative price', () => {
    expect(validateCreateInput({ sku: 'abc', name: 'Test', price: '0' }))
      .toContain('Price must be a number greater than 0')
    expect(validateCreateInput({ sku: 'abc', name: 'Test', price: '-5' }))
      .toContain('Price must be a number greater than 0')
  })

  test('accumulates all errors for empty input', () => {
    expect(validateCreateInput({})).toEqual([
      'SKU is required',
      'Name is required',
      'Price is required'
    ])
  })

  test('quantity is optional', () => {
    expect(validateCreateInput({ sku: 'abc', name: 'Test', price: '10' })).toEqual([])
  })

  test('accepts a valid quantity', () => {
    expect(validateCreateInput({ sku: 'abc', name: 'Test', price: '10', quantity: '25' })).toEqual([])
  })

  test('rejects negative or non-numeric quantity', () => {
    expect(validateCreateInput({ sku: 'abc', name: 'Test', price: '10', quantity: '-1' }))
      .toContain('Quantity must be a number of 0 or greater')
    expect(validateCreateInput({ sku: 'abc', name: 'Test', price: '10', quantity: 'lots' }))
      .toContain('Quantity must be a number of 0 or greater')
  })

  test('accepts valid comma-separated category IDs', () => {
    expect(validateCreateInput({ sku: 'abc', name: 'Test', price: '10', categories: '3, 4' })).toEqual([])
  })

  test('rejects non-numeric or non-positive category IDs', () => {
    expect(validateCreateInput({ sku: 'abc', name: 'Test', price: '10', categories: '3, shoes' }))
      .toContain('Categories must be a comma-separated list of numeric IDs')
    expect(validateCreateInput({ sku: 'abc', name: 'Test', price: '10', categories: '0' }))
      .toContain('Categories must be a comma-separated list of numeric IDs')
  })
})

describe('buildCreateProductParams', () => {
  test('trims strings, coerces price to a number and sets the create operation', () => {
    expect(buildCreateProductParams({
      sku: ' abc ', name: ' Test Product ', price: '12.5', quantity: '7', categories: '3, 4'
    })).toEqual({
      operation: 'create',
      sku: 'abc',
      name: 'Test Product',
      price: 12.5,
      qty: 7,
      categoryIds: ['3', '4']
    })
  })

  test('defaults qty to 0 when quantity is omitted', () => {
    expect(buildCreateProductParams({ sku: 'x', name: 'y', price: '1' }).qty).toBe(0)
  })

  test('always sets operation to create', () => {
    expect(buildCreateProductParams({ sku: 'x', name: 'y', price: '1' }).operation).toBe('create')
  })
})

describe('validateUpdateInput', () => {
  test('requires only a sku', () => {
    expect(validateUpdateInput({ sku: 'abc' })).toEqual([])
  })

  test('reports missing sku', () => {
    expect(validateUpdateInput({})).toContain('SKU is required')
  })

  test('validates optional fields only when provided', () => {
    expect(validateUpdateInput({ sku: 'abc', price: '0' }))
      .toContain('Price must be a number greater than 0')
    expect(validateUpdateInput({ sku: 'abc', quantity: '-1' }))
      .toContain('Quantity must be a number of 0 or greater')
    expect(validateUpdateInput({ sku: 'abc', categories: 'x' }))
      .toContain('Categories must be a comma-separated list of numeric IDs')
  })

  test('ignores blank optional fields', () => {
    expect(validateUpdateInput({ sku: 'abc', name: '', price: '', quantity: '', categories: '' })).toEqual([])
  })
})

describe('buildUpdateProductParams', () => {
  test('includes only the fields that were provided', () => {
    expect(buildUpdateProductParams({ sku: ' abc ', price: '20', quantity: '', name: '', categories: '' })).toEqual({
      operation: 'update',
      sku: 'abc',
      price: 20
    })
  })

  test('includes all provided fields with correct types', () => {
    expect(buildUpdateProductParams({ sku: 'abc', name: ' New Name ', price: '9.5', quantity: '3', categories: '5, 6' }))
      .toEqual({
        operation: 'update',
        sku: 'abc',
        name: 'New Name',
        price: 9.5,
        qty: 3,
        categoryIds: ['5', '6']
      })
  })

  test('with only a sku sends just sku + operation (leaves everything unchanged)', () => {
    expect(buildUpdateProductParams({ sku: 'abc' })).toEqual({
      operation: 'update',
      sku: 'abc'
    })
  })
})
