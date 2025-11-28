import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * Universal API hook that supports both:
 * - Legacy axios responses (with .data property)
 * - Modern @universo/api-client responses (data returned directly)
 */
export default (apiFunc) => {
    const [data, setData] = useState(null)
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)

    const apiRef = useRef(apiFunc)
    apiRef.current = apiFunc

    const isMounted = useRef(true)
    useEffect(() => {
        return () => {
            isMounted.current = false
        }
    }, [])

    const request = useCallback(async (...args) => {
        setLoading(true)
        try {
            const result = await apiRef.current(...args)
            // Support both axios responses (.data) and direct data from @universo/api-client
            const payload = result && typeof result === 'object' && 'data' in result ? result.data : result
            if (isMounted.current) {
                setData(payload)
            }
            return payload
        } catch (err) {
            if (isMounted.current) {
                setError(err || 'Unexpected Error!')
            }
            throw err
        } finally {
            if (isMounted.current) {
                setLoading(false)
            }
        }
    }, [])

    return {
        data,
        error,
        loading,
        request
    }
}
