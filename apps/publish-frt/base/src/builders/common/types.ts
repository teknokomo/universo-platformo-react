// Universo Platformo | Common builder types
// Shared interfaces and types for all builders

import { IUPDLSpace } from '../../../../../../packages/server/src/Interface.UPDL'

/**
 * Result of a build operation
 */
export interface BuildResult {
    html: string
    metadata: BuildMetadata
}

/**
 * Metadata about the build process
 */
export interface BuildMetadata {
    platform: string
    generatedAt: Date
    nodeCount: number
    markerType?: string
    markerValue?: string
}

/**
 * Options for build process
 */
export interface BuildOptions {
    projectName?: string
    markerType?: string
    markerValue?: string
    [key: string]: any
}

/**
 * Configuration for a builder
 */
export interface BuilderConfig {
    platform: string
    template?: string
    aframeVersion?: string
    arjsVersion?: string
    [key: string]: any
}

/**
 * Validation result
 */
export interface ValidationResult {
    isValid: boolean
    errors: string[]
    warnings?: string[]
}

/**
 * Error thrown during build process
 */
export class BuildError extends Error {
    constructor(message: string, public errors: string[] = []) {
        super(message)
        this.name = 'BuildError'
    }
}
