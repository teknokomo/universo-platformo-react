// Universo Platformo | Exporter Interface
// Interface definitions for UPDL exporters

import { UPDLFlow, ExporterOptions } from './UPDLInterfaces'

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

/**
 * Interface for an exporter
 */
export interface Exporter {
    /** Get information about this exporter */
    getInfo(): ExporterInfo

    /**
     * Export a UPDL flow
     * @param flow UPDL flow to export
     * @param options Export options
     */
    export(flow: UPDLFlow, options?: ExporterOptions): Promise<ExportResult>
}
