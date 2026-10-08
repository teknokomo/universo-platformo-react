import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import { dashboardWidgetConfigSchemaByKey } from '@universo-react/types'
import { FlowListTable, ViewHeaderMUI } from '../../components/runtime-ui'
import { useDashboardDetails } from '../DashboardDetailsContext'
import type { ZoneWidgetItem } from '../contracts'
import type { RuntimeWidgetPayload } from '../runtime/widgetPlacementGraph'
import { RuntimeWidgetStatus, readLocalizedWidgetText } from './RuntimeWidgetStatus'
import { useDashboardRowActions } from './DashboardRowActions'
import { resolveCreateActionAvailability } from './createTargetAvailability'

type DashboardRelationPayload = Extract<RuntimeWidgetPayload, { kind: 'relation' }>

interface DashboardRelationBuilderWidgetProps {
    config: ZoneWidgetItem['config']
    payload: DashboardRelationPayload
}

export default function DashboardRelationBuilderWidget({ config, payload }: DashboardRelationBuilderWidgetProps) {
    const { t } = useTranslation('apps')
    const { t: tCommon } = useTranslation('common')
    const details = useDashboardDetails()
    const createReasonIdPrefix = useId()
    const firstRelationParentKey = payload.parents[0]?.key ?? ''
    const [selectedRelationParentKey, setSelectedRelationParentKey] = useState(firstRelationParentKey)
    const parsedConfig = dashboardWidgetConfigSchemaByKey.relationBuilder.safeParse(config)
    const rowActions = useDashboardRowActions(details)

    useEffect(() => {
        if (!payload.parents.some(({ key }) => key === selectedRelationParentKey)) {
            setSelectedRelationParentKey(firstRelationParentKey)
        }
    }, [firstRelationParentKey, payload, selectedRelationParentKey])

    if (!parsedConfig.success) return <RuntimeWidgetStatus invalid />

    const selectedParent = payload.parents.find(({ key }) => key === selectedRelationParentKey) ?? payload.parents[0]
    if (!selectedParent && payload.parents.length === 0) {
        const emptyParentMessage = readLocalizedWidgetText(parsedConfig.data.emptyParentMessage, details?.locale)?.trim()
        return emptyParentMessage ? (
            <Alert severity='info' role='status'>
                {emptyParentMessage}
            </Alert>
        ) : (
            <RuntimeWidgetStatus state={{ status: 'empty' }} />
        )
    }
    if (!selectedParent || payload.panels.length === 0) return <RuntimeWidgetStatus state={{ status: 'empty' }} />

    const createAccess = resolveCreateActionAvailability(details, t)
    const canReorder =
        details?.runtimeAccessMode !== 'public' && details?.permissions?.editContent === true && Boolean(details?.relationRowReorder)
    return (
        <Stack spacing={2} data-testid='runtime-relation-builder' sx={{ minWidth: 0, maxWidth: '100%' }}>
            {payload.parents.length > 1 ? (
                <Tabs
                    value={selectedParent.key}
                    onChange={(_, value: string) => setSelectedRelationParentKey(value)}
                    variant='scrollable'
                    scrollButtons='auto'
                    aria-label={t('dashboard.widget.relationParents', 'Related records')}
                >
                    {payload.parents.map((parent) => (
                        <Tab key={parent.key} value={parent.key} label={parent.label} />
                    ))}
                </Tabs>
            ) : (
                <Typography variant='subtitle1'>{selectedParent.label}</Typography>
            )}
            <Grid container spacing={2} sx={{ minWidth: 0 }}>
                {payload.panels.map((panel) => {
                    const panelConfig = parsedConfig.data.panels.find(({ slotKey }) => slotKey === panel.slotKey)
                    if (!panelConfig) return null
                    const rows = panel.rows.filter(({ parentKey }) => parentKey === selectedParent.key)
                    const rowCountWarningMessage =
                        panelConfig.rowCountWarning && rows.length >= panelConfig.rowCountWarning.threshold
                            ? readLocalizedWidgetText(panelConfig.rowCountWarning.message, details?.locale)?.trim()
                            : undefined
                    const panelReorderingEnabled = (panelConfig.enableRowReordering ?? parsedConfig.data.enableRowReordering) === true
                    const reorderRows = (event: { active: { id: string }; over?: { id: string } | null }) => {
                        if (!canReorder || !details?.relationRowReorder || !event.over) return
                        const fromIndex = rows.findIndex(({ key }) => key === event.active.id)
                        const toIndex = rows.findIndex(({ key }) => key === event.over?.id)
                        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return
                        const orderedRowIds = rows.map(({ target }) => target.recordHandle)
                        const [movedRowId] = orderedRowIds.splice(fromIndex, 1)
                        if (!movedRowId) return
                        orderedRowIds.splice(toIndex, 0, movedRowId)
                        const expectedVersionsByRowId: Record<string, number> = {}
                        for (const row of rows) {
                            const { recordHandle, version } = row.target
                            if (!Number.isSafeInteger(version) || typeof version !== 'number' || version <= 0) return
                            if (Object.prototype.hasOwnProperty.call(expectedVersionsByRowId, recordHandle)) return
                            expectedVersionsByRowId[recordHandle] = version
                        }
                        if (
                            Object.keys(expectedVersionsByRowId).length !== orderedRowIds.length ||
                            orderedRowIds.some((rowId) => expectedVersionsByRowId[rowId] === undefined)
                        ) {
                            return
                        }
                        const reorderTarget = {
                            objectCollectionCodename: panel.targetEntityCodename,
                            parentFieldCodename: panel.parentFieldCodename,
                            parentRecordId: selectedParent.target.recordHandle,
                            orderedRowIds,
                            expectedVersionsByRowId
                        }
                        void details.relationRowReorder.onReorder({ ...reorderTarget })
                    }
                    const createDefaults = [
                        ...(panelConfig.createDefaults ?? []).filter(({ fieldCodename }) => fieldCodename !== panel.parentFieldCodename),
                        {
                            fieldCodename: panel.parentFieldCodename,
                            contextPath: 'relation.parentRecordId'
                        }
                    ]
                    const relationScope = {
                        fieldCodename: panel.parentFieldCodename,
                        parentRecordId: selectedParent.target.recordHandle
                    }
                    const createReasonId = `${createReasonIdPrefix}-create-disabled-${panel.slotKey}`
                    const listRows = rows.map((row) => ({
                        id: row.key,
                        name: row.label,
                        target: row.target,
                        displayValues: new Map((row.cells ?? []).map(({ key, value }) => [key, value] as const))
                    }))
                    const customColumns = [
                        {
                            id: 'name',
                            label: t('runtime.table.name', 'Name'),
                            render: (row: (typeof listRows)[number]) => row.name
                        },
                        ...(panel.displayColumns ?? []).map(({ key, label }) => ({
                            id: key,
                            label,
                            render: (row: (typeof listRows)[number]) => row.displayValues.get(key) ?? ''
                        }))
                    ]
                    return (
                        <Grid key={panel.slotKey} size={{ xs: 12, lg: panelConfig.width ?? 12 }} sx={{ minWidth: 0 }}>
                            <Stack spacing={1} sx={{ minWidth: 0 }}>
                                <ViewHeaderMUI title={panel.title} controlsWrap>
                                    <Button
                                        type='button'
                                        variant='contained'
                                        size='small'
                                        startIcon={<AddRoundedIcon fontSize='small' />}
                                        disabled={createAccess.disabled}
                                        aria-describedby={createAccess.disabled ? createReasonId : undefined}
                                        onClick={() => {
                                            if (createAccess.disabled || !details?.onOpenCreateTarget) return
                                            const createTarget = {
                                                id: `relation-create:${panel.slotKey}`,
                                                label: panelConfig.title,
                                                objectCollectionCodename: panel.targetEntityCodename,
                                                createDefaults,
                                                createDefaultContext: {
                                                    relation: { parentRecordId: selectedParent.target.recordHandle }
                                                },
                                                createWizard: panelConfig.createWizard,
                                                relationScope
                                            }
                                            details.onOpenCreateTarget(createTarget)
                                        }}
                                    >
                                        {t('app.createRow', 'Create')}
                                    </Button>
                                </ViewHeaderMUI>
                                {createAccess.disabled && createAccess.disabledReason ? (
                                    <Typography id={createReasonId} role='status' variant='caption' sx={{ color: 'text.secondary' }}>
                                        {createAccess.disabledReason}
                                    </Typography>
                                ) : null}
                                {rowCountWarningMessage ? (
                                    <Alert severity='warning' role='status'>
                                        {rowCountWarningMessage}
                                    </Alert>
                                ) : null}
                                <FlowListTable
                                    data={listRows}
                                    isLoading={canReorder && details?.relationRowReorder?.isPending === true}
                                    sortableRows={canReorder && panelReorderingEnabled}
                                    tableAriaLabel={panel.title}
                                    sortableColumnLabel={tCommon('dashboard.widgets.reorderRows', 'Reorder rows')}
                                    onSortableDragEnd={reorderRows}
                                    customColumns={customColumns}
                                    renderActions={
                                        rowActions.showRowActions
                                            ? (row) =>
                                                  rowActions.renderRowActionButton(
                                                      {
                                                          entityCodename: row.target.entityCodename,
                                                          recordHandle: row.target.recordHandle,
                                                          relationScope
                                                      },
                                                      row.name
                                                  )
                                            : undefined
                                    }
                                />
                            </Stack>
                        </Grid>
                    )
                })}
            </Grid>
            {rowActions.rowActionMenu}
        </Stack>
    )
}
