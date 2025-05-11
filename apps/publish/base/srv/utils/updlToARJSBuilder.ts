// Universo Platformo | UPDL to AR.js Builder for Express
// Adapter between Express and UPDL module for AR.js export

import { Request } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { UPDLScene, UPDLFlowResult } from './interfaces/UPDLInterfaces'

/**
 * Creates a UPDL scene based on request data for subsequent AR.js export
 * @param req - Express request
 * @param isInternal - Flag for internal call
 * @returns Result of UPDL scene construction for AR.js export
 */
export const utilBuildUPDLforARJS = async (req: Request, isInternal: boolean = false): Promise<UPDLFlowResult> => {
    try {
        const chatflowid = req.params.id
        const flowData = req.body.flowData || { nodes: [], edges: [] }
        const chatId = req.body.chatId || uuidv4()

        // Extract scene nodes
        const nodes = flowData.nodes || []
        const edges = flowData.edges || []

        // Find scene node
        const sceneNode = nodes.find((node: any) => node.data?.name?.toLowerCase() === 'scene')

        if (!sceneNode) {
            throw new Error('Scene node not found in flow')
        }

        // Find object nodes
        const objectNodes = nodes.filter((node: any) => node.data?.name?.toLowerCase() === 'object')

        // Find camera nodes
        const cameraNodes = nodes.filter((node: any) => node.data?.name?.toLowerCase() === 'camera')

        // Find light nodes
        const lightNodes = nodes.filter((node: any) => node.data?.name?.toLowerCase() === 'light')

        // Build array of objects
        const objects = objectNodes.map((node: any) => {
            const nodeData = node.data || {}
            return {
                id: node.id,
                name: nodeData.label || 'Object',
                type: nodeData.inputs?.type || 'box',
                position: nodeData.inputs?.position || { x: 0, y: 0, z: 0 },
                rotation: nodeData.inputs?.rotation || { x: 0, y: 0, z: 0 },
                scale: nodeData.inputs?.scale || { x: 1, y: 1, z: 1 },
                color: nodeData.inputs?.color || { r: 1, g: 1, b: 1 },
                width: nodeData.inputs?.width,
                height: nodeData.inputs?.height,
                depth: nodeData.inputs?.depth,
                radius: nodeData.inputs?.radius
            }
        })

        // Build array of cameras
        const cameras = cameraNodes.map((node: any) => {
            const nodeData = node.data || {}
            return {
                id: node.id,
                name: nodeData.label || 'Camera',
                type: nodeData.inputs?.type || 'perspective',
                position: nodeData.inputs?.position || { x: 0, y: 0, z: 5 },
                rotation: nodeData.inputs?.rotation || { x: 0, y: 0, z: 0 },
                scale: nodeData.inputs?.scale || { x: 1, y: 1, z: 1 },
                fov: nodeData.inputs?.fov || 75,
                near: nodeData.inputs?.near || 0.1,
                far: nodeData.inputs?.far || 1000,
                lookAt: nodeData.inputs?.lookAt
            }
        })

        // Build array of lights
        const lights = lightNodes.map((node: any) => {
            const nodeData = node.data || {}
            return {
                id: node.id,
                name: nodeData.label || 'Light',
                type: nodeData.inputs?.type || 'ambient',
                position: nodeData.inputs?.position || { x: 0, y: 0, z: 0 },
                rotation: nodeData.inputs?.rotation || { x: 0, y: 0, z: 0 },
                scale: nodeData.inputs?.scale || { x: 1, y: 1, z: 1 },
                color: nodeData.inputs?.color || { r: 1, g: 1, b: 1 },
                intensity: nodeData.inputs?.intensity || 1,
                distance: nodeData.inputs?.distance,
                decay: nodeData.inputs?.decay
            }
        })

        // Create and return scene
        const scene: UPDLScene = {
            id: sceneNode.id,
            name: sceneNode.data?.label || 'UPDL Scene for AR.js',
            objects,
            cameras,
            lights
        }

        // If cameras are not defined, add a default camera for AR.js
        if (!scene.cameras || scene.cameras.length === 0) {
            scene.cameras = [
                {
                    id: 'default-camera',
                    name: 'Default AR.js Camera',
                    type: 'perspective',
                    position: { x: 0, y: 0, z: 5 },
                    rotation: { x: 0, y: 0, z: 0 },
                    scale: { x: 1, y: 1, z: 1 },
                    fov: 75,
                    near: 0.1,
                    far: 1000
                }
            ]
        }

        // If lights are not defined, add a default light for AR.js
        if (!scene.lights || scene.lights.length === 0) {
            scene.lights = [
                {
                    id: 'default-light',
                    name: 'Default AR.js Light',
                    type: 'ambient',
                    position: { x: 0, y: 0, z: 0 },
                    rotation: { x: 0, y: 0, z: 0 },
                    scale: { x: 1, y: 1, z: 1 },
                    color: { r: 1, g: 1, b: 1 },
                    intensity: 0.8
                }
            ]
        }

        // Return result
        return {
            chatId,
            scene,
            updlScene: scene
        }
    } catch (error) {
        console.error('[server]: UPDL to AR.js Build Error:', error)
        throw error
    }
}
