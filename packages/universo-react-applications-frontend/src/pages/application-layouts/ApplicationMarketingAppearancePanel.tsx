import {
    Alert,
    Box,
    Button,
    Chip,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Switch,
    TextField,
    Typography
} from '@mui/material'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import { useEffect, useState } from 'react'
import type { TFunction } from 'i18next'
import { marketingPageConfigSchema, type ApplicationLayout } from '@universo-react/types'

interface ApplicationMarketingAppearancePanelProps {
    t: TFunction<'applications'>
    layout: ApplicationLayout
    isSaving: boolean
    isResetting: boolean
    canManage: boolean
    onChange: (key: string, value: unknown) => void
    onReset: () => void
}

/** Application-owned appearance controls for the widgetized marketing template. */
export function ApplicationMarketingAppearancePanel({
    t,
    layout,
    isSaving,
    isResetting,
    canManage,
    onChange,
    onReset
}: ApplicationMarketingAppearancePanelProps) {
    const parsed = marketingPageConfigSchema.safeParse(layout.config)
    const config = parsed.success ? parsed.data : marketingPageConfigSchema.parse({})
    const controlsEnabled = parsed.success && canManage && !isSaving && !isResetting
    const resetEnabled = canManage && !isSaving && !isResetting
    const [colorDrafts, setColorDrafts] = useState({
        primaryColor: config.primaryColor ?? '',
        accentColor: config.accentColor ?? ''
    })
    const [colorErrors, setColorErrors] = useState<{ primaryColor?: boolean; accentColor?: boolean }>({})

    useEffect(() => {
        setColorDrafts({
            primaryColor: config.primaryColor ?? '',
            accentColor: config.accentColor ?? ''
        })
        setColorErrors({})
    }, [config.accentColor, config.primaryColor])

    const updateColorDraft = (key: 'primaryColor' | 'accentColor', value: string) => {
        setColorDrafts((current) => ({ ...current, [key]: value }))
        setColorErrors((current) => ({ ...current, [key]: false }))
    }

    const commitColor = (key: 'primaryColor' | 'accentColor') => {
        const value = colorDrafts[key].trim()
        const nextConfig = { ...config, [key]: value || undefined }
        const result = marketingPageConfigSchema.safeParse(nextConfig)
        if (!result.success) {
            setColorErrors((current) => ({ ...current, [key]: true }))
            return
        }
        setColorErrors((current) => ({ ...current, [key]: false }))
        onChange(key, value || undefined)
    }

    const sourceLabel =
        layout.sourceKind === 'metahub' ? t('layouts.source.metahub', 'Metahub') : t('layouts.source.application', 'Application')

    return (
        <Paper variant='outlined' sx={{ p: 2 }} data-testid='application-marketing-appearance-panel'>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 0.5, alignItems: { xs: 'flex-start', sm: 'center' } }}>
                <Typography variant='subtitle1'>{t('layouts.marketing.appearanceTitle', 'Marketing page appearance')}</Typography>
                <Chip
                    size='small'
                    variant='outlined'
                    label={t('layouts.marketing.sourceBadge', 'Source: {{source}}', { source: sourceLabel })}
                    data-testid='application-marketing-appearance-source'
                />
            </Stack>
            <Typography variant='body2' sx={{ color: 'text.secondary', mb: 2 }}>
                {t(
                    'layouts.marketing.appearanceDescription',
                    'Configure the published marketing page appearance and actions. Widget composition is managed below.'
                )}
            </Typography>
            {!parsed.success ? (
                <Alert severity='error' sx={{ mb: 2 }} data-testid='application-marketing-appearance-invalid-config'>
                    {t('layouts.marketing.invalidConfig', 'The saved marketing appearance configuration is invalid.')}
                </Alert>
            ) : null}
            <Stack spacing={1.5}>
                <FormControl size='small' sx={{ minWidth: 220 }}>
                    <InputLabel id='application-marketing-theme-mode-label'>{t('layouts.marketing.themeMode', 'Theme mode')}</InputLabel>
                    <Select
                        id='application-marketing-theme-mode'
                        labelId='application-marketing-theme-mode-label'
                        value={config.themeMode}
                        label={t('layouts.marketing.themeMode', 'Theme mode')}
                        disabled={!controlsEnabled}
                        onChange={(event) => onChange('themeMode', event.target.value)}
                    >
                        <MenuItem value='system'>{t('layouts.marketing.theme.system', 'System')}</MenuItem>
                        <MenuItem value='light'>{t('layouts.marketing.theme.light', 'Light')}</MenuItem>
                        <MenuItem value='dark'>{t('layouts.marketing.theme.dark', 'Dark')}</MenuItem>
                    </Select>
                </FormControl>
                <TextField
                    size='small'
                    label={t('layouts.marketing.primaryColor', 'Primary color')}
                    value={colorDrafts.primaryColor}
                    error={colorErrors.primaryColor === true}
                    disabled={!controlsEnabled}
                    placeholder='#1976d2'
                    helperText={
                        colorErrors.primaryColor
                            ? t('layouts.marketing.invalidColor', 'Enter a valid contrast-safe hex color.')
                            : t('layouts.marketing.colorHelper', 'Use a hex color such as #1976d2.')
                    }
                    onChange={(event) => updateColorDraft('primaryColor', event.target.value)}
                    onBlur={() => commitColor('primaryColor')}
                />
                <TextField
                    size='small'
                    label={t('layouts.marketing.accentColor', 'Accent color')}
                    value={colorDrafts.accentColor}
                    error={colorErrors.accentColor === true}
                    disabled={!controlsEnabled}
                    placeholder='#9c27b0'
                    helperText={
                        colorErrors.accentColor
                            ? t('layouts.marketing.invalidColor', 'Enter a valid contrast-safe hex color.')
                            : t('layouts.marketing.colorHelper', 'Use a hex color such as #9c27b0.')
                    }
                    onChange={(event) => updateColorDraft('accentColor', event.target.value)}
                    onBlur={() => commitColor('accentColor')}
                />
                <Box>
                    <Typography variant='subtitle2' sx={{ mb: 0.5 }}>
                        {t('layouts.marketing.brandAsset', 'Brand asset')}
                    </Typography>
                    <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                        {config.brandLogo
                            ? t('layouts.marketing.brandAssetConfigured', 'Application logo and alternative text are configured.')
                            : t(
                                  'layouts.marketing.brandAssetInherited',
                                  'The logo and alternative text are inherited from the Site settings Object.'
                              )}
                    </Typography>
                </Box>
                <Box>
                    <Typography variant='subtitle2' sx={{ mb: 0.5 }}>
                        {t('layouts.marketing.actionPolicy', 'Action policy')}
                    </Typography>
                    <Stack spacing={0.25}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={config.allowEmailActions}
                                    disabled={!controlsEnabled}
                                    onChange={(_, checked) => onChange('allowEmailActions', checked)}
                                />
                            }
                            label={t('layouts.marketing.allowEmailActions', 'Allow email actions')}
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={config.allowTelephoneActions}
                                    disabled={!controlsEnabled}
                                    onChange={(_, checked) => onChange('allowTelephoneActions', checked)}
                                />
                            }
                            label={t('layouts.marketing.allowTelephoneActions', 'Allow telephone actions')}
                        />
                        <FormControl size='small' sx={{ mt: 0.5, maxWidth: 260 }}>
                            <InputLabel id='application-marketing-link-target-label'>
                                {t('layouts.marketing.externalLinkTarget', 'External link target')}
                            </InputLabel>
                            <Select
                                id='application-marketing-link-target'
                                labelId='application-marketing-link-target-label'
                                value={config.externalLinkTarget}
                                label={t('layouts.marketing.externalLinkTarget', 'External link target')}
                                disabled={!controlsEnabled}
                                onChange={(event) => onChange('externalLinkTarget', event.target.value)}
                            >
                                <MenuItem value='same-tab'>{t('layouts.marketing.linkTarget.sameTab', 'Same tab')}</MenuItem>
                                <MenuItem value='new-tab'>{t('layouts.marketing.linkTarget.newTab', 'New tab')}</MenuItem>
                            </Select>
                        </FormControl>
                    </Stack>
                </Box>
            </Stack>
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ mt: 2, alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}
            >
                <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                    {t(
                        'layouts.marketing.resetHint',
                        'Restore appearance and action policy defaults. Content records and widget composition will not change.'
                    )}
                </Typography>
                <Button
                    variant='outlined'
                    size='small'
                    startIcon={<RestartAltRoundedIcon />}
                    disabled={!resetEnabled}
                    onClick={onReset}
                    data-testid='application-marketing-appearance-reset'
                >
                    {isResetting
                        ? t('layouts.marketing.resetting', 'Restoring defaults…')
                        : t('layouts.marketing.reset', 'Restore template defaults')}
                </Button>
            </Stack>
        </Paper>
    )
}

export default ApplicationMarketingAppearancePanel
