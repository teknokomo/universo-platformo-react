/**
 * ARJSExporter - Exports UPDL scenes to AR.js/A-Frame HTML
 * Handles proper scene structure, including automatic camera and lighting
 */

// Universo Platformo | UPDL AR.js Exporter
import { UPDLScene, UPDLObject, UPDLCamera, UPDLLight, Vector3, Color } from '../../api/updlApi'
import { UPDLToARJSConverter } from './converters/UPDLToARJS'
import { AFrameScene, createDefaultScene, createHiroMarker } from '../aframe/models/AFrameModel'
import { BaseAFrameExporter, AFrameExportOptions } from '../exporters/BaseAFrameExporter'
import { ARJSHTMLGenerator } from './generators/ARJSHTMLGenerator'

// A-Frame component versions to use
const AFRAME_VERSION = '1.4.2'
const ARJS_VERSION = '3.4.5'

// AR.js specific export options
export interface ARJSExportOptions {
    title?: string
    markerType?: 'pattern' | 'barcode' | 'custom'
    markerValue?: string
    includeStats?: boolean
    autoRotate?: boolean
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
 * AR.js exporter
 */
class ARJSExporter {
    /**
     * Generate HTML for AR.js from a UPDL scene
     * @param scene UPDL scene to export
     * @param options Export options
     * @returns Generated HTML
     */
    generateHTML(scene: UPDLScene, options: ARJSExportOptions = {}): string {
        if (!scene) {
            throw new Error('Scene is required for HTML generation')
        }

        // Для совместимости с потоковой генерацией
        // Если сцена содержит узлы, нужно преобразовать их в UPDL сцену
        if ('nodes' in scene) {
            console.log('📱 [ARJSExporter.generateHTML] Converting from nodes to UPDL scene format')
            scene = this.extractSceneFromUPDLNodes(scene as any)
        }

        // Defaults
        const title = options.title || 'AR.js Scene'
        const markerType = options.markerType || 'pattern'
        const markerValue = options.markerValue || 'hiro'

        // Create a converter instance
        const converter = new UPDLToARJSConverter()

        // Configure marker
        converter.setMarkerOptions(markerType, markerValue)

        // Convert UPDL scene to A-Frame model
        const aframeScene = converter.convertScene(scene)

        // Generate HTML with the AR.js scene
        const htmlGenerator = new ARJSHTMLGenerator()
        const html = htmlGenerator.generateHTML(aframeScene, {
            title,
            includeStats: options.includeStats || false,
            autoRotate: options.autoRotate || false
        })

        return html
    }

    /**
     * Преобразует узлы UPDL в сцену для AR.js
     * @param data Объект с узлами UPDL
     * @returns Объект сцены UPDL
     */
    extractSceneFromUPDLNodes(data: any): UPDLScene {
        console.log('📱 [ARJSExporter.extractSceneFromUPDLNodes] Processing nodes', {
            nodeCount: data.nodes?.length || 0
        })

        // Получаем информацию о потоке из данных
        const flowId = data.id || 'unknown-flow'
        const flowName = data.name || 'Unnamed AR.js Scene'

        // Создаем базовую сцену
        const scene: UPDLScene = {
            id: flowId,
            name: flowName,
            objects: [],
            cameras: [],
            lights: []
        }

        // Если нет узлов, возвращаем сцену по умолчанию
        if (!data.nodes || !Array.isArray(data.nodes) || data.nodes.length === 0) {
            console.warn('📱 [ARJSExporter.extractSceneFromUPDLNodes] No nodes found, returning default scene')
            return this.createDefaultScene(flowId, flowName)
        }

        // Фильтруем и обрабатываем узлы UPDL
        const nodes = data.nodes || []

        // Проходим по всем узлам и извлекаем данные для AR.js
        nodes.forEach((node: any, index: number) => {
            try {
                if (!node || !node.type) return

                console.log(`📱 [ARJSExporter.extractSceneFromUPDLNodes] Processing node ${index}:`, node.id || 'unknown', node.type)

                // Извлекаем данные из узла
                const nodeData = node.data || {}

                // Определяем тип узла и добавляем соответствующий объект
                if (node.type.toLowerCase().includes('object')) {
                    // Добавляем 3D объект
                    const position = nodeData.position || { x: 0, y: 0, z: 0 }
                    const rotation = nodeData.rotation || { x: 0, y: 0, z: 0 }
                    const scale = nodeData.scale || { x: 1, y: 1, z: 1 }
                    const color = nodeData.color || '#FF0000'

                    // Преобразуем цвет из строки hex в компоненты RGB (0-1)
                    const hexToRgb = (hex: string) => {
                        const r = parseInt(hex.slice(1, 3), 16) / 255
                        const g = parseInt(hex.slice(3, 5), 16) / 255
                        const b = parseInt(hex.slice(5, 7), 16) / 255
                        return { r, g, b }
                    }

                    const rgbColor = typeof color === 'string' ? hexToRgb(color) : { r: 1, g: 0, b: 0 }

                    // Определяем тип объекта (box, sphere, cylinder)
                    let objectType = 'box'
                    if (node.type.toLowerCase().includes('sphere')) {
                        objectType = 'sphere'
                    } else if (node.type.toLowerCase().includes('cylinder')) {
                        objectType = 'cylinder'
                    }

                    scene.objects.push({
                        id: node.id || `object-${index}`,
                        name: nodeData.name || `Object ${index}`,
                        type: objectType,
                        position,
                        rotation,
                        scale,
                        color: rgbColor
                    })
                } else if (node.type.toLowerCase().includes('camera')) {
                    // Добавляем камеру
                    scene.cameras.push({
                        id: node.id || `camera-${index}`,
                        name: nodeData.name || `Camera ${index}`,
                        type: 'perspective',
                        position: nodeData.position || { x: 0, y: 0, z: 5 },
                        rotation: nodeData.rotation || { x: 0, y: 0, z: 0 },
                        scale: nodeData.scale || { x: 1, y: 1, z: 1 }
                    })
                } else if (node.type.toLowerCase().includes('light')) {
                    // Добавляем источник света
                    scene.lights.push({
                        id: node.id || `light-${index}`,
                        name: nodeData.name || `Light ${index}`,
                        type: nodeData.type || 'ambient',
                        color: nodeData.color || { r: 1, g: 1, b: 1 },
                        intensity: nodeData.intensity || 1.0,
                        position: nodeData.position || { x: 0, y: 0, z: 0 },
                        rotation: nodeData.rotation || { x: 0, y: 0, z: 0 },
                        scale: nodeData.scale || { x: 1, y: 1, z: 1 }
                    })
                } else if (node.type.toLowerCase().includes('scene')) {
                    // Если это узел сцены, извлекаем настройки сцены
                    // (Например, фон, туман и т.д.)
                    console.log('📱 [ARJSExporter.extractSceneFromUPDLNodes] Found scene node:', node.id)
                }
            } catch (error) {
                console.error(`📱 [ARJSExporter.extractSceneFromUPDLNodes] Error processing node ${index}:`, error)
            }
        })

        // Проверяем, что в сцене есть хотя бы один объект
        if (scene.objects.length === 0) {
            console.warn('📱 [ARJSExporter.extractSceneFromUPDLNodes] No objects found, adding default cube')
            scene.objects.push({
                id: 'default-cube',
                name: 'Default Cube',
                type: 'box',
                position: { x: 0, y: 0.5, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                scale: { x: 1, y: 1, z: 1 },
                color: { r: 1, g: 0, b: 0 }
            })
        }

        // Проверяем, что в сцене есть хотя бы одна камера
        if (scene.cameras.length === 0) {
            console.warn('📱 [ARJSExporter.extractSceneFromUPDLNodes] No cameras found, adding default camera')
            scene.cameras.push({
                id: 'default-camera',
                name: 'Default Camera',
                type: 'perspective',
                position: { x: 0, y: 0, z: 5 },
                rotation: { x: 0, y: 0, z: 0 },
                scale: { x: 1, y: 1, z: 1 }
            })
        }

        // Проверяем, что в сцене есть хотя бы один источник света
        if (scene.lights.length === 0) {
            console.warn('📱 [ARJSExporter.extractSceneFromUPDLNodes] No lights found, adding default ambient light')
            scene.lights.push({
                id: 'default-light',
                name: 'Default Ambient Light',
                type: 'ambient',
                color: { r: 1, g: 1, b: 1 },
                intensity: 0.8,
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                scale: { x: 1, y: 1, z: 1 }
            })
        }

        console.log('📱 [ARJSExporter.extractSceneFromUPDLNodes] Scene generated:', {
            objects: scene.objects.length,
            cameras: scene.cameras.length,
            lights: scene.lights.length
        })

        return scene
    }

    /**
     * Создает сцену по умолчанию с базовыми объектами
     * @param id ID сцены
     * @param name Название сцены
     * @returns Объект сцены UPDL
     */
    createDefaultScene(id: string, name: string): UPDLScene {
        return {
            id,
            name,
            objects: [
                {
                    id: 'default-box',
                    name: 'Default AR.js Box',
                    type: 'box',
                    position: { x: 0, y: 0.5, z: 0 },
                    rotation: { x: 0, y: 0, z: 0 },
                    scale: { x: 1, y: 1, z: 1 },
                    color: { r: 1, g: 0, b: 0 }
                }
            ],
            cameras: [
                {
                    id: 'default-camera',
                    name: 'Default AR.js Camera',
                    type: 'perspective',
                    position: { x: 0, y: 0, z: 5 },
                    rotation: { x: 0, y: 0, z: 0 },
                    scale: { x: 1, y: 1, z: 1 }
                }
            ],
            lights: [
                {
                    id: 'default-light',
                    name: 'Default AR.js Light',
                    type: 'ambient',
                    color: { r: 1, g: 1, b: 1 },
                    intensity: 0.8,
                    position: { x: 0, y: 0, z: 0 },
                    rotation: { x: 0, y: 0, z: 0 },
                    scale: { x: 1, y: 1, z: 1 }
                }
            ]
        }
    }

    /**
     * Ensures a scene has all required components for AR.js
     * @param scene - UPDL scene to complete
     * @returns Complete UPDL scene for AR.js
     */
    ensureCompleteScene(scene: UPDLScene): UPDLScene {
        if (!scene) return null as any

        const updatedScene = { ...scene }

        // Ensure objects array exists
        if (!updatedScene.objects || !Array.isArray(updatedScene.objects) || updatedScene.objects.length === 0) {
            updatedScene.objects = [
                {
                    id: 'default-box',
                    name: 'Default AR.js Box',
                    type: 'box',
                    position: { x: 0, y: 0, z: 0 },
                    rotation: { x: 0, y: 0, z: 0 },
                    scale: { x: 1, y: 1, z: 1 },
                    color: { r: 1, g: 1, b: 1 }
                }
            ]
        }

        // Ensure cameras array exists
        if (!updatedScene.cameras || !Array.isArray(updatedScene.cameras) || updatedScene.cameras.length === 0) {
            updatedScene.cameras = [
                {
                    id: 'default-camera',
                    name: 'Default AR.js Camera',
                    type: 'perspective',
                    position: { x: 0, y: 0, z: 5 },
                    rotation: { x: 0, y: 0, z: 0 },
                    scale: { x: 1, y: 1, z: 1 }
                }
            ]
        }

        // Ensure lights array exists
        if (!updatedScene.lights || !Array.isArray(updatedScene.lights) || updatedScene.lights.length === 0) {
            updatedScene.lights = [
                {
                    id: 'default-light',
                    name: 'Default AR.js Light',
                    type: 'ambient',
                    color: { r: 1, g: 1, b: 1 },
                    intensity: 0.8,
                    position: { x: 0, y: 0, z: 0 },
                    rotation: { x: 0, y: 0, z: 0 },
                    scale: { x: 1, y: 1, z: 1 }
                }
            ]
        }

        return updatedScene
    }

    /**
     * Validates a UPDL scene for AR.js export
     * @param scene - UPDL scene to validate
     * @returns True if valid for AR.js, false otherwise
     */
    validateScene(scene: UPDLScene): boolean {
        if (!scene) return false
        if (!scene.id) return false

        // Minimal validation - at least needs objects or cameras
        return (
            (scene.objects && Array.isArray(scene.objects) && scene.objects.length > 0) ||
            (scene.cameras && Array.isArray(scene.cameras) && scene.cameras.length > 0)
        )
    }

    /**
     * Handles errors in the AR.js export process
     * @param error - Error to handle
     */
    handleError(error: Error): void {
        console.error('AR.js Exporter Error:', error)
    }

    /**
     * Gets the name of the exporter
     * @returns Exporter name
     */
    getName(): string {
        return 'AR.js'
    }

    /**
     * Gets the description of the exporter
     * @returns Exporter description
     */
    getDescription(): string {
        return 'Exports UPDL scenes to AR.js format for web-based augmented reality'
    }
}

// Create singleton instance
export const arjsExporter = new ARJSExporter()

// Export the class as well for type usage if needed elsewhere, though singleton is preferred for instantiation
export { ARJSExporter }
