// Universo Platformo | Publisher Interfaces
// TypeScript interfaces for the Publisher component

// Import UPDLFlow from our local types file
import { UPDLFlow } from './types'

/**
 * Properties for the Publisher component
 */
export interface PublisherProps {
    /**
     * UPDL flow to be published
     */
    flow: UPDLFlow

    /**
     * ID of the exporter to use
     */
    exporterId?: string

    /**
     * Optional publishing options
     */
    options?: Record<string, any>

    /**
     * Called when publishing is complete
     */
    onPublish: (result: PublishResult) => void

    /**
     * Called when the user cancels
     */
    onCancel: () => void

    /**
     * Initial configuration options
     */
    initialConfig?: PublisherConfig

    /**
     * Callback when publishing starts
     */
    onPublishStart?: () => void

    /**
     * Callback when publishing completes successfully
     */
    onPublishSuccess?: (result: PublishResult) => void

    /**
     * Callback when publishing fails
     */
    onPublishError?: (error: PublishError) => void
}

/**
 * Result of a successful publishing operation
 */
export interface PublishResult {
    /**
     * Indicates if publishing was successful
     */
    success: boolean

    /**
     * URL where the published content can be accessed
     * Only present when success is true
     */
    publishedUrl?: string

    /**
     * Error message if publishing failed
     * Only present when success is false
     */
    error?: string

    /**
     * Additional metadata about the publishing operation
     */
    metadata?: {
        /**
         * ID of the exporter used
         */
        exporterId?: string

        /**
         * Timestamp of the publishing operation
         */
        timestamp?: string

        /**
         * Options used during publishing
         */
        options?: Record<string, any>

        /**
         * Any additional metadata
         */
        [key: string]: any
    }
}

/**
 * Error details when publishing fails
 */
export interface PublishError {
    /**
     * Error message
     */
    message: string

    /**
     * Error code if available
     */
    code?: string

    /**
     * Additional error details
     */
    details?: any
}

/**
 * Configuration for the publisher
 */
export interface PublisherConfig {
    exporterId: string
    options?: Record<string, any>
}

/**
 * Props for exporter-specific publisher components (mini-apps)
 */
export interface MiniAppPublisherProps {
    /** The flow to publish */
    flow: UPDLFlow

    /** Called when publishing is complete */
    onPublish: (result: PublishResult) => void

    /** Called when the user cancels */
    onCancel: () => void

    /** Initial configuration options */
    initialConfig?: Record<string, any>
}

/**
 * Interface for an exporter
 */
export interface Exporter {
    /** Unique identifier for the exporter */
    id: string

    /** Display name for the exporter */
    name: string

    /** Description of the exporter */
    description: string

    /** Features supported by this exporter */
    features: string[]

    /** Icon URL for the exporter */
    iconUrl?: string
}
