import { createAuthClient } from '@universo/auth-frt'
import type { AuthClient } from '@universo/auth-frt'
import type { AxiosResponse } from 'axios'

const client: AuthClient = createAuthClient({ baseURL: '/api/v1' })

client.defaults.headers.common['x-request-from'] = 'internal'

client.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: unknown) => {
        const status = typeof error === 'object' && error && 'response' in error ? (error as any).response?.status : undefined
        if (status === 401 && typeof window !== 'undefined') {
            const isAuthRoute = window.location.pathname.startsWith('/auth')
            if (!isAuthRoute) {
                window.location.href = '/auth'
            }
        }
        return Promise.reject(error)
    }
)

export default client
