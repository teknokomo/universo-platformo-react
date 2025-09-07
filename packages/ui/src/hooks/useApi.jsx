import { useState, useCallback, useRef, useEffect } from 'react'

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
            if (isMounted.current) {
                setData(result.data)
            }
            // Return payload for callers relying on the immediate value
            return result.data
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
