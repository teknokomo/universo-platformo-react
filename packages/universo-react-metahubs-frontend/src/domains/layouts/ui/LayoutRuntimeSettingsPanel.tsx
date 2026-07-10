import { FormControl, FormControlLabel, InputLabel, MenuItem, Paper, Select, Stack, Switch, TextField, Typography } from '@mui/material'
import type {
    DashboardSideMenuConfig,
    DashboardSideMenuMode,
    ObjectCollectionRuntimeViewConfig,
    ResolvedDashboardLayoutConfig
} from '@universo-react/types'
import { defaultDashboardLayoutConfig } from '@universo-react/types'
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

export function LayoutRuntimeSettingsPanel({
    t,
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
    return (
        <>
            <Paper variant='outlined' sx={{ p: 2 }}>
                <Typography variant='subtitle1' sx={{ mb: 1.5 }}>
                    {isScopedLayout
                        ? t('layouts.details.objectBehaviorTitleObject', 'Entity runtime behavior')
                        : t('layouts.details.objectBehaviorTitleGlobal', 'Default entity runtime behavior')}
                </Typography>
                <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
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
