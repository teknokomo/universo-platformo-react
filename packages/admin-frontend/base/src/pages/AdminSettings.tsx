/**
 * Universo Platformo | Admin Settings Page
 *
 * Platform-wide configuration settings organized by category.
 * Tabs: Metahubs (codename defaults), Applications (future).
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
import { DEFAULT_PLATFORM_SYSTEM_ATTRIBUTES_POLICY, PLATFORM_SYSTEM_ATTRIBUTE_ADMIN_KEYS } from '@universo/types'

import { TemplateMainCard as MainCard, ViewHeaderMUI as ViewHeader } from '@universo/template-mui'

import * as settingsApi from '../api/settingsApi'
import type { AdminSettingItem } from '../api/settingsApi'
import { settingsQueryKeys } from '../api/queryKeys'

// ─── Types ───────────────────────────────────────────────────────────────────

type SettingTab = 'metahubs' | 'applications'
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
    codenameLocalizedEnabled: false,
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract the effective value from the `{ _value: ... }` envelope. */
function extractValue(setting: AdminSettingItem): unknown {
    const raw = setting.value
    return '_value' in raw ? raw._value : raw
}

/** Build settings map keyed by `key` */
function buildSettingsMap(items: AdminSettingItem[]): Map<string, AdminSettingItem> {
    return new Map(items.map((s) => [s.key, s]))
}

// ─── Component ───────────────────────────────────────────────────────────────

const AdminSettings = () => {
    const { t } = useTranslation('admin')
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()

    // Tabs
    const [activeTab, setActiveTab] = useState<SettingTab>('metahubs')
    const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: SettingTab) => {
        setActiveTab(newValue)
    }, [])

    // Fetch metahubs settings
    const {
        data: metahubsData,
        isLoading,
        isError
    } = useQuery({
        queryKey: settingsQueryKeys.byCategory('metahubs'),
        queryFn: () => settingsApi.listSettingsByCategory('metahubs')
    })

    const settingsMap = useMemo(() => buildSettingsMap(metahubsData?.items || []), [metahubsData])

    // Local form state for metahubs tab
    const [localChanges, setLocalChanges] = useState<Partial<MetahubDefaults>>({})

    /** Get effective value: local change → DB value → default */
    const getEffective = useCallback(
        <K extends keyof MetahubDefaults>(key: K): MetahubDefaults[K] => {
            if (key in localChanges) return localChanges[key] as MetahubDefaults[K]
            const setting = settingsMap.get(key)
            if (setting) return extractValue(setting) as MetahubDefaults[K]
            return DEFAULT_METAHUB_SETTINGS[key]
        },
        [localChanges, settingsMap]
    )

    const hasChanges = Object.keys(localChanges).length > 0

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: async (changes: Partial<MetahubDefaults>) => {
            return settingsApi.upsertSettingsBatch('metahubs', changes)
        },
        onSuccess: (data) => {
            // Update cache immediately with server response to prevent flicker
            queryClient.setQueryData(settingsQueryKeys.byCategory('metahubs'), data)
            // Then invalidate for full consistency
            queryClient.invalidateQueries({ queryKey: settingsQueryKeys.byCategory('metahubs') })
            setLocalChanges({})
            enqueueSnackbar(t('settings.saved'), { variant: 'success' })
        },
        onError: () => {
            enqueueSnackbar(t('settings.saveError'), { variant: 'error' })
        }
    })

    const handleSave = useCallback(() => {
        if (!hasChanges) return
        saveMutation.mutate(localChanges)
    }, [hasChanges, localChanges, saveMutation])

    const handleChange = useCallback(<K extends keyof MetahubDefaults>(key: K, value: MetahubDefaults[K]) => {
        setLocalChanges((prev) => ({ ...prev, [key]: value }))
    }, [])

    // ── Render ───────────────────────────────────────────────────────────

    if (isError) {
        return (
            <MainCard disableHeader border={false} shadow={false} contentSX={{ px: 0, py: 0 }} disableContentPadding>
                <Alert severity='error' sx={{ m: 2 }}>
                    {t('settings.error')}
                </Alert>
            </MainCard>
        )
    }

    const effectiveStyle = getEffective('codenameStyle')
    const effectiveAlphabet = getEffective('codenameAlphabet')
    const effectiveAllowMixed = getEffective('codenameAllowMixedAlphabets')
    const effectiveAutoConvertMixed = getEffective('codenameAutoConvertMixedAlphabets')
    const effectiveLocalizedEnabled = getEffective('codenameLocalizedEnabled')
    const effectivePlatformSystemAttributesConfigurable = getEffective(PLATFORM_SYSTEM_ATTRIBUTE_ADMIN_KEYS.allowConfiguration)
    const effectivePlatformSystemAttributesRequired = getEffective(PLATFORM_SYSTEM_ATTRIBUTE_ADMIN_KEYS.forceCreate)
    const effectivePlatformSystemAttributesIgnoreMetahubSettings = getEffective(PLATFORM_SYSTEM_ATTRIBUTE_ADMIN_KEYS.ignoreMetahubSettings)

    return (
        <MainCard disableHeader border={false} shadow={false} contentSX={{ px: 0, py: 0 }} disableContentPadding>
            {/* Header */}
            <ViewHeader title={t('settings.title')} />

            {/* Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
                <Tabs value={activeTab} onChange={handleTabChange}>
                    <Tab label={t('settings.tabs.metahubs')} value='metahubs' />
                    <Tab label={t('settings.tabs.applications')} value='applications' />
                </Tabs>
            </Box>

            {/* Content */}
            <Box sx={{ p: 3 }}>
                {activeTab === 'metahubs' && (
                    <>
                        {isLoading ? (
                            <Stack spacing={2}>
                                {[1, 2, 3].map((i) => (
                                    <Skeleton key={i} variant='rectangular' height={60} sx={{ borderRadius: 1 }} />
                                ))}
                            </Stack>
                        ) : (
                            <Stack spacing={0} divider={<Divider />}>
                                {/* Codename Style */}
                                <Box sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant='subtitle2'>{t('settings.metahubs.codenameStyle')}</Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t('settings.metahubs.codenameStyleDescription')}
                                        </Typography>
                                        <CodenamePreview
                                            style={effectiveStyle}
                                            alphabet={effectiveAlphabet}
                                            allowMixed={effectiveAllowMixed}
                                        />
                                    </Box>
                                    <FormControl size='small' sx={{ minWidth: 250 }}>
                                        <InputLabel>{t('settings.metahubs.codenameStyle')}</InputLabel>
                                        <Select
                                            value={effectiveStyle}
                                            label={t('settings.metahubs.codenameStyle')}
                                            onChange={(e) => handleChange('codenameStyle', e.target.value as CodenameStyle)}
                                        >
                                            <MenuItem value='pascal-case'>{t('settings.metahubs.styleOptions.pascal-case')}</MenuItem>
                                            <MenuItem value='kebab-case'>{t('settings.metahubs.styleOptions.kebab-case')}</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Box>

                                {/* Codename Alphabet */}
                                <Box sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant='subtitle2'>{t('settings.metahubs.codenameAlphabet')}</Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t('settings.metahubs.codenameAlphabetDescription')}
                                        </Typography>
                                        <CodenamePreview
                                            style={effectiveStyle}
                                            alphabet={effectiveAlphabet}
                                            allowMixed={effectiveAllowMixed}
                                        />
                                    </Box>
                                    <FormControl size='small' sx={{ minWidth: 250 }}>
                                        <InputLabel>{t('settings.metahubs.codenameAlphabet')}</InputLabel>
                                        <Select
                                            value={effectiveAlphabet}
                                            label={t('settings.metahubs.codenameAlphabet')}
                                            onChange={(e) => handleChange('codenameAlphabet', e.target.value as CodenameAlphabet)}
                                        >
                                            <MenuItem value='en'>{t('settings.metahubs.alphabetOptions.en')}</MenuItem>
                                            <MenuItem value='ru'>{t('settings.metahubs.alphabetOptions.ru')}</MenuItem>
                                            <MenuItem value='en-ru'>{t('settings.metahubs.alphabetOptions.en-ru')}</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Box>

                                {/* Allow Mixed Alphabets (only visible when alphabet is en-ru) */}
                                {effectiveAlphabet === 'en-ru' && (
                                    <Box sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
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
                                                    onChange={(e) => handleChange('codenameAllowMixedAlphabets', e.target.checked)}
                                                />
                                            }
                                            label=''
                                        />
                                    </Box>
                                )}

                                {/* Auto-convert mixed alphabets (only visible when alphabet is en-ru and mixed is disabled) */}
                                {effectiveAlphabet === 'en-ru' && !effectiveAllowMixed && (
                                    <Box sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
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
                                                    onChange={(e) => handleChange('codenameAutoConvertMixedAlphabets', e.target.checked)}
                                                />
                                            }
                                            label=''
                                        />
                                    </Box>
                                )}

                                {/* Localized Codename Mode */}
                                <Box sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
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
                                                onChange={(e) => handleChange('codenameLocalizedEnabled', e.target.checked)}
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
                                                onChange={(e) =>
                                                    handleChange(PLATFORM_SYSTEM_ATTRIBUTE_ADMIN_KEYS.allowConfiguration, e.target.checked)
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
                                                onChange={(e) =>
                                                    handleChange(PLATFORM_SYSTEM_ATTRIBUTE_ADMIN_KEYS.forceCreate, e.target.checked)
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
                                                onChange={(e) =>
                                                    handleChange(
                                                        PLATFORM_SYSTEM_ATTRIBUTE_ADMIN_KEYS.ignoreMetahubSettings,
                                                        e.target.checked
                                                    )
                                                }
                                            />
                                        }
                                        label=''
                                    />
                                </Box>
                            </Stack>
                        )}

                        {/* Save button */}
                        {hasChanges && (
                            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                                <Button variant='contained' startIcon={<SaveIcon />} onClick={handleSave} disabled={saveMutation.isPending}>
                                    {t('settings.save')}
                                </Button>
                            </Box>
                        )}
                    </>
                )}

                {activeTab === 'applications' && (
                    <Alert severity='info' sx={{ mt: 1 }}>
                        {t('settings.applications.placeholder')}
                    </Alert>
                )}
            </Box>
        </MainCard>
    )
}

export default AdminSettings
