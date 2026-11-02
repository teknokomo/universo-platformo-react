import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import type { SxProps, Theme } from '@mui/material/styles'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isAllowedEmbedUrl, MAX_PUBLIC_MESSENGER_RENDERER_PLACEMENTS, publicMessengerAppRuntimeSchema } from '@universo-react/types'
import type { PublicMessengerAppRuntime, PublicMessengerPlacement } from '@universo-react/types'
import { MessengerRuntimeShell } from '../messenger/MessengerRuntimeShell'
import { ViewHeaderMUI } from '../components/runtime-ui'
import type { DashboardDetailsSlot, ZoneWidgetItem } from '../dashboard/contracts'
import { createRuntimePlacementGraphSchema, runtimePlacementSchema } from '../dashboard/runtime/widgetPlacementGraph'
import type { RuntimePlacement } from '../dashboard/runtime/widgetPlacementGraph'
import '../i18n'

const RELATION_PANEL_GROUP_SIZE = 8
const publicMessengerRuntimePlacementGraphSchema = createRuntimePlacementGraphSchema(MAX_PUBLIC_MESSENGER_RENDERER_PLACEMENTS)

export interface PublicMessengerRuntimeProps {
    applicationRef: string
    messengerApp: PublicMessengerAppRuntime
    onNavigate: (href: string) => void
}

const publicPermissions: NonNullable<DashboardDetailsSlot['permissions']> = {
    manageMembers: false,
    manageApplication: false,
    createContent: false,
    editContent: false,
    deleteContent: false,
    readReports: false
}

export function createPublicMessengerRuntimeDetails(
    applicationRef: string,
    messengerApp: PublicMessengerAppRuntime,
    onNavigate: (href: string) => void
): DashboardDetailsSlot {
    return {
        title: messengerApp.title,
        applicationId: applicationRef,
        locale: messengerApp.locale,
        currentWorkspaceId: null,
        runtimeAccessMode: 'public',
        publicWorkspaceAvailable: false,
        workspacesEnabled: false,
        permissions: publicPermissions,
        pageBlocks: messengerApp.pageBlocks,
        contentMode: messengerApp.pageBlocks?.length ? 'page' : 'inline',
        navigate: onNavigate
    }
}

const toRendererPlacement = (
    source: PublicMessengerPlacement,
    widgetKey: string,
    config: unknown,
    runtimeData?: unknown,
    overrides: Partial<Pick<RuntimePlacement, 'instanceKey' | 'parentInstanceKey' | 'slotKey' | 'sortOrder'>> = {}
): RuntimePlacement => {
    const base = {
        instanceKey: overrides.instanceKey ?? source.instanceKey,
        widgetKey,
        zone: source.zone,
        sortOrder: overrides.sortOrder ?? source.sortOrder,
        config,
        isActive: true,
        parentInstanceKey: overrides.parentInstanceKey ?? source.parentInstanceKey,
        slotKey: overrides.slotKey ?? source.slotKey
    }
    return runtimePlacementSchema.parse(runtimeData === undefined ? base : { ...base, runtimeData })
}

const toUniqueInstanceKey = (base: string, usedKeys: Set<string>): string => {
    let candidate = base
    let suffix = 2
    while (usedKeys.has(candidate)) {
        candidate = `${base}-${suffix}`
        suffix += 1
    }
    usedKeys.add(candidate)
    return candidate
}

const projectedSiblingPlacementCount = (source: PublicMessengerPlacement): number => {
    if (source.widgetKey !== 'relationBuilder') return 1
    if (source.parentInstanceKey !== null && source.slotKey !== null) return source.config.panels.length * 2
    return Math.ceil(source.config.panels.length / RELATION_PANEL_GROUP_SIZE)
}

const createProjectedSortOrders = (placements: PublicMessengerPlacement[]): Map<string, number> => {
    const siblingGroups = new Map<string, PublicMessengerPlacement[]>()
    for (const placement of placements) {
        const groupKey = JSON.stringify([placement.parentInstanceKey, placement.slotKey])
        const siblings = siblingGroups.get(groupKey) ?? []
        siblings.push(placement)
        siblingGroups.set(groupKey, siblings)
    }

    const sortOrders = new Map<string, number>()
    for (const siblings of siblingGroups.values()) {
        const orderedSiblings = [...siblings].sort(
            (left, right) => left.sortOrder - right.sortOrder || left.instanceKey.localeCompare(right.instanceKey)
        )
        const orderStride = orderedSiblings.reduce((total, sibling) => total + projectedSiblingPlacementCount(sibling), 0)
        let siblingOffset = 0
        for (const sibling of orderedSiblings) {
            sortOrders.set(sibling.instanceKey, sibling.sortOrder * orderStride + siblingOffset)
            siblingOffset += projectedSiblingPlacementCount(sibling)
        }
    }
    return sortOrders
}

const toRelationTableData = (
    data: Extract<
        NonNullable<Extract<PublicMessengerPlacement, { widgetKey: 'relationBuilder' }>['runtimeData']>,
        { status: 'ready' }
    >['data'],
    panelSlotKey: string,
    nameColumnLabel: string,
    parentColumnLabel: string
) => {
    const panel = data.panels.find((item) => item.slotKey === panelSlotKey)
    if (!panel) return undefined

    const parentLabels = new Map(data.parents.map((parent) => [parent.key, parent.label]))
    return {
        kind: 'table',
        columns: [
            { key: 'label', label: nameColumnLabel },
            { key: 'parent', label: parentColumnLabel },
            ...panel.displayColumns.map(({ key, label }) => ({ key, label }))
        ],
        rows: panel.rows.map((row) => ({
            key: row.key,
            cells: [
                { key: 'label', value: row.label },
                { key: 'parent', value: parentLabels.get(row.parentKey) ?? '' },
                ...row.cells.map(({ key, value }) => ({ key, value }))
            ]
        }))
    }
}

const projectRelationBuilder = (
    source: Extract<PublicMessengerPlacement, { widgetKey: 'relationBuilder' }>,
    sourceIndex: number,
    sourceSortOrder: number,
    usedKeys: Set<string>,
    nameColumnLabel: string,
    parentColumnLabel: string
): RuntimePlacement[] => {
    if (source.parentInstanceKey !== null && source.slotKey !== null) {
        return source.config.panels.flatMap((panel, panelIndex) => {
            const sortOrder = sourceSortOrder + panelIndex * 2
            const titleInstanceKey =
                panelIndex === 0
                    ? source.instanceKey
                    : toUniqueInstanceKey(`public-relation-title-${sourceIndex + 1}-${panelIndex + 1}`, usedKeys)
            const tableInstanceKey = toUniqueInstanceKey(`public-relation-table-${sourceIndex + 1}-${panelIndex + 1}`, usedKeys)
            const tableData =
                source.runtimeData.status === 'ready'
                    ? toRelationTableData(
                          source.runtimeData.data,
                          panel.slotKey,
                          nameColumnLabel,
                          source.config.parentLabel ?? parentColumnLabel
                      )
                    : undefined

            return [
                toRendererPlacement(
                    source,
                    'detailsTitle',
                    { level: 'h2' },
                    { status: 'ready', data: { kind: 'title', text: panel.title } },
                    { instanceKey: titleInstanceKey, sortOrder }
                ),
                toRendererPlacement(
                    source,
                    'detailsTable',
                    { variant: 'records', defaultViewMode: 'card', showSearch: false, showViewToggle: false },
                    tableData ? { status: 'ready', data: tableData } : { status: 'empty' },
                    { instanceKey: tableInstanceKey, sortOrder: sortOrder + 1 }
                )
            ]
        })
    }

    const groups = []
    for (let start = 0; start < source.config.panels.length; start += RELATION_PANEL_GROUP_SIZE) {
        groups.push(source.config.panels.slice(start, start + RELATION_PANEL_GROUP_SIZE))
    }

    const projected: RuntimePlacement[] = []
    const tabsSource = source
    groups.forEach((panels, groupIndex) => {
        const tabsInstanceKey =
            groupIndex === 0
                ? source.instanceKey
                : toUniqueInstanceKey(`public-relation-tabs-${sourceIndex + 1}-${groupIndex + 1}`, usedKeys)
        const tabs = panels.map((panel, panelIndex) => ({
            slotKey: `tab:panel-${panelIndex + 1}`,
            label: panel.title,
            isDefault: panelIndex === 0
        }))
        projected.push(
            toRendererPlacement(tabsSource, 'detailsTabs', { tabs }, undefined, {
                instanceKey: tabsInstanceKey,
                sortOrder: sourceSortOrder + groupIndex
            })
        )

        panels.forEach((panel, panelIndex) => {
            if (source.runtimeData.status !== 'ready') return
            const tableData = toRelationTableData(
                source.runtimeData.data,
                panel.slotKey,
                nameColumnLabel,
                source.config.parentLabel ?? parentColumnLabel
            )
            if (!tableData) return
            const tableInstanceKey = toUniqueInstanceKey(
                `public-relation-table-${sourceIndex + 1}-${groupIndex + 1}-${panelIndex + 1}`,
                usedKeys
            )
            projected.push(
                toRendererPlacement(
                    source,
                    'detailsTable',
                    { variant: 'records', defaultViewMode: 'card', showSearch: false, showViewToggle: false },
                    { status: 'ready', data: tableData },
                    {
                        instanceKey: tableInstanceKey,
                        parentInstanceKey: tabsInstanceKey,
                        slotKey: tabs[panelIndex]?.slotKey ?? null,
                        sortOrder: panelIndex
                    }
                )
            )
        })
    })
    return projected
}

const projectPlacements = (
    placements: PublicMessengerPlacement[],
    nameColumnLabel: string,
    parentColumnLabel: string
): RuntimePlacement[] => {
    const usedKeys = new Set(placements.map((placement) => placement.instanceKey))
    const projectedSortOrders = createProjectedSortOrders(placements)
    return placements.flatMap((placement, sourceIndex) => {
        const sourceSortOrder = projectedSortOrders.get(placement.instanceKey) ?? placement.sortOrder
        switch (placement.widgetKey) {
            case 'header':
                return []
            case 'relationBuilder':
                return projectRelationBuilder(placement, sourceIndex, sourceSortOrder, usedKeys, nameColumnLabel, parentColumnLabel)
            case 'sessionsChart':
            case 'pageViewsChart': {
                const runtimeData =
                    placement.runtimeData.status === 'ready'
                        ? {
                              status: 'ready',
                              data: {
                                  ...placement.runtimeData.data,
                                  series: placement.runtimeData.data.series.map((series, index) => ({
                                      ...series,
                                      id: `series-${index + 1}`
                                  }))
                              }
                          }
                        : placement.runtimeData
                return [toRendererPlacement(placement, placement.widgetKey, placement.config, runtimeData, { sortOrder: sourceSortOrder })]
            }
            case 'overviewCards':
            case 'detailsTable':
            case 'detailsTitle':
            case 'resourcePreview': {
                if (placement.widgetKey === 'resourcePreview' && placement.runtimeData.status === 'ready') {
                    const source = placement.runtimeData.data.source
                    const safeSource =
                        source.type === 'embed' && !isAllowedEmbedUrl(source.url)
                            ? { type: 'url', url: source.url, launchMode: source.launchMode }
                            : source
                    return [
                        toRendererPlacement(
                            placement,
                            placement.widgetKey,
                            placement.config,
                            {
                                ...placement.runtimeData,
                                data: { ...placement.runtimeData.data, source: safeSource }
                            },
                            { sortOrder: sourceSortOrder }
                        )
                    ]
                }
                return [
                    toRendererPlacement(placement, placement.widgetKey, placement.config, placement.runtimeData, {
                        sortOrder: sourceSortOrder
                    })
                ]
            }
            case 'detailsTabs':
            case 'columnsContainer':
                return [toRendererPlacement(placement, placement.widgetKey, placement.config, undefined, { sortOrder: sourceSortOrder })]
            case 'menuWidget':
                return [
                    toRendererPlacement(placement, placement.widgetKey, placement.config, placement.runtimeData, {
                        sortOrder: sourceSortOrder
                    })
                ]
        }
    })
}

const toMessengerZones = (placements: RuntimePlacement[]) => {
    const zones: { top: ZoneWidgetItem[]; center: ZoneWidgetItem[]; bottom: ZoneWidgetItem[] } = {
        top: [],
        center: [],
        bottom: []
    }
    for (const placement of placements) {
        if (!placement.isActive) continue
        switch (placement.zone) {
            case 'top':
                zones.top.push(placement)
                break
            case 'center':
                zones.center.push(placement)
                break
            case 'bottom':
                zones.bottom.push(placement)
                break
        }
    }
    return zones
}

const mainSx: SxProps<Theme> = {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: '100vw',
    minWidth: 0,
    height: 'var(--max-viewport-height, var(--tg-viewport-stable-height, var(--tg-viewport-height, 100vh)))',
    minHeight: 'var(--max-viewport-height, var(--tg-viewport-stable-height, var(--tg-viewport-height, 100vh)))',
    '@supports (height: 100dvh)': {
        height: 'var(--max-viewport-height, var(--tg-viewport-stable-height, var(--tg-viewport-height, 100dvh)))',
        minHeight: 'var(--max-viewport-height, var(--tg-viewport-stable-height, var(--tg-viewport-height, 100dvh)))'
    },
    boxSizing: 'border-box',
    overflowX: 'hidden',
    overflowY: 'auto',
    color: 'text.primary',
    bgcolor: 'background.default'
}

export function PublicMessengerRuntime({ applicationRef, messengerApp, onNavigate }: PublicMessengerRuntimeProps) {
    const [maxViewportHeight, setMaxViewportHeight] = useState<string | undefined>()
    const { t } = useTranslation('apps', { lng: messengerApp.locale })
    const parsed = publicMessengerAppRuntimeSchema.safeParse(messengerApp)
    if (!parsed.success) {
        return (
            <Box component='main' sx={mainSx}>
                <Alert severity='error'>{t('messenger.error', 'Messenger application is unavailable.')}</Alert>
            </Box>
        )
    }

    const data = parsed.data
    const details = createPublicMessengerRuntimeDetails(applicationRef, data, onNavigate)
    const hasHeaderPlacement = data.placements.some(
        (placement) => placement.widgetKey === 'header' && placement.zone === 'top' && placement.parentInstanceKey === null
    )
    const projected = publicMessengerRuntimePlacementGraphSchema.safeParse(
        projectPlacements(
            data.placements,
            t('runtime.table.name', { defaultValue: 'Name' }),
            t('dashboard.widget.relationParents', { defaultValue: 'Related records' })
        )
    )
    if (!projected.success) {
        return (
            <Box component='main' sx={mainSx}>
                <Alert severity='error'>{t('messenger.error', 'Messenger application is unavailable.')}</Alert>
            </Box>
        )
    }

    const zones = toMessengerZones(projected.data)
    return (
        <Box
            component='main'
            sx={{
                ...mainSx,
                ...(maxViewportHeight ? { '--max-viewport-height': maxViewportHeight } : {}),
                ...(hasHeaderPlacement
                    ? {
                          '& > [data-testid="messenger-runtime-shell"]': { height: 'auto', minHeight: 0, flex: '1 1 auto', pt: 0 },
                          '& [data-testid="messenger-zone-top"]': { display: 'none' }
                      }
                    : {})
            }}
        >
            {hasHeaderPlacement ? (
                <Box
                    component='header'
                    data-testid='public-messenger-top-zone'
                    sx={{
                        pt: 'var(--tg-content-safe-area-inset-top, var(--tg-safe-area-inset-top, env(safe-area-inset-top, 0px)))',
                        px: { xs: 1.5, sm: 2.5 },
                        py: 1,
                        minWidth: 0
                    }}
                >
                    <ViewHeaderMUI title={details.title} />
                </Box>
            ) : null}
            <MessengerRuntimeShell zones={zones} details={details} rootElement='div' onViewportHeightChange={setMaxViewportHeight} />
        </Box>
    )
}
