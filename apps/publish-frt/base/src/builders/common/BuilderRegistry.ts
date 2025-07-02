// Universo Platformo | Builder registry
// Central registry for managing different platform builders

import { BaseBuilder } from './BaseBuilder'
import { BuilderConfig, BuildErrorClass } from './types'

/**
 * Registry for managing platform builders
 */
export class BuilderRegistry {
    private static builders = new Map<string, typeof BaseBuilder>()

    /**
     * Register a builder for a platform
     * @param platform Platform name (e.g., 'arjs', 'playcanvas')
     * @param builderClass Builder class
     */
    static register(platform: string, builderClass: typeof BaseBuilder): void {
        this.builders.set(platform, builderClass)
    }

    /**
     * Get a builder class for a platform
     * @param platform Platform name
     * @returns Builder class or undefined
     */
    static getBuilder(platform: string): typeof BaseBuilder | undefined {
        return this.builders.get(platform)
    }

    /**
     * Create a builder instance for a platform
     * @param platform Platform name
     * @param config Builder configuration
     * @returns Builder instance
     */
    static createBuilder(platform: string, config: BuilderConfig): BaseBuilder {
        const BuilderClass = this.getBuilder(platform)
        if (!BuilderClass) {
            throw new BuildErrorClass(`Builder for platform ${platform} not found`)
        }
        return new (BuilderClass as any)(platform, config) // Cast to any to avoid abstract class instantiation error
    }

    /**
     * Get list of registered platforms
     * @returns Array of platform names
     */
    static getAvailablePlatforms(): string[] {
        return Array.from(this.builders.keys())
    }

    /**
     * Check if a platform is supported
     * @param platform Platform name
     * @returns True if platform is supported
     */
    static isSupported(platform: string): boolean {
        return this.builders.has(platform)
    }
}
