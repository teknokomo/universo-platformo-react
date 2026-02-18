/**
 * Universo Platformo | Application Migration Guard
 *
 * Checks whether an application needs a schema update before allowing
 * the user to enter the runtime section. Uses MigrationGuardShell from
 * the shared package for common guard logic.
 *
 * Severity levels:
 * - MANDATORY  → blocks access, must sync before proceeding
 * - RECOMMENDED → shows a warning dialog with a "Continue anyway" button
 * - OPTIONAL   → renders children immediately (no blocking)
 */

import { type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Chip, DialogTitle, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { UpdateSeverity } from '@universo/types'
import { MigrationGuardShell, type GuardRenderContext } from '@universo/migration-guard-shared'
import type { ApplicationMigrationStatusResponse } from '@universo/types'
import { AppMainLayout } from '@universo/apps-template-mui'
import { useApplicationMigrationStatus } from '../hooks/useApplicationMigrationStatus'
import UnderDevelopmentPage from '../pages/UnderDevelopmentPage'
import MaintenancePage from '../pages/MaintenancePage'

export interface ApplicationMigrationGuardProps {
    children: ReactNode
}

const ApplicationMigrationGuard = ({ children }: ApplicationMigrationGuardProps) => {
    const { applicationId } = useParams<{ applicationId: string }>()
    const location = useLocation()
    const navigate = useNavigate()
    const { t } = useTranslation('applications')

    const isAdminRoute = /\/admin(\/|$)/.test(location.pathname)

    const statusQuery = useApplicationMigrationStatus(applicationId ?? '', {
        enabled: Boolean(applicationId)
    })

    return (
        <AppMainLayout>
            <MigrationGuardShell<ApplicationMigrationStatusResponse>
                entityId={applicationId}
                isSkipRoute={isAdminRoute}
                statusQuery={statusQuery}
                dialogAriaId='app-migration-dialog-description'
                loadingText={t('migrationGuard.checking', 'Checking application update status...')}
                errorText={t('migrationGuard.statusError', 'Failed to load update status')}
                retryText={t('migrationGuard.retry', 'Retry')}
                renderPreDialog={(status) => {
                    // Schema does not exist yet — show "under development" page
                    if (status.severity === UpdateSeverity.MANDATORY && !status.schemaExists) {
                        return <UnderDevelopmentPage />
                    }
                    // Non-privileged users during maintenance — show friendly maintenance page
                    const isPrivileged = status.currentUserRole === 'owner' || status.currentUserRole === 'admin'
                    if (status.isMaintenance && !isPrivileged) {
                        return <MaintenancePage />
                    }
                    return null
                }}
                renderDialogTitle={() => <DialogTitle>{t('migrationGuard.title', 'Update required')}</DialogTitle>}
                renderDialogContent={({ status, isMandatory }: GuardRenderContext<ApplicationMigrationStatusResponse>) => (
                    <>
                        <Typography id='app-migration-dialog-description' variant='body2'>
                            {isMandatory
                                ? t(
                                      'migrationGuard.descriptionMandatory',
                                      'This application requires a mandatory update before it can be used. Please synchronize the schema in the control panel.'
                                  )
                                : t(
                                      'migrationGuard.descriptionRecommended',
                                      'A recommended update is available for this application. You can continue using it, but synchronization is advised.'
                                  )}
                        </Typography>

                        <Stack direction='row' spacing={1} flexWrap='wrap'>
                            <Chip
                                size='small'
                                color={status.structureUpgradeRequired ? 'warning' : 'default'}
                                label={
                                    status.structureUpgradeRequired
                                        ? t('migrationGuard.severity.mandatory', 'Mandatory')
                                        : t('migrationGuard.severity.optional', 'Optional')
                                }
                            />
                            {status.publicationUpdateAvailable && (
                                <Chip size='small' color='info' label={t('migrationGuard.severity.recommended', 'Recommended')} />
                            )}
                        </Stack>

                        {status.blockers?.length ? (
                            <Alert severity='warning'>
                                <Typography variant='body2' fontWeight='bold' sx={{ mb: 0.5 }}>
                                    {t('migrationGuard.blockersTitle', 'Blocking conditions detected')}:
                                </Typography>
                                <ul style={{ margin: 0, paddingLeft: 16 }}>
                                    {status.blockers.map((blocker) => (
                                        <li key={blocker.code}>
                                            <Typography variant='body2'>
                                                {t(`migrationGuard.blockers.${blocker.code}`, {
                                                    defaultValue: blocker.message,
                                                    ...blocker.params
                                                })}
                                            </Typography>
                                        </li>
                                    ))}
                                </ul>
                            </Alert>
                        ) : null}
                    </>
                )}
                renderDialogActions={({ isMandatory, onDismiss, onRetry }) => (
                    <>
                        <Button onClick={onRetry}>{t('migrationGuard.retry', 'Retry')}</Button>
                        {!isMandatory && (
                            <Button color='inherit' onClick={onDismiss}>
                                {t('migrationGuard.continueTo', 'Continue anyway')}
                            </Button>
                        )}
                        <Button variant='contained' onClick={() => navigate(`/a/${applicationId}/admin`, { replace: true })}>
                            {t('migrationGuard.openSync', 'Open synchronization')}
                        </Button>
                    </>
                )}
            >
                {children}
            </MigrationGuardShell>
        </AppMainLayout>
    )
}

export default ApplicationMigrationGuard
