export { DocumentStore } from './DocumentStore'
export { DocumentStoreFileChunk } from './DocumentStoreFileChunk'
export { UpsertHistory } from './UpsertHistory'

export const docstoreEntities = [
    // Using dynamic import to avoid circular dependency issues
    require('./DocumentStore').DocumentStore,
    require('./DocumentStoreFileChunk').DocumentStoreFileChunk,
    require('./UpsertHistory').UpsertHistory
]
