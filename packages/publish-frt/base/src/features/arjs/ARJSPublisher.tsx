// Universo Platformo | AR.js Publisher
// React component for publishing AR.js experiences using streaming mode

import React, { useReducer, useEffect, useRef, useCallback, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Box, Typography, TextField, FormControl, InputLabel, Select, MenuItem, CircularProgress, Snackbar } from '@mui/material'
import type { SelectChangeEvent } from '@mui/material/Select'

// API imports
import {
    ARJSPublicationApi,
    PublicationApi,
    PublishLinksApi,
    getCurrentUrlIds,
    publishQueryKeys,
    invalidatePublishQueries
} from '../../api'

// Utility imports
import { FieldNormalizer } from '../../utils/fieldNormalizer'
import { useAutoSave } from '../../hooks'
import { normalizeTimerConfig, sanitizeTimerInput } from '../../utils/timerConfig'
import { isValidBase58 } from '../../utils/base58Validator'

// Type imports
import type { ARDisplayType, CameraUsage, LibrarySource, MarkerType, WallpaperType } from '../../types'

// Component imports
import GenerationModeSelect from '../../components/GenerationModeSelect'
import TemplateSelect from '../../components/TemplateSelect'
import { PublishVersionSection } from '../../components/PublishVersionSection'
import { MarkerSettings, TimerSettings, InteractionModeSelect, LibrarySettings, ARPreviewPane } from './components'
import { PublicationToggle, PublicationSettingsCard, AsyncStatusBar } from '../../components/shared'

// Type imports
import type { PublisherProps, PublicationLink } from '../../types'
import { arjsReducer, initialARJSState } from './types/arjsState'

// Demo mode toggle
const DEMO_MODE = false

/**
 * AR.js Publisher Component
 * Supports streaming generation of AR.js content with TypeScript and decomposed components
 */
const ARJSPublisherComponent: React.FC<PublisherProps> = ({ flow, unikId, onPublish }) => {
    const { t } = useTranslation('publish')
    const queryClient = useQueryClient()

    // Use reducer for complex state management
    const [state, dispatch] = useReducer(arjsReducer, initialARJSState)

    // Snackbar state (kept separate as it's UI-only)
    const [snackbar, setSnackbar] = useState({ open: false, message: '' })
    const [settingsReloadNonce, setSettingsReloadNonce] = useState(0)

    // Reference to latest flow.id
    const flowIdRef = useRef(flow?.id)
    useEffect(() => {
        flowIdRef.current = flow?.id
    }, [flow?.id])

    // Get current unikId from URL
    const currentUnikId = useMemo(() => {
        const { unikId: urlUnikId } = getCurrentUrlIds()
        return urlUnikId
    }, [])

    // Normalized version group ID
    const normalizedVersionGroupId = useMemo(() => FieldNormalizer.normalizeVersionGroupId(flow), [flow])

    // Fetch canvas data for version group resolution
    const { data: canvasData, isError: isCanvasError } = useQuery({
        queryKey: publishQueryKeys.canvasByUnik(currentUnikId || '', flow?.id || ''),
        queryFn: async () => {
            if (!flow?.id || !currentUnikId) throw new Error('Flow ID and Unik ID are required')
            const response = await PublicationApi.getCanvasById(currentUnikId, String(flow.id))
            return response?.data
        },
        enabled: !!flow?.id && !!currentUnikId && !normalizedVersionGroupId,
        staleTime: 5 * 60 * 1000,
        retry: false
    })

    // Compute resolved version group ID
    const resolvedVersionGroupId = useMemo(() => {
        if (normalizedVersionGroupId) {
            return normalizedVersionGroupId
        }
        if (canvasData) {
            const detected = FieldNormalizer.normalizeVersionGroupId(canvasData)
            if (detected) {
                return detected
            }
        }
        return null
    }, [normalizedVersionGroupId, canvasData])

    // Log warning if canvas fetch failed
    useEffect(() => {
        if (isCanvasError) {
            console.warn('[ARJSPublisher] Failed to resolve versionGroupId from API')
        }
    }, [isCanvasError])

    // Compute publish link items for display
    const publishLinkItems = useMemo(() => {
        if (!state.publishLinkRecords?.length) {
            return []
        }

        const origin = typeof window !== 'undefined' ? window.location.origin : ''

        return state.publishLinkRecords.flatMap((link) => {
            const segment = link?.targetType === 'version' ? 'b' : 'p'
            const baseUrl = origin ? `${origin}/${segment}/${link.baseSlug}` : `/${segment}/${link.baseSlug}`

            const items = [
                {
                    id: `${link.id}-base`,
                    labelKey: link?.targetType === 'version' ? 'links.versionBase' : 'links.liveBase',
                    url: baseUrl
                }
            ]

            if (link?.customSlug) {
                const customUrl = origin ? `${origin}/${segment}/${link.customSlug}` : `/${segment}/${link.customSlug}`
                items.push({
                    id: `${link.id}-custom`,
                    labelKey: link?.targetType === 'version' ? 'links.versionCustom' : 'links.liveCustom',
                    url: customUrl
                })
            }

            return items
        })
    }, [state.publishLinkRecords])

    // Load publish links callback
    const loadPublishLinks = useCallback(async () => {
        const versionGroupId = resolvedVersionGroupId ?? null
        const flowId = flow?.id ? String(flow.id) : null
        if (!flowId && !versionGroupId) {
            return []
        }

        try {
            const records = await queryClient.fetchQuery({
                queryKey: publishQueryKeys.linksByVersion('arjs', flowId, versionGroupId),
                queryFn: async () => {
                    const links = await PublishLinksApi.listLinks({ technology: 'arjs', versionGroupId }, undefined)
                    const filtered = links.filter((link) => {
                        if (versionGroupId && link.versionGroupId === versionGroupId) {
                            return true
                        }
                        if (flowId && link.targetCanvasId === flowId) {
                            return true
                        }
                        return false
                    })

                    const isValidData = (items: PublicationLink[]) => items.every((link) => link.baseSlug && isValidBase58(link.baseSlug))
                    if (!filtered.length || !isValidData(filtered)) {
                        return []
                    }

                    return filtered
                }
            })

            dispatch({ type: 'SET_PUBLISH_LINK_RECORDS', payload: records })
            dispatch({ type: 'SET_IS_PUBLIC', payload: records.some((link) => link.targetType === 'group') })

            return records
        } catch (loadError) {
            console.error('ARJSPublisher: Failed to load publish links', loadError)
            dispatch({ type: 'SET_PUBLISH_LINK_RECORDS', payload: [] })
            return []
        }
    }, [flow?.id, queryClient, resolvedVersionGroupId])

    // Retry load settings handler
    const handleRetryLoadSettings = useCallback(() => {
        dispatch({ type: 'SET_ERROR', payload: null })
        dispatch({ type: 'SET_SETTINGS_LOADING', payload: true })
        dispatch({ type: 'SET_SETTINGS_INITIALIZED', payload: false })
        setSettingsReloadNonce((nonce) => nonce + 1)
        queryClient.invalidateQueries({ queryKey: publishQueryKeys.canvas() })
        invalidatePublishQueries.linksByTechnology(queryClient, 'arjs')
    }, [queryClient])

    // Load published links on mount
    useEffect(() => {
        loadPublishLinks()
    }, [loadPublishLinks])

    // Update published URL when public state or links change
    useEffect(() => {
        if (state.isPublic && publishLinkItems.length > 0) {
            dispatch({ type: 'SET_PUBLISHED_URL', payload: publishLinkItems[0].url })
        } else {
            dispatch({ type: 'SET_PUBLISHED_URL', payload: '' })
        }
    }, [state.isPublic, publishLinkItems])

    // Load global settings on mount
    useEffect(() => {
        const loadGlobalSettings = async () => {
            try {
                const response = await PublicationApi.getGlobalSettings()
                if (response.data?.success) {
                    dispatch({ type: 'SET_GLOBAL_SETTINGS', payload: response.data.data })
                } else {
                    console.warn('ARJSPublisher: Failed to load global settings')
                }
            } catch (error) {
                console.warn('ARJSPublisher: Error loading global settings, using defaults:', error)
            } finally {
                dispatch({ type: 'SET_GLOBAL_SETTINGS_LOADED', payload: true })
            }
        }

        loadGlobalSettings()
    }, [])

    // Reset settings initialization when flow.id changes
    useEffect(() => {
        dispatch({ type: 'SET_SETTINGS_INITIALIZED', payload: false })
    }, [flow?.id])

    // Normalized timer config
    const normalizedTimerConfig = useMemo(
        () =>
            sanitizeTimerInput(
                state.timerConfig?.enabled ?? false,
                state.timerConfig?.limitSeconds ?? 60,
                state.timerConfig?.position ?? 'top-center'
            ),
        [state.timerConfig?.enabled, state.timerConfig?.limitSeconds, state.timerConfig?.position]
    )

    // Settings data for auto-save
    const settingsData = useMemo(
        () => ({
            isPublic: state.isPublic,
            projectTitle: state.projectTitle,
            markerType: state.markerType,
            markerValue: state.markerValue,
            templateId: state.templateId,
            generationMode: state.generationMode,
            arDisplayType: state.arDisplayType,
            wallpaperType: state.wallpaperType,
            cameraUsage: state.cameraUsage,
            backgroundColor: state.backgroundColor,
            libraryConfig: state.libraryConfig,
            timerConfig: normalizedTimerConfig,
            interactionMode: state.interactionMode ?? 'buttons'
        }),
        [
            state.isPublic,
            state.projectTitle,
            state.markerType,
            state.markerValue,
            state.templateId,
            state.generationMode,
            state.arDisplayType,
            state.wallpaperType,
            state.cameraUsage,
            state.backgroundColor,
            state.libraryConfig,
            normalizedTimerConfig,
            state.interactionMode
        ]
    )

    // Auto-save handler
    const handleAutoSave = useCallback(
        async (data: typeof settingsData) => {
            const currentFlowId = flowIdRef.current
            if (!currentFlowId || DEMO_MODE || state.settingsLoading) return

            await ARJSPublicationApi.saveARJSSettings(currentFlowId, data)
        },
        [state.isPublic, state.settingsLoading]
    )

    // Auto-save hook
    const { status: autoSaveStatus } = useAutoSave({
        data: settingsData,
        onSave: handleAutoSave,
        delay: 500,
        enabled: !state.settingsLoading && state.settingsInitialized
    })

    // Build settings payload helper
    const buildSettingsPayload = useCallback(
        (overrides = {}) => ({
            ...settingsData,
            ...overrides
        }),
        [settingsData]
    )

    // Load saved settings effect
    useEffect(() => {
        let cancelled = false

        const loadSavedSettings = async () => {
            if (!flow?.id || DEMO_MODE || !state.globalSettingsLoaded || state.settingsInitialized) {
                if (!cancelled && state.globalSettingsLoaded && !state.settingsInitialized) {
                    dispatch({ type: 'SET_SETTINGS_LOADING', payload: false })
                }
                return
            }

            try {
                dispatch({ type: 'SET_SETTINGS_LOADING', payload: true })
                const savedSettings = await ARJSPublicationApi.loadARJSSettings(flow.id)

                if (cancelled) return

                if (savedSettings) {
                    console.log('[ARJSPublisher] Loading saved settings:', savedSettings)
                    console.log('[ARJSPublisher] interactionMode from savedSettings:', savedSettings.interactionMode)
                    
                    // Load basic settings
                    dispatch({
                        type: 'LOAD_SETTINGS',
                        payload: {
                            isPublic: savedSettings.isPublic || false,
                            projectTitle: savedSettings.projectTitle || flow?.name || '',
                            markerType: (savedSettings.markerType as MarkerType) || 'preset',
                            markerValue: savedSettings.markerValue || 'hiro',
                            generationMode: 'streaming',
                            templateId: savedSettings.templateId || 'quiz',
                            arDisplayType: savedSettings.arDisplayType || (savedSettings.markerType ? 'marker' : 'wallpaper'),
                            wallpaperType: savedSettings.wallpaperType || 'standard',
                            cameraUsage: savedSettings.cameraUsage || 'none',
                            backgroundColor: savedSettings.backgroundColor || '#1976d2',
                            timerConfig: normalizeTimerConfig(savedSettings.timerConfig),
                            interactionMode: savedSettings.interactionMode || 'buttons'
                        }
                    })
                    
                    console.log('[ARJSPublisher] LOAD_SETTINGS dispatched with interactionMode:', savedSettings.interactionMode || 'buttons')

                    // Handle library configuration with legacy detection
                    if (state.globalSettings?.enforceGlobalLibraryManagement) {
                        const hasLegacyConfig =
                            savedSettings.libraryConfig &&
                            (savedSettings.libraryConfig.arjs?.source !== state.globalSettings.defaultLibrarySource ||
                                savedSettings.libraryConfig.aframe?.source !== state.globalSettings.defaultLibrarySource)

                        if (hasLegacyConfig) {
                            dispatch({ type: 'SET_IS_LEGACY_SCENARIO', payload: true })

                            if (state.globalSettings.autoCorrectLegacySettings) {
                                dispatch({ type: 'SET_ARJS_SOURCE', payload: state.globalSettings.defaultLibrarySource })
                                dispatch({ type: 'SET_AFRAME_SOURCE', payload: state.globalSettings.defaultLibrarySource })
                                dispatch({
                                    type: 'SET_ALERT',
                                    payload: {
                                        type: 'info',
                                        message: t('arjs.globalLibraryManagement.legacyCorrectedMessage', {
                                            source:
                                                state.globalSettings.defaultLibrarySource === 'official'
                                                    ? t('arjs.globalLibraryManagement.officialSource')
                                                    : t('arjs.globalLibraryManagement.kiberplanoSource')
                                        })
                                    }
                                })
                            } else {
                                if (savedSettings.libraryConfig) {
                                    dispatch({ type: 'SET_ARJS_VERSION', payload: savedSettings.libraryConfig.arjs?.version || '3.4.7' })
                                    dispatch({
                                        type: 'SET_ARJS_SOURCE',
                                        payload: (savedSettings.libraryConfig.arjs?.source as LibrarySource) || 'official'
                                    })
                                    dispatch({
                                        type: 'SET_AFRAME_VERSION',
                                        payload: savedSettings.libraryConfig.aframe?.version || '1.7.1'
                                    })
                                    dispatch({
                                        type: 'SET_AFRAME_SOURCE',
                                        payload: (savedSettings.libraryConfig.aframe?.source as LibrarySource) || 'official'
                                    })
                                }
                                dispatch({
                                    type: 'SET_ALERT',
                                    payload: {
                                        type: 'warning',
                                        message: t('arjs.globalLibraryManagement.legacyRecommendationMessage', {
                                            source:
                                                state.globalSettings.defaultLibrarySource === 'official'
                                                    ? t('arjs.globalLibraryManagement.officialSource')
                                                    : t('arjs.globalLibraryManagement.kiberplanoSource')
                                        })
                                    }
                                })
                            }
                        } else {
                            dispatch({ type: 'SET_ARJS_SOURCE', payload: state.globalSettings.defaultLibrarySource })
                            dispatch({ type: 'SET_AFRAME_SOURCE', payload: state.globalSettings.defaultLibrarySource })
                        }
                    } else if (savedSettings.libraryConfig) {
                        dispatch({ type: 'SET_ARJS_VERSION', payload: savedSettings.libraryConfig.arjs?.version || '3.4.7' })
                        dispatch({
                            type: 'SET_ARJS_SOURCE',
                            payload: (savedSettings.libraryConfig.arjs?.source as LibrarySource) || 'official'
                        })
                        dispatch({ type: 'SET_AFRAME_VERSION', payload: savedSettings.libraryConfig.aframe?.version || '1.7.1' })
                        dispatch({
                            type: 'SET_AFRAME_SOURCE',
                            payload: (savedSettings.libraryConfig.aframe?.source as LibrarySource) || 'official'
                        })
                    } else if (state.globalSettings?.enableGlobalLibraryManagement) {
                        dispatch({ type: 'SET_ARJS_SOURCE', payload: state.globalSettings.defaultLibrarySource })
                        dispatch({ type: 'SET_AFRAME_SOURCE', payload: state.globalSettings.defaultLibrarySource })
                    }

                    if (savedSettings.isPublic && savedSettings.generationMode === 'streaming') {
                        await loadPublishLinks()
                    }
                } else {
                    // Apply global settings for new spaces
                    if (state.globalSettings?.enforceGlobalLibraryManagement) {
                        dispatch({ type: 'SET_ARJS_SOURCE', payload: state.globalSettings.defaultLibrarySource })
                        dispatch({ type: 'SET_AFRAME_SOURCE', payload: state.globalSettings.defaultLibrarySource })
                    } else if (state.globalSettings?.enableGlobalLibraryManagement) {
                        dispatch({ type: 'SET_ARJS_SOURCE', payload: state.globalSettings.defaultLibrarySource })
                        dispatch({ type: 'SET_AFRAME_SOURCE', payload: state.globalSettings.defaultLibrarySource })
                    }
                }

                if (!cancelled) {
                    dispatch({ type: 'SET_SETTINGS_INITIALIZED', payload: true })
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('📱 [ARJSPublisher] Error loading settings:', error)
                    const message = error instanceof Error ? error.message : 'Failed to load saved settings. Please retry shortly.'
                    dispatch({ type: 'SET_ERROR', payload: message })
                    dispatch({ type: 'SET_SETTINGS_INITIALIZED', payload: true })
                }
            } finally {
                if (!cancelled) {
                    dispatch({ type: 'SET_SETTINGS_LOADING', payload: false })
                }
            }
        }

        void loadSavedSettings()

        return () => {
            cancelled = true
        }
    }, [
        DEMO_MODE,
        flow?.id,
        flow?.name,
        state.globalSettings,
        state.globalSettingsLoaded,
        loadPublishLinks,
        state.settingsInitialized,
        t,
        settingsReloadNonce
    ])

    // Initialize with flow data
    useEffect(() => {
        if (flow && !state.settingsLoading) {
            dispatch({
                type: 'SET_PROJECT_TITLE',
                payload: state.projectTitle || flow.name || 'AR.js Experience'
            })
        }
    }, [flow, state.settingsLoading, state.projectTitle])

    // Event handlers with useCallback for optimization
    const handleTemplateTypeChange = useCallback((templateId: string) => {
        dispatch({ type: 'SET_TEMPLATE_TYPE', payload: templateId })
    }, [])

    const handleArjsSourceChange = useCallback(
        (source: LibrarySource) => {
            if (
                state.globalSettings?.enforceGlobalLibraryManagement &&
                (!state.isLegacyScenario || state.globalSettings?.autoCorrectLegacySettings)
            ) {
                return
            }

            dispatch({ type: 'SET_ARJS_SOURCE', payload: source })

            if (state.isLegacyScenario && !state.globalSettings?.autoCorrectLegacySettings) {
                const newSourceMatchesGlobal = source === state.globalSettings?.defaultLibrarySource
                const aframeSourceMatchesGlobal = state.libraryConfig.aframe.source === state.globalSettings?.defaultLibrarySource

                if (newSourceMatchesGlobal && aframeSourceMatchesGlobal) {
                    dispatch({ type: 'SET_ALERT', payload: null })
                    dispatch({ type: 'SET_IS_LEGACY_SCENARIO', payload: false })
                }
            }
        },
        [state.globalSettings, state.isLegacyScenario, state.libraryConfig.aframe.source]
    )

    const handleAframeSourceChange = useCallback(
        (source: LibrarySource) => {
            if (
                state.globalSettings?.enforceGlobalLibraryManagement &&
                (!state.isLegacyScenario || state.globalSettings?.autoCorrectLegacySettings)
            ) {
                return
            }

            dispatch({ type: 'SET_AFRAME_SOURCE', payload: source })

            if (state.isLegacyScenario && !state.globalSettings?.autoCorrectLegacySettings) {
                const arjsSourceMatchesGlobal = state.libraryConfig.arjs.source === state.globalSettings?.defaultLibrarySource
                const newSourceMatchesGlobal = source === state.globalSettings?.defaultLibrarySource

                if (arjsSourceMatchesGlobal && newSourceMatchesGlobal) {
                    dispatch({ type: 'SET_ALERT', payload: null })
                    dispatch({ type: 'SET_IS_LEGACY_SCENARIO', payload: false })
                }
            }
        },
        [state.globalSettings, state.isLegacyScenario, state.libraryConfig.arjs.source]
    )

    // Handle public/private toggle
    const handlePublicChange = useCallback(
        async (value: boolean) => {
            if (!flow?.id) {
                console.error('🚨 [ARJSPublisher] Cannot proceed: flow.id is undefined', { flow })
                dispatch({
                    type: 'SET_ERROR',
                    payload: 'Ошибка: идентификатор потока не найден. Пожалуйста, сохраните поток и попробуйте снова.'
                })
                dispatch({ type: 'SET_IS_PUBLIC', payload: false })
                return
            }

            const previousPublic = state.isPublic
            const previousRecords = state.publishLinkRecords
            dispatch({ type: 'SET_IS_PUBLIC', payload: value })

            if (!value) {
                dispatch({ type: 'SET_PUBLISHED_URL', payload: '' })
                dispatch({ type: 'SET_PUBLISH_LINK_RECORDS', payload: [] })

                try {
                    const links = await PublishLinksApi.listLinks({
                        technology: 'arjs',
                        ...(resolvedVersionGroupId ? { versionGroupId: resolvedVersionGroupId } : {})
                    })

                    const groupLinks = links.filter((link) => {
                        if (link.targetType !== 'group') return false
                        if (resolvedVersionGroupId && link.versionGroupId === resolvedVersionGroupId) return true
                        return link.targetCanvasId === flow.id
                    })

                    await Promise.all(groupLinks.map((link) => PublishLinksApi.deleteLink(link.id)))

                    if (!DEMO_MODE && flow?.id) {
                        await ARJSPublicationApi.saveARJSSettings(flow.id, buildSettingsPayload({ isPublic: false }))
                    }

                    setSnackbar({ open: true, message: t('notifications.publicationRemoved') })
                } catch (error) {
                    console.error('📱 [ARJSPublisher] Error removing publication:', error)
                    dispatch({ type: 'SET_ERROR', payload: 'Failed to remove publication' })
                    setSnackbar({ open: true, message: t('notifications.publicationError') })
                    dispatch({ type: 'SET_IS_PUBLIC', payload: previousPublic })
                    dispatch({ type: 'SET_PUBLISH_LINK_RECORDS', payload: previousRecords })
                }
                return
            }

            if (DEMO_MODE) {
                dispatch({ type: 'SET_LOADING', payload: true })
                setTimeout(() => {
                    dispatch({ type: 'SET_PUBLISHED_URL', payload: 'https://plano.universo.pro/' })
                    setSnackbar({ open: true, message: t('success.published') })
                    dispatch({ type: 'SET_LOADING', payload: false })
                }, 1000)
                return
            }

            if (state.generationMode !== 'streaming') {
                dispatch({ type: 'SET_ERROR', payload: 'Unsupported generation mode: ' + state.generationMode })
                return
            }

            dispatch({ type: 'SET_IS_PUBLISHING', payload: true })
            dispatch({ type: 'SET_ERROR', payload: null })

            try {
                await ARJSPublicationApi.saveARJSSettings(flow.id, buildSettingsPayload({ isPublic: true }))

                const versionGroupId = resolvedVersionGroupId
                const createdLink = await PublishLinksApi.createGroupLink(flow.id, 'arjs', versionGroupId ?? undefined)

                const fullPublicUrl = `${window.location.origin}/p/${createdLink.baseSlug}`

                dispatch({ type: 'SET_PUBLISHED_URL', payload: fullPublicUrl })
                dispatch({ type: 'ADD_PUBLISH_LINK_RECORD', payload: createdLink })
                setSnackbar({ open: true, message: t('notifications.publicationCreated') })

                if (onPublish) {
                    onPublish({
                        publicationId: createdLink.baseSlug,
                        publishedUrl: fullPublicUrl
                    })
                }
            } catch (error) {
                console.error('📱 [ARJSPublisher.handlePublicChange] Error during publication:', error)
                dispatch({
                    type: 'SET_ERROR',
                    payload: error instanceof Error ? error.message : 'Unknown error occurred during publication'
                })
                setSnackbar({ open: true, message: t('notifications.publicationError') })
                dispatch({ type: 'SET_IS_PUBLIC', payload: previousPublic })
                dispatch({ type: 'SET_PUBLISH_LINK_RECORDS', payload: previousRecords })
            } finally {
                dispatch({ type: 'SET_IS_PUBLISHING', payload: false })
            }
        },
        [flow, state.isPublic, state.publishLinkRecords, state.generationMode, resolvedVersionGroupId, buildSettingsPayload, t, onPublish]
    )

    // Snackbar close handler
    const handleSnackbarClose = useCallback(() => {
        setSnackbar((prev) => ({ ...prev, open: false }))
    }, [])

    // Render main interface
    return (
        <Box sx={{ width: '100%' }}>
            <Typography variant='h4' gutterBottom>
                {t('technologies.arjs')}
            </Typography>
            <Typography variant='body2' color='text.secondary' paragraph>
                {t('technologies.arjsDescription')}
            </Typography>

            <PublicationSettingsCard
                isLoading={state.settingsLoading}
                loadingMessage={t('common:loadingSettings', 'Загрузка сохраненных настроек...')}
                error={state.error}
                onRetry={handleRetryLoadSettings}
                retryLabel={t('common:retry', 'Повторить')}
            >
                <Box sx={{ position: 'relative' }}>
                    {state.loading && (
                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                                zIndex: 10
                            }}
                        >
                            <CircularProgress />
                        </Box>
                    )}

                    {/* Project Title */}
                    <TextField
                        label={t('project.title')}
                        value={state.projectTitle}
                        onChange={(e) => dispatch({ type: 'SET_PROJECT_TITLE', payload: e.target.value })}
                        fullWidth
                        margin='normal'
                        variant='outlined'
                    />
                    <AsyncStatusBar status={autoSaveStatus} variant='inline' size='small' />

                    {/* Generation Mode */}
                    <GenerationModeSelect
                        value={state.generationMode}
                        onChange={(mode) => dispatch({ type: 'SET_TEMPLATE_TYPE', payload: mode })}
                        disabled={!!state.publishedUrl}
                        technology='arjs'
                    />

                    {/* Template Selection */}
                    <TemplateSelect
                        selectedTemplate={state.templateId}
                        onTemplateChange={handleTemplateTypeChange}
                        disabled={!!state.publishedUrl}
                        technology='arjs'
                    />

                    {/* Camera Usage */}
                    <FormControl fullWidth variant='outlined' margin='normal'>
                        <InputLabel>{t('arjs.cameraUsage.label')}</InputLabel>
                        <Select
                            value={state.cameraUsage}
                            onChange={(event: SelectChangeEvent<CameraUsage>) => {
                                const value = event.target.value as CameraUsage
                                dispatch({ type: 'SET_CAMERA_USAGE', payload: value })
                                if (value === 'none' && state.arDisplayType === 'marker') {
                                    dispatch({ type: 'SET_AR_DISPLAY_TYPE', payload: 'wallpaper' })
                                }
                            }}
                            label={t('arjs.cameraUsage.label')}
                            disabled={!!state.publishedUrl}
                        >
                            <MenuItem value='none'>{t('arjs.cameraUsage.none')}</MenuItem>
                            <MenuItem value='standard'>{t('arjs.cameraUsage.standard')}</MenuItem>
                        </Select>
                    </FormControl>

                    {/* AR Display Type */}
                    {state.cameraUsage !== 'none' && (
                        <FormControl fullWidth variant='outlined' margin='normal'>
                            <InputLabel>{t('arjs.displayType.label')}</InputLabel>
                            <Select
                                value={state.arDisplayType}
                                onChange={(event: SelectChangeEvent<ARDisplayType>) => {
                                    dispatch({ type: 'SET_AR_DISPLAY_TYPE', payload: event.target.value as ARDisplayType })
                                }}
                                label={t('arjs.displayType.label')}
                                disabled={!!state.publishedUrl}
                            >
                                <MenuItem value='wallpaper'>{t('arjs.displayType.wallpaper')}</MenuItem>
                                <MenuItem value='marker' disabled={(state.cameraUsage as string) === 'none'}>
                                    {t('arjs.displayType.marker')}
                                </MenuItem>
                            </Select>
                        </FormControl>
                    )}

                    {/* Marker Settings */}
                    {state.arDisplayType === 'marker' && state.cameraUsage !== 'none' && (
                        <MarkerSettings
                            markerType={state.markerType!}
                            markerValue={state.markerValue!}
                            disabled={!!state.publishedUrl}
                            onMarkerTypeChange={(type) => dispatch({ type: 'SET_MARKER_TYPE', payload: type })}
                            onMarkerValueChange={(value) => dispatch({ type: 'SET_MARKER_VALUE', payload: value })}
                        />
                    )}

                    {/* Wallpaper Type */}
                    {state.arDisplayType === 'wallpaper' && state.cameraUsage !== 'none' && (
                        <FormControl fullWidth variant='outlined' margin='normal'>
                            <InputLabel>{t('arjs.wallpaper.label')}</InputLabel>
                            <Select
                                value={state.wallpaperType}
                                onChange={(event: SelectChangeEvent<WallpaperType>) => {
                                    dispatch({ type: 'SET_WALLPAPER_TYPE', payload: event.target.value as WallpaperType })
                                }}
                                label={t('arjs.wallpaper.label')}
                                disabled={!!state.publishedUrl}
                            >
                                <MenuItem value='standard'>{t('arjs.wallpaper.standard')}</MenuItem>
                            </Select>
                        </FormControl>
                    )}

                    {/* Background Color */}
                    {state.cameraUsage === 'none' && (
                        <FormControl fullWidth variant='outlined' margin='normal'>
                            <TextField
                                label={t('arjs.backgroundColor.label')}
                                type='color'
                                value={state.backgroundColor}
                                onChange={(e) => dispatch({ type: 'SET_BACKGROUND_COLOR', payload: e.target.value })}
                                disabled={!!state.publishedUrl}
                                InputProps={{
                                    sx: {
                                        height: '56px',
                                        '& input': {
                                            cursor: 'pointer'
                                        }
                                    }
                                }}
                                helperText={t('arjs.backgroundColor.helperText')}
                            />
                        </FormControl>
                    )}

                    {/* Timer Settings */}
                    <TimerSettings
                        enabled={state.timerConfig?.enabled ?? false}
                        limitSeconds={state.timerConfig?.limitSeconds ?? 60}
                        position={state.timerConfig?.position ?? 'top-center'}
                        disabled={state.isPublishing || state.loading}
                        onEnabledChange={(enabled) => dispatch({ type: 'SET_TIMER_ENABLED', payload: enabled })}
                        onLimitSecondsChange={(seconds) => dispatch({ type: 'SET_TIMER_LIMIT_SECONDS', payload: seconds })}
                        onPositionChange={(position) => dispatch({ type: 'SET_TIMER_POSITION', payload: position })}
                    />

                    {/* Interaction Mode Select */}
                    <InteractionModeSelect
                        value={state.interactionMode ?? 'buttons'}
                        disabled={state.isPublishing || state.loading}
                        onChange={(mode) => dispatch({ type: 'SET_INTERACTION_MODE', payload: mode })}
                    />

                    {/* Library Settings */}
                    <LibrarySettings
                        arjsVersion={state.libraryConfig.arjs.version}
                        arjsSource={state.libraryConfig.arjs.source}
                        aframeVersion={state.libraryConfig.aframe.version}
                        aframeSource={state.libraryConfig.aframe.source}
                        disabled={!!state.publishedUrl}
                        globalSettings={state.globalSettings}
                        isLegacyScenario={state.isLegacyScenario}
                        alert={state.alert}
                        onArjsVersionChange={(version) => dispatch({ type: 'SET_ARJS_VERSION', payload: version })}
                        onArjsSourceChange={handleArjsSourceChange}
                        onAframeVersionChange={(version) => dispatch({ type: 'SET_AFRAME_VERSION', payload: version })}
                        onAframeSourceChange={handleAframeSourceChange}
                        onAlertClose={() => dispatch({ type: 'SET_ALERT', payload: null })}
                    />

                    {/* Make Public Toggle */}
                    <PublicationToggle
                        checked={state.isPublic}
                        onChange={handlePublicChange}
                        disabled={false}
                        isLoading={state.isPublishing}
                    />

                    {/* AR Preview Pane */}
                    {state.isPublic && state.publishLinkRecords.length > 0 && (
                        <ARPreviewPane
                            publishLinkRecords={state.publishLinkRecords}
                            publishedUrl={state.publishedUrl}
                            arDisplayType={state.arDisplayType}
                            markerType={state.markerType}
                            markerValue={state.markerValue}
                            isPublishing={state.isPublishing}
                            onDownloadSuccess={(message) => setSnackbar({ open: true, message })}
                        />
                    )}
                </Box>
            </PublicationSettingsCard>

            {/* Publish Version Section */}
            {(() => {
                const { unikId: urlUnikId, spaceId } = getCurrentUrlIds()
                const effectiveUnikId = unikId || urlUnikId
                const versionGroupId = resolvedVersionGroupId

                const isActiveVersion = flow?.isActive ?? flow?.is_active
                if (isActiveVersion === false) {
                    return (
                        <Box
                            sx={{
                                mt: 3,
                                p: 2,
                                border: '1px solid',
                                borderColor: 'info.main',
                                borderRadius: 1,
                                bgcolor: 'info.light'
                            }}
                        >
                            <Typography variant='body2' color='info.dark'>
                                ℹ️ Version publishing is only available for active canvas versions. This appears to be an inactive version.
                                Please switch to the active version to enable version publishing features.
                            </Typography>
                        </Box>
                    )
                }

                if (!effectiveUnikId || !spaceId) {
                    return (
                        <Box
                            sx={{
                                mt: 3,
                                p: 2,
                                border: '1px solid',
                                borderColor: 'info.main',
                                borderRadius: 1,
                                bgcolor: 'info.light'
                            }}
                        >
                            <Typography variant='body2' color='info.dark'>
                                ℹ️ Version publishing is only available when working within a Unik workspace. Please open this canvas from a
                                Unik to enable version publishing.
                            </Typography>
                        </Box>
                    )
                }

                return (
                    <PublishVersionSection
                        unikId={effectiveUnikId}
                        spaceId={spaceId}
                        canvasId={flow.id}
                        versionGroupId={versionGroupId}
                        technology='arjs'
                    />
                )
            })()}

            {/* Snackbar */}
            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleSnackbarClose} message={snackbar.message} />
        </Box>
    )
}

// Export component
const ARJSPublisher = React.memo(ARJSPublisherComponent)
ARJSPublisher.displayName = 'ARJSPublisher'

export { ARJSPublisher }
export default ARJSPublisher
