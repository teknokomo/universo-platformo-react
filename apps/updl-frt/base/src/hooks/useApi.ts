// Universo Platformo | Hook for API operations
import { useState } from 'react'

/**
 * Custom hook for API operations with loading, error, and data states
 * @param apiFunction API function to execute
 * @returns Object with execute function, data, loading, and error states
 */
export const useApi = <T, P = any>(apiFunction: (params: P) => Promise<T>) => {
    const [data, setData] = useState<T | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const execute = async (params: P): Promise<T> => {
        try {
            setLoading(true)
            setError(null)
            const result = await apiFunction(params)
            setData(result)
            return result
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setError(error)
            throw error
        } finally {
            setLoading(false)
        }
    }

    return { execute, data, loading, error }
}

export default useApi
