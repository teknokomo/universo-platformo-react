// Universo Platformo | Exporter Manager
// Manages the export process for UPDL flows

import { ExporterRegistry } from './ExporterRegistry'
import { UPDLFlow, ExporterOptions } from '../interfaces/UPDLInterfaces'
import { ExporterInterface, ExportResult } from '../interfaces/ExporterInterface'

/**
 * Exporter information for UI display
 */
export interface ExporterInfo {
    id: string
    name: string
    description: string
    supportedFeatures: string[]
}

/**
 * Manager for handling export operations
 */
export class ExporterManager {
    /**
     * Constructor for ExporterManager
     * @param registry Registry containing all available exporters
     */
    constructor(private registry: ExporterRegistry) {}

    /**
     * Export a UPDL flow using a specific exporter
     * @param flow UPDL flow to export
     * @param exporterId ID of the exporter to use
     * @param options Export options
     * @returns Export result with generated content
     * @throws Error if exporter not found or validation fails
     */
    async exportFlow(flow: UPDLFlow, exporterId: string, options: ExporterOptions = {}): Promise<ExportResult> {
        // Get the requested exporter
        const exporter = this.registry.get(exporterId)
        if (!exporter) {
            throw new Error(`Exporter not found: ${exporterId}`)
        }

        // Validate the flow before exporting
        const validationResult = exporter.validate(flow)
        if (!validationResult.valid) {
            throw new Error(`Validation failed for exporter ${exporter.name}: ${validationResult.errors?.join(', ')}`)
        }

        // Log warnings if any
        if (validationResult.warnings && validationResult.warnings.length > 0) {
            console.warn(`Warnings for ${exporter.name} export: ${validationResult.warnings.join(', ')}`)
        }

        console.log(`Exporting flow "${flow.name}" with ${exporter.name} exporter`)

        // Perform the export
        try {
            const result = await exporter.export(flow, options)
            console.log(`Export completed successfully with ${exporter.name}`)
            return result
        } catch (error) {
            console.error(`Export failed with ${exporter.name}:`, error)
            throw new Error(`Export failed: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    /**
     * Get information about all available exporters
     * @returns Array of exporter info objects
     */
    getAvailableExporters(): ExporterInfo[] {
        return this.registry.getAll().map((exporter) => ({
            id: exporter.id,
            name: exporter.name,
            description: exporter.description,
            supportedFeatures: exporter.supportedFeatures
        }))
    }

    /**
     * Get exporters that support a specific feature
     * @param feature Feature to filter by
     * @returns Array of exporter info objects
     */
    getExportersByFeature(feature: string): ExporterInfo[] {
        return this.registry.getByFeature(feature).map((exporter) => ({
            id: exporter.id,
            name: exporter.name,
            description: exporter.description,
            supportedFeatures: exporter.supportedFeatures
        }))
    }
}
