import { useState } from 'react'
import { callAction } from '../utils'
import { validateUpdateInput, buildUpdateProductParams } from './createProductHelpers.js'

/**
 * Hook exposing an imperative `updateProduct` that validates the input and,
 * when valid, calls the `commerce` action with operation === 'update'.
 */
export const useUpdateProduct = (props) => {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [errors, setErrors] = useState([])

  const updateProduct = async (input) => {
    const validationErrors = validateUpdateInput(input)
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      setResult(null)
      return { ok: false, errors: validationErrors }
    }

    setErrors([])
    setResult(null)
    setLoading(true)
    try {
      const params = buildUpdateProductParams(input)
      const res = await callAction(props, 'adobeappbuilder/commerce', params)
      setResult(res)
      return { ok: !(res && res.error), result: res }
    } catch (e) {
      setErrors([e.message])
      return { ok: false, errors: [e.message] }
    } finally {
      setLoading(false)
    }
  }

  return { updateProduct, loading, result, errors }
}
