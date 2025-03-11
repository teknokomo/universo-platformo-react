import axios from 'axios'

// Если переменная задана, то ожидается, что она не содержит '/api/v1', и мы добавляем его сами.
// Если переменная не задана, используем '/api/v1' по умолчанию.
const base = process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL : ''
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
            // Можно добавить обработку ошибки авторизации, например, перенаправление на страницу логина
            // window.location.href = '/auth'
        }
        return Promise.reject(error)
    }
)

export default api
