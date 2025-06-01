// Universo Platformo | AR.js Builder
// Main AR.js builder replacing UPDLToARJSConverter.ts

import { BaseBuilder } from '../common/BaseBuilder'
import { BuildResult, BuildOptions, BuilderConfig, BuildError } from '../common/types'
import { IUPDLSpace } from '../../../../../../packages/server/src/Interface.UPDL'
import { SpaceHandler, ObjectHandler, CameraHandler, LightHandler } from './handlers'
import { getLibrarySources, debugLog, appConfig } from '../../config/appConfig'
import { LibraryConfig, DEFAULT_LIBRARY_CONFIG } from '../../types/library.types'

/**
 * AR.js Builder for generating AR.js HTML from UPDL space data
 */
export class ARJSBuilder extends BaseBuilder {
    private spaceHandler = new SpaceHandler()
    private objectHandler = new ObjectHandler()
    private cameraHandler = new CameraHandler()
    private lightHandler = new LightHandler()

    constructor(platform: string = 'arjs', config: BuilderConfig = { platform: 'arjs' }) {
        super(platform, config)
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
        const validation = this.validateUPDLSpace(updlSpace)
        if (!validation.isValid) {
            console.error('❌ [ARJSBuilder] UPDL space validation failed:', validation.errors)
            throw new BuildError('UPDL space validation failed', validation.errors)
        }

        console.log('✅ [ARJSBuilder] UPDL space validation passed')

        // Process each component using handlers
        const spaceContent = this.spaceHandler.process(updlSpace, options)
        const objectsContent = this.objectHandler.process(updlSpace.objects || [], options)
        const camerasContent = this.cameraHandler.process(updlSpace.cameras || [], options)
        const lightsContent = this.lightHandler.process(updlSpace.lights || [], options)

        // Combine all content
        const sceneContent = spaceContent + objectsContent + camerasContent + lightsContent

        console.log('🎬 [ARJSBuilder] Scene content generated:', {
            spaceContentLength: spaceContent.length,
            objectsContentLength: objectsContent.length,
            camerasContentLength: camerasContent.length,
            lightsContentLength: lightsContent.length,
            totalSceneContentLength: sceneContent.length
        })

        // Generate HTML
        console.log('🏗️ [ARJSBuilder] Calling generateHTML with sceneContent and options')
        const html = this.generateHTML(sceneContent, options)

        console.log('🎯 [ARJSBuilder] build() completed successfully:', {
            htmlLength: html.length,
            containsLocalPaths: html.includes('./assets/libs/'),
            containsOfficialCDN: html.includes('aframe.io') || html.includes('githack.com'),
            librarySourcesUsed: options.libraryConfig ? 'USER_SELECTED' : 'DEFAULT'
        })

        return {
            html,
            metadata: {
                platform: 'arjs',
                generatedAt: new Date(),
                nodeCount: this.getTotalNodeCount(updlSpace),
                markerType: options.markerType || 'preset',
                markerValue: options.markerValue || 'hiro'
            }
        }
    }

    /**
     * Generate complete HTML document for AR.js
     * @param sceneContent A-Frame scene content
     * @param options Build options
     * @returns Complete HTML string
     */
    private generateHTML(sceneContent: string, options: BuildOptions): string {
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
    </body>
</html>
    `

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
    private generateCustomLibrarySources(config: LibraryConfig): { aframeSrc: string; arjsSrc: string } {
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
