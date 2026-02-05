import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSnackbar } from 'notistack'
import { Box, Button, CircularProgress, FormControlLabel, Stack, Switch, Typography } from '@mui/material'
import { TemplateMainCard as MainCard, ViewHeaderMUI as ViewHeader, notifyError } from '@universo/template-mui'

import { metahubsQueryKeys, invalidateLayoutsQueries } from '../../shared'
import * as layoutsApi from '../api'
import { useUpdateLayout } from '../hooks/mutations'
import type { MetahubLayout } from '../../../types'
import { getVLCString, normalizeLocale } from '../../../types'

type DashboardLayoutConfig = {
    showSideMenu: boolean
    showAppNavbar: boolean
    showHeader: boolean
    showBreadcrumbs: boolean
    showSearch: boolean
    showDatePicker: boolean
    showOptionsMenu: boolean
    showOverviewTitle: boolean
    showOverviewCards: boolean
    showSessionsChart: boolean
    showPageViewsChart: boolean
    showDetailsTitle: boolean
    showDetailsTable: boolean
    showDetailsSidePanel: boolean
    showFooter: boolean
}

const DEFAULT_DASHBOARD_CONFIG: DashboardLayoutConfig = {
    showSideMenu: true,
    showAppNavbar: true,
    showHeader: true,
    showBreadcrumbs: true,
    showSearch: true,
    showDatePicker: true,
    showOptionsMenu: true,
    showOverviewTitle: true,
    showOverviewCards: true,
    showSessionsChart: true,
    showPageViewsChart: true,
    showDetailsTitle: true,
    showDetailsTable: true,
    showDetailsSidePanel: true,
    showFooter: true
}

const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean'

const coerceDashboardConfig = (raw: Record<string, unknown> | null | undefined): DashboardLayoutConfig => {
    const result: DashboardLayoutConfig = { ...DEFAULT_DASHBOARD_CONFIG }
    if (!raw) return result
    for (const key of Object.keys(result) as (keyof DashboardLayoutConfig)[]) {
        const candidate = raw[key as string]
        if (isBoolean(candidate)) result[key] = candidate
    }
    return result
}

export default function LayoutDetails() {
    const navigate = useNavigate()
    const { metahubId, layoutId } = useParams<{ metahubId: string; layoutId: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common'])
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()

    const updateLayoutMutation = useUpdateLayout()

    const query = useQuery({
        queryKey: metahubId && layoutId ? metahubsQueryKeys.layoutDetail(metahubId, layoutId) : ['layout-empty'],
        enabled: Boolean(metahubId && layoutId),
        queryFn: async () => {
            const resp = await layoutsApi.getLayout(String(metahubId), String(layoutId))
            return resp.data
        }
    })

    const [layout, setLayout] = useState<MetahubLayout | null>(null)
    const [config, setConfig] = useState<DashboardLayoutConfig>(DEFAULT_DASHBOARD_CONFIG)
    const [dirty, setDirty] = useState(false)

    useEffect(() => {
        if (!query.data) return
        setLayout(query.data)
        setConfig(coerceDashboardConfig(query.data.config))
        setDirty(false)
    }, [query.data])

    const uiLocale = normalizeLocale(i18n.language)
    const layoutName = useMemo(() => {
        if (!layout) return ''
        return getVLCString(layout.name, uiLocale) || getVLCString(layout.name, 'en') || layout.templateKey
    }, [layout, uiLocale])

    const sections = useMemo(
        () =>
            [
                { key: 'showSideMenu', label: t('layouts.dashboard.sections.showSideMenu', 'Left menu') },
                { key: 'showAppNavbar', label: t('layouts.dashboard.sections.showAppNavbar', 'Top navbar') },
                { key: 'showHeader', label: t('layouts.dashboard.sections.showHeader', 'Header') },
                { key: 'showBreadcrumbs', label: t('layouts.dashboard.sections.showBreadcrumbs', 'Breadcrumbs') },
                { key: 'showSearch', label: t('layouts.dashboard.sections.showSearch', 'Search') },
                { key: 'showDatePicker', label: t('layouts.dashboard.sections.showDatePicker', 'Date picker') },
                { key: 'showOptionsMenu', label: t('layouts.dashboard.sections.showOptionsMenu', 'Notifications & theme') },
                { key: 'showOverviewTitle', label: t('layouts.dashboard.sections.showOverviewTitle', 'Overview title') },
                { key: 'showOverviewCards', label: t('layouts.dashboard.sections.showOverviewCards', 'Overview cards') },
                { key: 'showSessionsChart', label: t('layouts.dashboard.sections.showSessionsChart', 'Sessions chart') },
                { key: 'showPageViewsChart', label: t('layouts.dashboard.sections.showPageViewsChart', 'Page views chart') },
                { key: 'showDetailsTitle', label: t('layouts.dashboard.sections.showDetailsTitle', 'Details title') },
                { key: 'showDetailsTable', label: t('layouts.dashboard.sections.showDetailsTable', 'Details table') },
                { key: 'showDetailsSidePanel', label: t('layouts.dashboard.sections.showDetailsSidePanel', 'Details side panel') },
                { key: 'showFooter', label: t('layouts.dashboard.sections.showFooter', 'Footer') }
            ] as const,
        [t]
    )

    const handleToggle = (key: keyof DashboardLayoutConfig, value: boolean) => {
        setConfig((prev) => ({ ...prev, [key]: value }))
        setDirty(true)
    }

    const handleSave = async () => {
        if (!metahubId || !layoutId || !layout) return
        try {
            await updateLayoutMutation.mutateAsync({
                metahubId,
                layoutId,
                data: {
                    config: config as unknown as Record<string, unknown>,
                    expectedVersion: layout.version
                }
            })
            await invalidateLayoutsQueries.detail(queryClient, metahubId, layoutId)
            setDirty(false)
        } catch (e: unknown) {
            notifyError(t, enqueueSnackbar, e)
        }
    }

    if (!metahubId || !layoutId) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography variant='body2'>{t('metahubs:errors.pleaseSelectMetahub', 'Please select a metahub')}</Typography>
            </Box>
        )
    }

    return (
        <MainCard
            sx={{ maxWidth: '100%', width: '100%' }}
            contentSX={{ px: 0, py: 0 }}
            disableContentPadding
            disableHeader
            border={false}
            shadow={false}
        >
            <Stack spacing={2}>
                <Box sx={{ px: { xs: 1.5, md: 2 } }}>
                    <ViewHeader
                        title={layoutName || t('layouts.details.title', 'Layout')}
                        description={t('layouts.details.description', 'Configure dashboard sections (show/hide).')}
                        search={false}
                        isBackButton
                        onBack={() => navigate(`/metahub/${metahubId}/layouts`)}
                    />
                </Box>

                <Box sx={{ px: { xs: 1.5, md: 2 } }}>
                    {query.isLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                            <CircularProgress size={28} />
                        </Box>
                    ) : query.error ? (
                        <Typography color='error'>{t('layouts.loadError', 'Failed to load layout')}</Typography>
                    ) : (
                        <Stack spacing={2}>
                            <Stack spacing={1}>
                                {sections.map((s) => (
                                    <FormControlLabel
                                        key={s.key}
                                        control={
                                            <Switch
                                                checked={Boolean(config[s.key as keyof DashboardLayoutConfig])}
                                                onChange={(_, checked) => handleToggle(s.key as keyof DashboardLayoutConfig, checked)}
                                            />
                                        }
                                        label={s.label}
                                    />
                                ))}
                            </Stack>

                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                                <Button variant='contained' disabled={!dirty || updateLayoutMutation.isPending} onClick={() => void handleSave()}>
                                    {updateLayoutMutation.isPending
                                        ? t('common:actions.saving', 'Saving...')
                                        : t('common:actions.save', 'Save')}
                                </Button>
                            </Box>
                        </Stack>
                    )}
                </Box>
            </Stack>
        </MainCard>
    )
}
