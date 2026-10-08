import { isUuidV7 } from '@universo-react/utils'
import { failEffectiveLayout } from './effectiveLayoutContract'

export type RecordValue = Record<string, unknown>

export const isRecord = (value: unknown): value is RecordValue => Boolean(value && typeof value === 'object' && !Array.isArray(value))

export const isSha256 = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/iu.test(value)

export const requireUuidV7 = (value: unknown): string => {
    if (!isUuidV7(value)) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    return value
}

export const readNullableUuidV7 = (value: unknown): string | null => {
    if (value === undefined || value === null) return null
    return requireUuidV7(value)
}

export const readNullableHash = (value: unknown): string | null => {
    if (value === undefined || value === null) return null
    if (!isSha256(value)) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    return value
}

export const readRecord = (value: unknown): RecordValue => {
    if (!isRecord(value)) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    return value
}

export const readNullableRecord = (value: unknown): RecordValue | null => {
    if (value === undefined || value === null) return null
    return readRecord(value)
}

export const readBoolean = (value: unknown): boolean => {
    if (typeof value !== 'boolean') return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    return value
}

export const readPositiveInteger = (value: unknown): number => {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    }
    return value
}

export const readInteger = (value: unknown): number => {
    if (typeof value !== 'number' || !Number.isInteger(value)) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    return value
}

export const readNonNegativeInteger = (value: unknown): number => {
    const integer = readInteger(value)
    if (integer < 0) return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    return integer
}
