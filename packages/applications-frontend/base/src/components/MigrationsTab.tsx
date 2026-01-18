/**
 * Universo Platformo | MigrationsTab Component
 *
 * Displays migration history for an application with rollback capabilities.
 */

import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Tooltip,
    Chip,
    Alert,
    CircularProgress,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Collapse
} from '@mui/material'
import {
    History as HistoryIcon,
    Undo as UndoIcon,
    Info as InfoIcon,
    Warning as WarningIcon,
    Error as ErrorIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    CheckCircle as CheckCircleIcon
} from '@mui/icons-material'
import { useMigrations, useMigrationRollbackAnalysis, useRollbackMigration } from '../hooks/useMigrations'
import type { MigrationListItem, RollbackAnalysis } from '../api/migrations'

interface MigrationsTabProps {
    applicationId: string
}

/**
 * Tab component showing migration history with rollback functionality
 */
export function MigrationsTab({ applicationId }: MigrationsTabProps) {
    const { t } = useTranslation('applications')
    const [selectedMigrationId, setSelectedMigrationId] = useState<string | null>(null)
    const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false)
    const [expandedMigration, setExpandedMigration] = useState<string | null>(null)

    // Fetch migrations list
    const { data: migrationsData, isLoading, isError, error } = useMigrations(applicationId)

    // Fetch rollback analysis when a migration is selected
    const {
        data: rollbackAnalysis,
        isLoading: isAnalyzing
    } = useMigrationRollbackAnalysis(applicationId, selectedMigrationId ?? '', {
        enabled: Boolean(selectedMigrationId)
    })

    // Rollback mutation
    const rollbackMutation = useRollbackMigration(applicationId)

    const handleRollbackClick = useCallback((migrationId: string) => {
        setSelectedMigrationId(migrationId)
        setRollbackDialogOpen(true)
    }, [])

    const handleRollbackConfirm = useCallback(() => {
        if (!selectedMigrationId) return

        rollbackMutation.mutate(
            { migrationId: selectedMigrationId, confirmDestructive: true },
            {
                onSuccess: () => {
                    setRollbackDialogOpen(false)
                    setSelectedMigrationId(null)
                }
            }
        )
    }, [selectedMigrationId, rollbackMutation])

    const handleRollbackCancel = useCallback(() => {
        setRollbackDialogOpen(false)
        setSelectedMigrationId(null)
    }, [])

    const toggleExpanded = useCallback((migrationId: string) => {
        setExpandedMigration((prev) => (prev === migrationId ? null : migrationId))
    }, [])

    const migrations = useMemo(() => migrationsData?.items ?? [], [migrationsData])

    if (isLoading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" py={4}>
                <CircularProgress size={40} />
            </Box>
        )
    }

    if (isError) {
        return (
            <Alert severity="error" sx={{ m: 2 }}>
                {error?.message || t('migrations.loadError', 'Failed to load migrations')}
            </Alert>
        )
    }

    if (migrations.length === 0) {
        return (
            <Box textAlign="center" py={4}>
                <HistoryIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                    {t('migrations.noMigrations', 'No migrations yet')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {t('migrations.noMigrationsHint', 'Migrations will appear here after schema synchronization')}
                </Typography>
            </Box>
        )
    }

    return (
        <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HistoryIcon />
                {t('migrations.title', 'Migration History')}
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('migrations.description', 'Schema changes applied to this application database.')}
            </Typography>

            <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell width={40} />
                            <TableCell>{t('migrations.name', 'Migration')}</TableCell>
                            <TableCell>{t('migrations.appliedAt', 'Applied')}</TableCell>
                            <TableCell>{t('migrations.changes', 'Changes')}</TableCell>
                            <TableCell align="right">{t('common.actions', 'Actions')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {migrations.map((migration, index) => (
                            <MigrationRow
                                key={migration.id}
                                migration={migration}
                                isLatest={index === 0}
                                isExpanded={expandedMigration === migration.id}
                                onToggleExpand={() => toggleExpanded(migration.id)}
                                onRollbackClick={() => handleRollbackClick(migration.id)}
                                t={t}
                            />
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Rollback Confirmation Dialog */}
            <RollbackDialog
                open={rollbackDialogOpen}
                analysis={rollbackAnalysis}
                isAnalyzing={isAnalyzing}
                isRollingBack={rollbackMutation.isPending}
                error={rollbackMutation.error}
                onConfirm={handleRollbackConfirm}
                onCancel={handleRollbackCancel}
                t={t}
            />
        </Box>
    )
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

interface MigrationRowProps {
    migration: MigrationListItem
    isLatest: boolean
    isExpanded: boolean
    onToggleExpand: () => void
    onRollbackClick: () => void
    t: ReturnType<typeof useTranslation>['t']
}

function MigrationRow({
    migration,
    isLatest,
    isExpanded,
    onToggleExpand,
    onRollbackClick,
    t
}: MigrationRowProps) {
    const formattedDate = useMemo(() => {
        return new Date(migration.appliedAt).toLocaleString()
    }, [migration.appliedAt])

    return (
        <>
            <TableRow hover>
                <TableCell>
                    <IconButton size="small" onClick={onToggleExpand}>
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                </TableCell>
                <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2" fontFamily="monospace">
                            {migration.name}
                        </Typography>
                        {isLatest && (
                            <Chip
                                size="small"
                                label={t('migrations.latest', 'Latest')}
                                color="primary"
                                variant="outlined"
                            />
                        )}
                        {migration.hasDestructive && (
                            <Chip
                                size="small"
                                label={t('migrations.destructive', 'Destructive')}
                                color="warning"
                                icon={<WarningIcon />}
                            />
                        )}
                    </Box>
                </TableCell>
                <TableCell>
                    <Typography variant="body2">{formattedDate}</Typography>
                </TableCell>
                <TableCell>
                    <Chip
                        size="small"
                        label={`${migration.changesCount} ${t('migrations.changesCount', 'changes')}`}
                        variant="outlined"
                    />
                </TableCell>
                <TableCell align="right">
                    {!isLatest && (
                        <Tooltip title={t('migrations.rollbackTo', 'Rollback to this migration')}>
                            <IconButton size="small" onClick={onRollbackClick} color="warning">
                                <UndoIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                    {isLatest && (
                        <Tooltip title={t('migrations.currentState', 'Current schema state')}>
                            <CheckCircleIcon color="success" fontSize="small" />
                        </Tooltip>
                    )}
                </TableCell>
            </TableRow>
            <TableRow>
                <TableCell colSpan={5} sx={{ py: 0, borderBottom: isExpanded ? undefined : 'none' }}>
                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box sx={{ py: 2, px: 2, bgcolor: 'action.hover' }}>
                            <Typography variant="subtitle2" gutterBottom>
                                {t('migrations.summary', 'Summary')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {migration.summary}
                            </Typography>
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </>
    )
}

interface RollbackDialogProps {
    open: boolean
    analysis: RollbackAnalysis | undefined
    isAnalyzing: boolean
    isRollingBack: boolean
    error: Error | null
    onConfirm: () => void
    onCancel: () => void
    t: ReturnType<typeof useTranslation>['t']
}

function RollbackDialog({
    open,
    analysis,
    isAnalyzing,
    isRollingBack,
    error,
    onConfirm,
    onCancel,
    t
}: RollbackDialogProps) {
    const canRollback = analysis?.canRollback ?? false
    const hasBlockers = (analysis?.blockers?.length ?? 0) > 0
    const hasWarnings = (analysis?.warnings?.length ?? 0) > 0

    return (
        <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <UndoIcon color="warning" />
                {t('migrations.rollbackConfirm', 'Confirm Rollback')}
            </DialogTitle>
            <DialogContent>
                {isAnalyzing ? (
                    <Box display="flex" justifyContent="center" py={2}>
                        <CircularProgress size={24} />
                        <Typography variant="body2" sx={{ ml: 2 }}>
                            {t('migrations.analyzing', 'Analyzing rollback path...')}
                        </Typography>
                    </Box>
                ) : (
                    <>
                        {analysis && (
                            <DialogContentText component="div">
                                <Typography variant="body1" gutterBottom>
                                    {t('migrations.rollbackToMigration', 'Rollback to migration:')}
                                    <strong> {analysis.migrationName}</strong>
                                </Typography>

                                {hasBlockers && (
                                    <Alert severity="error" sx={{ mt: 2 }}>
                                        <Typography variant="subtitle2">
                                            {t('migrations.cannotRollback', 'Cannot rollback')}
                                        </Typography>
                                        <List dense>
                                            {analysis.blockers.map((blocker, idx) => (
                                                <ListItem key={idx}>
                                                    <ListItemIcon sx={{ minWidth: 32 }}>
                                                        <ErrorIcon color="error" fontSize="small" />
                                                    </ListItemIcon>
                                                    <ListItemText primary={blocker} />
                                                </ListItem>
                                            ))}
                                        </List>
                                    </Alert>
                                )}

                                {hasWarnings && !hasBlockers && (
                                    <Alert severity="warning" sx={{ mt: 2 }}>
                                        <Typography variant="subtitle2">
                                            {t('migrations.warnings', 'Warnings')}
                                        </Typography>
                                        <List dense>
                                            {analysis.warnings.map((warning, idx) => (
                                                <ListItem key={idx}>
                                                    <ListItemIcon sx={{ minWidth: 32 }}>
                                                        <WarningIcon color="warning" fontSize="small" />
                                                    </ListItemIcon>
                                                    <ListItemText primary={warning} />
                                                </ListItem>
                                            ))}
                                        </List>
                                    </Alert>
                                )}

                                {canRollback && analysis.rollbackChanges.length > 0 && (
                                    <Box sx={{ mt: 2 }}>
                                        <Typography variant="subtitle2" gutterBottom>
                                            {t('migrations.rollbackChanges', 'Changes to apply:')}
                                        </Typography>
                                        <List dense>
                                            {analysis.rollbackChanges.map((change, idx) => (
                                                <ListItem key={idx}>
                                                    <ListItemIcon sx={{ minWidth: 32 }}>
                                                        <InfoIcon color="info" fontSize="small" />
                                                    </ListItemIcon>
                                                    <ListItemText primary={change} />
                                                </ListItem>
                                            ))}
                                        </List>
                                    </Box>
                                )}
                            </DialogContentText>
                        )}

                        {error && (
                            <Alert severity="error" sx={{ mt: 2 }}>
                                {error.message}
                            </Alert>
                        )}
                    </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel} disabled={isRollingBack}>
                    {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                    onClick={onConfirm}
                    color="warning"
                    variant="contained"
                    disabled={!canRollback || isAnalyzing || isRollingBack}
                    startIcon={isRollingBack ? <CircularProgress size={16} /> : <UndoIcon />}
                >
                    {isRollingBack
                        ? t('migrations.rollingBack', 'Rolling back...')
                        : t('migrations.rollback', 'Rollback')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default MigrationsTab
