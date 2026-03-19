import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Box, Button, CircularProgress, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { TemplateMainCard as MainCard, ViewHeaderMUI as ViewHeader } from '@universo/template-mui'
import { useApplicationDetails } from '../api/useApplicationDetails'
import { applicationsQueryKeys } from '../api/queryKeys'
import { getApplicationWorkspaceLimits, updateApplicationWorkspaceLimits } from '../api/applications'
import { toApplicationDisplay, type ApplicationWorkspaceLimitItem } from '../types'

type SettingsTab = 'general' | 'limits'

const ApplicationSettings = () => {
    const { applicationId } = useParams<{ applicationId: string }>()
    const { t, i18n } = useTranslation('applications')
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [activeTab, setActiveTab] = useState<SettingsTab>('general')
    const [localLimits, setLocalLimits] = useState<Record<string, string>>({})

    const applicationQuery = useApplicationDetails(applicationId || '', {
        enabled: Boolean(applicationId)
    })
    const applicationDisplay = applicationQuery.data ? toApplicationDisplay(applicationQuery.data, i18n.language) : null
    const hasRuntimeSchema = Boolean(applicationQuery.data?.schemaName)
    const supportsWorkspaceLimits = hasRuntimeSchema && applicationQuery.data?.workspacesEnabled === true

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

    return (
        <MainCard disableHeader border={false} shadow={false} contentSX={{ px: 0, py: 0 }} disableContentPadding>
            <ViewHeader title={t('settings.title', 'Application Settings')} description={applicationDisplay.name} search={false} />

            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
                <Tabs value={activeTab} onChange={(_, value: SettingsTab) => setActiveTab(value)}>
                    <Tab value='general' label={t('settings.tabs.general', 'General')} />
                    <Tab value='limits' label={t('settings.tabs.limits', 'Limits')} />
                </Tabs>
            </Box>

            <Box sx={{ p: 2 }}>
                {activeTab === 'general' ? (
                    <Stack spacing={2}>
                        {!hasRuntimeSchema ? (
                            <Alert severity='info'>
                                {t(
                                    'settings.requiresSchema',
                                    'Application settings that depend on runtime schema will become available after the schema is created.'
                                )}
                            </Alert>
                        ) : null}
                        {applicationQuery.data?.workspacesEnabled !== true ? (
                            <Alert severity='info'>
                                {t(
                                    'settings.requiresWorkspaces',
                                    'Workspace-specific settings are available only for applications created with workspace mode enabled.'
                                )}
                            </Alert>
                        ) : null}
                        <Alert severity='info'>
                            {t('settings.generalPlaceholder', 'General application settings will be available in future versions.')}
                        </Alert>
                    </Stack>
                ) : (
                    <Stack spacing={2}>
                        <Alert severity='info'>
                            {t(
                                'settings.limitsHint',
                                'Set row limits per catalog for every workspace. When the limit is reached, users will not be able to create more records in that catalog.'
                            )}
                        </Alert>

                        {!hasRuntimeSchema ? (
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
                                            inputProps={{ min: 1 }}
                                            helperText={t('settings.emptyMeansUnlimited', 'Leave empty for unlimited')}
                                        />
                                    </Box>
                                ))}

                                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <Button
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
