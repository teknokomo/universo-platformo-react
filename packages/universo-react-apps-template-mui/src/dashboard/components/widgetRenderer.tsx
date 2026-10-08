import { useEffect, lazy, Suspense, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import { dashboardWidgetConfigSchemaByKey } from '@universo-react/types'

import ReportDetailsTableWidget from './ReportDetailsTableWidget'
import LibraryDetailsTableWidget from './LibraryDetailsTableWidget'
import QuizWidget from './QuizWidget'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import CustomDatePicker from './CustomDatePicker'
import DashboardFooter from './DashboardFooter'
import NavbarBreadcrumbs from './NavbarBreadcrumbs'
import ColorModeIconDropdown from '../../shared-theme/ColorModeIconDropdown'
import Search from './Search'
import InterpretationNetworkWorkspaceWidget from './InterpretationNetworkWorkspaceWidget'
import type { ZoneWidgetItem } from '../contracts'
import { useDashboardDetails } from '../DashboardDetailsContext'
import { childrenForSlot, type RuntimePlacement } from '../runtime/widgetPlacementGraph'
import DashboardDataWidget from './DashboardDataWidget'
import RuntimeMenuWidget from './RuntimeMenuWidget'
import LearnerPlayerWidget from './LearnerPlayerWidget'
import { RuntimeWidgetStatus, readLocalizedWidgetText } from './RuntimeWidgetStatus'

/**
 * Maximum nesting depth for columnsContainer widgets to prevent infinite recursion.
 * Containers can nest within this bound; deeper placements render as invalid.
 */
const MAX_CONTAINER_DEPTH = 8

function DetailsTabsWidget({ widget, options }: { widget: ZoneWidgetItem; options: Required<RenderWidgetOptions> }) {
    const details = useDashboardDetails()
    const { t } = useTranslation('apps')
    const parsed = useMemo(() => dashboardWidgetConfigSchemaByKey.detailsTabs.safeParse(widget.config), [widget.config])
    const tabs = useMemo(
        () => (parsed.success ? (parsed.data.tabs as Array<{ slotKey: string; label: unknown; isDefault?: boolean }>) : []),
        [parsed]
    )
    const defaultTab = tabs.find((tab) => tab.isDefault)?.slotKey ?? tabs[0]?.slotKey ?? false
    const [activeSlot, setActiveSlot] = useState<string | false>(defaultTab)

    useEffect(() => {
        if (!tabs.some((tab) => tab.slotKey === activeSlot)) setActiveSlot(defaultTab)
    }, [activeSlot, defaultTab, tabs])

    if (!parsed.success) return <RuntimeWidgetStatus invalid />
    if (tabs.length === 0 || activeSlot === false) return <RuntimeWidgetStatus state={{ status: 'empty' }} />
    const selectedTab = tabs.find((tab) => tab.slotKey === activeSlot) ?? tabs[0]
    const children = childrenForSlot(options.placements, widget.instanceKey, selectedTab.slotKey)

    return (
        <Box data-testid='runtime-details-tabs'>
            <Tabs value={activeSlot} onChange={(_, value: string) => setActiveSlot(value)} variant='scrollable' scrollButtons='auto'>
                {tabs.map((tab) => (
                    <Tab
                        key={tab.slotKey}
                        value={tab.slotKey}
                        label={readLocalizedWidgetText(tab.label, details?.locale) ?? t('dashboard.widget.tab', 'Section')}
                    />
                ))}
            </Tabs>
            <Box sx={{ pt: 2, display: 'grid', gap: 2 }}>
                {children.length === 0 ? (
                    <RuntimeWidgetStatus state={{ status: 'empty' }} />
                ) : (
                    children.map((child) => (
                        <Box key={child.id}>{renderWidget(child, { ...options, depth: options.depth + 1, menuVariant: 'wide' })}</Box>
                    ))
                )}
            </Box>
        </Box>
    )
}

/**
 * Shared widget renderer used by both left and right sidebars.
 * Maps widget keys to concrete React components.
 *
 * @param depth - Current nesting depth for columnsContainer (0 = top level). Used internally for recursion guard.
 */
const PlayCanvasCanvasWidget = lazy(() => import('./PlayCanvasCanvasWidget').then((module) => ({ default: module.default })))

interface PlayCanvasWidgetSuspenseFallbackProps {
    minHeight?: number
}

function PlayCanvasWidgetSuspenseFallback({ minHeight = 240 }: PlayCanvasWidgetSuspenseFallbackProps) {
    const { t } = useTranslation('apps')
    return (
        <Box role='status' aria-busy='true' aria-label={t('playcanvasCanvas.loading')} sx={{ width: '100%', minHeight, p: 1 }}>
            <Skeleton variant='rectangular' width='100%' height={minHeight} sx={{ borderRadius: 1 }} />
        </Box>
    )
}

function UserProfileWidget({ widget }: { widget: ZoneWidgetItem }): ReactNode {
    const details = useDashboardDetails()
    const displayName = details?.currentUser?.displayName.trim()
    if (!displayName) return null
    return (
        <Stack
            key={widget.id}
            direction='row'
            sx={{
                p: 2,
                gap: 1,
                alignItems: 'center',
                borderTop: '1px solid',
                borderColor: 'divider'
            }}
        >
            <Avatar sizes='small' sx={{ width: 36, height: 36 }}>
                <PersonRoundedIcon fontSize='small' />
            </Avatar>
            <Box sx={{ mr: 'auto' }}>
                <Typography variant='body2' sx={{ fontWeight: 500, lineHeight: '16px', minWidth: 0, overflowWrap: 'anywhere' }}>
                    {displayName}
                </Typography>
            </Box>
        </Stack>
    )
}

function OptionsMenuWidget({ widget, placements }: { widget: ZoneWidgetItem; placements: readonly RuntimePlacement[] }): ReactNode {
    const { t } = useTranslation('apps')
    const colorModeLabels = useColorModeLabels()
    const details = useDashboardDetails()
    const config = dashboardWidgetConfigSchemaByKey.optionsMenu.safeParse(widget.config)
    if (!config.success) return <RuntimeWidgetStatus invalid />
    const visibleActions = config.data.visibleActions ?? ['preferences']
    const hasDedicatedColorModeSwitcher = placements.some((placement) => placement.isActive && placement.widgetKey === 'colorModeSwitcher')
    const showPreferences =
        visibleActions.includes('preferences') &&
        details?.hostCapabilities?.includes('theme.safe') === true &&
        !hasDedicatedColorModeSwitcher
    if (!showPreferences) return null

    return (
        <Stack
            key={widget.id}
            data-testid='runtime-options-menu-widget'
            direction='row'
            spacing={1}
            useFlexGap
            sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
            <ColorModeIconDropdown labels={colorModeLabels} aria-label={t('runtime.preferences', 'Preferences')} />
        </Stack>
    )
}

function useColorModeLabels() {
    const { t } = useTranslation('common')
    return {
        system: t('colorModes.system', 'System'),
        light: t('colorModes.light', 'Light'),
        dark: t('colorModes.dark', 'Dark')
    }
}

function ColorModeSwitcherWidget({ widgetId }: { widgetId: string }): ReactNode {
    const { t } = useTranslation('apps')
    const colorModeLabels = useColorModeLabels()

    return <ColorModeIconDropdown key={widgetId} labels={colorModeLabels} aria-label={t('colorMode.label', 'Color mode')} />
}

export interface RenderWidgetOptions {
    depth?: number
    menuVariant?: 'wide' | 'compact'
    placements?: readonly RuntimePlacement[]
}

export function renderWidget(widget: ZoneWidgetItem, options: RenderWidgetOptions = {}): ReactNode {
    const normalizedOptions: Required<RenderWidgetOptions> = {
        depth: options.depth ?? 0,
        menuVariant: options.menuVariant ?? 'wide',
        placements: options.placements ?? []
    }
    const { depth, menuVariant, placements } = normalizedOptions

    switch (widget.widgetKey) {
        case 'divider':
            return <Divider key={widget.id} />
        case 'menuWidget':
            return <RuntimeMenuWidget key={widget.id} widget={widget} variant={menuVariant} />
        case 'workspaceSwitcher':
            return (
                <Box key={widget.id} sx={{ p: 1.5, pb: 0.75 }}>
                    <WorkspaceSwitcher variant='sidebar' />
                </Box>
            )
        case 'spacer':
            return <Box key={widget.id} sx={{ flexGrow: 1 }} />
        case 'infoCard':
        case 'overviewTitle':
        case 'overviewCards':
        case 'sessionsChart':
        case 'pageViewsChart':
        case 'detailsTitle':
            return <DashboardDataWidget key={widget.id} widget={widget} />
        case 'userProfile':
            return <UserProfileWidget key={widget.id} widget={widget} />
        case 'languageSwitcher':
            return <LanguageSwitcher key={widget.id} />
        case 'colorModeSwitcher':
            return <ColorModeSwitcherWidget key={widget.id} widgetId={widget.id} />
        case 'breadcrumbs':
            return (
                <Box key={widget.id} data-testid='runtime-breadcrumbs-widget' sx={{ maxWidth: '100%', minWidth: 0, overflowX: 'auto' }}>
                    <NavbarBreadcrumbs />
                </Box>
            )
        case 'search':
            return (
                <Box key={widget.id} data-testid='runtime-search-widget' sx={{ maxWidth: '100%', minWidth: 0, width: '100%' }}>
                    <Search />
                </Box>
            )
        case 'datePicker': {
            const parsed = dashboardWidgetConfigSchemaByKey.datePicker.safeParse(widget.config)
            if (!parsed.success) return <RuntimeWidgetStatus invalid />
            return (
                <Box key={widget.id} data-testid='runtime-date-picker-widget' sx={{ maxWidth: '100%', minWidth: 0 }}>
                    <CustomDatePicker selection={parsed.data.selection} showPresets={parsed.data.showPresets} />
                </Box>
            )
        }
        case 'optionsMenu':
            return <OptionsMenuWidget key={widget.id} widget={widget} placements={placements} />
        case 'footer':
            return <DashboardFooter key={widget.id} config={widget.config} />
        case 'detailsTable':
            if (widget.config?.variant === 'report') return <ReportDetailsTableWidget key={widget.id} widget={widget} />
            if (widget.config?.variant === 'library') return <LibraryDetailsTableWidget key={widget.id} widget={widget} />
            return <DashboardDataWidget key={widget.id} widget={widget} />
        case 'relationBuilder':
        case 'resourcePreview':
            return <DashboardDataWidget key={widget.id} widget={widget} />
        case 'learnerPlayer':
            return <LearnerPlayerWidget key={widget.id} widget={widget} />
        case 'interpretationNetworkWorkspace':
            return (
                <InterpretationNetworkWorkspaceWidget
                    key={widget.id}
                    config={widget.config}
                    widgetId={widget.id}
                    layoutId={widget.layoutId}
                />
            )
        case 'detailsTabs':
            return <DetailsTabsWidget key={widget.id} widget={widget} options={normalizedOptions} />
        case 'quizWidget':
            return <QuizWidget key={widget.id} config={widget.config} />
        case 'playcanvasCanvas':
            return (
                <Suspense key={widget.id} fallback={<PlayCanvasWidgetSuspenseFallback />}>
                    <PlayCanvasCanvasWidget widgetId={widget.id} config={widget.config} />
                </Suspense>
            )
        case 'columnsContainer': {
            if (depth >= MAX_CONTAINER_DEPTH) return <RuntimeWidgetStatus invalid />
            const parsed = dashboardWidgetConfigSchemaByKey.columnsContainer.safeParse(widget.config)
            if (!parsed.success) return <RuntimeWidgetStatus invalid />
            return (
                <Grid key={widget.id} container spacing={2} sx={{ width: '100%', minWidth: 0 }}>
                    {(parsed.data.columns as Array<{ slotKey: string; width: number }>).map((column) => {
                        const children = childrenForSlot(placements, widget.instanceKey, column.slotKey)
                        return (
                            <Grid key={column.slotKey} size={{ xs: 12, md: column.width }} sx={{ minWidth: 0 }}>
                                {children.length === 0 ? (
                                    <RuntimeWidgetStatus state={{ status: 'empty' }} />
                                ) : (
                                    children.map((child) => (
                                        <Box key={child.id} sx={{ '& + &': { mt: 2 } }}>
                                            {renderWidget(child, { ...normalizedOptions, depth: depth + 1 })}
                                        </Box>
                                    ))
                                )}
                            </Grid>
                        )
                    })}
                </Grid>
            )
        }
        default:
            return null
    }
}
