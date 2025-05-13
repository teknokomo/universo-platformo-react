// Universo Platformo | Exporter Registry
// Registry for managing available exporters

import { Exporter } from '../interfaces/ExporterInterface'

/**
 * Registry that manages available exporters
 */
export class ExporterRegistry {
    /**
     * Map of registered exporters
     */
    private exporters: Map<string, Exporter> = new Map()

    /**
     * Register an exporter with the registry
     * @param exporter Exporter to register
     */
    register(exporter: Exporter): void {
        const info = exporter.getInfo()
        this.exporters.set(info.id, exporter)
    }

    /**
     * Get an exporter by ID
     * @param id Exporter ID
     * @returns Exporter or undefined if not found
     */
    get(id: string): Exporter | undefined {
        return this.exporters.get(id)
    }

    /**
     * Get all registered exporters
     * @returns Array of all exporters
     */
    getAll(): Exporter[] {
        return Array.from(this.exporters.values())
    }

    /**
     * Get exporters that support a specific feature
     * @param feature Feature to filter by
     * @returns Array of exporters supporting the feature
     */
    getByFeature(feature: string): Exporter[] {
        return this.getAll().filter((exporter) => {
            const info = exporter.getInfo()
            return info.supportedFeatures.includes(feature)
        })
    }

    /**
     * Get exporters by platform
     * @param platform Platform to filter by
     * @returns Array of exporters supporting the platform
     */
    getByPlatform(platform: string): Exporter[] {
        return this.getAll().filter((exporter) => {
            const info = exporter.getInfo()
            return info.supportedPlatforms?.includes(platform)
        })
    }

    /**
     * Get exporters by format
     * @param format Format to filter by
     * @returns Array of exporters supporting the format
     */
    getByFormat(format: string): Exporter[] {
        return this.getAll().filter((exporter) => {
            const info = exporter.getInfo()
            return info.supportedFormats?.includes(format)
        })
    }
}
