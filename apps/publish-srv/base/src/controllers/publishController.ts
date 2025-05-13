// Universo Platformo | Publication controller
import { Request, Response } from 'express'
import { PublishService } from '../services/publishService'
import { PublishRequest } from '../interfaces/PublishInterfaces'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { UPDLFlow } from './types'

const publishService = new PublishService()

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
}
