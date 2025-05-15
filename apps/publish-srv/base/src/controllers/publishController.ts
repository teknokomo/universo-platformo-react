// Universo Platformo | Publication controller
import { Request, Response } from 'express'
import { PublishService } from '../services/publishService'
import { PublishRequest } from '../interfaces/PublishInterfaces'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { UPDLFlow } from './types'
import { UPDLSceneGraph } from '../interfaces/UPDLTypes'
import fetch from 'node-fetch'
import logger from '../utils/logger'

const publishService = new PublishService()

/**
 * Создает базовую UPDL сцену с примитивами для демонстрационных целей
 * @param chatflowId ID чат-флоу для которого нужно создать сцену
 * @returns UPDL сцена с базовыми объектами
 */
async function createDemoUPDLScene(chatflowId: string): Promise<UPDLSceneGraph> {
    try {
        console.log(`[createDemoUPDLScene] Building demo UPDL scene for chatflowId: ${chatflowId}`)

        // Создаем базовую сцену AR
        const basicScene: UPDLSceneGraph = {
            id: chatflowId,
            name: `AR Scene for ${chatflowId}`,
            settings: {
                background: '#FFFFFF'
            },
            objects: [
                // Красный куб в центре
                {
                    id: 'cube-1',
                    type: 'box',
                    name: 'Red Cube',
                    position: { x: 0, y: 0.5, z: 0 },
                    scale: { x: 1, y: 1, z: 1 },
                    color: '#FF0000'
                },
                // Синяя сфера справа
                {
                    id: 'sphere-1',
                    type: 'sphere',
                    name: 'Blue Sphere',
                    position: { x: 1.5, y: 0.5, z: 0 },
                    radius: 0.5,
                    color: '#0000FF'
                },
                // Зеленый цилиндр слева
                {
                    id: 'cylinder-1',
                    type: 'cylinder',
                    name: 'Green Cylinder',
                    position: { x: -1.5, y: 0.5, z: 0 },
                    radius: 0.5,
                    height: 1,
                    color: '#00FF00'
                },
                // Плоскость внизу
                {
                    id: 'plane-1',
                    type: 'plane',
                    name: 'Ground Plane',
                    position: { x: 0, y: 0, z: 0 },
                    rotation: { x: -90, y: 0, z: 0 },
                    width: 4,
                    height: 4,
                    color: '#CCCCCC'
                }
            ],
            lights: [
                {
                    id: 'light-1',
                    type: 'directional',
                    position: { x: 1, y: 1, z: 1 },
                    intensity: 0.8,
                    color: '#FFFFFF'
                }
            ]
        }

        console.log(`[createDemoUPDLScene] Created UPDL scene with ${basicScene.objects?.length || 0} objects`)
        return basicScene
    } catch (error) {
        console.error('Error creating demo UPDL scene:', error)
        throw new Error(`Failed to create demo UPDL scene for chatflowId: ${chatflowId}`)
    }
}

/**
 * Publishes a project
 */
export const publishProject = async (req: Request, res: Response) => {
    try {
        const publishRequest: PublishRequest = req.body

        if (!publishRequest.projectId || !publishRequest.platform) {
            return res.status(400).json({
                error: 'Invalid request. projectId and platform are required.'
            })
        }

        const result = await publishService.publishProject(publishRequest)
        return res.status(201).json(result)
    } catch (error: any) {
        console.error('Error publishing project:', error)
        return res.status(500).json({
            error: 'Failed to publish project',
            message: error.message
        })
    }
}

/**
 * Gets a list of published projects
 */
export const getPublishedProjects = async (req: Request, res: Response) => {
    try {
        const projects = await publishService.getPublishedProjects()
        return res.json(projects)
    } catch (error: any) {
        console.error('Error fetching published projects:', error)
        return res.status(500).json({
            error: 'Failed to fetch published projects',
            message: error.message
        })
    }
}

/**
 * Gets a published project by ID
 */
export const getPublishedProject = async (req: Request, res: Response) => {
    try {
        const { id } = req.params

        if (!id) {
            return res.status(400).json({ error: 'Project ID is required' })
        }

        const project = await publishService.getPublishedProject(id)

        if (!project) {
            return res.status(404).json({ error: 'Project not found' })
        }

        return res.json(project)
    } catch (error: any) {
        console.error(`Error fetching project ${req.params.id}:`, error)
        return res.status(500).json({
            error: 'Failed to fetch project',
            message: error.message
        })
    }
}

// ExportResult interface
interface ExportResult {
    format: 'html' | 'js' | 'jsx' | 'zip'
    mainFile: {
        filename: string
        content: string
    }
    assets?: any[]
}

// ExporterInfo interface
interface ExporterInfo {
    id: string
    name: string
    description: string
    supportedFeatures: string[]
}

// PublishResult interface
export interface PublishResult {
    success: boolean
    publishedUrl?: string
    error?: string
    metadata: {
        exporterId?: string
        timestamp: string
        options?: Record<string, any>
    }
}

/**
 * Controller class for handling advanced publishing operations
 */
export class PublishController {
    // Directory where published content is stored
    private publicationDir: string

    // Directory where publication metadata is stored
    private metadataDir: string

    /**
     * Constructor for PublishController
     * @param options Controller options
     */
    constructor(
        options: {
            publicationDir?: string
            metadataDir?: string
        } = {}
    ) {
        // Set publication directory (default: public/p)
        this.publicationDir = options.publicationDir || path.resolve(process.cwd(), 'public', 'p')

        // Set metadata directory (default: data/publications)
        this.metadataDir = options.metadataDir || path.resolve(process.cwd(), 'data', 'publications')

        // Create directories if they don't exist
        this.ensureDirectoriesExist()
    }

    /**
     * Create required directories if they don't exist
     */
    private ensureDirectoriesExist(): void {
        if (!fs.existsSync(this.publicationDir)) {
            fs.mkdirSync(this.publicationDir, { recursive: true })
        }

        if (!fs.existsSync(this.metadataDir)) {
            fs.mkdirSync(this.metadataDir, { recursive: true })
        }
    }

    /**
     * Get available exporters for publishing
     */
    public async getExporters(req: Request, res: Response): Promise<void> {
        try {
            // Universo Platformo | Add logging
            logger.info(`[PublishController] getExporters called. Request query: ${JSON.stringify(req.query)}`)
            // Mock exporters data for now
            // In a real implementation, this would come from a service or repository
            const exporters = [
                {
                    id: 'html',
                    name: 'HTML',
                    description: 'Export as standalone HTML application',
                    features: ['offline', 'responsive'],
                    iconUrl: '/assets/exporters/html-icon.svg'
                },
                {
                    id: 'react',
                    name: 'React App',
                    description: 'Export as React application',
                    features: ['component-based', 'reusable'],
                    iconUrl: '/assets/exporters/react-icon.svg'
                }
            ]

            res.status(200).json({ exporters })
        } catch (error) {
            console.error('Error fetching exporters:', error)
            res.status(500).json({
                error: 'Failed to retrieve exporters',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }

    /**
     * Publish a UPDL flow with the specified exporter
     */
    public async publishFlow(req: Request, res: Response): Promise<void> {
        try {
            const { flow, exporterId, options } = req.body

            // Validate input
            if (!flow || !exporterId) {
                res.status(400).json({ error: 'Missing required parameters: flow or exporterId' })
                return
            }

            // Validate flow structure
            if (!this.validateFlow(flow)) {
                res.status(400).json({ error: 'Invalid UPDL flow structure' })
                return
            }

            // Process the publishing request
            // In a real implementation, this would call a service to handle the actual publishing
            const result = await this.processPublish(flow, exporterId, options)

            res.status(result.success ? 200 : 400).json(result)
        } catch (error) {
            console.error('Error publishing flow:', error)
            res.status(500).json({
                success: false,
                error: 'Failed to publish flow',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }

    /**
     * Validate if a flow follows the UPDL structure
     */
    private validateFlow(flow: UPDLFlow): boolean {
        // Basic validation
        if (!flow.id || !flow.name || !flow.version || !flow.graph) {
            return false
        }

        // Graph validation
        if (!Array.isArray(flow.graph.nodes) || !Array.isArray(flow.graph.edges)) {
            return false
        }

        // Additional validations could be added here

        return true
    }

    /**
     * Process the publishing operation
     */
    private async processPublish(flow: UPDLFlow, exporterId: string, options?: Record<string, any>): Promise<PublishResult> {
        // Mock implementation
        // In a real implementation, this would call appropriate exporter services

        // Simulate processing time
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // Success case for demo
        if (exporterId === 'html' || exporterId === 'react') {
            return {
                success: true,
                publishedUrl: `https://example.com/published/${flow.id}`,
                metadata: {
                    exporterId,
                    timestamp: new Date().toISOString(),
                    options
                }
            }
        }

        // Failure case for unsupported exporters
        return {
            success: false,
            error: `Exporter '${exporterId}' is not supported`,
            metadata: {
                timestamp: new Date().toISOString()
            }
        }
    }

    /**
     * Get available markers for AR.js
     * @param req Express request
     * @param res Express response
     */
    async getARJSMarkers(req: Request, res: Response): Promise<void> {
        try {
            // Return mock marker data
            const markers = [
                { id: 'hiro', name: 'Hiro', imageUrl: '/assets/markers/hiro.png' },
                { id: 'kanji', name: 'Kanji', imageUrl: '/assets/markers/kanji.png' },
                { id: 'custom', name: 'Custom', imageUrl: '/assets/markers/custom.png' }
            ]

            res.status(200).json({ markers })
        } catch (error) {
            console.error('Error fetching AR.js markers:', error)
            res.status(500).json({
                error: 'Failed to retrieve AR.js markers',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }

    /**
     * Save publication metadata to disk
     * @param publicationId Unique publication ID
     * @param metadata Publication metadata
     */
    private savePublicationMetadata(publicationId: string, metadata: any): void {
        const metadataPath = path.join(this.metadataDir, `${publicationId}.json`)
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
    }

    /**
     * Mock function to simulate flow export
     * @param flowId Flow ID to export
     * @param exporterId Exporter ID
     * @param options Export options
     * @param publicationId Publication ID
     */
    private async mockExportFlow(flowId: string, exporterId: string, options: any, publicationId: string): Promise<void> {
        // Create publication directory
        const publicationPath = path.join(this.publicationDir, publicationId)
        if (!fs.existsSync(publicationPath)) {
            fs.mkdirSync(publicationPath, { recursive: true })
        }

        // Create mock index.html file
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Published UPDL Flow</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .container { max-width: 800px; margin: 0 auto; }
                    .info { background: #f0f0f0; padding: 15px; border-radius: 5px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Published UPDL Flow</h1>
                    <div class="info">
                        <p><strong>Flow ID:</strong> ${flowId}</p>
                        <p><strong>Exporter:</strong> ${exporterId}</p>
                        <p><strong>Publication ID:</strong> ${publicationId}</p>
                        <p><strong>Publication Date:</strong> ${new Date().toISOString()}</p>
                    </div>
                    <div id="app">Loading UPDL application...</div>
                </div>
                <script>
                    console.log('UPDL Flow viewer initialized');
                </script>
            </body>
            </html>
        `

        fs.writeFileSync(path.join(publicationPath, 'index.html'), htmlContent)
    }

    /**
     * Публикация проекта AR.js
     * @param req Запрос
     * @param res Ответ
     */
    public async publishARJS(req: Request, res: Response): Promise<void> {
        // Universo Platformo | Add logging
        logger.info(
            `[PublishController] publishARJS called. Request body: ${JSON.stringify(req.body)}, Params: ${JSON.stringify(req.params)}`
        )
        try {
            const { chatflowId, generationMode, isPublic, projectName } = req.body

            if (!chatflowId) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required parameter: chatflowId'
                })
                return
            }

            // Генерируем уникальный идентификатор публикации
            const publicationId = uuidv4()
            const createdAt = new Date().toISOString()

            // Создаем метаданные публикации
            const publicationMetadata = {
                publicationId,
                chatflowId,
                projectName: projectName || `AR.js Project ${new Date().toLocaleDateString()}`,
                generationMode: generationMode || 'streaming',
                isPublic: isPublic !== undefined ? isPublic : true,
                createdAt,
                updatedAt: createdAt
            }

            // Сохраняем метаданные
            this.savePublicationMetadata(publicationId, publicationMetadata)

            // Universo Platformo | Унифицированный формат URL для потокового и предварительного режимов
            // Формат /p/{id} используется для обоих режимов генерации AR.js
            const publicUrl = `/p/${publicationId}`

            // Отправляем успешный ответ
            res.status(201).json({
                success: true,
                publicationId,
                publicUrl,
                projectName: publicationMetadata.projectName,
                createdAt,
                chatflowId,
                isPublic: publicationMetadata.isPublic,
                generationMode: publicationMetadata.generationMode
            })
        } catch (error) {
            console.error('Error publishing AR.js project:', error)
            res.status(500).json({
                success: false,
                error: 'Failed to publish AR.js project',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }

    /**
     * Получение списка публикаций AR.js для chatflow
     * @param req Запрос
     * @param res Ответ
     */
    public async getARJSPublications(req: Request, res: Response): Promise<void> {
        // Universo Platformo | Add logging
        logger.info(
            `[PublishController] getARJSPublications called. ChatflowId: ${req.params.chatflowId}, Query: ${JSON.stringify(req.query)}`
        )
        try {
            const { chatflowId } = req.params

            if (!chatflowId) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required parameter: chatflowId'
                })
                return
            }

            // Получаем список метаданных публикаций
            const publications = this.getPublicationMetadataForChatflow(chatflowId)

            res.status(200).json(publications)
        } catch (error) {
            console.error('Error fetching AR.js publications:', error)
            res.status(500).json({
                success: false,
                error: 'Failed to fetch AR.js publications',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }

    /**
     * Получение публичных данных публикации AR.js по ID
     * @param req Запрос
     * @param res Ответ
     */
    public async getPublicARJSPublication(req: Request, res: Response): Promise<void> {
        // Universo Platformo | Add logging
        logger.info(`[PublishController] getPublicARJSPublication called. PublicationId: ${req.params.publicationId}`)
        try {
            const { publicationId } = req.params

            if (!publicationId) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required parameter: publicationId'
                })
                return
            }

            // Получаем метаданные публикации
            const metadata = this.getPublicationMetadata(publicationId)

            if (!metadata) {
                res.status(404).json({
                    success: false,
                    error: 'Publication not found'
                })
                return
            }

            // Проверяем, является ли публикация публичной
            if (!metadata.isPublic) {
                res.status(403).json({
                    success: false,
                    error: 'This publication is not public'
                })
                return
            }

            // Получаем данные чатфлоу из основного API Flowise
            let chatflowData
            try {
                // Universo Platformo | Получаем данные чатфлоу через API
                const PORT = process.env.PORT || 8080
                const chatflowResponse = await fetch(`http://localhost:${PORT}/api/chatflows/${metadata.chatflowId}`)

                if (!chatflowResponse.ok) {
                    throw new Error(`Failed to fetch chatflow: ${chatflowResponse.status}`)
                }

                const chatflow = await chatflowResponse.json()

                if (!chatflow || !chatflow.flowData) {
                    throw new Error('Invalid chatflow data')
                }

                // Парсим flowData и извлекаем данные UPDL
                const flowData = typeof chatflow.flowData === 'string' ? JSON.parse(chatflow.flowData) : chatflow.flowData

                // Используем данные UPDL узлов для формирования сцены
                // Это будет развито в будущих обновлениях для более полного извлечения сцены
                console.log(
                    `[getPublicARJSPublication] Successfully fetched chatflow ${metadata.chatflowId} with ${
                        flowData.nodes?.length || 0
                    } nodes`
                )

                // Временное решение: создаем демо-сцену на основе полученных данных
                chatflowData = await createDemoUPDLScene(metadata.chatflowId)
            } catch (error) {
                console.error('Error fetching chatflow data:', error)

                // Если не удалось получить данные, создаем простую сцену
                console.log('[getPublicARJSPublication] Creating fallback UPDL scene')
                chatflowData = {
                    id: metadata.chatflowId,
                    name: metadata.projectName,
                    objects: [
                        {
                            id: 'default-cube',
                            type: 'box',
                            position: { x: 0, y: 0.5, z: 0 },
                            color: '#FF0000',
                            scale: { x: 1, y: 1, z: 1 }
                        }
                    ]
                }
            }

            // Возвращаем данные для публикации
            res.status(200).json({
                publicationId,
                projectName: metadata.projectName,
                updlScene: chatflowData,
                generationMode: metadata.generationMode || 'streaming'
            })
        } catch (error) {
            console.error('Error fetching AR.js publication data:', error)
            res.status(500).json({
                success: false,
                error: 'Failed to fetch AR.js publication data',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }

    /**
     * Удаление публикации AR.js
     * @param req Запрос
     * @param res Ответ
     */
    public async deleteARJSPublication(req: Request, res: Response): Promise<void> {
        // Universo Platformo | Add logging
        logger.info(`[PublishController] deleteARJSPublication called. PublicationId: ${req.params.publicationId}`)
        try {
            const { publicationId } = req.params

            if (!publicationId) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required parameter: publicationId'
                })
                return
            }

            // Проверяем существование публикации
            const metadata = this.getPublicationMetadata(publicationId)

            if (!metadata) {
                res.status(404).json({
                    success: false,
                    error: 'Publication not found'
                })
                return
            }

            // Удаляем метаданные публикации
            this.deletePublicationMetadata(publicationId)

            res.status(200).json({
                success: true,
                message: 'Publication deleted successfully'
            })
        } catch (error) {
            console.error('Error deleting AR.js publication:', error)
            res.status(500).json({
                success: false,
                error: 'Failed to delete AR.js publication',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }

    /**
     * Обновление публикации AR.js
     * @param req Запрос
     * @param res Ответ
     */
    public async updateARJSPublication(req: Request, res: Response): Promise<void> {
        // Universo Platformo | Add logging
        logger.info(
            `[PublishController] updateARJSPublication called. PublicationId: ${req.params.publicationId}, Body: ${JSON.stringify(
                req.body
            )}`
        )
        try {
            const { publicationId } = req.params
            const updates = req.body

            if (!publicationId) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required parameter: publicationId'
                })
                return
            }

            // Получаем существующие метаданные
            const metadata = this.getPublicationMetadata(publicationId)

            if (!metadata) {
                res.status(404).json({
                    success: false,
                    error: 'Publication not found'
                })
                return
            }

            // Обновляем метаданные
            const updatedMetadata = {
                ...metadata,
                ...updates,
                updatedAt: new Date().toISOString()
            }

            // Сохраняем обновленные метаданные
            this.savePublicationMetadata(publicationId, updatedMetadata)

            res.status(200).json({
                success: true,
                ...updatedMetadata
            })
        } catch (error) {
            console.error('Error updating AR.js publication:', error)
            res.status(500).json({
                success: false,
                error: 'Failed to update AR.js publication',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }

    /**
     * Получение метаданных публикации по ID
     * @param publicationId ID публикации
     * @returns Метаданные публикации или null, если не найдено
     */
    private getPublicationMetadata(publicationId: string): any | null {
        try {
            const metadataPath = path.join(this.metadataDir, `${publicationId}.json`)
            if (fs.existsSync(metadataPath)) {
                const metadataRaw = fs.readFileSync(metadataPath, 'utf-8')
                return JSON.parse(metadataRaw)
            }
            return null
        } catch (error) {
            console.error(`Error reading metadata for publication ${publicationId}:`, error)
            return null
        }
    }

    /**
     * Получение списка метаданных публикаций для chatflow
     * @param chatflowId ID потока чата
     * @returns Массив метаданных публикаций
     */
    private getPublicationMetadataForChatflow(chatflowId: string): any[] {
        try {
            // Проверяем наличие директории
            if (!fs.existsSync(this.metadataDir)) {
                return []
            }

            // Получаем список файлов
            const files = fs.readdirSync(this.metadataDir)

            // Фильтруем и читаем метаданные
            const publications = files
                .filter((file) => file.endsWith('.json'))
                .map((file) => {
                    try {
                        const metadataRaw = fs.readFileSync(path.join(this.metadataDir, file), 'utf-8')
                        return JSON.parse(metadataRaw)
                    } catch (error) {
                        console.error(`Error reading metadata file ${file}:`, error)
                        return null
                    }
                })
                .filter((metadata) => metadata && metadata.chatflowId === chatflowId)

            return publications
        } catch (error) {
            console.error(`Error getting publications for chatflow ${chatflowId}:`, error)
            return []
        }
    }

    /**
     * Удаление метаданных публикации
     * @param publicationId ID публикации
     */
    private deletePublicationMetadata(publicationId: string): void {
        try {
            const metadataPath = path.join(this.metadataDir, `${publicationId}.json`)
            if (fs.existsSync(metadataPath)) {
                fs.unlinkSync(metadataPath)
            }
        } catch (error) {
            console.error(`Error deleting metadata for publication ${publicationId}:`, error)
            throw error
        }
    }
}

// Создаем экземпляр контроллера для использования в routes
export const publishController = new PublishController()
