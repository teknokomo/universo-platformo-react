// Universo Platformo | AR.js Builder
// Main AR.js builder with template system support

import { BaseBuilder } from '../common/BaseBuilder'
import { BuildResult, BuildOptions, BuilderConfig, BuildErrorClass } from '../common/types'
import { IUPDLSpace, IUPDLMultiScene, ILibraryConfig, DEFAULT_LIBRARY_CONFIG, IFlowData } from '@universo/publish-srv'
import { getLibrarySources, debugLog, appConfig } from '../../config/appConfig'
import { UPDLProcessor } from '../common/UPDLProcessor'
import { TemplateRegistry } from '../common/TemplateRegistry'

/**
 * AR.js Builder for generating AR.js HTML from UPDL space data
 * Now uses template system for flexible export options
 */
export class ARJSBuilder extends BaseBuilder {
    private currentTemplate: string = 'quiz' // Default template

    constructor(
        platform: string = 'arjs',
        config: BuilderConfig = {
            platform: 'arjs',
            name: 'ARJSBuilder',
            version: '1.0.0',
            supportedMarkerTypes: ['preset']
        }
    ) {
        super(platform, config)
    }

    /**
     * Build AR.js HTML from raw flow data
     * NEW METHOD: Processes flow data using UPDLProcessor then builds HTML
     * @param flowDataString Raw flow data JSON string from API
     * @param options Build options (can include templateId)
     * @returns Build result with HTML and metadata
     */
    async buildFromFlowData(flowDataString: string, options: BuildOptions = {}): Promise<BuildResult> {
        console.log('🔧 [ARJSBuilder] buildFromFlowData() called with template system')

        try {
            // Use template from options or current template
            const templateId = options.templateId || this.currentTemplate
            if (options.templateId) {
                this.setTemplate(options.templateId)
            }

            console.log(`[ARJSBuilder] Using template: ${templateId}`)

            // Process flow data using UPDLProcessor
            const processResult = UPDLProcessor.processFlowData(flowDataString)

            // Debug logging for confirmation of data
            console.log('[ARJSBuilder] ProcessResult Analysis:', {
                hasUpdlSpace: !!processResult.updlSpace,
                hasMultiScene: !!processResult.multiScene,
                objectCount: processResult.updlSpace?.objects?.length || 0,
                multiSceneCount: processResult.multiScene?.totalScenes || 0
            })

            // Create template builder
            const templateBuilder = TemplateRegistry.createBuilder(templateId)

            // Prepare flow data for template
            // Fixed: Correctly form IFlowData to prevent object loss
            const flowData: IFlowData = {
                flowData: flowDataString, // Keep original string
                updlSpace: processResult.updlSpace, // Add extracted updlSpace
                multiScene: processResult.multiScene,
                metadata: {
                    templateId: templateId
                }
            }

            console.log('[ARJSBuilder] FormattedFlowData:', {
                hasFlowDataString: !!flowData.flowData,
                hasUpdlSpace: !!flowData.updlSpace,
                hasMultiScene: !!flowData.multiScene,
                extractedObjectCount: flowData.updlSpace?.objects?.length || 0
            })

            // Use template builder to generate scene content
            const sceneContent = await templateBuilder.build(flowData, options)

            // Wrap with document structure (HTML, head, body, library scripts)
            const finalHtml = this.wrapWithDocumentStructure(sceneContent, options)

            return {
                success: true,
                html: finalHtml,
                metadata: {
                    buildTime: Date.now(),
                    templateId: templateId,
                    templateInfo: TemplateRegistry.getTemplate(templateId),
                    markerType: options.markerType || 'preset',
                    markerValue: options.markerValue || 'hiro',
                    libraryVersions: {
                        arjs: '3.4.7',
                        aframe: '1.7.1'
                    }
                }
            }
        } catch (error) {
            console.error('❌ [ARJSBuilder] buildFromFlowData() failed:', error)
            throw new BuildErrorClass('Failed to build from flow data', 'BUILD_FROM_FLOW_ERROR', (error as Error).message)
        }
    }

    /**
     * Build AR.js HTML from UPDL space (Legacy method - delegates to template system)
     * @param updlSpace UPDL space data
     * @param options Build options
     * @returns Build result with HTML and metadata
     */
    async build(updlSpace: IUPDLSpace, options: BuildOptions = {}): Promise<BuildResult> {
        console.log('🔧 [ARJSBuilder] Legacy build() called - delegating to template system')

        // Convert UPDL space to flow data format for template system
        const flowData: IFlowData = {
            updlSpace: updlSpace,
            metadata: {
                nodeCount: this.getTotalNodeCount(updlSpace),
                templateId: options.templateId || this.currentTemplate
            }
        }

        // Use template system to build
        const templateId = options.templateId || this.currentTemplate
        const templateBuilder = TemplateRegistry.createBuilder(templateId)

        // Use template builder to generate scene content
        const sceneContent = await templateBuilder.build(flowData, options)

        // Wrap with document structure
        const finalHtml = this.wrapWithDocumentStructure(sceneContent, options)

        return {
            success: true,
            html: finalHtml,
            metadata: {
                buildTime: Date.now(),
                templateId: templateId,
                templateInfo: TemplateRegistry.getTemplate(templateId),
                markerType: options.markerType || 'preset',
                markerValue: options.markerValue || 'hiro',
                libraryVersions: {
                    arjs: '3.4.7',
                    aframe: '1.7.1'
                }
            }
        }
    }

    /**
     * Get library sources from options or fallback to defaults
     * @param options Build options that may contain user library configuration
     * @returns Object with aframeSrc and arjsSrc URLs
     */
    private getLibrarySourcesFromOptions(options: BuildOptions): { aframeSrc: string; arjsSrc: string } {
        console.log('🔍 [ARJSBuilder] getLibrarySourcesFromOptions called:', {
            hasOptions: !!options,
            hasLibraryConfig: !!options.libraryConfig,
            libraryConfigDetails: options.libraryConfig
        })

        // If user has provided library configuration, use it
        if (options.libraryConfig) {
            console.log('✅ [ARJSBuilder] Using user-provided library configuration')
            return this.generateLibrarySources(options.libraryConfig)
        }

        // FALLBACK: Use existing appConfig logic for backward compatibility
        console.log('⚠️ [ARJSBuilder] No libraryConfig provided, falling back to appConfig defaults')
        const defaultSources = getLibrarySources()
        console.log('🔄 [ARJSBuilder] Default library sources from appConfig:', defaultSources)
        return defaultSources
    }

    /**
     * Generate library URLs based on user configuration
     * @param config User-selected library configuration
     * @returns Object with aframeSrc and arjsSrc URLs
     */
    private generateLibrarySources(config: ILibraryConfig): { aframeSrc: string; arjsSrc: string } {
        const baseUrls = {
            official: {
                aframe: 'https://aframe.io/releases',
                arjs: 'https://raw.githack.com/AR-js-org/AR.js'
            },
            kiberplano: {
                // Use absolute paths for local files served by our server
                aframe: '/assets/libs',
                arjs: '/assets/libs'
            }
        }

        const aframePath =
            config.aframe.source === 'kiberplano'
                ? `${baseUrls.kiberplano.aframe}/aframe/${config.aframe.version}/aframe.min.js`
                : `${baseUrls.official.aframe}/${config.aframe.version}/aframe.min.js`

        const arjsPath =
            config.arjs.source === 'kiberplano'
                ? `${baseUrls.kiberplano.arjs}/arjs/${config.arjs.version}/aframe-ar.js`
                : `${baseUrls.official.arjs}/${config.arjs.version}/aframe/build/aframe-ar.js`

        debugLog('ARJSBuilder: Using custom library sources', {
            libraryMode: 'USER_SELECTED',
            aframeSrc: aframePath,
            arjsSrc: arjsPath,
            config
        })

        return {
            aframeSrc: aframePath,
            arjsSrc: arjsPath
        }
    }

    /**
     * Set template for building
     * @param templateId Template ID from registry
     */
    setTemplate(templateId: string): void {
        if (!TemplateRegistry.hasTemplate(templateId)) {
            throw new Error(`[ARJSBuilder] Template not found: ${templateId}`)
        }
        this.currentTemplate = templateId
        console.log(`[ARJSBuilder] Template set to: ${templateId}`)
    }

    /**
     * Get available templates
     */
    getAvailableTemplates() {
        return TemplateRegistry.getTemplates()
    }

    /**
     * Wrap template scene content with complete HTML document structure
     * Renamed from wrapWithLibrarySources for clarity
     * @param sceneContent Generated scene content from template
     * @param options Build options with library configuration
     * @returns Complete HTML document
     */
    private wrapWithDocumentStructure(sceneContent: string, options: BuildOptions): string {
        const { aframeSrc, arjsSrc } = this.getLibrarySourcesFromOptions(options)
        const projectName = options.projectName || 'Universo Platformo AR Quiz'

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
    <meta name="description" content="AR Quiz - Universo Platformo">
    <script src="${aframeSrc}"></script>
    <script src="${arjsSrc}"></script>
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
}
