/**
 * Universo Platformo | ConnectorDiffDialog Component
 *
 * Dialog for showing schema diff and confirming sync for a connector.
 * Adapted from metahubs PublicationDiffDialog.
 */

import { useEffect } from 'react'
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
    TableRow
} from '@mui/material'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useTranslation } from 'react-i18next'
import { useApplicationDiff } from '../hooks/useConnectorSync'
import type { Connector, SchemaStatus } from '../types'
import { getVLCString } from '../types'

// ============================================================================
// Types
// ============================================================================

export interface ConnectorDiffDialogProps {
    open: boolean
    connector?: Connector | null
    applicationId: string
    onClose: () => void
    onSync: (confirmDestructive: boolean) => Promise<void>
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
            return t('connectors.diffDialog.summary.create', 'Create {{tablesCount}} table(s) in new schema', { tablesCount })
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
                return t(
                    'connectors.diffDialog.summary.changeCounts',
                    '{{additiveCount}} additive change(s), {{destructiveCount}} destructive change(s)',
                    {
                        additiveCount,
                        destructiveCount
                    }
                )
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

    // Refetch diff when dialog opens
    useEffect(() => {
        if (open && applicationId) {
            refetchDiff()
        }
    }, [open, applicationId, refetchDiff])

    const hasDestructiveChanges = (diffData?.diff?.destructive?.length ?? 0) > 0
    const hasAdditiveChanges = (diffData?.diff?.additive?.length ?? 0) > 0
    const needsCreate = diffData?.schemaExists === false || schemaStatus === 'draft'
    const hasChanges = needsCreate || diffData?.diff?.hasChanges || hasDestructiveChanges || hasAdditiveChanges

    const handleSync = async (confirmDestructive: boolean) => {
        await onSync(confirmDestructive)
    }

    const connectorName = connector ? getVLCString(connector.name, uiLocale) : ''
    const createTables = diffData?.diff?.details?.create?.tables ?? []
    const additiveStructured = (diffData?.diff?.details?.changes?.additive ?? []) as StructuredDiffChange[]
    const destructiveStructured = (diffData?.diff?.details?.changes?.destructive ?? []) as StructuredDiffChange[]
    const hasCreateTableDetails = createTables.length > 0

    return (
        <Dialog open={open} onClose={onClose} maxWidth='md' fullWidth aria-labelledby='connector-diff-dialog-title'>
            <DialogTitle id='connector-diff-dialog-title'>
                {t('connectors.diffDialog.title', 'Schema Changes')}
                {connectorName && (
                    <Typography variant='subtitle2' color='text.secondary'>
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
                                    const fields = table.fields ?? []
                                    const preview = (table.predefinedElementsPreview ?? [])
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
                                                    {t(
                                                        'connectors.diffDialog.tableMeta',
                                                        '{{fieldsCount}} fields, {{elementsCount}} elements',
                                                        {
                                                            fieldsCount: fields.length,
                                                            elementsCount: table.predefinedElementsCount ?? 0
                                                        }
                                                    )}
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
                                                            {t('connectors.diffDialog.predefinedElements', 'Predefined elements')}
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
                                                                            const value = row.data?.[f.codename]
                                                                            const display =
                                                                                value === null || value === undefined
                                                                                    ? ''
                                                                                    : typeof value === 'object'
                                                                                    ? JSON.stringify(value)
                                                                                    : String(value)
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
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <CheckCircleOutlineIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                        <Typography variant='h6'>{t('connectors.diffDialog.noChanges', 'No changes detected')}</Typography>
                        <Typography variant='body2' color='text.secondary'>
                            {t('connectors.diffDialog.schemaUpToDate', 'Schema matches current configuration')}
                        </Typography>
                    </Box>
                ) : (
                    <Box>
                        {/* Summary */}
                        {(diffData?.diff?.summaryKey || diffData?.diff?.summary) && (
                            <Alert severity='info' sx={{ mb: 2 }}>
                                {formatSummary(diffData?.diff?.summaryKey, diffData?.diff?.summaryParams, diffData?.diff?.summary)}
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
                                            const fields = table.fields ?? []
                                            const preview = (table.predefinedElementsPreview ?? [])
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
                                                            {t(
                                                                'connectors.diffDialog.tableMeta',
                                                                '{{fieldsCount}} fields, {{elementsCount}} elements',
                                                                {
                                                                    fieldsCount: fields.length,
                                                                    elementsCount: table.predefinedElementsCount ?? 0
                                                                }
                                                            )}
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
                                                                    {t('connectors.diffDialog.predefinedElements', 'Predefined elements')}
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
                                                                                    const value = row.data?.[f.codename]
                                                                                    const display =
                                                                                        value === null || value === undefined
                                                                                            ? ''
                                                                                            : typeof value === 'object'
                                                                                            ? JSON.stringify(value)
                                                                                            : String(value)
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
                        disabled={isSyncing || isDiffLoading}
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
                                disabled={isSyncing || isDiffLoading}
                            >
                                {t('connectors.diffDialog.applySafeChanges', 'Apply Safe Changes Only')}
                            </Button>
                        )}
                        <Button
                            variant='contained'
                            color='error'
                            onClick={() => handleSync(true)}
                            disabled={isSyncing || isDiffLoading}
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
