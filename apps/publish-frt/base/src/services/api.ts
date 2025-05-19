// Universo Platformo | Publication API Service
// Service for interacting with the publication backend API

import axios from 'axios'
import { publishARJSProject } from '../api/updlApi'
import { MarkerType } from '../features/arjs/ARJSExporter'
import { getAuthHeaders, safeRequest, extractIdsFromUrl, getCurrentUrlIds } from './apiUtils'

/**
 * Get chatflow by ID
 * @param id - ID of the chatflow
 * @param unikId - ID of the Unik the chatflow belongs to
 */
export const getChatflow = async (id: string, unikId?: string) => {
    // Если unikId не передан, попробуем извлечь его из URL
    if (!unikId && typeof window !== 'undefined') {
        const urlIds = getCurrentUrlIds()
        if (urlIds.unikId) {
            console.log('[getChatflow] No unikId provided, using unikId from URL:', urlIds.unikId)
            unikId = urlIds.unikId
        }
    }

    if (!unikId) {
        console.error('[getChatflow] Critical error: unikId is still missing after attempt to get from URL')
        throw new Error('Unik ID is required to fetch chatflow')
    }

    // Новый endpoint с unikId
    const endpoint = `/api/v1/uniks/${unikId}/chatflows/${id}`
    console.log('[getChatflow] (FIXED) Fetching chatflow using endpoint:', endpoint, 'unikId:', unikId)
    try {
        // Используем safeRequest
        const result = await safeRequest(endpoint)
        console.log('[getChatflow] (FIXED) Successfully got chatflow:', result?.name)
        return result
    } catch (error: any) {
        console.error(`[getChatflow] (FIXED) Error fetching chatflow from ${endpoint}:`, error)
        throw error
    }
}

// Реэкспортируем утилиты из apiUtils для обратной совместимости
export { getAuthHeaders, safeRequest, extractIdsFromUrl, getCurrentUrlIds }

/**
 * Publish an AR.js flow
 * @param flowId Flow ID to publish
 * @param options Publishing options
 * @returns Publication result
 */
export const publishARJSFlow = async (flowId: string, options: any = {}) => {
    console.log('📢 [publishARJSFlow] Called with flowId:', flowId, 'options:', options)

    // Universo Platformo | Проверяем наличие unikId в options
    if (!options.unikId && typeof window !== 'undefined') {
        const urlIds = getCurrentUrlIds()
        if (urlIds.unikId) {
            console.log('📢 [publishARJSFlow] No unikId provided in options, using from URL:', urlIds.unikId)
            options.unikId = urlIds.unikId
        }
    }

    if (!options.unikId) {
        console.error('📢 [publishARJSFlow] Critical error: No unikId available in options or URL')
        return {
            success: false,
            error: 'Missing unikId, cannot publish AR.js project'
        }
    }

    try {
        // Получаем необходимые данные для публикации
        let flowData = null
        let htmlContent = null

        try {
            // Пытаемся получить данные о flow через API
            console.log('📢 [publishARJSFlow] Attempting to fetch chatflow data using unikId:', options.unikId)

            try {
                flowData = await getChatflow(flowId, options.unikId)
                console.log('📢 [publishARJSFlow] Successfully fetched flowData:', flowData?.name)
            } catch (fetchError) {
                console.warn('📢 [publishARJSFlow] Failed to fetch chatflow data via API, using direct parameters:', fetchError)

                // Создаем минимальный flowData на основе переданных параметров
                flowData = {
                    id: flowId,
                    name: options.title || 'AR.js Experience',
                    description: options.description || 'Created with Universo Platformo',
                    flowData: options.flowData || '{"nodes":[],"edges":[]}',
                    deployed: true,
                    isPublic: options.isPublic !== undefined ? options.isPublic : true,
                    updatedAt: new Date().toISOString()
                }
            }

            // Динамически импортируем экспортер и генератор HTML
            const { ARJSExporter } = await import('../features/arjs/ARJSExporter')
            const { generateARJSHTMLLocally } = await import('../api/updlApi')

            // Создаем экземпляр экспортера
            const exporter = new ARJSExporter()

            // Определяем правильные настройки маркера
            let markerTypeToUse: MarkerType = MarkerType.PATTERN // значение по умолчанию
            let markerValueToUse = options.marker || 'hiro'

            if (options.markerType === 'preset') {
                markerTypeToUse = MarkerType.PATTERN
                markerValueToUse = options.marker || 'hiro'
            } else if (options.markerType === 'pattern') {
                markerTypeToUse = MarkerType.PATTERN
                markerValueToUse = options.marker || ''
            } else if (options.markerType === 'barcode') {
                markerTypeToUse = MarkerType.BARCODE
                markerValueToUse = options.marker || '0'
            } else if (options.markerType === 'custom') {
                markerTypeToUse = MarkerType.CUSTOM
                markerValueToUse = options.marker || ''
            }

            // Universo Platformo | Generate HTML
            try {
                htmlContent = exporter.generateHTML(flowData, {
                    title: options.title || flowData.name || 'AR.js Experience',
                    markerType: markerTypeToUse,
                    markerValue: markerValueToUse
                })
                console.log('📢 [publishARJSFlow] Successfully generated HTML, length:', htmlContent.length)
            } catch (htmlError) {
                console.error('📢 [publishARJSFlow] Error generating HTML with exporter:', htmlError)

                // Universo Platformo | Try to create HTML using the function from updlApi
                htmlContent = generateARJSHTMLLocally(flowData, {
                    title: options.title || flowData.name,
                    markerType: options.markerType,
                    markerValue: options.marker
                })
                console.log('📢 [publishARJSFlow] Generated fallback HTML with generateARJSHTMLLocally')
            }
        } catch (processError) {
            console.error('📢 [publishARJSFlow] Error processing flow data:', processError)

            // Universo Platformo | Create a basic HTML with a red cube in case of an error
            htmlContent = `
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
                    <!-- Fallback generated due to error while processing flow data -->
                </body>
                </html>
            `
            console.log('📢 [publishARJSFlow] Created basic fallback HTML')
        }

        // Universo Platformo | Prepare the data for publication
        const requestData = {
            chatflowId: flowId,
            title: options.title || flowData?.name || 'AR.js Experience',
            html: htmlContent,
            markerType: options.markerType || 'preset',
            markerValue: options.marker || 'hiro',
            isPublic: options.isPublic !== undefined ? options.isPublic : true,
            generationMode: 'streaming'
        }

        // Universo Platformo | Call the API to publish the content
        console.log('📢 [publishARJSFlow] Calling publishARJSProject with request data')

        // Вызываем API для публикации с нашими данными
        const result = await publishARJSProject(requestData)
        console.log('📢 [publishARJSFlow] Publication successful:', result)

        // Возвращаем результат в формате PublishResult для совместимости
        return {
            success: true,
            publishedUrl: result.url || result.publicUrl || '',
            id: result.publicationId || result.id,
            url: result.url || result.publicUrl || '',
            title: options.title || flowData?.name || 'AR.js Experience'
        }
    } catch (error) {
        console.error('📢 [publishARJSFlow] Error publishing AR.js project:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to publish AR.js project',
            publishedUrl: '',
            id: '',
            url: ''
        }
    }
}

/**
 * Add a Unik ID to a URL if it doesn't already have one
 * @param url Original URL
 * @param unikId Unik ID to add
 * @returns Updated URL with Unik ID
 */
export const ensureUnikIdInUrl = (url: string, unikId: string) => {
    if (!url || !unikId) return url

    // Проверяем, есть ли уже unikId в URL
    if (url.includes(`/uniks/${unikId}/`)) {
        return url // URL уже содержит правильный unikId
    }

    // Обрабатываем разные форматы URL
    // 1. /api/v1/chatflows/X => /api/v1/uniks/UNIK_ID/chatflows/X
    if (url.startsWith('/api/v1/chatflows/')) {
        return url.replace('/api/v1/chatflows/', `/api/v1/uniks/${unikId}/chatflows/`)
    }

    // 2. /api/v1/something/else => /api/v1/uniks/UNIK_ID/something/else
    if (url.startsWith('/api/v1/')) {
        return `/api/v1/uniks/${unikId}${url.substring('/api/v1'.length)}`
    }

    // Для других URL просто добавляем параметр unikId
    const hasQueryParams = url.includes('?')
    const separator = hasQueryParams ? '&' : '?'
    return `${url}${separator}unikId=${unikId}`
}

export interface PublishResult {
    /**
     * Indicates if publishing was successful
     */
    success: boolean

    /**
     * URL where the published content can be accessed
     * Only present when success is true
     */
    publishedUrl: string

    /**
     * Error message if publishing failed
     * Only present when success is false
     */
    error?: string

    /**
     * Additional metadata about the publishing operation
     */
    metadata?: Record<string, any>

    /**
     * Original API response fields (for backward compatibility)
     */
    id: string
    url: string
    title?: string
}

export interface MarkerInfo {
    id: string
    name: string
    description?: string
    imageUrl?: string
}
