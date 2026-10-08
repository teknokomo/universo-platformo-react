import { Box, FormControl, FormControlLabel, InputLabel, MenuItem, Paper, Stack, Switch, TextField, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import type {
    ApplicationTemplateKey,
    DashboardSideMenuConfig,
    DashboardSideMenuMode,
    ObjectCollectionRuntimeViewConfig,
    ResolvedDashboardLayoutConfig
} from '@universo-react/types'
import { marketingPageConfigSchema } from '@universo-react/types'
import { EDITABLE_SIDE_MENU_MODES } from '@universo-react/template-mui'
import type { TFunction } from 'i18next'
import { DropdownSelect as Select } from '@universo-react/template-mui/dropdowns'

type LayoutRuntimeSettingsPanelProps = {
    t: TFunction
    templateKey?: ApplicationTemplateKey
    isScopedLayout: boolean
    layoutConfig: Partial<ResolvedDashboardLayoutConfig>
    objectBehaviorConfig: ObjectCollectionRuntimeViewConfig
    sideMenuConfig: DashboardSideMenuConfig
    viewSettingsSaving: boolean
    canManageLayouts: boolean
    onObjectBehaviorChange: (patch: Partial<ObjectCollectionRuntimeViewConfig>) => void
    onViewSettingChange: (key: string, value: unknown) => void
    onSideMenuConfigChange: (patch: Partial<DashboardSideMenuConfig>) => void
}

function MarketingAppearancePanel({
    t,
    layoutConfig,
    viewSettingsSaving,
    canManageLayouts,
    onViewSettingChange
}: Pick<LayoutRuntimeSettingsPanelProps, 't' | 'layoutConfig' | 'viewSettingsSaving' | 'canManageLayouts' | 'onViewSettingChange'>) {
    const parsed = marketingPageConfigSchema.safeParse(layoutConfig)
    const config = parsed.success ? parsed.data : marketingPageConfigSchema.parse({})
    const persistedPrimaryColor = typeof layoutConfig.primaryColor === 'string' ? layoutConfig.primaryColor : ''
    const persistedAccentColor = typeof layoutConfig.accentColor === 'string' ? layoutConfig.accentColor : ''
    const [primaryColorDraft, setPrimaryColorDraft] = useState(persistedPrimaryColor)
    const [accentColorDraft, setAccentColorDraft] = useState(persistedAccentColor)
    const [colorErrors, setColorErrors] = useState<{ primaryColor?: boolean; accentColor?: boolean }>({})

    useEffect(() => {
        setPrimaryColorDraft(persistedPrimaryColor)
    }, [persistedPrimaryColor])

    useEffect(() => {
        setAccentColorDraft(persistedAccentColor)
    }, [persistedAccentColor])

    const commitColor = (key: 'primaryColor' | 'accentColor', value: string): void => {
        const normalized = value.trim()
        const persistedValue = key === 'primaryColor' ? persistedPrimaryColor : persistedAccentColor
        if (normalized === persistedValue) return
        const nextConfig = { ...config, [key]: normalized || undefined }
        if (!marketingPageConfigSchema.safeParse(nextConfig).success) {
            setColorErrors((current) => ({ ...current, [key]: true }))
            return
        }
        setColorErrors((current) => ({ ...current, [key]: false }))
        onViewSettingChange(key, normalized || undefined)
    }
    return (
        <Paper variant='outlined' sx={{ p: 2 }} data-testid='marketing-appearance-panel'>
            <Typography variant='subtitle1' sx={{ mb: 0.5 }}>
                {t('layouts.marketing.appearanceTitle', 'Marketing page appearance')}
            </Typography>
            <Typography
                variant='body2'
                sx={{
                    color: 'text.secondary',
                    mb: 2
                }}
            >
                {t(
                    'layouts.marketing.appearanceDescription',
                    'Configure the published marketing page appearance and actions. Widget composition is managed below.'
                )}
            </Typography>
            <Stack spacing={1.5}>
                <FormControl size='small' sx={{ minWidth: 220 }}>
                    <InputLabel id='metahub-marketing-theme-mode-label'>{t('layouts.marketing.themeMode', 'Theme mode')}</InputLabel>
                    <Select
                        id='metahub-marketing-theme-mode'
                        labelId='metahub-marketing-theme-mode-label'
                        value={config.themeMode}
                        label={t('layouts.marketing.themeMode', 'Theme mode')}
                        disabled={viewSettingsSaving || !canManageLayouts}
                        onChange={(event) => onViewSettingChange('themeMode', event.target.value)}
                    >
                        <MenuItem value='system'>{t('layouts.marketing.theme.system', 'System')}</MenuItem>
                        <MenuItem value='light'>{t('layouts.marketing.theme.light', 'Light')}</MenuItem>
                        <MenuItem value='dark'>{t('layouts.marketing.theme.dark', 'Dark')}</MenuItem>
                    </Select>
                </FormControl>
                <TextField
                    size='small'
                    label={t('layouts.marketing.primaryColor', 'Primary color')}
                    value={primaryColorDraft}
                    error={colorErrors.primaryColor === true}
                    disabled={viewSettingsSaving || !canManageLayouts}
                    placeholder='#1976d2'
                    helperText={
                        colorErrors.primaryColor
                            ? t('layouts.marketing.invalidColor', 'Enter a valid contrast-safe hex color.')
                            : t('layouts.marketing.colorHelper', 'Use a hex color such as #1976d2.')
                    }
                    onChange={(event) => setPrimaryColorDraft(event.target.value)}
                    onBlur={() => commitColor('primaryColor', primaryColorDraft)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault()
                            commitColor('primaryColor', primaryColorDraft)
                            event.currentTarget.blur()
                        }
                    }}
                />
                <TextField
                    size='small'
                    label={t('layouts.marketing.accentColor', 'Accent color')}
                    value={accentColorDraft}
                    error={colorErrors.accentColor === true}
                    disabled={viewSettingsSaving || !canManageLayouts}
                    placeholder='#9c27b0'
                    helperText={
                        colorErrors.accentColor
                            ? t('layouts.marketing.invalidColor', 'Enter a valid contrast-safe hex color.')
                            : t('layouts.marketing.colorHelper', 'Use a hex color such as #9c27b0.')
                    }
                    onChange={(event) => setAccentColorDraft(event.target.value)}
                    onBlur={() => commitColor('accentColor', accentColorDraft)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault()
                            commitColor('accentColor', accentColorDraft)
                            event.currentTarget.blur()
                        }
                    }}
                />
                <Box>
                    <Typography variant='subtitle2' sx={{ mb: 0.5 }}>
                        {t('layouts.marketing.actionPolicy', 'Action policy')}
                    </Typography>
                    <Stack spacing={0.25}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={config.allowEmailActions}
                                    disabled={viewSettingsSaving || !canManageLayouts}
                                    onChange={(_, checked) => onViewSettingChange('allowEmailActions', checked)}
                                />
                            }
                            label={t('layouts.marketing.allowEmailActions', 'Allow email actions')}
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={config.allowTelephoneActions}
                                    disabled={viewSettingsSaving || !canManageLayouts}
                                    onChange={(_, checked) => onViewSettingChange('allowTelephoneActions', checked)}
                                />
                            }
                            label={t('layouts.marketing.allowTelephoneActions', 'Allow telephone actions')}
                        />
                        <FormControl size='small' sx={{ mt: 0.5, maxWidth: 260 }}>
                            <InputLabel id='metahub-marketing-link-target-label'>
                                {t('layouts.marketing.externalLinkTarget', 'External link target')}
                            </InputLabel>
                            <Select
                                id='metahub-marketing-link-target'
                                labelId='metahub-marketing-link-target-label'
                                value={config.externalLinkTarget}
                                label={t('layouts.marketing.externalLinkTarget', 'External link target')}
                                disabled={viewSettingsSaving || !canManageLayouts}
                                onChange={(event) => onViewSettingChange('externalLinkTarget', event.target.value)}
                            >
                                <MenuItem value='same-tab'>{t('layouts.marketing.linkTarget.sameTab', 'Same tab')}</MenuItem>
                                <MenuItem value='new-tab'>{t('layouts.marketing.linkTarget.newTab', 'New tab')}</MenuItem>
                            </Select>
                        </FormControl>
                    </Stack>
                </Box>
            </Stack>
        </Paper>
    )
}

export function LayoutRuntimeSettingsPanel({
    t,
    templateKey = 'dashboard',
    isScopedLayout,
    layoutConfig,
    objectBehaviorConfig,
    sideMenuConfig,
    viewSettingsSaving,
    canManageLayouts,
    onObjectBehaviorChange,
    onViewSettingChange,
    onSideMenuConfigChange
}: LayoutRuntimeSettingsPanelProps) {
    if (templateKey === 'marketing-page') {
        return (
            <MarketingAppearancePanel
                t={t}
                layoutConfig={layoutConfig}
                viewSettingsSaving={viewSettingsSaving}
                canManageLayouts={canManageLayouts}
                onViewSettingChange={onViewSettingChange}
            />
        )
    }

    return (
        <>
            <Paper variant='outlined' sx={{ p: 2 }} data-testid='layout-runtime-settings-panel'>
                <Typography variant='subtitle1' sx={{ mb: 1.5 }}>
                    {isScopedLayout
                        ? t('layouts.details.objectBehaviorTitleObject', 'Entity runtime behavior')
                        : t('layouts.details.objectBehaviorTitleGlobal', 'Default entity runtime behavior')}
                </Typography>
                <Typography
                    variant='body2'
                    sx={{
                        color: 'text.secondary',
                        mb: 2
                    }}
                >
                    {isScopedLayout
                        ? t(
                              'layouts.details.objectBehaviorDescriptionObject',
                              'This scoped layout overrides the create/search behavior inherited from its global base layout.'
                          )
                        : t(
                              'layouts.details.objectBehaviorDescriptionGlobal',
                              'These settings define the default create/search behavior for entities that use this global layout until an entity-specific layout overrides it.'
                          )}
                </Typography>
                <Stack spacing={1.5}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={objectBehaviorConfig.showCreateButton}
                                disabled={viewSettingsSaving || !canManageLayouts}
                                onChange={(_, checked) => onObjectBehaviorChange({ showCreateButton: checked })}
                            />
                        }
                        label={t('objects.runtime.showCreateButton', 'Show create button')}
                    />
                    {(['createSurface', 'editSurface', 'copySurface'] as const).map((key) => (
                        <FormControl key={key} size='small' sx={{ minWidth: 220 }}>
                            <InputLabel>{t(`objects.runtime.${key}`, key)}</InputLabel>
                            <Select
                                value={objectBehaviorConfig[key]}
                                label={t(`objects.runtime.${key}`, key)}
                                disabled={viewSettingsSaving || !canManageLayouts}
                                onChange={(event) =>
                                    onObjectBehaviorChange({
                                        [key]: event.target.value as ObjectCollectionRuntimeViewConfig[typeof key]
                                    } as Partial<ObjectCollectionRuntimeViewConfig>)
                                }
                            >
                                <MenuItem value='dialog'>{t('objects.runtime.surfaceDialog', 'Dialog')}</MenuItem>
                                <MenuItem value='page'>{t('objects.runtime.surfacePage', 'Page')}</MenuItem>
                            </Select>
                        </FormControl>
                    ))}
                </Stack>
            </Paper>
            <Paper variant='outlined' sx={{ p: 2 }}>
                <Typography variant='subtitle1' sx={{ mb: 1.5 }}>
                    {t('layouts.details.sideMenu.title', 'Side menu display')}
                </Typography>
                <Stack spacing={1.5}>
                    <Stack spacing={1}>
                        {EDITABLE_SIDE_MENU_MODES.map((mode) => {
                            const checked = sideMenuConfig.availableModes.includes(mode)
                            const isLastAvailableMode = checked && sideMenuConfig.availableModes.length <= 1
                            return (
                                <FormControlLabel
                                    key={mode}
                                    control={
                                        <Switch
                                            checked={checked}
                                            disabled={viewSettingsSaving || !canManageLayouts || isLastAvailableMode}
                                            onChange={(_, nextChecked) => {
                                                const nextModes = nextChecked
                                                    ? [...sideMenuConfig.availableModes, mode]
                                                    : sideMenuConfig.availableModes.filter((value) => value !== mode)
                                                onSideMenuConfigChange({ availableModes: nextModes })
                                            }}
                                        />
                                    }
                                    label={t(`layouts.details.sideMenu.modes.${mode}`, mode)}
                                />
                            )
                        })}
                        <FormControl size='small' sx={{ minWidth: 180 }}>
                            <InputLabel>{t('layouts.details.sideMenu.primaryMode', 'Primary display mode')}</InputLabel>
                            <Select
                                value={sideMenuConfig.primaryMode}
                                label={t('layouts.details.sideMenu.primaryMode', 'Primary display mode')}
                                disabled={viewSettingsSaving || !canManageLayouts}
                                onChange={(event) => onSideMenuConfigChange({ primaryMode: event.target.value as DashboardSideMenuMode })}
                            >
                                {sideMenuConfig.availableModes.map((mode) => (
                                    <MenuItem key={mode} value={mode}>
                                        {t(`layouts.details.sideMenu.modes.${mode}`, mode)}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={sideMenuConfig.rememberUserChoice ?? true}
                                    disabled={viewSettingsSaving || !canManageLayouts}
                                    onChange={(_, checked) => onSideMenuConfigChange({ rememberUserChoice: checked })}
                                />
                            }
                            label={t('layouts.details.sideMenu.rememberUserChoice', 'Remember user choice')}
                        />
                    </Stack>
                </Stack>
            </Paper>
        </>
    )
}

export default LayoutRuntimeSettingsPanel
