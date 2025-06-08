import axios from 'axios'
import { baseURL, ErrorMessage } from '@/store/constant'
import AuthUtils from '@/utils/authUtils'

const apiClient = axios.create({
    baseURL: `${baseURL}/api/v1`,
    headers: {
        'Content-type': 'application/json',
        'x-request-from': 'internal'
    },
    withCredentials: true // Universo Platformo | Enable cookies for refresh token
})

// Universo Platformo | Replaced basic auth with JWT auth
apiClient.interceptors.request.use(function (config) {
    // Get token from localStorage (saved during authentication)
    const token = localStorage.getItem('token')

    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }

    return config
})

// Universo Platformo | Add token refresh mechanism
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config

        // If 401 error and request has not been retried yet
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true

            try {
                // Request to refresh token
                const response = await axios.post(`${baseURL}/api/v1/auth/refresh`, {}, { withCredentials: true })

                // If successful, update token in storage
                if (response.data.accessToken) {
                    localStorage.setItem('token', response.data.accessToken)

                    // Update Authorization in current request
                    originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`
                    return apiClient(originalRequest)
                }
            } catch (refreshError) {
                console.error('Token refresh failed:', refreshError)

                // Redirect to auth page
                window.location.href = '/auth'
                return Promise.reject(error)
            }
        }

        return Promise.reject(error)
    }
)

export default apiClient
