import {useEffect, useState} from 'react'
import {callAction} from "../utils";

export const useCommerceProduct = (props, sku) => {
    const [product, setProduct] = useState([])
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            setError(null)
            try {
                const result = await callAction(props, 'adobeappbuilder/commerce', {sku: sku})
                setProduct(result.error ? null : result);
                if (result.error) {
                    setError(result.error)
                }
            } catch (e) {
                console.error('Failed to fetch commerce product:', e.message)
                setError(e.message)
                setProduct(null)
            } finally {
                setLoading(false)
            }
        };

        if (sku) {
            fetchData()
        }
    }, [sku]);

    return {product, error, loading}
}