import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    FormControlLabel,
    MenuItem,
    Stack,
    Switch,
    TextField,
    Typography
} from '@mui/material'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import { parseInterpretationNetworkHexColor } from '@universo-react/types'
import { type RuntimeWorkspaceSetting, type RuntimeWorkspaceSettingsResponse, type RuntimeWorkspaceWidgetSetting } from '../api/workspaces'
import { ViewHeaderMUI as ViewHeader } from '../components/runtime-ui'
import { HexColorField } from '../components/forms/HexColorField'
import { useRuntimeWorkspaceSettings } from './useRuntimeWorkspaceSettings'

type SettingValueOption = { value: string; label: string }
type WidgetSettingTranslation = { key: string; fallback: string }
type EffectiveWidgetConfig = RuntimeWorkspaceSettingsResponse['effectiveWidgetConfigs'][number]

interface RuntimeWorkspaceSettingsPanelProps {
    applicationId: string
    apiBaseUrl: string
    workspaceId: string
    workspaceName: string
    workspaceExists: boolean
    workspaceIsLoading: boolean
    workspaceLoadFailed: boolean
    error: string | null
    isResettingSeededContent: boolean
    onClearError: () => void
    onResetSeededContent: () => void
    onMutationError: (error: Error) => void
}

const WIDGET_STYLE_SETTING_LABELS: Record<string, WidgetSettingTranslation> = {
    'interpretationNetwork.cellStylePolicy.allowedColors': {
        key: 'workspace.widgetSettings.allowedColors',
        fallback: 'Allowed colors'
    },
    'interpretationNetwork.cellStylePolicy.allowCustomColors': {
        key: 'workspace.widgetSettings.allowCustomColors',
        fallback: 'Allow custom colors'
    },
    'interpretationNetwork.cellStylePolicy.editable.fillColor': {
        key: 'workspace.widgetSettings.fillColor',
        fallback: 'Allow fill color changes'
    },
    'interpretationNetwork.cellStylePolicy.editable.textColor': {
        key: 'workspace.widgetSettings.textColor',
        fallback: 'Allow text color changes'
    },
    'interpretationNetwork.cellStylePolicy.editable.borderColor': {
        key: 'workspace.widgetSettings.borderColor',
        fallback: 'Allow border color changes'
    },
    'interpretationNetwork.cellStylePolicy.editable.borderWidth': {
        key: 'workspace.widgetSettings.borderWidth',
        fallback: 'Allow border width changes'
    },
    'interpretationNetwork.cellStylePolicy.editable.borderStyle': {
        key: 'workspace.widgetSettings.borderStyle',
        fallback: 'Allow border style changes'
    }
}

const getNextAvailableStyleColor = (colors: readonly string[]): string | null => {
    const usedColors = new Set(colors.map((color) => parseInterpretationNetworkHexColor(color) ?? color.toUpperCase()))
    const preferredColors = [
        '#607D8B',
        '#795548',
        '#9E9E9E',
        '#C2185B',
        '#5E35B1',
        '#00838F',
        '#7CB342',
        '#F4511E',
        '#D32F2F',
        '#1976D2',
        '#FBC02D',
        '#7B1FA2',
        '#00796B',
        '#EF6C00',
        '#455A64',
        '#AFB42B',
        '#E64A19',
        '#3949AB',
        '#0097A7',
        '#689F38',
        '#F06292',
        '#7986CB',
        '#4DB6AC',
        '#FFB74D'
    ]
    return preferredColors.find((color) => !usedColors.has(color)) ?? null
}

const SETTING_VALUE_LABELS: Record<string, WidgetSettingTranslation> = {
    'dashboardDefaultMode.layout-default': {
        key: 'workspace.settingOptions.dashboardDefaultMode.layoutDefault',
        fallback: 'Layout default'
    },
    'dashboardDefaultMode.first-menu-item': {
        key: 'workspace.settingOptions.dashboardDefaultMode.firstMenuItem',
        fallback: 'First menu item'
    },
    'workspaceOpenBehavior.last-used': {
        key: 'workspace.settingOptions.workspaceOpenBehavior.lastUsed',
        fallback: 'Last used workspace'
    },
    'workspaceOpenBehavior.default-workspace': {
        key: 'workspace.settingOptions.workspaceOpenBehavior.defaultWorkspace',
        fallback: 'Default workspace'
    },
    'learningContent.defaultView.table': {
        key: 'workspace.settingOptions.learningContent.defaultView.table',
        fallback: 'Table'
    },
    'learningContent.defaultView.cards': {
        key: 'workspace.settingOptions.learningContent.defaultView.cards',
        fallback: 'Cards'
    },
    'learningContent.playerPreset.completeButtonMode.manual': {
        key: 'workspace.settingOptions.learningContent.completeButtonMode.manual',
        fallback: 'Manual'
    },
    'learningContent.playerPreset.completeButtonMode.autoAfterOpen': {
        key: 'workspace.settingOptions.learningContent.completeButtonMode.autoAfterOpen',
        fallback: 'Automatically after opening'
    },
    'learningContent.playerPreset.completeButtonMode.hidden': {
        key: 'workspace.settingOptions.learningContent.completeButtonMode.hidden',
        fallback: 'Hidden'
    }
}

const readInputChangeValue = (value: unknown): string => {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object') return ''
    const target = (value as { target?: { value?: unknown } }).target
    return typeof target?.value === 'string' ? target.value : ''
}

const readCheckboxChangeValue = (value: unknown): boolean => {
    if (typeof value === 'boolean') return value
    if (!value || typeof value !== 'object') return false
    const target = (value as { target?: { checked?: unknown } }).target
    return target?.checked === true
}

const readNumericInputValue = (value: unknown): number => {
    const rawValue = readInputChangeValue(value)
    const parsed = Number(rawValue)
    return Number.isFinite(parsed) ? parsed : 0
}

/** Renders localized workspace overrides and the effective widget settings for one workspace. */
export function RuntimeWorkspaceSettingsPanel({
    applicationId,
    apiBaseUrl,
    workspaceId,
    workspaceName,
    workspaceExists,
    workspaceIsLoading,
    workspaceLoadFailed,
    error,
    isResettingSeededContent,
    onClearError,
    onResetSeededContent,
    onMutationError
}: RuntimeWorkspaceSettingsPanelProps) {
    const { t } = useTranslation('apps')
    const {
        query: settingsQuery,
        isPending,
        updateSetting,
        resetSetting
    } = useRuntimeWorkspaceSettings({
        applicationId,
        apiBaseUrl,
        workspaceId,
        enabled: true,
        onMutationStart: onClearError,
        onMutationError
    })
    const widgetSettingsGroups = useMemo(() => {
        const groups = new Map<string, RuntimeWorkspaceWidgetSetting[]>()
        const effectiveWidgets = new Map<string, EffectiveWidgetConfig>(
            (settingsQuery.data?.effectiveWidgetConfigs ?? []).map((config) => [config.target.instanceKey, config])
        )
        for (const setting of settingsQuery.data?.widgetSettings ?? []) {
            const group = groups.get(setting.target.instanceKey) ?? []
            group.push(setting)
            groups.set(setting.target.instanceKey, group)
        }
        return Array.from(groups.entries()).map(([instanceKey, settings]) => ({
            instanceKey,
            settings,
            widget: effectiveWidgets.get(instanceKey)
        }))
    }, [settingsQuery.data?.effectiveWidgetConfigs, settingsQuery.data?.widgetSettings])

    const canManage = settingsQuery.data?.canManage === true && !isPending
    const handleSettingChange = (setting: RuntimeWorkspaceSetting | RuntimeWorkspaceWidgetSetting, value: unknown) => {
        updateSetting(setting, value)
    }
    const handleSettingReset = (setting: RuntimeWorkspaceSetting | RuntimeWorkspaceWidgetSetting) => {
        resetSetting(setting)
    }

    return (
        <>
            <ViewHeader
                title={workspaceName ? `${workspaceName}: ${t('workspace.settings', 'Settings')}` : t('workspace.settings', 'Settings')}
                description={t('workspace.settingsDescription', 'Workspace-level overrides for application settings.')}
                controlsWrap
            >
                <Button
                    variant='outlined'
                    color='warning'
                    startIcon={<RestartAltRoundedIcon />}
                    disabled={settingsQuery.data?.canManage !== true || isResettingSeededContent}
                    onClick={() => {
                        onClearError()
                        onResetSeededContent()
                    }}
                >
                    {t('workspace.resetSeededContent', 'Reset seeded content')}
                </Button>
            </ViewHeader>

            {!workspaceExists && !workspaceIsLoading && workspaceLoadFailed ? (
                <Alert severity='error'>{t('workspace.errorLoad', 'Failed to load workspaces')}</Alert>
            ) : !workspaceExists && !workspaceIsLoading ? (
                <Alert severity='warning'>{t('workspace.notFound', 'Workspace not found')}</Alert>
            ) : settingsQuery.isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
            ) : settingsQuery.isError ? (
                <Alert severity='error'>{t('workspace.settingsLoadError', 'Failed to load workspace settings')}</Alert>
            ) : (
                <Stack spacing={2}>
                    {error ? <Alert severity='error'>{error}</Alert> : null}
                    {settingsQuery.data?.canManage ? null : (
                        <Alert severity='info'>
                            {t('workspace.settingsReadOnly', 'You can view inherited settings, but only workspace owners can change them.')}
                        </Alert>
                    )}
                    {!settingsQuery.data ? (
                        <Alert severity='warning'>{t('workspace.settingsLoadError', 'Failed to load workspace settings')}</Alert>
                    ) : settingsQuery.data.items.filter((setting) => setting.allowed).length === 0 && widgetSettingsGroups.length === 0 ? (
                        <Alert severity='info'>{t('workspace.settingsEmpty', 'No workspace-level settings are available.')}</Alert>
                    ) : (
                        <Stack spacing={2}>
                            {settingsQuery.data.items
                                .filter((setting) => setting.allowed)
                                .map((setting) => (
                                    <WorkspaceSettingCard
                                        key={setting.key}
                                        setting={setting}
                                        canManage={canManage}
                                        onChange={(value) => handleSettingChange(setting, value)}
                                        onReset={() => handleSettingReset(setting)}
                                    />
                                ))}
                            {widgetSettingsGroups.map(({ instanceKey, settings, widget }, index) => (
                                <Stack key={instanceKey} spacing={1.5} data-testid='runtime-workspace-widget-settings'>
                                    <Typography variant='h6' component='h2'>
                                        {t('workspace.widgetSettings.widgetTitle', {
                                            widget: t('workspace.widgetSettings.widgetName', 'Interpretation Network'),
                                            location: widget?.zone
                                                ? t(`workspace.widgetSettings.locations.${widget.zone}`, {
                                                      defaultValue: 'Application layout'
                                                  })
                                                : t('workspace.widgetSettings.locationUnknown', 'Application layout'),
                                            number: index + 1,
                                            defaultValue: `Interpretation Network — Application layout (widget ${index + 1})`
                                        })}
                                    </Typography>
                                    {settings.map((setting) => (
                                        <WorkspaceWidgetSettingCard
                                            key={setting.key}
                                            setting={setting}
                                            canManage={canManage}
                                            onChange={(value) => handleSettingChange(setting, value)}
                                            onReset={() => handleSettingReset(setting)}
                                        />
                                    ))}
                                </Stack>
                            ))}
                        </Stack>
                    )}
                </Stack>
            )}
        </>
    )
}

function WorkspaceWidgetSettingCard({
    setting,
    canManage,
    onChange,
    onReset
}: {
    setting: RuntimeWorkspaceWidgetSetting
    canManage: boolean
    onChange: (value: unknown) => void
    onReset: () => void
}) {
    const { t } = useTranslation('apps')
    const translation = WIDGET_STYLE_SETTING_LABELS[setting.key]
    const label = translation ? t(translation.key, translation.fallback) : t('workspace.widgetSettings.unknown', 'Widget setting')
    const sourceLabel = setting.isInherited
        ? t('workspace.settingsInheritedFromApplication', 'Inherited from application')
        : t('workspace.settingsOverriddenInWorkspace', 'Overridden in this workspace')
    const isColorAllowlist = setting.key === 'interpretationNetwork.cellStylePolicy.allowedColors'
    const isBoolean = typeof setting.value === 'boolean'
    const colors = Array.isArray(setting.value) ? setting.value.filter((color): color is string => typeof color === 'string') : []
    const [colorDraft, setColorDraft] = useState(colors)
    const nextAvailableColor = getNextAvailableStyleColor(colorDraft)
    const [newColorDraft, setNewColorDraft] = useState(nextAvailableColor ?? '#607D8B')

    useEffect(() => {
        const nextColors = Array.isArray(setting.value) ? setting.value.filter((color): color is string => typeof color === 'string') : []
        setColorDraft(nextColors)
        setNewColorDraft(getNextAvailableStyleColor(nextColors) ?? '#607D8B')
    }, [setting.value])

    const normalizedColors = colorDraft.map((color) => parseInterpretationNetworkHexColor(color))
    const validColors = normalizedColors.every(Boolean) && new Set(normalizedColors).size === colorDraft.length
    const hasColorChanges = JSON.stringify(colorDraft) !== JSON.stringify(colors)
    const normalizedNewColor = parseInterpretationNetworkHexColor(newColorDraft)
    const isDuplicateColor = normalizedNewColor !== null && normalizedColors.some((color) => color === normalizedNewColor)
    const canAddColor = normalizedNewColor !== null && !isDuplicateColor

    return (
        <Card variant='outlined' data-testid='runtime-workspace-widget-setting-card' sx={{ borderRadius: 1, width: '100%', minWidth: 0 }}>
            <CardContent>
                <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { xs: 'flex-start', sm: 'center' } }}>
                        <Typography variant='subtitle1' component='h3' sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                            {label}
                        </Typography>
                        <Stack direction='row' spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                            <Chip size='small' variant='outlined' label={t(`workspace.settingSources.${setting.source}`, setting.source)} />
                            <Chip
                                size='small'
                                color={setting.isInherited ? 'default' : 'primary'}
                                variant={setting.isInherited ? 'outlined' : 'filled'}
                                label={sourceLabel}
                            />
                        </Stack>
                    </Stack>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            {isColorAllowlist ? (
                                <Stack spacing={1}>
                                    {colorDraft.map((color, index) => (
                                        <Stack
                                            key={`${index}-${color}`}
                                            direction={{ xs: 'column', sm: 'row' }}
                                            spacing={1}
                                            sx={{ alignItems: { xs: 'stretch', sm: 'center' }, width: '100%' }}
                                        >
                                            <HexColorField
                                                id={`runtime-workspace-color-${index}`}
                                                label={t('workspace.widgetSettings.colorNumber', {
                                                    number: index + 1,
                                                    defaultValue: `Color ${index + 1} (HEX)`
                                                })}
                                                pickerLabel={t('workspace.widgetSettings.colorPicker', {
                                                    label: t('workspace.widgetSettings.colorNumber', {
                                                        number: index + 1,
                                                        defaultValue: `Color ${index + 1} (HEX)`
                                                    }),
                                                    defaultValue: 'Choose color for {{label}}'
                                                })}
                                                value={color}
                                                disabled={!canManage}
                                                onChange={(value) => {
                                                    const next = [...colorDraft]
                                                    next[index] = value.toUpperCase()
                                                    setColorDraft(next)
                                                }}
                                                error={!parseInterpretationNetworkHexColor(color)}
                                                helperText={
                                                    parseInterpretationNetworkHexColor(color)
                                                        ? undefined
                                                        : t(
                                                              'workspace.widgetSettings.invalidHexColor',
                                                              'Enter a valid HEX color, such as #1E88E5.'
                                                          )
                                                }
                                            />
                                            <Button
                                                size='small'
                                                disabled={!canManage}
                                                aria-label={t('workspace.widgetSettings.removeColor', {
                                                    color,
                                                    defaultValue: `Remove ${color}`
                                                })}
                                                onClick={() =>
                                                    setColorDraft((current) => current.filter((_, itemIndex) => itemIndex !== index))
                                                }
                                            >
                                                {t('workspace.widgetSettings.remove', 'Remove')}
                                            </Button>
                                        </Stack>
                                    ))}
                                    <Stack
                                        direction={{ xs: 'column', sm: 'row' }}
                                        spacing={1}
                                        sx={{ alignItems: { xs: 'stretch', sm: 'center' }, flexWrap: 'wrap' }}
                                    >
                                        <HexColorField
                                            id='runtime-workspace-new-color'
                                            label={t('workspace.widgetSettings.newColor', 'New allowed color (HEX)')}
                                            pickerLabel={t('workspace.widgetSettings.colorPicker', {
                                                label: t('workspace.widgetSettings.newColor', 'New allowed color (HEX)'),
                                                defaultValue: 'Choose color for {{label}}'
                                            })}
                                            value={newColorDraft}
                                            disabled={!canManage}
                                            onChange={(value) => setNewColorDraft(value.toUpperCase())}
                                            error={!normalizedNewColor}
                                            helperText={
                                                normalizedNewColor
                                                    ? undefined
                                                    : t(
                                                          'workspace.widgetSettings.invalidHexColor',
                                                          'Enter a valid HEX color, such as #1E88E5.'
                                                      )
                                            }
                                        />
                                        <Button
                                            size='medium'
                                            variant='outlined'
                                            disabled={!canManage || !canAddColor}
                                            onClick={() => {
                                                if (normalizedNewColor) setColorDraft((current) => [...current, normalizedNewColor])
                                            }}
                                            sx={{ minHeight: 40, minWidth: { xs: '100%', sm: 112 } }}
                                        >
                                            {t('workspace.widgetSettings.addColor', 'Add color')}
                                        </Button>
                                        <Button
                                            size='medium'
                                            variant='contained'
                                            disabled={!canManage || !validColors || !hasColorChanges}
                                            onClick={() => onChange(colorDraft)}
                                            sx={{ minHeight: 40, minWidth: { xs: '100%', sm: 120 } }}
                                        >
                                            {t('workspace.widgetSettings.saveColors', 'Save colors')}
                                        </Button>
                                    </Stack>
                                    {canManage && isDuplicateColor ? (
                                        <Typography variant='caption' color='error' role='status'>
                                            {t('workspace.widgetSettings.duplicateColor', 'This color is already in the allowed list.')}
                                        </Typography>
                                    ) : null}
                                </Stack>
                            ) : isBoolean ? (
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={setting.value === true}
                                            disabled={!canManage}
                                            onChange={(event) => onChange(readCheckboxChangeValue(event))}
                                            slotProps={{ input: { 'aria-label': label } }}
                                        />
                                    }
                                    label={
                                        setting.value === true
                                            ? t('workspace.settingsBooleanEnabled', 'Enabled')
                                            : t('workspace.settingsBooleanDisabled', 'Disabled')
                                    }
                                />
                            ) : null}
                        </Box>
                        <Button
                            variant='outlined'
                            size='small'
                            startIcon={<RestartAltRoundedIcon />}
                            data-testid={`runtime-workspace-widget-setting-reset-${setting.key}`}
                            disabled={!canManage || setting.isInherited}
                            onClick={onReset}
                        >
                            {t('workspace.settingsReset', 'Use application value')}
                        </Button>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    )
}

function WorkspaceSettingCard({
    setting,
    canManage,
    onChange,
    onReset
}: {
    setting: RuntimeWorkspaceSetting
    canManage: boolean
    onChange: (value: unknown) => void
    onReset: () => void
}) {
    const { t } = useTranslation('apps')
    const definition = setting.definition
    const label = t(`workspace.settingKeys.${setting.key}`, {
        defaultValue: t(definition.labelKey, { defaultValue: definition.key })
    })
    const description = t(`workspace.settingKeys.${setting.key}.description`, {
        defaultValue: t(definition.descriptionKey, { defaultValue: definition.key })
    })
    const sourceLabel = setting.isInherited
        ? t('workspace.settingsInheritedFromApplication', 'Inherited from application')
        : t('workspace.settingsOverriddenInWorkspace', 'Overridden in this workspace')
    const sourceChipLabel = t(`workspace.settingSources.${setting.source}`, setting.source)
    const optionItems = useMemo<SettingValueOption[]>(
        () =>
            (definition.options ?? []).map((option) => {
                const translation = SETTING_VALUE_LABELS[`${definition.key}.${option}`]
                return {
                    value: option,
                    label: translation ? t(translation.key, translation.fallback) : option
                }
            }),
        [definition.key, definition.options, t]
    )
    const normalizedValue = setting.value === undefined || setting.value === null ? '' : setting.value

    const renderControl = () => {
        switch (definition.controlType) {
            case 'boolean':
                return (
                    <FormControlLabel
                        control={
                            <Switch
                                checked={normalizedValue === true}
                                disabled={!canManage}
                                onChange={(event) => onChange(readCheckboxChangeValue(event))}
                                slotProps={{ input: { 'aria-label': label } }}
                            />
                        }
                        label={
                            normalizedValue === true
                                ? t('workspace.settingsBooleanEnabled', 'Enabled')
                                : t('workspace.settingsBooleanDisabled', 'Disabled')
                        }
                    />
                )
            case 'select':
                return (
                    <TextField
                        select
                        size='small'
                        fullWidth
                        label={label}
                        value={typeof normalizedValue === 'string' ? normalizedValue : ''}
                        disabled={!canManage}
                        slotProps={{ htmlInput: { 'data-testid': `runtime-workspace-setting-${setting.key}` } }}
                        onChange={(event) => onChange(readInputChangeValue(event))}
                    >
                        {optionItems.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                                {option.label}
                            </MenuItem>
                        ))}
                    </TextField>
                )
            case 'number':
                return (
                    <TextField
                        type='number'
                        size='small'
                        fullWidth
                        label={label}
                        value={typeof normalizedValue === 'number' ? normalizedValue : 0}
                        disabled={!canManage}
                        slotProps={{ htmlInput: { 'data-testid': `runtime-workspace-setting-${setting.key}` } }}
                        onChange={(event) => onChange(readNumericInputValue(event))}
                    />
                )
            case 'string':
                return (
                    <TextField
                        size='small'
                        fullWidth
                        label={label}
                        value={typeof normalizedValue === 'string' ? normalizedValue : ''}
                        disabled={!canManage}
                        slotProps={{ htmlInput: { 'data-testid': `runtime-workspace-setting-${setting.key}` } }}
                        onChange={(event) => onChange(readInputChangeValue(event))}
                    />
                )
            case 'structured':
            default:
                return (
                    <Alert severity='info' sx={{ width: '100%' }}>
                        {t('workspace.settingsStructuredReadonly', 'This structured setting is managed in application settings.')}
                    </Alert>
                )
        }
    }

    return (
        <Card variant='outlined' data-testid='runtime-workspace-setting-card' sx={{ borderRadius: 1, width: '100%', minWidth: 0 }}>
            <CardContent>
                <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { xs: 'flex-start', sm: 'center' } }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant='subtitle1' component='h2' sx={{ overflowWrap: 'anywhere' }}>
                                {label}
                            </Typography>
                            <Typography variant='body2' sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>
                                {description}
                            </Typography>
                        </Box>
                        <Stack direction='row' spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                            <Chip size='small' variant='outlined' label={sourceChipLabel} />
                            <Chip
                                size='small'
                                color={setting.isInherited ? 'default' : 'primary'}
                                variant={setting.isInherited ? 'outlined' : 'filled'}
                                label={sourceLabel}
                            />
                        </Stack>
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>{renderControl()}</Box>
                        <Button
                            variant='outlined'
                            size='small'
                            startIcon={<RestartAltRoundedIcon />}
                            data-testid={`runtime-workspace-setting-reset-${setting.key}`}
                            disabled={!canManage || setting.isInherited}
                            onClick={onReset}
                        >
                            {t('workspace.settingsReset', 'Use application value')}
                        </Button>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    )
}
