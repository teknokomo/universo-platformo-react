// English-only comments in code files.
import { useState, useCallback } from 'react'

type ApiFunction<T> = (...args: unknown[]) => Promise<{ data: T }>

export interface UseApiReturn<T> {
    data: T | null
    error: unknown
    loading: boolean
    request: (...args: unknown[]) => Promise<T | undefined>
}

/**
 * Custom hook for API calls with loading/error state management
 * Replaces dependency on @ui/hooks/useApi
 */
const useApi = <T = unknown>(apiFunc: ApiFunction<T>): UseApiReturn<T> => {
    const [data, setData] = useState<T | null>(null)
    const [error, setError] = useState<unknown>(null)
    const [loading, setLoading] = useState(false)

    const request = useCallback(
        async (...args: unknown[]): Promise<T | undefined> => {
            try {
                setLoading(true)
                setError(null)
                const response = await apiFunc(...args)
                const result = response.data
                setData(result)
                return result
            } catch (err) {
                setError(err)
                setData(null)
                return undefined
            } finally {
                setLoading(false)
            }
        },
        [apiFunc]
    )

    return { data, error, loading, request }
}

export default useApi
