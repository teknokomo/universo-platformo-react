// Universo Platformo | UPDL to A-Frame Converter
// Converts UPDL scene objects to A-Frame model representation

import { UPDLScene, UPDLObject, UPDLCamera, UPDLLight, Vector3, Color } from '../../../api/updlApi'
import {
    AFrameScene,
    AFrameEntity,
    AFrameMarker,
    AFrameCamera,
    AFrameLight,
    AFramePrimitive,
    AFrameTagType,
    createDefaultScene,
    createHiroMarker,
    createDefaultCamera,
    createAmbientLight,
    createDirectionalLight,
    createBox
} from '../models/AFrameModel'

/**
 * Converter class that transforms UPDL scene into A-Frame model
 */
export class UPDLToAFrameConverter {
    /**
     * Convert a UPDL scene to A-Frame model
     * @param updlScene - UPDL scene to convert
     * @returns A-Frame scene model
     */
    convert(updlScene: UPDLScene): AFrameScene {
        // Create base scene
        const aframeScene = createDefaultScene()

        // Add a marker
        const marker = createHiroMarker()
        aframeScene.children.push(marker)

        // Process objects
        if (updlScene.objects && updlScene.objects.length > 0) {
            updlScene.objects.forEach((obj: UPDLObject) => {
                marker.children.push(this.convertObject(obj))
            })
        } else {
            // Add default red box if no objects specified
            marker.children.push(createBox())
        }

        // Process camera
        this.processCamera(aframeScene, updlScene)

        // Process lights
        this.processLights(marker, updlScene)

        return aframeScene
    }

    /**
     * Process camera settings, adding default if none exists
     * @param aframeScene - A-Frame scene to add camera to
     * @param updlScene - UPDL scene with camera info
     */
    private processCamera(aframeScene: AFrameScene, updlScene: UPDLScene): void {
        // Add camera outside the marker
        if (updlScene.cameras && updlScene.cameras.length > 0) {
            const camera = this.convertCamera(updlScene.cameras[0])
            aframeScene.children.push(camera)
        } else {
            // Add default camera if none specified
            aframeScene.children.push(createDefaultCamera())
        }
    }

    /**
     * Process lights, adding defaults if none exist
     * @param marker - A-Frame marker to add lights to
     * @param updlScene - UPDL scene with light info
     */
    private processLights(marker: AFrameMarker, updlScene: UPDLScene): void {
        if (!updlScene.lights || updlScene.lights.length === 0) {
            // Add default lights if none specified
            marker.children.push(createAmbientLight())
            marker.children.push(createDirectionalLight())
        } else {
            // Convert existing lights
            updlScene.lights.forEach((light: UPDLLight) => {
                marker.children.push(this.convertLight(light))
            })
        }
    }

    /**
     * Format Vector3 to A-Frame position string
     * @param vector - Vector3 object
     * @returns Formatted position string
     */
    private formatVector(vector: Vector3 | undefined): string {
        if (!vector) {
            return '0 0 0'
        }

        const x = vector.x !== undefined ? vector.x : 0
        const y = vector.y !== undefined ? vector.y : 0
        const z = vector.z !== undefined ? vector.z : 0

        return `${x} ${y} ${z}`
    }

    /**
     * Format Color to hex string
     * @param color - Color object
     * @returns Hex color string
     */
    private formatColor(color: Color | undefined): string {
        if (!color) {
            return '#FFFFFF'
        }

        const r = Math.max(0, Math.min(255, color.r || 0))
        const g = Math.max(0, Math.min(255, color.g || 0))
        const b = Math.max(0, Math.min(255, color.b || 0))

        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    }

    /**
     * Convert a UPDL object to A-Frame entity
     * @param object - UPDL object
     * @returns A-Frame entity
     */
    convertObject(object: UPDLObject): AFrameEntity {
        // Determine A-Frame tag based on UPDL object type
        let tag: AFrameTagType
        switch (object.type) {
            case 'box':
                tag = AFrameTagType.BOX
                break
            case 'sphere':
                tag = AFrameTagType.SPHERE
                break
            case 'cylinder':
                tag = AFrameTagType.CYLINDER
                break
            case 'plane':
                tag = AFrameTagType.PLANE
                break
            case 'model':
                tag = AFrameTagType.ENTITY
                break
            default:
                tag = AFrameTagType.BOX // Default to box
        }

        // Create A-Frame entity with converted attributes
        const entity = {
            tag,
            attributes: {
                position: this.formatVector(object.position),
                material: `color: ${this.formatColor(object.color)}`
            },
            children: []
        } as AFrameEntity

        // Add rotation if present
        if (object.rotation) {
            entity.attributes.rotation = this.formatVector(object.rotation)
        }

        // Add scale if present
        if (object.scale) {
            entity.attributes.scale = this.formatVector(object.scale)
        }

        // Handle model properties if type is 'model'
        if (object.type === 'model' && object.model) {
            entity.attributes.gltf = `model: ${object.model}`
        }

        return entity
    }

    /**
     * Convert a UPDL camera to A-Frame camera
     * @param camera - UPDL camera
     * @returns A-Frame camera
     */
    convertCamera(camera: UPDLCamera): AFrameCamera {
        const aframeCamera: AFrameCamera = {
            tag: AFrameTagType.CAMERA,
            attributes: {
                position: this.formatVector(camera.position)
            },
            children: []
        }

        // Add rotation if present
        if (camera.rotation) {
            aframeCamera.attributes.rotation = this.formatVector(camera.rotation)
        }

        // Add fov if present and camera is perspective
        if (camera.type === 'perspective' && camera.fov) {
            aframeCamera.attributes.fov = camera.fov
        }

        return aframeCamera
    }

    /**
     * Convert a UPDL light to A-Frame light
     * @param light - UPDL light
     * @returns A-Frame light
     */
    convertLight(light: UPDLLight): AFrameLight {
        // Create basic light with correct type
        const aframeLight: AFrameLight = {
            tag: AFrameTagType.LIGHT_AMBIENT, // Default, will be set correctly below
            attributes: {
                type: light.type as 'ambient' | 'directional' | 'point' | 'spot',
                color: this.formatColor(light.color)
            },
            children: []
        }

        // Set intensity if present
        if (light.intensity !== undefined) {
            aframeLight.attributes.intensity = light.intensity
        }

        // For non-ambient lights, add position
        if (light.type !== 'ambient' && light.position) {
            aframeLight.attributes.position = this.formatVector(light.position)
        }

        return aframeLight
    }
}
