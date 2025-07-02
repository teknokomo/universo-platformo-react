// Universo Platformo | Common builder types
// REFACTORED: Contains only frontend-specific builder types
// UPDL structure types moved to @universo/publish-srv

import type { ILibraryConfig } from '@universo/publish-srv'

/**
 * Result of a build operation
 */
export interface BuildResult {
    success: boolean
    html?: string
    error?: string
    metadata?: {
        buildTime: number
        markerType: string
        markerValue: string
        libraryVersions: {
            arjs: string
            aframe: string
        }
    }
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
    libraryConfig?: ILibraryConfig
    markerType?: string
    markerValue?: string
    debug?: boolean
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
    name: string
    version: string
    supportedMarkerTypes: string[]
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
export interface BuildError {
    code: string
    message: string
    details?: any
}

export class BuildErrorClass extends Error {
    constructor(message: string, public code: string = 'BUILD_ERROR', public details?: any) {
        super(message)
        this.name = 'BuildError'
    }
}

// Types removed: UPDL structure types and LibraryConfig now imported from @universo/publish-srv
// This file now contains only frontend-specific builder types
