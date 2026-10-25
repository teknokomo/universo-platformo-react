import Alert from '@mui/material/Alert'
import { useTranslation } from 'react-i18next'
import { publicDashboardRuntimeSchema, type PublicDashboardRuntime as DashboardData } from '@universo-react/types'
import Dashboard from '../dashboard/Dashboard'
import type { DashboardDetailsSlot, ZoneWidgets, ZoneWidgetItem } from '../dashboard/contracts'
import type { PublicDashboardTarget } from './publicInterpretationNetworkApi'
import '../i18n/publicInterpretationNetwork'

export interface PublicDashboardRuntimeProps {
    applicationRef: string
    locale: string
    dashboard: DashboardData
    target?: PublicDashboardTarget
    onNavigate: (href: string) => void
}

const toZoneWidgets = (dashboard: DashboardData): ZoneWidgets => {
    const zones: ZoneWidgets = { left: [], top: [], right: [], center: [], bottom: [] }
    for (const placement of dashboard.placements) {
        const runtimeData =
            placement.widgetKey === 'menuWidget' && placement.runtimeData.status === 'ready'
                ? {
                      status: 'ready' as const,
                      data: { kind: 'menu' as const, ...placement.runtimeData.data }
                  }
                : placement.widgetKey === 'detailsTable'
                ? placement.runtimeData
                : undefined
        const projected = {
            instanceKey: placement.instanceKey,
            widgetKey: placement.widgetKey,
            zone: placement.zone,
            sortOrder: placement.sortOrder,
            parentInstanceKey: placement.parentInstanceKey,
            slotKey: placement.slotKey,
            config: placement.config,
            isActive: true,
            ...(runtimeData ? { runtimeData } : {})
        } as ZoneWidgetItem
        zones[placement.zone as keyof ZoneWidgets]?.push(projected)
    }
    return zones
}

const toReadOnlyPermissions = (): NonNullable<DashboardDetailsSlot['permissions']> => ({
    manageMembers: false,
    manageApplication: false,
    createContent: false,
    editContent: false,
    deleteContent: false,
    readReports: false
})

const createSemanticNavigationHref = (applicationRef: string, locale: string, target: { kind: 'page' | 'object'; codename: string }) => {
    const applicationPath = `/a/${encodeURIComponent(applicationRef.trim())}`
    if (!applicationRef.trim()) return undefined
    const params = new URLSearchParams({ targetKind: target.kind, entityTypeCodename: target.codename })
    if (locale.trim()) params.set('locale', locale.trim())
    return `${applicationPath}?${params.toString()}`
}

/** Anonymous dashboards use the same shell, placements and widget renderer as the member runtime. */
export function PublicDashboardRuntime({ applicationRef, locale, dashboard, target, onNavigate }: PublicDashboardRuntimeProps) {
    const { t } = useTranslation('publicInterpretationNetwork', { lng: locale })
    const parsed = publicDashboardRuntimeSchema.safeParse(dashboard)
    if (!parsed.success || parsed.data.locale !== locale) return <Alert severity='error'>{t('publicViewer.error')}</Alert>

    const workspaceAvailable = parsed.data.workspaceAvailability === 'available'
    const menuPlacement = parsed.data.placements.find((placement) => placement.widgetKey === 'menuWidget')
    const menuData = menuPlacement?.runtimeData.status === 'ready' ? menuPlacement.runtimeData.data : undefined
    const navigationAction = menuData?.navigationAction
    const navigationSource = navigationAction?.source
    const nextTarget = navigationAction?.target
    const isFirstMenuTarget =
        !target?.targetKind || (navigationSource?.kind === target.targetKind && navigationSource.codename === target.entityTypeCodename)
    const navigationHref =
        workspaceAvailable && isFirstMenuTarget && nextTarget ? createSemanticNavigationHref(applicationRef, locale, nextTarget) : undefined
    const details: DashboardDetailsSlot = {
        title: '',
        applicationId: applicationRef,
        apiBaseUrl: '/api/v1',
        locale,
        currentWorkspaceId: null,
        runtimeAccessMode: 'public',
        runtimeTarget: target,
        publicWorkspaceAvailable: workspaceAvailable,
        workspacesEnabled: false,
        permissions: toReadOnlyPermissions(),
        pageBlocks: parsed.data.pageBlocks,
        navigate: onNavigate,
        ...(navigationHref && navigationAction
            ? {
                  publicNavigationAction: { label: navigationAction.label, href: navigationHref }
              }
            : {}),
        ...(target?.targetKind === 'page' ? { sectionCodename: target.entityTypeCodename ?? null } : {}),
        ...(target?.targetKind === 'object' ? { objectCollectionCodename: target.entityTypeCodename ?? null } : {})
    }

    return <Dashboard details={details} layoutConfig={parsed.data.layoutConfig} zoneWidgets={toZoneWidgets(parsed.data)} />
}
