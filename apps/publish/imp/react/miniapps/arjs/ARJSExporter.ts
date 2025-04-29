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
     * Convert UPDL scene to A-Frame model
     * @param updlScene - UPDL scene
     * @returns A-Frame scene model
     */
    protected convertToAFrameModel(updlScene: UPDLScene): AFrameScene {
        return this.converter.convert(updlScene)
    }

    /**
     * Generate HTML from A-Frame model
     * @param aframeScene - A-Frame scene model
     * @param title - Document title
     * @returns Complete HTML document
     */
    protected generateHTMLFromModel(aframeScene: AFrameScene, title: string): string {
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

        // Ensure objects array exists
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
        // Сначала выполняем базовую валидацию из родительского класса
        const baseValidation = super.validateScene(scene)

        // Если базовая валидация обнаружила ошибки, возвращаем их
        if (!baseValidation.valid) {
            return baseValidation
        }

        // Дополнительные проверки, специфичные для AR.js
        const errors: string[] = [...baseValidation.errors]

        // Проверка дополнительных требований AR.js
        // Например, требование к маркеру или другие специфичные ограничения

        return {
            valid: errors.length === 0,
            errors
        }
    }
}

// Создаем экземпляр для экспорта
export const arjsExporter = new ARJSExporter()
