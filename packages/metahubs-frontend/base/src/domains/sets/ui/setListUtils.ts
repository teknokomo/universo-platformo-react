import type { VersionedLocalizedContent } from '@universo/types'
import { getVLCString, toSetDisplay } from '../../../types'
import type { MetahubSetDisplay } from '../../../types'
import type { SetWithHubs } from '../api'

export interface HubDisplayInfo {
    id: string
    name: string
    codename: string
}

export interface SetWithHubsDisplay extends MetahubSetDisplay {
    hubId: string
    hubName: string
    hubCodename: string
    hubsCount: number
    allHubs: HubDisplayInfo[]
}

export type SetFormValues = {
    nameVlc: VersionedLocalizedContent<string> | null
    descriptionVlc: VersionedLocalizedContent<string> | null
    codename: VersionedLocalizedContent<string> | null
    codenameTouched?: boolean
    hubIds: string[]
    isSingleHub: boolean
    isRequiredHub?: boolean
}

export type SetPendingData = { expectedVersion?: number } & Record<string, unknown>

export type SetMenuBaseContext = {
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

export const toSetWithHubsDisplay = (set: SetWithHubs, locale: string): SetWithHubsDisplay => {
    const base = toSetDisplay(set, locale)
    const hubs = set.hubs || []
    const primaryHub = hubs[0]
    const hubName = primaryHub
        ? getVLCString(primaryHub.name, locale) || getVLCString(primaryHub.name, 'en') || primaryHub.codename || '—'
        : '—'

    const allHubs: HubDisplayInfo[] = hubs.map((hub) => ({
        id: hub.id,
        name: getVLCString(hub.name, locale) || getVLCString(hub.name, 'en') || hub.codename || '—',
        codename: hub.codename || ''
    }))

    return {
        ...base,
        hubId: primaryHub?.id || '',
        hubName,
        hubCodename: primaryHub?.codename || '',
        hubsCount: hubs.length,
        allHubs
    }
}
