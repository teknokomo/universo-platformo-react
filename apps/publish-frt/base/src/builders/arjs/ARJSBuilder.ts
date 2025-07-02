// Universo Platformo | AR.js Builder
// Main AR.js builder replacing UPDLToARJSConverter.ts

import { BaseBuilder } from '../common/BaseBuilder'
import { BuildResult, BuildOptions, BuilderConfig, BuildErrorClass } from '../common/types'
import { IUPDLSpace, IUPDLMultiScene, ILibraryConfig, DEFAULT_LIBRARY_CONFIG } from '@universo/publish-srv'
import { SpaceHandler, ObjectHandler, CameraHandler, LightHandler, DataHandler } from './handlers'
import { getLibrarySources, debugLog, appConfig } from '../../config/appConfig'
import { UPDLProcessor } from '../common/UPDLProcessor'

/**
 * AR.js Builder for generating AR.js HTML from UPDL space data
 */
export class ARJSBuilder extends BaseBuilder {
    private spaceHandler = new SpaceHandler()
    private objectHandler = new ObjectHandler()
    private cameraHandler = new CameraHandler()
    private lightHandler = new LightHandler()
    private dataHandler = new DataHandler()

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
     * @param options Build options
     * @returns Build result with HTML and metadata
     */
    async buildFromFlowData(flowDataString: string, options: BuildOptions = {}): Promise<BuildResult> {
        console.log('🔧 [ARJSBuilder] buildFromFlowData() called with flow data string')

        try {
            // Process flow data using UPDLProcessor
            const processResult = UPDLProcessor.processFlowData(flowDataString)

            if (processResult.multiScene) {
                console.log('🎬 [ARJSBuilder] Multi-scene detected, using buildMultiScene()')
                return this.buildMultiScene(processResult.multiScene as unknown as IUPDLMultiScene, options)
            } else if (processResult.updlSpace) {
                console.log('🏠 [ARJSBuilder] Single space detected, using build()')
                return this.build(processResult.updlSpace as unknown as IUPDLSpace, options)
            } else {
                throw new Error('No valid UPDL structure found in flow data')
            }
        } catch (error) {
            console.error('❌ [ARJSBuilder] buildFromFlowData() failed:', error)
            throw new BuildErrorClass('Failed to build from flow data', 'BUILD_FROM_FLOW_ERROR', (error as Error).message)
        }
    }

    /**
     * Build AR.js HTML from UPDL space
     * @param updlSpace UPDL space data
     * @param options Build options
     * @returns Build result with HTML and metadata
     */
    async build(updlSpace: IUPDLSpace, options: BuildOptions = {}): Promise<BuildResult> {
        // Universo Platformo | Enhanced debugging for libraryConfig processing
        console.log('🔧 [ARJSBuilder] build() called with:', {
            hasUpdlSpace: !!updlSpace,
            spaceObjectCount: updlSpace?.objects?.length || 0,
            optionsKeys: Object.keys(options),
            hasLibraryConfig: !!options.libraryConfig,
            libraryConfigDetails: options.libraryConfig,
            fullOptions: options
        })

        // Validate UPDL space
        const validation = this.validateUPDLSpace(updlSpace as any)
        if (!validation.isValid) {
            console.error('❌ [ARJSBuilder] UPDL space validation failed:', validation.errors)
            throw new BuildErrorClass('UPDL space validation failed', 'VALIDATION_ERROR', validation.errors)
        }

        console.log('✅ [ARJSBuilder] UPDL space validation passed')

        // Universo Platformo | Extract leadCollection from space data
        const leadCollection = {
            collectName: updlSpace.leadCollection?.collectName || false,
            collectEmail: updlSpace.leadCollection?.collectEmail || false,
            collectPhone: updlSpace.leadCollection?.collectPhone || false
        }

        console.log('🔧 [ARJSBuilder] Lead collection analysis:', {
            leadCollection,
            hasAnyLeadCollection: leadCollection.collectName || leadCollection.collectEmail || leadCollection.collectPhone
        })

        // Process each component using handlers
        const spaceContent = this.spaceHandler.process(updlSpace, options)
        const objectsContent = this.objectHandler.process(updlSpace.objects || [], options)
        const camerasContent = this.cameraHandler.process(updlSpace.cameras || [], options)
        const lightsContent = this.lightHandler.process(updlSpace.lights || [], options)
        const datasContent = this.dataHandler.process(updlSpace.datas || [], { ...options, leadCollection })

        console.log('🎯 [ARJSBuilder] Data processing results:', {
            datasInputCount: updlSpace.datas?.length || 0,
            datasInputDetails: updlSpace.datas,
            datasContentLength: datasContent.length,
            datasContentPreview: datasContent.substring(0, 200) + '...'
        })

        // Combine all content
        const sceneContent = spaceContent + objectsContent + camerasContent + lightsContent

        // Data content goes after scene (UI and scripts)
        const dataUIContent = datasContent

        console.log('🎬 [ARJSBuilder] Scene content generated:', {
            spaceContentLength: spaceContent.length,
            objectsContentLength: objectsContent.length,
            camerasContentLength: camerasContent.length,
            lightsContentLength: lightsContent.length,
            datasContentLength: datasContent.length,
            totalSceneContentLength: sceneContent.length
        })

        // Generate HTML
        console.log('🏗️ [ARJSBuilder] Calling generateHTML with sceneContent, dataUIContent and options')
        console.log('🏗️ [ARJSBuilder] Final content lengths before HTML generation:', {
            sceneContentLength: sceneContent.length,
            dataUIContentLength: dataUIContent.length
        })
        const html = this.generateHTML(sceneContent, dataUIContent, options)

        console.log('🎯 [ARJSBuilder] build() completed successfully:', {
            htmlLength: html.length,
            containsLocalPaths: html.includes('./assets/libs/'),
            containsOfficialCDN: html.includes('aframe.io') || html.includes('githack.com'),
            librarySourcesUsed: options.libraryConfig ? 'USER_SELECTED' : 'DEFAULT'
        })

        return {
            success: true,
            html,
            metadata: {
                buildTime: Date.now(),
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
     * Universo Platformo | Build AR.js HTML from multi-scene data
     * @param multiScene Multi-scene data structure
     * @param options Build options
     * @returns Build result with HTML and metadata
     */
    async buildMultiScene(multiScene: IUPDLMultiScene, options: BuildOptions = {}): Promise<BuildResult> {
        console.log('🔧 [ARJSBuilder] buildMultiScene() called with:', {
            totalScenes: multiScene.totalScenes,
            scenesCount: multiScene.scenes?.length || 0,
            optionsKeys: Object.keys(options)
        })

        try {
            // Universo Platformo | Extract showPoints from any scene that has it enabled (not just first)
            let showPoints = false
            for (const scene of multiScene.scenes) {
                if (scene.spaceData?.showPoints || scene.spaceData?.inputs?.showPoints) {
                    showPoints = true
                    break
                }
            }

            // Universo Platformo | Extract leadCollection from first scene's spaceData
            const firstScene = multiScene.scenes.length > 0 ? multiScene.scenes[0] : null
            const leadCollection = firstScene?.spaceData?.leadCollection

            console.log('🔧 [ARJSBuilder] Points system analysis:', {
                hasScenes: multiScene.scenes.length > 0,
                firstSceneExists: !!firstScene,
                hasSpaceData: !!firstScene?.spaceData,
                showPoints,
                totalScenes: multiScene.scenes.length,
                sceneWithPointsFound: multiScene.scenes.findIndex(
                    (scene) => scene.spaceData?.showPoints || scene.spaceData?.inputs?.showPoints
                ),
                spaceDataKeys: firstScene?.spaceData ? Object.keys(firstScene.spaceData) : []
            })

            console.log('🔧 [ARJSBuilder] Lead collection analysis:', {
                leadCollection,
                hasAnyLeadCollection:
                    leadCollection && (leadCollection.collectName || leadCollection.collectEmail || leadCollection.collectPhone)
            })

            // Process each component using multi-scene handlers with showPoints option
            const objectsContent = this.objectHandler.processMultiScene(multiScene, options)
            const datasContent = this.dataHandler.processMultiScene(multiScene, { ...options, showPoints, leadCollection })

            // Pass only objects content – generateHTML already wraps everything into a single <a-marker>
            const sceneContent = objectsContent

            // Data content goes after scene (UI and scripts)
            const dataUIContent = datasContent

            console.log('🎬 [ARJSBuilder] Multi-scene content generated:', {
                objectsContentLength: objectsContent.length,
                datasContentLength: datasContent.length,
                totalSceneContentLength: sceneContent.length
            })

            // Generate HTML
            const html = this.generateHTML(sceneContent, dataUIContent, options)

            console.log('🎯 [ARJSBuilder] buildMultiScene() completed successfully:', {
                htmlLength: html.length,
                totalScenes: multiScene.totalScenes
            })

            return {
                success: true,
                html,
                metadata: {
                    buildTime: Date.now(),
                    markerType: options.markerType || 'preset',
                    markerValue: options.markerValue || 'hiro',
                    libraryVersions: {
                        arjs: '3.4.7',
                        aframe: '1.7.1'
                    }
                }
            }
        } catch (error) {
            console.error('❌ [ARJSBuilder] Multi-scene build failed:', error)
            throw new BuildErrorClass('Multi-scene build failed', 'MULTISCENE_BUILD_ERROR', (error as Error).message)
        }
    }

    /**
     * Generate complete HTML document for AR.js
     * @param sceneContent A-Frame scene content
     * @param dataUIContent Quiz UI and script content
     * @param options Build options
     * @returns Complete HTML string
     */
    private generateHTML(sceneContent: string, dataUIContent: string, options: BuildOptions): string {
        const projectName = options.projectName || 'UPDL-AR.js'

        // NEW: Get library sources from options or fallback to defaults
        const { aframeSrc, arjsSrc } = this.getLibrarySourcesFromOptions(options)

        // Debug info using centralized debug system
        debugLog('ARJSBuilder: Generating HTML with library sources', {
            libraryMode: options.libraryConfig ? 'USER_SELECTED' : 'DEFAULT',
            aframeSrc,
            arjsSrc,
            projectName
        })

        const html = `
<!DOCTYPE html>
<html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${this.escapeHtml(projectName)}</title>
        <script src="${aframeSrc}"></script>
        <script src="${arjsSrc}"></script>
        <style>
            body {
                margin: 0;
                overflow: hidden;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            .loading-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                color: white;
                z-index: 9999;
            }
            .loading-screen.hidden {
                display: none;
            }
            .loading-spinner {
                border: 5px solid rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                border-top: 5px solid #fff;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin-bottom: 20px;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .ar-instructions {
                position: fixed;
                bottom: 20px;
                left: 0;
                width: 100%;
                text-align: center;
                color: white;
                background-color: rgba(0,0,0,0.5);
                padding: 10px;
                z-index: 999;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <!-- Loading screen -->
        <div id="loading-screen" class="loading-screen">
            <div class="loading-spinner"></div>
            <div>Loading AR space...</div>
        </div>

        <!-- User instructions -->
        <div id="ar-instructions" class="ar-instructions">
            Наведите камеру на маркер HIRO для отображения 3D объектов
        </div>

        <!-- AR.js space -->
        <a-scene embedded arjs="trackingMethod: best; debugUIEnabled: false;" vr-mode-ui="enabled: false">
            <a-marker preset="hiro">
                ${sceneContent}
            </a-marker>
            <a-entity camera></a-entity>
        </a-scene>

        <script>
            // Universo Platformo | Set global chatflowId for lead data saving
            window.chatflowId = '${options.chatflowId || ''}';
            
            // Hide loading screen when space is loaded
            document.addEventListener('DOMContentLoaded', function() {
                const scene = document.querySelector('a-scene');
                if (scene.hasLoaded) {
                    document.querySelector('#loading-screen').classList.add('hidden');
                } else {
                    scene.addEventListener('loaded', function() {
                        document.querySelector('#loading-screen').classList.add('hidden');
                    });
                }

                // Hide instructions after 10 seconds
                setTimeout(function() {
                    const instructions = document.querySelector('#ar-instructions');
                    if (instructions) {
                        instructions.style.opacity = '0';
                        instructions.style.transition = 'opacity 1s';
                        setTimeout(() => instructions.style.display = 'none', 1000);
                    }
                }, 10000);
            });
        </script>
        
        ${dataUIContent}
    </body>
</html>
    `

        console.log('📄 [ARJSBuilder] Final HTML generation complete:', {
            totalHtmlLength: html.length,
            containsQuizContainer: html.includes('quiz-container'),
            containsQuizScript: html.includes('[Quiz]'),
            dataUIContentInHtml: html.includes(dataUIContent)
        })

        return html
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

        // NEW: If user has provided library configuration, use it
        if (options.libraryConfig) {
            console.log('✅ [ARJSBuilder] Using user-provided library configuration')
            const customSources = this.generateCustomLibrarySources(options.libraryConfig)
            console.log('🎯 [ARJSBuilder] Custom library sources generated:', customSources)
            return customSources
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
    private generateCustomLibrarySources(config: ILibraryConfig): { aframeSrc: string; arjsSrc: string } {
        const baseUrls = {
            official: {
                aframe: 'https://aframe.io/releases',
                arjs: 'https://raw.githack.com/AR-js-org/AR.js'
            },
            kiberplano: {
                // Universo Platformo | Use absolute paths for local files served by our server
                aframe: '/assets/libs', // Fixed: absolute path instead of relative
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
     * Simple method for HTML escaping
     * @param text Original text
     * @returns Escaped text
     */
    private escapeHtml(text: string): string {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
    }
}
