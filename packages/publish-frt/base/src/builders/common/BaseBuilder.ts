// Universo Platformo | Base builder abstract class
// Provides common functionality for all builders

import { IUPDLSpace } from '@universo/types'
import { BuildResult, BuildOptions, BuilderConfig, ValidationResult } from './types'

/**
 * Abstract base class for all UPDL builders
 */
export abstract class BaseBuilder {
    protected platform: string
    protected config: BuilderConfig

    constructor(
        platform: string,
        config: BuilderConfig = {
            platform,
            name: 'BaseBuilder',
            version: '1.0.0',
            supportedMarkerTypes: []
        }
    ) {
        this.platform = platform
        this.config = config
    }

    /**
     * Main build method that all builders must implement
     * @param updlSpace UPDL space data
     * @param options Build options
     * @returns Build result with HTML and metadata
     */
    abstract build(updlSpace: IUPDLSpace, options?: BuildOptions): Promise<BuildResult>

    /**
     * Validate UPDL space data (common validation)
     * @param space UPDL space to validate
     * @returns Validation result
     */
    protected validateUPDLSpace(space: IUPDLSpace): ValidationResult {
        const errors: string[] = []

        if (!space) {
            errors.push('UPDL space is required')
        }

        if (!space?.id) {
            errors.push('UPDL space must have an ID')
        }

        if (!space?.name) {
            errors.push('UPDL space must have a name')
        }

        return {
            isValid: errors.length === 0,
            errors
        }
    }

    /**
     * Count total nodes in UPDL space
     * @param space UPDL space
     * @returns Total number of nodes
     */
    protected getTotalNodeCount(space: IUPDLSpace): number {
        const objectCount = space.objects?.length || 0
        const cameraCount = space.cameras?.length || 0
        const lightCount = space.lights?.length || 0

        return 1 + objectCount + cameraCount + lightCount // +1 for space itself
    }
}
