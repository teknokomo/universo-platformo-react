import { Box, Chip, FormControlLabel, Switch, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import type { ApplicationDisplay } from '../types'

type ApplicationCatalogVisibilityControlProps = {
    values: Record<string, unknown>
    setValue: (name: string, value: unknown) => void
    isLoading: boolean
}

export const canManageApplicationRecord = (application: Pick<ApplicationDisplay, 'permissions' | 'role'>): boolean => {
    if (typeof application.permissions?.manageApplication === 'boolean') {
        return application.permissions.manageApplication
    }

    return application.role === 'owner' || application.role === 'admin'
}

export const ApplicationCatalogVisibilityControl = ({ values, setValue, isLoading }: ApplicationCatalogVisibilityControlProps) => {
    const { t } = useTranslation('applications')
    const isPublic = values.isPublic === true
    const showInAppList = values.showInAppList !== false

    return (
        <Box>
            <FormControlLabel
                control={
                    <Switch
                        checked={showInAppList}
                        disabled={isLoading || !isPublic}
                        onChange={(_, checked) => setValue('showInAppList', checked)}
                    />
                }
                label={t('parameters.showInAppList', 'Show in the public application catalog')}
            />
            <Typography variant='body2' color='text.secondary'>
                {t(
                    'parameters.showInAppListHint',
                    'This only controls catalog discovery. It does not change whether a public application can be opened directly.'
                )}
            </Typography>
            {!isPublic ? (
                <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
                    {t('parameters.showInAppListDisabledHint', 'Set the application to Public to enable catalog listing.')}
                </Typography>
            ) : null}
        </Box>
    )
}

type ApplicationCatalogVisibilityBadgeProps = {
    application: Pick<ApplicationDisplay, 'isPublic' | 'showInAppList' | 'permissions' | 'role'>
    isSuperuser: boolean
}

export const ApplicationCatalogVisibilityBadge = ({ application, isSuperuser }: ApplicationCatalogVisibilityBadgeProps) => {
    const { t } = useTranslation('applications')

    if (!application.isPublic || application.showInAppList !== false || (!canManageApplicationRecord(application) && !isSuperuser)) {
        return null
    }

    return <Chip size='small' variant='outlined' label={t('visibility.hiddenFromCatalog', 'Unlisted')} />
}
