/**
 * Universo Platformo | Base Exporter
 * Defines the common interface and functionality for all exporters
 */

import { UPDLScene } from '../../api/updlApi'

/**
 * Result of scene validation
 */
export interface ValidationResult {
    valid: boolean
    errors: string[]
}

/**
 * Export options interface for all exporters
 */
export interface ExportOptions {
    title?: string
    version?: string
    [key: string]: any
}

/**
 * Base class for all UPDL exporters
 */
export abstract class BaseExporter {
    /**
     * Generate HTML export from a UPDL scene
     * @param updlScene - UPDL scene to export
     * @param options - Export options
     * @returns Generated HTML string
     */
    abstract generateHTML(updlScene: UPDLScene, options?: ExportOptions): string

    /**
     * Ensure the scene has all required components
     * @param scene - UPDL scene to validate and complete
     * @returns Complete UPDL scene
     */
    abstract ensureCompleteScene(scene: UPDLScene): UPDLScene

    /**
     * Validate a UPDL scene for export
     * @param scene - UPDL scene to validate
     * @returns Validation result object
     */
    abstract validateScene(scene: UPDLScene): ValidationResult

    /**
     * Handle error during export
     * @param error - Error object or message
     * @returns Error message
     */
    protected handleError(error: unknown): string {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Export error: ${errorMessage}`, error)
        return errorMessage
    }

    /**
     * Get the exporter name
     * @returns Name of the exporter
     */
    abstract getName(): string

    /**
     * Get the exporter description
     * @returns Description of the exporter
     */
    abstract getDescription(): string
}
