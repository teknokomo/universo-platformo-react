import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
    Tab,
    Tabs,
    TextField,
    Typography
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import type { ApplicationRolePolicySettings, RoleCapabilityRule } from '@universo/types'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { TemplateMainCard as MainCard, ViewHeaderMUI as ViewHeader, PAGE_CONTENT_GUTTER_MX, PAGE_TAB_BAR_SX } from '@universo/template-mui'
import { useApplicationDetails } from '../api/useApplicationDetails'
import { applicationsQueryKeys } from '../api/queryKeys'
import { getApplicationWorkspaceLimits, updateApplication, updateApplicationWorkspaceLimits } from '../api/applications'
import { DEFAULT_APPLICATION_DIALOG_SETTINGS, sanitizeApplicationDialogSettingsForSave } from '../settings/dialogSettings'
import {
    toApplicationDisplay,
    type ApplicationDialogSettings,
    type ApplicationRole,
    type ApplicationWorkspaceLimitItem,
    type SchemaStatus
} from '../types'

type SettingsTab = 'general' | 'connectors' | 'access' | 'limits'
type ApplicationCapabilityKey = 'manageMembers' | 'manageApplication' | 'createContent' | 'editContent' | 'deleteContent' | 'readReports'

const APPLICATION_ROLE_ORDER: ApplicationRole[] = ['owner', 'admin', 'editor', 'member']

const APPLICATION_CAPABILITIES: Array<{
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
        aliases: ['editContent', 'content.edit', 'records.edit', 'workflow.execute'],
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

const BASE_ROLE_PERMISSIONS: Record<ApplicationRole, Record<ApplicationCapabilityKey, boolean>> = {
    owner: {
        manageMembers: true,
        manageApplication: true,
        createContent: true,
        editContent: true,
        deleteContent: true,
        readReports: true
    },
    admin: {
        manageMembers: true,
        manageApplication: true,
        createContent: true,
        editContent: true,
        deleteContent: true,
        readReports: true
    },
    editor: {
        manageMembers: false,
        manageApplication: false,
        createContent: true,
        editContent: true,
        deleteContent: false,
        readReports: true
    },
    member: {
        manageMembers: false,
        manageApplication: false,
        createContent: false,
        editContent: false,
        deleteContent: false,
        readReports: false
    }
}

const cloneRoleMatrix = (): Record<ApplicationRole, Record<ApplicationCapabilityKey, boolean>> =>
    Object.fromEntries(
        APPLICATION_ROLE_ORDER.map((role) => [
            role,
            Object.fromEntries(APPLICATION_CAPABILITIES.map((capability) => [capability.key, BASE_ROLE_PERMISSIONS[role][capability.key]]))
        ])
    ) as Record<ApplicationRole, Record<ApplicationCapabilityKey, boolean>>

const roleMatchesTemplate = (template: { codename?: string; baseRole?: ApplicationRole }, role: ApplicationRole): boolean =>
    template.baseRole === role || template.codename === role || template.codename === `${role}Policy`

const capabilityMatchesRule = (rule: RoleCapabilityRule, capability: (typeof APPLICATION_CAPABILITIES)[number]): boolean =>
    capability.aliases.includes(rule.capability)

const resolveRolePolicyMatrix = (
    rolePolicies?: ApplicationRolePolicySettings
): Record<ApplicationRole, Record<ApplicationCapabilityKey, boolean>> => {
    const matrix = cloneRoleMatrix()
    for (const template of rolePolicies?.templates ?? []) {
        for (const role of APPLICATION_ROLE_ORDER) {
            if (!roleMatchesTemplate(template, role)) continue

            for (const rule of template.rules) {
                if (rule.scope !== 'application' && rule.scope !== 'workspace') continue
                for (const capability of APPLICATION_CAPABILITIES) {
                    if (capabilityMatchesRule(rule, capability)) {
                        matrix[role][capability.key] = rule.effect === 'allow'
                    }
                }
            }
        }
    }
    return matrix
}

const buildRolePoliciesFromMatrix = (
    currentPolicies: ApplicationRolePolicySettings | undefined,
    matrix: Record<ApplicationRole, Record<ApplicationCapabilityKey, boolean>>
): ApplicationRolePolicySettings => {
    const unmanagedTemplates = (currentPolicies?.templates ?? []).filter(
        (template) => !APPLICATION_ROLE_ORDER.some((role) => roleMatchesTemplate(template, role))
    )
    const templates = APPLICATION_ROLE_ORDER.map((role) => {
        const existingTemplate = (currentPolicies?.templates ?? []).find((template) => roleMatchesTemplate(template, role))
        const managedRules = APPLICATION_CAPABILITIES.flatMap(
            (capability) => existingTemplate?.rules.filter((rule) => capabilityMatchesRule(rule, capability)) ?? []
        )
        const rulesToReplace = new Set(managedRules)
        const preservedRules = (existingTemplate?.rules ?? []).filter((rule) => !rulesToReplace.has(rule))
        const rules: RoleCapabilityRule[] = [
            ...preservedRules,
            ...APPLICATION_CAPABILITIES.map((capability) => ({
                capability: capability.capability,
                effect: matrix[role][capability.key] ? 'allow' : 'deny',
                scope: 'workspace'
            }))
        ]

        return {
            codename: existingTemplate?.codename ?? `${role}Policy`,
            title: existingTemplate?.title ?? `${role} permissions`,
            baseRole: role,
            rules
        }
    })

    return { templates: [...unmanagedTemplates, ...templates] }
}

const RUNTIME_SCHEMA_READY_STATUSES = new Set<SchemaStatus | 'ready'>([
    'synced',
    'outdated',
    'update_available',
    'maintenance',
    'error',
    'ready'
])

const hasInitializedRuntimeSchema = (schemaName?: string | null, schemaStatus?: SchemaStatus | null): boolean => {
    if (!schemaName) {
        return false
    }

    if (!schemaStatus) {
        return false
    }

    return RUNTIME_SCHEMA_READY_STATUSES.has(schemaStatus as SchemaStatus | 'ready')
}

const ApplicationSettings = () => {
    const { applicationId } = useParams<{ applicationId: string }>()
    const { t, i18n } = useTranslation('applications')
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [activeTab, setActiveTab] = useState<SettingsTab>('general')
    const [generalChanges, setGeneralChanges] = useState<Partial<ApplicationDialogSettings>>({})
    const [visibilityChange, setVisibilityChange] = useState<boolean | undefined>(undefined)
    const [localLimits, setLocalLimits] = useState<Record<string, string>>({})

    const applicationQuery = useApplicationDetails(applicationId || '', {
        enabled: Boolean(applicationId)
    })
    const applicationDisplay = applicationQuery.data ? toApplicationDisplay(applicationQuery.data, i18n.language) : null
    const runtimeSchemaReady = hasInitializedRuntimeSchema(applicationQuery.data?.schemaName, applicationQuery.data?.schemaStatus)
    const supportsWorkspaceLimits = runtimeSchemaReady && applicationQuery.data?.workspacesEnabled === true

    const limitsQuery = useQuery({
        queryKey: applicationId
            ? applicationsQueryKeys.settingsLimits(applicationId, i18n.language)
            : ['applications', 'settings', 'missing'],
        queryFn: () => getApplicationWorkspaceLimits(applicationId!, i18n.language),
        enabled: Boolean(applicationId) && activeTab === 'limits' && supportsWorkspaceLimits
    })

    const saveLimitsMutation = useMutation({
        mutationKey: ['applications', 'settings', 'limits', 'update'],
        mutationFn: async (items: ApplicationWorkspaceLimitItem[]) =>
            updateApplicationWorkspaceLimits(
                applicationId!,
                items.map((item) => ({
                    objectId: item.objectId,
                    maxRows:
                        localLimits[item.objectId] === ''
                            ? null
                            : localLimits[item.objectId] !== undefined
                            ? Number(localLimits[item.objectId])
                            : item.maxRows
                }))
            ),
        onSuccess: async () => {
            if (!applicationId) return
            await queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.settingsLimits(applicationId, i18n.language) })
            enqueueSnackbar(t('settings.limitsSaved', 'Limits saved'), { variant: 'success' })
            setLocalLimits({})
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('settings.limitsSaveError', 'Failed to save limits'), { variant: 'error' })
        }
    })

    const effectiveGeneralSettings = useMemo<ApplicationDialogSettings>(
        () => ({
            ...DEFAULT_APPLICATION_DIALOG_SETTINGS,
            ...(applicationQuery.data?.settings ?? {}),
            ...generalChanges
        }),
        [applicationQuery.data?.settings, generalChanges]
    )
    const effectiveVisibility = visibilityChange ?? applicationQuery.data?.isPublic ?? false
    const hasVisibilityChange = visibilityChange !== undefined && visibilityChange !== applicationQuery.data?.isPublic
    const rolePolicyMatrix = useMemo(
        () => resolveRolePolicyMatrix(effectiveGeneralSettings.rolePolicies),
        [effectiveGeneralSettings.rolePolicies]
    )

    const updateRoleCapability = (role: ApplicationRole, capability: ApplicationCapabilityKey, checked: boolean) => {
        const nextMatrix = resolveRolePolicyMatrix(effectiveGeneralSettings.rolePolicies)
        nextMatrix[role] = {
            ...nextMatrix[role],
            [capability]: checked
        }
        setGeneralChanges((prev) => ({
            ...prev,
            rolePolicies: buildRolePoliciesFromMatrix(effectiveGeneralSettings.rolePolicies, nextMatrix)
        }))
    }

    const saveGeneralMutation = useMutation({
        mutationKey: ['applications', 'settings', 'general', 'update'],
        mutationFn: async (input: { settings: ApplicationDialogSettings; isPublic?: boolean }) => {
            const response = await updateApplication(applicationId!, {
                settings: sanitizeApplicationDialogSettingsForSave(input.settings),
                ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
                expectedVersion: applicationQuery.data?.version ?? 1
            })
            return response.data
        },
        onSuccess: async (saved) => {
            if (!applicationId) return
            queryClient.setQueryData(applicationsQueryKeys.detail(applicationId), saved)
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.detail(applicationId) }),
                queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.lists() }),
                queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.runtimeAll(applicationId) })
            ])
            enqueueSnackbar(t('settings.generalSaved', 'Application settings saved'), { variant: 'success' })
            setGeneralChanges({})
            setVisibilityChange(undefined)
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('settings.generalSaveError', 'Failed to save application settings'), {
                variant: 'error'
            })
        }
    })

    const effectiveLimits = useMemo(
        () =>
            (limitsQuery.data ?? []).map((item) => ({
                ...item,
                inputValue: localLimits[item.objectId] ?? (item.maxRows === null ? '' : String(item.maxRows))
            })),
        [limitsQuery.data, localLimits]
    )

    if (!applicationId) {
        return <Alert severity='error'>{t('settings.missingApplicationId', 'Application ID is missing in URL')}</Alert>
    }

    if (applicationQuery.isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
                <CircularProgress />
            </Box>
        )
    }

    if (applicationQuery.isError || !applicationDisplay) {
        return <Alert severity='error'>{t('settings.loadError', 'Failed to load application settings')}</Alert>
    }

    const hasGeneralChanges = Object.keys(generalChanges).length > 0 || hasVisibilityChange

    return (
        <MainCard disableHeader border={false} shadow={false} contentSX={{ px: 0, py: 0 }} disableContentPadding>
            <ViewHeader title={t('settings.title', 'Application Settings')} search={false} />

            <Box data-testid='application-settings-tabs' sx={PAGE_TAB_BAR_SX}>
                <Tabs value={activeTab} onChange={(_, value: SettingsTab) => setActiveTab(value)}>
                    <Tab value='general' label={t('settings.tabs.general', 'General')} />
                    <Tab value='connectors' label={t('settings.tabs.connectors', 'Connectors')} />
                    <Tab value='access' label={t('settings.tabs.access', 'Access')} />
                    <Tab value='limits' label={t('settings.tabs.limits', 'Limits')} />
                </Tabs>
            </Box>

            <Box data-testid='application-settings-content' sx={{ py: 2, mx: PAGE_CONTENT_GUTTER_MX }}>
                {activeTab === 'general' ? (
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
                                            {applicationQuery.data?.workspacesEnabled
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
                                                setVisibilityChange(nextValue === applicationQuery.data?.isPublic ? undefined : nextValue)
                                            }}
                                            inputProps={{ 'data-testid': 'application-settings-visibility-switch' }}
                                        />
                                    }
                                    label={
                                        effectiveVisibility
                                            ? t('settings.visibilityPublic', 'Public')
                                            : t('settings.visibilityClosed', 'Closed')
                                    }
                                />
                            </Box>

                            <Box
                                data-testid='application-setting-dialogSizePreset'
                                sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}
                            >
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant='subtitle2'>{t('settings.dialogSizePreset', 'Popup window size')}</Typography>
                                    <Typography variant='body2' color='text.secondary'>
                                        {t(
                                            'settings.dialogSizePresetDescription',
                                            'Default size for popup windows in this application control panel.'
                                        )}
                                    </Typography>
                                </Box>
                                <FormControl size='small' sx={{ minWidth: 250 }}>
                                    <InputLabel>{t('settings.dialogSizePreset', 'Popup window size')}</InputLabel>
                                    <Select
                                        value={effectiveGeneralSettings.dialogSizePreset}
                                        label={t('settings.dialogSizePreset', 'Popup window size')}
                                        onChange={(event) =>
                                            setGeneralChanges((prev) => ({
                                                ...prev,
                                                dialogSizePreset: event.target.value as ApplicationDialogSettings['dialogSizePreset']
                                            }))
                                        }
                                    >
                                        <MenuItem value='small'>{t('settings.dialogSizePresets.small', 'Small (about 480 px)')}</MenuItem>
                                        <MenuItem value='medium'>
                                            {t('settings.dialogSizePresets.medium', 'Medium (about 600 px)')}
                                        </MenuItem>
                                        <MenuItem value='large'>{t('settings.dialogSizePresets.large', 'Large (about 800 px)')}</MenuItem>
                                    </Select>
                                </FormControl>
                            </Box>

                            <Box
                                data-testid='application-setting-dialogAllowFullscreen'
                                sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}
                            >
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant='subtitle2'>
                                        {t('settings.dialogAllowFullscreen', 'Allow fullscreen expansion')}
                                    </Typography>
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
                                            checked={effectiveGeneralSettings.dialogAllowFullscreen}
                                            onChange={(event) =>
                                                setGeneralChanges((prev) => ({
                                                    ...prev,
                                                    dialogAllowFullscreen: event.target.checked
                                                }))
                                            }
                                        />
                                    }
                                    label=''
                                />
                            </Box>

                            <Box
                                data-testid='application-setting-dialogAllowResize'
                                sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}
                            >
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
                                            checked={effectiveGeneralSettings.dialogAllowResize}
                                            onChange={(event) =>
                                                setGeneralChanges((prev) => ({
                                                    ...prev,
                                                    dialogAllowResize: event.target.checked
                                                }))
                                            }
                                        />
                                    }
                                    label=''
                                />
                            </Box>

                            <Box
                                data-testid='application-setting-sectionLinksEnabled'
                                sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}
                            >
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant='subtitle2'>
                                        {t('settings.sectionLinksEnabled', 'Section-specific links')}
                                    </Typography>
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
                                            checked={effectiveGeneralSettings.sectionLinksEnabled}
                                            onChange={(event) =>
                                                setGeneralChanges((prev) => ({
                                                    ...prev,
                                                    sectionLinksEnabled: event.target.checked
                                                }))
                                            }
                                            inputProps={{ 'data-testid': 'application-settings-section-links-switch' }}
                                        />
                                    }
                                    label=''
                                />
                            </Box>

                            <Box
                                data-testid='application-setting-dialogCloseBehavior'
                                sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}
                            >
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
                                        value={effectiveGeneralSettings.dialogCloseBehavior}
                                        label={t('settings.dialogCloseBehavior', 'Popup window type')}
                                        onChange={(event) =>
                                            setGeneralChanges((prev) => ({
                                                ...prev,
                                                dialogCloseBehavior: event.target.value as ApplicationDialogSettings['dialogCloseBehavior']
                                            }))
                                        }
                                    >
                                        <MenuItem value='strict-modal'>
                                            {t('settings.dialogCloseBehaviors.strict-modal', 'Modal windows')}
                                        </MenuItem>
                                        <MenuItem value='backdrop-close'>
                                            {t('settings.dialogCloseBehaviors.backdrop-close', 'Non-modal windows')}
                                        </MenuItem>
                                    </Select>
                                </FormControl>
                            </Box>

                            <Box
                                data-testid='application-setting-dashboardDefaultMode'
                                sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}
                            >
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant='subtitle2'>
                                        {t('settings.dashboardDefaultMode', 'Runtime dashboard default')}
                                    </Typography>
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
                                        value={effectiveGeneralSettings.dashboardDefaultMode}
                                        label={t('settings.dashboardDefaultMode', 'Runtime dashboard default')}
                                        onChange={(event) =>
                                            setGeneralChanges((prev) => ({
                                                ...prev,
                                                dashboardDefaultMode: event.target
                                                    .value as ApplicationDialogSettings['dashboardDefaultMode']
                                            }))
                                        }
                                    >
                                        <MenuItem value='layout-default'>
                                            {t('settings.dashboardDefaultModes.layout-default', 'Layout default')}
                                        </MenuItem>
                                        <MenuItem value='first-menu-item'>
                                            {t('settings.dashboardDefaultModes.first-menu-item', 'First menu item')}
                                        </MenuItem>
                                    </Select>
                                </FormControl>
                            </Box>

                            <Box
                                data-testid='application-setting-datasourceExecutionPolicy'
                                sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}
                            >
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant='subtitle2'>
                                        {t('settings.datasourceExecutionPolicy', 'Datasource execution')}
                                    </Typography>
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
                                        value={effectiveGeneralSettings.datasourceExecutionPolicy}
                                        label={t('settings.datasourceExecutionPolicy', 'Datasource execution')}
                                        onChange={(event) =>
                                            setGeneralChanges((prev) => ({
                                                ...prev,
                                                datasourceExecutionPolicy: event.target
                                                    .value as ApplicationDialogSettings['datasourceExecutionPolicy']
                                            }))
                                        }
                                    >
                                        <MenuItem value='workspace-scoped'>
                                            {t('settings.datasourceExecutionPolicies.workspace-scoped', 'Workspace scoped')}
                                        </MenuItem>
                                        <MenuItem value='layout-only'>
                                            {t('settings.datasourceExecutionPolicies.layout-only', 'Layout only')}
                                        </MenuItem>
                                    </Select>
                                </FormControl>
                            </Box>

                            <Box
                                data-testid='application-setting-workspaceOpenBehavior'
                                sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}
                            >
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
                                        value={effectiveGeneralSettings.workspaceOpenBehavior}
                                        label={t('settings.workspaceOpenBehavior', 'Workspace opening')}
                                        onChange={(event) =>
                                            setGeneralChanges((prev) => ({
                                                ...prev,
                                                workspaceOpenBehavior: event.target
                                                    .value as ApplicationDialogSettings['workspaceOpenBehavior']
                                            }))
                                        }
                                    >
                                        <MenuItem value='last-used'>
                                            {t('settings.workspaceOpenBehaviors.last-used', 'Last used workspace')}
                                        </MenuItem>
                                        <MenuItem value='default-workspace'>
                                            {t('settings.workspaceOpenBehaviors.default-workspace', 'Default workspace')}
                                        </MenuItem>
                                    </Select>
                                </FormControl>
                            </Box>
                        </Stack>

                        {hasGeneralChanges ? (
                            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                                <Button
                                    data-testid='application-settings-general-save'
                                    variant='contained'
                                    startIcon={<SaveIcon />}
                                    onClick={() =>
                                        saveGeneralMutation.mutate({
                                            settings: effectiveGeneralSettings,
                                            ...(hasVisibilityChange ? { isPublic: effectiveVisibility } : {})
                                        })
                                    }
                                    disabled={saveGeneralMutation.isPending}
                                >
                                    {t('settings.save', 'Save')}
                                </Button>
                            </Box>
                        ) : null}
                    </>
                ) : activeTab === 'connectors' ? (
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
                                    <Typography variant='subtitle2'>
                                        {t('settings.schemaDiffLocalizedLabels', 'Localized schema change labels')}
                                    </Typography>
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
                                            checked={effectiveGeneralSettings.schemaDiffLocalizedLabels !== false}
                                            onChange={(event) =>
                                                setGeneralChanges((prev) => ({
                                                    ...prev,
                                                    schemaDiffLocalizedLabels: event.target.checked
                                                }))
                                            }
                                            slotProps={{
                                                input: {
                                                    'data-testid': 'application-settings-schema-diff-localized-labels-switch'
                                                }
                                            }}
                                        />
                                    }
                                    label=''
                                />
                            </Box>
                        </Stack>

                        {hasGeneralChanges ? (
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <Button
                                    data-testid='application-settings-connectors-save'
                                    variant='contained'
                                    startIcon={<SaveIcon />}
                                    onClick={() =>
                                        saveGeneralMutation.mutate({
                                            settings: effectiveGeneralSettings,
                                            ...(hasVisibilityChange ? { isPublic: effectiveVisibility } : {})
                                        })
                                    }
                                    disabled={saveGeneralMutation.isPending}
                                >
                                    {t('settings.save', 'Save')}
                                </Button>
                            </Box>
                        ) : null}
                    </Stack>
                ) : activeTab === 'access' ? (
                    <Stack spacing={2}>
                        <Alert severity='info'>
                            {t(
                                'settings.accessHint',
                                'Configure generic application and workspace capabilities for each application role. These rules are enforced by the runtime API.'
                            )}
                        </Alert>

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
                                                    onChange={(event) => updateRoleCapability(role, capability.key, event.target.checked)}
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

                        {hasGeneralChanges ? (
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <Button
                                    data-testid='application-settings-access-save'
                                    variant='contained'
                                    startIcon={<SaveIcon />}
                                    onClick={() =>
                                        saveGeneralMutation.mutate({
                                            settings: effectiveGeneralSettings,
                                            ...(hasVisibilityChange ? { isPublic: effectiveVisibility } : {})
                                        })
                                    }
                                    disabled={saveGeneralMutation.isPending}
                                >
                                    {t('settings.save', 'Save')}
                                </Button>
                            </Box>
                        ) : null}
                    </Stack>
                ) : (
                    <Stack spacing={2}>
                        <Alert severity='info'>
                            {t(
                                'settings.limitsHint',
                                'Set row limits per catalog for every workspace. When the limit is reached, users will not be able to create more records in that catalog.'
                            )}
                        </Alert>

                        {!runtimeSchemaReady ? (
                            <Alert severity='info'>
                                {t(
                                    'settings.limitsRequiresSchema',
                                    'Limits settings will become available after the application schema is created.'
                                )}
                            </Alert>
                        ) : applicationQuery.data?.workspacesEnabled !== true ? (
                            <Alert severity='info'>
                                {t(
                                    'settings.limitsRequiresWorkspaces',
                                    'Limits are available only for applications created with workspace mode enabled.'
                                )}
                            </Alert>
                        ) : limitsQuery.isLoading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                <CircularProgress size={28} />
                            </Box>
                        ) : limitsQuery.isError ? (
                            <Alert severity='error'>{t('settings.limitsLoadError', 'Failed to load limits')}</Alert>
                        ) : (
                            <Stack spacing={2}>
                                {effectiveLimits.map((item) => (
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
                                            onChange={(event) =>
                                                setLocalLimits((prev) => ({
                                                    ...prev,
                                                    [item.objectId]: event.target.value
                                                }))
                                            }
                                            inputProps={{
                                                min: 1,
                                                'data-testid': `application-settings-limit-input-${item.objectId}`
                                            }}
                                            helperText={t('settings.emptyMeansUnlimited', 'Leave empty for unlimited')}
                                        />
                                    </Box>
                                ))}

                                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <Button
                                        data-testid='application-settings-limits-save'
                                        variant='contained'
                                        startIcon={<SaveIcon />}
                                        onClick={() => saveLimitsMutation.mutate(limitsQuery.data ?? [])}
                                        disabled={saveLimitsMutation.isPending}
                                    >
                                        {t('settings.save', 'Save')}
                                    </Button>
                                </Box>
                            </Stack>
                        )}
                    </Stack>
                )}
            </Box>
        </MainCard>
    )
}

export default ApplicationSettings
