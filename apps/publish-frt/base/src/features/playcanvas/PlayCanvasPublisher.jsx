import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
    Box,
    Typography,
    TextField,
    Switch,
    FormControlLabel,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    CircularProgress,
    Card,
    CardContent,
    FormHelperText,
    Snackbar,
    Alert,
    Button
} from '@mui/material'
import { useSession } from '@universo/auth-frt'

import TemplateSelect from '../../components/TemplateSelect'
import GenerationModeSelect from '../../components/GenerationModeSelect'
import GameModeSelector from '../../components/GameModeSelector'
import ColyseusSettings from '../../components/ColyseusSettings'
import { PublicationLinks } from '../../components/PublicationLinks'
import { PublishVersionSection } from '../../components/PublishVersionSection'
import { PlayCanvasPublicationApi, PublishLinksApi, PublicationApi, getCurrentUrlIds, getPublishApiClient, publishQueryKeys } from '../../api'
import { DEFAULT_DEMO_MODE } from '../../types/publication.types'
import { isValidBase58 } from '../../utils/base58Validator'
import { FieldNormalizer } from '../../utils/fieldNormalizer'
import { useAutoSave } from '../../hooks'

const DEFAULT_VERSION = '2.9.0'
const DEFAULT_TEMPLATE = 'mmoomm-playcanvas'

const PlayCanvasPublisherComponent = ({ flow }) => {
    const { t } = useTranslation('publish')
    const publishClient = useMemo(() => getPublishApiClient(), [])
    const { user: authUser, refresh: refreshSession } = useSession({ client: publishClient })

    // Universo Platformo | keep latest flow.id for delayed saves
    const flowIdRef = useRef(flow?.id)
    useEffect(() => {
        flowIdRef.current = flow?.id
    }, [flow?.id])
    const [projectTitle, setProjectTitle] = useState(flow?.name || '')
    const [isPublic, setIsPublic] = useState(false)
    const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE)
    const [libraryVersion, setLibraryVersion] = useState(DEFAULT_VERSION)
    const [generationMode, setGenerationMode] = useState('streaming') // New state for generation mode
    const [demoMode, setDemoMode] = useState(DEFAULT_DEMO_MODE) // New state for demo mode
    const [gameMode, setGameMode] = useState('singleplayer') // New state for game mode
    const [colyseusSettings, setColyseusSettings] = useState({
        serverHost: 'localhost',
        serverPort: 2567,
        roomName: 'mmoomm_room'
    }) // New state for Colyseus settings
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [publishLinkRecords, setPublishLinkRecords] = useState([])
    const [snackbar, setSnackbar] = useState({ open: false, message: '' })
    const queryClient = useQueryClient()
    const [settingsReloadNonce, setSettingsReloadNonce] = useState(0)

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

    const normalizedVersionGroupId = useMemo(() => FieldNormalizer.normalizeVersionGroupId(flow), [flow])
    const lastLoadedFlowIdRef = useRef(null)

    // Get current unikId from URL
    const currentUnikId = useMemo(() => {
        const { unikId: urlUnikId } = getCurrentUrlIds()
        return urlUnikId
    }, [])

    // Use useQuery for automatic deduplication and caching
    // This replaces the imperative fetchQuery approach
    const {
        data: canvasData,
        isLoading: isCanvasLoading,
        isError: isCanvasError
    } = useQuery({
        queryKey: publishQueryKeys.canvasByUnik(currentUnikId, flow?.id),
        queryFn: async () => {
            const response = await PublicationApi.getCanvasById(currentUnikId, String(flow.id))
            return response?.data
        },
        enabled: !!flow?.id && !!currentUnikId && !normalizedVersionGroupId,
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: false // Don't retry on error, just show warning
    })

    // Compute resolvedVersionGroupId from either flow data or fetched canvas data
    const resolvedVersionGroupId = useMemo(() => {
        // First try to get from flow itself
        if (normalizedVersionGroupId) {
            return normalizedVersionGroupId
        }
        // Otherwise try to extract from fetched canvas data
        if (canvasData) {
            const detected = FieldNormalizer.normalizeVersionGroupId(canvasData)
            if (detected) {
                return detected
            }
        }
        return null
    }, [normalizedVersionGroupId, canvasData])

    // Keep ref updated for use in callbacks
    const resolvedVersionGroupIdRef = useRef(resolvedVersionGroupId)
    useEffect(() => {
        resolvedVersionGroupIdRef.current = resolvedVersionGroupId
    }, [resolvedVersionGroupId])

    // Log warning if canvas fetch failed
    useEffect(() => {
        if (isCanvasError) {
            console.warn('[PlayCanvasPublisher] Failed to load versionGroupId from API')
        }
    }, [isCanvasError])

    const loadPublishLinks = useCallback(async () => {
        const currentFlowId = flowIdRef.current ? String(flowIdRef.current) : null
        const currentVersionGroupId = resolvedVersionGroupIdRef.current ?? null

        if (!currentFlowId && !currentVersionGroupId) {
            return []
        }

        try {
            const records = await queryClient.fetchQuery({
                queryKey: publishQueryKeys.linksByVersion('playcanvas', currentFlowId, currentVersionGroupId),
                queryFn: async () => {
                    const links = await PublishLinksApi.listLinks({
                        technology: 'playcanvas',
                        versionGroupId: currentVersionGroupId ?? null
                    })

                    return links.filter((link) => {
                        if (currentVersionGroupId && link.versionGroupId === currentVersionGroupId) {
                            return true
                        }

                        if (currentFlowId && link.targetCanvasId === currentFlowId) {
                            return true
                        }

                        return false
                    })
                }
            })

            setPublishLinkRecords(records)
            setIsPublic((prev) => {
                const hasGroupLink = records.some((link) => link.targetType === 'group')
                return prev === hasGroupLink ? prev : hasGroupLink
            })

            return records
        } catch (apiError) {
            console.error('PlayCanvasPublisher: failed to load publish links', apiError)
            setPublishLinkRecords([])
            return []
        }
    }, [queryClient])

    useEffect(() => {
        if (!flow?.id && !resolvedVersionGroupId) {
            return
        }

        loadPublishLinks()
    }, [flow?.id, resolvedVersionGroupId, loadPublishLinks])

    useEffect(() => {
        const load = async () => {
            if (!flow?.id) {
                setLoading(false)
                return
            }

            if (lastLoadedFlowIdRef.current === flow.id) {
                setLoading(false)
                return
            }

            lastLoadedFlowIdRef.current = flow.id
            try {
                const settings = await PlayCanvasPublicationApi.loadPlayCanvasSettings(flow.id)
                if (settings) {
                    setProjectTitle(settings.projectTitle || flow?.name || '')
                    setIsPublic(!!settings.isPublic)
                    // Backward compatibility: migrate old id 'mmoomm' to new 'mmoomm-playcanvas'
                    const tplId = settings.templateId === 'mmoomm' ? 'mmoomm-playcanvas' : settings.templateId
                    setTemplateId(tplId || DEFAULT_TEMPLATE)
                    setGenerationMode(settings.generationMode || 'streaming') // Load generation mode
                    setDemoMode(settings.demoMode || DEFAULT_DEMO_MODE) // Load demo mode
                    setGameMode(settings.gameMode || 'singleplayer') // Load game mode

                    // Load Colyseus settings with defaults from environment variables
                    if (settings.colyseusSettings) {
                        setColyseusSettings(settings.colyseusSettings)
                    } else {
                        // Use default values from packages/server/.env
                        // MULTIPLAYER_SERVER_HOST=localhost
                        // MULTIPLAYER_SERVER_PORT=2567
                        setColyseusSettings({
                            serverHost: 'localhost',
                            serverPort: 2567,
                            roomName: 'mmoomm_room'
                        })
                    }

                    const libVer = settings.libraryConfig?.playcanvas?.version
                    setLibraryVersion(libVer || DEFAULT_VERSION)
                }
            } catch (e) {
                console.error('PlayCanvasPublisher: load error', e)
                lastLoadedFlowIdRef.current = null
                const message = e instanceof Error ? e.message : 'Failed to load PlayCanvas settings. Please retry.'
                setError(message)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [flow?.id, settingsReloadNonce])

    const handleRetryLoadSettings = useCallback(() => {
        setError('')
        setLoading(true)
        lastLoadedFlowIdRef.current = null
        setSettingsReloadNonce((nonce) => nonce + 1)
        queryClient.invalidateQueries({ queryKey: ['publish', 'canvas'], exact: false })
        queryClient.invalidateQueries({ queryKey: ['publish', 'links', 'playcanvas'], exact: false })
    }, [queryClient])

    const saveSettings = async () => {
        // Universo Platformo | always use the latest flow.id
        const currentFlowId = flowIdRef.current
        if (!currentFlowId) return
        try {
            await PlayCanvasPublicationApi.savePlayCanvasSettings(currentFlowId, {
                isPublic,
                projectTitle,
                generationMode, // Include generation mode in save
                templateId,
                demoMode, // Include demo mode in save
                gameMode, // Include game mode in save
                colyseusSettings, // Include Colyseus settings in save
                libraryConfig: { playcanvas: { version: libraryVersion, source: 'official' } }
            })
        } catch (e) {
            console.error('PlayCanvasPublisher: save error', e)
        }
    }

    const handlePublicToggle = async (event) => {
        const nextValue = event.target.checked
        const previousValue = isPublic
        const previousRecords = publishLinkRecords

        // Optimistic update
        setIsPublic(nextValue)

        if (!nextValue) {
            // Optimistically clear links
            setPublishLinkRecords([])

            try {
                const links = await PublishLinksApi.listLinks({ technology: 'playcanvas' })
                const relevantLinks = links.filter(link => {
                    if (link.targetType !== 'group') {
                        return false
                    }

                    if (resolvedVersionGroupId) {
                        return link.versionGroupId === resolvedVersionGroupId
                    }

                    if (flow?.id && link.targetCanvasId) {
                        return String(link.targetCanvasId) === String(flow.id)
                    }

                    return false
                })

                if (relevantLinks.length === 0) {
                    setSnackbar({ open: true, message: t('notifications.publicationRemoved') })
                    return
                }

                await Promise.all(relevantLinks.map(link => PublishLinksApi.deleteLink(link.id)))
                setSnackbar({ open: true, message: t('notifications.publicationRemoved') })
            } catch (error) {
                console.error('[PlayCanvasPublisher] Error removing publication:', error)
                setSnackbar({ open: true, message: t('notifications.publicationError') })
                // Rollback on error
                setIsPublic(previousValue)
                setPublishLinkRecords(previousRecords)
                // Reload to sync state
                await loadPublishLinks()
            }
            return
        }

        // Create publication link when enabling public access
        try {
            if (!flow?.id) {
                console.error('[PlayCanvasPublisher] Cannot create publication: flow.id is missing')
                setIsPublic(previousValue)
                return
            }

            const ensuredUser = authUser ?? (await refreshSession())
            if (!ensuredUser) {
                throw new Error('Authentication required to publish PlayCanvas links')
            }

            await PublishLinksApi.createGroupLink(String(flow.id), 'playcanvas', resolvedVersionGroupId ?? undefined)

            // Reload links to display the new publication
            await loadPublishLinks()

            setSnackbar({ open: true, message: t('notifications.publicationCreated') })
        } catch (error) {
            console.error('[PlayCanvasPublisher] Error creating publication:', error)
            setError(error.message || 'Failed to create publication')
            setSnackbar({ open: true, message: t('notifications.publicationError') })
            // Rollback on error
            setIsPublic(previousValue)
            setPublishLinkRecords(previousRecords)
        }
    }

    const handleSnackbarClose = () => {
        setSnackbar({ ...snackbar, open: false })
    }

    // Auto-save settings (excluding isPublic which is handled separately)
    const settingsData = useMemo(
        () => ({
            projectTitle,
            templateId,
            libraryVersion,
            generationMode,
            demoMode,
            gameMode,
            colyseusSettings
        }),
        [projectTitle, templateId, libraryVersion, generationMode, demoMode, gameMode, colyseusSettings]
    )

    const handleAutoSave = useCallback(
        async (data) => {
            const currentFlowId = flowIdRef.current
            if (!currentFlowId || loading) return

            await PlayCanvasPublicationApi.savePlayCanvasSettings(currentFlowId, {
                isPublic,
                projectTitle: data.projectTitle,
                templateId: data.templateId,
                libraryVersion: data.libraryVersion,
                generationMode: data.generationMode,
                demoMode: data.demoMode,
                gameMode: data.gameMode,
                colyseusSettings: data.colyseusSettings,
                libraryConfig: { playcanvas: { version: data.libraryVersion, source: 'official' } }
            })
        },
        [isPublic, loading]
    )

    const { status: autoSaveStatus } = useAutoSave({
        data: settingsData,
        onSave: handleAutoSave,
        delay: 500,
        enableBeforeUnload: true,
        enabled: !loading
    })

    if (loading)
        return (
            <Box sx={{ p: 2 }}>
                <CircularProgress />
            </Box>
        )

    return (
        <Box sx={{ width: '100%' }}>
            {/* Technology Description Header */}
            <Typography variant='h4' gutterBottom>
                {t('technologies.playcanvas')}
            </Typography>
            <Typography variant='body2' color='text.secondary' paragraph>
                {t('technologies.playcanvasDescription')}
            </Typography>

            {error && (
                <Alert severity='error' sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box component='span' sx={{ flexGrow: 1 }}>
                        {error}
                    </Box>
                    <Button variant='outlined' color='inherit' size='small' onClick={handleRetryLoadSettings}>
                        {t('common.retry', 'Повторить')}
                    </Button>
                </Alert>
            )}

            {/* Main Content Card */}
            <Card variant='outlined' sx={{ mb: 3 }}>
                <CardContent>
                    <TextField
                        fullWidth
                        label={t('playcanvas.projectTitle')}
                        margin='normal'
                        value={projectTitle}
                        onChange={(e) => setProjectTitle(e.target.value)}
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
                    <GenerationModeSelect value={generationMode} onChange={setGenerationMode} disabled={false} technology='playcanvas' />

                    <TemplateSelect selectedTemplate={templateId} onTemplateChange={setTemplateId} technology='playcanvas' />

                    <FormControl fullWidth margin='normal'>
                        <InputLabel>{t('playcanvas.libraryVersion.label')}</InputLabel>
                        <Select
                            value={libraryVersion}
                            label={t('playcanvas.libraryVersion.label')}
                            onChange={(e) => setLibraryVersion(e.target.value)}
                        >
                            <MenuItem value='2.9.0'>2.9.0</MenuItem>
                        </Select>
                        <FormHelperText>{t('playcanvas.libraryVersion.hint')}</FormHelperText>
                    </FormControl>

                    {/* Demo Mode Selector */}
                    <FormControl fullWidth margin='normal'>
                        <InputLabel>{t('playcanvas.demoMode.label')}</InputLabel>
                        <Select value={demoMode} label={t('playcanvas.demoMode.label')} onChange={(e) => setDemoMode(e.target.value)}>
                            <MenuItem value='off'>{t('playcanvas.demoMode.off')}</MenuItem>
                            <MenuItem value='primitives'>{t('playcanvas.demoMode.primitives')}</MenuItem>
                        </Select>
                        <FormHelperText>{t('playcanvas.demoMode.hint')}</FormHelperText>
                    </FormControl>

                    {/* Game Mode Selector */}
                    <GameModeSelector value={gameMode} onChange={setGameMode} disabled={false} />

                    {/* Colyseus Settings Panel - only visible when multiplayer mode is selected */}
                    <ColyseusSettings settings={colyseusSettings} onChange={setColyseusSettings} visible={gameMode === 'multiplayer'} />

                    {/* Make Public Toggle - moved to bottom like in ARJSPublisher */}
                    <Box sx={{ my: 3, width: '100%' }}>
                        <FormControl fullWidth variant='outlined'>
                            <FormControlLabel
                                control={<Switch checked={isPublic} onChange={handlePublicToggle} />}
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

                    {/* Publication Links - New Component */}
                    {isPublic && publishLinkRecords.length > 0 && <PublicationLinks links={publishLinkRecords} technology='playcanvas' />}
                </CardContent>
            </Card>

            {/* Publish Version Section */}
            {(() => {
                const { unikId, spaceId } = getCurrentUrlIds()
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

                if (!unikId || !spaceId) {
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
                        unikId={unikId}
                        spaceId={spaceId}
                        canvasId={flow.id}
                        versionGroupId={versionGroupId}
                        technology='playcanvas'
                        // onVersionGroupResolved removed: resolvedVersionGroupId is now computed via useMemo
                        // from normalizedVersionGroupId or canvasData, no manual state update needed
                    />
                )
            })()}

            {/* Snackbar for notifications */}
            <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={handleSnackbarClose} message={snackbar.message} />
        </Box>
    )
}

// NOTE: QueryClient is now provided by PublishDialog wrapper
// No need for local PublishQueryProvider
const PlayCanvasPublisher = PlayCanvasPublisherComponent

export default PlayCanvasPublisher
