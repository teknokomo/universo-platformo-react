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
import type { Connector } from '../types'
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

type SchemaStatus = 'draft' | 'pending' | 'synced' | 'outdated' | 'error'

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

    // Fetch diff when dialog opens - use applicationId
    const {
        data: diffData,
        isLoading: isDiffLoading,
        error: diffError,
        refetch: refetchDiff
    } = useApplicationDiff(applicationId, {
        enabled: open && Boolean(applicationId)
    })

    // Refetch diff when dialog opens
    useEffect(() => {
        if (open && applicationId) {
            refetchDiff()
        }
    }, [open, applicationId, refetchDiff])

    const hasDestructiveChanges = (diffData?.diff?.destructive?.length ?? 0) > 0
    const hasAdditiveChanges = (diffData?.diff?.additive?.length ?? 0) > 0
    const needsCreate = diffData?.schemaExists === false || schemaStatus === 'draft'
    const hasChanges =
        needsCreate || diffData?.diff?.hasChanges || hasDestructiveChanges || hasAdditiveChanges

    const handleSync = async (confirmDestructive: boolean) => {
        await onSync(confirmDestructive)
    }

    const connectorName = connector ? getVLCString(connector.name, uiLocale) : ''
    const createTables = diffData?.diff?.details?.create?.tables ?? []

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            aria-labelledby="connector-diff-dialog-title"
        >
            <DialogTitle id="connector-diff-dialog-title">
                {t('connectors.diffDialog.title', 'Schema Changes')}
                {connectorName && (
                    <Typography variant="subtitle2" color="text.secondary">
                        {connectorName}
                    </Typography>
                )}
            </DialogTitle>
            <DialogContent dividers>
                {isDiffLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : diffError ? (
                    <Alert severity="error">
                        {t('errors.connectionFailed', 'Failed to load schema changes')}
                    </Alert>
                ) : needsCreate ? (
                    <Box>
                        {/* Schema creation header */}
                        <Box sx={{ textAlign: 'center', py: 2, mb: 2 }}>
                            <AddCircleOutlineIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                            <Typography variant="h6">
                                {t('connectors.diffDialog.schemaWillBeCreated', 'Schema will be created')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {formatSummary(diffData?.diff?.summaryKey, diffData?.diff?.summaryParams, diffData?.diff?.summary) ||
                                    t('connectors.diffDialog.schemaNotExists', 'Schema does not exist yet. It will be created on first sync.')}
                            </Typography>
                        </Box>

                        {/* Show what will be created (expandable details) */}
                        {createTables.length > 0 ? (
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: 'success.main' }}>
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
                                                <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>
                                                    {table.codename}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                                                    {t('connectors.diffDialog.tableMeta', '{{fieldsCount}} fields, {{elementsCount}} elements', {
                                                        fieldsCount: fields.length,
                                                        elementsCount: table.predefinedElementsCount ?? 0
                                                    })}
                                                </Typography>
                                            </AccordionSummary>
                                            <AccordionDetails>
                                                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                                    {t('connectors.diffDialog.fields', 'Fields')}
                                                </Typography>
                                                <Table size="small">
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
                                                                <TableCell>{f.isRequired ? t('common.yes', 'Yes') : t('common.no', 'No')}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>

                                                {preview.length > 0 && (
                                                    <Box sx={{ mt: 2 }}>
                                                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                                            {t('connectors.diffDialog.predefinedElements', 'Predefined elements')}
                                                        </Typography>
                                                        <Table size="small">
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
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: 'success.main' }}>
                                    {t('connectors.diffDialog.tablesWillBeCreated', 'Tables to be created')}
                                </Typography>
                                <List dense>
                                    {diffData?.diff?.additive?.map((change, index) => (
                                        <ListItem key={`additive-${index}`}>
                                            <ListItemIcon sx={{ minWidth: 36 }}>
                                                <AddCircleOutlineIcon color="success" />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={formatChange(change)}
                                                primaryTypographyProps={
                                                    change === 'ui.layout.update' ||
                                                    change === 'ui.layouts.update' ||
                                                    change === 'schema.metadata.update'
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
                        <Typography variant="h6">
                            {t('connectors.diffDialog.noChanges', 'No changes detected')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t('connectors.diffDialog.schemaUpToDate', 'Schema matches current configuration')}
                        </Typography>
                    </Box>
                ) : (
                    <Box>
                        {/* Summary */}
                        {(diffData?.diff?.summaryKey || diffData?.diff?.summary) && (
                            <Alert severity="info" sx={{ mb: 2 }}>
                                {formatSummary(diffData?.diff?.summaryKey, diffData?.diff?.summaryParams, diffData?.diff?.summary)}
                            </Alert>
                        )}

                        {/* Additive Changes */}
                        {hasAdditiveChanges && (
                            <Box sx={{ mb: 3 }}>
                                <Typography
                                    variant="subtitle1"
                                    sx={{ fontWeight: 600, mb: 1, color: 'success.main' }}
                                >
                                    {t('connectors.diffDialog.additiveChanges', 'Safe Changes (will be applied)')}
                                </Typography>
                                <List dense>
                                    {diffData?.diff?.additive?.map((change, index) => (
                                        <ListItem key={`additive-${index}`}>
                                            <ListItemIcon sx={{ minWidth: 36 }}>
                                                <AddCircleOutlineIcon color="success" />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={formatChange(change)}
                                                primaryTypographyProps={
                                                    change === 'ui.layout.update' ||
                                                    change === 'ui.layouts.update' ||
                                                    change === 'schema.metadata.update'
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
                                <Alert severity="warning" sx={{ mb: 2 }}>
                                    {t(
                                        'connectors.diffDialog.destructiveWarning',
                                        'These changes will delete data. Review carefully before confirming.'
                                    )}
                                </Alert>
                                <Typography
                                    variant="subtitle1"
                                    sx={{ fontWeight: 600, mb: 1, color: 'error.main' }}
                                >
                                    {t(
                                        'connectors.diffDialog.destructiveChanges',
                                        'Destructive Changes (require confirmation)'
                                    )}
                                </Typography>
                                <List dense>
                                    {diffData?.diff?.destructive?.map((change, index) => (
                                        <ListItem key={`destructive-${index}`}>
                                            <ListItemIcon sx={{ minWidth: 36 }}>
                                                <RemoveCircleOutlineIcon color="error" />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={change}
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
                        variant="contained"
                        color="primary"
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
                                variant="outlined"
                                color="primary"
                                onClick={() => handleSync(false)}
                                disabled={isSyncing || isDiffLoading}
                            >
                                {t('connectors.diffDialog.applySafeChanges', 'Apply Safe Changes Only')}
                            </Button>
                        )}
                        <Button
                            variant="contained"
                            color="error"
                            onClick={() => handleSync(true)}
                            disabled={isSyncing || isDiffLoading}
                            startIcon={isSyncing ? <CircularProgress size={16} color="inherit" /> : null}
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
