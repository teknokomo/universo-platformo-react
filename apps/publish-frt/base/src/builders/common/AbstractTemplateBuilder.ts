// Universo Platformo | Abstract Template Builder
// Base class for all template builders

import { ITemplateBuilder, TemplateConfig, BuildOptions } from './types'
import { IFlowData, ILibraryConfig } from '@universo/publish-srv'

/**
 * Abstract base class for all template builders
 * Provides common functionality and enforces template interface
 */
export abstract class AbstractTemplateBuilder implements ITemplateBuilder {
    protected templateId: string

    constructor(templateId: string) {
        this.templateId = templateId
    }

    /**
     * Build method that all templates must implement
     * @param flowData Flow data to process
     * @param options Build options
     * @returns Generated HTML string
     */
    abstract build(flowData: IFlowData, options?: BuildOptions): Promise<string>

    /**
     * Get template configuration
     */
    abstract getTemplateInfo(): TemplateConfig

    /**
     * Get required libraries for this template
     * Abstract method - each template must specify its library dependencies
     * @returns Array of required library names (e.g., ['aframe', 'arjs'] or ['playcanvas'])
     */
    abstract getRequiredLibraries(): string[]

    /**
     * Generate HTML structure with template-specific content
     * Abstract method - each template must implement its own HTML structure
     * @param content Content structure with processed nodes
     * @param options Build options including marker configuration
     * @returns Generated HTML string
     */
    protected abstract generateHTML(
        content: {
            spaceContent: string
            objectContent: string
            cameraContent: string
            lightContent: string
            dataContent: string
            template: string
            error?: boolean
        },
        options?: BuildOptions
    ): string

    /**
     * Wrap template scene content with complete HTML document structure
     * Common method that can be used by all templates
     * @param sceneContent Generated scene content from template
     * @param options Build options with library configuration
     * @returns Complete HTML document
     */
    protected wrapWithDocumentStructure(sceneContent: string, options: BuildOptions = {}): string {
        const librarySources = this.getLibrarySourcesForTemplate(options)
        const projectName =
            options.projectName || `Universo Platformo ${this.templateId.charAt(0).toUpperCase() + this.templateId.slice(1)}`

        // Generate script tags for required libraries
        const libraryScripts = librarySources.map((src) => `    <script src="${src}"></script>`).join('\n')

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
    <meta name="description" content="${this.templateId} - Universo Platformo">
${libraryScripts}
    <style>
        body {
            margin: 0;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
    </style>
</head>
<body>
    ${sceneContent}
</body>
</html>`
    }

    /**
     * Get library sources for this template based on configuration
     * @param options Build options that may contain user library configuration
     * @returns Array of library source URLs
     */
    protected getLibrarySourcesForTemplate(options: BuildOptions): string[] {
        const requiredLibraries = this.getRequiredLibraries()
        const sources: string[] = []

        for (const library of requiredLibraries) {
            const source = this.getLibrarySource(library, options.libraryConfig)
            if (source) {
                sources.push(source)
            }
        }

        return sources
    }

    /**
     * Get source URL for a specific library
     * @param libraryName Name of the library (e.g., 'aframe', 'arjs', 'playcanvas')
     * @param config Optional user library configuration
     * @returns Library source URL
     */
    protected getLibrarySource(libraryName: string, config?: ILibraryConfig): string {
        // Default library configurations
        const defaultVersions: Record<string, string> = {
            aframe: '1.7.1',
            arjs: '3.4.7',
            // Universo Platformo | Updated PlayCanvas default version
            playcanvas: '2.9.0'
        }

        const baseUrls = {
            official: {
                aframe: 'https://aframe.io/releases',
                arjs: 'https://raw.githack.com/AR-js-org/AR.js',
                playcanvas: 'https://code.playcanvas.com'
            },
            kiberplano: {
                // Use absolute paths for local files served by our server
                aframe: '/assets/libs',
                arjs: '/assets/libs',
                playcanvas: '/assets/libs'
            }
        }

        // Determine version and source
        let version = defaultVersions[libraryName] || '1.0.0'
        let sourceType = 'official'

        // Safe access to library config
        if (config) {
            const libraryConfig = config[libraryName as keyof ILibraryConfig]
            if (libraryConfig) {
                version = libraryConfig.version || version
                sourceType = libraryConfig.source || sourceType
            }
        }

        // Generate URL based on library and source
        switch (libraryName) {
            case 'aframe':
                return sourceType === 'kiberplano'
                    ? `${baseUrls.kiberplano.aframe}/aframe/${version}/aframe.min.js`
                    : `${baseUrls.official.aframe}/${version}/aframe.min.js`

            case 'arjs':
                return sourceType === 'kiberplano'
                    ? `${baseUrls.kiberplano.arjs}/arjs/${version}/aframe-ar.js`
                    : `${baseUrls.official.arjs}/${version}/aframe/build/aframe-ar.js`

            case 'playcanvas':
                return sourceType === 'kiberplano'
                    ? `/playcanvas/${version}/playcanvas.min.js`
                    : `https://cdn.jsdelivr.net/npm/playcanvas@${version}/build/playcanvas.min.js`

            default:
                console.warn(`[AbstractTemplateBuilder] Unknown library: ${libraryName}`)
                return ''
        }
    }

    /**
     * Extract nodes from flow data
     * Common helper method for all templates
     */
    protected extractNodes(flowData: IFlowData): {
        spaces: any[]
        objects: any[]
        cameras: any[]
        lights: any[]
        data: any[]
    } {
        console.log('[AbstractTemplateBuilder] extractNodes called with:', {
            hasUpdlSpace: !!flowData.updlSpace,
            hasFlowData: !!flowData.flowData,
            hasMultiScene: !!flowData.multiScene,
            updlSpaceObjectCount: flowData.updlSpace?.objects?.length || 0
        })

        // If flowData has updlSpace, extract directly
        if (flowData.updlSpace) {
            const extracted = {
                spaces: [flowData.updlSpace],
                objects: flowData.updlSpace.objects || [],
                cameras: flowData.updlSpace.cameras || [],
                lights: flowData.updlSpace.lights || [],
                data: flowData.updlSpace.datas || []
            }

            console.log('[AbstractTemplateBuilder] extractNodes result from updlSpace:', {
                spacesCount: extracted.spaces.length,
                objectsCount: extracted.objects.length,
                camerasCount: extracted.cameras.length,
                lightsCount: extracted.lights.length,
                dataCount: extracted.data.length
            })

            return extracted
        }

        // If flowData is string, parse it (fallback)
        if (typeof flowData.flowData === 'string') {
            console.log('[AbstractTemplateBuilder] Fallback: parsing flowData string')
            try {
                const parsed = JSON.parse(flowData.flowData)
                const result = this.extractFromParsedData(parsed)
                console.log('[AbstractTemplateBuilder] extractNodes result from parsed string:', {
                    spacesCount: result.spaces.length,
                    objectsCount: result.objects.length,
                    camerasCount: result.cameras.length,
                    lightsCount: result.lights.length,
                    dataCount: result.data.length
                })
                return result
            } catch (error) {
                console.warn('[AbstractTemplateBuilder] Failed to parse flow data:', error)
                return this.getEmptyNodes()
            }
        }

        console.warn('[AbstractTemplateBuilder] No valid data source found, returning empty nodes')
        return this.getEmptyNodes()
    }

    /**
     * Extract nodes from parsed data structure
     */
    private extractFromParsedData(data: any): {
        spaces: any[]
        objects: any[]
        cameras: any[]
        lights: any[]
        data: any[]
    } {
        // Handle different data structures
        if (data.updlSpace) {
            return {
                spaces: [data.updlSpace],
                objects: data.updlSpace.objects || [],
                cameras: data.updlSpace.cameras || [],
                lights: data.updlSpace.lights || [],
                data: data.updlSpace.datas || []
            }
        }

        return this.getEmptyNodes()
    }

    /**
     * Get empty node structure
     */
    private getEmptyNodes() {
        return {
            spaces: [],
            objects: [],
            cameras: [],
            lights: [],
            data: []
        }
    }
}
