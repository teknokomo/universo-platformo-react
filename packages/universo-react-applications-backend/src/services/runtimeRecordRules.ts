import type { DbExecutor } from '@universo-react/utils'
import { isUsableValidationPattern, isUsableValidationPatternValue } from '@universo-react/utils'
import { acquireAdvisoryXactLock } from '@universo-react/utils/database'
import { IDENTIFIER_REGEX, UpdateFailure, quoteIdentifier } from '../shared/runtimeHelpers'

/**
 * Runtime write-path enforcement for authoring component rules that the
 * published marketing/runtime surfaces depend on. Values that only existed in
 * the authoring UI could previously be written straight through the runtime
 * API, silently breaking the published page (duplicate semantic keys) or
 * persisting malformed keys (pattern mismatches).
 */
export const RUNTIME_RECORD_RULE_CODES = {
    keyDuplicate: 'RECORD_KEY_DUPLICATE',
    patternMismatch: 'RECORD_PATTERN_MISMATCH'
} as const

export type RuntimeRecordRuleCode = (typeof RUNTIME_RECORD_RULE_CODES)[keyof typeof RUNTIME_RECORD_RULE_CODES]

export type RuntimeRecordRuleViolation = {
    statusCode: 400 | 409
    code: RuntimeRecordRuleCode
    field: string
    message: string
}

/**
 * Stable advisory-lock scope so writers on one runtime table serialize. The
 * identifier parts are normalized without quotes because the REST paths pass a
 * quoted schema ident while the module Record API passes a fully quoted table
 * ident: both must hash to the same lock or cross-surface writes would not
 * serialize.
 */
export const buildRuntimeRecordRuleLockKey = (schemaName: string, tableNameOrIdent: string): string => {
    const normalize = (value: string): string => value.replace(/"/g, '')
    // The module Record API passes a schema-qualified quoted ident; the REST
    // paths pass a bare table name. Both must map to the same lock scope.
    const lastSegment = tableNameOrIdent.slice(tableNameOrIdent.lastIndexOf('.') + 1)
    return `runtime-record-rules:${normalize(schemaName)}.${normalize(lastSegment)}`
}

export type RuntimeRecordRuleAttr = {
    codename: unknown
    column_name: string
    data_type: string
    validation_rules?: Record<string, unknown> | null
}

const readRuleString = (rules: Record<string, unknown> | null | undefined, key: string): string | null => {
    const value = rules?.[key]
    return typeof value === 'string' && value.length > 0 ? value : null
}

const readRuntimeCodename = (codename: unknown): string | null => {
    if (typeof codename === 'string' && codename.trim().length > 0) return codename.trim()
    if (!codename || typeof codename !== 'object') return null
    const record = codename as { _primary?: unknown; locales?: Record<string, { content?: unknown }> }
    const primary = typeof record._primary === 'string' ? record._primary : null
    if (primary) {
        const localized = record.locales?.[primary]?.content
        if (typeof localized === 'string' && localized.trim().length > 0) return localized.trim()
        if (primary.trim().length > 0) return primary.trim()
    }
    for (const entry of Object.values(record.locales ?? {})) {
        if (typeof entry?.content === 'string' && entry.content.trim().length > 0) return entry.content.trim()
    }
    return null
}

const collectRuleAttrs = (attrs: readonly RuntimeRecordRuleAttr[]): RuntimeRecordRuleAttr[] =>
    attrs.filter((attr) => {
        if (attr.data_type !== 'STRING' || !IDENTIFIER_REGEX.test(attr.column_name)) return false
        const rules = attr.validation_rules
        if (!rules) return false
        return rules.unique === true || readRuleString(rules, 'pattern') !== null
    })

/**
 * Serialize concurrent writers on the same runtime table before the conflict
 * probe runs, so two parallel creates cannot both pass the pre-check. The lock
 * is transaction-scoped and released with the surrounding write transaction.
 */
const acquireRecordRuleLock = async (manager: DbExecutor, lockKey: string): Promise<void> => {
    await acquireAdvisoryXactLock(manager, lockKey)
}

/**
 * Serialize a writer on the runtime table before any row-level `FOR UPDATE`,
 * so copy/update lock order stays advisory-then-row and cannot deadlock with
 * the rule probe that updates run inside the same transaction.
 */
export const acquireRuntimeRecordRuleLock = async (manager: DbExecutor, schemaName: string, tableNameOrIdent: string): Promise<void> => {
    await acquireRecordRuleLock(manager, buildRuntimeRecordRuleLockKey(schemaName, tableNameOrIdent))
}

/**
 * Enforces `pattern` and `unique` rules for the provided row values. Returns a
 * violation the caller can turn into an HTTP response, or `null` when the row
 * is acceptable. Only provided fields are checked, matching partial updates.
 *
 * Plain string values only: unique is not enforced for localized (VLC) values,
 * matching the design-time `assertUniqueComponentValues` contract.
 */
export const evaluateRuntimeRecordRules = async (params: {
    manager: DbExecutor
    dataTableIdent: string
    activeCondition: string
    attrs: readonly RuntimeRecordRuleAttr[]
    row: Record<string, unknown>
    lockKey: string
    excludeRowId?: string | null
}): Promise<RuntimeRecordRuleViolation | null> => {
    const ruleAttrs = collectRuleAttrs(params.attrs)
    if (ruleAttrs.length === 0) return null

    // Serialization is only required for conflict probes and only when a unique
    // value is actually written: pattern checks are read-free, and an update
    // that does not touch the unique column must not queue behind the lock.
    const hasUniqueValue = ruleAttrs.some((attr) => {
        if (attr.validation_rules?.unique !== true) return false
        const value = params.row[attr.column_name]
        return typeof value === 'string' && value.trim().length > 0
    })
    if (hasUniqueValue) {
        await acquireRecordRuleLock(params.manager, params.lockKey)
    }

    for (const attr of ruleAttrs) {
        const value = params.row[attr.column_name]
        if (typeof value !== 'string' || value.trim().length === 0) continue

        const field = readRuntimeCodename(attr.codename) ?? attr.column_name
        const pattern = readRuleString(attr.validation_rules, 'pattern')
        // Design-time parity: the closed hexColor formatter owns its own
        // format, so its pattern is not re-applied. Patterns with nested
        // quantifiers or extreme values are treated as unusable and skipped on
        // both surfaces instead of risking catastrophic backtracking.
        const appliesPattern =
            pattern !== null &&
            attr.validation_rules?.format !== 'hexColor' &&
            isUsableValidationPattern(pattern) &&
            isUsableValidationPatternValue(value)
        if (appliesPattern) {
            let regex: RegExp | null = null
            try {
                regex = new RegExp(pattern)
            } catch {
                regex = null
            }
            if (regex && !regex.test(value)) {
                return {
                    statusCode: 400,
                    code: RUNTIME_RECORD_RULE_CODES.patternMismatch,
                    field,
                    message: `Field does not match the required format: ${field}`
                }
            }
        }

        if (attr.validation_rules?.unique === true) {
            const conflict = (await params.manager.query(
                `SELECT id FROM ${params.dataTableIdent}
                 WHERE ${params.activeCondition}
                   AND ${quoteIdentifier(attr.column_name)} = $1
                   AND ($2::uuid IS NULL OR id <> $2::uuid)
                 LIMIT 1`,
                [value, params.excludeRowId ?? null]
            )) as Array<{ id: string }>
            if (conflict.length > 0) {
                return {
                    statusCode: 409,
                    code: RUNTIME_RECORD_RULE_CODES.keyDuplicate,
                    field,
                    message: `A record with the same value already exists: ${field}`
                }
            }
        }
    }

    return null
}

/**
 * Shared write-path entry point: evaluates the rules and fails closed with the
 * same `UpdateFailure` body every runtime row surface returns.
 */
export const assertRuntimeRecordRules = async (params: {
    manager: DbExecutor
    schemaIdent: string
    dataTableIdent: string
    activeCondition: string
    attrs: readonly RuntimeRecordRuleAttr[]
    row: Record<string, unknown>
    excludeRowId?: string | null
}): Promise<void> => {
    const violation = await evaluateRuntimeRecordRules({
        manager: params.manager,
        dataTableIdent: params.dataTableIdent,
        activeCondition: params.activeCondition,
        attrs: params.attrs,
        row: params.row,
        lockKey: buildRuntimeRecordRuleLockKey(params.schemaIdent, params.dataTableIdent),
        excludeRowId: params.excludeRowId
    })
    if (violation) {
        throw new UpdateFailure(violation.statusCode, {
            error: violation.message,
            code: violation.code,
            field: violation.field
        })
    }
}
