// Universo Platformo | AR.js Quiz Builder
// Main builder for quiz template - uses template-specific handlers

import { AbstractTemplateBuilder } from '../../../common/AbstractTemplateBuilder'
import { IUPDLData, IFlowData, IUPDLMultiScene } from '@universo/publish-srv'
import { BuildOptions, TemplateConfig } from '../../../common/types'
import { QuizTemplateConfig } from './config'
import { SpaceHandler, ObjectHandler, CameraHandler, LightHandler, DataHandler } from './handlers'

/**
 * AR.js Quiz Builder - Template-specific implementation
 */
export class ARJSQuizBuilder extends AbstractTemplateBuilder {
    private spaceHandler = new SpaceHandler()
    private objectHandler = new ObjectHandler()
    private cameraHandler = new CameraHandler()
    private lightHandler = new LightHandler()
    private dataHandler = new DataHandler()

    constructor() {
        super('quiz')
    }

    /**
     * Build AR.js HTML from flow data
     * @param flowData Flow data containing UPDL space information
     * @param options Build options for customization
     * @returns Generated AR.js HTML string
     */
    async build(flowData: IFlowData, options: BuildOptions = {}): Promise<string> {
        console.log('[ARJSQuizBuilder] build() called for quiz template')

        try {
            // Single scene: use updlSpace directly
            if (flowData.updlSpace && !flowData.multiScene) {
                console.log('[ARJSQuizBuilder] Building single scene quiz from updlSpace')
                const nodes = this.extractNodes(flowData)
                return this.buildSingleScene(nodes, options)
            }

            // Multi-scene: use multiScene data
            if (flowData.multiScene) {
                console.log('[ARJSQuizBuilder] Building multi-scene quiz from multiScene data:', {
                    totalScenes: flowData.multiScene.totalScenes
                })
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
     * Generate HTML structure with template-specific content
     * Implementation of abstract method from AbstractTemplateBuilder
     */
    protected generateHTML(
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
        return this.generateSceneContent(content, options)
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

        console.log('[ARJSQuizBuilder] Generating scene content with marker:', {
            markerType,
            markerValue,
            hasObjects: content.objectContent.length > 0,
            hasData: content.dataContent.length > 0,
            chatflowId: options.chatflowId || 'not-provided'
        })

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
    // Universo Platformo | Set global chatflowId for lead data saving
    window.chatflowId = '${options.chatflowId || ''}';
    
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
    getTemplateInfo(): TemplateConfig {
        return {
            id: 'quiz',
            name: 'AR.js Quiz Template',
            description: 'Interactive AR quiz with 3D objects and questionnaire',
            version: '1.0.0',
            supportedNodes: ['Space', 'Object', 'Camera', 'Light', 'Data'],
            features: ['AR marker tracking', 'Interactive 3D objects', 'Quiz functionality', 'Multi-scene support', 'Lead data collection'],
            defaults: {
                markerType: 'preset',
                markerValue: 'hiro',
                showPoints: true,
                maxScenes: 10
            }
        }
    }

    /**
     * Get required libraries for AR.js quiz template
     * @returns Array of required library names
     */
    getRequiredLibraries(): string[] {
        return ['aframe', 'arjs']
    }
}
