// Universo Platformo | Generic publish service for all technologies
import { getAuthHeaders } from './api'

export interface PublicationOptions {
    flowId: string
    isPublic: boolean
    unikId: string
    technology: string
    [key: string]: any // Другие специфичные параметры
}

export interface PublicationResult {
    success: boolean
    publicUrl?: string
    error?: string
    [key: string]: any
}

/**
 * Базовый сервис публикации, который может использоваться для любой технологии
 */
export const publishService = {
    /**
     * Формирует публичную ссылку для проекта на основе технологии
     */
    getPublicUrl(flowId: string, technology: string): string {
        // Технологии преобразуются в сокращенные пути в URL
        const techRoutes: Record<string, string> = {
            arjs: 'ar',
            chatbot: 'chatbot',
            playcanvas: 'play',
            babylonjs: 'babylon',
            aframe: 'vr'
        }

        const route = techRoutes[technology.toLowerCase()] || technology.toLowerCase()
        return `${window.location.origin}/${route}/${flowId}`
    },

    /**
     * Сохраняет информацию о публикации проекта
     */
    async savePublicationStatus(options: PublicationOptions): Promise<PublicationResult> {
        try {
            console.log('📌 [publishService.savePublicationStatus] Saving with options:', options)

            // Получаем токен авторизации
            const authHeaders = getAuthHeaders()

            // Формируем запрос к API
            const response = await fetch('/api/updl/publication/status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders
                },
                body: JSON.stringify(options)
            })

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`)
            }

            const data = await response.json()
            console.log('📌 [publishService.savePublicationStatus] Server response:', data)

            return {
                success: true,
                publicUrl: this.getPublicUrl(options.flowId, options.technology),
                ...data
            }
        } catch (error) {
            console.error('Error saving publication status:', error)

            // Даже при ошибке возвращаем ссылку для клиентской генерации
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                publicUrl: this.getPublicUrl(options.flowId, options.technology)
            }
        }
    }
}
