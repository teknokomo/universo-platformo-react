import { FormControl, FormControlLabel, InputLabel, MenuItem, Paper, Stack, Switch, Typography } from '@mui/material'
import type {
    ApplicationTemplateKey,
    DashboardSideMenuConfig,
    DashboardSideMenuMode,
    ObjectCollectionRuntimeViewConfig
} from '@universo-react/types'
import { EDITABLE_SIDE_MENU_MODES } from '@universo-react/template-mui'
import type { TFunction } from 'i18next'
import { DropdownSelect as Select } from '@universo-react/template-mui/dropdowns'

type LayoutRuntimeSettingsPanelProps = {
    t: TFunction
    templateKey?: ApplicationTemplateKey
    isScopedLayout: boolean
    objectBehaviorConfig: ObjectCollectionRuntimeViewConfig
    sideMenuConfig: DashboardSideMenuConfig
    viewSettingsSaving: boolean
    canManageLayouts: boolean
    onObjectBehaviorChange: (patch: Partial<ObjectCollectionRuntimeViewConfig>) => void
    onSideMenuConfigChange: (patch: Partial<DashboardSideMenuConfig>) => void
}

export function LayoutRuntimeSettingsPanel({
    t,
    templateKey = 'dashboard',
    isScopedLayout,
    objectBehaviorConfig,
    sideMenuConfig,
    viewSettingsSaving,
    canManageLayouts,
    onObjectBehaviorChange,
    onSideMenuConfigChange
}: LayoutRuntimeSettingsPanelProps) {
    return (
        <>
            {templateKey !== 'dashboard' ? null : (
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
                        </Stack>
                    </Paper>
                </>
            )}
        </>
    )
}

export default LayoutRuntimeSettingsPanel
