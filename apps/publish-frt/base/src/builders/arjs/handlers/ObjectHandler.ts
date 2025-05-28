// Universo Platformo | AR.js Object Handler
// Handles processing of UPDL Object nodes for AR.js
// Logic transferred from UPDLToARJSConverter.ts

import { IUPDLObject } from '../../../../../../../packages/server/src/Interface.UPDL'
import { BuildOptions } from '../../common/types'

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
            // If no objects, create a default red cube
            if (!objects || objects.length === 0) {
                return '<a-box position="0 0.5 0" material="color: #FF0000;" scale="1 1 1"></a-box>\n'
            }

            // Process each object
            let content = ''
            for (const obj of objects) {
                content += this.generateObjectElement(obj)
            }

            return content
        } catch (error) {
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
            const color = object.color || '#FF0000'
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
                radius="${object.radius || 0.5}"
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
     * Simple method for HTML escaping
     * @param text Original text
     * @returns Escaped text
     */
    private escapeHtml(text: string): string {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
    }
}
