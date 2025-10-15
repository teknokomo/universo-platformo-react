// Universo Platformo | AR.js Quiz Builder
// Main builder for quiz template - uses template-specific handlers

import { BuildOptions, ITemplateBuilder, IFlowData, IQuizTemplateConfig, BuildResult } from '../common/types'
import { QuizTemplateConfig as QuizConfig } from '../common/config'
import { SpaceHandler, ObjectHandler, CameraHandler, LightHandler, DataHandler } from './handlers'
import { UPDLProcessor } from '@universo-platformo/utils'
import { IUPDLMultiScene, IUPDLData } from '@universo-platformo/types'

/**
 * AR.js Quiz Builder - Template-specific implementation
 */
export class ARJSQuizBuilder implements ITemplateBuilder {
    private spaceHandler = new SpaceHandler()
    private objectHandler = new ObjectHandler()
    private cameraHandler = new CameraHandler()
    private lightHandler = new LightHandler()
    private dataHandler = new DataHandler()

    constructor() {
        // Initialize handlers
    }

    /**
     * Extract nodes from flow data
     */
    private extractNodes(flowData: IFlowData): {
        spaces: any[]
        objects: any[]
        cameras: any[]
        lights: any[]
        data: IUPDLData[]
    } {
        console.log('[ARJSQuizBuilder] extractNodes called with:', {
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

            console.log('[ARJSQuizBuilder] extractNodes result from updlSpace:', {
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
            console.log('[ARJSQuizBuilder] Fallback: parsing flowData string')
            try {
                const parsed = JSON.parse(flowData.flowData)
                return this.extractFromParsedData(parsed)
            } catch (error) {
                console.warn('[ARJSQuizBuilder] Failed to parse flow data:', error)
                return this.getEmptyNodes()
            }
        }

        console.warn('[ARJSQuizBuilder] No valid data source found, returning empty nodes')
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
        data: IUPDLData[]
    } {
        const spaces: any[] = []
        const objects: any[] = []
        const cameras: any[] = []
        const lights: any[] = []
        const dataNodes: IUPDLData[] = []

        if (data && Array.isArray(data.nodes)) {
            for (const node of data.nodes) {
                if (!node || !node.data) continue

                switch (node.data.type) {
                    case 'Space':
                        spaces.push(node.data)
                        break
                    case 'Object':
                        objects.push(node.data)
                        break
                    case 'Camera':
                        cameras.push(node.data)
                        break
                    case 'Light':
                        lights.push(node.data)
                        break
                    case 'Data':
                        dataNodes.push(node.data)
                        break
                }
            }
        }

        return { spaces, objects, cameras, lights, data: dataNodes }
    }

    /**
     * Get empty nodes structure
     */
    private getEmptyNodes(): {
        spaces: any[]
        objects: any[]
        cameras: any[]
        lights: any[]
        data: IUPDLData[]
    } {
        return {
            spaces: [],
            objects: [],
            cameras: [],
            lights: [],
            data: []
        }
    }

    /**
     * Build AR.js HTML from flow data
     * @param flowData Flow data containing UPDL space information
     * @param options Build options for customization
     * @returns Generated AR.js HTML string
     */
    async build(flowData: IFlowData, options: BuildOptions = {}): Promise<string> {
        // Build process started - detailed logs disabled for production

        try {
            // Single scene: use updlSpace directly
            if (flowData.updlSpace && !flowData.multiScene) {
                console.log('[ARJSQuizBuilder] Building single scene quiz from updlSpace')
                const nodes = this.extractNodes(flowData)
                return this.buildSingleScene(nodes, options)
            }

            // Multi-scene: use multiScene data
            if (flowData.multiScene) {
                // Building multi-scene quiz - detailed logs disabled for production
                return this.buildMultiScene(flowData.multiScene, options)
            }

            // Fallback: try to extract nodes anyway
            console.warn('[ARJSQuizBuilder] No updlSpace or multiScene, attempting fallback extraction')
            const nodes = this.extractNodes(flowData)
            return this.buildSingleScene(nodes, options)
        } catch (error) {
            console.error('[ARJSQuizBuilder] Build error:', error)
            return this.generateErrorSceneContent(options)
        }
    }

    /**
     * Build single-scene quiz
     */
    private buildSingleScene(
        nodes: {
            spaces: any[]
            objects: any[]
            cameras: any[]
            lights: any[]
            data: IUPDLData[]
        },
        options: BuildOptions
    ): string {
        const { spaces, objects, cameras, lights, data } = nodes

        // Process each node type using template handlers
        const spaceContent = spaces.length > 0 ? this.spaceHandler.process(spaces[0], options) : ''
        const objectContent = this.objectHandler.process(objects, options)
        const cameraContent = this.cameraHandler.process(cameras, options)
        const lightContent = this.lightHandler.process(lights, options)
        const dataContent = this.dataHandler.process(data, options)

        // Generate AR.js scene content with marker wrapper
        return this.generateSceneContent(
            {
                spaceContent,
                objectContent,
                cameraContent,
                lightContent,
                dataContent,
                template: 'quiz'
            },
            options
        )
    }

    /**
     * Build multi-scene quiz
     */
    private buildMultiScene(multiScene: IUPDLMultiScene, options: BuildOptions): string {
        // Process multi-scene objects
        const objectContent = this.objectHandler.processMultiScene(multiScene, options)

        // Process multi-scene data with showPoints option
        const dataContent = this.dataHandler.processMultiScene(multiScene, options)

        // Use first scene for camera/light defaults from spaceData
        const firstScene = multiScene.scenes[0]
        const cameras = firstScene?.spaceData?.cameras || []
        const lights = firstScene?.spaceData?.lights || []

        const cameraContent = this.cameraHandler.process(cameras, options)
        const lightContent = this.lightHandler.process(lights, options)

        // Generate AR.js scene content with marker wrapper
        return this.generateSceneContent(
            {
                spaceContent: '',
                objectContent,
                cameraContent,
                lightContent,
                dataContent,
                template: 'quiz'
            },
            options
        )
    }

    /**
     * Generate AR.js scene content with proper marker structure
     * Renamed from generateARJSHTML for clarity and consistency
     */
    private generateSceneContent(
        content: {
            spaceContent: string
            objectContent: string
            cameraContent: string
            lightContent: string
            dataContent: string
            template: string
            error?: boolean
        },
        options: BuildOptions = {}
    ): string {
        // Get marker configuration with defaults
        const markerType = options.markerType || 'preset'
        const markerValue = options.markerValue || 'hiro'

        // Scene content - all 3D objects go inside the marker
        const sceneContent = content.spaceContent + content.objectContent + content.cameraContent + content.lightContent

        const errorClass = content.error ? ' error-scene' : ''

        // Generating scene content with marker - detailed logs disabled for production

        // Wallpaper mode support (default to 'marker' for compatibility)
        const displayType = (options as any).arDisplayType || 'marker'
        const cameraUsage = (options as any).cameraUsage || 'standard'
        const backgroundColor = (options as any).backgroundColor || '#ffffff'
        console.log(`[ARJSQuizBuilder] displayType=${displayType}, cameraUsage=${cameraUsage}, backgroundColor=${backgroundColor}`)
        console.log(`[ARJSQuizBuilder] DEBUG options.backgroundColor:`, (options as any).backgroundColor)
        console.log(`[ARJSQuizBuilder] DEBUG options keys:`, Object.keys(options))

        // Simple background color mode for disabled camera
        if (cameraUsage === 'none') {
            console.log(`[ARJSQuizBuilder] Camera disabled - using simple background color: ${backgroundColor}`)

            const finalHTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quiz</title>
    <style>
        body, html {
            background-color: ${backgroundColor} !important;
            margin: 0;
            padding: 0;
            width: 100vw;
            height: 100vh;
            font-family: Arial, sans-serif;
        }
        .content-container {
            width: 100%;
            height: 100%;
            background-color: ${backgroundColor};
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 20px;
            box-sizing: border-box;
        }
    </style>
</head>
<body>
    <div class="content-container">
        ${content.dataContent}
    </div>
    
    <script>
        window.canvasId = '${options.canvasId || options.chatflowId || ''}';
        window.chatflowId = '${options.chatflowId || options.canvasId || ''}';
        console.log('[ARJSQuizBuilder] Simple background mode - no AR, backgroundColor: ${backgroundColor}');
    </script>
</body>
</html>`

            console.log(
                `[ARJSQuizBuilder] Simple background HTML generated (${finalHTML.length} chars), backgroundColor: ${backgroundColor}`
            )
            return finalHTML
        }

        if (displayType === 'wallpaper') {
            // Allow switching between a rotating wireframe sphere and a simple sky background
            const useSky = (options as any).wallpaperType === 'sky'
            const wallpaperEntity = useSky
                ? `\n    <a-sky color="#0a0a1a"></a-sky>`
                : `\n    <a-sphere radius="25" \n              segments-width="48" \n              segments-height="32"\n              material="shader: flat; wireframe: true; wireframe-linewidth: 2; color: #00e6ff; opacity: 0.6; side: back; transparent: true"\n              animation="property: rotation; to: 0 360 0; loop: true; dur: 90000; easing: linear"></a-sphere>`

            console.log(`[ARJSQuizBuilder] Wallpaper sphere entity created:`, wallpaperEntity.trim())

            // Build scene attributes array - conditional arjs attribute
            const sceneAttributes = [
                'embedded',
                `class="ar-scene${errorClass}"`,
                'vr-mode-ui="enabled: false"',
                'device-orientation-permission-ui="enabled: false"'
            ]

            // Only add arjs attribute if camera is enabled
            if (cameraUsage !== 'none') {
                sceneAttributes.push('arjs="sourceType: webcam; debugUIEnabled: false;"')
                console.log(`[ARJSQuizBuilder] Wallpaper mode: Camera enabled - adding arjs attribute`)
            } else {
                console.log(`[ARJSQuizBuilder] Wallpaper mode: Camera disabled - NO arjs attribute`)
            }

            // Camera entity is conditional - but we ALWAYS need a camera for 3D rendering
            const cameraWithWallpaper =
                cameraUsage !== 'none'
                    ? `<!-- Camera with wallpaper background (AR mode with webcam) -->
    <a-entity camera>
        ${wallpaperEntity}
    </a-entity>`
                    : `<!-- Camera with wallpaper background (3D mode without webcam) -->
    <a-entity camera>
        ${wallpaperEntity}
    </a-entity>`

            console.log(`[ARJSQuizBuilder] Wallpaper mode: Creating camera entity with wallpaper sphere (cameraUsage=${cameraUsage})`)

            const finalHTML = `
<a-scene ${sceneAttributes.join('\n         ')}>

    ${cameraWithWallpaper}

    <!-- Data UI overlay (quiz, etc.) -->
    ${content.dataContent}

    <a-assets></a-assets>
</a-scene>

<script>
    window.canvasId = '${options.canvasId || options.chatflowId || ''}';
    window.chatflowId = '${options.chatflowId || options.canvasId || ''}';
    document.addEventListener('DOMContentLoaded', function() {
        const scene = document.querySelector('a-scene');
        if (scene && !scene.hasLoaded) {
            scene.addEventListener('loaded', function() {
                console.log('[ARJSQuizBuilder] Scene loaded successfully (wallpaper)');
            });
        }
    });
</script>`

            console.log(
                `[ARJSQuizBuilder] Wallpaper HTML generated (${finalHTML.length} chars), camera entity included:`,
                finalHTML.includes('<a-entity camera>')
            )

            return finalHTML
        }

        // Build marker attributes based on type
        let markerAttributes = ''
        if (markerType === 'preset') {
            markerAttributes = `preset="${markerValue}"`
        } else if (markerType === 'pattern') {
            markerAttributes = `type="pattern" patternUrl="${markerValue}"`
        } else {
            // Fallback to preset hiro
            markerAttributes = 'preset="hiro"'
        }

        return `
<a-scene embedded
         class="ar-scene${errorClass}"
         arjs="sourceType: webcam; debugUIEnabled: false;"
         vr-mode-ui="enabled: false"
         device-orientation-permission-ui="enabled: false">
    
    <!-- AR.js Marker - Template: ${content.template} -->
    <a-marker ${markerAttributes}>
        <!-- All 3D content goes inside the marker -->
        ${sceneContent}
    </a-marker>
    
    <!-- Camera entity for AR tracking -->
    <a-entity camera></a-entity>
    
    <!-- Data UI (outside of marker for overlay) -->
    ${content.dataContent}
    
    <!-- Assets -->
    <a-assets>
        <!-- Template-specific assets can be added here -->
    </a-assets>
</a-scene>

<script>
    // Universo Platformo | Set global canvasId and chatflowId for lead data saving
    window.canvasId = '${options.canvasId || options.chatflowId || ''}';
    window.chatflowId = '${options.chatflowId || options.canvasId || ''}';
    
    // Hide loading screen when A-Frame scene loads
    document.addEventListener('DOMContentLoaded', function() {
        const scene = document.querySelector('a-scene');
        if (scene && scene.hasLoaded) {
            console.log('[ARJSQuizBuilder] Scene already loaded');
        } else if (scene) {
            scene.addEventListener('loaded', function() {
                console.log('[ARJSQuizBuilder] Scene loaded successfully');
            });
        }
    });
</script>`
    }

    /**
     * Generate error scene content for quiz template with AR.js structure
     */
    private generateErrorSceneContent(options: BuildOptions = {}): string {
        return this.generateSceneContent(
            {
                spaceContent: '',
                objectContent: '<a-box position="0 0.5 0" material="color: #FF0000;" scale="1 1 1"></a-box>',
                cameraContent: '',
                lightContent: '',
                dataContent: '',
                template: 'quiz',
                error: true
            },
            options
        )
    }

    /**
     * Get template configuration
     */
    getTemplateInfo(): IQuizTemplateConfig {
        return QuizConfig
    }

    /**
     * Build AR.js HTML from raw flow data string (compatibility method)
     * @param flowDataString Raw flow data JSON string
     * @param options Build options
     * @returns Build result with HTML and metadata
     */
    async buildFromFlowData(flowDataString: string, options: BuildOptions = {}): Promise<BuildResult> {
        // Build from flow data started - detailed logs disabled for production

        try {
            // Process flow data using UPDLProcessor
            const result = UPDLProcessor.processFlowData(flowDataString)

            // Create IFlowData structure with processed data
            const flowData: IFlowData = {
                flowData: flowDataString,
                updlSpace: result.updlSpace,
                multiScene: result.multiScene
            }

            // Flow data processed - detailed logs disabled for production

            // Use the main build method
            const html = await this.build(flowData, options)

            return {
                success: true,
                html: html,
                metadata: {
                    buildTime: Date.now(),
                    markerType: options.markerType || 'preset',
                    markerValue: options.markerValue || 'hiro',
                    templateId: 'quiz',
                    templateInfo: QuizConfig,
                    libraryVersions: {
                        arjs: '3.4.7',
                        aframe: '1.7.1'
                    }
                }
            }
        } catch (error) {
            console.error('[ARJSQuizBuilder] buildFromFlowData() failed:', error)
            return {
                success: false,
                error: (error as Error).message
            }
        }
    }

    /**
     * Get required libraries for AR.js quiz template
     * @param options Build options containing cameraUsage and displayType
     * @returns Array of required library names
     */
    getRequiredLibraries(options?: any): string[] {
        const cameraUsage = options?.cameraUsage || 'standard'
        const displayType = options?.arDisplayType || 'wallpaper'

        // Always need A-Frame for 3D content
        const libraries = ['aframe']

        if (cameraUsage === 'none') {
            // No camera = no AR.js needed (works for both wallpaper and marker modes)
            return libraries
        }

        // Camera enabled = need AR.js for AR functionality
        libraries.push('arjs')
        return libraries
    }
}
