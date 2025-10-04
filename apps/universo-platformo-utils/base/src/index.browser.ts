// Browser-friendly entrypoint for @universo-platformo/utils
// Exposes the same public surface as the Node build while stubbing Node-only helpers.

export * as validation from './validation'
export * as delta from './delta'
export * as serialization from './serialization'
export * as math from './math'
export * as updl from './updl'
export { UPDLProcessor } from './updl/UPDLProcessor'

// Explicit imports to avoid pulling in Node "net" dependency when bundling for the browser.
import { createTimeSyncEstimator } from './net/timeSync'
import { updateSeqState, reconcileAck } from './net/sequencing'

// Provide a no-op stub for ensurePortAvailable so that consumers receive a clear runtime error
// if they accidentally call it in browser environments. We intentionally avoid importing the
// Node-based implementation to keep the bundle tree-shakeable and free of Node built-ins.
async function ensurePortAvailable(): Promise<never> {
    throw new Error('ensurePortAvailable is not available in browser environments')
}

export const net = {
    createTimeSyncEstimator,
    updateSeqState,
    reconcileAck,
    ensurePortAvailable
}

export { createTimeSyncEstimator, updateSeqState, reconcileAck }
