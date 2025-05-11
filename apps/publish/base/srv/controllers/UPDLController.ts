// Universo Platformo | UPDL Controller
// Controller for UPDL flow publishing to AR.js

import { Request, Response } from 'express'
import * as path from 'path'
import * as fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { utilBuildUPDLforARJS } from '../utils/updlToARJSBuilder'
import { UPDLPublishOptions } from '../utils/interfaces/UPDLInterfaces'

// Добавляем подробное логирование для отладки
console.log('✅ [UPDLController] Модуль инициализирован')

// Simple database mock for storing publications
// In a real implementation, this would use an actual database
const database = {
    arjsPublications: new Map(),

    async createARJSPublication(publication: any) {
        this.arjsPublications.set(publication.id, publication)
        return publication
    },

    async getARJSPublication(id: string) {
        return this.arjsPublications.get(id)
    },

    async listARJSPublications() {
        return Array.from(this.arjsPublications.values())
    }
}

/**
 * Controller for UPDL operations
 */
export class UPDLController {
    /**
     * Get a UPDL scene
     */
    public async getUPDLScene(req: Request, res: Response): Promise<void> {
        try {
            console.log('🔍 [UPDLController.getUPDLScene] Request received:', {
                params: req.params,
                query: req.query,
                headers: req.headers
            })

            const { id } = req.params

            if (!id) {
                console.error('❌ [UPDLController.getUPDLScene] Missing scene ID')
                res.status(400).json({
                    status: 'error',
                    message: 'Missing scene ID'
                })
                return
            }

            // In a real implementation, this would fetch the scene from database
            // For this implementation, we'll use utilBuildUPDLforARJS
            const result = await utilBuildUPDLforARJS(req)
            console.log('🔍 [UPDLController.getUPDLScene] Result:', JSON.stringify(result).substring(0, 500) + '...')

            res.status(200).json({
                status: 'success',
                data: result.updlScene || result.scene
            })
        } catch (error) {
            console.error('❌ [UPDLController.getUPDLScene] Error:', error)
            res.status(500).json({
                status: 'error',
                message: error instanceof Error ? error.message : 'Internal server error'
            })
        }
    }

    /**
     * Publish UPDL project to AR.js
     */
    public async publishUPDLToARJS(req: Request, res: Response): Promise<void> {
        try {
            console.log('📋 [UPDLController.publishUPDLToARJS] Request received:', {
                method: req.method,
                path: req.path,
                originalUrl: req.originalUrl,
                contentType: req.headers['content-type'],
                bodyKeys: req.body ? Object.keys(req.body) : 'No body'
            })

            // Детальное логирование запроса для отладки
            console.log('📋 [UPDLController.publishUPDLToARJS] Headers:', JSON.stringify(req.headers, null, 2))

            // Проверка наличия тела запроса
            if (!req.body) {
                console.error('❌ [UPDLController.publishUPDLToARJS] Request body is empty or undefined')
                res.status(400).json({
                    status: 'error',
                    message: 'Request body is empty or undefined'
                })
                return
            }

            // Проверка валидности JSON
            try {
                const bodyStr = JSON.stringify(req.body)
                console.log(`📋 [UPDLController.publishUPDLToARJS] Request body valid JSON (${bodyStr.length} bytes)`)
            } catch (jsonError) {
                console.error('❌ [UPDLController.publishUPDLToARJS] Invalid JSON in request body:', jsonError)
            }

            const { sceneId, title, html, markerType, markerValue, isPublic = false } = req.body

            console.log('📋 [UPDLController.publishUPDLToARJS] Request params:', {
                sceneId: sceneId ? `Yes (${typeof sceneId})` : 'No',
                title: title ? `${title} (${typeof title})` : 'No',
                hasHtml: html ? `Yes (length: ${html.length}, type: ${typeof html})` : 'No',
                markerType: markerType ? `${markerType} (${typeof markerType})` : 'No',
                markerValue: markerValue ? `${markerValue} (${typeof markerValue})` : 'No',
                isPublic: `${isPublic} (${typeof isPublic})`
            })

            if (!sceneId || !title || !html) {
                console.error('❌ [UPDLController.publishUPDLToARJS] Missing required parameters')
                const missingParams = []
                if (!sceneId) missingParams.push('sceneId')
                if (!title) missingParams.push('title')
                if (!html) missingParams.push('html')

                console.error(`❌ [UPDLController.publishUPDLToARJS] Missing parameters: ${missingParams.join(', ')}`)

                res.status(400).json({
                    status: 'error',
                    message: `Missing required parameters: ${missingParams.join(', ')}`
                })
                return
            }

            // Проверка и установка значений маркера по умолчанию
            const validatedMarkerType = markerType || 'pattern'
            const validatedMarkerValue = markerValue || 'hiro'

            // Логируем информацию о маркере
            console.log('📋 [UPDLController.publishUPDLToARJS] Marker information:', {
                originalType: markerType,
                originalValue: markerValue,
                validatedType: validatedMarkerType,
                validatedValue: validatedMarkerValue,
                wasModified: markerType !== validatedMarkerType || markerValue !== validatedMarkerValue
            })

            try {
                // Пробуем парсить HTML для проверки
                console.log('📋 [UPDLController.publishUPDLToARJS] Проверка HTML:', html.substring(0, 100) + '...')
            } catch (parseError) {
                console.error('❌ [UPDLController.publishUPDLToARJS] Invalid HTML:', parseError)
            }

            // Generate a unique ID for the published project
            const publishId = uuidv4()
            console.log('📋 [UPDLController.publishUPDLToARJS] Generated publishId:', publishId)

            // Ensure the published directory exists
            const publishedDir = path.join(process.cwd(), 'public', 'published')
            if (!fs.existsSync(publishedDir)) {
                console.log('📋 [UPDLController.publishUPDLToARJS] Creating published directory:', publishedDir)
                fs.mkdirSync(publishedDir, { recursive: true })
            }

            // Create the publication directory
            const publishPath = path.join(publishedDir, publishId)
            console.log('📋 [UPDLController.publishUPDLToARJS] Creating publication directory:', publishPath)
            fs.mkdirSync(publishPath, { recursive: true })

            // Write the HTML file
            const htmlPath = path.join(publishPath, 'index.html')
            console.log('📋 [UPDLController.publishUPDLToARJS] Writing HTML file to:', htmlPath)
            fs.writeFileSync(htmlPath, html)

            // Create publication record
            const arjsProject = await database.createARJSPublication({
                id: publishId,
                title,
                sceneId,
                markerType: validatedMarkerType,
                markerValue: validatedMarkerValue,
                isPublic,
                createdAt: new Date()
            })
            console.log('📋 [UPDLController.publishUPDLToARJS] Publication record created:', arjsProject.id)

            // Генерируем публичный URL для доступа к опубликованному проекту
            // Базовый URL берётся из конфигурации или из HTTP заголовков
            const baseUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`
            const publicUrl = `${baseUrl}/published/${publishId}/`
            console.log('📋 [UPDLController.publishUPDLToARJS] Generated URLs:', {
                baseUrl,
                relativeUrl: `/published/${publishId}/`,
                publicUrl
            })

            const response = {
                status: 'success',
                message: 'Project published successfully to AR.js',
                data: {
                    publishId,
                    url: `/published/${publishId}/`,
                    publicUrl: publicUrl,
                    project: arjsProject
                }
            }
            console.log('📋 [UPDLController.publishUPDLToARJS] Sending response:', response)

            res.status(200).json(response)
        } catch (error) {
            console.error('❌ [UPDLController.publishUPDLToARJS] Error:', error)
            res.status(500).json({
                status: 'error',
                message: error instanceof Error ? error.message : 'Internal server error'
            })
        }
    }

    /**
     * Get a published AR.js project
     */
    public async getARJSPublication(req: Request, res: Response): Promise<void> {
        try {
            console.log('🔍 [UPDLController.getARJSPublication] Request received:', {
                params: req.params,
                query: req.query
            })

            const { publishId } = req.params

            if (!publishId) {
                res.status(400).json({
                    status: 'error',
                    message: 'Missing publication ID'
                })
                return
            }

            const publication = await database.getARJSPublication(publishId)

            if (!publication) {
                res.status(404).json({
                    status: 'error',
                    message: 'AR.js publication not found'
                })
                return
            }

            res.status(200).json({
                status: 'success',
                data: publication
            })
        } catch (error) {
            console.error('Error getting AR.js publication:', error)
            res.status(500).json({
                status: 'error',
                message: error instanceof Error ? error.message : 'Internal server error'
            })
        }
    }

    /**
     * List all published AR.js projects
     */
    public async listARJSPublications(req: Request, res: Response): Promise<void> {
        try {
            console.log('🔍 [UPDLController.listARJSPublications] Request received')

            const publications = await database.listARJSPublications()

            res.status(200).json({
                status: 'success',
                data: publications
            })
        } catch (error) {
            console.error('Error listing AR.js publications:', error)
            res.status(500).json({
                status: 'error',
                message: error instanceof Error ? error.message : 'Internal server error'
            })
        }
    }
}

// Export controller
export default new UPDLController()
