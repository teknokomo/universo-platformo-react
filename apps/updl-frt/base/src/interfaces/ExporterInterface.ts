// Universo Platformo | Exporter Interface for Frontend
// Client-side interfaces for UPDL exporters

import { UPDLFlow, ExporterOptions } from './UPDLInterfaces'

/**
 * Result of the validation operation
 */
export interface ValidationResult {
    /** Whether the flow is valid for export */
    valid: boolean

    /** Error messages if invalid */
    errors?: string[]

    /** Warning messages */
    warnings?: string[]
}

/**
 * Exporter interface for UPDL flows
 */
export interface ExporterInterface {
    /** Unique ID for the exporter */
    id: string

    /** Display name */
    name: string

    /** Description */
    description?: string

    /** Features supported by this exporter */
    supportedFeatures: string[]

    /** Validate a flow for this exporter */
    validate(flow: UPDLFlow): ValidationResult

    /** Export a flow using this exporter */
    export(flow: UPDLFlow, options?: ExporterOptions): Promise<ExportResult>
}

/**
 * Result of an export operation
 */
export interface ExportResult {
    /** Format of the exported content */
    format: 'html' | 'js' | 'jsx' | 'zip' | 'other'

    /** Main output file */
    mainFile: {
        /** Filename */
        filename: string

        /** File content */
        content: string
    }

    /** Additional asset files */
    assets?: Array<{
        /** Filename */
        filename: string

        /** File content */
        content: string

        /** MIME type */
        mimeType?: string
    }>

    /** Additional metadata */
    metadata?: Record<string, any>
}

/**
 * Information about an exporter
 */
export interface ExporterInfo {
    /** Unique ID for the exporter */
    id: string

    /** Display name */
    name: string

    /** Description of the exporter */
    description?: string

    /** Features supported by this exporter */
    supportedFeatures: string[]

    /** Platforms supported by this exporter */
    supportedPlatforms?: string[]

    /** Output formats supported by this exporter */
    supportedFormats?: string[]
}
