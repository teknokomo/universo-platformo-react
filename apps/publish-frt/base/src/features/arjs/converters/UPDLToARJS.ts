// Universo Platformo | UPDL to AR.js Converter
// Converts UPDL scene objects to AR.js/A-Frame model representation

import { UPDLScene, UPDLObject, UPDLCamera, UPDLLight, Vector3, Color } from '../../../api/updlApi'

/**
 * AR.js/A-Frame model interfaces (simplified)
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
 * A-Frame scene element for AR.js
 */
class ARJSScene implements AFrameElement {
    tagName: string = 'a-scene'
    attributes: AFrameAttribute[] = []
    children: AFrameElement[] = []

    constructor() {
        // Initialize with AR.js-specific attributes
        this.addAttribute('embedded', '')
        this.addAttribute('arjs', 'sourceType: webcam; debugUIEnabled: false;')
    }

    addAttribute(name: string, value: string | number | boolean): void {
        this.attributes.push({ name, value })
    }

    addChild(child: AFrameElement): void {
        this.children.push(child)
    }
}

/**
 * AR.js marker element
 */
class ARJSMarker implements AFrameElement {
    tagName: string = 'a-marker'
    attributes: AFrameAttribute[] = []
    children: AFrameElement[] = []

    constructor() {
        // Initialize with common AR.js marker attributes
        this.addAttribute('preset', 'hiro')
    }

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
 * A-Frame entity element for AR.js scene
 */
class ARJSEntity implements AFrameElement {
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
 * A-Frame primitive element for AR.js (box, sphere, etc.)
 */
class ARJSPrimitive implements AFrameElement {
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
 * A-Frame camera element for AR.js
 */
class ARJSCamera implements AFrameElement {
    tagName: string = 'a-camera'
    attributes: AFrameAttribute[] = []
    children: AFrameElement[] = []

    constructor() {
        // Initialize with AR.js specific camera settings
        this.addAttribute('look-controls', 'enabled: false')
    }

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
 * A-Frame light element for AR.js
 */
class ARJSLight implements AFrameElement {
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
 * UPDL to AR.js converter
 * Converts UPDL scene data to AR.js-compatible A-Frame elements
 */
export class UPDLToARJSConverter {
    // AR.js marker options
    private markerType: string = 'pattern'
    private markerValue: string = 'hiro'

    /**
     * Set AR.js marker options
     * @param markerType - Type of AR.js marker (pattern, barcode, custom)
     * @param markerValue - Value for the marker (e.g., hiro, kanji, pattern URL, barcode value)
     */
    setMarkerOptions(markerType: string, markerValue: string): void {
        this.markerType = markerType
        this.markerValue = markerValue
    }

    /**
     * Convert a UPDL scene to an AR.js A-Frame scene
     * @param scene - UPDL scene to convert
     * @returns AR.js A-Frame scene
     */
    convertScene(scene: UPDLScene): ARJSScene {
        if (!scene) {
            return this.createDefaultScene()
        }

        // Create a new AR.js scene
        const arjsScene = new ARJSScene()

        // Create the AR.js marker
        const marker = this.createMarker()

        // Convert UPDL objects to A-Frame entities
        if (scene.objects && scene.objects.length > 0) {
            scene.objects.forEach((object) => {
                marker.addChild(this.convertObject(object))
            })
        }

        // Convert UPDL lights to A-Frame lights
        if (scene.lights && scene.lights.length > 0) {
            scene.lights.forEach((light) => {
                marker.addChild(this.convertLight(light))
            })
        }

        // Add marker to scene
        arjsScene.addChild(marker)

        // Add AR.js camera entity to the scene (outside the marker)
        // In AR.js, camera typically goes outside the marker
        const arCamera = new ARJSEntity()
        arCamera.addAttribute('camera', '')
        arjsScene.addChild(arCamera)

        return arjsScene
    }

    /**
     * Create a default AR.js scene
     * @returns Default AR.js scene
     */
    private createDefaultScene(): ARJSScene {
        const scene = new ARJSScene()
        const marker = this.createMarker()

        // Add a default box
        const box = new ARJSPrimitive('a-box')
        box.setPosition('0 0.5 0')
        box.setColor('#4CC3D9')
        marker.addChild(box)

        scene.addChild(marker)

        return scene
    }

    /**
     * Create an AR.js marker element
     * @returns AR.js marker element
     */
    private createMarker(): ARJSMarker {
        const marker = new ARJSMarker()

        // Configure marker based on type
        if (this.markerType === 'pattern') {
            if (['hiro', 'kanji'].includes(this.markerValue)) {
                // Use preset for well-known patterns
                marker.setPreset(this.markerValue)
            } else {
                // Use custom pattern URL
                marker.addAttribute('type', 'pattern')
                marker.addAttribute('url', this.markerValue)
            }
        } else if (this.markerType === 'barcode') {
            marker.addAttribute('type', 'barcode')
            marker.addAttribute('value', this.markerValue)
        } else if (this.markerType === 'custom') {
            // Custom markers may have additional attributes
            marker.addAttribute('type', 'pattern')
            marker.addAttribute('url', this.markerValue)
        }

        return marker
    }

    /**
     * Convert a UPDL object to an AR.js A-Frame element
     * @param object - UPDL object to convert
     * @returns AR.js A-Frame element
     */
    private convertObject(object: UPDLObject): AFrameElement {
        // Determine the appropriate A-Frame primitive tag based on object type
        let primitive: ARJSPrimitive

        switch (object.type.toLowerCase()) {
            case 'box':
                primitive = new ARJSPrimitive('a-box')
                if (object.width) primitive.setWidth(object.width)
                if (object.height) primitive.setHeight(object.height)
                if (object.depth) primitive.setDepth(object.depth)
                break
            case 'sphere':
                primitive = new ARJSPrimitive('a-sphere')
                if (object.radius) primitive.setRadius(object.radius)
                break
            case 'cylinder':
                primitive = new ARJSPrimitive('a-cylinder')
                if (object.radius) primitive.setRadius(object.radius)
                if (object.height) primitive.setHeight(object.height)
                break
            case 'plane':
                primitive = new ARJSPrimitive('a-plane')
                if (object.width) primitive.setWidth(object.width)
                if (object.height) primitive.setHeight(object.height)
                break
            case 'cone':
                primitive = new ARJSPrimitive('a-cone')
                if (object.radius) primitive.setRadius(object.radius)
                if (object.height) primitive.setHeight(object.height)
                break
            default:
                // Default to a box if type is not recognized
                primitive = new ARJSPrimitive('a-box')
                break
        }

        // Set common attributes
        primitive.setPosition(this.formatVector3(object.position))
        primitive.setRotation(this.formatVector3(object.rotation))
        primitive.setScale(this.formatVector3(object.scale))

        // Set color if available
        if (object.color) {
            primitive.setColor(this.formatColor(object.color))
        }

        return primitive
    }

    /**
     * Convert a UPDL camera to an AR.js A-Frame camera
     * @param camera - UPDL camera to convert
     * @returns AR.js A-Frame camera
     */
    private convertCamera(camera: UPDLCamera): ARJSCamera {
        const arjsCamera = new ARJSCamera()

        // Set position and rotation
        arjsCamera.setPosition(this.formatVector3(camera.position))
        arjsCamera.setRotation(this.formatVector3(camera.rotation))

        // Set camera-specific attributes
        if (camera.fov) {
            arjsCamera.setFov(camera.fov)
        }

        if (camera.near) {
            arjsCamera.setNear(camera.near)
        }

        if (camera.far) {
            arjsCamera.setFar(camera.far)
        }

        // In AR.js, we typically add some camera attributes for better AR experience
        arjsCamera.addAttribute('look-controls', 'enabled: false')
        arjsCamera.addAttribute('camera-transform-controls', 'enabled: false')

        return arjsCamera
    }

    /**
     * Convert a UPDL light to an AR.js A-Frame light
     * @param light - UPDL light to convert
     * @returns AR.js A-Frame light
     */
    private convertLight(light: UPDLLight): ARJSLight {
        const arjsLight = new ARJSLight()

        // Set light type
        arjsLight.setType(light.type.toLowerCase())

        // Set position for non-ambient lights
        if (light.type.toLowerCase() !== 'ambient' && light.position) {
            arjsLight.setPosition(this.formatVector3(light.position))
        }

        // Set color if available
        if (light.color) {
            arjsLight.setColor(this.formatColor(light.color))
        }

        // Set intensity if available
        if (light.intensity !== undefined) {
            arjsLight.setIntensity(light.intensity)
        }

        // Set distance for point and spot lights
        if (['point', 'spot'].includes(light.type.toLowerCase()) && light.distance !== undefined) {
            arjsLight.setDistance(light.distance)
        }

        return arjsLight
    }

    /**
     * Format a Vector3 object to a string
     * @param vector - Vector3 object to format
     * @returns Formatted string
     */
    private formatVector3(vector: Vector3): string {
        if (!vector) {
            return '0 0 0'
        }

        const x = vector.x !== undefined ? vector.x : 0
        const y = vector.y !== undefined ? vector.y : 0
        const z = vector.z !== undefined ? vector.z : 0

        return `${x} ${y} ${z}`
    }

    /**
     * Format a Color object to a string
     * @param color - Color object to format
     * @returns Formatted color string
     */
    private formatColor(color?: Color): string {
        if (!color) {
            return '#FFFFFF'
        }

        // Convert from 0-1 range to 0-255 range
        const r = Math.floor((color.r !== undefined ? color.r : 1) * 255)
        const g = Math.floor((color.g !== undefined ? color.g : 1) * 255)
        const b = Math.floor((color.b !== undefined ? color.b : 1) * 255)

        // Convert to hex string
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    }
}
