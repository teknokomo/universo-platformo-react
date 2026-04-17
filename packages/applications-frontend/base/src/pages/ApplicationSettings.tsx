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
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { TemplateMainCard as MainCard, ViewHeaderMUI as ViewHeader, PAGE_CONTENT_GUTTER_MX, PAGE_TAB_BAR_SX } from '@universo/template-mui'
import { useApplicationDetails } from '../api/useApplicationDetails'
import { applicationsQueryKeys } from '../api/queryKeys'
import { getApplicationWorkspaceLimits, updateApplication, updateApplicationWorkspaceLimits } from '../api/applications'
import { DEFAULT_APPLICATION_DIALOG_SETTINGS } from '../settings/dialogSettings'
import { toApplicationDisplay, type ApplicationDialogSettings, type ApplicationWorkspaceLimitItem, type SchemaStatus } from '../types'

type SettingsTab = 'general' | 'limits'

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

    const saveGeneralMutation = useMutation({
        mutationKey: ['applications', 'settings', 'general', 'update'],
        mutationFn: async (settings: ApplicationDialogSettings) => {
            const response = await updateApplication(applicationId!, {
                settings,
                expectedVersion: applicationQuery.data?.version ?? 1
            })
            return response.data
        },
        onSuccess: async (saved) => {
            if (!applicationId) return
            queryClient.setQueryData(applicationsQueryKeys.detail(applicationId), saved)
            await queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.detail(applicationId) })
            enqueueSnackbar(t('settings.generalSaved', 'Popup settings saved'), { variant: 'success' })
            setGeneralChanges({})
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('settings.generalSaveError', 'Failed to save popup settings'), {
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

    const hasGeneralChanges = Object.keys(generalChanges).length > 0

    return (
        <MainCard disableHeader border={false} shadow={false} contentSX={{ px: 0, py: 0 }} disableContentPadding>
            <ViewHeader title={t('settings.title', 'Application Settings')} search={false} />

            <Box data-testid='application-settings-tabs' sx={PAGE_TAB_BAR_SX}>
                <Tabs value={activeTab} onChange={(_, value: SettingsTab) => setActiveTab(value)}>
                    <Tab value='general' label={t('settings.tabs.general', 'General')} />
                    <Tab value='limits' label={t('settings.tabs.limits', 'Limits')} />
                </Tabs>
            </Box>

            <Box data-testid='application-settings-content' sx={{ py: 2, mx: PAGE_CONTENT_GUTTER_MX }}>
                {activeTab === 'general' ? (
                    <>
                        <Stack spacing={0} divider={<Divider />}>
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
                        </Stack>

                        {hasGeneralChanges ? (
                            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                                <Button
                                    data-testid='application-settings-general-save'
                                    variant='contained'
                                    startIcon={<SaveIcon />}
                                    onClick={() => saveGeneralMutation.mutate(effectiveGeneralSettings)}
                                    disabled={saveGeneralMutation.isPending}
                                >
                                    {t('settings.save', 'Save')}
                                </Button>
                            </Box>
                        ) : null}
                    </>
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
