import type { Response } from 'express'
import type { SqlQueryable } from '../../persistence/types'
import { syncMetahubSchema } from '../metahubs/services/schemaSync'
import { MetahubSchemaSyncError } from './domainErrors'
import { createLogger } from '../../utils/logger'

const log = createLogger('Metahubs')

export const respondSchemaSyncFailure = (res: Response, operation: string, error: unknown): Response => {
    log.error(`Schema sync failed after ${operation}:`, error)
    return res.status(500).json({
        error: 'Metahub schema synchronization failed after the change. The change was not acknowledged.',
        code: 'SCHEMA_SYNC_FAILED',
        details: { operation }
    })
}

export type SchemaSyncFailure = {
    code: 'SCHEMA_SYNC_FAILED'
    operation: string
    cause: unknown
}

export const isSchemaSyncFailure = (error: unknown): error is SchemaSyncFailure => {
    if (!error || typeof error !== 'object') return false
    return (error as { code?: unknown }).code === 'SCHEMA_SYNC_FAILED'
}

export const syncMetahubSchemaOrThrow = async (
    metahubId: string,
    exec: SqlQueryable,
    userId: string | undefined,
    operation: string
): Promise<void> => {
    try {
        await syncMetahubSchema(metahubId, exec, userId)
    } catch (error) {
        throw new MetahubSchemaSyncError(operation, error)
    }
}

export const isUniqueViolation = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false
    const code = (error as { code?: unknown }).code
    if (code === '23505') return true
    const message = (error as { message?: unknown }).message
    return typeof message === 'string' && message.toLowerCase().includes('duplicate key value')
}
