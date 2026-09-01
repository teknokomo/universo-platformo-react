import {
    Box,
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
import { useEffect, useState } from 'react'
import type {
    ApplicationTemplateKey,
    DashboardSideMenuConfig,
    DashboardSideMenuMode,
    ObjectCollectionRuntimeViewConfig,
    ResolvedDashboardLayoutConfig
} from '@universo-react/types'
import { defaultDashboardLayoutConfig, MARKETING_SECTION_KEYS, marketingPageConfigSchema } from '@universo-react/types'
import { EDITABLE_SIDE_MENU_MODES } from '@universo-react/template-mui'
import type { TFunction } from 'i18next'

const DASHBOARD_CHROME_SETTING_KEYS = [
    'showBreadcrumbs',
    'showSearch',
    'showOverviewCards',
    'showDetailsTitle',
    'showDetailsTable',
    'showFooter'
] as const

type DashboardChromeSettingKey = (typeof DASHBOARD_CHROME_SETTING_KEYS)[number]

type LayoutRuntimeSettingsPanelProps = {
    t: TFunction
    templateKey?: ApplicationTemplateKey
    isScopedLayout: boolean
    layoutConfig: Partial<ResolvedDashboardLayoutConfig>
    objectBehaviorConfig: ObjectCollectionRuntimeViewConfig
    sideMenuConfig: DashboardSideMenuConfig
    reorderPersistenceFieldDraft: string
    viewSettingsSaving: boolean
    canManageLayouts: boolean
    onObjectBehaviorChange: (patch: Partial<ObjectCollectionRuntimeViewConfig>) => void
    onViewSettingChange: (key: string, value: unknown) => void
    onSideMenuConfigChange: (patch: Partial<DashboardSideMenuConfig>) => void
    onReorderPersistenceFieldDraftChange: (value: string) => void
    onCommitReorderPersistenceField: () => void
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
        onViewSettingChange(key, normalized || undefined)
    }
    const sectionLabels: Record<(typeof MARKETING_SECTION_KEYS)[number], string> = {
        hero: t('layouts.marketing.sections.hero', 'Hero'),
        logos: t('layouts.marketing.sections.logos', 'Logo collection'),
        features: t('layouts.marketing.sections.features', 'Features'),
        testimonials: t('layouts.marketing.sections.testimonials', 'Testimonials'),
        highlights: t('layouts.marketing.sections.highlights', 'Highlights'),
        pricing: t('layouts.marketing.sections.pricing', 'Pricing'),
        faq: t('layouts.marketing.sections.faq', 'FAQ'),
        footer: t('layouts.marketing.sections.footer', 'Footer')
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
                    'Configure the published marketing page without editing its content records.'
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
                    disabled={viewSettingsSaving || !canManageLayouts}
                    placeholder='#1976d2'
                    helperText={t('layouts.marketing.colorHelper', 'Use a hex color such as #1976d2.')}
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
                    disabled={viewSettingsSaving || !canManageLayouts}
                    placeholder='#9c27b0'
                    helperText={t('layouts.marketing.colorHelper', 'Use a hex color such as #9c27b0.')}
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
                        {t('layouts.marketing.sectionVisibility', 'Visible sections')}
                    </Typography>
                    <Stack spacing={0.25}>
                        {MARKETING_SECTION_KEYS.map((key) => (
                            <FormControlLabel
                                key={key}
                                control={
                                    <Switch
                                        checked={config.sectionVisibility[key] !== false}
                                        disabled={viewSettingsSaving || !canManageLayouts}
                                        onChange={(_, checked) =>
                                            onViewSettingChange('sectionVisibility', {
                                                ...config.sectionVisibility,
                                                [key]: checked
                                            })
                                        }
                                    />
                                }
                                label={sectionLabels[key]}
                            />
                        ))}
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
    reorderPersistenceFieldDraft,
    viewSettingsSaving,
    canManageLayouts,
    onObjectBehaviorChange,
    onViewSettingChange,
    onSideMenuConfigChange,
    onReorderPersistenceFieldDraftChange,
    onCommitReorderPersistenceField
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
            <Paper variant='outlined' sx={{ p: 2 }}>
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
                    <FormControl size='small' sx={{ minWidth: 220 }}>
                        <InputLabel>{t('objects.runtime.searchMode', 'Search mode')}</InputLabel>
                        <Select
                            value={objectBehaviorConfig.searchMode}
                            label={t('objects.runtime.searchMode', 'Search mode')}
                            disabled={viewSettingsSaving || !canManageLayouts}
                            onChange={(event) =>
                                onObjectBehaviorChange({
                                    searchMode: event.target.value as ObjectCollectionRuntimeViewConfig['searchMode']
                                })
                            }
                        >
                            <MenuItem value='page-local'>{t('objects.runtime.searchModePageLocal', 'Page-local')}</MenuItem>
                            <MenuItem value='server'>{t('objects.runtime.searchModeServer', 'Server')}</MenuItem>
                        </Select>
                    </FormControl>
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
                    <FormControlLabel
                        control={
                            <Switch
                                checked={objectBehaviorConfig.enableRowReordering}
                                disabled={viewSettingsSaving || !canManageLayouts}
                                onChange={(_, checked) => onObjectBehaviorChange({ enableRowReordering: checked })}
                            />
                        }
                        label={t('objects.runtime.enableRowReordering', 'Enable row reordering')}
                    />
                    <TextField
                        size='small'
                        label={t('objects.runtime.reorderPersistenceField', 'Reorder persistence field')}
                        value={reorderPersistenceFieldDraft}
                        disabled={viewSettingsSaving || !canManageLayouts || !objectBehaviorConfig.enableRowReordering}
                        helperText={t(
                            'objects.runtime.reorderPersistenceFieldHelper',
                            'Enter the numeric field codename or column key that stores the persisted row order, for example sort_order.'
                        )}
                        onChange={(event) => onReorderPersistenceFieldDraftChange(event.target.value)}
                        onBlur={onCommitReorderPersistenceField}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault()
                                onCommitReorderPersistenceField()
                            }
                        }}
                    />
                </Stack>
            </Paper>
            <Paper variant='outlined' sx={{ p: 2 }}>
                <Typography variant='subtitle1' sx={{ mb: 1.5 }}>
                    {t('layouts.details.viewSettings', 'Application View Settings')}
                </Typography>
                <Stack spacing={1.5}>
                    {DASHBOARD_CHROME_SETTING_KEYS.map((key: DashboardChromeSettingKey) => (
                        <FormControlLabel
                            key={key}
                            control={
                                <Switch
                                    checked={layoutConfig[key] ?? defaultDashboardLayoutConfig[key]}
                                    disabled={viewSettingsSaving || !canManageLayouts}
                                    onChange={(_, checked) => onViewSettingChange(key, checked)}
                                />
                            }
                            label={t(`layouts.dashboard.sections.${key}`, String(key).replace(/([A-Z])/g, ' $1'))}
                        />
                    ))}
                    <FormControlLabel
                        control={
                            <Switch
                                checked={Boolean(layoutConfig.showViewToggle)}
                                disabled={viewSettingsSaving || !canManageLayouts}
                                onChange={(_, checked) => onViewSettingChange('showViewToggle', checked)}
                            />
                        }
                        label={t('layouts.details.showViewToggle', 'Card/table view toggle')}
                    />
                    <FormControl size='small' sx={{ minWidth: 180 }}>
                        <InputLabel>{t('layouts.details.defaultViewMode', 'Default view mode')}</InputLabel>
                        <Select
                            value={(layoutConfig.defaultViewMode as string) || 'table'}
                            label={t('layouts.details.defaultViewMode', 'Default view mode')}
                            disabled={viewSettingsSaving || !canManageLayouts}
                            onChange={(event) => onViewSettingChange('defaultViewMode', event.target.value)}
                        >
                            <MenuItem value='table'>{t('layouts.details.viewModeTable', 'Table')}</MenuItem>
                            <MenuItem value='card'>{t('layouts.details.viewModeCard', 'Card')}</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={Boolean(layoutConfig.showFilterBar)}
                                disabled={viewSettingsSaving || !canManageLayouts}
                                onChange={(_, checked) => onViewSettingChange('showFilterBar', checked)}
                            />
                        }
                        label={t('layouts.details.showFilterBar', 'Search/filter bar')}
                    />
                    <FormControl size='small' sx={{ minWidth: 180 }}>
                        <InputLabel>{t('layouts.details.cardColumns', 'Card columns')}</InputLabel>
                        <Select
                            value={Number(layoutConfig.cardColumns) || 3}
                            label={t('layouts.details.cardColumns', 'Card columns')}
                            disabled={viewSettingsSaving || !canManageLayouts}
                            onChange={(event) => onViewSettingChange('cardColumns', Number(event.target.value))}
                        >
                            <MenuItem value={2}>2</MenuItem>
                            <MenuItem value={3}>3</MenuItem>
                            <MenuItem value={4}>4</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl size='small' sx={{ minWidth: 180 }}>
                        <InputLabel>{t('layouts.details.rowHeight', 'Row height')}</InputLabel>
                        <Select
                            value={String(layoutConfig.rowHeight ?? 'compact')}
                            label={t('layouts.details.rowHeight', 'Row height')}
                            disabled={viewSettingsSaving || !canManageLayouts}
                            onChange={(event) => {
                                const value = event.target.value
                                onViewSettingChange(
                                    'rowHeight',
                                    value === 'compact' ? undefined : value === 'auto' ? 'auto' : Number(value)
                                )
                            }}
                        >
                            <MenuItem value='compact'>{t('layouts.details.rowHeightCompact', 'Compact (default)')}</MenuItem>
                            <MenuItem value='52'>{t('layouts.details.rowHeightNormal', 'Normal (52px)')}</MenuItem>
                            <MenuItem value='auto'>{t('layouts.details.rowHeightAuto', 'Auto (multi-line)')}</MenuItem>
                        </Select>
                    </FormControl>
                    <Paper variant='outlined' sx={{ p: 1.5, borderRadius: 1.5 }}>
                        <Typography variant='subtitle2' sx={{ mb: 1 }}>
                            {t('layouts.details.sideMenu.title', 'Side menu display')}
                        </Typography>
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
                                    onChange={(event) =>
                                        onSideMenuConfigChange({ primaryMode: event.target.value as DashboardSideMenuMode })
                                    }
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
                    </Paper>
                </Stack>
            </Paper>
        </>
    )
}

export default LayoutRuntimeSettingsPanel
