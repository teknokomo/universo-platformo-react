import { Box, Button, Divider, FormControlLabel, Stack, Switch, Typography } from '@mui/material'
import type { TFunction } from 'i18next'
import { useCommonTranslations } from '@universo-react/i18n'
import {
    getDefaultWorkspaceOverrideAllowedAddresses,
    getLayoutZoneDefinition,
    INTERPRETATION_NETWORK_CELL_STYLE_WORKSPACE_SETTING_PATHS,
    listWorkspaceOverridableSettings,
    normalizeApplicationWorkspaceOverridePolicy,
    type InterpretationNetworkCellStyleWorkspaceSettingKey
} from '@universo-react/types'
import type { ApplicationLayoutZone, ApplicationTemplateKey } from '@universo-react/types'
import type { ApplicationDialogSettings } from '../../types'

type Translate = TFunction<'applications'>
type SettingsChange = (patch: Partial<ApplicationDialogSettings>) => void
const inputTestIdProps = (value: string): Record<string, string> => ({ 'data-testid': value })

/** Renders and edits the workspace override policy within Application Settings. */
export const WorkspaceOverrideSettings = ({
    t,
    settings,
    interpretationNetworkWidgets,
    onSettingsChange
}: {
    t: Translate
    settings: ApplicationDialogSettings
    interpretationNetworkWidgets: Array<{
        instanceKey: string
        zone: ApplicationLayoutZone
        templateKey: ApplicationTemplateKey
    }>
    onSettingsChange: SettingsChange
}) => {
    const { t: tc } = useCommonTranslations()
    const workspacePolicy = normalizeApplicationWorkspaceOverridePolicy({ workspaceOverrides: settings.workspaceOverrides })
    const defaultAllowedAddresses = getDefaultWorkspaceOverrideAllowedAddresses()
    const workspaceSettings = listWorkspaceOverridableSettings()
    const updateWorkspaceAllowedKey = (key: string, checked: boolean) => {
        const currentGlobalKeys = workspacePolicy.allowedAddresses
            .filter((address) => address.target.kind === 'global')
            .map((address) => address.key)
        const nextGlobalKeys = checked ? [...currentGlobalKeys, key] : currentGlobalKeys.filter((item) => item !== key)
        const otherAllowedAddresses = workspacePolicy.allowedAddresses.filter((address) => address.target.kind !== 'global')
        onSettingsChange({
            workspaceOverrides: {
                allowedAddresses: [
                    ...otherAllowedAddresses,
                    ...Array.from(new Set(nextGlobalKeys)).map((allowedKey) => ({
                        key: allowedKey,
                        target: { kind: 'global' as const }
                    }))
                ],
                lockedAddresses: workspacePolicy.lockedAddresses.filter(
                    (address) => !(address.target.kind === 'global' && address.key === key)
                )
            }
        })
    }

    const widgetSettingKeys = Object.keys(
        INTERPRETATION_NETWORK_CELL_STYLE_WORKSPACE_SETTING_PATHS
    ) as InterpretationNetworkCellStyleWorkspaceSettingKey[]
    const updateWidgetAllowedKey = (instanceKey: string, key: InterpretationNetworkCellStyleWorkspaceSettingKey, checked: boolean) => {
        const otherAllowedAddresses = workspacePolicy.allowedAddresses.filter(
            (address) => !(address.target.kind === 'widget' && address.target.instanceKey === instanceKey && address.key === key)
        )
        onSettingsChange({
            workspaceOverrides: {
                allowedAddresses: checked
                    ? [...otherAllowedAddresses, { key, target: { kind: 'widget' as const, instanceKey } }]
                    : otherAllowedAddresses,
                lockedAddresses: workspacePolicy.lockedAddresses.filter(
                    (address) => !(address.target.kind === 'widget' && address.target.instanceKey === instanceKey && address.key === key)
                )
            }
        })
    }

    const resetWorkspacePolicy = () => {
        onSettingsChange({
            workspaceOverrides: {
                allowedAddresses: defaultAllowedAddresses,
                lockedAddresses: []
            }
        })
    }

    const isGlobalKeyAllowed = (key: string) =>
        workspacePolicy.allowedAddresses.some((address) => address.target.kind === 'global' && address.key === key)
    const isWidgetSettingAllowed = (instanceKey: string, key: string) =>
        workspacePolicy.allowedAddresses.some(
            (address) => address.target.kind === 'widget' && address.target.instanceKey === instanceKey && address.key === key
        )
    const widgetSettingLabelKey = (key: InterpretationNetworkCellStyleWorkspaceSettingKey): string => {
        const suffix = key.replace('interpretationNetwork.cellStylePolicy.', '')
        if (suffix === 'allowCustomColors') return 'settings.matrix.cellStylePolicy.customColors'
        return `settings.matrix.cellStylePolicy.${suffix.replace('editable.', '')}`
    }

    return (
        <Box data-testid='application-settings-workspace-override-policy'>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { xs: 'stretch', sm: 'center' }, mb: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant='subtitle2'>{t('settings.workspaceOverrides.title', 'Workspace overrides')}</Typography>
                    <Typography
                        variant='body2'
                        sx={{
                            color: 'text.secondary'
                        }}
                    >
                        {t(
                            'settings.workspaceOverrides.description',
                            'Choose which application settings workspace owners can override inside a published workspace.'
                        )}
                    </Typography>
                </Box>
                <Button variant='outlined' size='small' onClick={resetWorkspacePolicy}>
                    {t('settings.workspaceOverrides.resetDefaults', 'Reset defaults')}
                </Button>
            </Stack>

            <Stack spacing={0} divider={<Divider />} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                {workspaceSettings.map((definition) => (
                    <Box
                        key={definition.key}
                        sx={{
                            p: 2,
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
                            gap: 2,
                            alignItems: 'center'
                        }}
                    >
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant='body2' sx={{ fontWeight: 600 }}>
                                {t(definition.labelKey, definition.key)}
                            </Typography>
                            <Typography
                                variant='caption'
                                sx={{
                                    color: 'text.secondary'
                                }}
                            >
                                {t(definition.descriptionKey, definition.key)}
                            </Typography>
                        </Box>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={isGlobalKeyAllowed(definition.key)}
                                    onChange={(event) => updateWorkspaceAllowedKey(definition.key, event.target.checked)}
                                    slotProps={{
                                        input: {
                                            ...inputTestIdProps(`application-settings-workspace-override-${definition.key}`),
                                            'aria-label': t('settings.workspaceOverrides.allowSetting', {
                                                setting: t(definition.labelKey, definition.key),
                                                defaultValue: 'Allow workspace overrides for {{setting}}'
                                            })
                                        }
                                    }}
                                />
                            }
                            label={
                                isGlobalKeyAllowed(definition.key)
                                    ? t('settings.workspaceOverrides.allowed', 'Allowed')
                                    : t('settings.workspaceOverrides.locked', 'Locked')
                            }
                        />
                    </Box>
                ))}
            </Stack>
            {interpretationNetworkWidgets.length > 0 ? (
                <Stack spacing={2} sx={{ mt: 2 }} data-testid='application-settings-workspace-widget-overrides'>
                    <Box>
                        <Typography variant='subtitle2'>
                            {t('settings.workspaceOverrides.widgetSettingsTitle', 'Interpretation Network widget settings')}
                        </Typography>
                        <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                            {t(
                                'settings.workspaceOverrides.widgetSettingsDescription',
                                'Choose which cell style settings workspace owners can override for each active widget placement.'
                            )}
                        </Typography>
                    </Box>
                    {interpretationNetworkWidgets.map((widget, index) => {
                        const zone = getLayoutZoneDefinition(widget.zone, widget.templateKey)
                        const zoneLabel = zone ? tc(zone.labelKey, zone.defaultLabel) : widget.zone
                        const widgetLabel = t('settings.workspaceOverrides.widgetTitle', {
                            number: index + 1,
                            zone: zoneLabel,
                            defaultValue: `Interpretation Network widget ${index + 1} — ${zoneLabel}`
                        })
                        return (
                            <Box key={widget.instanceKey} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                                <Typography variant='subtitle2' sx={{ p: 2, bgcolor: 'background.default' }}>
                                    {widgetLabel}
                                </Typography>
                                <Stack spacing={0} divider={<Divider />}>
                                    {widgetSettingKeys.map((key) => {
                                        const label = t(widgetSettingLabelKey(key), key)
                                        const allowed = isWidgetSettingAllowed(widget.instanceKey, key)
                                        return (
                                            <Box
                                                key={key}
                                                sx={{
                                                    p: 2,
                                                    display: 'grid',
                                                    gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
                                                    gap: 2,
                                                    alignItems: 'center'
                                                }}
                                            >
                                                <Typography variant='body2' sx={{ fontWeight: 600 }}>
                                                    {label}
                                                </Typography>
                                                <FormControlLabel
                                                    control={
                                                        <Switch
                                                            checked={allowed}
                                                            onChange={(event) =>
                                                                updateWidgetAllowedKey(widget.instanceKey, key, event.target.checked)
                                                            }
                                                            slotProps={{
                                                                input: {
                                                                    ...inputTestIdProps(
                                                                        `application-settings-workspace-widget-override-${index}-${key
                                                                            .split('.')
                                                                            .at(-1)}`
                                                                    ),
                                                                    'aria-label': t('settings.workspaceOverrides.allowSetting', {
                                                                        setting: label,
                                                                        defaultValue: 'Allow workspace overrides for {{setting}}'
                                                                    })
                                                                }
                                                            }}
                                                        />
                                                    }
                                                    label={
                                                        allowed
                                                            ? t('settings.workspaceOverrides.allowed', 'Allowed')
                                                            : t('settings.workspaceOverrides.locked', 'Locked')
                                                    }
                                                />
                                            </Box>
                                        )
                                    })}
                                </Stack>
                            </Box>
                        )
                    })}
                </Stack>
            ) : null}
        </Box>
    )
}
