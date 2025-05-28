// Universo Platformo | Simple AR.js Object Validator
// Ensures data integrity for UPDL objects before AR.js rendering

import { IUPDLObject } from '../../../../../../../packages/server/src/Interface.UPDL'

/**
 * Simple validator for UPDL objects used in AR.js generation
 */
export class SimpleValidator {
    private static validObjectTypes = ['box', 'sphere', 'cylinder', 'plane', 'text', 'circle', 'cone']

    /**
     * Validates array of UPDL objects
     * @param objects Array of objects to validate
     * @returns Validated objects with corrections applied
     */
    static validateObjects(objects: IUPDLObject[]): IUPDLObject[] {
        if (!Array.isArray(objects)) {
            return []
        }

        return objects.map((obj) => this.validateSingleObject(obj)).filter((obj) => obj !== null) as IUPDLObject[]
    }

    /**
     * Validates single UPDL object
     * @param obj Object to validate
     * @returns Validated object or null if invalid
     */
    private static validateSingleObject(obj: any): IUPDLObject | null {
        if (!obj || typeof obj !== 'object') {
            return null
        }

        return {
            id: obj.id || 'unknown',
            name: obj.name || 'Object',
            type: this.validateObjectType(obj.type),
            position: this.validatePosition(obj.position),
            rotation: this.validateRotation(obj.rotation),
            scale: this.validateScale(obj.scale),
            material: {
                color: this.validateColorObject(obj.color || obj.material?.color)
            },
            geometry: {
                width: this.validateNumber(obj.width || obj.geometry?.width, 1),
                height: this.validateNumber(obj.height || obj.geometry?.height, 1),
                depth: this.validateNumber(obj.depth || obj.geometry?.depth, 1),
                radius: this.validateNumber(obj.radius || obj.geometry?.radius, 0.5)
            }
        }
    }

    /**
     * Validates object type
     */
    private static validateObjectType(type: any): string {
        if (typeof type === 'string' && this.validObjectTypes.includes(type.toLowerCase())) {
            return type.toLowerCase()
        }
        return 'box' // default fallback
    }

    /**
     * Validates position object
     */
    private static validatePosition(position: any): { x: number; y: number; z: number } {
        return {
            x: this.validateNumber(position?.x, 0),
            y: this.validateNumber(position?.y, 0.5),
            z: this.validateNumber(position?.z, 0)
        }
    }

    /**
     * Validates rotation object
     */
    private static validateRotation(rotation: any): { x: number; y: number; z: number } {
        return {
            x: this.validateNumber(rotation?.x, 0),
            y: this.validateNumber(rotation?.y, 0),
            z: this.validateNumber(rotation?.z, 0)
        }
    }

    /**
     * Validates scale object
     */
    private static validateScale(scale: any): { x: number; y: number; z: number } {
        const defaultScale = 1
        return {
            x: this.validateNumber(scale?.x, defaultScale),
            y: this.validateNumber(scale?.y, defaultScale),
            z: this.validateNumber(scale?.z, defaultScale)
        }
    }

    /**
     * Validates color object (RGBA format)
     */
    private static validateColorObject(color: any): { r: number; g: number; b: number; a?: number } {
        // If it's a string color (legacy format), convert to RGB
        if (typeof color === 'string') {
            return this.hexToRgb(color)
        }

        // If it's already an RGB object
        if (color && typeof color === 'object') {
            return {
                r: this.validateNumber(color.r, 1),
                g: this.validateNumber(color.g, 0),
                b: this.validateNumber(color.b, 0),
                a: color.a !== undefined ? this.validateNumber(color.a, 1) : undefined
            }
        }

        return { r: 1, g: 0, b: 0 } // default red
    }

    /**
     * Converts hex color to RGB object
     */
    private static hexToRgb(hex: string): { r: number; g: number; b: number } {
        // Remove # if present
        hex = hex.replace('#', '')

        // Default to red if invalid
        if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
            return { r: 1, g: 0, b: 0 }
        }

        const r = parseInt(hex.substring(0, 2), 16) / 255
        const g = parseInt(hex.substring(2, 4), 16) / 255
        const b = parseInt(hex.substring(4, 6), 16) / 255

        return { r, g, b }
    }

    /**
     * Validates number with fallback
     */
    private static validateNumber(value: any, fallback: number): number {
        const num = Number(value)
        return isNaN(num) ? fallback : num
    }
}
