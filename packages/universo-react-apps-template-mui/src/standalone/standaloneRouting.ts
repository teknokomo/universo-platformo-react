import { isUuidV7 } from '@universo-react/utils'
import type { MarketingRuntimeTarget, RuntimeLayoutTarget } from '../api/api'

export type StandaloneSectionTarget = {
    targetKind: NonNullable<RuntimeLayoutTarget['targetKind']>
    entityTypeId: string
}

const isRuntimeThemeVariant = (value: string): value is NonNullable<RuntimeLayoutTarget['themeVariant']> =>
    value === 'light' || value === 'dark' || value === 'system'

const readStandaloneSearchParams = (routeSourceOverride?: string): URLSearchParams => {
    if (typeof window === 'undefined') return new URLSearchParams()

    const currentRouteSource = `${window.location.pathname}${window.location.search}${window.location.hash}`
    const routeSource = routeSourceOverride ?? currentRouteSource
    const hashRouteStart = routeSource.indexOf('#/')
    const normalizedRouteSource = hashRouteStart === -1 ? routeSource : routeSource.slice(hashRouteStart + 1)
    const searchStart = normalizedRouteSource.indexOf('?')
    const search = searchStart === -1 ? '' : normalizedRouteSource.slice(searchStart + 1).split('#', 1)[0]
    return new URLSearchParams(search)
}

/** Builds a standalone section link while preserving the active runtime context. */
export const buildStandaloneSectionHref = (
    applicationId: string,
    collectionId: string,
    sectionLinksEnabled: boolean,
    target?: StandaloneSectionTarget | null
): string => {
    const href = sectionLinksEnabled ? `/a/${applicationId}/${encodeURIComponent(collectionId)}` : `/a/${applicationId}`
    if (!sectionLinksEnabled || !target) return href

    const params = readStandaloneSearchParams()
    params.delete('targetKind')
    params.delete('entityTypeId')
    params.delete('entityTypeCodename')
    params.set('targetKind', target.targetKind)
    params.set('entityTypeId', target.entityTypeId)
    const search = params.toString()
    return search ? `${href}?${search}` : href
}

/** Reads the complete browser route, including hosted and standalone hash routes. */
export const readCurrentRouteSource = (): string => {
    if (typeof window === 'undefined') return ''
    return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

/** Returns the pathname represented by the current hosted or standalone route. */
export const readCurrentRoutePathname = (routeSource: string): string => {
    if (typeof window === 'undefined') return ''
    const hashRoute = window.location.hash.startsWith('#/') ? window.location.hash.slice(1) : ''
    const pathname = hashRoute || routeSource
    return pathname.split(/[?#]/, 1)[0] ?? window.location.pathname
}

/** Reads the workspace selector from the active hosted or standalone query string. */
export const readStandaloneWorkspaceId = (routeSource?: string): string | null => {
    if (typeof window === 'undefined') return null

    return readStandaloneSearchParams(routeSource).get('workspaceId')
}

/** Reads the marketing-page target without accepting unsupported target kinds. */
export const readStandaloneMarketingTarget = (routeSource?: string): MarketingRuntimeTarget | null => {
    if (typeof window === 'undefined') return null

    const params = readStandaloneSearchParams(routeSource)
    const targetKindParam = params.get('targetKind')?.trim().toLowerCase()
    const targetKind: MarketingRuntimeTarget['targetKind'] =
        targetKindParam === 'page' || targetKindParam === 'object' ? targetKindParam : null
    const target = {
        targetKind,
        entityTypeId: params.get('entityTypeId')?.trim() || null,
        entityTypeCodename: params.get('entityTypeCodename')?.trim() || null,
        recordKey: params.get('recordKey')?.trim() || null
    }
    return Object.values(target).some(Boolean) ? target : null
}

/** Parses and validates the target used by the effective-layout request. */
export const readStandaloneRuntimeTarget = (locale: string, workspaceId: string | null, routeSource?: string): RuntimeLayoutTarget => {
    if (typeof window === 'undefined') {
        return { locale, workspaceId }
    }

    const params = readStandaloneSearchParams(routeSource)
    const targetKindParam = params.get('targetKind')?.trim().toLowerCase() ?? null
    const targetKind = targetKindParam === 'page' || targetKindParam === 'object' ? targetKindParam : null
    const entityTypeId = params.get('entityTypeId')?.trim() || null
    const entityTypeCodename = params.get('entityTypeCodename')?.trim() || null
    if (targetKindParam !== null && targetKind === null) throw new Error('Runtime target kind is invalid')
    if (entityTypeId && !isUuidV7(entityTypeId)) throw new Error('Runtime target entity id is invalid')
    if (entityTypeId && entityTypeCodename) throw new Error('Runtime target must use entityTypeId or entityTypeCodename, not both')
    if ((entityTypeId || entityTypeCodename) && !targetKind) {
        throw new Error('Runtime target kind is required when an entity selector is provided')
    }
    if (targetKind && !entityTypeId && !entityTypeCodename) {
        throw new Error('Runtime target selector is required for an entity target')
    }

    const themeVariantParam = params.get('themeVariant')?.trim().toLowerCase() ?? null
    if (themeVariantParam && !isRuntimeThemeVariant(themeVariantParam)) {
        throw new Error('Runtime target theme variant is invalid')
    }

    return {
        targetKind,
        entityTypeId,
        entityTypeCodename,
        workspaceId: params.get('workspaceId')?.trim() || workspaceId,
        locale: locale.trim() || null,
        themeVariant: themeVariantParam && isRuntimeThemeVariant(themeVariantParam) ? themeVariantParam : null
    }
}

/** Detects matrix-cell navigation in either the hosted query or hash route query. */
export const hasMatrixCellRouteParam = (routeSource: string): boolean => {
    const searchStart = routeSource.indexOf('?')
    if (searchStart === -1) return false

    const hashStart = routeSource.indexOf('#', searchStart)
    const search = routeSource.slice(searchStart + 1, hashStart === -1 ? undefined : hashStart)
    return new URLSearchParams(search).has('matrixCell')
}
