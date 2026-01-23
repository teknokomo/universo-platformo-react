import { Stack, Typography, FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, Box, Skeleton } from '@mui/material'
import { useTranslation } from 'react-i18next'
import type { PublicationAccessMode } from '../api'

/**
 * Props for the AccessPanel component
 */
interface AccessPanelProps {
    /** Current access mode value */
    accessMode?: PublicationAccessMode
    /** Callback when access mode changes (undefined = read-only mode) */
    onChange?: (mode: PublicationAccessMode) => void
    /** Whether the panel is in loading state */
    isLoading?: boolean
    /** Whether the panel is disabled */
    disabled?: boolean
}

/**
 * AccessPanel displays and allows editing of publication access mode.
 *
 * Access modes:
 * - full: All Metahub data is accessible
 * - restricted: Access is controlled by access_config (future feature)
 */
export const AccessPanel = ({
    accessMode = 'full',
    onChange,
    isLoading = false,
    disabled = false
}: AccessPanelProps) => {
    const { t } = useTranslation(['metahubs', 'common'])

    if (isLoading) {
        return (
            <Stack spacing={2} sx={{ p: 2 }}>
                <Skeleton variant="text" width="40%" height={24} />
                <Skeleton variant="rectangular" width="100%" height={80} />
            </Stack>
        )
    }

    const isReadOnly = !onChange

    return (
        <Stack spacing={3}>
            <FormControl component="fieldset" disabled={disabled || isReadOnly}>
                <FormLabel component="legend">
                    {t('publications.access.modeLabel', 'Режим доступа')}
                </FormLabel>
                <RadioGroup
                    value={accessMode}
                    onChange={(e) => onChange?.(e.target.value as PublicationAccessMode)}
                    sx={{ mt: 1 }}
                >
                    <FormControlLabel
                        value="full"
                        control={<Radio />}
                        label={
                            <Box>
                                <Typography variant="body1">
                                    {t('publications.access.modeFull', 'Полный доступ')}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {t('publications.access.modeFullDescription', 'Все данные Метахаба доступны через Публикацию')}
                                </Typography>
                            </Box>
                        }
                    />
                    <FormControlLabel
                        value="restricted"
                        control={<Radio />}
                        label={
                            <Box>
                                <Typography variant="body1">
                                    {t('publications.access.modeRestricted', 'Ограниченный доступ')}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {t('publications.access.modeRestrictedDescription', 'Доступ контролируется конфигурацией (скоро)')}
                                </Typography>
                            </Box>
                        }
                        disabled={true} // Not implemented yet
                    />
                </RadioGroup>
            </FormControl>

            {accessMode === 'restricted' && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        {t('publications.access.configPlaceholder', 'Конфигурация ограниченного доступа будет доступна в будущих версиях.')}
                    </Typography>
                </Box>
            )}
        </Stack>
    )
}

export default AccessPanel
