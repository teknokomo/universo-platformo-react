import type { ReactNode } from 'react'
import { Card, CardContent, FormControl, FormControlLabel, InputLabel, MenuItem, Stack, Switch, Typography } from '@mui/material'
import type { TFunction } from 'i18next'
import { EDITABLE_SIDE_MENU_MODES } from '@universo-react/template-mui'
import type {
    ApplicationLayout,
    DashboardSideMenuConfig,
    DashboardSideMenuMode,
    ObjectCollectionRuntimeViewConfig
} from '@universo-react/types'
import { DropdownSelect as Select } from '@universo-react/template-mui/dropdowns'

type Translate = TFunction<'applications'>

export interface LayoutRuntimeSettingsPanelsProps {
    t: Translate
    layout: ApplicationLayout
    objectBehaviorConfig: ObjectCollectionRuntimeViewConfig
    sideMenuConfig: DashboardSideMenuConfig
    onObjectBehaviorChange: (patch: Partial<ObjectCollectionRuntimeViewConfig>) => void
    onSideMenuConfigChange: (patch: Partial<DashboardSideMenuConfig>) => void
}

export function LayoutRuntimeSettingsPanels({
    t,
    layout,
    objectBehaviorConfig,
    sideMenuConfig,
    onObjectBehaviorChange,
    onSideMenuConfigChange
}: LayoutRuntimeSettingsPanelsProps) {
    return (
        <Stack spacing={2}>
            <PaperSection
                title={
                    layout.scopeEntityId
                        ? t('layouts.objectBehaviorTitleObject', 'Entity runtime behavior')
                        : t('layouts.objectBehaviorTitleGlobal', 'Default entity runtime behavior')
                }
                description={
                    layout.scopeEntityId
                        ? t(
                              'layouts.objectBehaviorDescriptionObject',
                              'This scoped layout overrides the create/search behavior inherited from its global base layout.'
                          )
                        : t(
                              'layouts.objectBehaviorDescriptionGlobal',
                              'These settings define the default create/search behavior for entities that use this global layout until an entity-specific layout overrides it.'
                          )
                }
            >
                <Stack spacing={1.5}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={objectBehaviorConfig.showCreateButton}
                                onChange={(_, checked) => onObjectBehaviorChange({ showCreateButton: checked })}
                            />
                        }
                        label={t('layouts.showCreateButton', 'Show create button')}
                    />
                    {(['create', 'edit', 'copy'] as const).map((surface) => {
                        const configKey = `${surface}Surface` as const
                        return (
                            <FormControl key={surface} size='small' sx={{ minWidth: 220 }}>
                                <InputLabel>{t(`layouts.${configKey}`, `${surface} form type`)}</InputLabel>
                                <Select
                                    value={objectBehaviorConfig[configKey]}
                                    label={t(`layouts.${configKey}`, `${surface} form type`)}
                                    onChange={(event) =>
                                        onObjectBehaviorChange({
                                            [configKey]: event.target.value as ObjectCollectionRuntimeViewConfig[typeof configKey]
                                        })
                                    }
                                >
                                    <MenuItem value='dialog'>{t('layouts.surfaceDialog', 'Dialog')}</MenuItem>
                                    <MenuItem value='page'>{t('layouts.surfacePage', 'Page')}</MenuItem>
                                </Select>
                            </FormControl>
                        )
                    })}
                </Stack>
            </PaperSection>

            <PaperSection
                title={t('layouts.sideMenu.title', 'Side menu display')}
                description={t(
                    'layouts.sideMenu.description',
                    'Control the Dashboard shell navigation. Widget presentation is configured on each widget.'
                )}
            >
                <Stack spacing={1.5}>
                    <Stack spacing={1}>
                        {EDITABLE_SIDE_MENU_MODES.map((mode) => {
                            const isChecked = sideMenuConfig.availableModes.includes(mode)
                            const isLastAvailableMode = isChecked && sideMenuConfig.availableModes.length === 1
                            return (
                                <FormControlLabel
                                    key={mode}
                                    control={
                                        <Switch
                                            checked={isChecked}
                                            disabled={isLastAvailableMode}
                                            onChange={(_, checked) =>
                                                onSideMenuConfigChange({
                                                    availableModes: checked
                                                        ? [...sideMenuConfig.availableModes, mode]
                                                        : sideMenuConfig.availableModes.filter((value) => value !== mode)
                                                })
                                            }
                                        />
                                    }
                                    label={t(`layouts.sideMenu.modes.${mode}`, mode)}
                                />
                            )
                        })}
                        <FormControl size='small' sx={{ minWidth: 180 }}>
                            <InputLabel>{t('layouts.sideMenu.primaryMode', 'Primary display mode')}</InputLabel>
                            <Select
                                value={sideMenuConfig.primaryMode}
                                label={t('layouts.sideMenu.primaryMode', 'Primary display mode')}
                                onChange={(event) => onSideMenuConfigChange({ primaryMode: event.target.value as DashboardSideMenuMode })}
                            >
                                {sideMenuConfig.availableModes.map((mode) => (
                                    <MenuItem key={mode} value={mode}>
                                        {t(`layouts.sideMenu.modes.${mode}`, mode)}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={sideMenuConfig.rememberUserChoice ?? true}
                                    onChange={(_, checked) => onSideMenuConfigChange({ rememberUserChoice: checked })}
                                />
                            }
                            label={t('layouts.sideMenu.rememberUserChoice', 'Remember user choice')}
                        />
                    </Stack>
                </Stack>
            </PaperSection>
        </Stack>
    )
}

function PaperSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
    return (
        <Card variant='outlined' sx={{ borderRadius: 1 }}>
            <CardContent>
                <Typography variant='subtitle1' sx={{ mb: 1.5 }}>
                    {title}
                </Typography>
                <Typography
                    variant='body2'
                    sx={{
                        color: 'text.secondary',
                        mb: 2
                    }}
                >
                    {description}
                </Typography>
                {children}
            </CardContent>
        </Card>
    )
}
