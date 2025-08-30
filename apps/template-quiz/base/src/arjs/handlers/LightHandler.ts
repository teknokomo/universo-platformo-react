// Universo Platformo | AR.js Light Handler (Quiz Template)
// Handles processing of UPDL Light nodes for AR.js quiz generation

// Local type to avoid circular dependency
interface IUPDLLight {
    id: string;
    name: string;
    type: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
    [key: string]: any
}
import { BuildOptions } from '../../common/types'

/**
 * Processes UPDL Light nodes for AR.js generation
 */
export class LightHandler {
    /**
     * Process lights array
     * @param lights Array of UPDL lights
     * @param options Build options
     * @returns HTML string with A-Frame light elements
     */
    process(lights: IUPDLLight[], options: BuildOptions = {}): string {
        try {
            // If no lights provided, create default ambient lighting
            if (!lights || lights.length === 0) {
                return '<a-light type="ambient" color="#ffffff" intensity="0.5"></a-light>\n'
            }

            // Process each light
            let content = ''
            for (const light of lights) {
                content += this.generateLightElement(light)
            }

            return content
        } catch (error) {
            // In case of error, return default lighting
            return '<a-light type="ambient" color="#ffffff" intensity="0.5"></a-light>\n'
        }
    }

    /**
     * Generates A-Frame HTML element for UPDL light
     * @param light UPDL light
     * @returns HTML string with light element
     */
    private generateLightElement(light: any): string {
        if (!light || !light.type) {
            return ''
        }

        try {
            const position = this.getPositionString(light.position)
            const color = light.color || '#ffffff'
            const intensity = light.intensity || 1

            switch (light.type.toLowerCase()) {
                case 'ambient':
                    return `<a-light type="ambient" color="${color}" intensity="${intensity}"></a-light>\n`

                case 'directional':
                    return `<a-light 
                type="directional" 
                position="${position}" 
                color="${color}" 
                intensity="${intensity}"
            ></a-light>\n`

                case 'point':
                    return `<a-light 
                type="point" 
                position="${position}" 
                color="${color}" 
                intensity="${intensity}"
                distance="${light.distance || 0}"
                decay="${light.decay || 1}"
            ></a-light>\n`

                case 'spot':
                    return `<a-light 
                type="spot" 
                position="${position}" 
                color="${color}" 
                intensity="${intensity}"
                distance="${light.distance || 0}"
                decay="${light.decay || 1}"
                angle="${light.angle || 60}"
                penumbra="${light.penumbra || 0}"
            ></a-light>\n`

                default:
                    return `<a-light type="ambient" color="${color}" intensity="${intensity}"></a-light>\n`
            }
        } catch (error) {
            return ''
        }
    }

    /**
     * Formats position string from light
     */
    private getPositionString(position: any): string {
        if (!position) return '0 5 5'
        return `${position.x || 0} ${position.y || 5} ${position.z || 5}`
    }
}
