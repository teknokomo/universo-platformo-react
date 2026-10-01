import { applicationTemplateKeySchema, type ApplicationTemplateKey } from '@universo-react/types'

export type ApplicationLayoutSyncJsonRecord = Record<string, unknown>

export const isApplicationLayoutSyncRecord = (value: unknown): value is ApplicationLayoutSyncJsonRecord =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value))

export const requireApplicationLayoutSyncRecord = (value: unknown, context: string): ApplicationLayoutSyncJsonRecord => {
    if (!isApplicationLayoutSyncRecord(value)) throw new Error(`[SchemaSync] ${context} must be an object`)
    return value as ApplicationLayoutSyncJsonRecord
}

export const requireApplicationLayoutSyncBoolean = (value: unknown, context: string): boolean => {
    if (typeof value !== 'boolean') throw new Error(`[SchemaSync] ${context} must be a boolean`)
    return value
}

export const requireApplicationLayoutSyncInteger = (value: unknown, context: string): number => {
    if (typeof value !== 'number' || !Number.isInteger(value)) throw new Error(`[SchemaSync] ${context} must be an integer`)
    return value
}

export const parseApplicationLayoutSyncTemplateKey = (value: unknown, context: string): ApplicationTemplateKey => {
    const parsed = applicationTemplateKeySchema.safeParse(value)
    if (!parsed.success) throw new Error(`[SchemaSync] Invalid template key for ${context}`)
    return parsed.data
}
