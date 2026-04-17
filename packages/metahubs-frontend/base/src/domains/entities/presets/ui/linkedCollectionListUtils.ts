import type { VersionedLocalizedContent } from '@universo/types'
import type { LinkedCollectionDisplay } from '../../../../types'
import { getVLCString, toLinkedCollectionDisplay } from '../../../../types'
import type { LinkedCollectionWithContainers } from '../api/linkedCollections'

/**
 * Container info for display in the table column (global view)
 */
export interface ContainerDisplayInfo {
    id: string
    name: string
    codename: string
}

/**
 * Extended LinkedCollectionDisplay that includes hub info for the all-linkedCollections view.
 * For N:M relationship, we use the primary hub (first in list) for navigation.
 */
export interface LinkedCollectionWithContainersDisplay extends LinkedCollectionDisplay {
    treeEntityId: string
    hubName: string
    hubCodename: string
    containersCount: number
    allTreeEntities: ContainerDisplayInfo[]
}

export type LinkedCollectionFormValues = {
    nameVlc: VersionedLocalizedContent<string> | null
    descriptionVlc: VersionedLocalizedContent<string> | null
    codename: VersionedLocalizedContent<string> | null
    codenameTouched?: boolean
    treeEntityIds: string[]
    isSingleHub: boolean
    isRequiredHub?: boolean
}

export type LinkedCollectionPendingData = { expectedVersion?: number } & Record<string, unknown>

export type LinkedCollectionMenuBaseContext = {
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

/**
 * Convert LinkedCollectionWithContainers to display format with hub info (for global view)
 */
export const toLinkedCollectionWithContainersDisplay = (
    catalog: LinkedCollectionWithContainers,
    locale: string
): LinkedCollectionWithContainersDisplay => {
    const base = toLinkedCollectionDisplay(catalog, locale)
    const treeEntities = catalog.treeEntities || []
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
