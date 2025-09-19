import axios, {
  AxiosHeaders,
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'

import { baseURL } from '@ui/store/constant'

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

const client: AxiosInstance = axios.create({
  baseURL: `${baseURL}/api/v1`,
  headers: {
    'Content-type': 'application/json',
    'x-request-from': 'internal',
  },
  withCredentials: true,
})

client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  try {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null
    if (token) {
      const headers = config.headers instanceof AxiosHeaders
        ? config.headers
        : new AxiosHeaders(config.headers)

      headers.set('Authorization', `Bearer ${token}`)
      config.headers = headers
    }
  } catch {
    // ignore storage errors
  }
  return config
})

client.interceptors.response.use(
  (response: AxiosResponse) => {
    try {
      // eslint-disable-next-line no-console
      console.log('[spacesApi][response]', {
        url: `${response?.config?.baseURL ?? ''}${response?.config?.url ?? ''}`,
        status: response?.status,
      })
    } catch {
      // ignore logging issues in production builds
    }
    return response
  },
  async (error: AxiosError) => {
    const responseStatus = error.response?.status
    const originalRequest = (error.config ?? {}) as RetriableRequestConfig

    if (responseStatus === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const refreshResponse = await axios.post(
          `${baseURL}/api/v1/auth/refresh`,
          {},
          { withCredentials: true },
        )
        const accessToken = (refreshResponse.data as { accessToken?: string } | undefined)?.accessToken

        if (accessToken) {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('token', accessToken)
          }

          const headers = originalRequest.headers instanceof AxiosHeaders
            ? originalRequest.headers
            : new AxiosHeaders(originalRequest.headers)

          headers.set('Authorization', `Bearer ${accessToken}`)
          originalRequest.headers = headers
          return client(originalRequest)
        }
      } catch (refreshError) {
        // eslint-disable-next-line no-console
        console.error('Token refresh failed:', refreshError)
        try {
          if (typeof window !== 'undefined') {
            window.location.href = '/auth'
          }
        } catch {
          // ignore navigation errors in non-browser contexts
        }
      }
    }

    return Promise.reject(error)
  },
)

export default client
