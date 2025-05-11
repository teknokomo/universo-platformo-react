/**
 * ARJSExporter - Exports UPDL scenes to AR.js/A-Frame HTML
 * Handles proper scene structure, including automatic camera and lighting
 */

// Universo Platformo | UPDL AR.js Exporter
import { UPDLScene, UPDLObject, UPDLCamera, UPDLLight, Vector3, Color } from '../../api/updlApi'
import { UPDLToARJSConverter } from './converters/UPDLToARJS'
import { AFrameScene, createDefaultScene, createHiroMarker } from '../aframe/models/AFrameModel'
import { BaseAFrameExporter, AFrameExportOptions } from '../exporters/BaseAFrameExporter'
import { ARJSHTMLGenerator } from './generators/ARJSHTMLGenerator'

// A-Frame component versions to use
const AFRAME_VERSION = '1.4.2'
const ARJS_VERSION = '3.4.5'

// AR.js specific export options
export interface ARJSExportOptions {
    title?: string
    markerType?: 'pattern' | 'barcode' | 'custom'
    markerValue?: string
    includeStats?: boolean
    autoRotate?: boolean
}

// Marker types supported by AR.js
export enum MarkerType {
    PATTERN = 'pattern',
    BARCODE = 'barcode',
    CUSTOM = 'custom'
}

// Preset pattern marker values
export const PATTERN_PRESETS = {
    HIRO: 'hiro',
    KANJI: 'kanji'
}

/**
 * AR.js exporter
 */
class ARJSExporter {
    /**
     * Generate HTML for AR.js from a UPDL scene
     * @param scene UPDL scene to export
     * @param options Export options
     * @returns Generated HTML
     */
    generateHTML(scene: any, options: ARJSExportOptions = {}): string {
        if (!scene) {
            throw new Error('Scene is required for HTML generation')
        }

        // Defaults
        const title = options.title || 'AR.js Scene'
        const markerType = options.markerType || 'pattern'
        const markerValue = options.markerValue || 'hiro'

        // Create a converter instance
        const converter = new UPDLToARJSConverter()

        // Configure marker
        converter.setMarkerOptions(markerType, markerValue)

        // Convert UPDL scene to A-Frame model
        const aframeScene = converter.convertScene(scene)

        // Generate HTML with the AR.js scene
        const htmlGenerator = new ARJSHTMLGenerator()
        const html = htmlGenerator.generateHTML(aframeScene, {
            title,
            includeStats: options.includeStats || false,
            autoRotate: options.autoRotate || false
        })

        return html
    }

    /**
     * Ensures a scene has all required components for AR.js
     * @param scene - UPDL scene to complete
     * @returns Complete UPDL scene for AR.js
     */
    ensureCompleteScene(scene: any): any {
        if (!scene) return null

        const updatedScene = { ...scene }

        // Ensure objects array exists
        if (!updatedScene.objects || !Array.isArray(updatedScene.objects) || updatedScene.objects.length === 0) {
            updatedScene.objects = [
                {
                    id: 'default-box',
                    name: 'Default AR.js Box',
                    type: 'box',
                    position: { x: 0, y: 0, z: 0 },
                    rotation: { x: 0, y: 0, z: 0 },
                    scale: { x: 1, y: 1, z: 1 },
                    color: { r: 1, g: 1, b: 1 }
                }
            ]
        }

        // Ensure cameras array exists
        if (!updatedScene.cameras || !Array.isArray(updatedScene.cameras) || updatedScene.cameras.length === 0) {
            updatedScene.cameras = [
                {
                    id: 'default-camera',
                    name: 'Default AR.js Camera',
                    type: 'perspective',
                    position: { x: 0, y: 0, z: 5 },
                    rotation: { x: 0, y: 0, z: 0 }
                }
            ]
        }

        // Ensure lights array exists
        if (!updatedScene.lights || !Array.isArray(updatedScene.lights) || updatedScene.lights.length === 0) {
            updatedScene.lights = [
                {
                    id: 'default-light',
                    name: 'Default AR.js Light',
                    type: 'ambient',
                    color: { r: 1, g: 1, b: 1 },
                    intensity: 0.8
                }
            ]
        }

        return updatedScene
    }

    /**
     * Validates a UPDL scene for AR.js export
     * @param scene - UPDL scene to validate
     * @returns True if valid for AR.js, false otherwise
     */
    validateScene(scene: any): boolean {
        if (!scene) return false
        if (!scene.id) return false

        // Minimal validation - at least needs objects or cameras
        return (
            (scene.objects && Array.isArray(scene.objects) && scene.objects.length > 0) ||
            (scene.cameras && Array.isArray(scene.cameras) && scene.cameras.length > 0)
        )
    }

    /**
     * Handles errors in the AR.js export process
     * @param error - Error to handle
     */
    handleError(error: Error): void {
        console.error('AR.js Exporter Error:', error)
    }

    /**
     * Gets the name of the exporter
     * @returns Exporter name
     */
    getName(): string {
        return 'AR.js'
    }

    /**
     * Gets the description of the exporter
     * @returns Exporter description
     */
    getDescription(): string {
        return 'Exports UPDL scenes to AR.js format for web-based augmented reality'
    }
}

// Create singleton instance
export const arjsExporter = new ARJSExporter()

// Export the class as well for type usage if needed elsewhere, though singleton is preferred for instantiation
export { ARJSExporter }
