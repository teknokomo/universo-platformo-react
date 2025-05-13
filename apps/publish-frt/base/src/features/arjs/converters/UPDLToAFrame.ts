// Universo Platformo | UPDL to A-Frame Converter
// Converts UPDL scene objects to A-Frame model representation

import { UPDLScene, UPDLObject, UPDLCamera, UPDLLight, Vector3, Color } from '../../../api/updlApi'

/**
 * A-Frame model interfaces (simplified)
 */
interface AFrameAttribute {
    name: string
    value: string | number | boolean
}

interface AFrameElement {
    tagName: string
    attributes: AFrameAttribute[]
    children: AFrameElement[]

    addAttribute(name: string, value: string | number | boolean): void
    addChild(child: AFrameElement): void
}

/**
 * A-Frame scene element
 */
class AFrameScene implements AFrameElement {
    tagName: string = 'a-scene'
    attributes: AFrameAttribute[] = []
    children: AFrameElement[] = []

    addAttribute(name: string, value: string | number | boolean): void {
        this.attributes.push({ name, value })
    }

    addChild(child: AFrameElement): void {
        this.children.push(child)
    }
}

/**
 * A-Frame marker element
 */
class AFrameMarker implements AFrameElement {
    tagName: string = 'a-marker'
    attributes: AFrameAttribute[] = []
    children: AFrameElement[] = []

    addAttribute(name: string, value: string | number | boolean): void {
        this.attributes.push({ name, value })
    }

    addChild(child: AFrameElement): void {
        this.children.push(child)
    }

    setPreset(preset: string): void {
        this.attributes = this.attributes.filter((attr) => attr.name !== 'preset')
        this.addAttribute('preset', preset)
    }

    setType(type: string): void {
        this.attributes = this.attributes.filter((attr) => attr.name !== 'type')
        this.addAttribute('type', type)
    }

    setPattern(pattern: string): void {
        this.attributes = this.attributes.filter((attr) => attr.name !== 'url')
        this.addAttribute('url', pattern)
    }

    setValue(value: string): void {
        this.attributes = this.attributes.filter((attr) => attr.name !== 'value')
        this.addAttribute('value', value)
    }
}

/**
 * A-Frame entity element
 */
class AFrameEntity implements AFrameElement {
    tagName: string = 'a-entity'
    attributes: AFrameAttribute[] = []
    children: AFrameElement[] = []

    addAttribute(name: string, value: string | number | boolean): void {
        this.attributes.push({ name, value })
    }

    addChild(child: AFrameElement): void {
        this.children.push(child)
    }

    setPosition(position: string): void {
        this.attributes = this.attributes.filter((attr) => attr.name !== 'position')
        this.addAttribute('position', position)
    }

    setRotation(rotation: string): void {
        this.attributes = this.attributes.filter((attr) => attr.name !== 'rotation')
        this.addAttribute('rotation', rotation)
    }

    setScale(scale: string): void {
        this.attributes = this.attributes.filter((attr) => attr.name !== 'scale')
        this.addAttribute('scale', scale)
    }
}

/**
 * A-Frame primitive element (box, sphere, etc.)
 */
class AFramePrimitive implements AFrameElement {
    tagName: string
    attributes: AFrameAttribute[] = []
    children: AFrameElement[] = []

    constructor(tagName: string) {
        this.tagName = tagName
    }

    addAttribute(name: string, value: string | number | boolean): void {
        this.attributes.push({ name, value })
    }

    addChild(child: AFrameElement): void {
        this.children.push(child)
    }

    setColor(color: string): void {
        this.attributes = this.attributes.filter((attr) => attr.name !== 'color')
        this.addAttribute('color', color)
    }

    setWidth(width: number): void {
        this.attributes = this.attributes.filter((attr) => attr.name !== 'width')
        this.addAttribute('width', width)
    }

    setHeight(height: number): void {
        this.attributes = this.attributes.filter((attr) => attr.name !== 'height')
        this.addAttribute('height', height)
    }

    setDepth(depth: number): void {
        this.attributes = this.attributes.filter((attr) => attr.name !== 'depth')
        this.addAttribute('depth', depth)
    }

    setRadius(radius: number): void {
        this.attributes = this.attributes.filter((attr) => attr.name !== 'radius')
        this.addAttribute('radius', radius)
    }
}

/**
 * A-Frame camera element
 */
class AFrameCamera implements AFrameElement {
    tagName: string = 'a-camera'
    attributes: AFrameAttribute[] = []
    children: AFrameElement[] = []

    addAttribute(name: string, value: string | number | boolean): void {
        this.attributes.push({ name, value })
    }

    addChild(child: AFrameElement): void {
        this.children.push(child)
    }

    setPosition(position: string): void {
        this.attributes = this.attributes.filter((attr) => attr.name !== 'position')
        this.addAttribute('position', position)
    }

    setRotation(rotation: string): void {
        this.attributes = this.attributes.filter((attr) => attr.name !== 'rotation')
        this.addAttribute('rotation', rotation)
    }

    setFov(fov: number): void {
        this.attributes = this.attributes.filter((attr) => attr.name !== 'fov')
        this.addAttribute('fov', fov)
    }

    setNear(near: number): void {
        this.attributes = this.attributes.filter((attr) => attr.name !== 'near')
        this.addAttribute('near', near)
    }

    setFar(far: number): void {
        this.attributes = this.attributes.filter((attr) => attr.name !== 'far')
        this.addAttribute('far', far)
    }
}

/**
 * A-Frame light element
 */
class AFrameLight implements AFrameElement {
    tagName: string = 'a-light'
    attributes: AFrameAttribute[] = []
    children: AFrameElement[] = []

    addAttribute(name: string, value: string | number | boolean): void {
        this.attributes.push({ name, value })
    }

    addChild(child: AFrameElement): void {
        this.children.push(child)
    }

    setPosition(position: string): void {
        this.attributes = this.attributes.filter((attr) => attr.name !== 'position')
        this.addAttribute('position', position)
    }

    setType(type: string): void {
        this.attributes = this.attributes.filter((attr) => attr.name !== 'type')
        this.addAttribute('type', type)
    }

    setColor(color: string): void {
        this.attributes = this.attributes.filter((attr) => attr.name !== 'color')
        this.addAttribute('color', color)
    }

    setIntensity(intensity: number): void {
        this.attributes = this.attributes.filter((attr) => attr.name !== 'intensity')
        this.addAttribute('intensity', intensity)
    }

    setDistance(distance: number): void {
        this.attributes = this.attributes.filter((attr) => attr.name !== 'distance')
        this.addAttribute('distance', distance)
    }
}

/**
 * Converter class that transforms UPDL scene into A-Frame model
 */
export class UPDLToAFrameConverter {
    // Current marker settings
    private markerType: string = 'pattern'
    private markerValue: string = 'hiro'

    /**
     * Set marker options for the conversion
     * @param markerType Type of marker ('pattern', 'barcode', 'custom')
     * @param markerValue Value of the marker (e.g., 'hiro', 'kanji', or a barcode number)
     */
    setMarkerOptions(markerType: string, markerValue: string): void {
        this.markerType = markerType
        this.markerValue = markerValue
    }

    /**
     * Convert UPDL scene to A-Frame model
     * @param scene UPDL scene to convert
     * @returns A-Frame scene model
     */
    convertScene(scene: UPDLScene): AFrameScene {
        // Create base scene
        const aframeScene = this.createDefaultScene()

        // Add marker
        const marker = this.createMarker()
        aframeScene.addChild(marker)

        // Process objects
        scene.objects.forEach((object) => {
            const entity = this.convertObject(object)
            marker.addChild(entity)
        })

        // Process cameras (if any custom cameras)
        if (scene.cameras && scene.cameras.length > 0) {
            scene.cameras.forEach((camera) => {
                const cameraEntity = this.convertCamera(camera)
                marker.addChild(cameraEntity)
            })
        }

        // Process lights
        if (scene.lights && scene.lights.length > 0) {
            scene.lights.forEach((light) => {
                const lightEntity = this.convertLight(light)
                marker.addChild(lightEntity)
            })
        }

        return aframeScene
    }

    /**
     * Create default A-Frame scene
     * @returns Default A-Frame scene
     */
    private createDefaultScene(): AFrameScene {
        const scene = new AFrameScene()
        scene.addAttribute('embedded', true)
        scene.addAttribute('arjs', 'sourceType: webcam; debugUIEnabled: false;')
        return scene
    }

    /**
     * Create a marker entity based on current settings
     * @returns A-Frame marker entity
     */
    private createMarker(): AFrameMarker {
        const marker = new AFrameMarker()

        if (this.markerType === 'pattern') {
            if (this.markerValue === 'hiro') {
                marker.setPreset('hiro')
            } else if (this.markerValue === 'kanji') {
                marker.setPreset('kanji')
            } else {
                marker.setType('pattern')
                marker.setPattern(this.markerValue)
            }
        } else if (this.markerType === 'barcode') {
            marker.setType('barcode')
            marker.setValue(this.markerValue)
        } else if (this.markerType === 'custom') {
            marker.setType('pattern')
            marker.setPattern(this.markerValue)
        }

        return marker
    }

    /**
     * Convert UPDL object to A-Frame entity
     * @param object UPDL object to convert
     * @returns A-Frame entity
     */
    private convertObject(object: UPDLObject): AFrameEntity {
        const entity = new AFrameEntity()

        // Set basic properties
        entity.setPosition(this.formatVector3(object.position))
        entity.setRotation(this.formatVector3(object.rotation))
        entity.setScale(this.formatVector3(object.scale))

        // Create primitive based on object type
        switch (object.type.toLowerCase()) {
            case 'box':
                const box = new AFramePrimitive('a-box')
                box.setWidth(object.width || 1)
                box.setHeight(object.height || 1)
                box.setDepth(object.depth || 1)
                box.setColor(this.formatColor(object.color))
                entity.addChild(box)
                break

            case 'sphere':
                const sphere = new AFramePrimitive('a-sphere')
                sphere.setRadius(object.radius || 1)
                sphere.setColor(this.formatColor(object.color))
                entity.addChild(sphere)
                break

            case 'cylinder':
                const cylinder = new AFramePrimitive('a-cylinder')
                cylinder.setRadius(object.radius || 1)
                cylinder.setHeight(object.height || 2)
                cylinder.setColor(this.formatColor(object.color))
                entity.addChild(cylinder)
                break

            default:
                // Default to a box
                const defaultBox = new AFramePrimitive('a-box')
                defaultBox.setColor(this.formatColor(object.color))
                entity.addChild(defaultBox)
                break
        }

        return entity
    }

    /**
     * Convert UPDL camera to A-Frame camera entity
     * @param camera UPDL camera to convert
     * @returns A-Frame camera entity
     */
    private convertCamera(camera: UPDLCamera): AFrameCamera {
        const cameraEntity = new AFrameCamera()

        // Set basic properties
        cameraEntity.setPosition(this.formatVector3(camera.position))
        cameraEntity.setRotation(this.formatVector3(camera.rotation))

        // Set camera-specific properties
        if (camera.fov) {
            cameraEntity.setFov(camera.fov)
        }

        if (camera.near) {
            cameraEntity.setNear(camera.near)
        }

        if (camera.far) {
            cameraEntity.setFar(camera.far)
        }

        return cameraEntity
    }

    /**
     * Convert UPDL light to A-Frame light entity
     * @param light UPDL light to convert
     * @returns A-Frame light entity
     */
    private convertLight(light: UPDLLight): AFrameLight {
        const lightEntity = new AFrameLight()

        // Set basic properties
        lightEntity.setPosition(this.formatVector3(light.position))

        // Set light type
        lightEntity.setType(light.type)

        // Set light-specific properties
        if (light.color) {
            lightEntity.setColor(this.formatColor(light.color))
        }

        if (light.intensity) {
            lightEntity.setIntensity(light.intensity)
        }

        if (light.distance) {
            lightEntity.setDistance(light.distance)
        }

        return lightEntity
    }

    /**
     * Format Vector3 for A-Frame (convert to string)
     * @param vector Vector3 object
     * @returns Formatted string
     */
    private formatVector3(vector: Vector3): string {
        if (!vector) return '0 0 0'
        return `${vector.x || 0} ${vector.y || 0} ${vector.z || 0}`
    }

    /**
     * Format Color for A-Frame (convert to hex string)
     * @param color Color object
     * @returns Formatted color string
     */
    private formatColor(color?: Color): string {
        if (!color) return '#FFFFFF'

        // Convert RGB (0-1) to hex
        const r = Math.floor((color.r || 1) * 255)
            .toString(16)
            .padStart(2, '0')
        const g = Math.floor((color.g || 1) * 255)
            .toString(16)
            .padStart(2, '0')
        const b = Math.floor((color.b || 1) * 255)
            .toString(16)
            .padStart(2, '0')

        return `#${r}${g}${b}`
    }
}
