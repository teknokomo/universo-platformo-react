import { Stack, Typography, FormControl, FormControlLabel, Checkbox, Box, Skeleton, Alert } from '@mui/material'
import { useTranslation } from 'react-i18next'

/**
 * Props for the ApplicationsCreatePanel component
 */
interface ApplicationsCreatePanelProps {
    /** Whether to auto-create an Application with Connector */
    autoCreateApplication?: boolean
    /** Callback when auto-create option changes */
    onChange?: (autoCreate: boolean) => void
    /** Whether the panel is in loading state */
    isLoading?: boolean
    /** Whether the panel is disabled */
    disabled?: boolean
}

/**
 * ApplicationsCreatePanel displays the auto-create Application option during Publication creation.
 *
 * When enabled, creating a Publication will also create:
 * - An Application linked to this Publication
 * - A Connector in that Application linked to the Publication's Metahub
 */
export const ApplicationsCreatePanel = ({
    autoCreateApplication = false,
    onChange,
    isLoading = false,
    disabled = false
}: ApplicationsCreatePanelProps) => {
    const { t } = useTranslation(['metahubs', 'common'])

    if (isLoading) {
        return (
            <Stack spacing={2} sx={{ p: 2 }}>
                <Skeleton variant='text' width='60%' height={24} />
                <Skeleton variant='rectangular' width='100%' height={80} />
            </Stack>
        )
    }

    return (
        <Stack spacing={3}>
            <Alert severity='info' sx={{ mb: 1 }}>
                {t(
                    'publications.applications.createInfo',
                    'При создании Публикации можно автоматически создать связанное Приложение с Коннектором.'
                )}
            </Alert>

            <FormControl component='fieldset' disabled={disabled}>
                <FormControlLabel
                    control={
                        <Checkbox checked={autoCreateApplication} onChange={(e) => onChange?.(e.target.checked)} disabled={disabled} />
                    }
                    label={
                        <Box>
                            <Typography variant='body1'>
                                {t('publications.applications.autoCreate', 'Автоматически создать Приложение')}
                            </Typography>
                            <Typography variant='body2' color='text.secondary'>
                                {t(
                                    'publications.applications.autoCreateDescription',
                                    'Будет создано Приложение с Коннектором, связанным с текущим Метахабом'
                                )}
                            </Typography>
                        </Box>
                    }
                />
            </FormControl>

            {autoCreateApplication && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'success.lighter', borderRadius: 1, border: 1, borderColor: 'success.light' }}>
                    <Typography variant='body2' color='success.dark'>
                        {t('publications.applications.willCreate', 'После сохранения будет создано:')}
                    </Typography>
                    <Typography component='ul' variant='body2' color='success.dark' sx={{ mt: 1, pl: 2 }}>
                        <li>{t('publications.applications.willCreateApp', 'Приложение с тем же названием')}</li>
                        <li>{t('publications.applications.willCreateConnector', 'Коннектор, связанный с Метахабом')}</li>
                    </Typography>
                </Box>
            )}
        </Stack>
    )
}

export default ApplicationsCreatePanel
