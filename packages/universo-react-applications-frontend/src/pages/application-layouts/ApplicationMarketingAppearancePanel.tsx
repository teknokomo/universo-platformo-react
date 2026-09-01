import {
    Alert,
    Box,
    Button,
    Chip,
    FormControl,
    FormControlLabel,
    IconButton,
    InputLabel,
    List,
    ListItem,
    ListItemText,
    MenuItem,
    Paper,
    Select,
    Stack,
    Switch,
    TextField,
    Typography
} from '@mui/material'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import { useEffect, useState } from 'react'
import type { TFunction } from 'i18next'
import { MARKETING_SECTION_KEYS, marketingPageConfigSchema, type ApplicationLayout, type MarketingSectionKey } from '@universo-react/types'

interface ApplicationMarketingAppearancePanelProps {
    t: TFunction<'applications'>
    layout: ApplicationLayout
    isSaving: boolean
    isResetting: boolean
    canManage: boolean
    onChange: (key: string, value: unknown) => void
    onReset: () => void
}

const normalizeSectionOrder = (order: readonly MarketingSectionKey[]): MarketingSectionKey[] => {
    const seen = new Set<MarketingSectionKey>()
    const contentOrder = order.filter((key) => {
        if (key === 'footer' || seen.has(key)) return false
        seen.add(key)
        return true
    })

    for (const key of MARKETING_SECTION_KEYS) {
        if (key !== 'footer' && !seen.has(key)) {
            seen.add(key)
            contentOrder.push(key)
        }
    }

    return [...contentOrder, 'footer']
}

/** Typed application-level appearance controls for the marketing template. */
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
    const sectionOrder = normalizeSectionOrder(config.sectionOrder)
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
    const labels: Record<(typeof MARKETING_SECTION_KEYS)[number], string> = {
        hero: t('layouts.marketing.sections.hero', 'Hero'),
        logos: t('layouts.marketing.sections.logos', 'Logo collection'),
        features: t('layouts.marketing.sections.features', 'Features'),
        testimonials: t('layouts.marketing.sections.testimonials', 'Testimonials'),
        highlights: t('layouts.marketing.sections.highlights', 'Highlights'),
        pricing: t('layouts.marketing.sections.pricing', 'Pricing'),
        faq: t('layouts.marketing.sections.faq', 'FAQ'),
        footer: t('layouts.marketing.sections.footer', 'Footer')
    }

    const moveSection = (key: MarketingSectionKey, direction: -1 | 1) => {
        if (!controlsEnabled || key === 'footer') return
        const currentIndex = sectionOrder.indexOf(key)
        const nextIndex = currentIndex + direction
        if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sectionOrder.length - 1) return
        const nextOrder = [...sectionOrder]
        ;[nextOrder[currentIndex], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[currentIndex]]
        onChange('sectionOrder', nextOrder)
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
            <Typography
                variant='body2'
                sx={{
                    color: 'text.secondary',
                    mb: 2
                }}
            >
                {t(
                    'layouts.marketing.appearanceDescription',
                    'Configure the published marketing page without editing its content records.'
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
                    <Typography
                        variant='body2'
                        sx={{
                            color: 'text.secondary'
                        }}
                    >
                        {config.brandLogo
                            ? t('layouts.marketing.brandAssetConfigured', 'Application logo and alternative text are configured.')
                            : t(
                                  'layouts.marketing.brandAssetInherited',
                                  'The logo and alternative text are inherited from the Site settings Object. Edit that record through standard content authoring.'
                              )}
                    </Typography>
                </Box>
                <Box>
                    <Typography variant='subtitle2' sx={{ mb: 0.5 }}>
                        {t('layouts.marketing.sectionVisibility', 'Visible sections')}
                    </Typography>
                    <Stack spacing={0.25}>
                        {MARKETING_SECTION_KEYS.map((key) => (
                            <FormControlLabel
                                key={key}
                                control={
                                    <Switch
                                        checked={config.sectionVisibility[key] !== false}
                                        disabled={!controlsEnabled}
                                        onChange={(_, checked) =>
                                            onChange('sectionVisibility', {
                                                ...config.sectionVisibility,
                                                [key]: checked
                                            })
                                        }
                                    />
                                }
                                label={labels[key]}
                            />
                        ))}
                    </Stack>
                </Box>
                <Box>
                    <Typography variant='subtitle2' sx={{ mb: 0.5 }}>
                        {t('layouts.marketing.sectionOrder', 'Section order')}
                    </Typography>
                    <Typography
                        variant='body2'
                        sx={{
                            color: 'text.secondary',
                            mb: 0.5
                        }}
                    >
                        {t(
                            'layouts.marketing.sectionOrderDescription',
                            'Choose the order in which content sections appear. The footer stays last.'
                        )}
                    </Typography>
                    <List dense disablePadding>
                        {sectionOrder.map((key, index) => {
                            const isFooter = key === 'footer'
                            return (
                                <ListItem
                                    key={key}
                                    disableGutters
                                    secondaryAction={
                                        <Stack direction='row' spacing={0.25}>
                                            <IconButton
                                                size='small'
                                                disabled={!controlsEnabled || isFooter || index === 0}
                                                aria-label={t('layouts.marketing.moveSectionUp', 'Move {{section}} up', {
                                                    section: labels[key]
                                                })}
                                                onClick={() => moveSection(key, -1)}
                                                data-testid={`application-marketing-section-up-${key}`}
                                            >
                                                <ArrowUpwardRoundedIcon fontSize='small' />
                                            </IconButton>
                                            <IconButton
                                                size='small'
                                                disabled={!controlsEnabled || isFooter || index >= sectionOrder.length - 2}
                                                aria-label={t('layouts.marketing.moveSectionDown', 'Move {{section}} down', {
                                                    section: labels[key]
                                                })}
                                                onClick={() => moveSection(key, 1)}
                                                data-testid={`application-marketing-section-down-${key}`}
                                            >
                                                <ArrowDownwardRoundedIcon fontSize='small' />
                                            </IconButton>
                                        </Stack>
                                    }
                                    data-testid={`application-marketing-section-order-${key}`}
                                >
                                    <ListItemText
                                        primary={labels[key]}
                                        secondary={isFooter ? t('layouts.marketing.footerFixed', 'Fixed at the end') : undefined}
                                    />
                                </ListItem>
                            )
                        })}
                    </List>
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
                <Typography
                    variant='body2'
                    sx={{
                        color: 'text.secondary'
                    }}
                >
                    {t(
                        'layouts.marketing.resetHint',
                        'Restore the theme, colors, section order, visibility, and action policy to the marketing template defaults.'
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
