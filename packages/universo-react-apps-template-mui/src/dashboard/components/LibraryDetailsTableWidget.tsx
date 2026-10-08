import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    dashboardWidgetConfigSchemaByKey,
    learningContentDefaultViewModes,
    type DashboardLibraryTableWidgetConfig
} from '@universo-react/types'
import Alert from '@mui/material/Alert'

import type { DashboardDetailsSlot, ZoneWidgetItem } from '../contracts'
import { useDashboardDetails } from '../DashboardDetailsContext'
import LibraryDetailsTableView from './LibraryDetailsTableView'
import { runtimeStateMessage, type ReadyTableRuntimeData } from './libraryDetailsTableUtils'
import { useLibraryDetailsTableActions } from './useLibraryDetailsTableActions'

interface LibraryDetailsTableWidgetProps {
    widget: ZoneWidgetItem
}

/** Renders the configured library widget while preserving its established widget API. */
export default function LibraryDetailsTableWidget({ widget }: LibraryDetailsTableWidgetProps) {
    const details = useDashboardDetails()
    const { t } = useTranslation('apps')
    const parsedConfig = dashboardWidgetConfigSchemaByKey.detailsTable.safeParse(widget.config)
    const config: DashboardLibraryTableWidgetConfig | null =
        parsedConfig.success && parsedConfig.data.variant === 'library' ? parsedConfig.data : null
    const runtimeData = widget.runtimeData
    const payload: ReadyTableRuntimeData | null =
        runtimeData?.status === 'ready' && runtimeData.data.kind === 'table' ? runtimeData.data : null
    const rawLearningContentSettings = details?.settings?.learningContent
    const learningContentSettings =
        rawLearningContentSettings && typeof rawLearningContentSettings === 'object' && !Array.isArray(rawLearningContentSettings)
            ? (rawLearningContentSettings as Record<string, unknown>)
            : null
    const configuredLearningContentView =
        config?.libraryView === 'all' && details?.runtimeAccessMode === 'member'
            ? learningContentDefaultViewModes.find((mode) => mode === learningContentSettings?.defaultView)
            : undefined
    const defaultViewMode: 'table' | 'card' =
        configuredLearningContentView === 'cards'
            ? 'card'
            : configuredLearningContentView === 'table'
            ? 'table'
            : config?.defaultViewMode ?? 'table'
    const [viewMode, setViewMode] = useState<'table' | 'card'>(defaultViewMode)
    const [searchValue, setSearchValue] = useState('')
    const [targetFilterId, setTargetFilterId] = useState('')
    const actions = useLibraryDetailsTableActions({ config, details, t })

    useEffect(() => setViewMode(defaultViewMode), [defaultViewMode])

    if (!config) return <Alert severity='error'>{t('dashboard.widget.malformedConfig', 'This widget is configured incorrectly.')}</Alert>
    if (!payload) {
        const message = runtimeStateMessage(runtimeData, t)
        if (!message) return null
        return <Alert severity={runtimeData?.status === 'empty' || runtimeData?.status === 'loading' ? 'info' : 'error'}>{message}</Alert>
    }

    return (
        <LibraryDetailsTableView
            widget={widget}
            config={config}
            payload={payload}
            details={details as DashboardDetailsSlot | undefined}
            actions={actions}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            searchValue={searchValue}
            onSearchValueChange={setSearchValue}
            targetFilterId={targetFilterId}
            onTargetFilterIdChange={setTargetFilterId}
        />
    )
}
