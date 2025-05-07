/**
 * ARJSExporter - Exports UPDL scenes to AR.js/A-Frame HTML
 * Handles proper scene structure, including automatic camera and lighting
 */

// Universo Platformo | UPDL AR.js Exporter
import { UPDLScene, UPDLObject, UPDLCamera, UPDLLight, Vector3, Color } from '../../api/updlApi'
import { UPDLToAFrameConverter } from './converters/UPDLToAFrame'
import { AFrameScene, createDefaultScene, createHiroMarker } from './models/AFrameModel'
import { BaseAFrameExporter, AFrameExportOptions } from '../exporters/BaseAFrameExporter'

// A-Frame component versions to use
const AFRAME_VERSION = '1.4.2'
const ARJS_VERSION = '3.4.5'

// AR.js specific export options
export interface ARJSExportOptions extends AFrameExportOptions {
    arjsVersion?: string
    markerType?: MarkerType
    markerValue?: string
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
 * ARJSExporter - Responsible for exporting UPDL scenes to AR.js HTML
 * Extends BaseAFrameExporter with AR.js specific functionality
 */
export class ARJSExporter extends BaseAFrameExporter {
    private arjsVersion: string
    private converter: UPDLToAFrameConverter
    private currentMarkerType: string = 'pattern'
    private currentMarkerValue: string = 'hiro'

    /**
     * Create a new ARJSExporter
     * @param aframeVersion - A-Frame version
     * @param arjsVersion - AR.js version
     */
    constructor(aframeVersion: string = AFRAME_VERSION, arjsVersion: string = ARJS_VERSION) {
        super(aframeVersion)
        this.arjsVersion = arjsVersion
        this.converter = new UPDLToAFrameConverter()
    }

    /**
     * Get the exporter name
     * @returns Name of the exporter
     */
    getName(): string {
        return 'AR.js Exporter'
    }

    /**
     * Get the exporter description
     * @returns Description of the exporter
     */
    getDescription(): string {
        return 'Exports UPDL scenes to AR.js/A-Frame marker-based augmented reality'
    }

    /**
     * Generates HTML from a UPDL scene with AR.js-specific options
     * @param updlScene - The UPDL scene to export
     * @param options - Export options including title and marker settings
     * @returns Generated HTML string
     */
    generateHTML(updlScene: UPDLScene, options?: ARJSExportOptions): string {
        // Extract and store marker settings if provided
        if (options?.markerType) {
            this.setMarkerOptions(options.markerType, options.markerValue)
        }

        // Call parent implementation
        return super.generateHTML(updlScene, options)
    }

    /**
     * Helper method for generating HTML with explicit title and marker parameters
     * This is a convenience method that wraps the main generateHTML method
     * @param scene - UPDL scene
     * @param title - Document title
     * @param options - Export options including marker settings
     * @returns Complete HTML document
     */
    generateARHTML(scene: UPDLScene, title: string, options?: Omit<ARJSExportOptions, 'title'>): string {
        // Create complete options object
        const completeOptions: ARJSExportOptions = {
            ...(options || {}),
            title
        }

        // Call the main method
        return this.generateHTML(scene, completeOptions)
    }

    /**
     * Store marker settings for use during HTML generation
     * @param markerType - Marker type (pattern, barcode, etc)
     * @param markerValue - Marker value (hiro, kanji, etc)
     */
    private setMarkerOptions(markerType: string, markerValue?: string): void {
        // Store marker settings for use during conversion
        this.currentMarkerType = markerType
        if (markerValue) {
            this.currentMarkerValue = markerValue
        } else if (markerType === 'pattern') {
            this.currentMarkerValue = 'hiro' // Default pattern
        } else {
            this.currentMarkerValue = '0' // Default barcode
        }

        console.log(`Setting marker type: ${this.currentMarkerType}, value: ${this.currentMarkerValue}`)
    }

    /**
     * Convert UPDL scene to A-Frame model
     * @param updlScene - UPDL scene
     * @returns A-Frame scene model
     */
    protected convertToAFrameModel(updlScene: UPDLScene): AFrameScene {
        // Here we can use this.currentMarkerType and this.currentMarkerValue
        // to configure the A-Frame model appropriately
        return this.converter.convert(updlScene)
    }

    /**
     * Generate HTML from A-Frame model
     * @param aframeScene - A-Frame scene model
     * @param title - Document title
     * @returns Complete HTML document
     */
    protected generateHTMLFromModel(aframeScene: AFrameScene, title: string): string {
        // Before generating HTML, ensure the scene has default components if needed
        this.addDefaultComponentsIfNeeded(aframeScene)

        // Create HTML header with A-Frame script
        let html = this.getHtmlHeader(title)

        // Add AR.js script
        html += `\n        <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"></script>`

        // Open body
        html += this.getHtmlBodyOpen()

        // Add scene content
        html += `\n        ${this.generateEntityHtml(aframeScene, 8)}`

        // Close HTML
        html += this.getHtmlClosing()

        return html
    }

    /**
     * Adds default components to the scene if they're missing
     * This ensures the scene always has a camera, lights, and at least one object
     * @param aframeScene - A-Frame scene to check and update
     */
    private addDefaultComponentsIfNeeded(aframeScene: AFrameScene): void {
        console.log('Checking if default components are needed...')

        // Add default camera if none exists
        if (!aframeScene.hasCamera()) {
            console.log('Adding default camera')
            aframeScene.addCamera({
                position: { x: 0, y: 1.5, z: 3 },
                rotation: { x: 0, y: 0, z: 0 },
                fov: 75
            })
        }

        // Add default lights if none exist
        if (!aframeScene.hasLights()) {
            console.log('Adding default lights')
            // Add ambient light
            aframeScene.addLight({
                type: 'ambient',
                color: '#ffffff',
                intensity: 0.5
            })

            // Add directional light
            aframeScene.addLight({
                type: 'directional',
                position: { x: 1, y: 1, z: 1 },
                color: '#ffffff',
                intensity: 0.8
            })
        }

        // Add default object (red box) if no objects exist
        if (!aframeScene.hasObjects()) {
            console.log('Adding default object (red box)')
            aframeScene.addObject({
                type: 'box',
                position: { x: 0, y: 0.5, z: 0 },
                scale: { x: 1, y: 1, z: 1 },
                color: '#FF0000'
            })
        }
    }

    /**
     * Ensures a scene has all required components for AR.js (camera, light)
     * @param scene - UPDL scene to complete
     * @returns Complete UPDL scene
     */
    ensureCompleteScene(scene: UPDLScene): UPDLScene {
        const updatedScene = { ...scene }

        // Ensure cameras array exists
        if (!updatedScene.cameras || updatedScene.cameras.length === 0) {
            updatedScene.cameras = [
                {
                    id: 'default-camera',
                    type: 'perspective',
                    position: { x: 0, y: 2, z: 5 },
                    rotation: { x: 0, y: 0, z: 0 },
                    fov: 75
                }
            ]
        }

        // Ensure lights array exists
        if (!updatedScene.lights || updatedScene.lights.length === 0) {
            updatedScene.lights = [
                {
                    id: 'default-ambient',
                    type: 'ambient',
                    color: { r: 255, g: 255, b: 255 },
                    intensity: 0.5
                },
                {
                    id: 'default-directional',
                    type: 'directional',
                    position: { x: 1, y: 1, z: 1 },
                    color: { r: 255, g: 255, b: 255 },
                    intensity: 0.7
                }
            ]
        }

        // Ensure objects array exists - add a default red box if needed
        if (!updatedScene.objects || updatedScene.objects.length === 0) {
            updatedScene.objects = [
                {
                    id: 'default-box',
                    type: 'box',
                    position: { x: 0, y: 0.5, z: 0 },
                    rotation: { x: 0, y: 0, z: 0 },
                    scale: { x: 1, y: 1, z: 1 },
                    color: { r: 255, g: 0, b: 0 }
                }
            ]
        }

        return updatedScene
    }

    /**
     * Validate a UPDL scene for AR.js export
     * @param scene - UPDL scene to validate
     * @returns Validation result object
     */
    validateScene(scene: UPDLScene): { valid: boolean; errors: string[] } {
        // First perform base validation from parent class
        const baseValidation = super.validateScene(scene)

        // If base validation found errors, return them
        if (!baseValidation.valid) {
            return baseValidation
        }

        // Additional checks specific to AR.js
        const errors: string[] = [...baseValidation.errors]

        // Check additional AR.js requirements
        // For example, marker requirements or other specific constraints

        return {
            valid: errors.length === 0,
            errors
        }
    }
}

// Create instance for export
export const arjsExporter = new ARJSExporter()
