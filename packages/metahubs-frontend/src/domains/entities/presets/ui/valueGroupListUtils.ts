import type { VersionedLocalizedContent } from '@universo/types'
import { getVLCString, toValueGroupDisplay } from '../../../../types'
import type { ValueGroupDisplay } from '../../../../types'
import type { ValueGroupWithContainers } from '../api/valueGroups'

export interface ContainerDisplayInfo {
    id: string
    name: string
    codename: string
}

export interface ValueGroupWithContainersDisplay extends ValueGroupDisplay {
    treeEntityId: string
    hubName: string
    hubCodename: string
    containersCount: number
    allTreeEntities: ContainerDisplayInfo[]
}

export type ValueGroupFormValues = {
    nameVlc: VersionedLocalizedContent<string> | null
    descriptionVlc: VersionedLocalizedContent<string> | null
    codename: VersionedLocalizedContent<string> | null
    codenameTouched?: boolean
    treeEntityIds: string[]
    isSingleHub: boolean
    isRequiredHub?: boolean
}

export type ValueGroupPendingData = { expectedVersion?: number } & Record<string, unknown>

export type ValueGroupMenuBaseContext = {
    t: (key: string, options?: unknown) => string
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

export const DIALOG_SAVE_CANCEL = { __dialogCancelled: true } as const

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

export const toValueGroupWithContainersDisplay = (set: ValueGroupWithContainers, locale: string): ValueGroupWithContainersDisplay => {
    const base = toValueGroupDisplay(set, locale)
    const treeEntities = set.treeEntities || []
    const primaryHub = treeEntities[0]
    const hubName = primaryHub
        ? getVLCString(primaryHub.name, locale) || getVLCString(primaryHub.name, 'en') || primaryHub.codename || '—'
        : '—'

    const allTreeEntities: ContainerDisplayInfo[] = treeEntities.map((hub) => ({
        id: hub.id,
        name: getVLCString(hub.name, locale) || getVLCString(hub.name, 'en') || hub.codename || '—',
        codename: hub.codename || ''
    }))

    return {
        ...base,
        treeEntityId: primaryHub?.id || '',
        hubName,
        hubCodename: primaryHub?.codename || '',
        containersCount: treeEntities.length,
        allTreeEntities
    }
}
