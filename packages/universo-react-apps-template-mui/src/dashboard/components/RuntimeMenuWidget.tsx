import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import MenuContent, { type RuntimeMenuViewItem, type RuntimeMenuViewModel } from './MenuContent'
import type { ZoneWidgetItem } from '../contracts'
import { useDashboardDetails } from '../DashboardDetailsContext'
import { RuntimeWidgetStatus, getMissingRuntimeDataState } from './RuntimeWidgetStatus'

type RuntimeMenuTarget = { kind: 'hub'; codename: string } | { kind: 'page'; codename: string } | { kind: 'object'; codename: string }

type RuntimeMenuItemPayload = {
    key: string
    label: string
    icon: string | null
    kind: 'group' | 'section' | 'link' | 'workspaces'
    target?: RuntimeMenuTarget
    href?: string
}

type RuntimeMenuPayload = {
    kind: 'menu'
    title: string
    showTitle: boolean
    overflowLabel: string
    items: RuntimeMenuItemPayload[]
    overflowItems: RuntimeMenuItemPayload[]
}

const SEMANTIC_MENU_CODENAME_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/u
const RUNTIME_MENU_ITEM_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,159}$/u

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const readRuntimeMenuTarget = (value: unknown): RuntimeMenuTarget | undefined => {
    if (!isRecord(value)) return undefined
    if (value.kind !== 'hub' && value.kind !== 'page' && value.kind !== 'object') return undefined
    if (typeof value.codename !== 'string' || !SEMANTIC_MENU_CODENAME_PATTERN.test(value.codename)) return undefined
    return { kind: value.kind, codename: value.codename }
}

const readRuntimeMenuItem = (value: unknown): RuntimeMenuItemPayload | undefined => {
    if (!isRecord(value)) return undefined
    const { key, label, icon, kind, href } = value
    if (typeof key !== 'string' || !RUNTIME_MENU_ITEM_KEY_PATTERN.test(key)) return undefined
    if (typeof label !== 'string' || label.trim().length === 0 || label.length > 160) return undefined
    if (icon !== null && typeof icon !== 'string') return undefined
    if (typeof icon === 'string' && icon.length > 64) return undefined
    if (kind !== 'group' && kind !== 'section' && kind !== 'link' && kind !== 'workspaces') return undefined
    if (href !== undefined && (typeof href !== 'string' || href.trim().length === 0 || href.length > 2048)) return undefined

    const target = readRuntimeMenuTarget(value.target)
    const validShape =
        (kind === 'group' && target?.kind === 'hub' && href === undefined) ||
        (kind === 'section' && (target?.kind === 'page' || target?.kind === 'object') && href === undefined) ||
        (kind === 'link' && target === undefined && typeof href === 'string') ||
        (kind === 'workspaces' && target === undefined && href === undefined)
    if (!validShape) return undefined

    return {
        key,
        label,
        icon: icon ?? null,
        kind,
        ...(target ? { target } : {}),
        ...(typeof href === 'string' ? { href } : {})
    }
}

const readRuntimeMenuPayload = (value: unknown): RuntimeMenuPayload | undefined => {
    if (!isRecord(value) || value.kind !== 'menu') return undefined
    if (typeof value.title !== 'string' || value.title.length > 160) return undefined
    if (typeof value.showTitle !== 'boolean') return undefined
    if (typeof value.overflowLabel !== 'string' || value.overflowLabel.trim().length === 0 || value.overflowLabel.length > 80)
        return undefined
    if (!Array.isArray(value.items) || !Array.isArray(value.overflowItems) || value.items.length > 100 || value.overflowItems.length > 100)
        return undefined

    const items = value.items.map(readRuntimeMenuItem)
    const overflowItems = value.overflowItems.map(readRuntimeMenuItem)
    if (items.some((item) => item === undefined) || overflowItems.some((item) => item === undefined)) return undefined

    const itemKeys = items.map((item) => item!.key)
    const overflowItemKeys = overflowItems.map((item) => item!.key)
    if (new Set(itemKeys).size !== itemKeys.length || new Set(overflowItemKeys).size !== overflowItemKeys.length) return undefined

    return {
        kind: 'menu',
        title: value.title,
        showTitle: value.showTitle,
        overflowLabel: value.overflowLabel,
        items: items as RuntimeMenuItemPayload[],
        overflowItems: overflowItems as RuntimeMenuItemPayload[]
    }
}

const readCurrentRuntimeRoute = (): { pathname: string; searchParams: URLSearchParams } => {
    if (typeof window === 'undefined') return { pathname: '', searchParams: new URLSearchParams() }

    const hashRoute = window.location.hash.startsWith('#/a/') ? window.location.hash.slice(1) : null
    if (!hashRoute) {
        return { pathname: window.location.pathname, searchParams: new URLSearchParams(window.location.search) }
    }

    const queryStart = hashRoute.indexOf('?')
    const pathname = queryStart === -1 ? hashRoute : hashRoute.slice(0, queryStart)
    const query = queryStart === -1 ? '' : hashRoute.slice(queryStart + 1).split('#', 1)[0]
    return { pathname, searchParams: new URLSearchParams(query) }
}

const resolveRuntimeApplicationRoot = (applicationId?: string): string | undefined => {
    const { pathname } = readCurrentRuntimeRoute()
    const match = pathname.match(/^\/a\/([^/?#]+)/u)
    if (match?.[1]) return `/a/${match[1]}`
    if (!applicationId?.trim()) return undefined
    return `/a/${encodeURIComponent(applicationId.trim())}`
}

const appendRuntimeContext = (
    params: URLSearchParams,
    details: ReturnType<typeof useDashboardDetails>,
    workspaceId?: string | null
): void => {
    const current = readCurrentRuntimeRoute().searchParams
    const locale = details?.locale?.trim() || current.get('locale')?.trim()
    if (locale) params.set('locale', locale)

    if (details?.runtimeAccessMode !== 'public') {
        const activeWorkspaceId = workspaceId?.trim() || details?.currentWorkspaceId?.trim() || current.get('workspaceId')?.trim()
        if (activeWorkspaceId) params.set('workspaceId', activeWorkspaceId)
    }

    const themeVariant = current.get('themeVariant')?.trim().toLowerCase()
    if (themeVariant === 'light' || themeVariant === 'dark' || themeVariant === 'system') {
        params.set('themeVariant', themeVariant)
    }
}

const buildSemanticRuntimeHref = (
    applicationRoot: string | undefined,
    target: Extract<RuntimeMenuTarget, { kind: 'page' | 'object' }>,
    details: ReturnType<typeof useDashboardDetails>
): string | undefined => {
    if (!applicationRoot) return undefined
    const params = new URLSearchParams()
    if (details?.settings?.sectionLinksEnabled !== false) {
        params.set('targetKind', target.kind)
        params.set('entityTypeCodename', target.codename)
    }
    appendRuntimeContext(params, details)
    const search = params.toString()
    return search ? `${applicationRoot}?${search}` : applicationRoot
}

const buildWorkspacesRuntimeHref = (
    applicationRoot: string | undefined,
    suffix: string,
    details: ReturnType<typeof useDashboardDetails>,
    workspaceId?: string | null
): string | undefined => {
    if (!applicationRoot) return undefined
    const params = new URLSearchParams()
    appendRuntimeContext(params, details, workspaceId)
    const search = params.toString()
    return `${applicationRoot}/workspaces${suffix}${search ? `?${search}` : ''}`
}

const isSemanticTargetSelected = (target: RuntimeMenuTarget, details: ReturnType<typeof useDashboardDetails>): boolean => {
    if (target.kind === 'hub') return false
    if (details?.settings?.sectionLinksEnabled === false) {
        const currentCodename = target.kind === 'page' ? details.sectionCodename : details.objectCollectionCodename
        return currentCodename === target.codename
    }
    const current = readCurrentRuntimeRoute().searchParams
    return current.get('targetKind') === target.kind && current.get('entityTypeCodename') === target.codename
}

const projectRuntimeMenuItem = (
    item: RuntimeMenuItemPayload,
    viewKey: string,
    applicationRoot: string | undefined,
    details: ReturnType<typeof useDashboardDetails>
): RuntimeMenuViewItem | undefined => {
    const common = {
        key: viewKey,
        label: item.label,
        icon: item.icon,
        kind: item.kind
    }

    if (item.kind === 'section' && item.target && item.target.kind !== 'hub') {
        return {
            ...common,
            href: buildSemanticRuntimeHref(applicationRoot, item.target, details),
            selected: isSemanticTargetSelected(item.target, details)
        }
    }
    if (item.kind === 'workspaces') return undefined
    if (item.kind === 'link') {
        return {
            ...common,
            href: item.href
        }
    }

    return {
        ...common,
        disabled: true
    }
}

const decodeRouteSegment = (segment: string | undefined): string | undefined => {
    if (!segment) return undefined
    try {
        const decoded = decodeURIComponent(segment)
        for (const character of decoded) {
            const codePoint = character.charCodeAt(0)
            if (character === '/' || character === '\\' || codePoint <= 0x1f || codePoint === 0x7f) return undefined
        }
        return decoded || undefined
    } catch {
        return undefined
    }
}

const resolveRouteWorkspaceId = (applicationRoot: string | undefined): string | undefined => {
    if (!applicationRoot) return undefined
    const { pathname } = readCurrentRuntimeRoute()
    const workspaceRoot = `${applicationRoot}/workspaces`
    if (!pathname.startsWith(`${workspaceRoot}/`)) return undefined
    return decodeRouteSegment(pathname.slice(workspaceRoot.length + 1).split('/', 1)[0])
}

const isSameApplicationWorkspaceListHref = (href: string | undefined, applicationRoot: string | undefined): boolean => {
    if (!href || !applicationRoot || typeof window === 'undefined') return false
    try {
        const url = new URL(href, window.location.origin)
        return url.origin === window.location.origin && url.pathname.replace(/\/$/u, '') === `${applicationRoot}/workspaces`
    } catch {
        return false
    }
}

const projectWorkspaceNavigation = (
    applicationRoot: string | undefined,
    details: ReturnType<typeof useDashboardDetails>,
    t: (key: string, fallback: string) => unknown
): RuntimeMenuViewItem[] => {
    if (!applicationRoot || details?.workspacesEnabled !== true || details.runtimeAccessMode === 'public') return []

    const current = readCurrentRuntimeRoute()
    const routeWorkspaceId = resolveRouteWorkspaceId(applicationRoot)
    const workspaceId = routeWorkspaceId ?? (details.currentWorkspaceId?.trim() || current.searchParams.get('workspaceId')?.trim())
    const workspaceRoot = `${applicationRoot}/workspaces`
    const currentPath = current.pathname.replace(/\/$/u, '')
    const activeWorkspaceRoot = workspaceId ? `${workspaceRoot}/${encodeURIComponent(workspaceId)}` : undefined
    const selectedWorkspaceRoute =
        activeWorkspaceRoot && currentPath.startsWith(`${activeWorkspaceRoot}/`)
            ? currentPath.slice(activeWorkspaceRoot.length)
            : activeWorkspaceRoot && currentPath === activeWorkspaceRoot
            ? ''
            : undefined
    const isWorkspaceListSelected = currentPath === workspaceRoot
    const workspaceLabel = (key: string, fallback: string) => String(t(key, fallback))
    const items: RuntimeMenuViewItem[] = [
        {
            key: 'runtime-workspaces-list',
            label: workspaceLabel('workspace.title', 'Workspaces'),
            icon: 'apps',
            href: buildWorkspacesRuntimeHref(applicationRoot, '', details, workspaceId),
            selected: isWorkspaceListSelected,
            dividerBefore: true
        }
    ]

    if (!workspaceId || !activeWorkspaceRoot) return items

    const selectedSection =
        selectedWorkspaceRoute === '/access' ? 'access' : selectedWorkspaceRoute === '/settings' ? 'settings' : 'dashboard'
    const workspaceRoutes = [
        { section: 'dashboard', label: workspaceLabel('workspace.dashboard', 'Dashboard'), icon: 'dashboard', suffix: '' },
        { section: 'access', label: workspaceLabel('workspace.access', 'Access'), icon: 'users', suffix: '/access' },
        { section: 'settings', label: workspaceLabel('workspace.settings', 'Settings'), icon: 'settings', suffix: '/settings' }
    ] as const

    return [
        ...items,
        ...workspaceRoutes.map(({ section, label, icon, suffix }) => ({
            key: `runtime-workspace-${section}`,
            label,
            icon,
            href: buildWorkspacesRuntimeHref(applicationRoot, `/${encodeURIComponent(workspaceId)}${suffix}`, details, workspaceId),
            selected: selectedWorkspaceRoute !== undefined && selectedSection === section
        }))
    ]
}

export default function RuntimeMenuWidget({ widget, variant }: { widget: ZoneWidgetItem; variant: 'wide' | 'compact' }): ReactNode {
    const details = useDashboardDetails()
    const { t } = useTranslation('apps')
    const runtimeData = widget.runtimeData
    if (!runtimeData) return <RuntimeWidgetStatus state={getMissingRuntimeDataState(widget.widgetKey)} />
    if (runtimeData.status !== 'ready') return <RuntimeWidgetStatus state={runtimeData} />

    const payload = readRuntimeMenuPayload(runtimeData.data as unknown)
    if (!payload) return <RuntimeWidgetStatus invalid />

    const applicationRoot = resolveRuntimeApplicationRoot(details?.applicationId)
    const workspaceItems = projectWorkspaceNavigation(applicationRoot, details, (key, fallback) =>
        t(key, { lng: details?.locale, defaultValue: fallback })
    )
    const runtimeItems = payload.items
        .filter((item) => item.kind !== 'workspaces' && !isSameApplicationWorkspaceListHref(item.href, applicationRoot))
        .map((item, index) => projectRuntimeMenuItem(item, `runtime-menu-item-${index}`, applicationRoot, details))
        .filter((item): item is RuntimeMenuViewItem => item !== undefined)
    const runtimeOverflowItems = payload.overflowItems
        .filter((item) => item.kind !== 'workspaces' && !isSameApplicationWorkspaceListHref(item.href, applicationRoot))
        .map((item, index) => projectRuntimeMenuItem(item, `runtime-menu-overflow-item-${index}`, applicationRoot, details))
        .filter((item): item is RuntimeMenuViewItem => item !== undefined)
    const viewModel: RuntimeMenuViewModel = {
        title: payload.title,
        showTitle: payload.showTitle,
        overflowLabel: payload.overflowLabel,
        items: [...runtimeItems, ...workspaceItems],
        overflowItems: runtimeOverflowItems
    }

    return <MenuContent key={widget.id} viewModel={viewModel} variant={variant} onNavigate={details?.navigate} />
}
