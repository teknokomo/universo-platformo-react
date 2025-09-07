// English-only comments in code files.
import axios from 'axios'
import { baseURL } from '@/store/constant'

// Axios client configured for Spaces frontend
const client = axios.create({
  baseURL: `${baseURL}/api/v1`,
  headers: {
    'Content-type': 'application/json',
    'x-request-from': 'internal'
  },
  withCredentials: true
})

// Attach Authorization from localStorage if present
client.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  } catch {}
  return config
})

// Basic debug logging (safe)
client.interceptors.response.use(
  (response) => {
    try {
      // eslint-disable-next-line no-console
      console.log('[spacesApi][response]', {
        url: response?.config?.baseURL + (response?.config?.url || ''),
        status: response?.status
      })
    } catch {}
    return response
  },
  async (error) => {
    const originalRequest = error?.config || {}
    if (error?.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const resp = await axios.post(`${baseURL}/api/v1/auth/refresh`, {}, { withCredentials: true })
        const access = resp?.data?.accessToken
        if (access) {
          localStorage.setItem('token', access)
          originalRequest.headers = originalRequest.headers || {}
          originalRequest.headers.Authorization = `Bearer ${access}`
          return client(originalRequest)
        }
      } catch (refreshErr) {
        // eslint-disable-next-line no-console
        console.error('Token refresh failed:', refreshErr)
        try { window.location.href = '/auth' } catch {}
      }
    }
    return Promise.reject(error)
  }
)

export default client

