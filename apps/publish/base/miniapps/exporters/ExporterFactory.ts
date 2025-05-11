/**
 * Universo Platformo | Exporter Factory
 * Factory for creating appropriate exporter based on technology
 */

import { BaseExporter, ExportOptions } from './BaseExporter'
import { arjsExporter } from '../arjs/ARJSExporter'
import type { ARJSExportOptions } from '../arjs/ARJSExporter'
import { AFrameVRExporter, AFrameVRExportOptions, aframeVRExporter } from '../aframe/AFrameExporter'

/**
 * Technology types supported by the exporter factory
 */
export enum TechnologyType {
    ARJS = 'ar.js',
    AFRAME = 'aframe',
    PLAYCANVAS = 'playcanvas',
    PLAYCANVAS_REACT = 'playcanvas-react',
    BABYLONJS = 'babylonjs',
    THREEJS = 'threejs'
}

/**
 * Factory for creating exporters based on technology type
 */
export class ExporterFactory {
    // Singleton instances of exporters
    private static exporters: Map<TechnologyType, BaseExporter> = new Map()

    /**
     * Initialize factory with known exporters
     */
    static initialize(): void {
        this.registerExporter(TechnologyType.ARJS, arjsExporter as unknown as BaseExporter)
        this.registerExporter(TechnologyType.AFRAME, aframeVRExporter)
        // Future exporters will be registered here
    }

    /**
     * Register a new exporter for a specific technology
     * @param type - Technology type
     * @param exporter - Exporter instance
     */
    static registerExporter(type: TechnologyType, exporter: BaseExporter): void {
        this.exporters.set(type, exporter)
    }

    /**
     * Create an exporter for the specified technology
     * @param type - Technology type
     * @param options - Exporter-specific options
     * @returns The appropriate exporter instance
     */
    static createExporter(type: TechnologyType, options?: ExportOptions): BaseExporter {
        // Initialize exporters if not already done
        if (this.exporters.size === 0) {
            this.initialize()
        }

        // Get cached exporter if exists
        const exporter = this.exporters.get(type)
        if (exporter) {
            // Configure exporter options if applicable
            if (type === TechnologyType.ARJS && options) {
                // Configure AR.js specific options
                const arjsExporter = exporter as any
                // Future: Add code to configure AR.js options
            } else if (type === TechnologyType.AFRAME && options) {
                // Configure A-Frame VR specific options
                const aframeVRExporter = exporter as AFrameVRExporter
                aframeVRExporter.setVROptions(options as AFrameVRExportOptions)
            }
            return exporter
        }

        // If no exporter found for this technology
        throw new Error(`No exporter available for technology: ${type}`)
    }

    /**
     * Get all available technology types
     * @returns Array of available technology types
     */
    static getAvailableTechnologies(): TechnologyType[] {
        // Initialize exporters if not already done
        if (this.exporters.size === 0) {
            this.initialize()
        }
        return Array.from(this.exporters.keys())
    }

    /**
     * Get technology information (name, description)
     * @param type - Technology type
     * @returns Object with name and description
     */
    static getTechnologyInfo(type: TechnologyType): { name: string; description: string } {
        // Initialize exporters if not already done
        if (this.exporters.size === 0) {
            this.initialize()
        }

        const exporter = this.exporters.get(type)
        if (exporter) {
            return {
                name: exporter.getName(),
                description: exporter.getDescription()
            }
        }

        return {
            name: type,
            description: 'Technology not implemented yet'
        }
    }
}
