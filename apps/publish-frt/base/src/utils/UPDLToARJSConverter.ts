// Universo Platformo | Utility for converting UPDL space data to AR.js HTML code

// Import types from central Interface.UPDL.ts
import { IUPDLSpace } from '@server/interface'

/**
 * Class for converting UPDL space to AR.js HTML code
 * Used in streaming generation of AR.js space from UPDL data
 */
export class UPDLToARJSConverter {
    /**
     * Converts UPDL space directly to AR.js HTML code
     * @param updlSpace UPDL space
     * @param projectName Project name
     * @returns HTML code for AR.js
     */
    static convertToHTML(updlSpace: IUPDLSpace, projectName: string = 'UPDL-AR.js'): string {
        const aframeVersion = '1.6.0'
        const arjsVersion = 'master'

        // Building HTML structure
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
                ${this.generateSpaceContent(updlSpace)}
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
     * Generates AR space content from UPDL objects
     * @param updlSpace UPDL space
     * @returns HTML string with space elements
     */
    private static generateSpaceContent(updlSpace: IUPDLSpace): string {
        let content = ''

        try {
            // If space is empty or missing, create a default red cube
            if (!updlSpace || !updlSpace.objects || updlSpace.objects.length === 0) {
                console.log('[UPDLToARJSConverter] No objects found, creating default red cube')
                content += `<a-box position="0 0.5 0" material="color: #FF0000;" scale="1 1 1"></a-box>\n`
                return content
            }

            console.log(`[UPDLToARJSConverter] Processing ${updlSpace.objects.length} objects`)

            // Processing objects from UPDL space
            for (const obj of updlSpace.objects) {
                content += this.generateObjectElement(obj)
            }

            return content
        } catch (error) {
            console.error('[UPDLToARJSConverter] Error generating space content:', error)
            // In case of error, return a simple red cube
            return `<a-box position="0 0.5 0" material="color: #FF0000;" scale="1 1 1"></a-box>\n`
        }
    }

    /**
     * Generates A-Frame HTML element for UPDL object
     * @param object UPDL object
     * @returns HTML string with element
     */
    private static generateObjectElement(object: any): string {
        if (!object || !object.type) {
            console.warn('[UPDLToARJSConverter] Invalid object, missing type:', object)
            return ''
        }

        try {
            // Get common attributes
            const position = this.getPositionString(object.position)
            const scale = this.getScaleString(object.scale)
            const color = object.color || '#FF0000'
            const rotation = this.getRotationString(object.rotation)

            // Determine object type and create corresponding A-Frame element
            switch (object.type.toLowerCase()) {
                case 'box':
                    return `<a-box 
                position="${position}"
                rotation="${rotation}"
                material="color: ${color};"
                scale="${scale}"
            ></a-box>\n`

                case 'sphere':
                    return `<a-sphere 
                position="${position}"
                material="color: ${color};"
                radius="${object.radius || 0.5}"
                scale="${scale}"
            ></a-sphere>\n`

                case 'cylinder':
                    return `<a-cylinder 
                position="${position}"
                rotation="${rotation}"
                material="color: ${color};"
                radius="${object.radius || 0.5}"
                height="${object.height || 1}"
                scale="${scale}"
            ></a-cylinder>\n`

                case 'plane':
                    return `<a-plane 
                position="${position}"
                material="color: ${color};"
                width="${object.width || 1}"
                height="${object.height || 1}"
                rotation="${object.rotation?.x || -90} ${object.rotation?.y || 0} ${object.rotation?.z || 0}"
                scale="${scale}"
            ></a-plane>\n`

                case 'text':
                    return `<a-text 
                position="${position}"
                rotation="${rotation}"
                value="${this.escapeHtml(object.value || 'Text')}"
                color="${color}"
                width="${object.width || 10}"
                align="${object.align || 'center'}"
                scale="${scale}"
            ></a-text>\n`

                case 'circle':
                    return `<a-circle 
                position="${position}"
                rotation="${rotation}"
                material="color: ${color};"
                radius="${object.radius || 0.5}"
                scale="${scale}"
            ></a-circle>\n`

                case 'cone':
                    return `<a-cone 
                position="${position}"
                rotation="${rotation}"
                material="color: ${color};"
                radius-bottom="${object.radiusBottom || 0.5}"
                radius-top="${object.radiusTop || 0}"
                height="${object.height || 1}"
                scale="${scale}"
            ></a-cone>\n`

                // Default, if type is not defined, create a cube
                default:
                    console.warn(`[UPDLToARJSConverter] Unknown object type: ${object.type}, defaulting to box`)
                    return `<a-box 
                position="${position}"
                rotation="${rotation}"
                material="color: ${color};"
                scale="${scale}"
            ></a-box>\n`
            }
        } catch (error) {
            console.error(`[UPDLToARJSConverter] Error processing object:`, error, object)
            return ''
        }
    }

    /**
     * Formats position string from object
     */
    private static getPositionString(position: any): string {
        if (!position) return '0 0.5 0'
        return `${position.x || 0} ${position.y || 0.5} ${position.z || 0}`
    }

    /**
     * Formats scale string from object
     */
    private static getScaleString(scale: any): string {
        if (!scale) return '1 1 1'
        return `${scale.x || 1} ${scale.y || 1} ${scale.z || 1}`
    }

    /**
     * Formats rotation string from object
     */
    private static getRotationString(rotation: any): string {
        if (!rotation) return '0 0 0'
        return `${rotation.x || 0} ${rotation.y || 0} ${rotation.z || 0}`
    }

    /**
     * Simple method for HTML escaping
     * @param text Original text
     * @returns Escaped text
     */
    private static escapeHtml(text: string): string {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
    }
}
