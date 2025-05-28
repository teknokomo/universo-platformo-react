// Universo Platformo | AR.js Space Handler
// Handles processing of UPDL Space nodes for AR.js

import { IUPDLSpace } from '../../../../../../../packages/server/src/Interface.UPDL'
import { BuildOptions } from '../../common/types'

/**
 * Processes UPDL Space nodes for AR.js generation
 */
export class SpaceHandler {
    /**
     * Process space configuration
     * @param updlSpace UPDL space data
     * @param options Build options
     * @returns Space configuration string (currently empty as space is handled in main template)
     */
    process(updlSpace: IUPDLSpace, options: BuildOptions = {}): string {
        // Space configuration is handled in the main HTML template
        // This handler exists for future space-specific processing needs
        // such as custom backgrounds, fog settings, etc.

        return '' // No additional space content needed currently
    }
}
