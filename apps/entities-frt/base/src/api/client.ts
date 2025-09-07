// English-only comments
import axios from 'axios'

// Keep it simple for package reuse within flowise-ui host
// Base URL points to the same origin server where UI is served
const apiClient = axios.create({
  baseURL: `/api/v1`,
  headers: {
    'Content-type': 'application/json',
    'x-request-from': 'entities-frt'
  },
  withCredentials: true
})

// Optional: attach JWT if available (UI sets it on login)
apiClient.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  } catch (_) {}
  return config
})

export default apiClient

