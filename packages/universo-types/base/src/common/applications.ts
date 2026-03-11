/**
 * Status of schema synchronization for an Application.
 * Shared between applications-backend and metahubs-backend.
 */
export enum ApplicationSchemaStatus {
    DRAFT = 'draft',
    PENDING = 'pending',
    SYNCED = 'synced',
    OUTDATED = 'outdated',
    ERROR = 'error',
    UPDATE_AVAILABLE = 'update_available',
    MAINTENANCE = 'maintenance'
}
