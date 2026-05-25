import { isObjectRecordBehaviorEnabled, normalizeObjectRecordBehaviorFromConfig, type ObjectRecordBehavior } from '@universo/types'
import type { DbExecutor } from '@universo/utils'
import { UpdateFailure } from '../shared/runtimeHelpers'

export type RuntimeRecordCommand = 'post' | 'unpost' | 'void'
export type RuntimeRecordCreateColumnValue = { column: string; value: unknown }

export const normalizeRuntimeRecordBehavior = (config: Record<string, unknown> | null | undefined): ObjectRecordBehavior =>
    normalizeObjectRecordBehaviorFromConfig(config)

export const isRuntimeRecordBehaviorEnabled = (behavior: ObjectRecordBehavior): boolean => isObjectRecordBehaviorEnabled(behavior)

const isRecordImmutableByBehavior = (behavior: ObjectRecordBehavior, row: Record<string, unknown>): boolean => {
    const state = typeof row._app_record_state === 'string' ? row._app_record_state : null
    if (behavior.immutability === 'posted') {
        return state === 'posted' || state === 'voided'
    }
    if (behavior.immutability === 'final') {
        return state === 'voided'
    }
    return false
}

export const assertRuntimeRecordMutable = (config: Record<string, unknown> | null | undefined, row: Record<string, unknown>): void => {
    const behavior = normalizeRuntimeRecordBehavior(config)
    if (isRuntimeRecordBehaviorEnabled(behavior) && isRecordImmutableByBehavior(behavior, row)) {
        throw new UpdateFailure(409, {
            error: 'Record is immutable in its current state',
            code: 'RECORD_IMMUTABLE',
            state: row._app_record_state ?? null
        })
    }
}

export const resolveRecordNumberPeriodKey = (date: Date, periodicity: ObjectRecordBehavior['numbering']['periodicity']): string => {
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    if (periodicity === 'day') return `${year}-${month}-${day}`
    if (periodicity === 'month') return `${year}-${month}`
    if (periodicity === 'quarter') return `${year}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`
    if (periodicity === 'year') return String(year)
    return 'all'
}

export const allocateRuntimeRecordNumber = async (params: {
    manager: DbExecutor
    schemaIdent: string
    objectId: string
    behavior: ObjectRecordBehavior
    currentWorkspaceId: string | null
    currentUserId: string | null
    date: Date
}): Promise<string> => {
    const { behavior } = params
    const prefix = typeof behavior.numbering.prefix === 'string' ? behavior.numbering.prefix.slice(0, 64) : ''
    const minLength =
        typeof behavior.numbering.minLength === 'number' && Number.isFinite(behavior.numbering.minLength)
            ? Math.max(1, Math.min(32, Math.trunc(behavior.numbering.minLength)))
            : 6
    const scopeKey =
        behavior.numbering.scope === 'global'
            ? 'global'
            : `workspace:${params.currentWorkspaceId ?? '00000000-0000-0000-0000-000000000000'}`
    const periodKey = resolveRecordNumberPeriodKey(params.date, behavior.numbering.periodicity)

    const rows = (await params.manager.query(
        `
      INSERT INTO ${params.schemaIdent}._app_record_counters (
        object_id, scope_key, period_key, prefix, last_number,
        _upl_created_by, _upl_updated_by
      )
      VALUES ($1, $2, $3, $4, 1, $5, $5)
      ON CONFLICT (object_id, scope_key, period_key, prefix)
      DO UPDATE SET
        last_number = _app_record_counters.last_number + 1,
        _upl_updated_at = NOW(),
        _upl_updated_by = EXCLUDED._upl_updated_by,
        _upl_version = COALESCE(_app_record_counters._upl_version, 1) + 1
      RETURNING last_number
    `,
        [params.objectId, scopeKey, periodKey, prefix, params.currentUserId]
    )) as Array<{ last_number: unknown }>

    const nextNumber = Number(rows[0]?.last_number ?? 0)
    if (!Number.isFinite(nextNumber) || nextNumber <= 0) {
        throw new UpdateFailure(500, { error: 'Failed to allocate record number' })
    }

    return `${prefix}${String(nextNumber).padStart(minLength, '0')}`
}

export class RuntimeNumberingService {
    resolvePeriodKey(date: Date, periodicity: ObjectRecordBehavior['numbering']['periodicity']): string {
        return resolveRecordNumberPeriodKey(date, periodicity)
    }

    allocate(params: Parameters<typeof allocateRuntimeRecordNumber>[0]): Promise<string> {
        return allocateRuntimeRecordNumber(params)
    }
}

export class RuntimeRecordCommandService {
    constructor(private readonly numberingService = new RuntimeNumberingService()) {}

    async buildInitialCreateColumnValues(params: {
        columnValues: readonly RuntimeRecordCreateColumnValue[]
        behavior: ObjectRecordBehavior
        manager: DbExecutor
        schemaIdent: string
        objectId: string
        currentWorkspaceId: string | null
        currentUserId: string | null
        date?: Date
    }): Promise<RuntimeRecordCreateColumnValue[]> {
        const createColumnValues = [...params.columnValues]

        if (!isRuntimeRecordBehaviorEnabled(params.behavior)) {
            return createColumnValues
        }

        const recordDate = params.date ?? new Date()
        if (params.behavior.numbering.enabled && !createColumnValues.some((item) => item.column === '_app_record_number')) {
            const recordNumber = await this.numberingService.allocate({
                manager: params.manager,
                schemaIdent: params.schemaIdent,
                objectId: params.objectId,
                behavior: params.behavior,
                currentWorkspaceId: params.currentWorkspaceId,
                currentUserId: params.currentUserId,
                date: recordDate
            })
            createColumnValues.push({ column: '_app_record_number', value: recordNumber })
        }

        if (params.behavior.effectiveDate.enabled && params.behavior.effectiveDate.defaultToNow) {
            createColumnValues.push({ column: '_app_record_date', value: recordDate })
        }

        if (params.behavior.lifecycle.enabled || params.behavior.posting.mode !== 'disabled') {
            createColumnValues.push({ column: '_app_record_state', value: 'draft' })
        }

        return createColumnValues
    }

    assertCommandAllowed(command: RuntimeRecordCommand, previousRow: Record<string, unknown>): string {
        const state = typeof previousRow._app_record_state === 'string' ? previousRow._app_record_state : 'draft'

        if (command === 'post' && state === 'posted') {
            throw new UpdateFailure(409, { error: 'Record is already posted', code: 'RECORD_ALREADY_POSTED' })
        }
        if (command === 'post' && state === 'voided') {
            throw new UpdateFailure(409, { error: 'Voided record cannot be posted', code: 'RECORD_VOIDED' })
        }
        if (command === 'unpost' && state !== 'posted') {
            throw new UpdateFailure(409, { error: 'Only posted records can be unposted', code: 'RECORD_NOT_POSTED' })
        }
        if (command === 'void' && state === 'voided') {
            throw new UpdateFailure(409, { error: 'Record is already voided', code: 'RECORD_ALREADY_VOIDED' })
        }

        return state
    }

    async buildUpdate(params: {
        command: RuntimeRecordCommand
        previousRow: Record<string, unknown>
        behavior: ObjectRecordBehavior
        manager: DbExecutor
        schemaIdent: string
        objectId: string
        rowId: string
        currentWorkspaceId: string | null
        currentUserId: string
        date?: Date
    }): Promise<{ setClauses: string[]; values: unknown[] }> {
        this.assertCommandAllowed(params.command, params.previousRow)

        const setClauses: string[] = ['_upl_updated_at = NOW()', '_upl_updated_by = $2', '_upl_version = COALESCE(_upl_version, 1) + 1']
        const values: unknown[] = [params.rowId, params.currentUserId]

        if (params.command === 'post') {
            let recordNumber = params.previousRow._app_record_number
            if (params.behavior.numbering.enabled && (typeof recordNumber !== 'string' || recordNumber.trim().length === 0)) {
                recordNumber = await this.numberingService.allocate({
                    manager: params.manager,
                    schemaIdent: params.schemaIdent,
                    objectId: params.objectId,
                    behavior: params.behavior,
                    currentWorkspaceId: params.currentWorkspaceId,
                    currentUserId: params.currentUserId,
                    date: params.date ?? new Date()
                })
            }
            values.push('posted')
            setClauses.push(`_app_record_state = $${values.length}`)
            values.push(recordNumber ?? null)
            setClauses.push(`_app_record_number = $${values.length}`)
            setClauses.push('_app_record_date = COALESCE(_app_record_date, NOW())')
            setClauses.push('_app_posted_at = NOW()')
            setClauses.push('_app_posted_by = $2')
            setClauses.push('_app_posting_batch_id = public.uuid_generate_v7()')
        } else if (params.command === 'unpost') {
            values.push('draft')
            setClauses.push(`_app_record_state = $${values.length}`)
            setClauses.push('_app_posted_at = NULL')
            setClauses.push('_app_posted_by = NULL')
            setClauses.push('_app_posting_batch_id = NULL')
        } else {
            values.push('voided')
            setClauses.push(`_app_record_state = $${values.length}`)
            setClauses.push('_app_voided_at = NOW()')
            setClauses.push('_app_voided_by = $2')
        }

        return { setClauses, values }
    }
}
