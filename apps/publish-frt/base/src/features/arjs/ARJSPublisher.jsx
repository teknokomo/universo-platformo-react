// Universo Platformo | AR.js Publisher
// React component for publishing AR.js experiences using streaming mode

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ARJSPublicationApi, PublicationApi, PublishLinksApi, getCurrentUrlIds } from '../../api'
import { FieldNormalizer } from '../../utils/fieldNormalizer'
import { useAutoSave } from '../../hooks'

// Universo Platformo | Simple demo mode toggle - set to true to enable demo features
const DEMO_MODE = false

// MUI components
import {
    Box,
    Typography,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Switch,
    FormControlLabel,
    Card,
    CardContent,
    CircularProgress,
    Alert,
    Snackbar,
    FormHelperText,
    Grid
} from '@mui/material'

// Icons
import { IconCopy, IconDownload, IconQrcode } from '@tabler/icons-react'

// Import common components
import GenerationModeSelect from '../../components/GenerationModeSelect'
// CRITICAL: This component is responsible for displaying the publication link
import PublicationLink from '../../components/PublicationLink'
import { PublicationLinks } from '../../components/PublicationLinks'
import { PublishVersionSection } from '../../components/PublishVersionSection'
import TemplateSelect from '../../components/TemplateSelect'
import QRCodeSection from '../../components/QRCodeSection'
import { isValidBase58 } from '../../utils/base58Validator'

/**
 * AR.js Publisher Component
 * Supports streaming generation of AR.js content
 */
const ARJSPublisher = ({ flow, unikId, onPublish, onCancel, initialConfig }) => {
    // Use 'publish' namespace as registered in packages/ui i18n
    const { t } = useTranslation('publish')
    // Universo Platformo | reference to latest flow.id
    const flowIdRef = useRef(flow?.id)
    useEffect(() => {
        flowIdRef.current = flow?.id
    }, [flow?.id])

    // State for project title
    const [projectTitle, setProjectTitle] = useState(flow?.name || '')
    // State for marker type
    const [markerType, setMarkerType] = useState('preset')
    // State for marker value
    const [markerValue, setMarkerValue] = useState('hiro')
    // State for loading indicator
    const [loading, setLoading] = useState(false)
    // State for published URL
    const [publishedUrl, setPublishedUrl] = useState('')
    // State for publishing status
    const [isPublishing, setIsPublishing] = useState(false)
    // State for public toggle
    const [isPublic, setIsPublic] = useState(false)
    // State for error message
    const [error, setError] = useState(null)
    // State for alert message
    const [alert, setAlert] = useState(null)
    // State for snackbar
    const [snackbar, setSnackbar] = useState({ open: false, message: '' })
    // State for generation mode
    const [generationMode, setGenerationMode] = useState('streaming') // Only streaming generation
    // Universo Platformo | State for template type in demo mode
    const [templateType, setTemplateType] = useState('quiz')
    // AR display mode and wallpaper type
    const [arDisplayType, setArDisplayType] = useState('wallpaper') // 'wallpaper' | 'marker'
    const [wallpaperType, setWallpaperType] = useState('standard') // 'standard'
    // Camera usage setting
    const [cameraUsage, setCameraUsage] = useState('none') // 'none' | 'standard'
    // Background color for when camera is disabled
    const [backgroundColor, setBackgroundColor] = useState('#1976d2') // Default blue color
    // Universo Platformo | State for settings loading
    const [settingsLoading, setSettingsLoading] = useState(true)

    // Universo Platformo | NEW: State for library configuration
    const [arjsVersion, setArjsVersion] = useState('3.4.7')
    const [arjsSource, setArjsSource] = useState('official')
    const [aframeVersion, setAframeVersion] = useState('1.7.1')
    const [aframeSource, setAframeSource] = useState('official')

    // NEW: State for global settings
    const [globalSettings, setGlobalSettings] = useState(null)
    const [globalSettingsLoaded, setGlobalSettingsLoaded] = useState(false)
    const [settingsInitialized, setSettingsInitialized] = useState(false)
    // State for tracking legacy scenarios to avoid showing standard message
    const [isLegacyScenario, setIsLegacyScenario] = useState(false)
    const [publishLinkRecords, setPublishLinkRecords] = useState([])
    const normalizedVersionGroupId = useMemo(() => FieldNormalizer.normalizeVersionGroupId(flow), [flow])
    const [resolvedVersionGroupId, setResolvedVersionGroupId] = useState(normalizedVersionGroupId)
    const [versionGroupFetchAttempted, setVersionGroupFetchAttempted] = useState(Boolean(normalizedVersionGroupId))
    
    // Ref for managing concurrent requests
    const linksStatusRef = useRef({
        loading: false,
        abortController: null
    })

    useEffect(() => {
        if (normalizedVersionGroupId !== resolvedVersionGroupId) {
            setResolvedVersionGroupId(normalizedVersionGroupId)
            setVersionGroupFetchAttempted(Boolean(normalizedVersionGroupId))
        }
    }, [normalizedVersionGroupId, resolvedVersionGroupId])

    useEffect(() => {
        if (resolvedVersionGroupId) {
            setVersionGroupFetchAttempted(true)
        }
    }, [resolvedVersionGroupId])

    useEffect(() => {
        if (resolvedVersionGroupId || !flow?.id || versionGroupFetchAttempted) {
            return
        }

        const { unikId } = getCurrentUrlIds()
        if (!unikId) {
            return
        }

        let cancelled = false

        const fetchVersionGroup = async () => {
            try {
                setVersionGroupFetchAttempted(true)
                const response = await PublicationApi.getCanvasById(unikId, String(flow.id))
                const payload = response?.data
                const detected = FieldNormalizer.normalizeVersionGroupId(payload)
                if (detected && !cancelled) {
                    setResolvedVersionGroupId(detected)
                }
            } catch (err) {
                console.warn('[ARJSPublisher] Failed to resolve versionGroupId from API', err)
            }
        }

        fetchVersionGroup()

        return () => {
            cancelled = true
        }
    }, [flow?.id, resolvedVersionGroupId, versionGroupFetchAttempted])

    const publishLinkItems = useMemo(() => {
        if (!publishLinkRecords?.length) {
            return []
        }

        const origin = typeof window !== 'undefined' ? window.location.origin : ''

        return publishLinkRecords.flatMap((link) => {
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
    }, [publishLinkRecords])

    const loadPublishLinks = useCallback(
        async (retryCount = 0) => {
            const versionGroupId = resolvedVersionGroupId
            if (!flow?.id && !versionGroupId) {
                return []
            }

            // Prevent race conditions
            if (linksStatusRef.current.loading) {
                return []
            }

            // Cancel previous request if still pending
            if (linksStatusRef.current.abortController) {
                linksStatusRef.current.abortController.abort()
            }

            const abortController = new AbortController()
            linksStatusRef.current.loading = true
            linksStatusRef.current.abortController = abortController

            try {
                const links = await PublishLinksApi.listLinks(
                    {
                        technology: 'arjs',
                        versionGroupId: versionGroupId ?? null
                    },
                    { signal: abortController.signal }
                )

                const filtered = links.filter((link) => {
                    if (versionGroupId && link.versionGroupId === versionGroupId) {
                        return true
                    }

                    if (flow?.id && link.targetCanvasId === flow.id) {
                        return true
                    }

                    return false
                })

                // Validate Base58 slugs and retry if invalid data found
                const isValidData = (links) => {
                    return links.every(link => 
                        link.baseSlug && 
                        isValidBase58(link.baseSlug)
                    )
                }

                // Retry on empty results or invalid data, but only on first attempt
                if ((filtered.length === 0 || !isValidData(filtered)) && retryCount === 0) {
                    await new Promise((resolve) => setTimeout(resolve, 500))
                    return loadPublishLinks(1)
                }

                setPublishLinkRecords(filtered)

                // Update public state based on actual links
                const hasGroupLink = filtered.some(link => link.targetType === 'group')
                setIsPublic(hasGroupLink)

                return filtered
            } catch (loadError) {
                if (loadError.name === 'AbortError' || loadError.name === 'CanceledError') {
                    return []
                }
                console.error('ARJSPublisher: Failed to load publish links', loadError)
                setPublishLinkRecords([])
                return []
            } finally {
                linksStatusRef.current.loading = false
                linksStatusRef.current.abortController = null
            }
        },
        [flow?.id, resolvedVersionGroupId]
    )

    // Load published links only on mount (event-driven pattern)
    useEffect(() => {
        loadPublishLinks()
    }, [loadPublishLinks])

    useEffect(() => {
        if (isPublic && publishLinkItems.length > 0) {
            setPublishedUrl(publishLinkItems[0].url)
        } else {
            setPublishedUrl('')
        }
    }, [isPublic, publishLinkItems])

    // Load global settings on component mount
    useEffect(() => {
        const loadGlobalSettings = async () => {
            try {
                const response = await PublicationApi.getGlobalSettings()
                if (response.data?.success) {
                    setGlobalSettings(response.data.data)
                } else {
                    console.warn('ARJSPublisher: Failed to load global settings')
                }
            } catch (error) {
                console.warn('ARJSPublisher: Error loading global settings, using defaults:', error)
            } finally {
                setGlobalSettingsLoaded(true)
            }
        }

        loadGlobalSettings()
    }, [])

    // Reset settings initialization flag when flow.id changes
    useEffect(() => {
        setSettingsInitialized(false)
    }, [flow?.id])

    // Auto-save settings (excluding isPublic which is handled separately)
    const settingsData = useMemo(
        () => ({
            projectTitle,
            markerType,
            markerValue,
            templateId: templateType,
            generationMode,
            templateType,
            arDisplayType,
            wallpaperType,
            cameraUsage,
            backgroundColor,
            libraryConfig: {
                arjs: { version: arjsVersion, source: arjsSource },
                aframe: { version: aframeVersion, source: aframeSource }
            }
        }),
        [
            projectTitle,
            markerType,
            markerValue,
            templateType,
            generationMode,
            arDisplayType,
            wallpaperType,
            cameraUsage,
            backgroundColor,
            arjsVersion,
            arjsSource,
            aframeVersion,
            aframeSource
        ]
    )

    const handleAutoSave = useCallback(
        async (data) => {
            const currentFlowId = flowIdRef.current
            if (!currentFlowId || DEMO_MODE || settingsLoading) return

            await ARJSPublicationApi.saveARJSSettings(currentFlowId, {
                isPublic,
                ...data
            })
        },
        [isPublic, settingsLoading]
    )

    const { status: autoSaveStatus } = useAutoSave({
        data: settingsData,
        onSave: handleAutoSave,
        delay: 500,
        enabled: !settingsLoading && settingsInitialized
    })

    // Universo Platformo | Load saved settings when component mounts
    useEffect(() => {
        const loadSavedSettings = async () => {
            if (!flow?.id || DEMO_MODE || !globalSettingsLoaded || settingsInitialized) {
                if (globalSettingsLoaded && !settingsInitialized) {
                    setSettingsLoading(false)
                }
                return
            }

            try {
                setSettingsLoading(true)
                const savedSettings = await ARJSPublicationApi.loadARJSSettings(flow.id)

                if (savedSettings) {
                    setIsPublic(savedSettings.isPublic || false)
                    setProjectTitle(savedSettings.projectTitle || flow?.name || '')
                    setMarkerType(savedSettings.markerType || 'preset')
                    setMarkerValue(savedSettings.markerValue || 'hiro')
                    setGenerationMode(savedSettings.generationMode || 'streaming')
                    setTemplateType(savedSettings.templateType || 'quiz')
                    // AR display mode
                    setArDisplayType(savedSettings.arDisplayType || (savedSettings.markerType ? 'marker' : 'wallpaper'))
                    setWallpaperType(savedSettings.wallpaperType || 'standard')
                    setCameraUsage(savedSettings.cameraUsage || 'none')
                    setBackgroundColor(savedSettings.backgroundColor || '#1976d2') // Load background color

                    // NEW: Load library configuration with legacy detection and auto-correction
                    if (globalSettings?.enforceGlobalLibraryManagement) {
                        // LEVEL 2: Enforcement mode - detect legacy and handle accordingly
                        const hasLegacyConfig =
                            savedSettings.libraryConfig &&
                            (savedSettings.libraryConfig.arjs?.source !== globalSettings.defaultLibrarySource ||
                                savedSettings.libraryConfig.aframe?.source !== globalSettings.defaultLibrarySource)

                        if (hasLegacyConfig) {
                            // This is a legacy space with conflicting settings
                            setIsLegacyScenario(true) // Mark as legacy scenario

                            if (globalSettings.autoCorrectLegacySettings) {
                                // Auto-correct legacy settings
                                setArjsSource(globalSettings.defaultLibrarySource)
                                setAframeSource(globalSettings.defaultLibrarySource)
                                setArjsVersion('3.4.7')
                                setAframeVersion('1.7.1')

                                // Show correction message to user
                                setAlert({
                                    type: 'info',
                                    message: t('arjs.globalLibraryManagement.legacyCorrectedMessage', {
                                        source:
                                            globalSettings.defaultLibrarySource === 'official'
                                                ? t('arjs.globalLibraryManagement.officialSource')
                                                : t('arjs.globalLibraryManagement.kiberplanoSource')
                                    })
                                })
                            } else {
                                // Show recommendation but keep existing settings
                                setArjsVersion(savedSettings.libraryConfig.arjs?.version || '3.4.7')
                                setArjsSource(savedSettings.libraryConfig.arjs?.source || 'official')
                                setAframeVersion(savedSettings.libraryConfig.aframe?.version || '1.7.1')
                                setAframeSource(savedSettings.libraryConfig.aframe?.source || 'official')

                                // Show recommendation message to user
                                setAlert({
                                    type: 'warning',
                                    message: t('arjs.globalLibraryManagement.legacyRecommendationMessage', {
                                        source:
                                            globalSettings.defaultLibrarySource === 'official'
                                                ? t('arjs.globalLibraryManagement.officialSource')
                                                : t('arjs.globalLibraryManagement.kiberplanoSource')
                                    })
                                })
                            }
                        } else {
                            // No legacy conflict, apply enforcement
                            setArjsSource(globalSettings.defaultLibrarySource)
                            setAframeSource(globalSettings.defaultLibrarySource)
                            setArjsVersion('3.4.7')
                            setAframeVersion('1.7.1')
                        }
                    } else if (savedSettings.libraryConfig) {
                        // Use saved settings (user choice or previous defaults)
                        setArjsVersion(savedSettings.libraryConfig.arjs?.version || '3.4.7')
                        setArjsSource(savedSettings.libraryConfig.arjs?.source || 'official')
                        setAframeVersion(savedSettings.libraryConfig.aframe?.version || '1.7.1')
                        setAframeSource(savedSettings.libraryConfig.aframe?.source || 'official')
                    } else if (globalSettings?.enableGlobalLibraryManagement) {
                        // LEVEL 1: Priority mode - set defaults but allow user choice
                        setArjsSource(globalSettings.defaultLibrarySource)
                        setAframeSource(globalSettings.defaultLibrarySource)
                        setArjsVersion('3.4.7')
                        setAframeVersion('1.7.1')
                    } else {
                        // Use standard defaults
                        setArjsVersion('3.4.7')
                        setArjsSource('official')
                        setAframeVersion('1.7.1')
                        setAframeSource('official')
                    }

                    if (savedSettings.isPublic && savedSettings.generationMode === 'streaming') {
                        await loadPublishLinks()
                    }
                } else {
                    // Apply global settings with two-level logic
                    if (globalSettings?.enforceGlobalLibraryManagement) {
                        // LEVEL 2: Enforcement mode - force global settings
                        setArjsSource(globalSettings.defaultLibrarySource)
                        setAframeSource(globalSettings.defaultLibrarySource)
                    } else if (globalSettings?.enableGlobalLibraryManagement) {
                        // LEVEL 1: Priority mode - use global as default but allow user choice
                        setArjsSource(globalSettings.defaultLibrarySource)
                        setAframeSource(globalSettings.defaultLibrarySource)
                    } else {
                        // Use 'official' as default when no global management
                        setArjsSource('official')
                        setAframeSource('official')
                    }
                }

                setSettingsInitialized(true)
            } catch (error) {
                console.error('📱 [ARJSPublisher] Error loading settings:', error)
                setError('Failed to load saved settings')
            } finally {
                setSettingsLoading(false)
            }
        }

        loadSavedSettings()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flow?.id, globalSettingsLoaded])

    // Initialize with flow data when component mounts
    useEffect(() => {
        if (flow && !settingsLoading) {
            setProjectTitle((prev) => prev || flow.name || 'AR.js Experience')
        }
    }, [flow, settingsLoading])

    /**
     * Handle marker type change
     */
    const handleMarkerTypeChange = (event) => {
        setMarkerType(event.target.value)
    }

    /**
     * Handle marker value change
     */
    const handleMarkerValueChange = (event) => {
        setMarkerValue(event.target.value)
    }

    /**
     * Handle template type change (for demo mode)
     */
    const handleTemplateTypeChange = (templateId) => {
        setTemplateType(templateId)
    }

    /**
     * NEW: Handle AR.js version change
     */
    const handleArjsVersionChange = (event) => {
        setArjsVersion(event.target.value)
    }

    /**
     * NEW: Handle AR.js source change
     */
    const handleArjsSourceChange = (event) => {
        // Allow changes in legacy recommendation mode
        if (globalSettings?.enforceGlobalLibraryManagement && (!isLegacyScenario || globalSettings?.autoCorrectLegacySettings)) {
            return
        }

        setArjsSource(event.target.value)

        // Clear legacy alert and scenario when user changes source in recommendation mode
        if (isLegacyScenario && !globalSettings?.autoCorrectLegacySettings) {
            const newSourceMatchesGlobal = event.target.value === globalSettings.defaultLibrarySource
            const aframeSourceMatchesGlobal = aframeSource === globalSettings.defaultLibrarySource

            if (newSourceMatchesGlobal && aframeSourceMatchesGlobal) {
                setAlert(null)
                setIsLegacyScenario(false)
            }
        }
    }

    /**
     * NEW: Handle A-Frame version change
     */
    const handleAframeVersionChange = (event) => {
        setAframeVersion(event.target.value)
    }

    /**
     * NEW: Handle A-Frame source change
     */
    const handleAframeSourceChange = (event) => {
        // Allow changes in legacy recommendation mode
        if (globalSettings?.enforceGlobalLibraryManagement && (!isLegacyScenario || globalSettings?.autoCorrectLegacySettings)) {
            return
        }

        setAframeSource(event.target.value)

        // Clear legacy alert and scenario when user changes source in recommendation mode
        if (isLegacyScenario && !globalSettings?.autoCorrectLegacySettings) {
            const arjsSourceMatchesGlobal = arjsSource === globalSettings.defaultLibrarySource
            const newSourceMatchesGlobal = event.target.value === globalSettings.defaultLibrarySource

            if (arjsSourceMatchesGlobal && newSourceMatchesGlobal) {
                setAlert(null)
                setIsLegacyScenario(false)
            }
        }
    }

    /**
     * Handle public/private toggle and publication process
     */
    const handlePublicChange = async (value) => {
        // CRITICAL: Check for flow.id before proceeding
        if (!flow?.id) {
            console.error('🚨 [ARJSPublisher] Cannot proceed: flow.id is undefined', { flow })
            setError('Ошибка: идентификатор потока не найден. Пожалуйста, сохраните поток и попробуйте снова.')
            setIsPublic(false)
            return
        }

        // Optimistic UI update
        const previousPublic = isPublic
        const previousRecords = publishLinkRecords
        setIsPublic(value)

        // If public toggle is off, remove group links
        if (!value) {
            // Optimistically clear UI
            setPublishedUrl('')
            setPublishLinkRecords([])
            
            try {
                const links = await PublishLinksApi.listLinks({
                    technology: 'arjs',
                    ...(resolvedVersionGroupId ? { versionGroupId: resolvedVersionGroupId } : {})
                })

                const groupLinks = links.filter((link) => {
                    if (link.targetType !== 'group') {
                        return false
                    }

                    if (resolvedVersionGroupId && link.versionGroupId === resolvedVersionGroupId) {
                        return true
                    }

                    return link.targetCanvasId === flow.id
                })

                await Promise.all(groupLinks.map(link => PublishLinksApi.deleteLink(link.id)))
                
                // Save settings with isPublic: false
                if (!DEMO_MODE && flow?.id) {
                    await ARJSPublicationApi.saveARJSSettings(flow.id, {
                        isPublic: false,
                        projectTitle: projectTitle,
                        markerType: markerType,
                        markerValue: markerValue,
                        templateId: templateType,
                        generationMode: generationMode,
                        templateType: templateType,
                        arDisplayType: arDisplayType,
                        wallpaperType: wallpaperType,
                        cameraUsage: cameraUsage,
                        backgroundColor: backgroundColor,
                        libraryConfig: {
                            arjs: { version: arjsVersion, source: arjsSource },
                            aframe: { version: aframeVersion, source: aframeSource }
                        }
                    })
                }
                
                setSnackbar({ open: true, message: t('notifications.publicationRemoved') })
            } catch (error) {
                console.error('📱 [ARJSPublisher] Error removing publication:', error)
                setError('Failed to remove publication')
                setSnackbar({ open: true, message: t('notifications.publicationError') })
                // Rollback optimistic update on error
                setIsPublic(previousPublic)
                setPublishLinkRecords(previousRecords)
            }
            return
        }

        // Special handling for demo mode
        if (DEMO_MODE) {
            setLoading(true)
            setTimeout(() => {
                setPublishedUrl('https://plano.universo.pro/')
                setSnackbar({ open: true, message: t('success.published') })
                setLoading(false)
            }, 1000)
            return
        }

        // Only streaming mode is supported
        if (generationMode !== 'streaming') {
            setError('Unsupported generation mode: ' + generationMode)
            return
        }

        setIsPublishing(true)
        setError(null)

        try {
            // Save AR.js settings with isPublic: true
            await ARJSPublicationApi.saveARJSSettings(flow.id, {
                isPublic: true,
                projectTitle: projectTitle,
                markerType: markerType,
                markerValue: markerValue,
                templateId: templateType,
                generationMode: generationMode,
                templateType: templateType,
                arDisplayType: arDisplayType,
                wallpaperType: wallpaperType,
                cameraUsage: cameraUsage,
                backgroundColor: backgroundColor,
                libraryConfig: {
                    arjs: { version: arjsVersion, source: arjsSource },
                    aframe: { version: aframeVersion, source: aframeSource }
                }
            })

            // Extract versionGroupId from flow (supports both camelCase and snake_case)
            const versionGroupId = resolvedVersionGroupId

            // Create group link using unified API with versionGroupId
            const createdLink = await PublishLinksApi.createGroupLink(flow.id, 'arjs', versionGroupId ?? undefined)

            // Form public URL from created link
            const fullPublicUrl = `${window.location.origin}/p/${createdLink.baseSlug}`
            
            // Optimistically update UI with new link
            setPublishedUrl(fullPublicUrl)
            setPublishLinkRecords((previous) => {
                const withoutDuplicate = previous.filter((record) => record.id !== createdLink.id)
                return [...withoutDuplicate, createdLink]
            })
            setSnackbar({ open: true, message: t('notifications.publicationCreated') })

            if (onPublish) {
                onPublish({ 
                    publicationId: createdLink.baseSlug, 
                    publishedUrl: fullPublicUrl 
                })
            }
        } catch (error) {
            console.error('📱 [ARJSPublisher.handlePublicChange] Error during publication:', error)
            setError(error instanceof Error ? error.message : 'Unknown error occurred during publication')
            setSnackbar({ open: true, message: t('notifications.publicationError') })
            // Rollback on error
            setIsPublic(previousPublic)
            setPublishLinkRecords(previousRecords)
        } finally {
            setIsPublishing(false)
        }
    }

    /**
     * Handle copy URL button click
     */
    const handleCopyUrl = (url) => {
        navigator.clipboard
            .writeText(url)
            .then(() => {
                setSnackbar({ open: true, message: t('success.copied') })
            })
            .catch((error) => {
                console.error('Failed to copy:', error)
            })
    }

    /**
     * Get marker image URL
     */
    const getMarkerImage = () => {
        // Currently only standard markers are supported
        if (markerType === 'preset') {
            return `https://raw.githubusercontent.com/AR-js-org/AR.js/master/data/images/${markerValue}.png`
        }
        return ''
    }

    /**
     * Handle snackbar close
     */
    const handleSnackbarClose = () => {
        setSnackbar({
            ...snackbar,
            open: false
        })
    }

    const handleError = (message, errorObj) => {
        console.error(message, errorObj)
        setError(errorObj instanceof Error ? errorObj.message : String(errorObj || message))
    }

    // Main interface content
    return (
        <Box sx={{ width: '100%' }}>
            <Typography variant='h4' gutterBottom>
                {t('technologies.arjs')}
            </Typography>
            <Typography variant='body2' color='text.secondary' paragraph>
                {t('technologies.arjsDescription')}
            </Typography>

            {/* Main Content - Scrollable Page */}
            <Card variant='outlined' sx={{ mb: 3 }}>
                <CardContent>
                    <Box sx={{ position: 'relative' }}>
                        {/* Universo Platformo | Settings loading indicator */}
                        {settingsLoading && (
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    minHeight: '200px',
                                    flexDirection: 'column',
                                    gap: 2
                                }}
                            >
                                <CircularProgress />
                                <Typography variant='body2' color='text.secondary'>
                                    Загрузка сохраненных настроек...
                                </Typography>
                            </Box>
                        )}

                        {/* Main interface - shown only when settings are loaded */}
                        {!settingsLoading && (
                            <>
                                {loading && (
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

                                {/* Project Title Input */}
                                <TextField
                                    label={t('project.title')}
                                    value={projectTitle}
                                    onChange={(e) => setProjectTitle(e.target.value)}
                                    fullWidth
                                    margin='normal'
                                    variant='outlined'
                                    helperText={
                                        autoSaveStatus === 'saving'
                                            ? t('common.saving')
                                            : autoSaveStatus === 'saved'
                                              ? t('common.saved')
                                              : autoSaveStatus === 'error'
                                                ? t('common.saveError')
                                                : ''
                                    }
                                />

                                {/* Generation Mode Selector */}
                                <GenerationModeSelect
                                    value={generationMode}
                                    onChange={setGenerationMode}
                                    disabled={!!publishedUrl}
                                    technology='arjs'
                                />

                                {/* Template Selection */}
                                <TemplateSelect
                                    selectedTemplate={templateType}
                                    onTemplateChange={setTemplateType}
                                    disabled={!!publishedUrl}
                                    technology='arjs'
                                />

                                {/* Camera Usage Settings */}
                                <FormControl fullWidth variant='outlined' margin='normal'>
                                    <InputLabel>{t('arjs.cameraUsage.label')}</InputLabel>
                                    <Select
                                        value={cameraUsage}
                                        onChange={(e) => {
                                            setCameraUsage(e.target.value)
                                            // Auto-switch to wallpaper if camera disabled
                                            if (e.target.value === 'none' && arDisplayType === 'marker') {
                                                setArDisplayType('wallpaper')
                                            }
                                        }}
                                        label={t('arjs.cameraUsage.label')}
                                        disabled={!!publishedUrl}
                                    >
                                        <MenuItem value='none'>{t('arjs.cameraUsage.none')}</MenuItem>
                                        <MenuItem value='standard'>{t('arjs.cameraUsage.standard')}</MenuItem>
                                    </Select>
                                </FormControl>

                                {/* AR Display Type - only show when camera is enabled */}
                                {cameraUsage !== 'none' && (
                                    <FormControl fullWidth variant='outlined' margin='normal'>
                                        <InputLabel>{t('arjs.displayType.label')}</InputLabel>
                                        <Select
                                            value={arDisplayType}
                                            onChange={(e) => setArDisplayType(e.target.value)}
                                            label={t('arjs.displayType.label')}
                                            disabled={!!publishedUrl}
                                        >
                                            <MenuItem value='wallpaper'>{t('arjs.displayType.wallpaper')}</MenuItem>
                                            <MenuItem value='marker' disabled={cameraUsage === 'none'}>
                                                {t('arjs.displayType.marker')}
                                            </MenuItem>
                                        </Select>
                                    </FormControl>
                                )}

                                {/* Marker Selection (only when marker selected and camera enabled) */}
                                {arDisplayType === 'marker' && cameraUsage !== 'none' && (
                                    <FormControl fullWidth variant='outlined' margin='normal'>
                                        <InputLabel>{t('marker.presetLabel')}</InputLabel>
                                        <Select
                                            value={markerValue}
                                            onChange={handleMarkerValueChange}
                                            label={t('marker.presetLabel')}
                                            disabled={!!publishedUrl}
                                        >
                                            <MenuItem value='hiro'>{t('marker.hiro')}</MenuItem>
                                        </Select>
                                    </FormControl>
                                )}

                                {/* Wallpaper type (only when wallpaper selected and camera enabled) */}
                                {arDisplayType === 'wallpaper' && cameraUsage !== 'none' && (
                                    <FormControl fullWidth variant='outlined' margin='normal'>
                                        <InputLabel>{t('arjs.wallpaper.label')}</InputLabel>
                                        <Select
                                            value={wallpaperType}
                                            onChange={(e) => setWallpaperType(e.target.value)}
                                            label={t('arjs.wallpaper.label')}
                                            disabled={!!publishedUrl}
                                        >
                                            <MenuItem value='standard'>{t('arjs.wallpaper.standard')}</MenuItem>
                                        </Select>
                                    </FormControl>
                                )}

                                {/* Background Color (only when camera is disabled) */}
                                {cameraUsage === 'none' && (
                                    <FormControl fullWidth variant='outlined' margin='normal'>
                                        <TextField
                                            label={t('arjs.backgroundColor.label')}
                                            type='color'
                                            value={backgroundColor}
                                            onChange={(e) => setBackgroundColor(e.target.value)}
                                            disabled={!!publishedUrl}
                                            InputProps={{
                                                sx: {
                                                    height: '56px', // Match other form fields
                                                    '& input': {
                                                        cursor: 'pointer'
                                                    }
                                                }
                                            }}
                                            helperText={t('arjs.backgroundColor.helperText')}
                                        />
                                    </FormControl>
                                )}

                                {/* NEW: Library Configuration Section */}
                                <Box sx={{ mt: 3, mb: 2 }}>
                                    <Typography variant='subtitle2' gutterBottom>
                                        Настройки библиотек
                                    </Typography>

                                    {/* Global settings warning - only for enforcement mode and non-legacy scenarios */}
                                    {globalSettings?.enforceGlobalLibraryManagement && !isLegacyScenario && (
                                        <Alert severity='info' sx={{ mb: 2 }}>
                                            {t('arjs.globalLibraryManagement.enforcedMessage', {
                                                source:
                                                    globalSettings.defaultLibrarySource === 'official'
                                                        ? t('arjs.globalLibraryManagement.officialSource')
                                                        : t('arjs.globalLibraryManagement.kiberplanoSource')
                                            })}
                                        </Alert>
                                    )}

                                    {/* Legacy Configuration Alert - shown in place of standard message */}
                                    {alert && isLegacyScenario && (
                                        <Alert severity={alert.type} sx={{ mb: 2 }} onClose={() => setAlert(null)}>
                                            {alert.message}
                                        </Alert>
                                    )}

                                    {/* AR.js Configuration */}
                                    <Box sx={{ mb: 2 }}>
                                        <Typography variant='body2' color='text.secondary' gutterBottom>
                                            AR.js
                                        </Typography>
                                        <Grid container spacing={2}>
                                            <Grid item xs={6}>
                                                <FormControl fullWidth size='small'>
                                                    <InputLabel>Версия</InputLabel>
                                                    <Select
                                                        value={arjsVersion}
                                                        onChange={handleArjsVersionChange}
                                                        label='Версия'
                                                        disabled={!!publishedUrl}
                                                    >
                                                        <MenuItem value='3.4.7'>3.4.7</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Grid>
                                            <Grid item xs={6}>
                                                <FormControl fullWidth size='small'>
                                                    <InputLabel>Сервер</InputLabel>
                                                    <Select
                                                        value={arjsSource}
                                                        onChange={handleArjsSourceChange}
                                                        label='Сервер'
                                                        disabled={
                                                            !!publishedUrl ||
                                                            (globalSettings?.enforceGlobalLibraryManagement &&
                                                                (!isLegacyScenario || globalSettings?.autoCorrectLegacySettings))
                                                        }
                                                    >
                                                        <MenuItem value='official'>Официальный сервер</MenuItem>
                                                        <MenuItem value='kiberplano'>Сервер Kiberplano</MenuItem>
                                                    </Select>
                                                    {globalSettings?.enforceGlobalLibraryManagement &&
                                                        (!isLegacyScenario || globalSettings?.autoCorrectLegacySettings) && (
                                                            <FormHelperText>Источник управляется глобально</FormHelperText>
                                                        )}
                                                </FormControl>
                                            </Grid>
                                        </Grid>
                                    </Box>

                                    {/* A-Frame Configuration */}
                                    <Box sx={{ mb: 2 }}>
                                        <Typography variant='body2' color='text.secondary' gutterBottom>
                                            A-Frame
                                        </Typography>
                                        <Grid container spacing={2}>
                                            <Grid item xs={6}>
                                                <FormControl fullWidth size='small'>
                                                    <InputLabel>Версия</InputLabel>
                                                    <Select
                                                        value={aframeVersion}
                                                        onChange={handleAframeVersionChange}
                                                        label='Версия'
                                                        disabled={!!publishedUrl}
                                                    >
                                                        <MenuItem value='1.7.1'>1.7.1</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Grid>
                                            <Grid item xs={6}>
                                                <FormControl fullWidth size='small'>
                                                    <InputLabel>Сервер</InputLabel>
                                                    <Select
                                                        value={aframeSource}
                                                        onChange={handleAframeSourceChange}
                                                        label='Сервер'
                                                        disabled={
                                                            !!publishedUrl ||
                                                            (globalSettings?.enforceGlobalLibraryManagement &&
                                                                (!isLegacyScenario || globalSettings?.autoCorrectLegacySettings))
                                                        }
                                                    >
                                                        <MenuItem value='official'>Официальный сервер</MenuItem>
                                                        <MenuItem value='kiberplano'>Сервер Kiberplano</MenuItem>
                                                    </Select>
                                                    {globalSettings?.enforceGlobalLibraryManagement &&
                                                        (!isLegacyScenario || globalSettings?.autoCorrectLegacySettings) && (
                                                            <FormHelperText>Источник управляется глобально</FormHelperText>
                                                        )}
                                                </FormControl>
                                            </Grid>
                                        </Grid>
                                    </Box>
                                </Box>

                                {/* Marker Preview (only when marker selected) */}
                                {arDisplayType === 'marker' && (
                                    <Box sx={{ textAlign: 'center', my: 2 }}>
                                        <Typography variant='body2' color='text.secondary' gutterBottom>
                                            {t('preview.title')}
                                        </Typography>
                                        {markerType === 'preset' && markerValue && (
                                            <Box
                                                component='img'
                                                src={getMarkerImage()}
                                                alt={t('marker.alt')}
                                                sx={{ maxWidth: '200px', border: '1px solid #eee' }}
                                            />
                                        )}
                                        <Typography variant='caption' display='block' sx={{ mt: 1 }}>
                                            {t('marker.instruction')}
                                        </Typography>
                                    </Box>
                                )}

                                {/* Universo Platformo | Make Public Toggle with loading indicator */}
                                <Box sx={{ my: 3, width: '100%' }}>
                                    <FormControl fullWidth variant='outlined'>
                                        <FormControlLabel
                                            control={
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        width: '100%',
                                                        justifyContent: 'space-between'
                                                    }}
                                                >
                                                    <Switch
                                                        checked={isPublic}
                                                        onChange={(e) => handlePublicChange(e.target.checked)}
                                                        disabled={!!isPublishing}
                                                        color='primary'
                                                    />
                                                    {isPublishing && <CircularProgress size={20} sx={{ ml: 2 }} />}
                                                </Box>
                                            }
                                            label={t('configuration.makePublic')}
                                            sx={{
                                                width: '100%',
                                                margin: 0,
                                                '& .MuiFormControlLabel-label': {
                                                    width: '100%',
                                                    flexGrow: 1
                                                }
                                            }}
                                            labelPlacement='start'
                                        />
                                    </FormControl>
                                    <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
                                        {t('configuration.description')}
                                    </Typography>
                                </Box>

                                {/* Public link display */}
                                {isPublic && publishLinkRecords.length > 0 && (
                                    <>
                                        {/* New Publication Links Component */}
                                        <PublicationLinks links={publishLinkRecords} technology='arjs' />

                                        {/* QR Code Section */}
                                        {publishedUrl && (
                                            <QRCodeSection
                                                publishedUrl={publishedUrl}
                                                disabled={isPublishing}
                                                onDownloadSuccess={(message) => setSnackbar({ open: true, message })}
                                            />
                                        )}

                                        <Box sx={{ mt: 3 }}>
                                            <Typography variant='body2' gutterBottom>
                                                Инструкция по использованию:
                                            </Typography>
                                            <Box sx={{ textAlign: 'left', pl: 2 }}>
                                                <Typography variant='body2' component='div'>
                                                    {arDisplayType === 'wallpaper' ? (
                                                        <ol>
                                                            <li>Откройте URL на устройстве с камерой</li>
                                                            <li>Разрешите доступ к камере</li>
                                                            <li>Маркер не требуется — фон появится автоматически</li>
                                                            <li>Проходите квиз</li>
                                                        </ol>
                                                    ) : (
                                                        <ol>
                                                            <li>Откройте URL на устройстве с камерой</li>
                                                            <li>Разрешите доступ к камере</li>
                                                            <li>
                                                                Наведите камеру на маркер{' '}
                                                                {markerType === 'preset' ? `"${markerValue}"` : ''}
                                                            </li>
                                                            <li>Дождитесь появления 3D объекта</li>
                                                        </ol>
                                                    )}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </>
                                )}

                                {/* Error display */}
                                {error && (
                                    <Alert severity='error' sx={{ my: 2 }}>
                                        {error}
                                    </Alert>
                                )}
                            </>
                        )}
                    </Box>
                </CardContent>
            </Card>

            {/* Publish Version Section */}
            {(() => {
                const { unikId: urlUnikId, spaceId } = getCurrentUrlIds()
                const effectiveUnikId = unikId || urlUnikId
                const versionGroupId = resolvedVersionGroupId

                // Check if this is an inactive version
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
                        onVersionGroupResolved={(vg) => {
                            if (vg && vg !== resolvedVersionGroupId) {
                                setResolvedVersionGroupId(vg)
                            }
                        }}
                    />
                )
            })()}

            {/* Snackbar for notifications */}
            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleSnackbarClose} message={snackbar.message} />
        </Box>
    )
}

export { ARJSPublisher }
export default ARJSPublisher
