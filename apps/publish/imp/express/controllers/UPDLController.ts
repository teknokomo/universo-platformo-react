// Universo Platformo | UPDL Controller
// Handles UPDL-specific operations for publishing and exporting

import { Request, Response } from 'express'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { UPDLFlow } from './types'

/**
 * Controller for UPDL operations
 */
export class UPDLController {
    // Directory where published content is stored
    private publicationDir: string

    // Directory where publication metadata is stored
    private metadataDir: string

    /**
     * Constructor for UPDLController
     */
    constructor(
        options: {
            publicationDir?: string
            metadataDir?: string
        } = {}
    ) {
        // Set publication directory (default: public/published)
        this.publicationDir = options.publicationDir || path.resolve(process.cwd(), 'public', 'published')

        // Set metadata directory (default: data/updl)
        this.metadataDir = options.metadataDir || path.resolve(process.cwd(), 'data', 'updl')

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
     * Get UPDL scene from flow ID
     */
    public async getUPDLScene(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params

            if (!id) {
                res.status(400).json({ status: 'error', message: 'Missing scene ID' })
                return
            }

            // Example scene data for testing
            const mockScene = {
                id,
                name: 'Test AR Scene',
                description: 'A simple AR.js scene with a red box',
                type: 'ar',
                updatedAt: new Date().toISOString(),
                data: {
                    objects: [
                        {
                            id: 'box1',
                            type: 'box',
                            position: '0 0.5 0',
                            rotation: '0 0 0',
                            scale: '1 1 1',
                            color: '#FF0000'
                        }
                    ],
                    lights: [
                        {
                            id: 'ambient1',
                            type: 'ambient',
                            color: '#FFFFFF',
                            intensity: 0.5
                        }
                    ],
                    cameras: [
                        {
                            id: 'camera1',
                            type: 'perspective',
                            position: '0 2 5',
                            rotation: '0 0 0',
                            fov: 75
                        }
                    ]
                }
            }

            res.status(200).json({ status: 'success', data: mockScene })
        } catch (error) {
            console.error('Error fetching UPDL scene:', error)
            res.status(500).json({
                status: 'error',
                message: 'Failed to retrieve UPDL scene',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }

    /**
     * List available UPDL scenes
     */
    public async listUPDLScenes(req: Request, res: Response): Promise<void> {
        try {
            // Example scene list for testing
            const scenes = [
                {
                    id: 'scene1',
                    name: 'AR Demo Scene',
                    description: 'A simple AR scene with a red box',
                    updatedAt: new Date().toISOString()
                },
                {
                    id: 'scene2',
                    name: 'AR Test Scene',
                    description: 'A test scene with multiple objects',
                    updatedAt: new Date().toISOString()
                }
            ]

            res.status(200).json(scenes)
        } catch (error) {
            console.error('Error listing UPDL scenes:', error)
            res.status(500).json({
                status: 'error',
                message: 'Failed to list UPDL scenes',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }

    /**
     * Publish AR.js project
     */
    public async publishARJS(req: Request, res: Response): Promise<void> {
        try {
            const { sceneId, title, html, markerType, markerValue } = req.body

            if (!sceneId || !title || !html) {
                res.status(400).json({
                    status: 'error',
                    message: 'Missing required parameters: sceneId, title, html'
                })
                return
            }

            // Валидация входных данных
            console.log(`Publishing AR.js project: ${title} with marker ${markerType}:${markerValue}`)

            // Generate unique ID for published project
            const publishId = uuidv4()

            // Create publication path
            const publicationPath = path.join(this.publicationDir, `arjs_${publishId}.html`)

            // Save HTML file
            fs.writeFileSync(publicationPath, html)

            // Публичный URL для доступа к файлу
            const publicUrl = `/p/${publishId}`

            // Save metadata
            const metadata = {
                id: publishId,
                title,
                sceneId,
                markerType,
                markerValue,
                publicUrl,
                createdAt: new Date().toISOString()
            }

            // Save metadata to file
            const metadataPath = path.join(this.metadataDir, `arjs_${publishId}.json`)
            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))

            // Return success with URL and metadata
            res.status(200).json({
                id: publishId,
                url: publicUrl,
                title,
                createdAt: metadata.createdAt
            })
        } catch (error) {
            console.error('Error publishing AR.js project:', error)
            res.status(500).json({
                status: 'error',
                message: 'Failed to publish AR.js project',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }

    /**
     * List published AR.js projects
     */
    public async listPublishedARJS(req: Request, res: Response): Promise<void> {
        try {
            // In a real implementation, this would read from filesystem or database
            const publishedProjects = []

            if (fs.existsSync(this.metadataDir)) {
                const files = fs.readdirSync(this.metadataDir)

                for (const file of files) {
                    if (file.startsWith('arjs_') && file.endsWith('.json')) {
                        const metadataPath = path.join(this.metadataDir, file)
                        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
                        publishedProjects.push(metadata)
                    }
                }
            }

            res.status(200).json(publishedProjects)
        } catch (error) {
            console.error('Error listing published AR.js projects:', error)
            res.status(500).json({
                status: 'error',
                message: 'Failed to list published AR.js projects',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }
}

// Export controller
export default new UPDLController()
