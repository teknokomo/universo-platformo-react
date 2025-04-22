import axios from 'axios'

// Universo Platformo | If the variable is set, it is expected not to contain '/api/v1', and we add it ourselves.
// If the variable is not set, use '/api/v1' by default.
const base = import.meta.env.VITE_API_BASE_URL || ''
const baseURL = `${base}/api/v1`

const api = axios.create({
    baseURL
})

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token')
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    (error) => Promise.reject(error)
)

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Universo Platformo | Authorization error handling can be added here, e.g., redirecting to the login page
            // window.location.href = '/auth'
        }
        return Promise.reject(error)
    }
)

export default api
