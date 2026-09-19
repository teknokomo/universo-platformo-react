import type { DbExecutor } from '@universo-react/utils'
import {
    IDENTIFIER_REGEX,
    resolveLocalizedContent,
    resolvePresentationName,
    resolveRuntimeCodenameText,
    runtimeStandardKindSql
} from '../../shared/runtimeHelpers'
import {
    RUNTIME_OBJECT_FILTER_SQL,
    isRuntimeHubKind,
    partitionRuntimeMenuItems,
    resolveRuntimeStandardKind,
    type RuntimeZoneWidgets
} from '../runtimeRowSupport/contracts'
import {
    buildRuntimeAllObjectCollectionMenuItems,
    buildRuntimeBoundTreeEntityObjectCollectionItems,
    buildRuntimeTreeEntityMenuItems,
    buildRuntimeWorkspaceMenuItem,
    normalizeRuntimeMenuItem,
    resolveRuntimeMenuStartSectionTarget,
    resolveRuntimeMenuTreeEntityId,
    type RuntimeMenuEntry,
    type RuntimeMenuLookups,
    type RuntimeMenuItem,
    type RuntimeMenuStructure,
    type RuntimeObjectCollectionMeta,
    type RuntimeTreeEntityMeta,
    type RuntimeWorkspacePlacement
} from '../runtimeRowSupport/menuItems'

import type { RuntimeReadRuntimeSection } from './types'

export const loadRuntimeMenuStructure = async (params: {
    manager: DbExecutor
    schemaIdent: string
    requestedLocale: string
}): Promise<RuntimeMenuStructure> => {
    let treeEntityMetaById = new Map<string, RuntimeTreeEntityMeta>()
    let treeEntityMetaByCodename = new Map<string, RuntimeTreeEntityMeta>()
    let objectCollectionMetaById = new Map<string, RuntimeObjectCollectionMeta>()
    let objectCollectionMetaByCodename = new Map<string, RuntimeObjectCollectionMeta>()
    let childTreeEntityIdsByParent = new Map<string, string[]>()
    let objectCollectionsByTreeEntity = new Map<string, RuntimeObjectCollectionMeta[]>()

    try {
        const objectRows = (await params.manager.query(
            `
      SELECT id, kind, codename, presentation, config, table_name
      FROM ${params.schemaIdent}._app_objects
                WHERE (${runtimeStandardKindSql('kind')} = 'hub' OR ${RUNTIME_OBJECT_FILTER_SQL} OR ${runtimeStandardKindSql(
                'kind'
            )} = 'page')
        AND _upl_deleted = false
        AND _app_deleted = false
    `
        )) as Array<{
            id: string
            kind: string
            codename: unknown
            presentation?: unknown
            config?: unknown
            table_name?: string | null
        }>

        for (const row of objectRows) {
            // Tree/bound menu items must resolve: object collections without a
            // physical runtime table fail closed when opened, so they never
            // become navigation targets (hubs and pages are not table-backed).
            const isHubRow = isRuntimeHubKind(row.kind)
            const isPageRow = resolveRuntimeStandardKind(row.kind) === 'page'
            if (!isHubRow && !isPageRow && !IDENTIFIER_REGEX.test(row.table_name ?? '')) continue

            const config = row.config && typeof row.config === 'object' ? (row.config as Record<string, unknown>) : {}
            const rawSortOrder = config.sortOrder
            const sortOrder = typeof rawSortOrder === 'number' ? rawSortOrder : 0
            const title = resolvePresentationName(row.presentation, params.requestedLocale, resolveRuntimeCodenameText(row.codename))

            if (isRuntimeHubKind(row.kind)) {
                const parentTreeEntityId = typeof config.parentHubId === 'string' ? config.parentHubId : null
                const treeEntityMeta: RuntimeTreeEntityMeta = {
                    id: row.id,
                    codename: row.codename,
                    title,
                    parentTreeEntityId,
                    sortOrder
                }
                treeEntityMetaById.set(row.id, treeEntityMeta)
                treeEntityMetaByCodename.set(resolveRuntimeCodenameText(row.codename), treeEntityMeta)
                continue
            }

            const treeEntityIds = Array.isArray(config.hubs)
                ? config.hubs.filter((value): value is string => typeof value === 'string')
                : []
            const objectCollectionMeta: RuntimeObjectCollectionMeta = {
                id: row.id,
                codename: row.codename,
                kind: resolveRuntimeStandardKind(row.kind),
                title,
                sortOrder,
                treeEntityIds
            }
            objectCollectionMetaById.set(row.id, objectCollectionMeta)
            objectCollectionMetaByCodename.set(resolveRuntimeCodenameText(row.codename), objectCollectionMeta)
            for (const treeEntityId of treeEntityIds) {
                const list = objectCollectionsByTreeEntity.get(treeEntityId) ?? []
                list.push(objectCollectionMeta)
                objectCollectionsByTreeEntity.set(treeEntityId, list)
            }
        }

        const treeEntitySortComparator = (a: RuntimeTreeEntityMeta, b: RuntimeTreeEntityMeta) => {
            if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
            return resolveRuntimeCodenameText(a.codename).localeCompare(resolveRuntimeCodenameText(b.codename))
        }
        const objectCollectionSortComparator = (a: RuntimeObjectCollectionMeta, b: RuntimeObjectCollectionMeta) => {
            if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
            return resolveRuntimeCodenameText(a.codename).localeCompare(resolveRuntimeCodenameText(b.codename))
        }

        const treeEntities = Array.from(treeEntityMetaById.values()).sort(treeEntitySortComparator)
        childTreeEntityIdsByParent = new Map<string, string[]>()
        for (const treeEntity of treeEntities) {
            if (!treeEntity.parentTreeEntityId) continue
            const childIds = childTreeEntityIdsByParent.get(treeEntity.parentTreeEntityId) ?? []
            childIds.push(treeEntity.id)
            childTreeEntityIdsByParent.set(treeEntity.parentTreeEntityId, childIds)
        }

        for (const [treeEntityId, treeEntityObjectCollections] of objectCollectionsByTreeEntity.entries()) {
            objectCollectionsByTreeEntity.set(treeEntityId, [...treeEntityObjectCollections].sort(objectCollectionSortComparator))
        }
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[ApplicationsRuntime] Failed to build hub/object runtime map for menuWidget (ignored)', e)
        treeEntityMetaById = new Map()
        treeEntityMetaByCodename = new Map()
        objectCollectionMetaById = new Map()
        objectCollectionMetaByCodename = new Map()
        childTreeEntityIdsByParent = new Map()
        objectCollectionsByTreeEntity = new Map()
    }

    return {
        treeEntityMetaById,
        treeEntityMetaByCodename,
        objectCollectionMetaById,
        objectCollectionMetaByCodename,
        childTreeEntityIdsByParent,
        objectCollectionsByTreeEntity
    }
}

export const buildRuntimeReadMenus = (params: {
    objectCollectionsForRuntime: RuntimeReadRuntimeSection[]
    runtimeMenuTargetById: Map<string, RuntimeReadRuntimeSection>
    menuStructure: RuntimeMenuStructure
    zoneWidgets: RuntimeZoneWidgets
    requestedLocale: string
    applicationId: string
    workspacesEnabled: boolean
}): { menus: RuntimeMenuEntry[]; activeMenuId: string | null } => {
    const lookups: RuntimeMenuLookups = {
        runtimeMenuTargetById: params.runtimeMenuTargetById,
        objectCollectionMetaById: params.menuStructure.objectCollectionMetaById,
        objectCollectionMetaByCodename: params.menuStructure.objectCollectionMetaByCodename,
        treeEntityMetaById: params.menuStructure.treeEntityMetaById,
        treeEntityMetaByCodename: params.menuStructure.treeEntityMetaByCodename,
        childTreeEntityIdsByParent: params.menuStructure.childTreeEntityIdsByParent,
        objectCollectionsByTreeEntity: params.menuStructure.objectCollectionsByTreeEntity
    }

    let menus: RuntimeMenuEntry[] = []
    let activeMenuId: string | null = null

    try {
        for (const widget of params.zoneWidgets.left) {
            if (widget.widgetKey !== 'menuWidget') continue
            const cfg = widget.config as Record<string, unknown>
            const bindToTreeEntity = Boolean(cfg.bindToHub)
            const boundTreeEntityId = resolveRuntimeMenuTreeEntityId({
                treeEntityMetaById: lookups.treeEntityMetaById,
                treeEntityMetaByCodename: lookups.treeEntityMetaByCodename,
                value: cfg.boundHubId ?? cfg.boundTreeEntityId
            })
            const autoShowAllSections = Boolean(cfg.autoShowAllSections) && !bindToTreeEntity

            let resolvedItems: RuntimeMenuItem[] = []
            if (bindToTreeEntity && boundTreeEntityId) {
                resolvedItems = buildRuntimeBoundTreeEntityObjectCollectionItems({
                    treeEntityMetaById: lookups.treeEntityMetaById,
                    objectCollectionsByTreeEntity: lookups.objectCollectionsByTreeEntity,
                    widgetId: widget.id,
                    boundTreeEntityId
                })
            } else if (autoShowAllSections) {
                resolvedItems = buildRuntimeAllObjectCollectionMenuItems({
                    // Menu entries must resolve: non-tabular collections (set/
                    // enumeration clones without a physical table) fail closed
                    // when opened, so they never become navigation targets.
                    sections: params.objectCollectionsForRuntime.filter(
                        (section) => section.kind === 'page' || IDENTIFIER_REGEX.test(section.tableName ?? '')
                    ),
                    widgetId: widget.id
                })
            } else {
                const rawItems = Array.isArray(cfg.items) ? cfg.items : []
                const normalizedItems = rawItems
                    .map((item) => normalizeRuntimeMenuItem({ ...lookups, locale: params.requestedLocale, item }))
                    .filter((item): item is RuntimeMenuItem => item !== null)
                    .sort((a, b) => a.sortOrder - b.sortOrder)

                for (const item of normalizedItems) {
                    if (isRuntimeHubKind(item.kind)) {
                        const expanded = buildRuntimeTreeEntityMenuItems({
                            treeEntityMetaById: lookups.treeEntityMetaById,
                            childTreeEntityIdsByParent: lookups.childTreeEntityIdsByParent,
                            objectCollectionsByTreeEntity: lookups.objectCollectionsByTreeEntity,
                            baseItem: item
                        })
                        if (expanded.length > 0) {
                            resolvedItems.push(...expanded)
                        }
                        continue
                    }
                    resolvedItems.push(item)
                }
            }

            const rawMaxPrimaryItems = cfg.maxPrimaryItems
            const maxPrimaryItems =
                typeof rawMaxPrimaryItems === 'number' && Number.isFinite(rawMaxPrimaryItems)
                    ? Math.max(1, Math.min(12, Math.trunc(rawMaxPrimaryItems)))
                    : null
            const rawWorkspacePlacement = cfg.workspacePlacement
            const workspacePlacement: RuntimeWorkspacePlacement =
                rawWorkspacePlacement === 'overflow' || rawWorkspacePlacement === 'hidden' ? rawWorkspacePlacement : 'primary'
            let workspaceItem: RuntimeMenuItem | null = null
            if (params.workspacesEnabled) {
                workspaceItem = buildRuntimeWorkspaceMenuItem({
                    sortOrder: resolvedItems.length + 1000,
                    locale: params.requestedLocale,
                    applicationId: params.applicationId
                })
            }
            const { primaryItems, overflowItems } = partitionRuntimeMenuItems(
                resolvedItems,
                maxPrimaryItems,
                workspaceItem,
                workspacePlacement
            )

            const menuEntry = {
                id: widget.id,
                widgetId: widget.id,
                showTitle: Boolean(cfg.showTitle),
                title: resolveLocalizedContent(cfg.title, params.requestedLocale, ''),
                autoShowAllSections,
                startPage: typeof cfg.startPage === 'string' ? cfg.startPage : null,
                startSectionId:
                    resolveRuntimeMenuStartSectionTarget({
                        ...lookups,
                        value: cfg.startPage,
                        target: cfg.startTarget,
                        items: resolvedItems
                    })?.id ?? null,
                maxPrimaryItems,
                overflowLabelKey: typeof cfg.overflowLabelKey === 'string' ? cfg.overflowLabelKey : null,
                workspacePlacement,
                items: primaryItems,
                overflowItems
            } satisfies RuntimeMenuEntry
            menus.push(menuEntry)
        }
        activeMenuId = menus[0]?.id ?? null
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[ApplicationsRuntime] Failed to build menus from widget config (ignored)', e)
    }

    return { menus, activeMenuId }
}
