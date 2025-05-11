// Universo Platformo | UPDL Scene Builder
// Builds a UPDL scene from nodes

import { UPDLNode, UPDLGraph } from './interfaces/UPDLInterfaces'

/**
 * Edge connecting UPDL nodes
 */
export interface UPDLEdge {
    id: string
    source: string
    target: string
    label?: string
    type?: string
    data?: Record<string, any>
}

/**
 * Extended node interface for internal use
 */
export interface UPDLNodeExtended extends UPDLNode {
    data?: Record<string, any>
    position?: { x: number; y: number }
}

/**
 * Scene node structure
 */
export interface SceneNode extends UPDLNodeExtended {
    name: string
    backgroundColor?: string
    skybox?: {
        enabled: boolean
        texture?: string
    }
    fog?: {
        enabled: boolean
        color?: string
        density?: number
    }
    children?: Array<ObjectNode | CameraNode | LightNode>
}

/**
 * Object node structure
 */
export interface ObjectNode extends UPDLNodeExtended {
    name: string
    objectType: 'primitive' | 'model'
    primitiveType?: 'box' | 'sphere' | 'cylinder' | 'cone' | 'plane' | 'torus'
    modelURL?: string
    position: { x: number; y: number; z: number }
    rotation: { x: number; y: number; z: number }
    scale: { x: number; y: number; z: number }
    material: {
        color: string
        opacity: number
    }
    children?: Array<ObjectNode | CameraNode | LightNode>
}

/**
 * Camera node structure
 */
export interface CameraNode extends UPDLNodeExtended {
    name: string
    cameraType: 'perspective' | 'orthographic'
    worldPosition: { x: number; y: number; z: number }
    lookAt: { x: number; y: number; z: number }
    fov?: number
    near: number
    far: number
    orthographicSize?: number
    active: boolean
}

/**
 * Light node structure
 */
export interface LightNode extends UPDLNodeExtended {
    name: string
    lightType: 'ambient' | 'directional' | 'point' | 'spot'
    color: string
    intensity: number
    worldPosition: { x: number; y: number; z: number }
    direction: { x: number; y: number; z: number }
    distance?: number
    decay?: number
    angle?: number
    penumbra?: number
    castShadow: boolean
}

/**
 * UPDL Scene Builder class
 * Builds a UPDL scene from Flowise nodes
 */
export class UPDLSceneBuilder {
    private nodes: UPDLNodeExtended[] = []
    private edges: UPDLEdge[] = []
    private sceneNode: SceneNode | null = null
    private objectNodes: ObjectNode[] = []
    private cameraNodes: CameraNode[] = []
    private lightNodes: LightNode[] = []

    /**
     * Constructor
     * @param nodes Array of nodes from Flowise
     * @param edges Optional array of edges from Flowise
     */
    constructor(nodes: any[], edges?: any[]) {
        // Convert Flowise nodes to UPDL nodes
        this.nodes = nodes.map((node) => this.convertToUPDLNode(node))

        // Set edges if provided
        if (edges) {
            this.edges = edges.map((edge) => this.convertToUPDLEdge(edge))
        }

        // Categorize nodes by type
        this.nodes.forEach((node) => {
            if (node.type === 'UPDLSceneNode') {
                this.sceneNode = node as SceneNode
            } else if (node.type === 'UPDLObjectNode') {
                this.objectNodes.push(node as ObjectNode)
            } else if (node.type === 'UPDLCameraNode') {
                this.cameraNodes.push(node as CameraNode)
            } else if (node.type === 'UPDLLightNode') {
                this.lightNodes.push(node as LightNode)
            }
        })
    }

    /**
     * Convert a Flowise node to a UPDL node
     * @param node Flowise node
     * @returns UPDL node
     */
    private convertToUPDLNode(node: any): UPDLNodeExtended {
        return {
            id: node.id,
            type: node.type,
            name: node.data?.name || '',
            data: node.data || {},
            position: {
                x: node.position?.x || 0,
                y: node.position?.y || 0
            }
        }
    }

    /**
     * Convert a Flowise edge to a UPDL edge
     * @param edge Flowise edge
     * @returns UPDL edge
     */
    private convertToUPDLEdge(edge: any): UPDLEdge {
        return {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            label: edge.label || '',
            type: edge.type || 'default',
            data: edge.data || {}
        }
    }

    /**
     * Build the scene
     * @returns Scene structure
     */
    public buildScene(): SceneNode {
        if (!this.sceneNode) {
            throw new Error('No scene node found')
        }

        // Build the scene with children
        const sceneNode: SceneNode = {
            ...this.sceneNode,
            children: []
        }

        // Add direct children to scene
        const directSceneChildren = this.getDirectChildren(this.sceneNode.id)
        sceneNode.children = directSceneChildren

        // Add hierarchical children to objects
        this.buildHierarchy()

        return sceneNode
    }

    /**
     * Get direct children of a node
     * @param nodeId Parent node ID
     * @returns Array of child nodes
     */
    private getDirectChildren(nodeId: string): Array<ObjectNode | CameraNode | LightNode> {
        const children: Array<ObjectNode | CameraNode | LightNode> = []

        // Find edges connecting to the parent node
        const childEdges = this.edges.filter((edge) => edge.source === nodeId)

        // Add connected nodes
        childEdges.forEach((edge) => {
            const childNode = this.nodes.find((node) => node.id === edge.target)
            if (childNode) {
                if (childNode.type === 'UPDLObjectNode') {
                    children.push(childNode as ObjectNode)
                } else if (childNode.type === 'UPDLCameraNode') {
                    children.push(childNode as CameraNode)
                } else if (childNode.type === 'UPDLLightNode') {
                    children.push(childNode as LightNode)
                }
            }
        })

        return children
    }

    /**
     * Build the hierarchy of nodes (parent-child relationships)
     */
    private buildHierarchy() {
        // Process all object nodes to assign children
        this.objectNodes.forEach((objectNode) => {
            const children = this.getDirectChildren(objectNode.id)
            if (children.length > 0) {
                objectNode.children = children
            }
        })
    }

    /**
     * Add default elements if missing
     */
    public addDefaults() {
        // Add default camera if none exists
        if (this.cameraNodes.length === 0) {
            const defaultCamera: CameraNode = {
                id: 'default-camera',
                type: 'UPDLCameraNode',
                name: 'Default Camera',
                data: {},
                position: { x: 0, y: 0 },
                cameraType: 'perspective',
                fov: 75,
                near: 0.1,
                far: 1000,
                worldPosition: { x: 0, y: 1.6, z: 5 },
                lookAt: { x: 0, y: 0, z: 0 },
                active: true
            }

            this.cameraNodes.push(defaultCamera)

            // Add default camera to scene
            if (this.sceneNode && this.sceneNode.children) {
                this.sceneNode.children.push(defaultCamera)
            }
        }

        // Add default ambient light if no lights exist
        if (this.lightNodes.length === 0) {
            const defaultAmbientLight: LightNode = {
                id: 'default-ambient-light',
                type: 'UPDLLightNode',
                name: 'Default Ambient Light',
                data: {},
                position: { x: 0, y: 0 },
                lightType: 'ambient',
                color: '#ffffff',
                intensity: 0.5,
                worldPosition: { x: 0, y: 0, z: 0 },
                direction: { x: 0, y: 0, z: 0 },
                castShadow: false
            }

            this.lightNodes.push(defaultAmbientLight)

            // Add default light to scene
            if (this.sceneNode && this.sceneNode.children) {
                this.sceneNode.children.push(defaultAmbientLight)
            }
        }
    }

    /**
     * Get the scene as a UPDLGraph
     * @returns UPDL graph structure
     */
    public getGraph(): UPDLGraph {
        return {
            nodes: this.nodes,
            edges: this.edges
        }
    }

    /**
     * Get all objects in the scene
     * @returns Array of object nodes
     */
    public getObjects(): ObjectNode[] {
        return this.objectNodes
    }

    /**
     * Get all cameras in the scene
     * @returns Array of camera nodes
     */
    public getCameras(): CameraNode[] {
        return this.cameraNodes
    }

    /**
     * Get all lights in the scene
     * @returns Array of light nodes
     */
    public getLights(): LightNode[] {
        return this.lightNodes
    }

    /**
     * Get the active camera
     * @returns Active camera node or null if none is active
     */
    public getActiveCamera(): CameraNode | null {
        return this.cameraNodes.find((camera) => camera.active) || null
    }
}
