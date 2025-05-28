// Universo Platformo | AR.js Object Handler
// Handles processing of UPDL Object nodes for AR.js
// Logic transferred from UPDLToARJSConverter.ts

import { IUPDLObject } from '../../../../../../../packages/server/src/Interface.UPDL'
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

            const positionedObjects = this.applyCircularPositioning(validatedObjects)
            console.log(`[ObjectHandler] Applied circular positioning for ${positionedObjects.length} objects`)

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
                    return `<a-sphere 
                position="${position}"
                material="color: ${color};"
                radius="${object.geometry?.radius || object.radius || 0.5}"
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
        if (objects.length <= 1) {
            console.log(`[ObjectHandler] Single object, no positioning needed`)
            return objects // Single object doesn't need repositioning
        }

        const radius = Math.max(1.5, objects.length * 0.5) // Dynamic radius
        const angleStep = (2 * Math.PI) / objects.length
        console.log(`[ObjectHandler] Positioning ${objects.length} objects in circle with radius ${radius.toFixed(2)}`)

        return objects.map((obj, index) => {
            const angle = index * angleStep
            const x = Math.cos(angle) * radius
            const z = Math.sin(angle) * radius

            return {
                ...obj,
                position: {
                    x: Number(x.toFixed(2)),
                    y: obj.position?.y || 0.5, // Keep original Y or default
                    z: Number(z.toFixed(2))
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
