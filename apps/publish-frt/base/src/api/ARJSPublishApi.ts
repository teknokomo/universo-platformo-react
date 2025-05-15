// Universo Platformo | API client for publishing AR.js applications
import axios, { AxiosError } from 'axios'
import { ARJSPublicationRequest, ARJSPublicationResponse, UPDLPublicationData } from '../interfaces/UPDLTypes'
import { getAuthHeaders } from '../services/api'

// Universo Platformo | Универсальное определение базового URL API
// В режиме разработки используем относительный путь, так как UI и API на одном домене (через proxy Vite).
// Для production или явного указания используем переменную окружения VITE_API_HOST.
// Если VITE_API_HOST не задан, а окружение не 'development', по умолчанию пустая строка (относительный путь).
const getApiBaseUrl = () => {
    try {
        // @ts-ignore - игнорируем ошибку для import.meta.env
        if (import.meta.env && import.meta.env.DEV) {
            // В режиме разработки через Vite Dev Server
            return window.location.origin
        }

        // @ts-ignore
        const configuredHost = import.meta.env && import.meta.env.VITE_API_HOST
        if (configuredHost) {
            return configuredHost
        }

        // Если мы здесь, то мы в production и нет явно заданного хоста
        return window.location.origin
    } catch (error) {
        console.warn('Error determining API base URL, falling back to origin:', error)
        return window.location.origin
    }
}

// Получаем базовый URL при инициализации модуля
const API_BASE_URL = getApiBaseUrl()
// Universo Platformo | Log the final base URL for clarity, especially during development
console.log('🌍 [ARJSPublishApi] Final API_BASE_URL for requests:', API_BASE_URL)

/**
 * API-клиент для работы с публикацией проектов AR.js
 */
export class ARJSPublishApi {
    /**
     * Получает заголовки авторизации и добавляет их к переданным заголовкам
     * @param headers Существующие заголовки (опционально)
     * @returns Объединенные заголовки с авторизацией
     */
    private static getHeaders(headers: Record<string, string> = {}): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
            ...headers
        }
    }

    /**
     * Создает новую публикацию AR.js
     * @param request Запрос на создание публикации
     * @returns Информация о созданной публикации
     */
    static async publishARJS(request: ARJSPublicationRequest): Promise<ARJSPublicationResponse> {
        try {
            // Universo Platformo | Corrected API URL with /api/v1 prefix
            const apiUrl = `${API_BASE_URL}/api/v1/publish/arjs`
            console.log('🚀 [FRT ARJSPublishApi] Attempting to publish AR.js. URL:', apiUrl, 'Request:', request)
            const response = await axios.post<ARJSPublicationResponse>(apiUrl, request, {
                headers: this.getHeaders()
            })
            console.log('✅ [FRT ARJSPublishApi] Publication response:', response.data)
            return response.data
        } catch (error: unknown) {
            // Проверка на AxiosError
            if (axios.isAxiosError(error)) {
                console.error(
                    '❌ [FRT ARJSPublishApi] Error publishing AR.js project:',
                    error.response?.data || error.message,
                    error.config
                )

                // Более детальная обработка ошибок
                if (error.response) {
                    const errorMessage = error.response.data?.error || error.response.statusText || error.message
                    console.error('[ARJSPublishApi] Server response error:', errorMessage)
                    throw new Error(`Publication failed: ${errorMessage}`)
                }
            } else {
                // Обработка не-Axios ошибок
                console.error(
                    '❌ [FRT ARJSPublishApi] Non-Axios error publishing AR.js project:',
                    error instanceof Error ? error.message : 'Unknown error'
                )
            }

            throw error
        }
    }

    /**
     * Получает список опубликованных AR.js проектов для указанного chatflow
     * @param chatflowId Идентификатор chatflow
     * @returns Массив публикаций
     */
    static async getPublishedARJSProjects(chatflowId: string): Promise<ARJSPublicationResponse[]> {
        try {
            // Universo Platformo | Corrected API URL with /api/v1 prefix
            const apiUrl = `${API_BASE_URL}/api/v1/publish/arjs/chatflow/${chatflowId}`
            console.log('🚀 [FRT ARJSPublishApi] Attempting to get published AR.js projects. URL:', apiUrl)
            const response = await axios.get<ARJSPublicationResponse[]>(apiUrl, {
                headers: this.getHeaders()
            })
            console.log('✅ [FRT ARJSPublishApi] Get published projects response:', response.data)
            return response.data
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                console.error(
                    '❌ [FRT ARJSPublishApi] Error getting published AR.js projects:',
                    error.response?.data || error.message,
                    error.config
                )
            } else {
                console.error(
                    '❌ [FRT ARJSPublishApi] Non-Axios error getting published AR.js projects:',
                    error instanceof Error ? error.message : 'Unknown error'
                )
            }
            throw error
        }
    }

    /**
     * Получает данные для публикации по id публикации
     * @param publicationId Идентификатор публикации
     * @returns Данные публикации с UPDL сценой
     */
    static async getPublicationData(publicationId: string): Promise<UPDLPublicationData> {
        try {
            const apiBaseUrlToUse = getApiBaseUrl()
            // Universo Platformo | Corrected API URL with /api/v1 prefix for public data endpoint
            const publicationUrl = `${apiBaseUrlToUse}/api/v1/publish/arjs/public/${publicationId}`

            console.log('🚀 [FRT ARJSPublishApi] Attempting to get publication data. URL:', publicationUrl)
            console.log('📄 [FRT ARJSPublishApi] Current location for context:', window.location.href)

            // Для публичных данных не требуются заголовки авторизации
            const response = await axios.get<UPDLPublicationData>(publicationUrl, {
                // Добавляем заголовки для предотвращения кэширования
                headers: {
                    'Cache-Control': 'no-cache',
                    Pragma: 'no-cache',
                    Expires: '0'
                }
            })
            console.log('[ARJSPublishApi] Publication data retrieved:', response.data)
            return response.data
        } catch (error: unknown) {
            console.error('[ARJSPublishApi] Error getting publication data:', error instanceof Error ? error.message : 'Unknown error')

            // Более детальная обработка ошибок
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 404) {
                    throw new Error('Publication not found')
                } else if (error.response) {
                    const errorData = error.response.data
                    throw new Error(errorData?.error || `Failed to load publication data: ${error.response.statusText}`)
                }
            }

            throw error
        }
    }

    /**
     * Удаляет публикацию AR.js
     * @param publicationId Идентификатор публикации
     * @returns Результат удаления
     */
    static async deletePublication(publicationId: string): Promise<{ success: boolean }> {
        try {
            // Universo Platformo | Corrected API URL with /api/v1 prefix
            const apiUrl = `${API_BASE_URL}/api/v1/publish/arjs/${publicationId}`
            console.log('🚀 [FRT ARJSPublishApi] Attempting to delete publication. URL:', apiUrl)
            const response = await axios.delete<{ success: boolean }>(apiUrl, {
                headers: this.getHeaders()
            })
            console.log('✅ [FRT ARJSPublishApi] Delete publication response:', response.data)
            return response.data
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                console.error('❌ [FRT ARJSPublishApi] Error deleting publication:', error.response?.data || error.message, error.config)
            } else {
                console.error(
                    '❌ [FRT ARJSPublishApi] Non-Axios error deleting publication:',
                    error instanceof Error ? error.message : 'Unknown error'
                )
            }
            throw error
        }
    }

    /**
     * Обновляет параметры публикации AR.js
     * @param publicationId Идентификатор публикации
     * @param data Новые данные публикации
     * @returns Обновленная информация публикации
     */
    static async updatePublication(publicationId: string, data: Partial<ARJSPublicationRequest>): Promise<ARJSPublicationResponse> {
        try {
            // Universo Platformo | Corrected API URL with /api/v1 prefix
            const apiUrl = `${API_BASE_URL}/api/v1/publish/arjs/${publicationId}`
            console.log('🚀 [FRT ARJSPublishApi] Attempting to update publication. URL:', apiUrl, 'Data:', data)
            const response = await axios.patch<ARJSPublicationResponse>(apiUrl, data, {
                headers: this.getHeaders()
            })
            console.log('✅ [FRT ARJSPublishApi] Update publication response:', response.data)
            return response.data
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                console.error('❌ [FRT ARJSPublishApi] Error updating publication:', error.response?.data || error.message, error.config)
            } else {
                console.error(
                    '❌ [FRT ARJSPublishApi] Non-Axios error updating publication:',
                    error instanceof Error ? error.message : 'Unknown error'
                )
            }
            throw error
        }
    }
}
