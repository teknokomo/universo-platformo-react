import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Divider,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Switch,
    TextField,
    Typography
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import type { TFunction } from 'i18next'
import {
    getDefaultWorkspaceOverrideAllowedKeys,
    listWorkspaceOverridableSettings,
    normalizeApplicationWorkspaceOverridePolicy
} from '@universo-react/types'
import type { ApplicationDialogSettings, ApplicationRole, ApplicationWorkspaceLimitItem } from '../../types'

export type ApplicationCapabilityKey =
    | 'manageMembers'
    | 'manageApplication'
    | 'createContent'
    | 'editContent'
    | 'deleteContent'
    | 'readReports'

export const APPLICATION_ROLE_ORDER: ApplicationRole[] = ['owner', 'admin', 'editor', 'member']
export const DATA_TEST_ID = 'data-testid'
export const testIdInputProps = (value: string): Record<string, string> => ({ [DATA_TEST_ID]: value })

export const APPLICATION_CAPABILITIES: Array<{
    key: ApplicationCapabilityKey
    capability: string
    aliases: readonly string[]
    labelKey: string
    fallback: string
}> = [
    {
        key: 'manageMembers',
        capability: 'manageMembers',
        aliases: ['manageMembers', 'members.manage', 'workspace.members.manage'],
        labelKey: 'settings.capabilities.manageMembers',
        fallback: 'Manage members'
    },
    {
        key: 'manageApplication',
        capability: 'manageApplication',
        aliases: ['manageApplication', 'application.manage', 'settings.manage'],
        labelKey: 'settings.capabilities.manageApplication',
        fallback: 'Manage application'
    },
    {
        key: 'createContent',
        capability: 'createContent',
        aliases: ['createContent', 'content.create', 'records.create'],
        labelKey: 'settings.capabilities.createContent',
        fallback: 'Create content'
    },
    {
        key: 'editContent',
        capability: 'editContent',
        aliases: ['editContent', 'content.edit', 'records.edit'],
        labelKey: 'settings.capabilities.editContent',
        fallback: 'Edit content'
    },
    {
        key: 'deleteContent',
        capability: 'deleteContent',
        aliases: ['deleteContent', 'content.delete', 'records.delete'],
        labelKey: 'settings.capabilities.deleteContent',
        fallback: 'Delete content'
    },
    {
        key: 'readReports',
        capability: 'readReports',
        aliases: ['readReports', 'reports.read', 'report.read'],
        labelKey: 'settings.capabilities.readReports',
        fallback: 'Read reports'
    }
]

type Translate = TFunction<'applications'>
type SettingsChange = (patch: Partial<ApplicationDialogSettings>) => void
type SaveHandler = () => void

export const SaveSettingsButton = ({
    testId,
    t,
    disabled,
    onSave
}: {
    testId: string
    t: Translate
    disabled: boolean
    onSave: SaveHandler
}) => (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button data-testid={testId} variant='contained' startIcon={<SaveIcon />} onClick={onSave} disabled={disabled}>
            {t('settings.save', 'Save')}
        </Button>
    </Box>
)

export const GeneralSettingsPanel = ({
    t,
    effectiveVisibility,
    currentVisibility,
    workspacesEnabled,
    settings,
    hasChanges,
    isSaving,
    onVisibilityChange,
    onSettingsChange,
    onSave
}: {
    t: Translate
    effectiveVisibility: boolean
    currentVisibility: boolean | undefined
    workspacesEnabled: boolean | undefined
    settings: ApplicationDialogSettings
    hasChanges: boolean
    isSaving: boolean
    onVisibilityChange: (value: boolean | undefined) => void
    onSettingsChange: SettingsChange
    onSave: SaveHandler
}) => (
    <>
        <Stack spacing={0} divider={<Divider />}>
            <Box
                data-testid='application-setting-visibility'
                sx={{
                    py: 2,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
                    gap: 3,
                    alignItems: 'center'
                }}
            >
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant='subtitle2'>{t('settings.visibilityTitle', 'Application visibility')}</Typography>
                    <Typography variant='body2' color='text.secondary'>
                        {effectiveVisibility
                            ? t(
                                  'settings.visibilityPublicDescription',
                                  'Public applications can be discovered and joined directly by authenticated users.'
                              )
                            : t(
                                  'settings.visibilityClosedDescription',
                                  'Closed applications are visible only to current members and users with global application access.'
                              )}
                    </Typography>
                    <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
                        {t('settings.workspaceModeLabel', 'Workspace mode')}:{' '}
                        <Box component='span' sx={{ fontWeight: 600 }}>
                            {workspacesEnabled
                                ? t('settings.workspaceModeEnabled', 'Enabled')
                                : t('settings.workspaceModeDisabled', 'Disabled')}
                        </Box>
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                        {t(
                            'settings.workspaceModeReadOnly',
                            'Workspace mode is selected during application creation and cannot be changed after the runtime structure is defined.'
                        )}
                    </Typography>
                </Box>
                <FormControlLabel
                    data-testid='application-settings-visibility-toggle'
                    control={
                        <Switch
                            checked={effectiveVisibility}
                            onChange={(event) => {
                                const nextValue = event.target.checked
                                onVisibilityChange(nextValue === currentVisibility ? undefined : nextValue)
                            }}
                            inputProps={testIdInputProps('application-settings-visibility-switch')}
                        />
                    }
                    label={effectiveVisibility ? t('settings.visibilityPublic', 'Public') : t('settings.visibilityClosed', 'Closed')}
                />
            </Box>

            <Box data-testid='application-setting-dialogSizePreset' sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant='subtitle2'>{t('settings.dialogSizePreset', 'Popup window size')}</Typography>
                    <Typography variant='body2' color='text.secondary'>
                        {t('settings.dialogSizePresetDescription', 'Default size for popup windows in this application control panel.')}
                    </Typography>
                </Box>
                <FormControl size='small' sx={{ minWidth: 250 }}>
                    <InputLabel>{t('settings.dialogSizePreset', 'Popup window size')}</InputLabel>
                    <Select
                        value={settings.dialogSizePreset}
                        label={t('settings.dialogSizePreset', 'Popup window size')}
                        onChange={(event) =>
                            onSettingsChange({ dialogSizePreset: event.target.value as ApplicationDialogSettings['dialogSizePreset'] })
                        }
                    >
                        <MenuItem value='small'>{t('settings.dialogSizePresets.small', 'Small (about 480 px)')}</MenuItem>
                        <MenuItem value='medium'>{t('settings.dialogSizePresets.medium', 'Medium (about 600 px)')}</MenuItem>
                        <MenuItem value='large'>{t('settings.dialogSizePresets.large', 'Large (about 800 px)')}</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            <Box data-testid='application-setting-dialogAllowFullscreen' sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant='subtitle2'>{t('settings.dialogAllowFullscreen', 'Allow fullscreen expansion')}</Typography>
                    <Typography variant='body2' color='text.secondary'>
                        {t(
                            'settings.dialogAllowFullscreenDescription',
                            'Show a header action that expands application popup windows almost to the full viewport.'
                        )}
                    </Typography>
                </Box>
                <FormControlLabel
                    control={
                        <Switch
                            checked={settings.dialogAllowFullscreen}
                            onChange={(event) => onSettingsChange({ dialogAllowFullscreen: event.target.checked })}
                        />
                    }
                    label=''
                />
            </Box>

            <Box data-testid='application-setting-dialogAllowResize' sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant='subtitle2'>{t('settings.dialogAllowResize', 'Allow popup resize')}</Typography>
                    <Typography variant='body2' color='text.secondary'>
                        {t(
                            'settings.dialogAllowResizeDescription',
                            'Show a resize handle and remember the custom popup size in this browser for this application.'
                        )}
                    </Typography>
                </Box>
                <FormControlLabel
                    control={
                        <Switch
                            checked={settings.dialogAllowResize}
                            onChange={(event) => onSettingsChange({ dialogAllowResize: event.target.checked })}
                        />
                    }
                    label=''
                />
            </Box>

            <Box data-testid='application-setting-sectionLinksEnabled' sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant='subtitle2'>{t('settings.sectionLinksEnabled', 'Section-specific links')}</Typography>
                    <Typography variant='body2' color='text.secondary'>
                        {t(
                            'settings.sectionLinksEnabledDescription',
                            'Give every application menu section its own browser URL based on the section identifier.'
                        )}
                    </Typography>
                </Box>
                <FormControlLabel
                    control={
                        <Switch
                            checked={settings.sectionLinksEnabled}
                            onChange={(event) => onSettingsChange({ sectionLinksEnabled: event.target.checked })}
                            inputProps={testIdInputProps('application-settings-section-links-switch')}
                        />
                    }
                    label=''
                />
            </Box>

            <Box data-testid='application-setting-dialogCloseBehavior' sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant='subtitle2'>{t('settings.dialogCloseBehavior', 'Popup window type')}</Typography>
                    <Typography variant='body2' color='text.secondary'>
                        {t(
                            'settings.dialogCloseBehaviorDescription',
                            'Choose whether application popup windows stay modal or can close when the user clicks outside the window.'
                        )}
                    </Typography>
                </Box>
                <FormControl size='small' sx={{ minWidth: 250 }}>
                    <InputLabel>{t('settings.dialogCloseBehavior', 'Popup window type')}</InputLabel>
                    <Select
                        value={settings.dialogCloseBehavior}
                        label={t('settings.dialogCloseBehavior', 'Popup window type')}
                        onChange={(event) =>
                            onSettingsChange({
                                dialogCloseBehavior: event.target.value as ApplicationDialogSettings['dialogCloseBehavior']
                            })
                        }
                    >
                        <MenuItem value='strict-modal'>{t('settings.dialogCloseBehaviors.strict-modal', 'Modal windows')}</MenuItem>
                        <MenuItem value='backdrop-close'>{t('settings.dialogCloseBehaviors.backdrop-close', 'Non-modal windows')}</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            <Box data-testid='application-setting-dashboardDefaultMode' sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant='subtitle2'>{t('settings.dashboardDefaultMode', 'Runtime dashboard default')}</Typography>
                    <Typography variant='body2' color='text.secondary'>
                        {t(
                            'settings.dashboardDefaultModeDescription',
                            'Choose how the published application resolves the initial dashboard section.'
                        )}
                    </Typography>
                </Box>
                <FormControl size='small' sx={{ minWidth: 250 }}>
                    <InputLabel>{t('settings.dashboardDefaultMode', 'Runtime dashboard default')}</InputLabel>
                    <Select
                        value={settings.dashboardDefaultMode}
                        label={t('settings.dashboardDefaultMode', 'Runtime dashboard default')}
                        onChange={(event) =>
                            onSettingsChange({
                                dashboardDefaultMode: event.target.value as ApplicationDialogSettings['dashboardDefaultMode']
                            })
                        }
                    >
                        <MenuItem value='layout-default'>{t('settings.dashboardDefaultModes.layout-default', 'Layout default')}</MenuItem>
                        <MenuItem value='first-menu-item'>
                            {t('settings.dashboardDefaultModes.first-menu-item', 'First menu item')}
                        </MenuItem>
                    </Select>
                </FormControl>
            </Box>

            <Box data-testid='application-setting-datasourceExecutionPolicy' sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant='subtitle2'>{t('settings.datasourceExecutionPolicy', 'Datasource execution')}</Typography>
                    <Typography variant='body2' color='text.secondary'>
                        {t(
                            'settings.datasourceExecutionPolicyDescription',
                            'Control whether layout datasources are always scoped to the active runtime workspace.'
                        )}
                    </Typography>
                </Box>
                <FormControl size='small' sx={{ minWidth: 250 }}>
                    <InputLabel>{t('settings.datasourceExecutionPolicy', 'Datasource execution')}</InputLabel>
                    <Select
                        value={settings.datasourceExecutionPolicy}
                        label={t('settings.datasourceExecutionPolicy', 'Datasource execution')}
                        onChange={(event) =>
                            onSettingsChange({
                                datasourceExecutionPolicy: event.target.value as ApplicationDialogSettings['datasourceExecutionPolicy']
                            })
                        }
                    >
                        <MenuItem value='workspace-scoped'>
                            {t('settings.datasourceExecutionPolicies.workspace-scoped', 'Workspace scoped')}
                        </MenuItem>
                        <MenuItem value='layout-only'>{t('settings.datasourceExecutionPolicies.layout-only', 'Layout only')}</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            <Box data-testid='application-setting-workspaceOpenBehavior' sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant='subtitle2'>{t('settings.workspaceOpenBehavior', 'Workspace opening')}</Typography>
                    <Typography variant='body2' color='text.secondary'>
                        {t(
                            'settings.workspaceOpenBehaviorDescription',
                            'Choose which workspace should open first when users enter the published application.'
                        )}
                    </Typography>
                </Box>
                <FormControl size='small' sx={{ minWidth: 250 }}>
                    <InputLabel>{t('settings.workspaceOpenBehavior', 'Workspace opening')}</InputLabel>
                    <Select
                        value={settings.workspaceOpenBehavior}
                        label={t('settings.workspaceOpenBehavior', 'Workspace opening')}
                        onChange={(event) =>
                            onSettingsChange({
                                workspaceOpenBehavior: event.target.value as ApplicationDialogSettings['workspaceOpenBehavior']
                            })
                        }
                    >
                        <MenuItem value='last-used'>{t('settings.workspaceOpenBehaviors.last-used', 'Last used workspace')}</MenuItem>
                        <MenuItem value='default-workspace'>
                            {t('settings.workspaceOpenBehaviors.default-workspace', 'Default workspace')}
                        </MenuItem>
                    </Select>
                </FormControl>
            </Box>
        </Stack>

        {hasChanges ? (
            <Box sx={{ mt: 3 }}>
                <SaveSettingsButton testId='application-settings-general-save' t={t} disabled={isSaving} onSave={onSave} />
            </Box>
        ) : null}
    </>
)

export const ConnectorsSettingsPanel = ({
    t,
    settings,
    hasChanges,
    isSaving,
    onSettingsChange,
    onSave
}: {
    t: Translate
    settings: ApplicationDialogSettings
    hasChanges: boolean
    isSaving: boolean
    onSettingsChange: SettingsChange
    onSave: SaveHandler
}) => (
    <Stack spacing={2}>
        <Alert severity='info'>
            {t(
                'settings.connectorsHint',
                'Configure how application connectors present source metahub changes before schema synchronization.'
            )}
        </Alert>

        <Stack spacing={0} divider={<Divider />}>
            <Box
                data-testid='application-setting-schemaDiffLocalizedLabels'
                sx={{
                    py: 2,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
                    gap: 3,
                    alignItems: 'center'
                }}
            >
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant='subtitle2'>{t('settings.schemaDiffLocalizedLabels', 'Localized schema change labels')}</Typography>
                    <Typography variant='body2' color='text.secondary'>
                        {t(
                            'settings.schemaDiffLocalizedLabelsDescription',
                            'Show entity type, entity, and field labels in the current interface language when the source metahub provides localized values.'
                        )}
                    </Typography>
                </Box>
                <FormControlLabel
                    control={
                        <Switch
                            checked={settings.schemaDiffLocalizedLabels !== false}
                            onChange={(event) => onSettingsChange({ schemaDiffLocalizedLabels: event.target.checked })}
                            slotProps={{
                                input: testIdInputProps('application-settings-schema-diff-localized-labels-switch')
                            }}
                        />
                    }
                    label=''
                />
            </Box>
        </Stack>

        {hasChanges ? <SaveSettingsButton testId='application-settings-connectors-save' t={t} disabled={isSaving} onSave={onSave} /> : null}
    </Stack>
)

export const AccessSettingsPanel = ({
    t,
    unsupportedActiveRoleRulesCount,
    rolePolicyMatrix,
    settings,
    hasChanges,
    isSaving,
    onUpdateRoleCapability,
    onSettingsChange,
    onSave
}: {
    t: Translate
    unsupportedActiveRoleRulesCount: number
    rolePolicyMatrix: Record<ApplicationRole, Record<ApplicationCapabilityKey, boolean>>
    settings: ApplicationDialogSettings
    hasChanges: boolean
    isSaving: boolean
    onUpdateRoleCapability: (role: ApplicationRole, capability: ApplicationCapabilityKey, checked: boolean) => void
    onSettingsChange: SettingsChange
    onSave: SaveHandler
}) => {
    const workspacePolicy = normalizeApplicationWorkspaceOverridePolicy({ workspaceOverrides: settings.workspaceOverrides })
    const defaultAllowedKeys = getDefaultWorkspaceOverrideAllowedKeys()
    const workspaceSettings = listWorkspaceOverridableSettings()
    const updateWorkspaceAllowedKey = (key: string, checked: boolean) => {
        const nextAllowed = checked ? [...workspacePolicy.allowedKeys, key] : workspacePolicy.allowedKeys.filter((item) => item !== key)
        onSettingsChange({
            workspaceOverrides: {
                allowedKeys: Array.from(new Set(nextAllowed)),
                lockedKeys: workspacePolicy.lockedKeys.filter((item) => item !== key)
            }
        })
    }

    const resetWorkspacePolicy = () => {
        onSettingsChange({
            workspaceOverrides: {
                allowedKeys: defaultAllowedKeys,
                lockedKeys: []
            }
        })
    }

    return (
        <Stack spacing={2}>
            <Alert severity='info'>
                {t(
                    'settings.accessHint',
                    'Configure generic application and workspace capabilities for each application role. These rules are enforced by the runtime API.'
                )}
            </Alert>
            {unsupportedActiveRoleRulesCount > 0 ? (
                <Alert severity='warning' data-testid='application-settings-unsupported-scope-warning'>
                    {t(
                        'settings.unsupportedScopeWarning',
                        'Some imported role policy grants use scopes that are not implemented yet. They will be saved as deny rules until scoped predicates are available.'
                    )}
                </Alert>
            ) : null}

            <Box sx={{ overflowX: 'auto' }}>
                <Box
                    data-testid='application-settings-role-policy-grid'
                    sx={{
                        minWidth: 760,
                        display: 'grid',
                        gridTemplateColumns: `minmax(220px, 1.25fr) repeat(${APPLICATION_ROLE_ORDER.length}, minmax(120px, 1fr))`,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 2,
                        overflow: 'hidden'
                    }}
                >
                    <Box sx={{ p: 1.5, bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}>
                        <Typography variant='subtitle2'>{t('settings.capabilityColumn', 'Capability')}</Typography>
                    </Box>
                    {APPLICATION_ROLE_ORDER.map((role) => (
                        <Box
                            key={role}
                            sx={{
                                p: 1.5,
                                bgcolor: 'background.default',
                                borderBottom: 1,
                                borderLeft: 1,
                                borderColor: 'divider',
                                textAlign: 'center'
                            }}
                        >
                            <Typography variant='subtitle2'>
                                {t(`settings.roles.${role}`, role.charAt(0).toUpperCase() + role.slice(1))}
                            </Typography>
                        </Box>
                    ))}

                    {APPLICATION_CAPABILITIES.map((capability) => (
                        <Box key={capability.key} sx={{ display: 'contents' }}>
                            <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
                                <Typography variant='body2' sx={{ fontWeight: 600 }}>
                                    {t(capability.labelKey, capability.fallback)}
                                </Typography>
                                <Typography variant='caption' color='text.secondary'>
                                    {capability.capability}
                                </Typography>
                            </Box>
                            {APPLICATION_ROLE_ORDER.map((role) => (
                                <Box
                                    key={`${role}-${capability.key}`}
                                    sx={{
                                        p: 1,
                                        borderTop: 1,
                                        borderLeft: 1,
                                        borderColor: 'divider',
                                        display: 'flex',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <Switch
                                        data-testid={`application-settings-role-policy-${role}-${capability.key}`}
                                        checked={rolePolicyMatrix[role][capability.key]}
                                        onChange={(event) => onUpdateRoleCapability(role, capability.key, event.target.checked)}
                                        slotProps={{
                                            input: {
                                                'aria-label': `${role} ${capability.capability}`
                                            }
                                        }}
                                    />
                                </Box>
                            ))}
                        </Box>
                    ))}
                </Box>
            </Box>

            <Box data-testid='application-settings-workspace-override-policy'>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { xs: 'stretch', sm: 'center' }, mb: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant='subtitle2'>{t('settings.workspaceOverrides.title', 'Workspace overrides')}</Typography>
                        <Typography variant='body2' color='text.secondary'>
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
                                <Typography variant='caption' color='text.secondary'>
                                    {t(definition.descriptionKey, definition.key)}
                                </Typography>
                            </Box>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={workspacePolicy.allowedKeys.includes(definition.key)}
                                        onChange={(event) => updateWorkspaceAllowedKey(definition.key, event.target.checked)}
                                        slotProps={{
                                            input: testIdInputProps(`application-settings-workspace-override-${definition.key}`)
                                        }}
                                    />
                                }
                                label={
                                    workspacePolicy.allowedKeys.includes(definition.key)
                                        ? t('settings.workspaceOverrides.allowed', 'Allowed')
                                        : t('settings.workspaceOverrides.locked', 'Locked')
                                }
                            />
                        </Box>
                    ))}
                </Stack>
            </Box>

            {hasChanges ? <SaveSettingsButton testId='application-settings-access-save' t={t} disabled={isSaving} onSave={onSave} /> : null}
        </Stack>
    )
}

export const LimitsSettingsPanel = ({
    t,
    runtimeSchemaReady,
    workspacesEnabled,
    isLoading,
    isError,
    limits,
    isSaving,
    onLimitChange,
    onSave
}: {
    t: Translate
    runtimeSchemaReady: boolean
    workspacesEnabled: boolean | undefined
    isLoading: boolean
    isError: boolean
    limits: Array<ApplicationWorkspaceLimitItem & { inputValue: string }>
    isSaving: boolean
    onLimitChange: (objectId: string, value: string) => void
    onSave: SaveHandler
}) => (
    <Stack spacing={2}>
        <Alert severity='info'>
            {t(
                'settings.limitsHint',
                'Set row limits per object for every workspace. When the limit is reached, users will not be able to create more records in that object.'
            )}
        </Alert>

        {!runtimeSchemaReady ? (
            <Alert severity='info'>
                {t('settings.limitsRequiresSchema', 'Limits settings will become available after the application schema is created.')}
            </Alert>
        ) : workspacesEnabled !== true ? (
            <Alert severity='info'>
                {t('settings.limitsRequiresWorkspaces', 'Limits are available only for applications created with workspace mode enabled.')}
            </Alert>
        ) : isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={28} />
            </Box>
        ) : isError ? (
            <Alert severity='error'>{t('settings.limitsLoadError', 'Failed to load limits')}</Alert>
        ) : (
            <Stack spacing={2}>
                {limits.map((item) => (
                    <Box
                        key={item.objectId}
                        data-testid={`application-settings-limit-card-${item.objectId}`}
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 180px' },
                            gap: 2,
                            alignItems: 'center',
                            border: 1,
                            borderColor: 'divider',
                            borderRadius: 2,
                            p: 2
                        }}
                    >
                        <Box>
                            <Typography variant='subtitle2'>{item.name || item.codename}</Typography>
                            <Typography variant='body2' color='text.secondary'>
                                {item.codenameDisplay || item.codename}
                            </Typography>
                        </Box>
                        <TextField
                            type='number'
                            label={t('settings.maxRows', 'Max rows')}
                            value={item.inputValue}
                            onChange={(event) => onLimitChange(item.objectId, event.target.value)}
                            inputProps={{
                                min: 1,
                                ...testIdInputProps(`application-settings-limit-input-${item.objectId}`)
                            }}
                            helperText={t('settings.emptyMeansUnlimited', 'Leave empty for unlimited')}
                        />
                    </Box>
                ))}

                <SaveSettingsButton testId='application-settings-limits-save' t={t} disabled={isSaving} onSave={onSave} />
            </Stack>
        )}
    </Stack>
)
