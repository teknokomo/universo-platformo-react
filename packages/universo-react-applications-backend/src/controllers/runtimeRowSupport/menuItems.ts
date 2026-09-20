import { resolveLocalizedContent, resolveRuntimeCodenameText } from '../../shared/runtimeHelpers'

export type RuntimeMenuItem = {
    id: string
    kind: string
    title: string
    icon: string | null
    href: string | null
    objectCollectionId: string | null
    sectionId: string | null
    treeEntityId: string | null
    sortOrder: number
    isActive: boolean
}

export type RuntimeWorkspacePlacement = 'primary' | 'overflow' | 'hidden'

export type RuntimeMenuEntry = {
    id: string
    widgetId: string
    showTitle: boolean
    title: string
    autoShowAllSections: boolean
    startPage: string | null
    startSectionId: string | null
    maxPrimaryItems: number | null
    overflowLabelKey: string | null
    workspacePlacement: RuntimeWorkspacePlacement
    items: RuntimeMenuItem[]
    overflowItems: RuntimeMenuItem[]
}

export type RuntimeTreeEntityMeta = {
    id: string
    codename: unknown
    title: string
    parentTreeEntityId: string | null
    sortOrder: number
}

export type RuntimeObjectCollectionMeta = {
    id: string
    codename: unknown
    kind: string | null
    title: string
    sortOrder: number
    treeEntityIds: string[]
}

export type RuntimeSectionTarget = { id: string; kind: 'section' | 'objectCollection' }

export type RuntimeMenuStructure = {
    treeEntityMetaById: Map<string, RuntimeTreeEntityMeta>
    treeEntityMetaByCodename: Map<string, RuntimeTreeEntityMeta>
    objectCollectionMetaById: Map<string, RuntimeObjectCollectionMeta>
    objectCollectionMetaByCodename: Map<string, RuntimeObjectCollectionMeta>
    childTreeEntityIdsByParent: Map<string, string[]>
    objectCollectionsByTreeEntity: Map<string, RuntimeObjectCollectionMeta[]>
}

export interface RuntimeMenuLookups {
    runtimeMenuTargetById: ReadonlyMap<string, unknown>
    objectCollectionMetaById: ReadonlyMap<string, RuntimeObjectCollectionMeta>
    objectCollectionMetaByCodename: ReadonlyMap<string, RuntimeObjectCollectionMeta>
    treeEntityMetaById: ReadonlyMap<string, RuntimeTreeEntityMeta>
    treeEntityMetaByCodename: ReadonlyMap<string, RuntimeTreeEntityMeta>
    childTreeEntityIdsByParent: ReadonlyMap<string, string[]>
    objectCollectionsByTreeEntity: ReadonlyMap<string, RuntimeObjectCollectionMeta[]>
}

export const resolveRuntimeMenuObjectCollectionId = (params: {
    objectCollectionMetaById: ReadonlyMap<string, RuntimeObjectCollectionMeta>
    objectCollectionMetaByCodename: ReadonlyMap<string, RuntimeObjectCollectionMeta>
    value: unknown
}): string | null => {
    if (typeof params.value !== 'string' || params.value.trim().length === 0) return null
    const normalized = params.value.trim()
    const byId = params.objectCollectionMetaById.get(normalized)
    if (byId && byId.kind !== 'page') return normalized
    const byCodename = params.objectCollectionMetaByCodename.get(normalized)
    return byCodename && byCodename.kind !== 'page' ? byCodename.id : null
}

export const resolveRuntimeMenuSectionTarget = (params: RuntimeMenuLookups & { value: unknown }): RuntimeSectionTarget | null => {
    if (typeof params.value !== 'string' || params.value.trim().length === 0) return null
    const normalized = params.value.trim()
    const runtimeTarget = params.runtimeMenuTargetById.get(normalized)
    if (runtimeTarget) {
        return {
            id: normalized,
            kind: 'section'
        }
    }
    const objectCollectionId = resolveRuntimeMenuObjectCollectionId({
        objectCollectionMetaById: params.objectCollectionMetaById,
        objectCollectionMetaByCodename: params.objectCollectionMetaByCodename,
        value: normalized
    })
    return objectCollectionId ? { id: objectCollectionId, kind: 'objectCollection' } : null
}

export const resolveRuntimeMenuTreeEntityId = (params: {
    treeEntityMetaById: ReadonlyMap<string, RuntimeTreeEntityMeta>
    treeEntityMetaByCodename: ReadonlyMap<string, RuntimeTreeEntityMeta>
    value: unknown
}): string | null => {
    if (typeof params.value !== 'string' || params.value.trim().length === 0) return null
    const normalized = params.value.trim()
    if (params.treeEntityMetaById.has(normalized)) return normalized
    return params.treeEntityMetaByCodename.get(normalized)?.id ?? null
}

export const toRuntimeMenuStartTarget = (item: RuntimeMenuItem | null | undefined): RuntimeSectionTarget | null => {
    if (!item) return null
    if (item.objectCollectionId) return { id: item.objectCollectionId, kind: 'objectCollection' }
    if (item.sectionId) return { id: item.sectionId, kind: 'section' }
    return null
}

export const resolveRuntimeMenuStartTarget = (
    params: RuntimeMenuLookups & { target: unknown; items: RuntimeMenuItem[] }
): RuntimeSectionTarget | null => {
    if (!params.target || typeof params.target !== 'object' || Array.isArray(params.target)) return null
    const typedTarget = params.target as Record<string, unknown>
    const targetKind = typedTarget.kind
    if (targetKind === 'menuItem' && typeof typedTarget.menuItemId === 'string') {
        const menuItemId = typedTarget.menuItemId.trim()
        const explicitItem = params.items.find((item) => item.id === menuItemId)
        return toRuntimeMenuStartTarget(explicitItem)
    }
    if (targetKind === 'section') return resolveRuntimeMenuSectionTarget({ ...params, value: typedTarget.sectionId })
    if (targetKind === 'objectCollection') {
        const objectCollectionId = resolveRuntimeMenuObjectCollectionId({
            objectCollectionMetaById: params.objectCollectionMetaById,
            objectCollectionMetaByCodename: params.objectCollectionMetaByCodename,
            value: typedTarget.objectCollectionId
        })
        return objectCollectionId ? { id: objectCollectionId, kind: 'objectCollection' } : null
    }
    if (targetKind === 'hub' || targetKind === 'treeEntity') {
        const treeEntityId = resolveRuntimeMenuTreeEntityId({
            treeEntityMetaById: params.treeEntityMetaById,
            treeEntityMetaByCodename: params.treeEntityMetaByCodename,
            value: targetKind === 'hub' ? typedTarget.hubId : typedTarget.treeEntityId
        })
        if (!treeEntityId) return null
        const firstTreeItem = params.items.find((item) => item.treeEntityId === treeEntityId && (item.sectionId || item.objectCollectionId))
        return toRuntimeMenuStartTarget(firstTreeItem)
    }
    return null
}

export const resolveRuntimeMenuStartSectionTarget = (
    params: RuntimeMenuLookups & { value: unknown; target: unknown; items: RuntimeMenuItem[] }
): RuntimeSectionTarget | null => {
    const targetSection = resolveRuntimeMenuStartTarget(params)
    if (targetSection) return targetSection
    if (typeof params.value !== 'string' || params.value.trim().length === 0) return null
    const normalized = params.value.trim()
    const explicitItem = params.items.find((item) => item.id === normalized)
    if (explicitItem?.sectionId || explicitItem?.objectCollectionId) {
        return toRuntimeMenuStartTarget(explicitItem)
    }
    const treeEntityId = resolveRuntimeMenuTreeEntityId({
        treeEntityMetaById: params.treeEntityMetaById,
        treeEntityMetaByCodename: params.treeEntityMetaByCodename,
        value: normalized
    })
    if (treeEntityId) {
        const firstTreeItem = params.items.find((item) => item.treeEntityId === treeEntityId && (item.sectionId || item.objectCollectionId))
        return toRuntimeMenuStartTarget(firstTreeItem)
    }
    const objectCollectionId = resolveRuntimeMenuObjectCollectionId({
        objectCollectionMetaById: params.objectCollectionMetaById,
        objectCollectionMetaByCodename: params.objectCollectionMetaByCodename,
        value: normalized
    })
    return objectCollectionId ? { id: objectCollectionId, kind: 'objectCollection' } : null
}

export const normalizeRuntimeMenuItem = (params: RuntimeMenuLookups & { locale: string; item: unknown }): RuntimeMenuItem | null => {
    if (!params.item || typeof params.item !== 'object') return null
    const typed = params.item as Record<string, unknown>
    if (typed.isActive === false) return null

    const kind = typeof typed.kind === 'string' && typed.kind.trim().length > 0 ? typed.kind : 'link'
    const objectCollectionId = resolveRuntimeMenuObjectCollectionId({
        objectCollectionMetaById: params.objectCollectionMetaById,
        objectCollectionMetaByCodename: params.objectCollectionMetaByCodename,
        value: typed.objectCollectionId
    })
    const sectionTarget = objectCollectionId
        ? { id: objectCollectionId, kind: 'objectCollection' as const }
        : resolveRuntimeMenuSectionTarget({ ...params, value: typed.sectionId })
    const treeEntityId = resolveRuntimeMenuTreeEntityId({
        treeEntityMetaById: params.treeEntityMetaById,
        treeEntityMetaByCodename: params.treeEntityMetaByCodename,
        value: typed.hubId ?? typed.treeEntityId
    })
    return {
        id: String(typed.id ?? ''),
        kind,
        title: resolveLocalizedContent(typed.title, params.locale, kind),
        icon: typeof typed.icon === 'string' ? typed.icon : null,
        href: typeof typed.href === 'string' ? typed.href : null,
        objectCollectionId: sectionTarget?.kind === 'objectCollection' ? sectionTarget.id : null,
        sectionId: sectionTarget?.id ?? null,
        treeEntityId,
        sortOrder: typeof typed.sortOrder === 'number' ? typed.sortOrder : 0,
        isActive: true
    }
}

export const buildRuntimeTreeEntityMenuItems = (params: {
    treeEntityMetaById: ReadonlyMap<string, RuntimeTreeEntityMeta>
    childTreeEntityIdsByParent: ReadonlyMap<string, string[]>
    objectCollectionsByTreeEntity: ReadonlyMap<string, RuntimeObjectCollectionMeta[]>
    baseItem: RuntimeMenuItem
}): RuntimeMenuItem[] => {
    const { treeEntityMetaById, childTreeEntityIdsByParent, objectCollectionsByTreeEntity, baseItem } = params
    if (!baseItem.treeEntityId) return []
    if (!treeEntityMetaById.has(baseItem.treeEntityId)) return []

    const items: RuntimeMenuItem[] = []
    const visited = new Set<string>()
    const treeEntitySortComparator = (aId: string, bId: string) => {
        const a = treeEntityMetaById.get(aId)
        const b = treeEntityMetaById.get(bId)
        if (!a || !b) return aId.localeCompare(bId)
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
        return resolveRuntimeCodenameText(a.codename).localeCompare(resolveRuntimeCodenameText(b.codename))
    }

    const walkTreeEntity = (treeEntityId: string, depth: number) => {
        if (visited.has(treeEntityId)) return
        visited.add(treeEntityId)

        const treeEntityMeta = treeEntityMetaById.get(treeEntityId)
        if (!treeEntityMeta) return
        const indent = depth > 0 ? `${'\u00A0\u00A0'.repeat(depth)}• ` : ''

        items.push({
            id: `${baseItem.id}:hub:${treeEntityMeta.id}`,
            kind: 'hub',
            title: `${indent}${treeEntityMeta.title}`,
            icon: baseItem.icon,
            href: null,
            objectCollectionId: null,
            sectionId: null,
            treeEntityId: treeEntityMeta.id,
            sortOrder: baseItem.sortOrder,
            isActive: true
        })

        const treeEntityObjectCollections = objectCollectionsByTreeEntity.get(treeEntityMeta.id) ?? []
        for (const lc of treeEntityObjectCollections) {
            items.push({
                id: `${baseItem.id}:hub:${treeEntityMeta.id}:section:${lc.id}`,
                kind: 'section',
                title: `${'\u00A0\u00A0'.repeat(depth + 1)}${lc.title}`,
                icon: baseItem.icon,
                href: null,
                objectCollectionId: lc.id,
                sectionId: lc.id,
                treeEntityId: treeEntityMeta.id,
                sortOrder: baseItem.sortOrder,
                isActive: true
            })
        }

        const childIds = [...(childTreeEntityIdsByParent.get(treeEntityMeta.id) ?? [])].sort(treeEntitySortComparator)
        for (const childId of childIds) {
            walkTreeEntity(childId, depth + 1)
        }
    }

    walkTreeEntity(baseItem.treeEntityId, 0)
    return items
}

export const buildRuntimeBoundTreeEntityObjectCollectionItems = (params: {
    treeEntityMetaById: ReadonlyMap<string, RuntimeTreeEntityMeta>
    objectCollectionsByTreeEntity: ReadonlyMap<string, RuntimeObjectCollectionMeta[]>
    widgetId: string
    boundTreeEntityId: string
}): RuntimeMenuItem[] => {
    if (!params.treeEntityMetaById.has(params.boundTreeEntityId)) return []
    const directObjectCollections = params.objectCollectionsByTreeEntity.get(params.boundTreeEntityId) ?? []
    return directObjectCollections.map((lc, index) => ({
        id: `${params.widgetId}:bound-hub:${params.boundTreeEntityId}:section:${lc.id}`,
        kind: 'section',
        title: lc.title,
        icon: 'database',
        href: null,
        objectCollectionId: lc.id,
        sectionId: lc.id,
        treeEntityId: params.boundTreeEntityId,
        sortOrder: index + 1,
        isActive: true
    }))
}

export const buildRuntimeAllObjectCollectionMenuItems = (params: {
    sections: ReadonlyArray<{ id: string; kind: string; name: string }>
    widgetId: string
}): RuntimeMenuItem[] => {
    return params.sections
        .filter((lc) => lc.kind !== 'page')
        .map((lc, index) => ({
            id: `${params.widgetId}:all-sections:${lc.id}`,
            kind: 'section',
            title: lc.name,
            icon: 'database',
            href: null,
            objectCollectionId: lc.id,
            sectionId: lc.id,
            treeEntityId: null,
            sortOrder: index + 1,
            isActive: true
        }))
}

export const buildRuntimeWorkspaceMenuItem = (params: { sortOrder: number; locale: string; applicationId: string }): RuntimeMenuItem => ({
    id: 'runtime-workspaces',
    kind: 'link',
    title: params.locale === 'ru' ? 'Рабочие пространства' : 'Workspaces',
    icon: 'apps',
    href: `/a/${params.applicationId}/workspaces`,
    objectCollectionId: null,
    sectionId: null,
    treeEntityId: null,
    sortOrder: params.sortOrder,
    isActive: true
})
