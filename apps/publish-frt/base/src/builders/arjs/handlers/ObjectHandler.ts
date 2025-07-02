// Universo Platformo | AR.js Object Handler
// Handles processing of UPDL Object nodes for AR.js
// Logic transferred from UPDLToARJSConverter.ts

import { IUPDLObject, IUPDLMultiScene } from '@universo/publish-srv'
import { BuildOptions } from '../../common/types'
import { SimpleValidator } from '../utils/SimpleValidator'

/**
 * Processes UPDL Object nodes for AR.js generation
 */
export class ObjectHandler {
    /**
     * Process objects array
     * @param objects Array of UPDL objects
     * @param options Build options
     * @returns HTML string with A-Frame object elements
     */
    process(objects: IUPDLObject[], options: BuildOptions = {}): string {
        try {
            console.log(`[ObjectHandler] Processing ${objects?.length || 0} objects`)

            // If no objects, create a default red cube
            if (!objects || objects.length === 0) {
                console.log(`[ObjectHandler] No objects provided, using default cube`)
                return '<a-box position="0 0.5 0" material="color: #FF0000;" scale="1 1 1"></a-box>\n'
            }

            // ✅ FIX: Validate and position objects
            const validatedObjects = SimpleValidator.validateObjects(objects)
            console.log(
                `[ObjectHandler] Validated ${validatedObjects.length} objects (removed ${objects.length - validatedObjects.length} invalid)`
            )

            // Choose layout: 'circle' (legacy) or 'line' (default MVP)
            const layout = options.layout === 'circle' ? 'circle' : 'line'
            const positionedObjects =
                layout === 'circle' ? this.applyCircularPositioning(validatedObjects) : this.applyLinearPositioning(validatedObjects)
            console.log(`[ObjectHandler] Applied ${layout} positioning for ${positionedObjects.length} objects`)

            // Process each object
            let content = ''
            for (const obj of positionedObjects) {
                content += this.generateObjectElement(obj)
            }

            console.log(`[ObjectHandler] Generated HTML for ${positionedObjects.length} objects`)
            return content
        } catch (error) {
            console.error('[ObjectHandler] Error processing objects:', error)
            // In case of error, return a simple red cube
            return '<a-box position="0 0.5 0" material="color: #FF0000;" scale="1 1 1"></a-box>\n'
        }
    }

    /**
     * Universo Platformo | Process objects by scenes for multi-scene functionality
     * @param multiScene Multi-scene data structure
     * @param options Build options
     * @returns HTML string with A-Frame object elements associated with scenes
     */
    processMultiScene(multiScene: IUPDLMultiScene, options: BuildOptions = {}): string {
        try {
            console.log(`[ObjectHandler] Processing multi-scene with ${multiScene.totalScenes} scenes`)

            if (!multiScene.scenes || multiScene.scenes.length === 0) {
                console.log(`[ObjectHandler] No scenes provided, using default cube`)
                return '<a-box position="0 0.5 0" material="color: #FF0000;" scale="1 1 1"></a-box>\n'
            }

            let content = ''

            // Process objects for each scene
            multiScene.scenes.forEach((scene, sceneIndex) => {
                const objects = scene.objectNodes || []

                if (objects.length === 0) {
                    console.log(`[ObjectHandler] No objects in scene ${sceneIndex}, skipping`)
                    return
                }

                console.log(`[ObjectHandler] Processing ${objects.length} objects for scene ${sceneIndex}`)

                // Validate objects for this scene
                const validatedObjects = SimpleValidator.validateObjects(objects)

                // Choose layout: 'circle' (legacy) or 'line' (default MVP)
                const layout = options.layout === 'circle' ? 'circle' : 'line'
                const positionedObjects =
                    layout === 'circle' ? this.applyCircularPositioning(validatedObjects) : this.applyLinearPositioning(validatedObjects)

                // Generate objects with scene association
                positionedObjects.forEach((obj) => {
                    content += this.generateObjectElementWithScene(obj, sceneIndex)
                })
            })

            console.log(`[ObjectHandler] Generated multi-scene objects HTML`)
            return content
        } catch (error) {
            console.error('[ObjectHandler] Error processing multi-scene objects:', error)
            return '<a-box position="0 0.5 0" material="color: #FF0000;" scale="1 1 1"></a-box>\n'
        }
    }

    /**
     * Generates A-Frame HTML element for UPDL object with scene association
     * @param object UPDL object
     * @param sceneIndex Scene index for visibility control
     * @returns HTML string with element
     */
    private generateObjectElementWithScene(object: any, sceneIndex: number): string {
        if (!object || !object.type) {
            return ''
        }

        try {
            // Get common attributes
            const position = this.getPositionString(object.position)
            const scale = this.getScaleString(object.scale)
            const color = this.getColorString(object)
            const rotation = this.getRotationString(object.rotation)

            // Scene visibility attributes
            const isVisible = sceneIndex === 0
            const sceneAttributes = `data-scene-id="${sceneIndex}" visible="${isVisible ? 'true' : 'false'}"`

            // Universo Platformo | Debug object visibility with proper position string
            console.log(
                `[ObjectHandler] Scene ${sceneIndex} Object: type=${object.type}, position="${position}", scale="${scale}", color="${color}", visible=${isVisible}`
            )

            // Determine object type and create corresponding A-Frame element
            switch (object.type.toLowerCase()) {
                case 'box':
                    const boxElement = `<a-box 
                position="${position}"
                rotation="${rotation}"
                material="color: ${color};"
                scale="${scale}"
                ${sceneAttributes}
            ></a-box>\n`
                    console.log(`[ObjectHandler] Generated box element: ${boxElement.replace(/\n/g, ' ').trim()}`)
                    return boxElement

                case 'sphere':
                    // Universo Platformo | Normalize sphere radius to 0.5 for consistent size with boxes
                    const rawRadiusScene = object.geometry?.radius ?? object.radius ?? 1
                    const normalizedRadiusScene = 0.5 // Set to 0.5 to match box size (1x1x1 box ≈ 1 diameter sphere)
                    const sphereElement = `<a-sphere 
                position="${position}"
                material="color: ${color};"
                radius="${normalizedRadiusScene}"
                scale="${scale}"
                ${sceneAttributes}
            ></a-sphere>\n`
                    console.log(`[ObjectHandler] Generated sphere element: ${sphereElement.replace(/\n/g, ' ').trim()}`)
                    return sphereElement

                case 'cylinder':
                    return `<a-cylinder 
                position="${position}"
                rotation="${rotation}"
                material="color: ${color};"
                radius="${object.radius || 0.5}"
                height="${object.height || 1}"
                scale="${scale}"
                ${sceneAttributes}
            ></a-cylinder>\n`

                case 'plane':
                    return `<a-plane 
                position="${position}"
                material="color: ${color};"
                width="${object.width || 1}"
                height="${object.height || 1}"
                rotation="${object.rotation?.x || -90} ${object.rotation?.y || 0} ${object.rotation?.z || 0}"
                scale="${scale}"
                ${sceneAttributes}
            ></a-plane>\n`

                case 'text':
                    return `<a-text 
                position="${position}"
                rotation="${rotation}"
                value="${this.escapeHtml(object.value || 'Text')}"
                color="${color}"
                width="${object.width || 10}"
                align="${object.align || 'center'}"
                scale="${scale}"
                ${sceneAttributes}
            ></a-text>\n`

                case 'circle':
                    return `<a-circle 
                position="${position}"
                rotation="${rotation}"
                material="color: ${color};"
                radius="${object.radius || 0.5}"
                scale="${scale}"
                ${sceneAttributes}
            ></a-circle>\n`

                case 'cone':
                    return `<a-cone 
                position="${position}"
                rotation="${rotation}"
                material="color: ${color};"
                radius-bottom="${object.radiusBottom || 0.5}"
                radius-top="${object.radiusTop || 0}"
                height="${object.height || 1}"
                scale="${scale}"
                ${sceneAttributes}
            ></a-cone>\n`

                // Default, if type is not defined, create a cube
                default:
                    const defaultElement = `<a-box 
                position="${position}"
                rotation="${rotation}"
                material="color: ${color};"
                scale="${scale}"
                ${sceneAttributes}
            ></a-box>\n`
                    console.log(`[ObjectHandler] Generated default box element: ${defaultElement.replace(/\n/g, ' ').trim()}`)
                    return defaultElement
            }
        } catch (error) {
            console.error(`[ObjectHandler] Error generating object element:`, error)
            return ''
        }
    }

    /**
     * Generates A-Frame HTML element for UPDL object
     * @param object UPDL object
     * @returns HTML string with element
     */
    private generateObjectElement(object: any): string {
        if (!object || !object.type) {
            return ''
        }

        try {
            // Get common attributes
            const position = this.getPositionString(object.position)
            const scale = this.getScaleString(object.scale)
            const color = this.getColorString(object)
            const rotation = this.getRotationString(object.rotation)

            // Determine object type and create corresponding A-Frame element
            switch (object.type.toLowerCase()) {
                case 'box':
                    return `<a-box 
                position="${position}"
                rotation="${rotation}"
                material="color: ${color};"
                scale="${scale}"
            ></a-box>\n`

                case 'sphere':
                    // Universo Platformo | Normalize sphere radius to 0.5 for consistent size with boxes
                    const rawRadius = object.geometry?.radius ?? object.radius ?? 1
                    const normalizedRadius = 0.5 // Set to 0.5 to match box size (1x1x1 box ≈ 1 diameter sphere)
                    return `<a-sphere 
                position="${position}"
                material="color: ${color};"
                radius="${normalizedRadius}"
                scale="${scale}"
            ></a-sphere>\n`

                case 'cylinder':
                    return `<a-cylinder 
                position="${position}"
                rotation="${rotation}"
                material="color: ${color};"
                radius="${object.radius || 0.5}"
                height="${object.height || 1}"
                scale="${scale}"
            ></a-cylinder>\n`

                case 'plane':
                    return `<a-plane 
                position="${position}"
                material="color: ${color};"
                width="${object.width || 1}"
                height="${object.height || 1}"
                rotation="${object.rotation?.x || -90} ${object.rotation?.y || 0} ${object.rotation?.z || 0}"
                scale="${scale}"
            ></a-plane>\n`

                case 'text':
                    return `<a-text 
                position="${position}"
                rotation="${rotation}"
                value="${this.escapeHtml(object.value || 'Text')}"
                color="${color}"
                width="${object.width || 10}"
                align="${object.align || 'center'}"
                scale="${scale}"
            ></a-text>\n`

                case 'circle':
                    return `<a-circle 
                position="${position}"
                rotation="${rotation}"
                material="color: ${color};"
                radius="${object.radius || 0.5}"
                scale="${scale}"
            ></a-circle>\n`

                case 'cone':
                    return `<a-cone 
                position="${position}"
                rotation="${rotation}"
                material="color: ${color};"
                radius-bottom="${object.radiusBottom || 0.5}"
                radius-top="${object.radiusTop || 0}"
                height="${object.height || 1}"
                scale="${scale}"
            ></a-cone>\n`

                // Default, if type is not defined, create a cube
                default:
                    return `<a-box 
                position="${position}"
                rotation="${rotation}"
                material="color: ${color};"
                scale="${scale}"
            ></a-box>\n`
            }
        } catch (error) {
            return ''
        }
    }

    /**
     * Formats position string from object
     */
    private getPositionString(position: any): string {
        if (!position) return '0 0.5 0'
        return `${position.x || 0} ${position.y || 0.5} ${position.z || 0}`
    }

    /**
     * Formats scale string from object
     */
    private getScaleString(scale: any): string {
        if (!scale) return '1 1 1'
        return `${scale.x || 1} ${scale.y || 1} ${scale.z || 1}`
    }

    /**
     * Formats rotation string from object
     */
    private getRotationString(rotation: any): string {
        if (!rotation) return '0 0 0'
        return `${rotation.x || 0} ${rotation.y || 0} ${rotation.z || 0}`
    }

    /**
     * Gets color string from object (supports both legacy and new format)
     */
    private getColorString(object: any): string {
        // Legacy format support (direct color string)
        if (typeof object.color === 'string') {
            return object.color
        }

        // New format support (material.color object)
        if (object.material?.color) {
            const { r, g, b } = object.material.color
            // Convert RGB (0-1) to hex
            const toHex = (c: number) =>
                Math.round(c * 255)
                    .toString(16)
                    .padStart(2, '0')
            return `#${toHex(r)}${toHex(g)}${toHex(b)}`
        }

        return '#FF0000' // default red
    }

    /**
     * ✅ FIX: Apply circular positioning to prevent overlaps
     * @param objects Array of UPDL objects
     * @returns Objects with adjusted positions
     */
    private applyCircularPositioning(objects: IUPDLObject[]): IUPDLObject[] {
        if (!objects || objects.length === 0) {
            return []
        }

        // Universo Platformo | Apply circular positioning for better AR visualization
        const radius = 0.5 // Reduced from 2.0 to 0.5 for better visibility
        const angleStep = (2 * Math.PI) / objects.length

        console.log(`[ObjectHandler] Positioning ${objects.length} objects in circle with radius ${radius.toFixed(2)}`)

        return objects.map((obj, index) => {
            const angle = index * angleStep
            const x = Math.cos(angle) * radius
            const z = Math.sin(angle) * radius

            return {
                ...obj,
                position: {
                    x: parseFloat(x.toFixed(2)),
                    y: obj.position?.y || 0.5,
                    z: parseFloat(z.toFixed(2))
                }
            }
        })
    }

    // Universo Platformo | Arrange objects in a straight line along X axis (MVP layout)
    private applyLinearPositioning(objects: IUPDLObject[]): IUPDLObject[] {
        if (!objects || objects.length === 0) return []

        const spacing = 1.5 // meters between objects – increased for better separation
        const startX = -((objects.length - 1) * spacing) / 2 // center the row on marker

        console.log(
            `[ObjectHandler] Positioning ${objects.length} objects in line with spacing ${spacing.toFixed(2)} (startX=${startX.toFixed(2)})`
        )

        return objects.map((obj, index): IUPDLObject => {
            const x = +(startX + index * spacing).toFixed(2)
            return {
                ...obj,
                position: {
                    x,
                    y: obj.position?.y ?? 0.5,
                    z: obj.position?.z ?? 0
                }
            }
        })
    }

    /**
     * Simple method for HTML escaping
     * @param text Original text
     * @returns Escaped text
     */
    private escapeHtml(text: string): string {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
    }
}
