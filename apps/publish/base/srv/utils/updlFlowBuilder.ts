// Universo Platformo | UPDL Flow Builder для Express
// Адаптер между Express и модулем UPDL

import { Request } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { UPDLScene, UPDLFlowResult } from './interfaces/UPDLInterfaces'

// Добавляем подробные логи для отладки
console.log('🔍 [updlFlowBuilder] Начало отладки модуля')

/**
 * Создает UPDL-сцену на основе данных запроса
 * @param req - Express запрос
 * @param isInternal - Флаг внутреннего вызова
 * @returns Результат построения UPDL-сцены
 */
export const utilBuildUPDLflow = async (req: Request, isInternal: boolean = false): Promise<UPDLFlowResult> => {
    try {
        const chatflowid = req.params.id
        const flowData = req.body.flowData || { nodes: [], edges: [] }
        const chatId = req.body.chatId || uuidv4()

        // Извлекаем узлы сцены
        const nodes = flowData.nodes || []
        const edges = flowData.edges || []

        // Находим узел сцены
        const sceneNode = nodes.find((node: any) => node.data?.name?.toLowerCase() === 'scene')

        if (!sceneNode) {
            throw new Error('Scene node not found in flow')
        }

        // Находим объектные узлы
        const objectNodes = nodes.filter((node: any) => node.data?.name?.toLowerCase() === 'object')

        // Находим узлы камеры
        const cameraNodes = nodes.filter((node: any) => node.data?.name?.toLowerCase() === 'camera')

        // Находим узлы освещения
        const lightNodes = nodes.filter((node: any) => node.data?.name?.toLowerCase() === 'light')

        // Строим массив объектов
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

        // Строим массив камер
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

        // Строим массив источников света
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

        // Создаем и возвращаем сцену
        const scene: UPDLScene = {
            id: sceneNode.id,
            name: sceneNode.data?.label || 'UPDL Scene',
            objects,
            cameras,
            lights
        }

        // Если камеры не определены, добавляем камеру по умолчанию
        if (!scene.cameras || scene.cameras.length === 0) {
            scene.cameras = [
                {
                    id: 'default-camera',
                    name: 'Default Camera',
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

        // Если источники света не определены, добавляем свет по умолчанию
        if (!scene.lights || scene.lights.length === 0) {
            scene.lights = [
                {
                    id: 'default-light',
                    name: 'Default Light',
                    type: 'ambient',
                    position: { x: 0, y: 0, z: 0 },
                    rotation: { x: 0, y: 0, z: 0 },
                    scale: { x: 1, y: 1, z: 1 },
                    color: { r: 1, g: 1, b: 1 },
                    intensity: 0.8
                }
            ]
        }

        // Возвращаем результат
        return {
            chatId,
            scene,
            updlScene: scene
        }
    } catch (error) {
        console.error('[server]: UPDL Build Error:', error)
        throw error
    }
}

// Логирование параметров и результатов функций
export function someFunction(params: Record<string, any>): any {
    console.log('🔍 [updlFlowBuilder] Вызов функции с параметрами:', JSON.stringify(params))
    // ... код функции ...
    const result = { success: true, data: params }
    console.log('🔍 [updlFlowBuilder] Результат функции:', result)
    return result
}
