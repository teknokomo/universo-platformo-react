// English-only comments
import { useState, useCallback, useRef, useEffect } from 'react'

export type ApiFunc<T> = (...args: any[]) => Promise<{ data: T }>

function useApi<T>(apiFunc: ApiFunc<T>) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)

  const apiRef = useRef(apiFunc)
  apiRef.current = apiFunc

  const isMounted = useRef(true)
  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  const request = useCallback(async (...args: any[]) => {
    setLoading(true)
    try {
      const result = await apiRef.current(...args)
      if (isMounted.current) {
        setData(result.data)
      }
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

  return { data, error, loading, request }
}

export default useApi

