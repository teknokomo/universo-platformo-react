import { useState } from 'react'

export default (apiFunc) => {
    const [data, setData] = useState(null)
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)

    const request = async (...args) => {
        setLoading(true)
        try {
            const result = await apiFunc(...args)
            console.log('[useApi] Raw axios response:', result)
            setData(result.data)
            // Return payload for callers that rely on immediate value
            return result.data
        } catch (err) {
            console.error('[useApi] Request error:', err)
            setError(err || 'Unexpected Error!')
        } finally {
            setLoading(false)
        }
    }

    return {
        data,
        error,
        loading,
        request
    }
}
