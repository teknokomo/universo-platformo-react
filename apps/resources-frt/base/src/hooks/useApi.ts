import { useState, useCallback, useRef, useEffect } from 'react'

export type ApiFunc<T, TArgs extends any[] = any[]> = (...args: TArgs) => Promise<{ data: T }>

export interface UseApiResponse<T, TArgs extends any[] = any[]> {
    data: T | null
    error: any
    loading: boolean
    request: (...args: TArgs) => Promise<T | null>
}

export function useApi<T, TArgs extends any[] = any[]>(
    apiFunc: ApiFunc<T, TArgs>
): UseApiResponse<T, TArgs> {
    const [data, setData] = useState<T | null>(null)
    const [error, setError] = useState<any>(null)
    const [loading, setLoading] = useState(false)

    const apiFuncRef = useRef(apiFunc)
    apiFuncRef.current = apiFunc

    const isMounted = useRef(true)
    useEffect(() => {
        isMounted.current = true
        return () => {
            isMounted.current = false
        }
    }, [])

    const request = useCallback(
        async (...args: TArgs): Promise<T | null> => {
            setLoading(true)
            setError(null)
            try {
                const result = await apiFuncRef.current(...args)
                if (isMounted.current) {
                    setData(result.data)
                    return result.data
                }
            } catch (err: any) {
                if (isMounted.current) {
                    setError(err || 'Unexpected Error!')
                }
                // We re-throw the error so that callers can catch it if they want
                throw err
            } finally {
                if (isMounted.current) {
                    setLoading(false)
                }
            }
            return null
        },
        []
    )

    return { data, error, loading, request }
}
