// English-only comments in code files.
import { useState } from 'react'

// Small helper hook to wrap async API calls with loading/error/data state
export default function useApi(apiFunc) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const request = async (...args) => {
    setLoading(true)
    try {
      const result = await apiFunc(...args)
      // Axios-like shape expected: { data }
      setData(result?.data)
      return result?.data
    } catch (err) {
      setError(err || 'Unexpected Error')
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { data, error, loading, request }
}

