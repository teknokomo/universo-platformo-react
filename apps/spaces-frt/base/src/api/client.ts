import { createAuthClient } from '@universo/auth-frt'
import type { AxiosResponse } from 'axios'

import { baseURL } from '@ui/store/constant'

const client = createAuthClient({ baseURL: `${baseURL}/api/v1` })

client.defaults.headers.common['x-request-from'] = 'internal'

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
  (error: unknown) => {
    const status = typeof error === 'object' && error && 'response' in error ? (error as any).response?.status : undefined
    if (status === 401 && typeof window !== 'undefined') {
      const isAuthRoute = window.location.pathname.startsWith('/auth')
      if (!isAuthRoute) {
        window.location.href = '/auth'
      }
    }
    return Promise.reject(error)
  },
)

export default client
