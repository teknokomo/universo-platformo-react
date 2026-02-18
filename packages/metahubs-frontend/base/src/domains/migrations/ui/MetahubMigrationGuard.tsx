/**
 * Universo Platformo | Metahub Migration Guard
 *
 * Checks whether a metahub needs structure or template migration before
 * allowing the user to enter other sections. Uses MigrationGuardShell from
 * the shared package for common guard logic.
 *
 * Severity levels:
 * - MANDATORY  → blocks access, structure upgrade or blockers present
 * - RECOMMENDED → template-only update, can be dismissed
 * - OPTIONAL   → renders children immediately (no blocking)
 */

import { type ReactNode, useCallback, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Chip, DialogTitle, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { extractAxiosError } from '@universo/utils'
import { MigrationGuardShell, type GuardRenderContext } from '@universo/migration-guard-shared'
import type { MetahubMigrationStatusResponse } from '@universo/types'
import { useMetahubMigrationsStatus } from '../hooks'
import { applyMetahubMigrations } from '../api'

export interface MetahubMigrationGuardProps {
    children: ReactNode
}

const MetahubMigrationGuard = ({ children }: MetahubMigrationGuardProps) => {
    const { metahubId } = useParams<{ metahubId: string }>()
    const location = useLocation()
    const navigate = useNavigate()
    const { t } = useTranslation('metahubs')

    const [applying, setApplying] = useState(false)
    const [applyError, setApplyError] = useState<string | null>(null)

    const isMigrationsRoute = /\/migrations(\/|$)/.test(location.pathname)

    const statusQuery = useMetahubMigrationsStatus(metahubId ?? '', {
        enabled: Boolean(metahubId)
    })

    const refetchStatus = statusQuery.refetch

    const handleApplyKeep = useCallback(async () => {
        if (!metahubId) return
        setApplying(true)
        setApplyError(null)
        try {
            await applyMetahubMigrations(metahubId, { cleanupMode: 'keep' })
        } catch (err) {
            setApplyError(extractAxiosError(err).message || t('migrations.messages.applyError', 'Failed to apply migrations'))
            setApplying(false)
            return
        }
        try {
            await refetchStatus()
        } catch {
            // Migrations applied successfully; refetch failure is non-critical
        } finally {
            setApplying(false)
        }
    }, [metahubId, refetchStatus, t])

    return (
        <MigrationGuardShell<MetahubMigrationStatusResponse>
            entityId={metahubId}
            isSkipRoute={isMigrationsRoute}
            statusQuery={statusQuery}
            dialogAriaId='mhb-migration-dialog-description'
            loadingText={t('migrations.guard.checking', 'Checking metahub migration status...')}
            errorText={t('migrations.guard.statusError', 'Failed to load migration status')}
            retryText={t('migrations.guard.retry', 'Retry')}
            renderDialogTitle={() => <DialogTitle>{t('migrations.guard.title', 'Migration required')}</DialogTitle>}
            renderDialogContent={({ status, isMandatory }: GuardRenderContext<MetahubMigrationStatusResponse>) => (
                <>
                    <Typography id='mhb-migration-dialog-description' variant='body2'>
                        {isMandatory
                            ? t(
                                  'migrations.guard.descriptionMandatory',
                                  'This metahub requires a mandatory migration before other sections can be used.'
                              )
                            : t(
                                  'migrations.guard.descriptionRecommended',
                                  'A recommended template update is available for this metahub. You can continue using it, but applying the update is advised.'
                              )}
                    </Typography>
                    <Stack direction='row' spacing={1} flexWrap='wrap'>
                        <Chip
                            size='small'
                            color={status.structureUpgradeRequired ? 'warning' : 'default'}
                            label={
                                status.structureUpgradeRequired
                                    ? t('migrations.structureUpgradeNeeded', 'Structure upgrade required')
                                    : t('migrations.structureUpToDate', 'Structure up to date')
                            }
                        />
                        <Chip
                            size='small'
                            color={status.templateUpgradeRequired ? 'warning' : 'default'}
                            label={
                                status.templateUpgradeRequired
                                    ? t('migrations.templateUpgradeNeeded', 'Template upgrade required')
                                    : t('migrations.templateUpToDate', 'Template up to date')
                            }
                        />
                    </Stack>
                    {status.blockers?.length ? (
                        <Alert severity='warning'>
                            <Typography variant='body2' fontWeight='bold' sx={{ mb: 0.5 }}>
                                {t('migrations.guard.blockersTitle', 'Blocking conditions detected')}:
                            </Typography>
                            <ul style={{ margin: 0, paddingLeft: 16 }}>
                                {status.blockers.map((blocker) => (
                                    <li key={blocker.code}>
                                        <Typography variant='body2'>
                                            {t(`migrations.blockers.${blocker.code}`, {
                                                defaultValue: blocker.message,
                                                ...blocker.params
                                            })}
                                        </Typography>
                                    </li>
                                ))}
                            </ul>
                        </Alert>
                    ) : null}
                    {applyError && <Alert severity='error'>{applyError}</Alert>}
                </>
            )}
            renderDialogActions={({ isMandatory, hasBlockers, onDismiss, onRetry }) => (
                <>
                    <Button onClick={onRetry} disabled={applying}>
                        {t('migrations.guard.retry', 'Retry')}
                    </Button>
                    {!isMandatory && (
                        <Button color='inherit' onClick={onDismiss} disabled={applying}>
                            {t('migrations.guard.continueTo', 'Continue anyway')}
                        </Button>
                    )}
                    <Button variant='contained' color='warning' onClick={handleApplyKeep} disabled={applying || hasBlockers}>
                        {applying ? t('migrations.applying', 'Applying...') : t('migrations.guard.applyKeepData', 'Apply (keep user data)')}
                    </Button>
                    <Button
                        variant='contained'
                        onClick={() => navigate(`/metahub/${metahubId}/migrations`, { replace: true })}
                        disabled={applying}
                    >
                        {t('migrations.guard.openMigrations', 'Open migrations')}
                    </Button>
                </>
            )}
        >
            {children}
        </MigrationGuardShell>
    )
}

export default MetahubMigrationGuard
