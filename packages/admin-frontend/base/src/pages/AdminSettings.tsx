/**
 * Universo Platformo | Admin Settings Page
 *
 * Platform-wide configuration settings organized by category.
 * Reads/writes admin.cfg_settings table via admin settings API.
 */

import { useState, useCallback, useMemo } from 'react'
import {
    Box,
    Tabs,
    Tab,
    Typography,
    Stack,
    Button,
    Divider,
    Skeleton,
    Alert,
    Chip,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Switch,
    FormControlLabel
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import { useTranslation } from 'react-i18next'
import { useSnackbar } from 'notistack'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    DEFAULT_PLATFORM_SYSTEM_ATTRIBUTES_POLICY,
    PLATFORM_SYSTEM_ATTRIBUTE_ADMIN_KEYS,
    type DialogCloseBehavior,
    type DialogSizePreset
} from '@universo/types'
import { TemplateMainCard as MainCard, ViewHeaderMUI as ViewHeader, PAGE_CONTENT_GUTTER_MX, PAGE_TAB_BAR_SX } from '@universo/template-mui'
import * as settingsApi from '../api/settingsApi'
import type { AdminSettingItem } from '../api/settingsApi'
import { settingsQueryKeys } from '../api/queryKeys'
import { DEFAULT_ADMIN_DIALOG_SETTINGS, type AdminDialogSettings } from '../settings/dialogSettings'

type SettingTab = 'general' | 'metahubs' | 'applications'
type CodenameStyle = 'pascal-case' | 'kebab-case'
type CodenameAlphabet = 'en' | 'ru' | 'en-ru'

interface MetahubDefaults {
    codenameStyle: CodenameStyle
    codenameAlphabet: CodenameAlphabet
    codenameAllowMixedAlphabets: boolean
    codenameAutoConvertMixedAlphabets: boolean
    codenameLocalizedEnabled: boolean
    platformSystemAttributesConfigurable: boolean
    platformSystemAttributesRequired: boolean
    platformSystemAttributesIgnoreMetahubSettings: boolean
}

const DEFAULT_METAHUB_SETTINGS: MetahubDefaults = {
    codenameStyle: 'pascal-case',
    codenameAlphabet: 'en-ru',
    codenameAllowMixedAlphabets: false,
    codenameAutoConvertMixedAlphabets: true,
    codenameLocalizedEnabled: true,
    platformSystemAttributesConfigurable: DEFAULT_PLATFORM_SYSTEM_ATTRIBUTES_POLICY.allowConfiguration,
    platformSystemAttributesRequired: DEFAULT_PLATFORM_SYSTEM_ATTRIBUTES_POLICY.forceCreate,
    platformSystemAttributesIgnoreMetahubSettings: DEFAULT_PLATFORM_SYSTEM_ATTRIBUTES_POLICY.ignoreMetahubSettings
}

interface CodenamePreviewProps {
    style: CodenameStyle
    alphabet: CodenameAlphabet
    allowMixed: boolean
    showMixedPreviewOnly?: boolean
}

const CodenamePreview = ({ style, alphabet, allowMixed, showMixedPreviewOnly = false }: CodenamePreviewProps) => {
    const { t } = useTranslation('admin')
    const variants = alphabet === 'en-ru' ? (showMixedPreviewOnly && allowMixed ? ['mixed'] : ['en', 'ru']) : [alphabet]

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Typography variant='caption' color='text.secondary'>
                {t('settings.metahubs.codenamePreview.title')}:
            </Typography>
            {variants.map((variant) => (
                <Chip
                    key={variant}
                    label={t(`settings.metahubs.codenamePreview.${style}.${variant}`)}
                    size='small'
                    variant='outlined'
                    sx={{ fontFamily: 'monospace', fontWeight: 500 }}
                />
            ))}
        </Box>
    )
}

function extractValue(setting: AdminSettingItem): unknown {
    const raw = setting.value
    return '_value' in raw ? raw._value : raw
}

function buildSettingsMap(items: AdminSettingItem[]): Map<string, AdminSettingItem> {
    return new Map(items.map((item) => [item.key, item]))
}

const AdminSettings = () => {
    const { t } = useTranslation('admin')
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()

    const [activeTab, setActiveTab] = useState<SettingTab>('general')
    const [generalChanges, setGeneralChanges] = useState<Partial<AdminDialogSettings>>({})
    const [metahubsChanges, setMetahubsChanges] = useState<Partial<MetahubDefaults>>({})

    const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: SettingTab) => {
        setActiveTab(newValue)
    }, [])

    const generalQuery = useQuery({
        queryKey: settingsQueryKeys.byCategory('general'),
        queryFn: () => settingsApi.listSettingsByCategory('general')
    })

    const metahubsQuery = useQuery({
        queryKey: settingsQueryKeys.byCategory('metahubs'),
        queryFn: () => settingsApi.listSettingsByCategory('metahubs')
    })

    const generalSettingsMap = useMemo(() => buildSettingsMap(generalQuery.data?.items ?? []), [generalQuery.data?.items])
    const metahubsSettingsMap = useMemo(() => buildSettingsMap(metahubsQuery.data?.items ?? []), [metahubsQuery.data?.items])

    const getGeneralEffective = useCallback(
        <K extends keyof AdminDialogSettings>(key: K): AdminDialogSettings[K] => {
            if (key in generalChanges) return generalChanges[key] as AdminDialogSettings[K]
            const setting = generalSettingsMap.get(key)
            if (setting) return extractValue(setting) as AdminDialogSettings[K]
            return DEFAULT_ADMIN_DIALOG_SETTINGS[key]
        },
        [generalChanges, generalSettingsMap]
    )

    const getMetahubsEffective = useCallback(
        <K extends keyof MetahubDefaults>(key: K): MetahubDefaults[K] => {
            if (key in metahubsChanges) return metahubsChanges[key] as MetahubDefaults[K]
            const setting = metahubsSettingsMap.get(key)
            if (setting) return extractValue(setting) as MetahubDefaults[K]
            return DEFAULT_METAHUB_SETTINGS[key]
        },
        [metahubsChanges, metahubsSettingsMap]
    )

    const saveGeneralMutation = useMutation({
        mutationFn: async (changes: Partial<AdminDialogSettings>) => settingsApi.upsertSettingsBatch('general', changes),
        onSuccess: (data) => {
            queryClient.setQueryData(settingsQueryKeys.byCategory('general'), data)
            queryClient.invalidateQueries({ queryKey: settingsQueryKeys.byCategory('general') })
            setGeneralChanges({})
            enqueueSnackbar(t('settings.saved'), { variant: 'success' })
        },
        onError: () => {
            enqueueSnackbar(t('settings.saveError'), { variant: 'error' })
        }
    })

    const saveMetahubsMutation = useMutation({
        mutationFn: async (changes: Partial<MetahubDefaults>) => settingsApi.upsertSettingsBatch('metahubs', changes),
        onSuccess: (data) => {
            queryClient.setQueryData(settingsQueryKeys.byCategory('metahubs'), data)
            queryClient.invalidateQueries({ queryKey: settingsQueryKeys.byCategory('metahubs') })
            setMetahubsChanges({})
            enqueueSnackbar(t('settings.saved'), { variant: 'success' })
        },
        onError: () => {
            enqueueSnackbar(t('settings.saveError'), { variant: 'error' })
        }
    })

    const handleGeneralChange = useCallback(<K extends keyof AdminDialogSettings>(key: K, value: AdminDialogSettings[K]) => {
        setGeneralChanges((prev) => ({ ...prev, [key]: value }))
    }, [])

    const handleMetahubsChange = useCallback(<K extends keyof MetahubDefaults>(key: K, value: MetahubDefaults[K]) => {
        setMetahubsChanges((prev) => ({ ...prev, [key]: value }))
    }, [])

    const handleSaveGeneral = useCallback(() => {
        if (Object.keys(generalChanges).length === 0) return
        saveGeneralMutation.mutate(generalChanges)
    }, [generalChanges, saveGeneralMutation])

    const handleSaveMetahubs = useCallback(() => {
        if (Object.keys(metahubsChanges).length === 0) return
        saveMetahubsMutation.mutate(metahubsChanges)
    }, [metahubsChanges, saveMetahubsMutation])

    const activeTabHasError = (activeTab === 'general' && generalQuery.isError) || (activeTab === 'metahubs' && metahubsQuery.isError)

    if (activeTabHasError) {
        return (
            <MainCard disableHeader border={false} shadow={false} contentSX={{ px: 0, py: 0 }} disableContentPadding>
                <Alert severity='error' sx={{ m: 2 }}>
                    {t('settings.error')}
                </Alert>
            </MainCard>
        )
    }

    const effectiveDialogSizePreset = getGeneralEffective('dialogSizePreset')
    const effectiveDialogAllowFullscreen = getGeneralEffective('dialogAllowFullscreen')
    const effectiveDialogAllowResize = getGeneralEffective('dialogAllowResize')
    const effectiveDialogCloseBehavior = getGeneralEffective('dialogCloseBehavior')

    const effectiveStyle = getMetahubsEffective('codenameStyle')
    const effectiveAlphabet = getMetahubsEffective('codenameAlphabet')
    const effectiveAllowMixed = getMetahubsEffective('codenameAllowMixedAlphabets')
    const effectiveAutoConvertMixed = getMetahubsEffective('codenameAutoConvertMixedAlphabets')
    const effectiveLocalizedEnabled = getMetahubsEffective('codenameLocalizedEnabled')
    const effectivePlatformSystemAttributesConfigurable = getMetahubsEffective(PLATFORM_SYSTEM_ATTRIBUTE_ADMIN_KEYS.allowConfiguration)
    const effectivePlatformSystemAttributesRequired = getMetahubsEffective(PLATFORM_SYSTEM_ATTRIBUTE_ADMIN_KEYS.forceCreate)
    const effectivePlatformSystemAttributesIgnoreMetahubSettings = getMetahubsEffective(
        PLATFORM_SYSTEM_ATTRIBUTE_ADMIN_KEYS.ignoreMetahubSettings
    )

    const hasGeneralChanges = Object.keys(generalChanges).length > 0
    const hasMetahubsChanges = Object.keys(metahubsChanges).length > 0

    return (
        <MainCard disableHeader border={false} shadow={false} contentSX={{ px: 0, py: 0 }} disableContentPadding>
            <ViewHeader title={t('settings.title')} />

            <Box data-testid='admin-settings-tabs' sx={PAGE_TAB_BAR_SX}>
                <Tabs value={activeTab} onChange={handleTabChange}>
                    <Tab label={t('settings.tabs.general')} value='general' />
                    <Tab label={t('settings.tabs.metahubs')} value='metahubs' />
                    <Tab label={t('settings.tabs.applications')} value='applications' />
                </Tabs>
            </Box>

            <Box data-testid='admin-settings-content' sx={{ py: 2, mx: PAGE_CONTENT_GUTTER_MX }}>
                {activeTab === 'general' ? (
                    <>
                        {generalQuery.isLoading ? (
                            <Stack spacing={2}>
                                {[1, 2, 3, 4].map((index) => (
                                    <Skeleton key={index} variant='rectangular' height={60} sx={{ borderRadius: 1 }} />
                                ))}
                            </Stack>
                        ) : (
                            <Stack spacing={0} divider={<Divider />}>
                                <Box data-testid='admin-setting-dialogSizePreset' sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant='subtitle2'>{t('settings.general.dialogSizePreset')}</Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t('settings.general.dialogSizePresetDescription')}
                                        </Typography>
                                    </Box>
                                    <FormControl size='small' sx={{ minWidth: 250 }}>
                                        <InputLabel>{t('settings.general.dialogSizePreset')}</InputLabel>
                                        <Select
                                            value={effectiveDialogSizePreset}
                                            label={t('settings.general.dialogSizePreset')}
                                            onChange={(event) =>
                                                handleGeneralChange('dialogSizePreset', event.target.value as DialogSizePreset)
                                            }
                                        >
                                            <MenuItem value='small'>{t('settings.dialogSizePresets.small')}</MenuItem>
                                            <MenuItem value='medium'>{t('settings.dialogSizePresets.medium')}</MenuItem>
                                            <MenuItem value='large'>{t('settings.dialogSizePresets.large')}</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Box>

                                <Box
                                    data-testid='admin-setting-dialogAllowFullscreen'
                                    sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}
                                >
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant='subtitle2'>{t('settings.general.dialogAllowFullscreen')}</Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t('settings.general.dialogAllowFullscreenDescription')}
                                        </Typography>
                                    </Box>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={effectiveDialogAllowFullscreen}
                                                onChange={(event) => handleGeneralChange('dialogAllowFullscreen', event.target.checked)}
                                            />
                                        }
                                        label=''
                                    />
                                </Box>

                                <Box data-testid='admin-setting-dialogAllowResize' sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant='subtitle2'>{t('settings.general.dialogAllowResize')}</Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t('settings.general.dialogAllowResizeDescription')}
                                        </Typography>
                                    </Box>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={effectiveDialogAllowResize}
                                                onChange={(event) => handleGeneralChange('dialogAllowResize', event.target.checked)}
                                            />
                                        }
                                        label=''
                                    />
                                </Box>

                                <Box data-testid='admin-setting-dialogCloseBehavior' sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant='subtitle2'>{t('settings.general.dialogCloseBehavior')}</Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t('settings.general.dialogCloseBehaviorDescription')}
                                        </Typography>
                                    </Box>
                                    <FormControl size='small' sx={{ minWidth: 250 }}>
                                        <InputLabel>{t('settings.general.dialogCloseBehavior')}</InputLabel>
                                        <Select
                                            value={effectiveDialogCloseBehavior}
                                            label={t('settings.general.dialogCloseBehavior')}
                                            onChange={(event) =>
                                                handleGeneralChange('dialogCloseBehavior', event.target.value as DialogCloseBehavior)
                                            }
                                        >
                                            <MenuItem value='strict-modal'>{t('settings.dialogCloseBehaviors.strict-modal')}</MenuItem>
                                            <MenuItem value='backdrop-close'>{t('settings.dialogCloseBehaviors.backdrop-close')}</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Box>
                            </Stack>
                        )}

                        {hasGeneralChanges ? (
                            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                                <Button
                                    variant='contained'
                                    startIcon={<SaveIcon />}
                                    onClick={handleSaveGeneral}
                                    disabled={saveGeneralMutation.isPending}
                                >
                                    {t('settings.save')}
                                </Button>
                            </Box>
                        ) : null}
                    </>
                ) : null}

                {activeTab === 'metahubs' ? (
                    <>
                        {metahubsQuery.isLoading ? (
                            <Stack spacing={2}>
                                {[1, 2, 3].map((index) => (
                                    <Skeleton key={index} variant='rectangular' height={60} sx={{ borderRadius: 1 }} />
                                ))}
                            </Stack>
                        ) : (
                            <Stack spacing={0} divider={<Divider />}>
                                <Box data-testid='admin-setting-codenameStyle' sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant='subtitle2'>{t('settings.metahubs.codenameStyle')}</Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t('settings.metahubs.codenameStyleDescription')}
                                        </Typography>
                                        <CodenamePreview style={effectiveStyle} alphabet={effectiveAlphabet} allowMixed={effectiveAllowMixed} />
                                    </Box>
                                    <FormControl size='small' sx={{ minWidth: 250 }}>
                                        <InputLabel>{t('settings.metahubs.codenameStyle')}</InputLabel>
                                        <Select
                                            value={effectiveStyle}
                                            label={t('settings.metahubs.codenameStyle')}
                                            onChange={(event) => handleMetahubsChange('codenameStyle', event.target.value as CodenameStyle)}
                                        >
                                            <MenuItem value='pascal-case'>{t('settings.metahubs.styleOptions.pascal-case')}</MenuItem>
                                            <MenuItem value='kebab-case'>{t('settings.metahubs.styleOptions.kebab-case')}</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Box>

                                <Box
                                    data-testid='admin-setting-codenameAlphabet'
                                    sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}
                                >
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant='subtitle2'>{t('settings.metahubs.codenameAlphabet')}</Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t('settings.metahubs.codenameAlphabetDescription')}
                                        </Typography>
                                        <CodenamePreview style={effectiveStyle} alphabet={effectiveAlphabet} allowMixed={effectiveAllowMixed} />
                                    </Box>
                                    <FormControl size='small' sx={{ minWidth: 250 }}>
                                        <InputLabel>{t('settings.metahubs.codenameAlphabet')}</InputLabel>
                                        <Select
                                            value={effectiveAlphabet}
                                            label={t('settings.metahubs.codenameAlphabet')}
                                            onChange={(event) =>
                                                handleMetahubsChange('codenameAlphabet', event.target.value as CodenameAlphabet)
                                            }
                                        >
                                            <MenuItem value='en'>{t('settings.metahubs.alphabetOptions.en')}</MenuItem>
                                            <MenuItem value='ru'>{t('settings.metahubs.alphabetOptions.ru')}</MenuItem>
                                            <MenuItem value='en-ru'>{t('settings.metahubs.alphabetOptions.en-ru')}</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Box>

                                {effectiveAlphabet === 'en-ru' ? (
                                    <Box
                                        data-testid='admin-setting-codenameAllowMixedAlphabets'
                                        sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}
                                    >
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography variant='subtitle2'>
                                                {t('settings.metahubs.codenameAllowMixedAlphabets')}
                                            </Typography>
                                            <Typography variant='body2' color='text.secondary'>
                                                {t('settings.metahubs.codenameAllowMixedAlphabetsDescription')}
                                            </Typography>
                                            <CodenamePreview
                                                style={effectiveStyle}
                                                alphabet={effectiveAlphabet}
                                                allowMixed={effectiveAllowMixed}
                                                showMixedPreviewOnly
                                            />
                                        </Box>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={effectiveAllowMixed}
                                                    onChange={(event) =>
                                                        handleMetahubsChange('codenameAllowMixedAlphabets', event.target.checked)
                                                    }
                                                />
                                            }
                                            label=''
                                        />
                                    </Box>
                                ) : null}

                                {effectiveAlphabet === 'en-ru' && !effectiveAllowMixed ? (
                                    <Box
                                        data-testid='admin-setting-codenameAutoConvertMixedAlphabets'
                                        sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}
                                    >
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography variant='subtitle2'>
                                                {t('settings.metahubs.codenameAutoConvertMixedAlphabets')}
                                            </Typography>
                                            <Typography variant='body2' color='text.secondary'>
                                                {t('settings.metahubs.codenameAutoConvertMixedAlphabetsDescription')}
                                            </Typography>
                                        </Box>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={effectiveAutoConvertMixed}
                                                    onChange={(event) =>
                                                        handleMetahubsChange('codenameAutoConvertMixedAlphabets', event.target.checked)
                                                    }
                                                />
                                            }
                                            label=''
                                        />
                                    </Box>
                                ) : null}

                                <Box data-testid='admin-setting-codenameLocalizedEnabled' sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant='subtitle2'>{t('settings.metahubs.codenameLocalizedEnabled')}</Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t('settings.metahubs.codenameLocalizedEnabledDescription')}
                                        </Typography>
                                    </Box>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={effectiveLocalizedEnabled}
                                                onChange={(event) => handleMetahubsChange('codenameLocalizedEnabled', event.target.checked)}
                                            />
                                        }
                                        label=''
                                    />
                                </Box>

                                <Box sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant='subtitle2'>
                                            {t('settings.metahubs.platformSystemAttributesConfigurable')}
                                        </Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t('settings.metahubs.platformSystemAttributesConfigurableDescription')}
                                        </Typography>
                                    </Box>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={effectivePlatformSystemAttributesConfigurable}
                                                onChange={(event) =>
                                                    handleMetahubsChange(PLATFORM_SYSTEM_ATTRIBUTE_ADMIN_KEYS.allowConfiguration, event.target.checked)
                                                }
                                            />
                                        }
                                        label=''
                                    />
                                </Box>

                                <Box sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant='subtitle2'>
                                            {t('settings.metahubs.platformSystemAttributesRequired')}
                                        </Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t('settings.metahubs.platformSystemAttributesRequiredDescription')}
                                        </Typography>
                                    </Box>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={effectivePlatformSystemAttributesRequired}
                                                onChange={(event) =>
                                                    handleMetahubsChange(PLATFORM_SYSTEM_ATTRIBUTE_ADMIN_KEYS.forceCreate, event.target.checked)
                                                }
                                            />
                                        }
                                        label=''
                                    />
                                </Box>

                                <Box sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant='subtitle2'>
                                            {t('settings.metahubs.platformSystemAttributesIgnoreMetahubSettings')}
                                        </Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t('settings.metahubs.platformSystemAttributesIgnoreMetahubSettingsDescription')}
                                        </Typography>
                                    </Box>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={effectivePlatformSystemAttributesIgnoreMetahubSettings}
                                                onChange={(event) =>
                                                    handleMetahubsChange(
                                                        PLATFORM_SYSTEM_ATTRIBUTE_ADMIN_KEYS.ignoreMetahubSettings,
                                                        event.target.checked
                                                    )
                                                }
                                            />
                                        }
                                        label=''
                                    />
                                </Box>
                            </Stack>
                        )}

                        {hasMetahubsChanges ? (
                            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                                <Button
                                    variant='contained'
                                    startIcon={<SaveIcon />}
                                    onClick={handleSaveMetahubs}
                                    disabled={saveMetahubsMutation.isPending}
                                >
                                    {t('settings.save')}
                                </Button>
                            </Box>
                        ) : null}
                    </>
                ) : null}

                {activeTab === 'applications' ? (
                    <Alert severity='info' sx={{ mt: 1 }}>
                        {t('settings.applications.placeholder')}
                    </Alert>
                ) : null}
            </Box>
        </MainCard>
    )
}

export default AdminSettings
