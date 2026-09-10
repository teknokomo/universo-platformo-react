import { isUuidV7 } from '@universo-react/utils'
import type { DashboardMenuItem } from '../dashboard/Dashboard'
import type { AppDataResponse } from '../api/api'
import { buildStandaloneSectionHref, type StandaloneSectionTarget } from './standaloneRouting'

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const readStringArrayConfig = (value: unknown): string[] => {
    if (!Array.isArray(value)) return []
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
}

const normalizeRuntimeKey = (value: string | null | undefined): string => (value ?? '').trim().toLowerCase()

/** Resolves the loaded section metadata used by the standalone details surface. */
export const resolveSectionRecord = (
    appData: AppDataResponse | undefined,
    sectionId: string | null | undefined
): AppDataResponse['objectCollection'] | undefined => {
    if (!appData || !sectionId) return undefined

    const candidates = [...(appData.sections ?? []), ...(appData.objectCollections ?? [])]
    return candidates.find((candidate) => candidate.id === sectionId)
}

/** Maps a menu section to a UUID-v7 Page or Object target supplied by runtime metadata. */
export const resolveStandaloneSectionTarget = (
    item: DashboardMenuItem,
    appData: AppDataResponse | undefined
): StandaloneSectionTarget | null => {
    if (!appData) return null

    const targetIds = [item.objectCollectionId, item.sectionId]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    if (targetIds.length === 0) return null

    const candidates = [...(appData.sections ?? []), ...(appData.objectCollections ?? [])]
    const target = candidates.find((candidate) => targetIds.includes(candidate.id))
    if (!target || !isUuidV7(target.id)) return null

    const normalizedKind = target.kind?.trim().toLowerCase()
    if (normalizedKind !== 'page' && normalizedKind !== 'object') return null

    return {
        targetKind: normalizedKind,
        entityTypeId: target.id
    }
}

/** Returns the section identifier currently represented by loaded runtime data. */
export const getLoadedRuntimeSectionId = (appData: AppDataResponse | undefined): string | null =>
    appData?.section?.id ?? appData?.activeSectionId ?? appData?.objectCollection?.id ?? appData?.activeObjectCollectionId ?? null

/** Projects already loaded metadata onto a route-selected section without leaking stale rows. */
export const buildRouteProjectedAppData = (
    appData: AppDataResponse | undefined,
    currentRuntimeSection: AppDataResponse['objectCollection'] | undefined,
    currentRuntimeSectionId: string | null
): AppDataResponse | undefined => {
    if (!appData || !currentRuntimeSection || !currentRuntimeSectionId) return undefined
    if (getLoadedRuntimeSectionId(appData) === currentRuntimeSectionId) return undefined

    const hasTable = typeof currentRuntimeSection.tableName === 'string' && currentRuntimeSection.tableName.trim().length > 0

    return {
        ...appData,
        section: currentRuntimeSection,
        objectCollection: currentRuntimeSection,
        activeSectionId: currentRuntimeSectionId,
        activeObjectCollectionId: hasTable ? currentRuntimeSectionId : null,
        columns: [],
        rows: [],
        pagination: {
            ...appData.pagination,
            total: 0,
            offset: 0
        }
    }
}

/** Resolves the single-system Interpretation Network section selected by runtime metadata. */
export const resolveSingleSystemMatrixSectionId = (appData: AppDataResponse | undefined): string | null => {
    if (!appData) return null

    const workspaceWidget = appData.zoneWidgets?.center?.find((widget) => widget.widgetKey === 'interpretationNetworkWorkspace')
    const visibleFor = isRecord(workspaceWidget?.config?.visibleFor) ? workspaceWidget.config.visibleFor : undefined
    if (!visibleFor) return null

    const sectionIds = readStringArrayConfig(visibleFor.sectionIds)
    const sectionCodenames = readStringArrayConfig(visibleFor.sectionCodenames).map(normalizeRuntimeKey)
    const objectCollectionIds = readStringArrayConfig(visibleFor.objectCollectionIds)
    const objectCollectionCodenames = readStringArrayConfig(visibleFor.objectCollectionCodenames).map(normalizeRuntimeKey)

    const menuSectionTargets = new Set(
        (appData.menus ?? [])
            .flatMap((menu) => [...(menu.items ?? []), ...(menu.overflowItems ?? [])])
            .filter((item) => item.isActive !== false && item.kind === 'section')
            .flatMap((item) => [item.sectionId, item.objectCollectionId])
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    )
    const preferMenuTarget = (ids: string[]): string | null => {
        const uniqueIds = Array.from(new Set(ids))
        return uniqueIds.find((id) => menuSectionTargets.has(id)) ?? uniqueIds[0] ?? null
    }

    const matchingSectionIds = (appData.sections ?? [])
        .filter((section) => sectionIds.includes(section.id) || sectionCodenames.includes(normalizeRuntimeKey(section.codename)))
        .map((section) => section.id)
    const matchingObjectCollectionIds = (appData.objectCollections ?? [])
        .filter(
            (objectCollection) =>
                objectCollectionIds.includes(objectCollection.id) ||
                objectCollectionCodenames.includes(normalizeRuntimeKey(objectCollection.codename))
        )
        .map((objectCollection) => objectCollection.id)
    const tableBackedObjectCollectionIds = (appData.objectCollections ?? [])
        .filter(
            (objectCollection) =>
                matchingObjectCollectionIds.includes(objectCollection.id) &&
                typeof objectCollection.tableName === 'string' &&
                objectCollection.tableName.trim().length > 0
        )
        .map((objectCollection) => objectCollection.id)
    const tableBackedSectionIds = (appData.sections ?? [])
        .filter(
            (section) =>
                matchingSectionIds.includes(section.id) && typeof section.tableName === 'string' && section.tableName.trim().length > 0
        )
        .map((section) => section.id)

    return preferMenuTarget([
        ...tableBackedObjectCollectionIds,
        ...tableBackedSectionIds,
        ...matchingObjectCollectionIds,
        ...matchingSectionIds
    ])
}

/** Converts section menu entries to target-aware links and fails closed for invalid metadata. */
export const toStandaloneSectionLinkMenuItem = (
    item: DashboardMenuItem,
    applicationId: string,
    sectionLinksEnabled: boolean,
    forceLink: boolean,
    appData: AppDataResponse | undefined
): DashboardMenuItem => {
    if (item.kind !== 'section') {
        return { ...item, selected: false }
    }

    const targetCollectionId = item.sectionId ?? item.objectCollectionId
    if (!targetCollectionId) {
        return { ...item, selected: false }
    }

    if (!forceLink && !sectionLinksEnabled) {
        return { ...item, selected: false }
    }

    const target = resolveStandaloneSectionTarget(item, appData)
    if (!target && !forceLink) {
        return { ...item, selected: false }
    }

    return {
        ...item,
        kind: 'link',
        href: buildStandaloneSectionHref(applicationId, targetCollectionId, sectionLinksEnabled, target),
        selected: false
    }
}

export const isWorkspaceRootMenuItem = (item: DashboardMenuItem): boolean =>
    item.id === 'runtime-workspaces' || item.id === 'workspaces' || /\/workspaces(?:$|\?)/.test(item.href ?? '')
