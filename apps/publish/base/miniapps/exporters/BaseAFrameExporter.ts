/**
 * Universo Platformo | Base A-Frame Exporter
 * Provides common functionality for exporters that generate A-Frame HTML
 */

import { UPDLScene, UPDLObject, UPDLCamera, UPDLLight, Vector3, Color } from '../../api/updlApi'
import { BaseExporter, ExportOptions, ValidationResult } from './BaseExporter'
import { AFrameScene, AFrameEntity, createDefaultScene } from '../aframe/models/AFrameModel'

/**
 * A-Frame specific export options
 */
export interface AFrameExportOptions extends ExportOptions {
    aframeVersion?: string
}

/**
 * Base class for A-Frame-based exporters like AR.js and A-Frame VR
 */
export abstract class BaseAFrameExporter extends BaseExporter {
    // A-Frame version for script tags
    protected aframeVersion = '1.4.2'

    /**
     * Constructor that can set version
     * @param aframeVersion - Optional A-Frame version
     */
    constructor(aframeVersion?: string) {
        super()
        if (aframeVersion) {
            this.aframeVersion = aframeVersion
        }
    }

    /**
     * Common implementation of HTML generation
     * @param updlScene - UPDL scene to export
     * @param options - Export options
     * @returns Generated HTML string
     */
    generateHTML(updlScene: UPDLScene, options?: AFrameExportOptions): string {
        try {
            // Set version if provided in options
            if (options?.aframeVersion) {
                this.aframeVersion = options.aframeVersion
            }

            // Ensure the scene has required elements
            const completeScene = this.ensureCompleteScene(updlScene)

            // Validate scene
            const validation = this.validateScene(completeScene)
            if (!validation.valid) {
                throw new Error(`Invalid scene: ${validation.errors.join(', ')}`)
            }

            // Convert UPDL to A-Frame model (implemented by subclasses)
            const aframeScene = this.convertToAFrameModel(completeScene)

            // Generate HTML from A-Frame model
            return this.generateHTMLFromModel(aframeScene, options?.title || 'A-Frame Scene')
        } catch (err) {
            const errorMessage = this.handleError(err)
            throw new Error(`Failed to generate HTML: ${errorMessage}`)
        }
    }

    /**
     * Common scene validation logic for A-Frame exporters
     * @param scene - UPDL scene to validate
     * @returns Validation result
     */
    validateScene(scene: UPDLScene): ValidationResult {
        const errors: string[] = []

        // Check if scene exists
        if (!scene) {
            errors.push('Scene is undefined or null')
            return { valid: false, errors }
        }

        // Check if scene has an ID
        if (!scene.id) {
            errors.push('Scene has no ID')
        }

        // Additional validations can be implemented by subclasses

        return {
            valid: errors.length === 0,
            errors
        }
    }

    /**
     * Format Vector to string with x, y, z values
     * @param vector Vector object with x, y, z properties
     * @returns Formatted string for A-Frame attributes
     */
    protected formatVector(vector: Vector3 | undefined | null): string {
        if (!vector) {
            return '0 0 0' // Default value
        }

        const x = vector.x !== undefined ? vector.x : 0
        const y = vector.y !== undefined ? vector.y : 0
        const z = vector.z !== undefined ? vector.z : 0

        return `${x} ${y} ${z}`
    }

    /**
     * Format Color to string in hex format
     * @param color Color object with r, g, b properties
     * @returns Formatted color string for A-Frame
     */
    protected formatColor(color: Color | undefined | null): string {
        if (!color) {
            return '#FFFFFF' // Default white
        }

        const r = Math.max(0, Math.min(255, color.r !== undefined ? color.r : 0))
        const g = Math.max(0, Math.min(255, color.g !== undefined ? color.g : 0))
        const b = Math.max(0, Math.min(255, color.b !== undefined ? color.b : 0))

        // Convert to hex
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    }

    /**
     * Get common HTML document header with A-Frame script
     * @param title - HTML document title
     * @returns HTML header string
     */
    protected getHtmlHeader(title: string): string {
        return `<!DOCTYPE html>
<html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${this.escapeHtml(title)}</title>
        <script src="https://aframe.io/releases/${this.aframeVersion}/aframe.min.js"></script>`
    }

    /**
     * Get common HTML document body with A-Frame script
     * @returns HTML body opening
     */
    protected getHtmlBodyOpen(): string {
        return `
    <body style="margin: 0; overflow: hidden;">`
    }

    /**
     * Get common HTML document closing tags
     * @returns HTML closing tags
     */
    protected getHtmlClosing(): string {
        return `
    </body>
</html>`
    }

    /**
     * Escape HTML special characters to prevent XSS
     * @param str - String to escape
     * @returns Escaped string
     */
    protected escapeHtml(str: string): string {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
    }

    /**
     * Generate entity HTML from A-Frame entity model
     * @param entity - A-Frame entity
     * @param indent - Indentation level
     * @returns Entity HTML
     */
    protected generateEntityHtml(entity: AFrameEntity, indent: number = 0): string {
        // Format attributes as string
        const attributes = this.formatAttributes(entity.attributes)

        // Create indentation string
        const indentation = ' '.repeat(indent)

        // Create opening tag
        const openTag = `<${entity.tag}${attributes.length > 0 ? ' ' + attributes : ''}>`

        // If no children, create self-closing tag
        if (entity.children.length === 0) {
            return `${indentation}${openTag}</${entity.tag}>`
        }

        // Generate HTML for children with increased indentation
        const childrenHtml = entity.children.map((child) => this.generateEntityHtml(child, indent + 2)).join('\n')

        // Return complete entity with children
        return `${indentation}${openTag}\n${childrenHtml}\n${indentation}</${entity.tag}>`
    }

    /**
     * Format entity attributes as HTML attribute string
     * @param attributes - Object containing attribute key-value pairs
     * @returns Formatted attribute string
     */
    protected formatAttributes(attributes: Record<string, any>): string {
        return Object.entries(attributes)
            .map(([key, value]) => {
                // Skip undefined or null values
                if (value === undefined || value === null) {
                    return ''
                }

                // Format boolean attributes
                if (typeof value === 'boolean') {
                    return value ? key : ''
                }

                // Format other attributes with escaped values
                return `${key}="${this.escapeHtml(value.toString())}"`
            })
            .filter((attr) => attr !== '') // Remove empty entries
            .join(' ')
    }

    /**
     * Convert UPDL scene to A-Frame model
     * Implemented by subclasses to provide technology-specific conversion
     * @param scene - UPDL scene
     * @returns A-Frame scene model
     */
    protected abstract convertToAFrameModel(scene: UPDLScene): AFrameScene

    /**
     * Generate HTML from A-Frame model
     * @param scene - A-Frame scene model
     * @param title - Document title
     * @returns Complete HTML document
     */
    protected abstract generateHTMLFromModel(scene: AFrameScene, title: string): string
}
