// Universo Platformo | Exporter Registry
// Registry for managing available exporters

import { ExporterInterface } from '../interfaces/ExporterInterface'

/**
 * Registry that manages available exporters
 */
export class ExporterRegistry {
    /**
     * Map of registered exporters
     */
    private exporters: Map<string, ExporterInterface> = new Map()

    /**
     * Register an exporter with the registry
     * @param exporter Exporter to register
     */
    register(exporter: ExporterInterface): void {
        this.exporters.set(exporter.id, exporter)
    }

    /**
     * Get an exporter by ID
     * @param id Exporter ID
     * @returns Exporter or undefined if not found
     */
    get(id: string): ExporterInterface | undefined {
        return this.exporters.get(id)
    }

    /**
     * Get all registered exporters
     * @returns Array of all exporters
     */
    getAll(): ExporterInterface[] {
        return Array.from(this.exporters.values())
    }

    /**
     * Get exporters that support a specific feature
     * @param feature Feature to filter by
     * @returns Array of exporters supporting the feature
     */
    getByFeature(feature: string): ExporterInterface[] {
        return this.getAll().filter((exporter) => exporter.supportedFeatures.includes(feature))
    }
}
