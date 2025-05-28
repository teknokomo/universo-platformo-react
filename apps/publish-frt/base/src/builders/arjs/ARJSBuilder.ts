// Universo Platformo | AR.js Builder
// Main AR.js builder replacing UPDLToARJSConverter.ts

import { BaseBuilder } from '../common/BaseBuilder'
import { BuildResult, BuildOptions, BuilderConfig, BuildError } from '../common/types'
import { IUPDLSpace } from '../../../../../../packages/server/src/Interface.UPDL'
import { SpaceHandler, ObjectHandler, CameraHandler, LightHandler } from './handlers'

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
        // Validate UPDL space
        const validation = this.validateUPDLSpace(updlSpace)
        if (!validation.isValid) {
            throw new BuildError('UPDL space validation failed', validation.errors)
        }

        // Process each component using handlers
        const spaceContent = this.spaceHandler.process(updlSpace, options)
        const objectsContent = this.objectHandler.process(updlSpace.objects || [], options)
        const camerasContent = this.cameraHandler.process(updlSpace.cameras || [], options)
        const lightsContent = this.lightHandler.process(updlSpace.lights || [], options)

        // Combine all content
        const sceneContent = spaceContent + objectsContent + camerasContent + lightsContent

        // Generate HTML
        const html = this.generateHTML(sceneContent, options)

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
        const aframeVersion = this.config.aframeVersion || '1.6.0'
        const arjsVersion = this.config.arjsVersion || 'master'

        const html = `
<!DOCTYPE html>
<html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${this.escapeHtml(projectName)}</title>
        <script src="https://aframe.io/releases/${aframeVersion}/aframe.min.js"></script>
        <script src="https://raw.githack.com/AR-js-org/AR.js/${arjsVersion}/aframe/build/aframe-ar.js"></script>
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
     * Simple method for HTML escaping
     * @param text Original text
     * @returns Escaped text
     */
    private escapeHtml(text: string): string {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
    }
}
