import { isUuidV7 } from '@universo-react/utils'
import { getVLCString } from '@universo-react/utils/vlc'
import { resolvePresentationName, resolveRuntimeCodenameText } from '../shared/runtimeHelpers'
import type { PublishedDashboardMenuEntityMetadata } from '../persistence/widgetBindingRuntimeStore'
import type { ResolvedWidgetBindingTarget } from './widgetBindingResolver'
import type { RolePermission } from '../routes/guards'

const MAX_MENU_ITEMS = 100
const MAX_HUB_MEMBERSHIPS_PER_ENTITY = 32
const SEMANTIC_CODENAME_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/u
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/iu
const RUNTIME_MENU_ICONS = new Set([
    'home',
    'analytics',
    'users',
    'people',
    'tasks',
    'database',
    'object',
    'folder',
    'apps',
    'dashboard',
    'page',
    'school',
    'learning',
    'recent',
    'history',
    'star',
    'starred',
    'delete',
    'trash',
    'settings',
    'more'
])

type RuntimeMenuTarget = { kind: 'hub' | 'page' | 'object'; codename: string }
type RuntimeMenuItem = {
    key: string
    label: string
    icon: string | null
    kind: 'group' | 'section' | 'link' | 'workspaces'
    target?: RuntimeMenuTarget
    href?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const localeLabel = (locale: string, english: string, russian: string): string =>
    locale.toLowerCase().startsWith('ru') ? russian : english

const safeHref = (value: unknown): string | null => {
    if (typeof value !== 'string') return null
    const candidate = value.trim()
    if (!candidate || candidate.length > 2048 || UUID_PATTERN.test(candidate)) return null
    for (const character of candidate) {
        if (character === '\\' || character.charCodeAt(0) <= 0x1f) return null
    }

    try {
        if (candidate.startsWith('/') && !candidate.startsWith('//')) {
            const parsed = new URL(candidate, 'https://runtime.invalid')
            return parsed.origin === 'https://runtime.invalid' ? candidate : null
        }
        const parsed = new URL(candidate)
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password || UUID_PATTERN.test(decodeURIComponent(parsed.href)))
            return null
        return parsed.toString()
    } catch {
        return null
    }
}

/** Project published Pages into navigation; Objects remain data sources unless explicitly bound to a manual menu. */
export const buildGeneratedRuntimeMenu = (
    source: readonly PublishedDashboardMenuEntityMetadata[],
    locale: string,
    workspacesEnabled: boolean,
    permissions?: Readonly<Record<RolePermission, boolean>>
): Record<string, unknown> | null => {
    const entities = new Map<
        string,
        {
            id: string
            codename: string
            kind: 'hub' | 'page' | 'object'
            title: string
            icon: string
            sortOrder: number
            hubs: string[]
        }
    >()
    const codenameKeys = new Set<string>()

    for (const row of source) {
        const config = isRecord(row.config) ? row.config : null
        const runtimeConfig = config && isRecord(config.runtime) ? config.runtime : {}
        if (row.kind === 'object' && runtimeConfig.menuVisibility !== 'primary') continue
        const id = typeof row.id === 'string' ? row.id : ''
        const codename = resolveRuntimeCodenameText(row.codename).trim()
        const kind = row.kind
        if (
            !isUuidV7(id) ||
            !SEMANTIC_CODENAME_PATTERN.test(codename) ||
            (kind !== 'hub' && kind !== 'page' && kind !== 'object') ||
            !config
        ) {
            return null
        }
        const typedKind = kind
        const uniqueKey = `${typedKind}\u0000${codename}`
        if (codenameKeys.has(uniqueKey)) return null
        codenameKeys.add(uniqueKey)

        if (typedKind === 'page' && runtimeConfig.menuVisibility === 'hidden') continue
        if (typedKind === 'object' && runtimeConfig.menuVisibility !== 'primary') continue
        const requiredPermission = runtimeConfig.requiresPermission
        if (
            requiredPermission !== undefined &&
            (typeof requiredPermission !== 'string' || permissions?.[requiredPermission as RolePermission] !== true)
        ) {
            continue
        }
        const configuredIcon = typeof runtimeConfig.icon === 'string' ? runtimeConfig.icon.trim().toLowerCase() : ''
        const icon = RUNTIME_MENU_ICONS.has(configuredIcon) ? configuredIcon : typedKind === 'hub' ? 'folder' : 'page'

        const rawHubs = config.hubs
        if (rawHubs !== undefined && (!Array.isArray(rawHubs) || rawHubs.length > MAX_HUB_MEMBERSHIPS_PER_ENTITY)) return null
        const hubs = Array.isArray(rawHubs) ? rawHubs.filter((value): value is string => typeof value === 'string') : []
        if (Array.isArray(rawHubs) && hubs.length !== rawHubs.length) return null
        const rawSortOrder = config.sortOrder
        const sortOrder = typeof rawSortOrder === 'number' && Number.isFinite(rawSortOrder) ? rawSortOrder : 0
        entities.set(id, {
            id,
            codename,
            kind: typedKind,
            title: resolvePresentationName(row.presentation, locale, codename).trim().slice(0, 160),
            icon,
            sortOrder,
            hubs
        })
    }

    const targets = [...entities.values()]
        .filter((entity) => entity.kind === 'page' || entity.kind === 'object')
        .sort((left, right) => left.sortOrder - right.sortOrder || left.codename.localeCompare(right.codename))
    const items: RuntimeMenuItem[] = []
    const emittedGroups = new Set<string>()

    for (const entity of targets) {
        const linkedHubs = entity.hubs
            .flatMap((hubId) => {
                const hub = entities.get(hubId)
                return hub?.kind === 'hub' ? [hub] : []
            })
            .sort((left, right) => left.sortOrder - right.sortOrder || left.codename.localeCompare(right.codename))

        if (linkedHubs.length === 0) {
            items.push({
                key: `nav.${entity.kind}.${entity.codename}`,
                label: entity.title,
                icon: entity.icon,
                kind: 'section',
                target: { kind: entity.kind, codename: entity.codename }
            })
        } else {
            for (const hub of linkedHubs) {
                if (!emittedGroups.has(hub.codename)) {
                    items.push({
                        key: `nav.hub.${hub.codename}`,
                        label: hub.title,
                        icon: hub.icon,
                        kind: 'group',
                        target: { kind: 'hub', codename: hub.codename }
                    })
                    emittedGroups.add(hub.codename)
                }
                items.push({
                    key: `nav.${hub.codename}.${entity.kind}.${entity.codename}`,
                    label: entity.title,
                    icon: entity.icon,
                    kind: 'section',
                    target: { kind: entity.kind, codename: entity.codename }
                })
            }
        }
        if (items.length >= MAX_MENU_ITEMS) break
    }

    if (workspacesEnabled && items.length < MAX_MENU_ITEMS) {
        items.push({
            key: 'runtime-workspaces',
            label: localeLabel(locale, 'Workspaces', 'Рабочие пространства'),
            icon: null,
            kind: 'workspaces'
        })
    }

    return {
        kind: 'menu',
        title: localeLabel(locale, 'Navigation', 'Навигация'),
        showTitle: false,
        overflowLabel: localeLabel(locale, 'More', 'Ещё'),
        items: items.slice(0, MAX_MENU_ITEMS),
        overflowItems: []
    }
}

/** Project manual menu rows through a narrow label/link allowlist. */
export const projectManualRuntimeMenu = (
    targets: readonly ResolvedWidgetBindingTarget[],
    locale: string
): Record<string, unknown> | null => {
    if (targets.some((target) => target.slot !== 'items' && target.slot !== 'heading')) return null
    const headingTargets = targets.filter((target) => target.slot === 'heading')
    if (headingTargets.length > 1) return null
    const headingValue = headingTargets[0]?.data.title
    const title = headingTargets.length > 0 ? getVLCString(headingValue as Parameters<typeof getVLCString>[0], locale).trim() : ''
    if (headingTargets.length > 0 && (!title || title.length > 160)) return null

    const items: RuntimeMenuItem[] = []
    for (const [index, target] of targets.filter(({ slot }) => slot === 'items').entries()) {
        const labelValue = target.data.label
        const label = getVLCString(labelValue as Parameters<typeof getVLCString>[0], locale).trim()
        const href = safeHref(target.data.href)
        if (!label || label.length > 160 || !href) return null
        items.push({ key: `manual.item-${index + 1}`, label, icon: null, kind: 'link', href })
        if (items.length > MAX_MENU_ITEMS) return null
    }

    return {
        kind: 'menu',
        title,
        showTitle: headingTargets.length > 0,
        overflowLabel: localeLabel(locale, 'More', 'Ещё'),
        items,
        overflowItems: []
    }
}
