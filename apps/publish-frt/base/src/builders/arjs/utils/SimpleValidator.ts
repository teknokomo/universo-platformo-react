// Universo Platformo | Simple Validator Utility
// Basic validation utilities for UPDL objects

/**
 * Simple validation utilities for UPDL objects
 */
export class SimpleValidator {
    /**
     * Validate that value is a number and within range
     */
    static isValidNumber(value: any, min?: number, max?: number): boolean {
        if (typeof value !== 'number' || isNaN(value)) {
            return false
        }

        if (min !== undefined && value < min) {
            return false
        }

        if (max !== undefined && value > max) {
            return false
        }

        return true
    }

    /**
     * Validate that value is a non-empty string
     */
    static isValidString(value: any, minLength = 1): boolean {
        return typeof value === 'string' && value.length >= minLength
    }

    /**
     * Validate position object
     */
    static isValidPosition(position: any): boolean {
        return position && this.isValidNumber(position.x) && this.isValidNumber(position.y) && this.isValidNumber(position.z)
    }

    /**
     * Validate color object
     */
    static isValidColor(color: any): boolean {
        if (!color) return false

        return (
            this.isValidNumber(color.r, 0, 255) &&
            this.isValidNumber(color.g, 0, 255) &&
            this.isValidNumber(color.b, 0, 255) &&
            (color.a === undefined || this.isValidNumber(color.a, 0, 1))
        )
    }

    /**
     * Validate that object has required properties
     */
    static hasRequiredProperties(obj: any, requiredProps: string[]): boolean {
        if (!obj || typeof obj !== 'object') {
            return false
        }

        return requiredProps.every((prop) => obj.hasOwnProperty(prop))
    }

    /**
     * Sanitize string for HTML output
     */
    static sanitizeString(value: any): string {
        if (typeof value !== 'string') {
            return ''
        }

        return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
    }

    /**
     * Clamp number to range
     */
    static clamp(value: number, min: number, max: number): number {
        return Math.min(Math.max(value, min), max)
    }

    /**
     * Safe number conversion with default
     */
    static toNumber(value: any, defaultValue = 0): number {
        const num = Number(value)
        return isNaN(num) ? defaultValue : num
    }
}
