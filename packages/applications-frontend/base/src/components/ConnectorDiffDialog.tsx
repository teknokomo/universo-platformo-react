/**
 * Universo Platformo | ConnectorDiffDialog Component
 *
 * Dialog for showing schema diff and confirming sync for a connector.
 * Adapted from metahubs PublicationDiffDialog.
 */

import { useEffect, useState } from 'react'
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    CircularProgress,
    Alert,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Divider,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Select,
    Radio,
    RadioGroup,
    Checkbox
} from '@mui/material'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useTranslation } from 'react-i18next'
import type {
    ApplicationLayoutChange,
    ApplicationLayoutSyncPolicy,
    ApplicationLayoutSyncResolution,
    VersionedLocalizedContent
} from '@universo/types'
import { useApplicationDiff } from '../hooks/useConnectorSync'
import type { Connector, SchemaStatus } from '../types'
import { getVLCString } from '../types'

/**
 * Format a cell value for predefined elements preview.
 * Handles: VLC objects, arrays (TABLE child rows), plain values.
 */
function formatPreviewCellValue(
    value: unknown,
    uiLocale: string,
    t: (key: string, fallback: string, params?: Record<string, unknown>) => string
): string {
    if (value === null || value === undefined) return ''
    if (Array.isArray(value)) {
        return value.length > 0 ? t('connectors.diffDialog.tableRowCount', '{{count}} rows', { count: value.length }) : ''
    }
    if (typeof value === 'object' && 'locales' in (value as Record<string, unknown>)) {
        const localizedValue = value as VersionedLocalizedContent<string>
        return getVLCString(localizedValue, uiLocale) || getVLCString(localizedValue, 'en') || ''
    }
    if (typeof value === 'object') {
        return JSON.stringify(value)
    }
    return String(value)
}

type PreviewTableField = {
    id: string
    codename: string
    dataType: string
    isRequired: boolean
    parentAttributeId?: string | null
}

function resolvePreviewChildFieldValue(
    rowData: Record<string, unknown> | undefined,
    field: PreviewTableField,
    fieldsById: Map<string, PreviewTableField>,
    uiLocale: string,
    t: (key: string, fallback: string, params?: Record<string, unknown>) => string
): string {
    const directValue = rowData?.[field.codename]
    if (directValue !== null && directValue !== undefined) {
        return formatPreviewCellValue(directValue, uiLocale, t)
    }

    if (!field.parentAttributeId) {
        return ''
    }

    const parentField = fieldsById.get(field.parentAttributeId)
    if (!parentField) {
        return ''
    }

    const parentValue = rowData?.[parentField.codename]
    if (!Array.isArray(parentValue)) {
        return ''
    }

    return parentValue
        .map((childRow) => {
            if (!childRow || typeof childRow !== 'object') {
                return ''
            }

            return formatPreviewCellValue((childRow as Record<string, unknown>)[field.codename], uiLocale, t)
        })
        .filter((value) => value.length > 0)
        .join(', ')
}

// ============================================================================
// Types
// ============================================================================

export interface ConnectorDiffDialogProps {
    open: boolean
    connector?: Connector | null
    applicationId: string
    onClose: () => void
    onSync: (
        confirmDestructive: boolean,
        layoutResolutionPolicy?: ApplicationLayoutSyncPolicy,
        schemaOptions?: {
            workspaceModeRequested?: 'enabled' | 'not_requested' | null
            acknowledgeIrreversibleWorkspaceEnablement?: boolean
        }
    ) => Promise<void>
    isSyncing: boolean
    uiLocale: string
    schemaStatus?: SchemaStatus
}

type StructuredDiffChange = {
    type: string
    description: string
    entityCodename?: string
    fieldCodename?: string
    tableName?: string
    dataType?: string
    oldValue?: unknown
    newValue?: unknown
}

const BULK_LAYOUT_RESOLUTION_OPTIONS: ApplicationLayoutSyncResolution[] = ['keep_local', 'copy_source_as_application', 'skip_source']
const ITEM_LAYOUT_RESOLUTION_OPTIONS: ApplicationLayoutSyncResolution[] = [
    'keep_local',
    'copy_source_as_application',
    'skip_source',
    'overwrite_local'
]

const requiresExplicitLayoutResolution = (change: ApplicationLayoutChange): boolean =>
    change.type === 'LAYOUT_CONFLICT' || change.type === 'LAYOUT_DEFAULT_COLLISION' || change.type === 'LAYOUT_SOURCE_REMOVED'

// ============================================================================
// Component
// ============================================================================

export function ConnectorDiffDialog({
    open,
    connector,
    applicationId,
    onClose,
    onSync,
    isSyncing,
    uiLocale,
    schemaStatus
}: ConnectorDiffDialogProps) {
    const { t } = useTranslation('applications')
    const [bulkLayoutResolution, setBulkLayoutResolution] = useState<ApplicationLayoutSyncResolution | ''>('')
    const [layoutOverrides, setLayoutOverrides] = useState<Record<string, ApplicationLayoutSyncResolution>>({})
    const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null)
    const [workspaceModeRequested, setWorkspaceModeRequested] = useState<'enabled' | 'not_requested' | null>(null)
    const [workspaceAcknowledged, setWorkspaceAcknowledged] = useState(false)
    const formatChange = (change: string) => {
        if (change === 'ui.layout.update') {
            return t('connectors.diffDialog.uiLayoutUpdate', 'UI layout settings will be updated')
        }
        if (change === 'ui.layouts.update') {
            return t('connectors.diffDialog.uiLayoutsUpdate', 'UI layouts list will be updated')
        }
        if (change === 'ui.layout.zones.update') {
            return t('connectors.diffDialog.uiLayoutZonesUpdate', 'UI layout zone widgets will be updated')
        }
        if (change === 'schema.metadata.update') {
            return t('connectors.diffDialog.systemMetadataUpdate', 'System metadata will be updated')
        }
        return change
    }

    const formatSummary = (summaryKey?: string, summaryParams?: Record<string, unknown>, fallback?: string) => {
        if (summaryKey === 'schema.create.summary') {
            const tablesCount = typeof summaryParams?.tablesCount === 'number' ? summaryParams.tablesCount : 0
            return t('connectors.diffDialog.summary.create', 'Create {{count}} tables in new schema', { count: tablesCount })
        }
        if (summaryKey === 'ui.layout.changed') {
            return t('connectors.diffDialog.summary.uiChanged', 'UI settings have changed')
        }
        if (summaryKey === 'schema.metadata.changed') {
            return t('connectors.diffDialog.summary.metadataChanged', 'System metadata will be updated')
        }
        if (summaryKey === 'schema.upToDate') {
            return t('connectors.diffDialog.summary.upToDate', 'Schema is already up to date')
        }
        if (!summaryKey) {
            const additiveCount = diffData?.diff?.additive?.length ?? 0
            const destructiveCount = diffData?.diff?.destructive?.length ?? 0
            if (additiveCount > 0 || destructiveCount > 0) {
                return t('connectors.diffDialog.summary.changeCounts', '{{additive}}, {{destructive}}', {
                    additive: t('connectors.diffDialog.summary.additiveChangesCount', '{{count}} additive changes', {
                        count: additiveCount
                    }),
                    destructive: t('connectors.diffDialog.summary.destructiveChangesCount', '{{count}} destructive changes', {
                        count: destructiveCount
                    })
                })
            }
        }
        return fallback || ''
    }

    const formatDataType = (dataType: string) => {
        const normalized = String(dataType).toUpperCase()
        if (normalized === 'BOOLEAN') return t('connectors.diffDialog.dataTypes.boolean', 'Boolean')
        if (normalized === 'STRING') return t('connectors.diffDialog.dataTypes.string', 'String')
        if (normalized === 'NUMBER') return t('connectors.diffDialog.dataTypes.number', 'Number')
        if (normalized === 'JSON') return t('connectors.diffDialog.dataTypes.json', 'JSON')
        if (normalized === 'TABLE') return t('connectors.diffDialog.dataTypes.table', 'Table')
        if (normalized === 'REF') return t('connectors.diffDialog.dataTypes.ref', 'Reference')
        return dataType
    }

    const formatStructuredChange = (change: StructuredDiffChange) => {
        const type = String(change.type).toUpperCase()
        const table = change.entityCodename ?? change.tableName ?? '-'
        const field = change.fieldCodename ?? '-'
        const dataType = change.dataType ? formatDataType(change.dataType) : undefined

        switch (type) {
            case 'ADD_COLUMN':
                return t('connectors.diffDialog.structured.addColumn', 'Add column "{{field}}" ({{type}}) to "{{table}}"', {
                    field,
                    type: dataType ?? '-',
                    table
                })
            case 'DROP_COLUMN':
                return t('connectors.diffDialog.structured.dropColumn', 'Drop column "{{field}}" from "{{table}}" (data loss)', {
                    field,
                    table
                })
            case 'ADD_TABLE':
            case 'CREATE_TABLE':
                return t('connectors.diffDialog.structured.addTable', 'Create table "{{table}}"', { table })
            case 'DROP_TABLE':
                return t('connectors.diffDialog.structured.dropTable', 'Drop table "{{table}}" (data loss)', { table })
            case 'ALTER_COLUMN':
                return t('connectors.diffDialog.structured.alterColumn', 'Change column "{{field}}" in "{{table}}" ({{from}} -> {{to}})', {
                    field,
                    table,
                    from: String(change.oldValue ?? '?'),
                    to: String(change.newValue ?? '?')
                })
            case 'ADD_FK':
                return t('connectors.diffDialog.structured.addFk', 'Add reference constraint for "{{field}}" in "{{table}}"', {
                    field,
                    table
                })
            case 'DROP_FK':
                return t('connectors.diffDialog.structured.dropFk', 'Drop reference constraint for "{{field}}" in "{{table}}"', {
                    field,
                    table
                })
            case 'MODIFY_FIELD':
                return t('connectors.diffDialog.structured.modifyField', 'Update metadata for "{{field}}" in "{{table}}"', {
                    field,
                    table
                })
            case 'UI_LAYOUT_UPDATE':
                return t('connectors.diffDialog.uiLayoutUpdate', 'UI layout settings will be updated')
            case 'UI_LAYOUTS_UPDATE':
                return t('connectors.diffDialog.uiLayoutsUpdate', 'UI layouts list will be updated')
            case 'UI_LAYOUT_ZONES_UPDATE':
                return t('connectors.diffDialog.uiLayoutZonesUpdate', 'UI layout zone widgets will be updated')
            case 'SYSTEM_METADATA_UPDATE':
                return t('connectors.diffDialog.systemMetadataUpdate', 'System metadata will be updated')
            default:
                return formatChange(change.description)
        }
    }

    // Fetch diff when dialog opens - use applicationId
    const {
        data: diffData,
        isLoading: isDiffLoading,
        isFetching: isDiffFetching,
        error: diffError,
        refetch: refetchDiff
    } = useApplicationDiff(applicationId, {
        enabled: open && Boolean(applicationId)
    })

    const isDiffPending = isDiffLoading || isDiffFetching

    const layoutChanges = (diffData?.diff?.details?.layoutChanges ?? []) as ApplicationLayoutChange[]
    const requiredLayoutChanges = layoutChanges.filter(requiresExplicitLayoutResolution)
    const hasStructuredLayoutChanges = layoutChanges.length > 0

    const getLayoutChangeTitle = (change: ApplicationLayoutChange) => {
        const localizedTitle = change.title ?? {}
        const localeValue = localizedTitle[uiLocale]
        const englishValue = localizedTitle.en
        if (typeof localeValue === 'string' && localeValue.length > 0) return localeValue
        if (typeof englishValue === 'string' && englishValue.length > 0) return englishValue
        return change.sourceLayoutId ?? change.applicationLayoutId ?? change.scope
    }

    const formatLayoutChangeType = (change: ApplicationLayoutChange) => {
        if (change.type === 'LAYOUT_CONFLICT') {
            return t('connectors.diffDialog.layoutChangeTypes.conflict', 'Local and source changes diverged')
        }
        if (change.type === 'LAYOUT_DEFAULT_COLLISION') {
            return t('connectors.diffDialog.layoutChangeTypes.defaultCollision', 'Default layout collision')
        }
        if (change.type === 'LAYOUT_SOURCE_REMOVED') {
            return t('connectors.diffDialog.layoutChangeTypes.sourceRemoved', 'Source layout was removed')
        }
        if (change.type === 'LAYOUT_WARNING') {
            return t('connectors.diffDialog.layoutChangeTypes.warning', 'Layout requires review')
        }
        return t('connectors.diffDialog.layoutChangeTypes.sourceUpdated', 'Source layout changed')
    }

    const formatLayoutResolution = (resolution: ApplicationLayoutSyncResolution) => {
        if (resolution === 'keep_local') {
            return t('connectors.diffDialog.layoutResolution.keepLocal', 'Keep the application layout')
        }
        if (resolution === 'copy_source_as_application') {
            return t('connectors.diffDialog.layoutResolution.copySourceAsApplication', 'Copy metahub source as a new application layout')
        }
        if (resolution === 'skip_source') {
            return t('connectors.diffDialog.layoutResolution.skipSource', 'Skip this metahub layout update for now')
        }
        return t('connectors.diffDialog.layoutResolution.overwriteLocal', 'Replace the application layout with metahub source')
    }

    const groupedLayoutChanges = layoutChanges.reduce<Record<string, ApplicationLayoutChange[]>>((accumulator, change) => {
        const scopeKey = change.scope || 'global'
        accumulator[scopeKey] = accumulator[scopeKey] ?? []
        accumulator[scopeKey].push(change)
        return accumulator
    }, {})

    const hasUnresolvedRequiredLayoutChanges = requiredLayoutChanges.some((change) => {
        const sourceLayoutId = change.sourceLayoutId ?? ''
        return !layoutOverrides[sourceLayoutId] && !bulkLayoutResolution
    })

    const buildLayoutResolutionPolicy = (): ApplicationLayoutSyncPolicy | undefined => {
        if (!hasStructuredLayoutChanges) {
            return undefined
        }

        const policy: ApplicationLayoutSyncPolicy = {}
        if (bulkLayoutResolution) {
            policy.default = bulkLayoutResolution
        }
        if (Object.keys(layoutOverrides).length > 0) {
            policy.bySourceLayoutId = layoutOverrides
        }
        return Object.keys(policy).length > 0 ? policy : undefined
    }

    // Refetch diff when dialog opens
    useEffect(() => {
        if (open && applicationId) {
            refetchDiff()
        }
    }, [open, applicationId, refetchDiff])

    useEffect(() => {
        if (!open) {
            setBulkLayoutResolution('')
            setLayoutOverrides({})
            setSyncErrorMessage(null)
            setWorkspaceModeRequested(null)
            setWorkspaceAcknowledged(false)
        }
    }, [open])

    useEffect(() => {
        if (!open || !diffData) {
            return
        }

        if (diffData.workspaceMode?.policy === 'required') {
            setWorkspaceModeRequested('enabled')
            return
        }
        setWorkspaceModeRequested(diffData.workspaceMode?.requested ?? diffData.schemaOptions?.workspaceModeRequested ?? 'not_requested')
    }, [diffData, open])

    const hasDestructiveChanges = (diffData?.diff?.destructive?.length ?? 0) > 0
    const hasAdditiveChanges = (diffData?.diff?.additive?.length ?? 0) > 0
    const hasLayoutChanges =
        hasStructuredLayoutChanges ||
        (diffData?.diff?.additive ?? []).some((change) =>
            ['ui.layout.update', 'ui.layouts.update', 'ui.layout.zones.update'].includes(change)
        )
    const needsCreate = diffData?.schemaExists === false || schemaStatus === 'draft'
    const hasChanges = needsCreate || diffData?.diff?.hasChanges || hasDestructiveChanges || hasAdditiveChanges

    const runtimeWorkspacePolicy = diffData?.workspaceMode?.policy ?? diffData?.runtimePolicy?.workspaceMode ?? 'optional'
    const workspaceCanChoose = diffData?.workspaceMode?.canChoose === true
    const workspaceEffectiveEnabled =
        runtimeWorkspacePolicy === 'required' ||
        diffData?.workspaceMode?.applicationWorkspacesEnabled === true ||
        (runtimeWorkspacePolicy === 'optional' && workspaceModeRequested === 'enabled')
    const workspaceRequiresAcknowledgement = diffData?.workspaceMode?.applicationWorkspacesEnabled !== true && workspaceEffectiveEnabled
    const workspaceSyncDisabled = workspaceRequiresAcknowledgement && !workspaceAcknowledged

    const hasWorkspaceMetadata = Boolean(diffData?.workspaceMode || diffData?.runtimePolicy || diffData?.schemaOptions)
    const buildSchemaOptions = () => {
        if (!hasWorkspaceMetadata) {
            return undefined
        }

        return {
            workspaceModeRequested: runtimeWorkspacePolicy === 'required' ? 'enabled' : workspaceModeRequested,
            acknowledgeIrreversibleWorkspaceEnablement: workspaceRequiresAcknowledgement ? workspaceAcknowledged : undefined
        }
    }

    const handleSync = async (confirmDestructive: boolean) => {
        setSyncErrorMessage(null)
        try {
            const layoutResolutionPolicy = buildLayoutResolutionPolicy()
            const schemaOptions = buildSchemaOptions()
            if (schemaOptions) {
                await onSync(confirmDestructive, layoutResolutionPolicy, schemaOptions)
            } else {
                await onSync(confirmDestructive, layoutResolutionPolicy)
            }
        } catch (error) {
            const responseData = (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data
            const errorCode = responseData?.error
            if (errorCode === 'APPLICATION_LAYOUT_STALE_DIFF' || errorCode === 'APPLICATION_LAYOUT_RESOLUTION_REQUIRED') {
                setBulkLayoutResolution('')
                setLayoutOverrides({})
                setSyncErrorMessage(
                    responseData?.message ??
                        t(
                            'connectors.diffDialog.layoutResolution.stale',
                            'The layout diff changed. Review the refreshed conflict list and choose resolutions again.'
                        )
                )
                await refetchDiff()
                return
            }

            setSyncErrorMessage(responseData?.message ?? t('errors.connectionFailed', 'Failed to load schema changes'))
        }
    }

    const connectorName = connector ? getVLCString(connector.name, uiLocale) : ''
    const createTables = diffData?.diff?.details?.create?.tables ?? []
    const additiveStructured = (diffData?.diff?.details?.changes?.additive ?? []) as StructuredDiffChange[]
    const destructiveStructured = (diffData?.diff?.details?.changes?.destructive ?? []) as StructuredDiffChange[]
    const hasCreateTableDetails = createTables.length > 0
    const workspaceModeSection =
        diffData && !diffError ? (
            <Box sx={{ mb: 2 }}>
                {runtimeWorkspacePolicy === 'required' ? (
                    <Alert severity='info'>
                        {t('connectors.diffDialog.workspace.required', 'This publication version requires application workspaces.')}
                    </Alert>
                ) : workspaceCanChoose ? (
                    <FormControl component='fieldset' fullWidth>
                        <Typography variant='subtitle2' sx={{ mb: 1 }}>
                            {t('connectors.diffDialog.workspace.title', 'Workspaces')}
                        </Typography>
                        <RadioGroup
                            value={workspaceModeRequested ?? 'not_requested'}
                            onChange={(event) => setWorkspaceModeRequested(event.target.value === 'enabled' ? 'enabled' : 'not_requested')}
                        >
                            <FormControlLabel
                                value='not_requested'
                                control={<Radio />}
                                label={t('connectors.diffDialog.workspace.withoutWorkspaces', 'Do not create workspaces')}
                                disabled={isSyncing}
                            />
                            <FormControlLabel
                                value='enabled'
                                control={<Radio />}
                                label={t('connectors.diffDialog.workspace.withWorkspaces', 'Create application workspaces')}
                                disabled={isSyncing}
                            />
                        </RadioGroup>
                    </FormControl>
                ) : null}
                {workspaceRequiresAcknowledgement ? (
                    <FormControlLabel
                        sx={{ mt: 1 }}
                        control={
                            <Checkbox
                                checked={workspaceAcknowledged}
                                onChange={(event) => setWorkspaceAcknowledged(event.target.checked)}
                                disabled={isSyncing}
                            />
                        }
                        label={t(
                            'connectors.diffDialog.workspace.acknowledge',
                            'I understand that workspaces cannot be turned off after they are enabled for this application.'
                        )}
                    />
                ) : null}
            </Box>
        ) : null

    return (
        <Dialog open={open} onClose={onClose} maxWidth='md' fullWidth aria-labelledby='connector-diff-dialog-title'>
            <DialogTitle id='connector-diff-dialog-title' component='div'>
                {t('connectors.diffDialog.title', 'Schema Changes')}
                {connectorName && (
                    <Typography component='div' variant='subtitle2' color='text.secondary'>
                        {connectorName}
                    </Typography>
                )}
            </DialogTitle>
            <DialogContent dividers>
                {isDiffPending ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : diffError ? (
                    <Alert severity='error'>{t('errors.connectionFailed', 'Failed to load schema changes')}</Alert>
                ) : needsCreate ? (
                    <Box>
                        {workspaceModeSection}
                        {/* Schema creation header */}
                        <Box sx={{ textAlign: 'center', py: 2, mb: 2 }}>
                            <AddCircleOutlineIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                            <Typography variant='h6'>{t('connectors.diffDialog.schemaWillBeCreated', 'Schema will be created')}</Typography>
                            <Typography variant='body2' color='text.secondary'>
                                {formatSummary(diffData?.diff?.summaryKey, diffData?.diff?.summaryParams, diffData?.diff?.summary) ||
                                    t(
                                        'connectors.diffDialog.schemaNotExists',
                                        'Schema does not exist yet. It will be created on first sync.'
                                    )}
                            </Typography>
                        </Box>

                        {/* Show what will be created (expandable details) */}
                        {createTables.length > 0 ? (
                            <Box sx={{ mb: 2 }}>
                                <Typography variant='subtitle1' sx={{ fontWeight: 600, mb: 1, color: 'success.main' }}>
                                    {t('connectors.diffDialog.tablesWillBeCreated', 'Tables to be created')}
                                </Typography>

                                {createTables.map((table) => {
                                    const fields = (table.fields ?? []) as PreviewTableField[]
                                    const fieldsById = new Map(fields.map((field) => [field.id, field]))
                                    const preview = (table.recordsPreview ?? [])
                                        .slice()
                                        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id))

                                    return (
                                        <Accordion
                                            key={table.id}
                                            disableGutters
                                            elevation={0}
                                            sx={{ border: '1px solid', borderColor: 'divider', mb: 1 }}
                                        >
                                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                                <Typography variant='subtitle2' sx={{ fontFamily: 'monospace' }}>
                                                    {table.codename}
                                                </Typography>
                                                <Typography variant='body2' color='text.secondary' sx={{ ml: 2 }}>
                                                    {t('connectors.diffDialog.tableMeta', '{{fields}}, {{elements}}', {
                                                        fields: t('connectors.diffDialog.fieldsCount', '{{count}} fields', {
                                                            count: fields.length
                                                        }),
                                                        elements: t('connectors.diffDialog.elementsCount', '{{count}} elements', {
                                                            count: table.recordsCount ?? 0
                                                        })
                                                    })}
                                                </Typography>
                                            </AccordionSummary>
                                            <AccordionDetails>
                                                <Typography variant='subtitle2' sx={{ mb: 1 }}>
                                                    {t('connectors.diffDialog.fields', 'Fields')}
                                                </Typography>
                                                <Table size='small'>
                                                    <TableHead>
                                                        <TableRow>
                                                            <TableCell>{t('connectors.diffDialog.columns.codename', 'Codename')}</TableCell>
                                                            <TableCell>{t('connectors.diffDialog.columns.type', 'Type')}</TableCell>
                                                            <TableCell>{t('connectors.diffDialog.columns.required', 'Required')}</TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {fields.map((f) => (
                                                            <TableRow key={f.id}>
                                                                <TableCell sx={{ fontFamily: 'monospace' }}>{f.codename}</TableCell>
                                                                <TableCell>{formatDataType(f.dataType)}</TableCell>
                                                                <TableCell>
                                                                    {f.isRequired ? t('common.yes', 'Yes') : t('common.no', 'No')}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>

                                                {preview.length > 0 && (
                                                    <Box sx={{ mt: 2 }}>
                                                        <Typography variant='subtitle2' sx={{ mb: 1 }}>
                                                            {t('connectors.diffDialog.records', 'Predefined elements')}
                                                        </Typography>
                                                        <Table size='small'>
                                                            <TableHead>
                                                                <TableRow>
                                                                    {fields.map((f) => (
                                                                        <TableCell key={f.id} sx={{ fontFamily: 'monospace' }}>
                                                                            {f.codename}
                                                                        </TableCell>
                                                                    ))}
                                                                </TableRow>
                                                            </TableHead>
                                                            <TableBody>
                                                                {preview.map((row) => (
                                                                    <TableRow key={row.id}>
                                                                        {fields.map((f) => {
                                                                            const display = resolvePreviewChildFieldValue(
                                                                                row.data,
                                                                                f,
                                                                                fieldsById,
                                                                                uiLocale,
                                                                                t
                                                                            )
                                                                            return <TableCell key={f.id}>{display}</TableCell>
                                                                        })}
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </Box>
                                                )}
                                            </AccordionDetails>
                                        </Accordion>
                                    )
                                })}
                            </Box>
                        ) : hasAdditiveChanges ? (
                            <Box sx={{ mb: 2 }}>
                                <Typography variant='subtitle1' sx={{ fontWeight: 600, mb: 1, color: 'success.main' }}>
                                    {t('connectors.diffDialog.tablesWillBeCreated', 'Tables to be created')}
                                </Typography>
                                <List dense>
                                    {(additiveStructured.length > 0
                                        ? additiveStructured
                                        : (diffData?.diff?.additive ?? []).map((change) => ({
                                              type: 'RAW',
                                              description: change
                                          }))
                                    ).map((change, index) => (
                                        <ListItem key={`additive-${index}`}>
                                            <ListItemIcon sx={{ minWidth: 36 }}>
                                                <AddCircleOutlineIcon color='success' />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={formatStructuredChange(change)}
                                                primaryTypographyProps={
                                                    change.type === 'UI_LAYOUT_UPDATE' ||
                                                    change.type === 'UI_LAYOUTS_UPDATE' ||
                                                    change.type === 'SYSTEM_METADATA_UPDATE'
                                                        ? { fontSize: 13 }
                                                        : { fontFamily: 'monospace', fontSize: 13 }
                                                }
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            </Box>
                        ) : null}
                    </Box>
                ) : !hasChanges ? (
                    <Box>
                        {workspaceModeSection}
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <CheckCircleOutlineIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                            <Typography variant='h6'>{t('connectors.diffDialog.noChanges', 'No changes detected')}</Typography>
                            <Typography variant='body2' color='text.secondary'>
                                {t('connectors.diffDialog.schemaUpToDate', 'Schema matches current configuration')}
                            </Typography>
                        </Box>
                    </Box>
                ) : (
                    <Box>
                        {workspaceModeSection}
                        {/* Summary */}
                        {(diffData?.diff?.summaryKey || diffData?.diff?.summary) && (
                            <Alert severity='info' sx={{ mb: 2 }}>
                                {formatSummary(diffData?.diff?.summaryKey, diffData?.diff?.summaryParams, diffData?.diff?.summary)}
                            </Alert>
                        )}

                        {syncErrorMessage && (
                            <Alert severity='warning' sx={{ mb: 2 }}>
                                {syncErrorMessage}
                            </Alert>
                        )}

                        {hasLayoutChanges && (
                            <Alert severity={hasUnresolvedRequiredLayoutChanges ? 'warning' : 'info'} sx={{ mb: 2 }}>
                                <Box sx={{ display: 'grid', gap: 2 }}>
                                    <Box>
                                        <Typography variant='body2' sx={{ fontWeight: 600, mb: 0.5 }}>
                                            {t(
                                                'connectors.diffDialog.layoutConflictWarning',
                                                'Layout changes may conflict with application-side customizations. Choose how metahub layout updates should be handled during sync.'
                                            )}
                                        </Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {hasUnresolvedRequiredLayoutChanges
                                                ? t(
                                                      'connectors.diffDialog.layoutResolution.required',
                                                      'Choose a bulk policy or set explicit per-layout resolutions before sync is enabled.'
                                                  )
                                                : t(
                                                      'connectors.diffDialog.layoutResolution.ready',
                                                      'The current layout conflict policy is complete. Review optional overrides before syncing if needed.'
                                                  )}
                                        </Typography>
                                    </Box>

                                    {requiredLayoutChanges.length > 0 && (
                                        <FormControl size='small' sx={{ maxWidth: 520 }}>
                                            <InputLabel id='connector-layout-resolution-bulk-label'>
                                                {t('connectors.diffDialog.layoutResolution.label', 'Layout update policy')}
                                            </InputLabel>
                                            <Select
                                                id='connector-layout-resolution-bulk'
                                                labelId='connector-layout-resolution-bulk-label'
                                                label={t('connectors.diffDialog.layoutResolution.label', 'Layout update policy')}
                                                value={bulkLayoutResolution}
                                                inputProps={{ 'data-testid': 'connector-layout-resolution-bulk' }}
                                                SelectDisplayProps={{ 'data-testid': 'connector-layout-resolution-bulk-trigger' }}
                                                onChange={(event) =>
                                                    setBulkLayoutResolution(event.target.value as ApplicationLayoutSyncResolution | '')
                                                }
                                            >
                                                <MenuItem value=''>
                                                    {t(
                                                        'connectors.diffDialog.layoutResolution.choosePolicy',
                                                        'Choose a bulk policy for required layout conflicts'
                                                    )}
                                                </MenuItem>
                                                {BULK_LAYOUT_RESOLUTION_OPTIONS.map((resolution) => (
                                                    <MenuItem key={resolution} value={resolution}>
                                                        {formatLayoutResolution(resolution)}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    )}

                                    <Box sx={{ display: 'grid', gap: 1.5 }}>
                                        {Object.entries(groupedLayoutChanges).map(([scope, changes]) => (
                                            <Box
                                                key={scope}
                                                sx={{
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    borderRadius: 1.5,
                                                    p: 1.5,
                                                    backgroundColor: 'background.paper'
                                                }}
                                            >
                                                <Typography variant='subtitle2' sx={{ mb: 1 }}>
                                                    {t('connectors.diffDialog.layoutScope', 'Layout scope: {{scope}}', { scope })}
                                                </Typography>
                                                <Box sx={{ display: 'grid', gap: 1.5 }}>
                                                    {changes.map((change, index) => {
                                                        const sourceLayoutId = change.sourceLayoutId ?? ''
                                                        const selectedResolution = layoutOverrides[sourceLayoutId] ?? ''
                                                        const requiresResolution = requiresExplicitLayoutResolution(change)
                                                        return (
                                                            <Box
                                                                key={`${scope}-${sourceLayoutId || index}`}
                                                                sx={{
                                                                    border: '1px solid',
                                                                    borderColor: 'divider',
                                                                    borderRadius: 1,
                                                                    p: 1.25
                                                                }}
                                                            >
                                                                <Typography variant='body2' sx={{ fontWeight: 600 }}>
                                                                    {getLayoutChangeTitle(change)}
                                                                </Typography>
                                                                <Typography
                                                                    variant='caption'
                                                                    color='text.secondary'
                                                                    sx={{ display: 'block', mb: 0.75 }}
                                                                >
                                                                    {formatLayoutChangeType(change)}
                                                                </Typography>
                                                                {change.message && (
                                                                    <Typography variant='body2' sx={{ mb: 1 }}>
                                                                        {change.message}
                                                                    </Typography>
                                                                )}
                                                                {sourceLayoutId && (
                                                                    <FormControl size='small' sx={{ minWidth: 320, maxWidth: 520 }}>
                                                                        <InputLabel
                                                                            id={`connector-layout-resolution-${sourceLayoutId}-label`}
                                                                        >
                                                                            {t(
                                                                                'connectors.diffDialog.layoutResolution.perLayoutLabel',
                                                                                'Resolution for this layout'
                                                                            )}
                                                                        </InputLabel>
                                                                        <Select
                                                                            id={`connector-layout-resolution-${sourceLayoutId}`}
                                                                            labelId={`connector-layout-resolution-${sourceLayoutId}-label`}
                                                                            label={t(
                                                                                'connectors.diffDialog.layoutResolution.perLayoutLabel',
                                                                                'Resolution for this layout'
                                                                            )}
                                                                            value={selectedResolution}
                                                                            inputProps={{
                                                                                'data-testid': `connector-layout-resolution-${sourceLayoutId}`
                                                                            }}
                                                                            SelectDisplayProps={{
                                                                                'data-testid': `connector-layout-resolution-${sourceLayoutId}-trigger`
                                                                            }}
                                                                            onChange={(event) => {
                                                                                const nextValue = event.target.value as
                                                                                    | ApplicationLayoutSyncResolution
                                                                                    | ''
                                                                                setLayoutOverrides((current) => {
                                                                                    const next = { ...current }
                                                                                    if (!nextValue) {
                                                                                        delete next[sourceLayoutId]
                                                                                        return next
                                                                                    }
                                                                                    next[sourceLayoutId] = nextValue
                                                                                    return next
                                                                                })
                                                                            }}
                                                                        >
                                                                            <MenuItem value=''>
                                                                                {requiresResolution
                                                                                    ? t(
                                                                                          'connectors.diffDialog.layoutResolution.useBulkPolicy',
                                                                                          'Use the selected bulk policy'
                                                                                      )
                                                                                    : t(
                                                                                          'connectors.diffDialog.layoutResolution.noOverride',
                                                                                          'No per-layout override'
                                                                                      )}
                                                                            </MenuItem>
                                                                            {ITEM_LAYOUT_RESOLUTION_OPTIONS.map((resolution) => (
                                                                                <MenuItem key={resolution} value={resolution}>
                                                                                    {formatLayoutResolution(resolution)}
                                                                                </MenuItem>
                                                                            ))}
                                                                        </Select>
                                                                    </FormControl>
                                                                )}
                                                            </Box>
                                                        )
                                                    })}
                                                </Box>
                                            </Box>
                                        ))}
                                    </Box>
                                </Box>
                            </Alert>
                        )}

                        {/* Additive Changes */}
                        {hasAdditiveChanges && (
                            <Box sx={{ mb: 3 }}>
                                <Typography variant='subtitle1' sx={{ fontWeight: 600, mb: 1, color: 'success.main' }}>
                                    {t('connectors.diffDialog.additiveChanges', 'Safe Changes (will be applied)')}
                                </Typography>
                                {hasCreateTableDetails && (
                                    <Box sx={{ mb: 2 }}>
                                        {createTables.map((table) => {
                                            const fields = (table.fields ?? []) as PreviewTableField[]
                                            const fieldsById = new Map(fields.map((field) => [field.id, field]))
                                            const preview = (table.recordsPreview ?? [])
                                                .slice()
                                                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id))

                                            return (
                                                <Accordion
                                                    key={table.id}
                                                    disableGutters
                                                    elevation={0}
                                                    sx={{ border: '1px solid', borderColor: 'divider', mb: 1 }}
                                                >
                                                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                                        <Typography variant='subtitle2' sx={{ fontFamily: 'monospace' }}>
                                                            {table.codename}
                                                        </Typography>
                                                        <Typography variant='body2' color='text.secondary' sx={{ ml: 2 }}>
                                                            {t('connectors.diffDialog.tableMeta', '{{fields}}, {{elements}}', {
                                                                fields: t('connectors.diffDialog.fieldsCount', '{{count}} fields', {
                                                                    count: fields.length
                                                                }),
                                                                elements: t('connectors.diffDialog.elementsCount', '{{count}} elements', {
                                                                    count: table.recordsCount ?? 0
                                                                })
                                                            })}
                                                        </Typography>
                                                    </AccordionSummary>
                                                    <AccordionDetails>
                                                        <Typography variant='subtitle2' sx={{ mb: 1 }}>
                                                            {t('connectors.diffDialog.fields', 'Fields')}
                                                        </Typography>
                                                        <Table size='small'>
                                                            <TableHead>
                                                                <TableRow>
                                                                    <TableCell>
                                                                        {t('connectors.diffDialog.columns.codename', 'Codename')}
                                                                    </TableCell>
                                                                    <TableCell>{t('connectors.diffDialog.columns.type', 'Type')}</TableCell>
                                                                    <TableCell>
                                                                        {t('connectors.diffDialog.columns.required', 'Required')}
                                                                    </TableCell>
                                                                </TableRow>
                                                            </TableHead>
                                                            <TableBody>
                                                                {fields.map((f) => (
                                                                    <TableRow key={f.id}>
                                                                        <TableCell sx={{ fontFamily: 'monospace' }}>{f.codename}</TableCell>
                                                                        <TableCell>{formatDataType(f.dataType)}</TableCell>
                                                                        <TableCell>
                                                                            {f.isRequired ? t('common.yes', 'Yes') : t('common.no', 'No')}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>

                                                        {preview.length > 0 && (
                                                            <Box sx={{ mt: 2 }}>
                                                                <Typography variant='subtitle2' sx={{ mb: 1 }}>
                                                                    {t('connectors.diffDialog.records', 'Predefined elements')}
                                                                </Typography>
                                                                <Table size='small'>
                                                                    <TableHead>
                                                                        <TableRow>
                                                                            {fields.map((f) => (
                                                                                <TableCell key={f.id} sx={{ fontFamily: 'monospace' }}>
                                                                                    {f.codename}
                                                                                </TableCell>
                                                                            ))}
                                                                        </TableRow>
                                                                    </TableHead>
                                                                    <TableBody>
                                                                        {preview.map((row) => (
                                                                            <TableRow key={row.id}>
                                                                                {fields.map((f) => {
                                                                                    const display = resolvePreviewChildFieldValue(
                                                                                        row.data,
                                                                                        f,
                                                                                        fieldsById,
                                                                                        uiLocale,
                                                                                        t
                                                                                    )
                                                                                    return <TableCell key={f.id}>{display}</TableCell>
                                                                                })}
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
                                                            </Box>
                                                        )}
                                                    </AccordionDetails>
                                                </Accordion>
                                            )
                                        })}
                                    </Box>
                                )}
                                <List dense>
                                    {(additiveStructured.length > 0
                                        ? additiveStructured
                                        : (diffData?.diff?.additive ?? []).map((change) => ({
                                              type: 'RAW',
                                              description: change
                                          }))
                                    )
                                        .filter((change) => String(change.type).toUpperCase() !== 'ADD_TABLE')
                                        .map((change, index) => (
                                            <ListItem key={`additive-${index}`}>
                                                <ListItemIcon sx={{ minWidth: 36 }}>
                                                    <AddCircleOutlineIcon color='success' />
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={formatStructuredChange(change)}
                                                    primaryTypographyProps={
                                                        change.type === 'UI_LAYOUT_UPDATE' ||
                                                        change.type === 'UI_LAYOUTS_UPDATE' ||
                                                        change.type === 'SYSTEM_METADATA_UPDATE'
                                                            ? { fontSize: 13 }
                                                            : { fontFamily: 'monospace', fontSize: 13 }
                                                    }
                                                />
                                            </ListItem>
                                        ))}
                                </List>
                            </Box>
                        )}

                        {/* Destructive Changes */}
                        {hasDestructiveChanges && (
                            <Box>
                                <Divider sx={{ my: 2 }} />
                                <Alert severity='warning' sx={{ mb: 2 }}>
                                    {t(
                                        'connectors.diffDialog.destructiveWarning',
                                        'These changes will delete data. Review carefully before confirming.'
                                    )}
                                </Alert>
                                <Typography variant='subtitle1' sx={{ fontWeight: 600, mb: 1, color: 'error.main' }}>
                                    {t('connectors.diffDialog.destructiveChanges', 'Destructive Changes (require confirmation)')}
                                </Typography>
                                <List dense>
                                    {(destructiveStructured.length > 0
                                        ? destructiveStructured
                                        : (diffData?.diff?.destructive ?? []).map((change) => ({
                                              type: 'RAW',
                                              description: change
                                          }))
                                    ).map((change, index) => (
                                        <ListItem key={`destructive-${index}`}>
                                            <ListItemIcon sx={{ minWidth: 36 }}>
                                                <RemoveCircleOutlineIcon color='error' />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={formatStructuredChange(change)}
                                                primaryTypographyProps={{ fontFamily: 'monospace', fontSize: 13 }}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            </Box>
                        )}
                    </Box>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onClose} disabled={isSyncing}>
                    {t('common.cancel', 'Cancel')}
                </Button>
                {hasChanges && !hasDestructiveChanges && (
                    <Button
                        variant='contained'
                        color='primary'
                        onClick={() => handleSync(false)}
                        disabled={isSyncing || isDiffLoading || hasUnresolvedRequiredLayoutChanges || workspaceSyncDisabled}
                        startIcon={isSyncing ? <CircularProgress size={16} /> : null}
                    >
                        {isSyncing
                            ? t('common.loading', 'Loading...')
                            : needsCreate
                            ? t('connectors.diffDialog.createSchema', 'Create Schema')
                            : t('connectors.diffDialog.confirmSync', 'Apply Changes')}
                    </Button>
                )}
                {hasDestructiveChanges && (
                    <>
                        {hasAdditiveChanges && (
                            <Button
                                variant='outlined'
                                color='primary'
                                onClick={() => handleSync(false)}
                                disabled={isSyncing || isDiffLoading || hasUnresolvedRequiredLayoutChanges || workspaceSyncDisabled}
                            >
                                {t('connectors.diffDialog.applySafeChanges', 'Apply Safe Changes Only')}
                            </Button>
                        )}
                        <Button
                            variant='contained'
                            color='error'
                            onClick={() => handleSync(true)}
                            disabled={isSyncing || isDiffLoading || hasUnresolvedRequiredLayoutChanges || workspaceSyncDisabled}
                            startIcon={isSyncing ? <CircularProgress size={16} color='inherit' /> : null}
                        >
                            {isSyncing
                                ? t('common.loading', 'Loading...')
                                : t('connectors.diffDialog.confirmDestructive', 'Apply Including Destructive')}
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    )
}

export default ConnectorDiffDialog
