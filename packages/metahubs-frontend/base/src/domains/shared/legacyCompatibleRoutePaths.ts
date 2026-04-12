import { LEGACY_COMPATIBLE_KIND_KEYS, getLegacyCompatibleObjectKindForKindKey, type LegacyCompatibleObjectKind } from '@universo/types'

export type HubAuthoringTab = 'hubs' | 'catalogs' | 'sets' | 'enumerations'

export type LegacyCompatibleChildObjectKind = Exclude<LegacyCompatibleObjectKind, 'document'>

type LegacyCompatibleRouteOptions = {
    metahubId?: string | null
    kindKey?: string | null
    hubId?: string | null
}

type SetAuthoringPathOptions = LegacyCompatibleRouteOptions & {
    setId?: string | null
}

type EnumerationAuthoringPathOptions = LegacyCompatibleRouteOptions & {
    enumerationId?: string | null
}

const normalizeSegment = (value?: string | null): string => (typeof value === 'string' ? value.trim() : '')

export const resolveLegacyCompatibleChildKindKey = ({
    routeKindKey,
    childObjectKind
}: {
    routeKindKey?: string | null
    childObjectKind: LegacyCompatibleChildObjectKind
}): string | undefined => {
    const normalizedRouteKindKey = normalizeSegment(routeKindKey)
    if (!normalizedRouteKindKey) {
        return undefined
    }

    const routeObjectKind = getLegacyCompatibleObjectKindForKindKey(normalizedRouteKindKey)
    if (routeObjectKind === 'hub' && childObjectKind !== 'hub') {
        return LEGACY_COMPATIBLE_KIND_KEYS[childObjectKind]
    }

    return normalizedRouteKindKey
}

export const buildHubAuthoringPath = ({ metahubId, hubId, kindKey, tab }: LegacyCompatibleRouteOptions & { tab: HubAuthoringTab }): string => {
    const normalizedMetahubId = normalizeSegment(metahubId)
    const normalizedHubId = normalizeSegment(hubId)
    const normalizedKindKey = normalizeSegment(kindKey)

    if (!normalizedMetahubId || !normalizedHubId) {
        return ''
    }

    if (normalizedKindKey) {
        return `/metahub/${normalizedMetahubId}/entities/${encodeURIComponent(normalizedKindKey)}/instance/${normalizedHubId}/${tab}`
    }

    return `/metahub/${normalizedMetahubId}/hub/${normalizedHubId}/${tab}`
}

export const buildSetAuthoringPath = ({ metahubId, setId, hubId, kindKey }: SetAuthoringPathOptions): string => {
    const normalizedMetahubId = normalizeSegment(metahubId)
    const normalizedSetId = normalizeSegment(setId)
    const normalizedHubId = normalizeSegment(hubId)
    const normalizedKindKey = normalizeSegment(kindKey)

    if (!normalizedMetahubId || !normalizedSetId) {
        return ''
    }

    if (normalizedKindKey && normalizedHubId) {
        return `/metahub/${normalizedMetahubId}/entities/${encodeURIComponent(normalizedKindKey)}/instance/${normalizedHubId}/set/${normalizedSetId}/constants`
    }

    if (normalizedKindKey) {
        return `/metahub/${normalizedMetahubId}/entities/${encodeURIComponent(normalizedKindKey)}/instance/${normalizedSetId}/constants`
    }

    if (normalizedHubId) {
        return `/metahub/${normalizedMetahubId}/hub/${normalizedHubId}/set/${normalizedSetId}/constants`
    }

    return `/metahub/${normalizedMetahubId}/set/${normalizedSetId}/constants`
}

export const buildEnumerationAuthoringPath = ({
    metahubId,
    enumerationId,
    hubId,
    kindKey
}: EnumerationAuthoringPathOptions): string => {
    const normalizedMetahubId = normalizeSegment(metahubId)
    const normalizedEnumerationId = normalizeSegment(enumerationId)
    const normalizedHubId = normalizeSegment(hubId)
    const normalizedKindKey = normalizeSegment(kindKey)

    if (!normalizedMetahubId || !normalizedEnumerationId) {
        return ''
    }

    if (normalizedKindKey && normalizedHubId) {
        return `/metahub/${normalizedMetahubId}/entities/${encodeURIComponent(normalizedKindKey)}/instance/${normalizedHubId}/enumeration/${normalizedEnumerationId}/values`
    }

    if (normalizedKindKey) {
        return `/metahub/${normalizedMetahubId}/entities/${encodeURIComponent(normalizedKindKey)}/instance/${normalizedEnumerationId}/values`
    }

    if (normalizedHubId) {
        return `/metahub/${normalizedMetahubId}/hub/${normalizedHubId}/enumeration/${normalizedEnumerationId}/values`
    }

    return `/metahub/${normalizedMetahubId}/enumeration/${normalizedEnumerationId}/values`
}