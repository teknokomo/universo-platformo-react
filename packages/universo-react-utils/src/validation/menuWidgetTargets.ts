import type { MenuWidgetConfig, MenuWidgetConfigItem, MenuWidgetTarget } from '@universo-react/types'

export type RuntimeMenuTargetMaps = {
    sectionByToken?: Map<string, { id: string; kind: 'section' | 'objectCollection' }>
    hubByToken?: Map<string, { id: string; kind: 'hub' | 'treeEntity' }>
    menuItemByToken?: Map<string, { id: string }>
}

const normalizeToken = (value: unknown): string | null => {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
}

const UUID_TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-9a-f][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isUuidToken = (value: string): boolean => UUID_TOKEN_PATTERN.test(value)

const buildSectionTarget = (id: string, kind: 'section' | 'objectCollection'): MenuWidgetTarget =>
    kind === 'objectCollection' ? { kind: 'objectCollection', objectCollectionId: id } : { kind: 'section', sectionId: id }

const buildHubTarget = (id: string, kind: 'hub' | 'treeEntity'): MenuWidgetTarget =>
    kind === 'treeEntity' ? { kind: 'treeEntity', treeEntityId: id } : { kind: 'hub', hubId: id }

const resolveSectionTarget = (
    value: unknown,
    maps: RuntimeMenuTargetMaps,
    fallbackKind: 'section' | 'objectCollection' = 'section'
): MenuWidgetTarget | null => {
    const token = normalizeToken(value)
    if (!token) return null
    const resolved = maps.sectionByToken?.get(token)
    if (maps.sectionByToken && !resolved) return isUuidToken(token) ? buildSectionTarget(token, fallbackKind) : null
    if (!resolved) return buildSectionTarget(token, fallbackKind)
    return buildSectionTarget(resolved.id, resolved.kind)
}

const resolveHubTarget = (
    value: unknown,
    maps: RuntimeMenuTargetMaps,
    fallbackKind: 'hub' | 'treeEntity' = 'hub'
): MenuWidgetTarget | null => {
    const token = normalizeToken(value)
    if (!token) return null
    const resolved = maps.hubByToken?.get(token)
    if (maps.hubByToken && !resolved) return isUuidToken(token) ? buildHubTarget(token, fallbackKind) : null
    if (!resolved) return buildHubTarget(token, fallbackKind)
    return buildHubTarget(resolved.id, resolved.kind)
}

const resolveMenuItemTarget = (value: unknown, maps: RuntimeMenuTargetMaps): MenuWidgetTarget | null => {
    const token = normalizeToken(value)
    if (!token) return null
    const resolved = maps.menuItemByToken?.get(token)
    return resolved ? { kind: 'menuItem', menuItemId: resolved.id } : null
}

const resolveItemSectionTarget = (item: MenuWidgetConfigItem, maps: RuntimeMenuTargetMaps): MenuWidgetTarget | null => {
    const sectionToken = normalizeToken(item.sectionId)
    const objectCollectionToken = normalizeToken(item.objectCollectionId)

    if (sectionToken && (!maps.sectionByToken || maps.sectionByToken.has(sectionToken))) {
        const sectionTarget = resolveSectionTarget(sectionToken, maps)
        if (sectionTarget) return sectionTarget
    }

    if (objectCollectionToken) {
        const objectCollectionTarget = resolveSectionTarget(objectCollectionToken, maps, 'objectCollection')
        if (objectCollectionTarget?.kind === 'objectCollection') return objectCollectionTarget
    }

    if (sectionToken) {
        const sectionTarget = resolveSectionTarget(sectionToken, maps)
        if (sectionTarget) return sectionTarget
    }

    if (objectCollectionToken) {
        const objectCollectionTarget = resolveSectionTarget(objectCollectionToken, maps, 'objectCollection')
        return objectCollectionTarget
    }

    return null
}

const resolveHubItemTarget = (item: MenuWidgetConfigItem, maps: RuntimeMenuTargetMaps): MenuWidgetTarget | null => {
    const hubToken = normalizeToken(item.hubId)
    const treeEntityToken = normalizeToken(item.treeEntityId)

    if (hubToken && (!maps.hubByToken || maps.hubByToken.has(hubToken))) {
        const hubTarget = resolveHubTarget(hubToken, maps)
        if (hubTarget) return hubTarget
    }

    if (treeEntityToken) {
        const treeEntityTarget = resolveHubTarget(treeEntityToken, maps, 'treeEntity')
        if (treeEntityTarget?.kind === 'treeEntity') return treeEntityTarget
    }

    if (hubToken) {
        const hubTarget = resolveHubTarget(hubToken, maps)
        if (hubTarget) return hubTarget
    }

    if (treeEntityToken) {
        const treeEntityTarget = resolveHubTarget(treeEntityToken, maps, 'treeEntity')
        return treeEntityTarget
    }

    return null
}

const normalizeBoundHubTargets = (
    config: MenuWidgetConfig,
    maps: RuntimeMenuTargetMaps
): { boundHubId: string | null; boundTreeEntityId: string | null } => {
    const target = resolveHubItemTarget(
        {
            id: '__bound_hub__',
            kind: 'hub',
            title: config.title,
            hubId: config.boundHubId ?? null,
            treeEntityId: config.boundTreeEntityId ?? null,
            sortOrder: 0,
            isActive: true
        },
        maps
    )

    return {
        boundHubId: targetValue(target, 'hub'),
        boundTreeEntityId: targetValue(target, 'treeEntity')
    }
}

const targetValue = (target: MenuWidgetTarget | null, kind: MenuWidgetTarget['kind']): string | null => {
    if (!target || target.kind !== kind) return null
    switch (target.kind) {
        case 'section':
            return target.sectionId
        case 'objectCollection':
            return target.objectCollectionId
        case 'hub':
            return target.hubId
        case 'treeEntity':
            return target.treeEntityId
        case 'menuItem':
            return target.menuItemId
    }
}

const normalizeItem = (item: MenuWidgetConfigItem, maps: RuntimeMenuTargetMaps): MenuWidgetConfigItem => {
    if (item.kind === 'section') {
        const target = resolveItemSectionTarget(item, maps)
        return {
            ...item,
            sectionId: targetValue(target, 'section'),
            objectCollectionId: targetValue(target, 'objectCollection'),
            hubId: null,
            treeEntityId: null,
            href: null
        }
    }

    if (item.kind === 'hub') {
        const target = resolveHubItemTarget(item, maps)
        return {
            ...item,
            hubId: targetValue(target, 'hub'),
            treeEntityId: targetValue(target, 'treeEntity'),
            sectionId: null,
            objectCollectionId: null,
            href: null
        }
    }

    return {
        ...item,
        sectionId: null,
        objectCollectionId: null,
        hubId: null,
        treeEntityId: null
    }
}

const normalizeExistingTarget = (target: MenuWidgetTarget, maps: RuntimeMenuTargetMaps): MenuWidgetTarget => {
    switch (target.kind) {
        case 'section':
            return resolveSectionTarget(target.sectionId, maps) ?? target
        case 'objectCollection':
            return maps.sectionByToken ? resolveSectionTarget(target.objectCollectionId, maps, 'objectCollection') ?? target : target
        case 'hub':
            return resolveHubTarget(target.hubId, maps) ?? target
        case 'treeEntity':
            return maps.hubByToken ? resolveHubTarget(target.treeEntityId, maps, 'treeEntity') ?? target : target
        case 'menuItem':
            return resolveMenuItemTarget(target.menuItemId, maps) ?? target
    }
}

const normalizeStartTarget = (config: MenuWidgetConfig, maps: RuntimeMenuTargetMaps): MenuWidgetTarget | null => {
    const token = normalizeToken(config.startPage)
    if (!token) return null

    if (config.startTarget && targetValue(config.startTarget, config.startTarget.kind) === token) {
        return normalizeExistingTarget(config.startTarget, maps)
    }

    const sectionTarget = resolveSectionTarget(token, maps)
    if (sectionTarget && maps.menuItemByToken?.has(token)) return sectionTarget
    const menuItemTarget = resolveMenuItemTarget(token, maps)
    if (menuItemTarget) return menuItemTarget

    return sectionTarget ?? resolveHubTarget(token, maps) ?? (config.startTarget ? normalizeExistingTarget(config.startTarget, maps) : null)
}

export function normalizeMenuWidgetConfigTargets(config: MenuWidgetConfig, maps: RuntimeMenuTargetMaps = {}): MenuWidgetConfig {
    const items = Array.isArray(config.items) ? config.items.map((item) => normalizeItem(item, maps)) : []
    const menuItemByToken = maps.menuItemByToken ?? new Map(items.map((item) => [item.id, { id: item.id }]))
    const startTarget = normalizeStartTarget(config, { ...maps, menuItemByToken })
    const boundTargets = normalizeBoundHubTargets(config, maps)
    const normalizedStartPage =
        startTarget?.kind === 'menuItem'
            ? startTarget.menuItemId
            : startTarget
            ? targetValue(startTarget, startTarget.kind)
            : normalizeToken(config.startPage)

    return {
        ...config,
        boundHubId: boundTargets.boundHubId,
        boundTreeEntityId: boundTargets.boundTreeEntityId,
        startPage: normalizedStartPage,
        startTarget,
        items
    }
}
