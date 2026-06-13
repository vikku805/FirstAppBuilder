/*
* <license header>
*/

/*
 * Pure, framework-agnostic helpers for the "create product" flow.
 * Kept as CommonJS (no React import) so they can be unit tested with the
 * existing Node-based Jest setup in ./test, and imported by the React hook.
 */

/**
 * Parses a comma-separated list of category IDs into an array of trimmed,
 * non-empty strings. e.g. "3, 4 ,," -> ['3', '4'].
 *
 * @param {string} raw - comma-separated category IDs
 * @returns {string[]}
 */
function parseCategoryIds (raw) {
  return `${raw || ''}`
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
}

/**
 * Validates user input for creating a product.
 *
 * @param {object} input - { sku, name, price, quantity, categories }
 * @returns {string[]} list of human readable validation errors (empty if valid)
 */
function validateCreateInput (input = {}) {
  const errors = []
  const sku = `${input.sku || ''}`.trim()
  const name = `${input.name || ''}`.trim()
  const priceRaw = input.price
  const qtyRaw = input.quantity
  const categoryIds = parseCategoryIds(input.categories)

  if (!sku) {
    errors.push('SKU is required')
  }
  if (!name) {
    errors.push('Name is required')
  }
  if (priceRaw === undefined || priceRaw === null || `${priceRaw}`.trim() === '') {
    errors.push('Price is required')
  } else if (isNaN(Number(priceRaw)) || Number(priceRaw) <= 0) {
    errors.push('Price must be a number greater than 0')
  }
  // Quantity is optional (defaults to 0), but if provided it must be a number >= 0.
  if (qtyRaw !== undefined && qtyRaw !== null && `${qtyRaw}`.trim() !== '') {
    if (isNaN(Number(qtyRaw)) || Number(qtyRaw) < 0) {
      errors.push('Quantity must be a number of 0 or greater')
    }
  }
  // Categories are optional, but each provided ID must be a positive integer.
  if (categoryIds.some((id) => !Number.isInteger(Number(id)) || Number(id) <= 0)) {
    errors.push('Categories must be a comma-separated list of numeric IDs')
  }

  return errors
}

/**
 * Builds the params payload sent to the `commerce` action for the create operation.
 *
 * @param {object} input - { sku, name, price }
 * @returns {object} params for callAction
 */
function buildCreateProductParams (input = {}) {
  return {
    operation: 'create',
    sku: `${input.sku || ''}`.trim(),
    name: `${input.name || ''}`.trim(),
    price: Number(input.price),
    qty: Number(input.quantity) || 0,
    categoryIds: parseCategoryIds(input.categories)
  }
}

/**
 * Validates user input for updating a product. Only the SKU (which identifies the
 * product to update) is required; every other field is optional and validated only
 * when a value is provided.
 *
 * @param {object} input - { sku, name, price, quantity, categories }
 * @returns {string[]} list of human readable validation errors (empty if valid)
 */
function validateUpdateInput (input = {}) {
  const errors = []
  const sku = `${input.sku || ''}`.trim()
  const priceRaw = input.price
  const qtyRaw = input.quantity
  const categoryIds = parseCategoryIds(input.categories)

  if (!sku) {
    errors.push('SKU is required')
  }
  if (priceRaw !== undefined && priceRaw !== null && `${priceRaw}`.trim() !== '') {
    if (isNaN(Number(priceRaw)) || Number(priceRaw) <= 0) {
      errors.push('Price must be a number greater than 0')
    }
  }
  if (qtyRaw !== undefined && qtyRaw !== null && `${qtyRaw}`.trim() !== '') {
    if (isNaN(Number(qtyRaw)) || Number(qtyRaw) < 0) {
      errors.push('Quantity must be a number of 0 or greater')
    }
  }
  if (categoryIds.some((id) => !Number.isInteger(Number(id)) || Number(id) <= 0)) {
    errors.push('Categories must be a comma-separated list of numeric IDs')
  }

  return errors
}

/**
 * Builds the params payload sent to the `commerce` action for the update operation.
 * Only includes the fields the user actually filled in, so blank fields are left
 * unchanged on the existing product.
 *
 * @param {object} input - { sku, name, price, quantity, categories }
 * @returns {object} params for callAction
 */
function buildUpdateProductParams (input = {}) {
  const params = {
    operation: 'update',
    sku: `${input.sku || ''}`.trim()
  }

  const name = `${input.name || ''}`.trim()
  if (name) {
    params.name = name
  }
  if (input.price !== undefined && input.price !== null && `${input.price}`.trim() !== '') {
    params.price = Number(input.price)
  }
  if (input.quantity !== undefined && input.quantity !== null && `${input.quantity}`.trim() !== '') {
    params.qty = Number(input.quantity)
  }
  const categoryIds = parseCategoryIds(input.categories)
  if (categoryIds.length > 0) {
    params.categoryIds = categoryIds
  }

  return params
}

module.exports = {
  parseCategoryIds,
  validateCreateInput,
  buildCreateProductParams,
  validateUpdateInput,
  buildUpdateProductParams
}
