import axios from 'axios'

const base = import.meta.env.VITE_API_BASE_URL || ''
const baseURL = `${base}/api/v1`

const api = axios.create({
    baseURL,
    withCredentials: true
})

api.interceptors.request.use(
    (config) => {
        config.withCredentials = true
        return config
    },
    (error) => Promise.reject(error)
)

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            const isAuthRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/auth')
            if (!isAuthRoute) {
                window.location.href = '/auth'
            }
        }
        return Promise.reject(error)
    }
)

export default api
