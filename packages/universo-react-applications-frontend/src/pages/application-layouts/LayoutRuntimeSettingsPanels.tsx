import type { ReactNode } from 'react'
import {
    Box,
    Card,
    CardContent,
    Divider,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Switch,
    Typography
} from '@mui/material'
import type { TFunction } from 'i18next'
import { EDITABLE_SIDE_MENU_MODES } from '@universo-react/template-mui'
import type {
    ApplicationLayout,
    DashboardSideMenuConfig,
    DashboardSideMenuMode,
    ObjectCollectionRuntimeViewConfig
} from '@universo-react/types'

type Translate = TFunction<'applications'>

export interface LayoutRuntimeSettingsPanelsProps {
    t: Translate
    layout: ApplicationLayout
    objectBehaviorConfig: ObjectCollectionRuntimeViewConfig
    sideMenuConfig: DashboardSideMenuConfig
    onObjectBehaviorChange: (patch: Partial<ObjectCollectionRuntimeViewConfig>) => void
    onViewSettingChange: (key: string, value: unknown) => void
    onSideMenuConfigChange: (patch: Partial<DashboardSideMenuConfig>) => void
}

export function LayoutRuntimeSettingsPanels({
    t,
    layout,
    objectBehaviorConfig,
    sideMenuConfig,
    onObjectBehaviorChange,
    onViewSettingChange,
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
                    <FormControl size='small' sx={{ minWidth: 220 }}>
                        <InputLabel>{t('layouts.searchMode', 'Search mode')}</InputLabel>
                        <Select
                            value={objectBehaviorConfig.searchMode}
                            label={t('layouts.searchMode', 'Search mode')}
                            onChange={(event) =>
                                onObjectBehaviorChange({
                                    searchMode: event.target.value as ObjectCollectionRuntimeViewConfig['searchMode']
                                })
                            }
                        >
                            <MenuItem value='page-local'>{t('layouts.searchModePageLocal', 'Page-local')}</MenuItem>
                            <MenuItem value='server'>{t('layouts.searchModeServer', 'Server')}</MenuItem>
                        </Select>
                    </FormControl>
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
                    <FormControlLabel
                        control={
                            <Switch
                                checked={objectBehaviorConfig.enableRowReordering}
                                onChange={(_, checked) => onObjectBehaviorChange({ enableRowReordering: checked })}
                            />
                        }
                        label={t('layouts.enableRowReordering', 'Enable row reordering')}
                    />
                </Stack>
            </PaperSection>

            <PaperSection
                title={t('layouts.viewSettings', 'Application View Settings')}
                description={t('layouts.viewSettingsDescription', 'Control how the runtime list view behaves for this layout.')}
            >
                <Stack spacing={1.5}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={Boolean(layout.config?.showViewToggle)}
                                onChange={(_, checked) => onViewSettingChange('showViewToggle', checked)}
                            />
                        }
                        label={t('layouts.showViewToggle', 'Card/table view toggle')}
                    />
                    <FormControl size='small' sx={{ minWidth: 180 }}>
                        <InputLabel>{t('layouts.defaultViewMode', 'Default view mode')}</InputLabel>
                        <Select
                            value={(layout.config?.defaultViewMode as string) || 'table'}
                            label={t('layouts.defaultViewMode', 'Default view mode')}
                            onChange={(event) => onViewSettingChange('defaultViewMode', event.target.value)}
                        >
                            <MenuItem value='table'>{t('layouts.viewModeTable', 'Table')}</MenuItem>
                            <MenuItem value='card'>{t('layouts.viewModeCard', 'Card')}</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={Boolean(layout.config?.showFilterBar)}
                                onChange={(_, checked) => onViewSettingChange('showFilterBar', checked)}
                            />
                        }
                        label={t('layouts.showFilterBar', 'Search/filter bar')}
                    />
                    <FormControl size='small' sx={{ minWidth: 180 }}>
                        <InputLabel>{t('layouts.cardColumns', 'Card columns')}</InputLabel>
                        <Select
                            value={Number(layout.config?.cardColumns) || 3}
                            label={t('layouts.cardColumns', 'Card columns')}
                            onChange={(event) => onViewSettingChange('cardColumns', Number(event.target.value))}
                        >
                            <MenuItem value={2}>2</MenuItem>
                            <MenuItem value={3}>3</MenuItem>
                            <MenuItem value={4}>4</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl size='small' sx={{ minWidth: 180 }}>
                        <InputLabel>{t('layouts.rowHeight', 'Row height')}</InputLabel>
                        <Select
                            value={String(layout.config?.rowHeight ?? 'compact')}
                            label={t('layouts.rowHeight', 'Row height')}
                            onChange={(event) => {
                                const value = event.target.value
                                onViewSettingChange(
                                    'rowHeight',
                                    value === 'compact' ? undefined : value === 'auto' ? 'auto' : Number(value)
                                )
                            }}
                        >
                            <MenuItem value='compact'>{t('layouts.rowHeightCompact', 'Compact (default)')}</MenuItem>
                            <MenuItem value='52'>{t('layouts.rowHeightNormal', 'Normal (52px)')}</MenuItem>
                            <MenuItem value='auto'>{t('layouts.rowHeightAuto', 'Auto (multi-line)')}</MenuItem>
                        </Select>
                    </FormControl>
                    <Box sx={{ width: '100%' }}>
                        <Divider sx={{ mb: 1.5 }} />
                        <Typography variant='subtitle2' sx={{ mb: 1 }}>
                            {t('layouts.sideMenu.title', 'Side menu display')}
                        </Typography>
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
                                    onChange={(event) =>
                                        onSideMenuConfigChange({ primaryMode: event.target.value as DashboardSideMenuMode })
                                    }
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
                    </Box>
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
                <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
                    {description}
                </Typography>
                {children}
            </CardContent>
        </Card>
    )
}
