import {
    ApplicationAliasValidationError,
    applicationAliasRoutingModeSchema,
    normalizeApplicationAlias,
    readLocalizedTextValue,
    type ApplicationAliasRoutingMode
} from '@universo-react/types'
import { database, isUuidV7, type DbExecutor } from '@universo-react/utils'
import {
    APPLICATION_ALIAS_ACTIVE_UNIQUE_INDEX,
    APPLICATION_ALIAS_PRIMARY_UNIQUE_INDEX,
    clearOtherPrimaryApplicationAliases,
    createApplicationAliasAtomically,
    findApplicationAliasById,
    findApplicationAliasByIdForUpdate,
    getApplicationAliasPolicy,
    getApplicationAliasPolicyForUpdate,
    listActiveApplicationAliasesForUpdate,
    listApplicationAliases,
    listApplicationAliasesByApplication,
    lockApplicationAliasTransitions,
    releaseApplicationAlias,
    setApplicationAliasPrimary,
    updateApplicationAliasPolicy,
    updateApplicationAliasValue,
    type ApplicationAliasManagementRow,
    type ApplicationAliasPolicyRow,
    type ApplicationAliasRow,
    type ListApplicationAliasesInput
} from '../persistence/applicationAliasesStore'

export type ApplicationAliasServiceErrorCode =
    | 'APPLICATION_ALIAS_FORMAT'
    | 'APPLICATION_ALIAS_RESERVED'
    | 'APPLICATION_ALIAS_UUID'
    | 'APPLICATION_ALIAS_CONFLICT'
    | 'APPLICATION_ALIAS_ID_INVALID'
    | 'APPLICATION_ALIAS_NOT_FOUND'
    | 'APPLICATION_ALIAS_RELEASED'
    | 'APPLICATION_ID_INVALID'
    | 'APPLICATION_NOT_FOUND'
    | 'APPLICATION_ALIAS_POLICY_INVALID'

export class ApplicationAliasServiceError extends Error {
    readonly code: ApplicationAliasServiceErrorCode
    readonly statusCode: number

    constructor(code: ApplicationAliasServiceErrorCode, statusCode: number) {
        super(code)
        this.name = 'ApplicationAliasServiceError'
        this.code = code
        this.statusCode = statusCode
    }
}

export interface ApplicationAliasItem {
    id: string
    applicationId: string
    alias: string
    isPrimary: boolean
    releasedAt: string | null
    createdAt: string
    updatedAt: string
    applicationName?: string
    applicationContext?: string | null
    routingMode: ApplicationAliasRoutingMode
    status?: 'active' | 'inactive' | 'released'
}

export interface ApplicationAliasPolicy {
    applicationId: string
    routingMode: ApplicationAliasRoutingMode
}

const serviceError = (code: ApplicationAliasServiceErrorCode, statusCode: number): never => {
    throw new ApplicationAliasServiceError(code, statusCode)
}

const assertUuidV7 = (value: string, code: 'APPLICATION_ALIAS_ID_INVALID' | 'APPLICATION_ID_INVALID'): void => {
    if (!isUuidV7(value)) serviceError(code, 400)
}

const normalizeAlias = (value: string): string => {
    try {
        return normalizeApplicationAlias(value)
    } catch (error) {
        if (error instanceof ApplicationAliasValidationError) {
            if (error.reason === 'reserved') return serviceError('APPLICATION_ALIAS_RESERVED', 400)
            if (error.reason === 'uuid') return serviceError('APPLICATION_ALIAS_UUID', 400)
        }
        return serviceError('APPLICATION_ALIAS_FORMAT', 400)
    }
}

const toIsoString = (value: Date | string): string => {
    const date = value instanceof Date ? value : new Date(value)
    if (!Number.isFinite(date.getTime())) throw new Error('Invalid application alias timestamp')
    return date.toISOString()
}

const parseRoutingMode = (value: string): ApplicationAliasRoutingMode => {
    const parsed = applicationAliasRoutingModeSchema.safeParse(value)
    if (!parsed.success) return serviceError('APPLICATION_ALIAS_POLICY_INVALID', 500)
    return parsed.data
}

const assertAliasRowIdentity = (row: ApplicationAliasRow): void => {
    if (!isUuidV7(row.id) || !isUuidV7(row.applicationId)) {
        throw new Error('Persisted application alias identity must use UUID v7')
    }
}

const mapAliasRow = (row: ApplicationAliasRow): ApplicationAliasItem => {
    assertAliasRowIdentity(row)
    return {
        id: row.id,
        applicationId: row.applicationId,
        alias: row.alias,
        isPrimary: row.isPrimary,
        releasedAt: row.releasedAt ? toIsoString(row.releasedAt) : null,
        createdAt: toIsoString(row.createdAt),
        updatedAt: toIsoString(row.updatedAt),
        routingMode: 'direct'
    }
}

const mapManagementRow = (row: ApplicationAliasManagementRow, locale?: 'en' | 'ru'): ApplicationAliasItem => ({
    ...mapAliasRow(row),
    applicationName: readLocalizedTextValue(row.applicationNameValue, locale ?? 'en'),
    applicationContext: readLocalizedTextValue(row.applicationContextValue, locale ?? 'en') ?? null,
    routingMode: parseRoutingMode(row.routingMode),
    status: row.status
})

const mapPolicy = (row: ApplicationAliasPolicyRow): ApplicationAliasPolicy => {
    if (!isUuidV7(row.applicationId)) throw new Error('Persisted application identity must use UUID v7')
    return { applicationId: row.applicationId, routingMode: parseRoutingMode(row.routingMode) }
}

const isActiveAliasUniqueViolation = (error: unknown): boolean => {
    if (!database.isUniqueViolation(error)) return false
    const constraint = database.getDbErrorConstraint(error)
    if (constraint === APPLICATION_ALIAS_ACTIVE_UNIQUE_INDEX || constraint === APPLICATION_ALIAS_PRIMARY_UNIQUE_INDEX) return true
    return database.getDbErrorDetail(error)?.includes('(alias)') === true
}

const withAliasConflictMapping = async <T>(work: () => Promise<T>): Promise<T> => {
    try {
        return await work()
    } catch (error) {
        if (isActiveAliasUniqueViolation(error)) return serviceError('APPLICATION_ALIAS_CONFLICT', 409)
        throw error
    }
}

const ensureCanonicalPrimary = async (
    executor: DbExecutor,
    applicationId: string,
    routingMode: ApplicationAliasRoutingMode,
    userId: string
): Promise<void> => {
    if (routingMode !== 'canonical') return

    const aliases = await listActiveApplicationAliasesForUpdate(executor, applicationId)
    if (aliases.length === 0) return

    const primaries = aliases.filter((alias) => alias.isPrimary)
    if (primaries.length === 1) return

    const selected = primaries[0] ?? aliases[0]
    await clearOtherPrimaryApplicationAliases(executor, applicationId, selected.id, userId)
    const updated = await setApplicationAliasPrimary(executor, applicationId, selected.id, userId)
    if (!updated) throw new Error('Failed to establish canonical application alias primary')
}

const resolveLockedAlias = async (executor: DbExecutor, aliasId: string): Promise<ApplicationAliasRow> => {
    const hint = await findApplicationAliasById(executor, aliasId)
    if (!hint) return serviceError('APPLICATION_ALIAS_NOT_FOUND', 404)

    await lockApplicationAliasTransitions(executor, hint.applicationId)
    const locked = await findApplicationAliasByIdForUpdate(executor, aliasId)
    if (!locked) return serviceError('APPLICATION_ALIAS_NOT_FOUND', 404)
    return locked
}

export function createApplicationAliasesService(executor: DbExecutor) {
    return {
        async list(input: ListApplicationAliasesInput): Promise<{ items: ApplicationAliasItem[]; total: number }> {
            if (input.applicationId) assertUuidV7(input.applicationId, 'APPLICATION_ID_INVALID')
            const result = await listApplicationAliases(executor, input)
            return { items: result.items.map((row) => mapManagementRow(row, input.locale)), total: result.total }
        },

        async listByApplication(applicationId: string, locale?: 'en' | 'ru'): Promise<ApplicationAliasItem[]> {
            assertUuidV7(applicationId, 'APPLICATION_ID_INVALID')
            const policy = await getApplicationAliasPolicy(executor, applicationId)
            if (!policy) return serviceError('APPLICATION_NOT_FOUND', 404)
            const rows = await listApplicationAliasesByApplication(executor, applicationId)
            return rows.map((row) => mapManagementRow(row, locale))
        },

        async getPolicy(applicationId: string): Promise<ApplicationAliasPolicy> {
            assertUuidV7(applicationId, 'APPLICATION_ID_INVALID')
            const policy = await getApplicationAliasPolicy(executor, applicationId)
            if (!policy) return serviceError('APPLICATION_NOT_FOUND', 404)
            return mapPolicy(policy)
        },

        async create(input: {
            applicationId: string
            alias: string
            makePrimary?: boolean
            userId: string
        }): Promise<ApplicationAliasItem> {
            assertUuidV7(input.applicationId, 'APPLICATION_ID_INVALID')
            const alias = normalizeAlias(input.alias)

            return withAliasConflictMapping(() =>
                executor.transaction(async (tx) => {
                    await lockApplicationAliasTransitions(tx, input.applicationId)
                    const policyRow = await getApplicationAliasPolicyForUpdate(tx, input.applicationId)
                    if (!policyRow) return serviceError('APPLICATION_NOT_FOUND', 404)
                    const routingMode = parseRoutingMode(policyRow.routingMode)
                    const inserted = await createApplicationAliasAtomically(tx, {
                        applicationId: input.applicationId,
                        alias,
                        makePrimary: input.makePrimary === true,
                        userId: input.userId
                    })

                    const current = await findApplicationAliasByIdForUpdate(tx, inserted.id)
                    if (!current) throw new Error('Created application alias disappeared inside its transaction')
                    return { ...mapAliasRow(current), routingMode }
                })
            )
        },

        async rename(aliasId: string, aliasValue: string, userId: string): Promise<ApplicationAliasItem> {
            assertUuidV7(aliasId, 'APPLICATION_ALIAS_ID_INVALID')
            const alias = normalizeAlias(aliasValue)

            return withAliasConflictMapping(() =>
                executor.transaction(async (tx) => {
                    const current = await resolveLockedAlias(tx, aliasId)
                    if (current.releasedAt) return serviceError('APPLICATION_ALIAS_RELEASED', 409)
                    const updated = await updateApplicationAliasValue(tx, aliasId, alias, userId)
                    if (!updated) return serviceError('APPLICATION_ALIAS_NOT_FOUND', 404)
                    const policy = await getApplicationAliasPolicyForUpdate(tx, current.applicationId, true)
                    return { ...mapAliasRow(updated), routingMode: policy ? parseRoutingMode(policy.routingMode) : 'direct' }
                })
            )
        },

        async setPrimary(aliasId: string, userId: string): Promise<ApplicationAliasItem> {
            assertUuidV7(aliasId, 'APPLICATION_ALIAS_ID_INVALID')

            return withAliasConflictMapping(() =>
                executor.transaction(async (tx) => {
                    const current = await resolveLockedAlias(tx, aliasId)
                    if (current.releasedAt) return serviceError('APPLICATION_ALIAS_RELEASED', 409)

                    await clearOtherPrimaryApplicationAliases(tx, current.applicationId, current.id, userId)
                    const updated = await setApplicationAliasPrimary(tx, current.applicationId, current.id, userId)
                    if (!updated) return serviceError('APPLICATION_ALIAS_NOT_FOUND', 404)
                    const policy = await getApplicationAliasPolicyForUpdate(tx, current.applicationId, true)
                    return { ...mapAliasRow(updated), routingMode: policy ? parseRoutingMode(policy.routingMode) : 'direct' }
                })
            )
        },

        async release(aliasId: string, userId: string): Promise<void> {
            assertUuidV7(aliasId, 'APPLICATION_ALIAS_ID_INVALID')

            await withAliasConflictMapping(() =>
                executor.transaction(async (tx) => {
                    const current = await resolveLockedAlias(tx, aliasId)
                    if (current.releasedAt) return serviceError('APPLICATION_ALIAS_RELEASED', 409)
                    const policy = await getApplicationAliasPolicyForUpdate(tx, current.applicationId, true)
                    const released = await releaseApplicationAlias(tx, aliasId, userId)
                    if (!released) return serviceError('APPLICATION_ALIAS_NOT_FOUND', 404)

                    if (policy) {
                        await ensureCanonicalPrimary(tx, current.applicationId, parseRoutingMode(policy.routingMode), userId)
                    }
                })
            )
        },

        async updatePolicy(applicationId: string, routingMode: string, userId: string): Promise<ApplicationAliasPolicy> {
            assertUuidV7(applicationId, 'APPLICATION_ID_INVALID')
            const parsedMode = applicationAliasRoutingModeSchema.safeParse(routingMode)
            if (!parsedMode.success) return serviceError('APPLICATION_ALIAS_POLICY_INVALID', 400)

            return withAliasConflictMapping(() =>
                executor.transaction(async (tx) => {
                    await lockApplicationAliasTransitions(tx, applicationId)
                    const current = await getApplicationAliasPolicyForUpdate(tx, applicationId)
                    if (!current) return serviceError('APPLICATION_NOT_FOUND', 404)
                    const updated = await updateApplicationAliasPolicy(tx, applicationId, parsedMode.data, userId)
                    if (!updated) return serviceError('APPLICATION_NOT_FOUND', 404)
                    await ensureCanonicalPrimary(tx, applicationId, parsedMode.data, userId)
                    return mapPolicy(updated)
                })
            )
        }
    }
}

export type ApplicationAliasesService = ReturnType<typeof createApplicationAliasesService>
