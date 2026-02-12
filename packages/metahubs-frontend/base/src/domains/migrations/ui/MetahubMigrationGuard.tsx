import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    Typography
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { extractAxiosError } from '@universo/utils'
import { useMetahubMigrationsStatus } from '../hooks'

export interface MetahubMigrationGuardProps {
    children: ReactNode
}

const MetahubMigrationGuard = ({ children }: MetahubMigrationGuardProps) => {
    const { metahubId } = useParams<{ metahubId: string }>()
    const location = useLocation()
    const navigate = useNavigate()
    const { t } = useTranslation('metahubs')

    const isMigrationsRoute = useMemo(() => location.pathname.includes('/migrations'), [location.pathname])

    const statusQuery = useMetahubMigrationsStatus(metahubId ?? '', {
        enabled: Boolean(metahubId)
    })

    if (!metahubId) {
        return <>{children}</>
    }

    if (isMigrationsRoute) {
        return <>{children}</>
    }

    if (statusQuery.isLoading) {
        return (
            <Stack spacing={1.5} alignItems='center' justifyContent='center' sx={{ minHeight: 260 }}>
                <CircularProgress size={22} />
                <Typography variant='body2'>{t('migrations.guard.checking', 'Checking metahub migration status...')}</Typography>
            </Stack>
        )
    }

    if (statusQuery.error) {
        return (
            <Box sx={{ p: 2 }}>
                <Alert
                    severity='error'
                    action={
                        <Button color='inherit' size='small' onClick={() => statusQuery.refetch()}>
                            {t('migrations.guard.retry', 'Retry')}
                        </Button>
                    }
                >
                    {extractAxiosError(statusQuery.error) || t('migrations.guard.statusError', 'Failed to load migration status')}
                </Alert>
            </Box>
        )
    }

    const status = statusQuery.data
    const migrationRequired = Boolean(status?.migrationRequired)

    if (!migrationRequired) {
        return <>{children}</>
    }

    const goToMigrations = () => {
        navigate(`/metahub/${metahubId}/migrations`, { replace: true })
    }

    return (
        <Dialog open fullWidth maxWidth='sm'>
            <DialogTitle>{t('migrations.guard.title', 'Migration required')}</DialogTitle>
            <DialogContent>
                <Stack spacing={1.5} sx={{ pt: 0.5 }}>
                    <Typography variant='body2'>
                        {t(
                            'migrations.guard.description',
                            'This metahub requires migration before other sections can be used. Open the migrations section and apply updates.'
                        )}
                    </Typography>
                    <Stack direction='row' spacing={1} flexWrap='wrap'>
                        <Chip
                            size='small'
                            color={status?.structureUpgradeRequired ? 'warning' : 'default'}
                            label={
                                status?.structureUpgradeRequired
                                    ? t('migrations.structureUpgradeNeeded', 'Structure upgrade required')
                                    : t('migrations.structureUpToDate', 'Structure up to date')
                            }
                        />
                        <Chip
                            size='small'
                            color={status?.templateUpgradeRequired ? 'warning' : 'default'}
                            label={
                                status?.templateUpgradeRequired
                                    ? t('migrations.templateUpgradeNeeded', 'Template upgrade required')
                                    : t('migrations.templateUpToDate', 'Template up to date')
                            }
                        />
                    </Stack>
                    {status?.blockers?.length ? (
                        <Alert severity='warning'>
                            {t('migrations.guard.blockersTitle', 'Blocking conditions detected')}: {status.blockers.join('; ')}
                        </Alert>
                    ) : null}
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={() => statusQuery.refetch()}>{t('migrations.guard.retry', 'Retry')}</Button>
                <Button variant='contained' onClick={goToMigrations}>
                    {t('migrations.guard.openMigrations', 'Open migrations')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default MetahubMigrationGuard
