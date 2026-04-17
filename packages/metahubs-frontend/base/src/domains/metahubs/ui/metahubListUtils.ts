import type { ConflictInfo } from '@universo/utils'
import type { MetahubLocalizedPayload } from '../../../types'

export type MetahubFormValues = {
    nameVlc?: import('@universo/types').VersionedLocalizedContent<string> | null
    descriptionVlc?: import('@universo/types').VersionedLocalizedContent<string> | null
    codename?: import('@universo/types').VersionedLocalizedContent<string> | null
    codenameTouched?: boolean
    storageMode?: 'main_db' | 'external_db'
    templateId?: string
    presetToggles?: Record<string, boolean>
}

export type GenericFormValues = Record<string, unknown>

export type TranslationFn = (key: string, options?: unknown) => string

export type BaseMenuContext = {
    t: TranslationFn
} & Record<string, unknown>

export type ConfirmSpec = {
    titleKey?: string
    descriptionKey?: string
    confirmKey?: string
    cancelKey?: string
    interpolate?: Record<string, unknown>
    title?: string
    description?: string
    confirmButtonName?: string
    cancelButtonName?: string
}

export type ConflictState = {
    open: boolean
    conflict: ConflictInfo | null
    pendingUpdate: { id: string; patch: MetahubLocalizedPayload } | null
}

export type PendingMetahubNavigation = {
    pendingId: string
    codename: string
}

export const extractResponseStatus = (error: unknown): number | undefined => {
    if (!error || typeof error !== 'object' || !('response' in error)) return undefined
    const response = (error as { response?: unknown }).response
    if (!response || typeof response !== 'object') return undefined
    const status = (response as { status?: unknown }).status
    return typeof status === 'number' ? status : undefined
}

export const extractResponseMessage = (error: unknown): string | undefined => {
    if (!error || typeof error !== 'object' || !('response' in error)) return undefined
    const response = (error as { response?: unknown }).response
    if (!response || typeof response !== 'object') return undefined
    const data = (response as { data?: unknown }).data
    if (!data || typeof data !== 'object') return undefined
    const message = (data as { message?: unknown }).message
    return typeof message === 'string' ? message : undefined
}

export const extractConflict = (error: unknown): ConflictInfo | null => {
    if (!error || typeof error !== 'object' || !('response' in error)) return null
    const response = (error as { response?: unknown }).response
    if (!response || typeof response !== 'object') return null
    const data = (response as { data?: unknown }).data
    if (!data || typeof data !== 'object' || !('conflict' in data)) return null
    const conflict = (data as { conflict?: unknown }).conflict
    return conflict && typeof conflict === 'object' ? (conflict as ConflictInfo) : null
}
