import type { Knex } from 'knex'
import { getKnex } from '@universo/database'
import { acquireAdvisoryLock, createDDLServices, releaseAdvisoryLock } from '@universo/schema-ddl'

export type ApplicationSyncTransaction = Knex.Transaction
export type ApplicationSyncQueryBuilder = Knex.QueryBuilder

type ApplicationSyncLockKey = Parameters<typeof acquireAdvisoryLock>[1]

export function getApplicationSyncKnex(): Knex {
    return getKnex()
}

export function getApplicationSyncDdlServices() {
    return createDDLServices(getKnex())
}

export async function acquireApplicationSyncAdvisoryLock(lockKey: ApplicationSyncLockKey): Promise<boolean> {
    return acquireAdvisoryLock(getKnex(), lockKey)
}

export async function releaseApplicationSyncAdvisoryLock(lockKey: ApplicationSyncLockKey): Promise<void> {
    await releaseAdvisoryLock(getKnex(), lockKey)
}
