/**
 * Universo Platformo | A-Frame VR Exporter
 * Exports UPDL scenes to A-Frame VR HTML
 */

import { UPDLScene, UPDLObject, UPDLCamera, UPDLLight } from '../../api/updlApi'
import { BaseAFrameExporter, AFrameExportOptions } from '../exporters/BaseAFrameExporter'
import { UPDLToAFrameConverter } from '../arjs/converters/UPDLToAFrame'
import { AFrameScene, AFrameEntity, AFrameTagType, createDefaultScene } from '../arjs/models/AFrameModel'

// A-Frame component versions to use
const AFRAME_VERSION = '1.4.2'

// A-Frame VR specific export options
export interface AFrameVRExportOptions extends AFrameExportOptions {
    enableVRButton?: boolean
    enableOrbitControls?: boolean
    background?: string
}

/**
 * AFrameVRExporter - Responsible for exporting UPDL scenes to A-Frame VR HTML
 * Extends BaseAFrameExporter with VR specific functionality
 */
export class AFrameVRExporter extends BaseAFrameExporter {
    private converter: UPDLToAFrameConverter
    private enableVRButton: boolean = true
    private enableOrbitControls: boolean = true
    private background: string = '#SKYBLUE'

    /**
     * Create a new AFrameVRExporter
     * @param aframeVersion - A-Frame version
     */
    constructor(aframeVersion: string = AFRAME_VERSION) {
        super(aframeVersion)
        this.converter = new UPDLToAFrameConverter()
    }

    /**
     * Get the exporter name
     * @returns Name of the exporter
     */
    getName(): string {
        return 'A-Frame VR Exporter'
    }

    /**
     * Get the exporter description
     * @returns Description of the exporter
     */
    getDescription(): string {
        return 'Exports UPDL scenes to A-Frame VR/3D web experiences'
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

        // Add orbit controls if enabled
        if (this.enableOrbitControls) {
            html += `\n        <script src="https://unpkg.com/aframe-orbit-controls@1.3.0/dist/aframe-orbit-controls.min.js"></script>`
        }

        // Open body
        html += this.getHtmlBodyOpen()

        // Modify scene for VR (remove AR.js attributes, add VR settings)
        this.prepareSceneForVR(aframeScene)

        // Add scene content
        html += `\n        ${this.generateEntityHtml(aframeScene, 8)}`

        // Close HTML
        html += this.getHtmlClosing()

        return html
    }

    /**
     * Convert UPDL scene to A-Frame model
     * @param updlScene - UPDL scene
     * @returns A-Frame scene model
     */
    protected convertToAFrameModel(updlScene: UPDLScene): AFrameScene {
        // Use the same converter as AR.js but customize for VR
        const aframeScene = this.converter.convert(updlScene)

        // Customize for VR (will be done in prepareSceneForVR)
        return aframeScene
    }

    /**
     * Prepare A-Frame scene for VR (modify attributes and structure)
     * @param scene - A-Frame scene to modify
     */
    private prepareSceneForVR(scene: AFrameScene): void {
        // Remove AR-specific attributes
        delete scene.attributes.arjs

        // Set VR mode UI based on options
        scene.attributes['vr-mode-ui'] = `enabled: ${this.enableVRButton}`

        // Add sky background if not present
        let hasSky = false
        for (const child of scene.children) {
            if (child.tag === AFrameTagType.SKY) {
                hasSky = true
                break
            }
        }

        if (!hasSky) {
            scene.children.push({
                tag: AFrameTagType.SKY,
                attributes: {
                    color: this.background
                },
                children: []
            })
        }

        // Remove markers and move their children directly to scene
        const nonMarkerChildren: AFrameEntity[] = []
        const markerChildren: AFrameEntity[] = []

        for (const child of scene.children) {
            if (child.tag === 'a-marker') {
                // Move all marker children to a list
                markerChildren.push(...child.children)
            } else {
                // Keep non-marker children
                nonMarkerChildren.push(child)
            }
        }

        // Replace scene children with non-markers and collected marker children
        scene.children = [...nonMarkerChildren, ...markerChildren]

        // Add orbit controls to camera if enabled
        if (this.enableOrbitControls) {
            for (const child of scene.children) {
                if (child.tag === AFrameTagType.CAMERA) {
                    child.attributes['orbit-controls'] = 'target: 0 0 0; initialPosition: 0 2 5'
                    break
                }
            }
        }
    }

    /**
     * Ensures a scene has all required components for VR (camera, light, objects)
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
                    position: { x: 0, y: 1.6, z: 3 }, // Eye height
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
                    position: { x: 0, y: 0.5, z: -2 }, // In front of camera
                    rotation: { x: 0, y: 45, z: 0 },
                    scale: { x: 1, y: 1, z: 1 },
                    color: { r: 255, g: 0, b: 0 }
                },
                {
                    id: 'default-floor',
                    type: 'plane',
                    position: { x: 0, y: 0, z: 0 },
                    rotation: { x: -90, y: 0, z: 0 }, // Flat on ground
                    scale: { x: 10, y: 10, z: 1 },
                    color: { r: 200, g: 200, b: 200 }
                }
            ]
        }

        return updatedScene
    }

    /**
     * Set VR options
     * @param options - VR export options
     */
    setVROptions(options: AFrameVRExportOptions): void {
        if (options.enableVRButton !== undefined) {
            this.enableVRButton = options.enableVRButton
        }

        if (options.enableOrbitControls !== undefined) {
            this.enableOrbitControls = options.enableOrbitControls
        }

        if (options.background) {
            this.background = options.background
        }

        if (options.aframeVersion) {
            this.aframeVersion = options.aframeVersion
        }
    }
}

// Создаем экземпляр для экспорта
export const aframeVRExporter = new AFrameVRExporter()
