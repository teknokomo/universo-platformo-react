import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import { dashboardWidgetConfigSchemaByKey, getDashboardWidgetDefinition } from '@universo-react/types'
import type { ZoneWidgetItem } from '../contracts'
import { useDashboardDetails } from '../DashboardDetailsContext'
import type { RuntimeWidgetData } from '../runtime/widgetPlacementGraph'
import PageBlocksView from './PageBlocksView'
import { RuntimeWidgetStatus } from './RuntimeWidgetStatus'

type LearnerPlayerBasePayload = Extract<Extract<RuntimeWidgetData, { status: 'ready' }>['data'], { kind: 'learner-player' }>
type LearnerPlayerPayload = Omit<LearnerPlayerBasePayload, 'items'> & {
    parents?: Array<{ key: string; label: string; target: { recordHandle: string } }>
    items: Array<LearnerPlayerBasePayload['items'][number] & { parentKey?: string }>
}

export default function LearnerPlayerWidget({ widget }: { widget: ZoneWidgetItem }) {
    const details = useDashboardDetails()
    const { t } = useTranslation('apps')
    const defaultVariant = getDashboardWidgetDefinition('learnerPlayer')?.initialBindingVariantKey ?? 'course'
    const parsedConfig = dashboardWidgetConfigSchemaByKey.learnerPlayer.safeParse({
        ...widget.config,
        variant: widget.config.variant ?? defaultVariant
    })
    const sequenceMode = parsedConfig.success ? parsedConfig.data.sequenceMode ?? 'strict' : 'strict'
    const [selectedItemKey, setSelectedItemKey] = useState('')
    const [selectedParentSelection, setSelectedParentSelection] = useState({ sourceSignature: '', parentKey: '' })
    const runtimeData = widget.runtimeData
    const rawPayload = runtimeData?.status === 'ready' && runtimeData.data.kind === 'learner-player' ? runtimeData.data : undefined
    const payload = rawPayload as LearnerPlayerPayload | undefined
    const items = payload?.items
    const parents = payload?.parents ?? []
    const defaultParentKey = parents[0]?.key ?? ''
    const parentSourceSignature = JSON.stringify({
        widgetId: widget.id,
        parents: parents.map(({ key, target }) => [key, target.recordHandle]),
        items: items?.map(({ key, parentKey, progressTarget }) => [key, parentKey ?? '', progressTarget.recordHandle]) ?? []
    })
    const selectedParentKey =
        selectedParentSelection.sourceSignature === parentSourceSignature ? selectedParentSelection.parentKey : defaultParentKey
    const selectedParent = parents.find(({ key }) => key === selectedParentKey) ?? parents[0]
    const selectedParentItemKey = selectedParent?.key ?? ''
    const parentItems = useMemo(
        () => (items ?? []).filter((item) => !selectedParentItemKey || item.parentKey === selectedParentItemKey),
        [items, selectedParentItemKey]
    )
    const selectableItems = useMemo(
        () => parentItems.filter((item) => sequenceMode === 'flexible' || item.availability !== 'locked'),
        [parentItems, sequenceMode]
    )
    const defaultItemKey = selectableItems[0]?.key ?? ''

    useEffect(() => {
        if (!selectableItems.some((item) => item.key === selectedItemKey)) setSelectedItemKey(defaultItemKey)
    }, [defaultItemKey, selectableItems, selectedItemKey])

    const parentSelector =
        parents.length > 1 ? (
            <Tabs
                value={selectedParent?.key ?? defaultParentKey}
                onChange={(_, value: string) => {
                    setSelectedParentSelection({ sourceSignature: parentSourceSignature, parentKey: value })
                    setSelectedItemKey('')
                }}
                variant='scrollable'
                scrollButtons='auto'
                aria-label={t('learnerPlayer.parentLabel', 'Content')}
                data-testid='runtime-learner-player-parent-tabs'
            >
                {parents.map((parent) => (
                    <Tab key={parent.key} value={parent.key} label={parent.label} />
                ))}
            </Tabs>
        ) : null

    if (!runtimeData || runtimeData.status !== 'ready') return <RuntimeWidgetStatus state={runtimeData} />
    if (!payload || !parsedConfig.success) return <RuntimeWidgetStatus invalid />
    if (!items || items.length === 0) return <RuntimeWidgetStatus state={{ status: 'empty' }} />
    const selectedItem = selectableItems.find((item) => item.key === selectedItemKey) ?? selectableItems[0]
    const persistSelectedProgress =
        selectedItem && selectedItem.availability !== 'locked' && details?.pagePlayer?.onProgressChange
            ? ({ action }: { action: 'view' | 'complete' }) =>
                  details.pagePlayer?.onProgressChange?.({ action, target: selectedItem.progressTarget })
            : undefined
    if (!selectedItem) {
        return (
            <Stack spacing={2} data-testid='runtime-learner-player'>
                {parentSelector}
                <Alert severity='info' role='status'>
                    {parentItems.length === 0 && selectedParent
                        ? t('learnerPlayer.emptyParent', 'No learning content is available yet.')
                        : t('dashboard.widget.sequenceLocked', 'The next learning item is not available yet.')}
                </Alert>
            </Stack>
        )
    }
    return (
        <Stack spacing={2} data-testid='runtime-learner-player'>
            {parentSelector}
            <Tabs
                value={selectedItem.key}
                onChange={(_, value: string) => setSelectedItemKey(value)}
                variant='scrollable'
                scrollButtons='auto'
                aria-label={t('dashboard.widget.learningItems', 'Learning items')}
            >
                {parentItems.map((item) => (
                    <Tab
                        key={item.key}
                        value={item.key}
                        label={item.title}
                        disabled={sequenceMode === 'strict' && item.availability === 'locked'}
                    />
                ))}
            </Tabs>
            {selectedItem.availability === 'completed' ? (
                <Alert severity='success' role='status'>
                    {t('dashboard.widget.completed', 'Completed')}
                </Alert>
            ) : selectedItem.progressPercent !== undefined && selectedItem.progressPercent > 0 ? (
                <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                    {t('dashboard.widget.progress', '{{percent}}% complete', { percent: selectedItem.progressPercent })}
                </Typography>
            ) : null}
            {selectedItem.blocks.length > 0 ? (
                <PageBlocksView
                    blocks={selectedItem.blocks}
                    showOutline={details?.pagePlayer?.showOutline}
                    showProgressHeader={details?.pagePlayer?.showProgressHeader}
                    completeButtonMode={selectedItem.availability === 'locked' ? 'hidden' : details?.pagePlayer?.completeButtonMode}
                    progressStorageKey={
                        details?.pagePlayer?.progressStorageKey ? `${details.pagePlayer.progressStorageKey}:${selectedItem.key}` : undefined
                    }
                    onProgressChange={persistSelectedProgress}
                />
            ) : (
                <Stack spacing={1}>
                    <Alert severity='info'>
                        {t('dashboard.widget.previewUnavailable', 'This learning item has no previewable content yet.')}
                    </Alert>
                    {details?.pagePlayer?.completeButtonMode === 'manual' &&
                    selectedItem.availability !== 'completed' &&
                    persistSelectedProgress ? (
                        <Button size='small' variant='outlined' onClick={() => void persistSelectedProgress({ action: 'complete' })}>
                            {t('dashboard.widget.complete', 'Complete')}
                        </Button>
                    ) : null}
                </Stack>
            )}
        </Stack>
    )
}
