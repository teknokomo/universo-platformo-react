import { useState, useCallback, useRef } from 'react'

export default (apiFunc) => {
    const [data, setData] = useState(null)
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)

    const apiRef = useRef(apiFunc)
    apiRef.current = apiFunc

    const request = useCallback(async (...args) => {
        setLoading(true)
        try {
            const result = await apiRef.current(...args)
            setData(result.data)
        } catch (err) {
            setError(err || 'Unexpected Error!')
        } finally {
            setLoading(false)
        }
    }, [])

    return {
        data,
        error,
        loading,
        request
    }
}
