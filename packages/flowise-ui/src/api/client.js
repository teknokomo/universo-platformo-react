import { createAuthClient } from '@universo/auth-frt'
import { baseURL } from '@flowise/template-mui'

const apiClient = createAuthClient({ baseURL: `${baseURL}/api/v1` })

apiClient.defaults.headers.common['x-request-from'] = 'internal'

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error?.response?.status === 401) {
            const isAuthRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/auth')
            if (!isAuthRoute) {
                window.location.href = '/auth'
            }
        }
        return Promise.reject(error)
    }
)

export default apiClient
