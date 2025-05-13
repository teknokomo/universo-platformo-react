// Universo Platformo | Base HTTP client for API interactions
import axios from 'axios'
import { API_BASE_URL } from '../configs/constants'

const httpClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
})

httpClient.interceptors.response.use(
    (response) => response,
    (error) => {
        // General error handling
        console.error('API Error:', error)
        return Promise.reject(error)
    }
)

export default httpClient
