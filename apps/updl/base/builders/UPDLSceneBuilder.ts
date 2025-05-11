import {
    UPDLNode,
    UPDLScene,
    UPDLObject,
    UPDLCamera,
    UPDLLight,
    UPDLInteraction,
    UPDLSceneGraph,
    UPDLDirectionalLight
} from '../interfaces/UPDLInterfaces'

/**
 * Builder class for creating UPDL scenes from node collections
 */
export class UPDLSceneBuilder {
    private scene: UPDLScene | null = null
    private objects: UPDLObject[] = []
    private cameras: UPDLCamera[] = []
    private lights: UPDLLight[] = []
    private interactions: UPDLInteraction[] = []
    private errors: string[] = []
    private warnings: string[] = []

    /**
     * Clear the builder state
     */
    public clear(): void {
        this.scene = null
        this.objects = []
        this.cameras = []
        this.lights = []
        this.interactions = []
        this.errors = []
        this.warnings = []
    }

    /**
     * Add a UPDL node to the scene
     * @param node Node to add
     * @returns True if node was added successfully
     */
    public addNode(node: UPDLNode): boolean {
        // Skip nodes without type
        if (!node.type) {
            this.errors.push(`Node ${node.id} has no type and will be ignored`)
            return false
        }

        try {
            // Handle node based on its type
            if (node.type === 'scene') {
                return this.addScene(node as UPDLScene)
            } else if (['box', 'sphere', 'cylinder', 'plane', 'model'].includes(node.type)) {
                return this.addObject(node as UPDLObject)
            } else if (['perspective', 'orthographic', 'ar'].includes(node.type)) {
                return this.addCamera(node as UPDLCamera)
            } else if (['ambient', 'directional', 'point', 'spot', 'hemisphere'].includes(node.type)) {
                return this.addLight(node as UPDLLight)
            } else if (['click', 'hover', 'drag'].includes(node.type)) {
                return this.addInteraction(node as UPDLInteraction)
            } else {
                this.warnings.push(`Unknown node type '${node.type}' for node ${node.id}`)
                return false
            }
        } catch (error) {
            this.errors.push(`Error adding node ${node.id}: ${error instanceof Error ? error.message : String(error)}`)
            return false
        }
    }

    /**
     * Add a scene node
     * @param scene Scene node to add
     * @returns True if scene was added successfully
     */
    private addScene(scene: UPDLScene): boolean {
        if (this.scene) {
            this.warnings.push('Multiple scene nodes found, only using the first one')
            return false
        }

        this.scene = scene
        return true
    }

    /**
     * Add an object node
     * @param object Object node to add
     * @returns True if object was added successfully
     */
    private addObject(object: UPDLObject): boolean {
        // Ensure required properties
        if (!object.position) {
            object.position = { x: 0, y: 0, z: 0 }
        }

        if (!object.rotation) {
            object.rotation = { x: 0, y: 0, z: 0 }
        }

        if (!object.scale) {
            object.scale = { x: 1, y: 1, z: 1 }
        }

        this.objects.push(object)
        return true
    }

    /**
     * Add a camera node
     * @param camera Camera node to add
     * @returns True if camera was added successfully
     */
    private addCamera(camera: UPDLCamera): boolean {
        // Ensure required properties
        if (!camera.position) {
            camera.position = { x: 0, y: 1.6, z: 5 }
        }

        if (!camera.rotation) {
            camera.rotation = { x: 0, y: 0, z: 0 }
        }

        // Set default values
        if (camera.type === 'perspective' && !camera.fov) {
            camera.fov = 75
        }

        if (!camera.near) {
            camera.near = 0.1
        }

        if (!camera.far) {
            camera.far = 1000
        }

        this.cameras.push(camera)
        return true
    }

    /**
     * Add a light node
     * @param light Light node to add
     * @returns True if light was added successfully
     */
    private addLight(light: UPDLLight): boolean {
        // Ensure required properties
        if (!light.color) {
            light.color = { r: 255, g: 255, b: 255 }
        }

        if (!light.intensity) {
            light.intensity = 1.0
        }

        // Check position for lights that require it
        if (['directional', 'point', 'spot'].includes(light.type) && !light.hasOwnProperty('position')) {
            if (light.type === 'directional') {
                ;(light as any).position = { x: 1, y: 1, z: 1 }
            } else {
                ;(light as any).position = { x: 0, y: 1, z: 0 }
            }
        }

        this.lights.push(light)
        return true
    }

    /**
     * Add an interaction node
     * @param interaction Interaction node to add
     * @returns True if interaction was added successfully
     */
    private addInteraction(interaction: UPDLInteraction): boolean {
        // Check if target object exists
        if (!interaction.target) {
            this.errors.push(`Interaction ${interaction.id} has no target`)
            return false
        }

        // Validate target existence
        const targetExists = this.objects.some((obj) => obj.id === interaction.target)
        if (!targetExists) {
            this.warnings.push(`Interaction ${interaction.id} has target ${interaction.target} which doesn't exist yet`)
            // Still add it, the object might be added later
        }

        this.interactions.push(interaction)
        return true
    }

    /**
     * Check if the scene is valid and can be built
     * @returns True if the scene is valid
     */
    public isValid(): boolean {
        if (!this.scene) {
            this.errors.push('No scene node found')
            return false
        }

        if (this.objects.length === 0) {
            this.warnings.push('Scene has no objects')
        }

        if (this.cameras.length === 0) {
            this.warnings.push('Scene has no cameras, a default camera will be added')
        }

        if (this.lights.length === 0) {
            this.warnings.push('Scene has no lights, default lighting will be added')
        }

        return this.errors.length === 0
    }

    /**
     * Create a default scene if none exists
     */
    private ensureScene(): void {
        if (!this.scene) {
            this.scene = {
                id: 'default-scene',
                type: 'scene',
                name: 'Default Scene'
            }
            this.warnings.push('Created default scene')
        }
    }

    /**
     * Create a default camera if none exists
     */
    private ensureCamera(): void {
        if (this.cameras.length === 0) {
            const defaultCamera: UPDLCamera = {
                id: 'default-camera',
                type: 'perspective',
                position: { x: 0, y: 1.6, z: 5 },
                rotation: { x: 0, y: 0, z: 0 },
                fov: 75,
                near: 0.1,
                far: 1000,
                active: true
            }

            this.cameras.push(defaultCamera)
            this.warnings.push('Added default perspective camera')
        }
    }

    /**
     * Create default lighting if none exists
     */
    private ensureLights(): void {
        if (this.lights.length === 0) {
            // Add ambient light
            const ambientLight: UPDLLight = {
                id: 'default-ambient',
                type: 'ambient',
                color: { r: 255, g: 255, b: 255 },
                intensity: 0.5
            }

            // Add directional light
            const directionalLight: UPDLDirectionalLight = {
                id: 'default-directional',
                type: 'directional',
                position: { x: 1, y: 1, z: 1 },
                color: { r: 255, g: 255, b: 255 },
                intensity: 0.8,
                castShadow: true
            }

            this.lights.push(ambientLight, directionalLight)
            this.warnings.push('Added default lighting (ambient + directional)')
        }
    }

    /**
     * Build the UPDL scene
     * @param ensureDefaults Whether to add default elements if missing
     * @returns Built UPDL scene or null if invalid
     */
    public build(ensureDefaults: boolean = true): UPDLSceneGraph | null {
        if (ensureDefaults) {
            this.ensureScene()
            this.ensureCamera()
            this.ensureLights()
        } else if (!this.isValid()) {
            return null
        }

        return {
            scene: this.scene as UPDLScene,
            objects: this.objects,
            cameras: this.cameras,
            lights: this.lights,
            interactions: this.interactions.length > 0 ? this.interactions : undefined
        }
    }

    /**
     * Get the current errors
     * @returns Array of error messages
     */
    public getErrors(): string[] {
        return [...this.errors]
    }

    /**
     * Get the current warnings
     * @returns Array of warning messages
     */
    public getWarnings(): string[] {
        return [...this.warnings]
    }
}
