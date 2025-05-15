// Universo Platformo | AR.js specialized publish service
import { publishService, PublicationResult } from './publishService'
import { getAuthHeaders } from './api'
import { ARJSPublishApi } from '../api/ARJSPublishApi'
import { ARJSPublicationRequest } from '../interfaces/UPDLTypes'

// Мы будем использовать тип ARJSPublicationRequest из импорта
// export interface ARJSPublicationParams {
//     chatflowId: string
//     generationMode: string
//     isPublic: boolean
//     projectName: string
//     unikId: string
//     [key: string]: any
// }

/**
 * Сервис для работы с публикацией AR.js контента
 */
export const arjsService = {
    /**
     * Публикация AR.js проекта с помощью прямого API
     * @param params Параметры публикации
     * @returns Результат публикации
     */
    async publishARJS(params: ARJSPublicationRequest): Promise<any> {
        console.log('🔹 [arjsService.publishARJS] Publishing AR.js project:', params)
        try {
            // Используем API-клиент для выполнения запроса к API
            const result = await ARJSPublishApi.publishARJS(params)
            console.log('🔹 [arjsService.publishARJS] Publication successful:', result)
            return result
        } catch (error) {
            console.error('🔹 [arjsService.publishARJS] Publication failed:', error)
            throw error
        }
    },

    /**
     * Сохраняет статус публикации AR.js проекта
     * @param flowId ID потока
     * @param isPublic Флаг публичности
     * @param unikId ID пространства
     * @param options Дополнительные опции (markerType, generationMode и т.д.)
     */
    async saveARJSPublication(
        flowId: string,
        isPublic: boolean,
        unikId: string,
        options: Record<string, any> = {}
    ): Promise<PublicationResult> {
        console.log('🔹 [arjsService.saveARJSPublication] Saving AR.js publication:', {
            flowId,
            isPublic,
            options
        })

        return publishService.savePublicationStatus({
            flowId,
            isPublic,
            unikId,
            technology: 'arjs',
            generationMode: options.generationMode || 'streaming',
            markerType: options.markerType || 'hiro',
            markerValue: options.markerValue || 'hiro',
            ...options
        })
    },

    /**
     * Формирует URL для просмотра AR.js проекта
     * @param flowId ID потока
     */
    getARViewUrl(flowId: string): string {
        return publishService.getPublicUrl(flowId, 'arjs')
    }
}
