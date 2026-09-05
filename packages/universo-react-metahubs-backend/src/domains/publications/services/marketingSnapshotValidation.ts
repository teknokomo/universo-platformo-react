import {
    MarketingSnapshotValidationError,
    SnapshotLayoutValidationError,
    validateSnapshotLayoutIdentities as validateSharedSnapshotLayoutIdentities,
    validateMarketingSnapshotLayouts as validateSharedMarketingSnapshotLayouts
} from '@universo-react/utils'
import type { MetahubSnapshot } from './SnapshotSerializer'
import { MetahubValidationError } from '../../shared/domainErrors'

/**
 * Keep the metahub boundary error compatible with the domain error middleware
 * while sharing the actual template contract with application sync.
 */
export const validateMarketingSnapshotLayouts = (snapshot: MetahubSnapshot): void => {
    try {
        validateSharedMarketingSnapshotLayouts(snapshot)
    } catch (error) {
        if (error instanceof SnapshotLayoutValidationError || error instanceof MarketingSnapshotValidationError) {
            throw new MetahubValidationError(error.message, error.details)
        }
        throw error
    }
}

export const validateSnapshotLayoutIdentities = (snapshot: MetahubSnapshot): void => {
    try {
        validateSharedSnapshotLayoutIdentities(snapshot)
    } catch (error) {
        if (error instanceof SnapshotLayoutValidationError) {
            throw new MetahubValidationError(error.message, error.details)
        }
        throw error
    }
}
