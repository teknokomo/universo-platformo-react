import { createHash } from 'crypto'
import stableStringify from 'json-stable-stringify'
import { uuidv7 } from 'uuidv7'
import type { PlatformMigrationFile } from './types'

export const createMigrationRunId = (): string => uuidv7()

export const calculateMigrationChecksum = (migration: PlatformMigrationFile): string => {
    const serialized =
        stableStringify({
            id: migration.id,
            version: migration.version,
            scope: migration.scope,
            sourceKind: migration.sourceKind ?? 'file',
            transactionMode: migration.transactionMode ?? 'single',
            lockMode: migration.lockMode ?? 'transaction_advisory',
            summary: migration.summary ?? null,
            isDestructive: migration.isDestructive ?? false,
            requiresReview: migration.requiresReview ?? false
        }) ?? ''

    const source = migration.checksumSource ?? serialized

    return createHash('sha256').update(source).digest('hex')
}
