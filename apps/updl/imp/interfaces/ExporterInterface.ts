// Universo Platformo | Exporter Interfaces
// Defines the interfaces for UPDL exporters

import { UPDLFlow, ExporterOptions, Asset } from './UPDLInterfaces'

/**
 * Validation result for UPDL flow validation
 */
export interface ValidationResult {
    /**
     * Whether the flow is valid for this exporter
     */
    valid: boolean

    /**
     * List of error messages if validation failed
     */
    errors?: string[]

    /**
     * List of warning messages (flow can still be exported)
     */
    warnings?: string[]
}

/**
 * Result of an export operation
 */
export interface ExportResult {
    /**
     * Format of the exported content
     */
    format: 'html' | 'js' | 'jsx' | 'zip'

    /**
     * Main file of the export
     */
    mainFile: {
        filename: string
        content: string
    }

    /**
     * Additional assets required by the export
     */
    assets?: Asset[]
}

/**
 * Interface for an exporter implementation
 */
export interface ExporterInterface {
    /**
     * Unique identifier for the exporter
     */
    id: string

    /**
     * Display name for the exporter
     */
    name: string

    /**
     * Description of the exporter
     */
    description: string

    /**
     * Features supported by this exporter
     */
    supportedFeatures: string[]

    /**
     * Validate if a flow can be exported with this exporter
     */
    validate(flow: UPDLFlow): ValidationResult

    /**
     * Export a flow using this exporter
     */
    export(flow: UPDLFlow, options: ExporterOptions): Promise<ExportResult>
}

/**
 * Information about an exporter for UI display
 */
export interface ExporterInfo {
    id: string
    name: string
    description: string
    supportedFeatures: string[]
}
