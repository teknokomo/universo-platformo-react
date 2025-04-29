// Universo Platformo | A-Frame HTML Generator
// Generates HTML from A-Frame model objects

import { AFrameEntity, AFrameScene, AFrameTagType } from '../models/AFrameModel'

/**
 * Generator for creating HTML from A-Frame model entities
 */
export class AFrameHTMLGenerator {
    // A-Frame version for script tags
    private aframeVersion = '1.4.2'
    private arjsVersion = '3.4.5'

    /**
     * Generate complete HTML document from A-Frame scene
     * @param scene - A-Frame scene model
     * @param title - Title for HTML document
     * @returns Complete HTML document as string
     */
    generate(scene: AFrameScene, title: string = 'AR.js Scene'): string {
        // Create HTML document with A-Frame and AR.js scripts
        return `<!DOCTYPE html>
<html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${this.escapeHtml(title)}</title>
        <script src="https://aframe.io/releases/${this.aframeVersion}/aframe.min.js"></script>
        <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"></script>
    </head>
    <body style="margin: 0; overflow: hidden;">
        ${this.generateEntity(scene, 2)}
    </body>
</html>`
    }

    /**
     * Generate HTML for a single A-Frame entity and its children
     * @param entity - A-Frame entity to generate HTML for
     * @param indent - Indentation level for pretty printing
     * @returns HTML string for the entity
     */
    private generateEntity(entity: AFrameEntity, indent: number = 0): string {
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
        const childrenHtml = entity.children.map((child) => this.generateEntity(child, indent + 2)).join('\n')

        // Return complete entity with children
        return `${indentation}${openTag}\n${childrenHtml}\n${indentation}</${entity.tag}>`
    }

    /**
     * Format entity attributes as HTML attribute string
     * @param attributes - Object containing attribute key-value pairs
     * @returns Formatted attribute string
     */
    private formatAttributes(attributes: Record<string, any>): string {
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
     * Escape HTML special characters to prevent XSS
     * @param str - String to escape
     * @returns Escaped string
     */
    private escapeHtml(str: string): string {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
    }

    /**
     * Set the A-Frame version to use
     * @param version - A-Frame version string
     */
    setAFrameVersion(version: string): void {
        this.aframeVersion = version
    }

    /**
     * Set the AR.js version to use
     * @param version - AR.js version string
     */
    setARJSVersion(version: string): void {
        this.arjsVersion = version
    }
}
