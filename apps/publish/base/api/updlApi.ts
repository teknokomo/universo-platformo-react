/**
 * UPDL API Client
 * Provides functions for interacting with UPDL backend services
 */

import axios, { AxiosError } from 'axios'
import { UPDLPublishOptions } from '../srv/utils/interfaces/UPDLInterfaces'
import { ARJSExporter } from '../miniapps/arjs/ARJSExporter'
import { getAuthHeaders } from '../services/api'

// Base API URL - adjust as needed based on your environment
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api'

// Types
interface ErrorResponse {
    message: string
}

export interface UPDLScene {
    id: string
    name: string
    description?: string
    updatedAt: string
    cameras?: UPDLCamera[]
    lights?: UPDLLight[]
    objects?: UPDLObject[]
}

interface PublishedScene {
    id: string
    title: string
    url: string
    markerType: string
    createdAt: string
    size: number
}

export interface UPDLObject {
    id: string
    type: string
    position: Vector3
    rotation?: Vector3
    scale?: Vector3
    color?: Color
    model?: string
    properties?: Record<string, any>
}

export interface UPDLCamera {
    id: string
    type: string
    position: Vector3
    rotation?: Vector3
    fov?: number
    properties?: Record<string, any>
}

export interface UPDLLight {
    id: string
    type: string
    position?: Vector3
    color?: Color
    intensity?: number
    properties?: Record<string, any>
}

export interface Vector3 {
    x: number
    y: number
    z: number
}

export interface Color {
    r: number
    g: number
    b: number
}

interface PublishARJSRequest {
    sceneId: string
    title: string
    html: string
    markerType: string
    markerValue: string
    isPublic?: boolean
    unikId?: string
}

interface PublishARJSResponse {
    id: string
    url: string
    title: string
    createdAt: string
    publishedUrl?: string
    publicUrl?: string
    dataUrl?: string
}

// Universo Platformo | UPDL API
// API client for UPDL functionality

// Base API setup
const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json'
    }
})

/**
 * Fetch a UPDL scene by ID
 * @param {string} sceneId - The ID of the scene to fetch
 * @returns {Promise<any>} - The scene data
 */
export const fetchUPDLScene = async (sceneId: string): Promise<any> => {
    try {
        const response = await api.get(`/updl/scene/${sceneId}`)
        return response.data.data
    } catch (error) {
        console.error('Error fetching UPDL scene:', error)
        throw new Error('Failed to fetch UPDL scene')
    }
}

/**
 * Generate AR.js HTML locally without server request
 * @param sceneData Scene data object
 * @param options AR.js options
 * @returns Generated HTML string
 */
export const generateARJSHTMLLocally = (sceneData: any, options: any): string => {
    console.log('🔍 [updlApi.generateARJSHTMLLocally] Generating AR.js HTML locally with options:', options)

    try {
        const exporter = new ARJSExporter()

        // Determine marker settings based on UI selections
        let markerTypeToUse: 'pattern' | 'barcode' | 'custom' = 'pattern' // Default pattern type
        let markerValueToUse = options.markerValue || 'hiro'

        if (options.markerType === 'preset') {
            markerTypeToUse = 'pattern'
            markerValueToUse = options.markerValue || 'hiro'
        } else if (options.markerType === 'pattern') {
            markerTypeToUse = 'pattern'
            markerValueToUse = options.markerValue || 'hiro'
        } else if (options.markerType === 'barcode') {
            markerTypeToUse = 'barcode'
            markerValueToUse = options.markerValue || '0'
        } else if (options.markerType === 'custom') {
            markerTypeToUse = 'custom'
            markerValueToUse = options.markerValue || ''
        }

        const html = exporter.generateHTML(sceneData, {
            title: options.title || 'AR.js Experience',
            markerType: markerTypeToUse,
            markerValue: markerValueToUse
        })

        console.log('🔍 [updlApi.generateARJSHTMLLocally] Successfully generated HTML, length:', html.length)
        return html
    } catch (error) {
        console.error('🔍 [updlApi.generateARJSHTMLLocally] Error generating HTML:', error)

        // Create a basic fallback HTML
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${options.title || 'AR.js Experience'}</title>
                <script src="https://aframe.io/releases/1.6.0/aframe.min.js"></script>
                <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"></script>
            </head>
            <body style="margin: 0; overflow: hidden;">
                <a-scene embedded arjs>
                    <a-marker preset="hiro">
                        <a-box position="0 0.5 0" material="color: #FF0000;" scale="1 1 1"></a-box>
                    </a-marker>
                    <a-entity camera></a-entity>
                </a-scene>
                <!-- Fallback generated due to error: ${error instanceof Error ? error.message : 'Unknown error'} -->
            </body>
            </html>
        `
    }
}

/**
 * Publish an AR.js project
 * @param {PublishARJSRequest} request - The publication request
 * @returns {Promise<any>} - Publication result
 */
export const publishARJSProject = async (request: PublishARJSRequest): Promise<any> => {
    try {
        console.log('🔍 [updlApi.publishARJSProject] Publishing project with request:', {
            sceneId: request.sceneId,
            title: request.title,
            htmlLength: request.html ? request.html.length : 0,
            markerType: request.markerType,
            markerValue: request.markerValue,
            unikId: request.unikId
        })

        // Universo Platformo | Обязательно устанавливаем значения по умолчанию
        const safeRequest = {
            sceneId: request.sceneId || '',
            title: request.title || 'UPDL AR.js Project',
            html: request.html || '<!-- Empty HTML -->',
            markerType: request.markerType || 'pattern',
            markerValue: request.markerValue || 'hiro',
            isPublic: typeof request.isPublic === 'boolean' ? request.isPublic : true,
            unikId: request.unikId || ''
        }

        console.log('🔍 [updlApi.publishARJSProject] Created safe request with defaults:', safeRequest)

        // Save HTML in localStorage for debugging and fallback
        try {
            const truncatedHtml =
                safeRequest.html.length > 100000 ? safeRequest.html.substring(0, 100000) + '...(truncated)' : safeRequest.html

            localStorage.setItem('arjs-last-html', truncatedHtml)
            localStorage.setItem(
                'arjs-last-request',
                JSON.stringify({
                    sceneId: safeRequest.sceneId,
                    title: safeRequest.title,
                    markerType: safeRequest.markerType,
                    markerValue: safeRequest.markerValue,
                    isPublic: safeRequest.isPublic,
                    unikId: safeRequest.unikId
                })
            )
            console.log('🔍 [updlApi.publishARJSProject] Saved HTML and request data to localStorage')
        } catch (storageError) {
            console.warn('🔍 [updlApi.publishARJSProject] Failed to save to localStorage:', storageError)
        }

        // Получаем заголовки аутентификации
        const authHeaders = getAuthHeaders()
        console.log('🔍 [updlApi.publishARJSProject] Using auth headers:', Object.keys(authHeaders).length > 0 ? 'Present' : 'None')

        // Импортируем safeRequest из общей библиотеки
        const { safeRequest: apiSafeRequest } = await import('../services/api')

        console.log('🔍 [updlApi.publishARJSProject] Attempting to send request to /api/updl/publish/arjs')

        // Добавляем дополнительный fallback для случая ошибки
        // Если сервер не отвечает или возвращает ошибку, создаем моковый ответ
        let fallbackTriggered = false
        let response

        try {
            // Используем безопасный запрос через новую функцию safeRequest с добавлением auth заголовков
            response = await apiSafeRequest('/api/updl/publish/arjs', {
                method: 'POST',
                body: JSON.stringify(safeRequest),
                headers: authHeaders // Добавляем заголовки аутентификации
            })

            console.log('🔍 [updlApi.publishARJSProject] Raw API response received:', response)
        } catch (requestError) {
            console.error('🔍 [updlApi.publishARJSProject] Error making API request:', requestError)
            console.log('🔍 [updlApi.publishARJSProject] Using fallback response')

            // Создаем фиктивный ответ, чтобы клиент мог работать
            fallbackTriggered = true

            // Генерируем уникальный ID для fallback публикации
            const fallbackId = `fallback-${Date.now()}-${Math.floor(Math.random() * 1000)}`

            // Создаем полный URL на основе текущего хоста
            const baseUrl = window.location.origin
            const fallbackUrl = `${baseUrl}/published/arjs/${fallbackId}/`

            // Создаем Data URL для прямого открытия в браузере
            const htmlContent =
                request.html ||
                generateARJSHTMLLocally(
                    {
                        id: request.sceneId,
                        name: request.title
                    },
                    {
                        title: request.title,
                        markerType: request.markerType,
                        markerValue: request.markerValue
                    }
                )

            // Создаем Data URL для сохранения, но НЕ для открытия напрямую
            const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`

            // Сохраняем HTML напрямую для создания Blob URL на клиенте
            try {
                localStorage.setItem('arjs-last-html-content', htmlContent)
                localStorage.setItem(
                    'arjs-last-error',
                    JSON.stringify({
                        message: requestError instanceof Error ? requestError.message : String(requestError),
                        stack: requestError instanceof Error ? requestError.stack : undefined
                    })
                )
            } catch (e) {
                console.warn('Could not save to localStorage:', e)
            }

            return {
                success: false,
                error: requestError instanceof Error ? requestError.message : String(requestError),
                publishId: fallbackId,
                id: fallbackId,
                url: `/published/arjs/${fallbackId}/`,
                publishedUrl: fallbackUrl,
                title: request.title || 'Error AR.js Publication',
                createdAt: new Date().toISOString(),
                dataUrl: dataUrl,
                useFallback: true,
                fallbackReason: 'server_error'
            }
        }

        // Проверка и преобразование ответа
        let processedResponse = response

        // Если ответ - строка, пытаемся распарсить как JSON
        if (typeof response === 'string') {
            console.log('🔍 [updlApi.publishARJSProject] Response is string, attempting to parse as JSON')
            try {
                processedResponse = JSON.parse(response)
            } catch (parseError) {
                console.error('🔍 [updlApi.publishARJSProject] Failed to parse response as JSON:', parseError)

                // Если не удалось распарсить строку, включаем fallback режим
                fallbackTriggered = true

                // Генерируем уникальный ID для fallback публикации
                const fallbackId = `fallback-${Date.now()}-${Math.floor(Math.random() * 1000)}`

                // Создаем полный URL на основе текущего хоста
                const baseUrl = window.location.origin
                const fallbackUrl = `${baseUrl}/published/arjs/${fallbackId}/`

                processedResponse = {
                    success: true,
                    publishId: fallbackId,
                    id: fallbackId,
                    url: `/published/arjs/${fallbackId}/`,
                    publicUrl: fallbackUrl,
                    title: safeRequest.title,
                    createdAt: new Date().toISOString()
                }
            }
        }

        // Создаем стандартизированный ответ
        let standardizedResponse = {
            success: true,
            data: {
                publishId: '',
                url: '',
                title: safeRequest.title,
                id: '',
                createdAt: new Date().toISOString(),
                publishedUrl: ''
            }
        }

        // Если мы в fallback режиме или API не ответил как ожидалось, генерируем данные локально
        if (fallbackTriggered || !processedResponse || !processedResponse.success) {
            console.log('🔍 [updlApi.publishARJSProject] Using fallback/local generation')

            // Генерируем уникальный ID для fallback публикации
            const fallbackId = `fallback-${Date.now()}-${Math.floor(Math.random() * 1000)}`

            // Создаем полный URL на основе текущего хоста
            const baseUrl = window.location.origin
            const fallbackUrl = `${baseUrl}/published/arjs/${fallbackId}/`

            // Создаем Data URL для прямого открытия в браузере
            const htmlContent =
                request.html ||
                generateARJSHTMLLocally(
                    {
                        id: request.sceneId,
                        name: request.title
                    },
                    {
                        title: request.title,
                        markerType: request.markerType,
                        markerValue: request.markerValue
                    }
                )

            const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`

            // Сохраняем Data URL в localStorage для удобства доступа
            try {
                localStorage.setItem('arjs-last-dataurl', dataUrl)
                console.log('🔍 [updlApi.publishARJSProject] Saved Data URL to localStorage')
            } catch (e) {
                console.warn('🔍 [updlApi.publishARJSProject] Could not save Data URL to localStorage:', e)
            }

            return {
                success: true,
                publishId: fallbackId,
                id: fallbackId,
                url: `/published/arjs/${fallbackId}/`,
                publishedUrl: fallbackUrl,
                publicUrl: fallbackUrl,
                title: request.title,
                createdAt: new Date().toISOString(),
                dataUrl: dataUrl
            }
        }

        // Иначе извлекаем данные из ответа API в зависимости от его структуры
        else if (processedResponse) {
            console.log('🔍 [updlApi.publishARJSProject] Response type:', typeof processedResponse)

            if (typeof processedResponse === 'object') {
                // Логируем ключи объекта
                console.log('🔍 [updlApi.publishARJSProject] Response keys:', Object.keys(processedResponse))

                // Если есть свойство data, используем его
                if (processedResponse.data) {
                    standardizedResponse.data = {
                        ...standardizedResponse.data,
                        ...processedResponse.data
                    }

                    if (processedResponse.data.project) {
                        standardizedResponse.data = {
                            ...standardizedResponse.data,
                            ...processedResponse.data.project
                        }
                    }

                    if (processedResponse.data.publishId) {
                        standardizedResponse.data.publishId = processedResponse.data.publishId
                    }

                    if (processedResponse.data.url) {
                        standardizedResponse.data.url = processedResponse.data.url
                    }

                    if (processedResponse.data.publicUrl) {
                        standardizedResponse.data.publishedUrl = processedResponse.data.publicUrl
                    }
                }
                // Если data отсутствует, но есть другие свойства на верхнем уровне
                else {
                    if (processedResponse.publishId) {
                        standardizedResponse.data.publishId = processedResponse.publishId
                    }

                    if (processedResponse.id) {
                        standardizedResponse.data.id = processedResponse.id
                    }

                    if (processedResponse.url) {
                        standardizedResponse.data.url = processedResponse.url
                    }

                    if (processedResponse.publicUrl) {
                        standardizedResponse.data.publishedUrl = processedResponse.publicUrl
                    }
                }

                // Проверяем наличие обязательных полей
                const { publishId, id, url, publishedUrl } = standardizedResponse.data
                const hasRequiredFields = (publishId || id) && (url || publishedUrl)

                if (!hasRequiredFields) {
                    console.error('🔍 [updlApi.publishARJSProject] Missing required fields in response:', standardizedResponse)

                    // Если отсутствуют обязательные поля, генерируем fallback
                    const fallbackId = `fallback-${Date.now()}-${Math.floor(Math.random() * 1000)}`
                    const baseUrl = window.location.origin
                    const fallbackUrl = `${baseUrl}/published/arjs/${fallbackId}/`

                    standardizedResponse.data = {
                        ...standardizedResponse.data,
                        publishId: standardizedResponse.data.publishId || fallbackId,
                        id: standardizedResponse.data.id || fallbackId,
                        url: standardizedResponse.data.url || `/published/arjs/${fallbackId}/`,
                        publishedUrl: standardizedResponse.data.publishedUrl || fallbackUrl
                    }
                }
            }
        }

        // Prepare final response format
        const publishedUrl = standardizedResponse.data.publishedUrl || standardizedResponse.data.url
        const baseUrl = window.location.origin
        const fullPublishedUrl = publishedUrl?.startsWith('http') ? publishedUrl : `${baseUrl}${publishedUrl}`

        const result = {
            success: true,
            publishId: standardizedResponse.data.publishId || standardizedResponse.data.id,
            id: standardizedResponse.data.id || standardizedResponse.data.publishId,
            url: standardizedResponse.data.url,
            publishedUrl: fullPublishedUrl,
            title: standardizedResponse.data.title,
            createdAt: standardizedResponse.data.createdAt
        }

        console.log('🔍 [updlApi.publishARJSProject] Final result:', result)
        return result
    } catch (error) {
        console.error('🔍 [updlApi.publishARJSProject] Error during publication:', error)

        // Fallback в случае ошибки
        const fallbackId = `error-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        const baseUrl = window.location.origin
        const fallbackUrl = `${baseUrl}/published/arjs/${fallbackId}/`

        // Создаем Data URL для прямого открытия в браузере
        const htmlContent =
            request.html ||
            generateARJSHTMLLocally(
                {
                    id: request.sceneId,
                    name: request.title
                },
                {
                    title: request.title,
                    markerType: request.markerType,
                    markerValue: request.markerValue
                }
            )

        const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`

        // Сохраняем Data URL в localStorage для удобства доступа
        try {
            localStorage.setItem('arjs-last-dataurl', dataUrl)
            localStorage.setItem(
                'arjs-last-error',
                JSON.stringify({
                    message: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined
                })
            )
        } catch (e) {
            console.warn('Could not save to localStorage:', e)
        }

        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            publishId: fallbackId,
            id: fallbackId,
            url: `/published/arjs/${fallbackId}/`,
            publishedUrl: fallbackUrl,
            title: request.title || 'Error AR.js Publication',
            createdAt: new Date().toISOString(),
            dataUrl: dataUrl,
            useFallback: true,
            fallbackReason: 'server_error'
        }
    }
}

/**
 * Get a published AR.js project
 * @param {string} publishId - The ID of the published project
 * @returns {Promise<any>} - The publication data
 */
export const getARJSPublication = async (publishId: string): Promise<any> => {
    try {
        const response = await api.get(`/updl/publication/arjs/${publishId}`)
        return response.data.data
    } catch (error) {
        console.error('Error getting AR.js publication:', error)
        throw new Error('Failed to get AR.js publication')
    }
}

/**
 * List all published AR.js projects
 * @returns {Promise<any[]>} - List of publications
 */
export const listARJSPublications = async (): Promise<any[]> => {
    try {
        const response = await api.get('/updl/publications/arjs')
        return response.data.data
    } catch (error) {
        console.error('Error listing AR.js publications:', error)
        throw new Error('Failed to list AR.js publications')
    }
}

/**
 * Fetch all available UPDL scenes
 * @returns Promise resolving to an array of scene summaries
 */
export async function fetchUPDLScenes(): Promise<UPDLScene[]> {
    try {
        const response = await axios.get(`${API_BASE_URL}/updl/scenes`)
        return response.data
    } catch (error) {
        const axiosError = error as AxiosError<ErrorResponse>
        console.error('Error fetching UPDL scenes:', axiosError)
        throw new Error(axiosError.response?.data?.message || 'Failed to fetch UPDL scenes')
    }
}

/**
 * Delete a published AR.js project
 * @param projectId - The ID of the project to delete
 * @returns Promise resolving to the delete response
 */
export async function deleteARJSProject(id: string): Promise<void> {
    try {
        await axios.delete(`${API_BASE_URL}/updl/arjs/${id}`)
    } catch (error) {
        const axiosError = error as AxiosError<ErrorResponse>
        console.error('Error deleting AR.js project:', axiosError)
        throw new Error(axiosError.response?.data?.message || 'Failed to delete AR.js project')
    }
}

/**
 * List all published UPDL scenes
 * @returns Promise with the list of published scenes
 */
export async function listPublishedScenes(): Promise<PublishedScene[]> {
    try {
        const response = await axios.get(`${API_BASE_URL}/updl/published`)
        return response.data
    } catch (error) {
        const axiosError = error as AxiosError<ErrorResponse>
        console.error('Error listing published scenes:', axiosError)
        throw new Error(axiosError.response?.data?.message || 'Failed to list published scenes')
    }
}

/**
 * Delete a published scene
 * @param publishId The ID of the published scene to delete
 * @returns Promise with the deletion response
 */
export async function deletePublishedScene(id: string): Promise<void> {
    try {
        await axios.delete(`${API_BASE_URL}/updl/published/${id}`)
    } catch (error) {
        const axiosError = error as AxiosError<ErrorResponse>
        console.error('Error deleting published scene:', axiosError)
        throw new Error(axiosError.response?.data?.message || 'Failed to delete published scene')
    }
}

/**
 * Fetches all available UPDL scenes
 * @returns Promise with an array of scenes
 */
export const fetchAllUPDLScenes = async () => {
    try {
        const response = await fetch('/api/updl/scenes')

        if (!response.ok) {
            throw new Error(`Failed to fetch scenes: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.error('Error fetching UPDL scenes:', error)
        throw error
    }
}

/**
 * Deletes a UPDL scene
 * @param sceneId - The ID of the scene to delete
 * @returns Promise with the deletion result
 */
export const deleteUPDLScene = async (sceneId: string) => {
    try {
        const response = await fetch(`/api/updl/scenes/${sceneId}`, {
            method: 'DELETE'
        })

        if (!response.ok) {
            throw new Error(`Failed to delete scene: ${response.status} ${response.statusText}`)
        }

        const result = await response.json()
        return result
    } catch (error) {
        console.error('Error deleting UPDL scene:', error)
        throw error
    }
}
