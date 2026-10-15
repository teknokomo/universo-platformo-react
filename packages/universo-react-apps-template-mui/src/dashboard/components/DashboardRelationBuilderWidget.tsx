import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import { dashboardWidgetConfigSchemaByKey } from '@universo-react/types'
import { FlowListTable, ViewHeaderMUI } from '../../components/runtime-ui'
import { useDashboardDetails } from '../DashboardDetailsContext'
import { useDashboardWidgetSelection } from '../DashboardWidgetSelectionContext'
import type { ZoneWidgetItem } from '../contracts'
import type { RuntimeWidgetPayload } from '../runtime/widgetPlacementGraph'
import { RuntimeWidgetStatus, readLocalizedWidgetText } from './RuntimeWidgetStatus'
import { useDashboardRowActions } from './DashboardRowActions'
import { resolveCreateActionAvailability } from './createTargetAvailability'
import { fetchRuntimeWorkspace } from '../../api/workspaces'
import { workspaceQueryKeys } from '../../api/mutations'

type DashboardRelationPayload = Extract<RuntimeWidgetPayload, { kind: 'relation' }>

const resolveApplicationPath = (
    pathTemplate: string,
    applicationId: string | undefined,
    value: string | undefined,
    workspaceId?: string | null
): string | null => {
    if (!applicationId || !value?.trim() || typeof window === 'undefined') return null
    const path = pathTemplate
        .replace('{applicationId}', encodeURIComponent(applicationId))
        .replace('{value}', encodeURIComponent(value.trim()))

    try {
        const url = new URL(path, window.location.origin)
        if (workspaceId) url.searchParams.set('workspaceId', workspaceId)
        return url.origin === window.location.origin ? url.toString() : null
    } catch {
        return null
    }
}

interface DashboardRelationBuilderWidgetProps {
    instanceKey: string
    config: ZoneWidgetItem['config']
    payload: DashboardRelationPayload
}

export default function DashboardRelationBuilderWidget({ instanceKey, config, payload }: DashboardRelationBuilderWidgetProps) {
    const { t } = useTranslation('apps')
    const { t: tCommon } = useTranslation('common')
    const details = useDashboardDetails()
    const widgetSelection = useDashboardWidgetSelection()
    const createReasonIdPrefix = useId()
    const [copyFeedback, setCopyFeedback] = useState<'copied' | 'failed' | null>(null)
    const firstRelationParentKey = payload.parents[0]?.key ?? ''
    const storedRelationParentKey = widgetSelection?.selectedRelationParents[instanceKey]
    const [localRelationParentKey, setLocalRelationParentKey] = useState(firstRelationParentKey)
    const selectedRelationParentKey = widgetSelection ? storedRelationParentKey ?? firstRelationParentKey : localRelationParentKey
    const parsedConfig = dashboardWidgetConfigSchemaByKey.relationBuilder.safeParse(config)
    const rowActions = useDashboardRowActions(details)
    const hasGuestLinkPanel = parsedConfig.success && parsedConfig.data.panels.some((panel) => Boolean(panel.rowLink))
    const currentWorkspaceQuery = useQuery({
        queryKey:
            details?.applicationId && details.currentWorkspaceId
                ? workspaceQueryKeys.detail(details.applicationId, details.currentWorkspaceId)
                : ['runtime-workspaces', 'guest-link', 'missing'],
        enabled: Boolean(hasGuestLinkPanel && details?.workspacesEnabled && details.applicationId && details.currentWorkspaceId),
        queryFn: () => {
            if (!details?.applicationId || !details.currentWorkspaceId) {
                throw new Error('The active workspace is unavailable.')
            }
            return fetchRuntimeWorkspace({
                apiBaseUrl: details?.apiBaseUrl ?? '/api/v1',
                applicationId: details.applicationId,
                workspaceId: details.currentWorkspaceId
            })
        },
        staleTime: 60_000
    })
    const guestLinkWorkspaceStatus = !details?.workspacesEnabled
        ? 'available'
        : !details.currentWorkspaceId
        ? 'unavailable'
        : currentWorkspaceQuery.isLoading
        ? 'loading'
        : currentWorkspaceQuery.data?.workspaceType === 'shared'
        ? 'available'
        : currentWorkspaceQuery.data?.workspaceType === 'personal'
        ? 'personal'
        : 'unavailable'

    useEffect(() => {
        if (!widgetSelection && !payload.parents.some(({ key }) => key === selectedRelationParentKey)) {
            setLocalRelationParentKey(firstRelationParentKey)
        }
    }, [firstRelationParentKey, payload, selectedRelationParentKey, widgetSelection])

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
    const relationLayoutAvailable = Boolean(details?.runtimeLayoutTarget)
    const canReorder =
        details?.runtimeAccessMode !== 'public' &&
        details?.permissions?.editContent === true &&
        relationLayoutAvailable &&
        Boolean(details?.relationRowReorder)
    return (
        <Stack spacing={2} data-testid='runtime-relation-builder' sx={{ minWidth: 0, maxWidth: '100%' }}>
            {payload.parents.length > 1 ? (
                <Tabs
                    value={selectedParent.key}
                    onChange={(_, value: string) => {
                        if (widgetSelection) widgetSelection.setRelationParent(instanceKey, value)
                        else setLocalRelationParentKey(value)
                    }}
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
                    const rowLinkFieldIndex = panelConfig.rowLink
                        ? (panelConfig.displayFields ?? []).findIndex(
                              ({ fieldCodename }) => fieldCodename.toLowerCase() === panelConfig.rowLink?.fieldCodename.toLowerCase()
                          )
                        : -1
                    const rowLinkDisplayKey = rowLinkFieldIndex >= 0 ? `display${rowLinkFieldIndex + 1}` : null
                    const rowCountWarningMessage =
                        panelConfig.rowCountWarning && rows.length >= panelConfig.rowCountWarning.threshold
                            ? readLocalizedWidgetText(panelConfig.rowCountWarning.message, details?.locale)?.trim()
                            : undefined
                    const panelReorderingEnabled = (panelConfig.enableRowReordering ?? parsedConfig.data.enableRowReordering) === true
                    const relationScope = details?.runtimeLayoutTarget
                        ? {
                              fieldCodename: panel.parentFieldCodename,
                              parentRecordId: selectedParent.target.recordHandle,
                              layoutTarget: details.runtimeLayoutTarget
                          }
                        : null
                    const guestLinkWorkspaceMessage =
                        guestLinkWorkspaceStatus === 'personal'
                            ? t(
                                  'relationBuilder.sharedWorkspaceRequired',
                                  'Guest links are available from a shared workspace. Open Workspaces, create a shared workspace, then copy the link there.'
                              )
                            : guestLinkWorkspaceStatus === 'loading'
                            ? t('relationBuilder.workspaceChecking', 'Checking workspace access for guest links…')
                            : t(
                                  'relationBuilder.workspaceUnavailable',
                                  'Guest links are unavailable because the current workspace could not be verified.'
                              )
                    const guestLinkWorkspaceBlocked = Boolean(panelConfig.rowLink && guestLinkWorkspaceStatus !== 'available')
                    const relationCreateAccess = relationScope
                        ? guestLinkWorkspaceBlocked
                            ? { disabled: true, disabledReason: guestLinkWorkspaceMessage }
                            : createAccess
                        : {
                              disabled: true,
                              disabledReason: t(
                                  'app.relationLayoutUnavailable',
                                  'Related content is unavailable. Reload the application and try again.'
                              )
                          }
                    const reorderRows = (event: { active: { id: string }; over?: { id: string } | null }) => {
                        if (!canReorder || !relationScope || !details?.relationRowReorder || !event.over) return
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
                            layoutTarget: relationScope.layoutTarget,
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
                    const createReasonId = `${createReasonIdPrefix}-create-disabled-${panel.slotKey}`
                    const listRows = rows.map((row) => ({
                        id: row.key,
                        name: row.label,
                        target: row.target,
                        displayValues: new Map((row.cells ?? []).map(({ key, value }) => [key, value] as const)),
                        applicationUrl: panelConfig.rowLink
                            ? guestLinkWorkspaceStatus === 'available'
                                ? resolveApplicationPath(
                                      panelConfig.rowLink.pathTemplate,
                                      details?.applicationId,
                                      rowLinkDisplayKey ? row.cells?.find(({ key }) => key === rowLinkDisplayKey)?.value : undefined,
                                      details?.workspacesEnabled ? details.currentWorkspaceId : null
                                  )
                                : null
                            : null
                    }))
                    const customColumns = [
                        {
                            id: 'name',
                            label: t('runtime.table.name', 'Name'),
                            render: (row: (typeof listRows)[number]) => row.name
                        },
                        ...(panel.displayColumns ?? [])
                            .filter(({ key }) => key !== rowLinkDisplayKey)
                            .map(({ key, label }) => ({
                                id: key,
                                label,
                                render: (row: (typeof listRows)[number]) => row.displayValues.get(key) ?? ''
                            })),
                        ...(panelConfig.rowLink
                            ? [
                                  {
                                      id: 'application-link',
                                      label:
                                          readLocalizedWidgetText(panelConfig.rowLink.label, details?.locale)?.trim() ||
                                          t('relationBuilder.guestLink', 'Guest link'),
                                      width: 460,
                                      render: (row: (typeof listRows)[number]) =>
                                          guestLinkWorkspaceStatus === 'personal' ? (
                                              <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                                                  {t('relationBuilder.sharedWorkspaceOnly', 'Available in a shared workspace')}
                                              </Typography>
                                          ) : row.applicationUrl ? (
                                              <Stack
                                                  direction={{ xs: 'column', sm: 'row' }}
                                                  spacing={1}
                                                  sx={{ minWidth: 0, alignItems: { xs: 'flex-start', sm: 'center' } }}
                                              >
                                                  <Link
                                                      href={row.applicationUrl}
                                                      target='_blank'
                                                      rel='noopener noreferrer'
                                                      underline='hover'
                                                      sx={{ minWidth: 0, overflowWrap: 'anywhere', flex: 1 }}
                                                  >
                                                      {row.applicationUrl}
                                                  </Link>
                                                  <Button
                                                      type='button'
                                                      variant='outlined'
                                                      size='small'
                                                      startIcon={<ContentCopyRoundedIcon fontSize='small' />}
                                                      aria-label={t('relationBuilder.copyLinkFor', 'Copy guest link for {{name}}', {
                                                          name: row.name
                                                      })}
                                                      onClick={async () => {
                                                          try {
                                                              await navigator.clipboard.writeText(row.applicationUrl as string)
                                                              setCopyFeedback('copied')
                                                          } catch {
                                                              setCopyFeedback('failed')
                                                          }
                                                      }}
                                                  >
                                                      {t('relationBuilder.copyLink', 'Copy link')}
                                                  </Button>
                                              </Stack>
                                          ) : (
                                              <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                                                  {t('relationBuilder.linkUnavailable', 'Guest link unavailable')}
                                              </Typography>
                                          )
                                  }
                              ]
                            : [])
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
                                        disabled={relationCreateAccess.disabled}
                                        aria-describedby={relationCreateAccess.disabled ? createReasonId : undefined}
                                        onClick={() => {
                                            if (relationCreateAccess.disabled || !relationScope || !details?.onOpenCreateTarget) return
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
                                {panelConfig.rowLink && guestLinkWorkspaceStatus !== 'available' ? (
                                    <Alert severity={guestLinkWorkspaceStatus === 'personal' ? 'warning' : 'info'} role='status'>
                                        {guestLinkWorkspaceMessage}
                                    </Alert>
                                ) : null}
                                {relationCreateAccess.disabled && relationCreateAccess.disabledReason ? (
                                    <Typography id={createReasonId} role='status' variant='caption' sx={{ color: 'text.secondary' }}>
                                        {relationCreateAccess.disabledReason}
                                    </Typography>
                                ) : null}
                                {rowCountWarningMessage ? (
                                    <Alert severity='warning' role='status'>
                                        {rowCountWarningMessage}
                                    </Alert>
                                ) : null}
                                {copyFeedback ? (
                                    <Alert severity={copyFeedback === 'copied' ? 'success' : 'error'} role='status'>
                                        {copyFeedback === 'copied'
                                            ? t('relationBuilder.linkCopied', 'Guest link copied to clipboard.')
                                            : t(
                                                  'relationBuilder.linkCopyFailed',
                                                  'Could not copy the guest link. Copy the displayed URL manually.'
                                              )}
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
                                        rowActions.showRowActions && relationScope
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
