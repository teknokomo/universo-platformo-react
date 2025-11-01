// Universo Platformo | PlayCanvas Publisher Component (TypeScript)
// Main component for PlayCanvas publication settings and management

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Box, Typography, TextField, FormControl, InputLabel, Select, MenuItem, FormHelperText, Snackbar } from '@mui/material'
import { useSession } from '@universo/auth-frt'

import TemplateSelect from '../../components/TemplateSelect'
import GenerationModeSelect from '../../components/GenerationModeSelect'
import GameModeSelector from '../../components/GameModeSelector'
import ColyseusSettings from '../../components/ColyseusSettings'
import { PublicationLinks } from '../../components/PublicationLinks'
import { PublishVersionSection } from '../../components/PublishVersionSection'
import { PublicationToggle, PublicationSettingsCard, AsyncStatusBar } from '../../components/shared'
import {
    PlayCanvasPublicationApi,
    PublishLinksApi,
    PublicationApi,
    getCurrentUrlIds,
    getPublishApiClient,
    publishQueryKeys,
    type PublishLinkRecord
} from '../../api'
import { DEFAULT_DEMO_MODE, type DemoMode, type GameMode, type ColyseusSettings as ColyseusSettingsType } from '../../types'
import { FieldNormalizer } from '../../utils/fieldNormalizer'
import { useAutoSave } from '../../hooks'

const DEFAULT_VERSION = '2.9.0'
const DEFAULT_TEMPLATE = 'mmoomm-playcanvas'

interface PlayCanvasPublisherProps {
    flow: {
        id: string
        name?: string
        isActive?: boolean
        is_active?: boolean
        versionGroupId?: string
        version_group_id?: string
        [key: string]: any
    }
}

const PlayCanvasPublisherComponent: React.FC<PlayCanvasPublisherProps> = ({ flow }) => {
    const { t } = useTranslation('publish')
    const publishClient = useMemo(() => getPublishApiClient(), [])
    const { user: authUser, refresh: refreshSession } = useSession({ client: publishClient })

    // Universo Platformo | keep latest flow.id for delayed saves
    const flowIdRef = useRef<string | undefined>(flow?.id)
    useEffect(() => {
        flowIdRef.current = flow?.id
    }, [flow?.id])

    const [projectTitle, setProjectTitle] = useState<string>(flow?.name || '')
    const [isPublic, setIsPublic] = useState<boolean>(false)
    const [templateId, setTemplateId] = useState<string>(DEFAULT_TEMPLATE)
    const [libraryVersion, setLibraryVersion] = useState<string>(DEFAULT_VERSION)
    const [generationMode, setGenerationMode] = useState<'streaming'>('streaming')
    const [demoMode, setDemoMode] = useState<DemoMode>(DEFAULT_DEMO_MODE)
    const [gameMode, setGameMode] = useState<GameMode>('singleplayer')
    const [colyseusSettings, setColyseusSettings] = useState<ColyseusSettingsType>({
        serverHost: 'localhost',
        serverPort: 2567,
        roomName: 'mmoomm_room'
    })
    const [loading, setLoading] = useState<boolean>(true)
    const [error, setError] = useState<string>('')
    const [publishLinkRecords, setPublishLinkRecords] = useState<PublishLinkRecord[]>([])
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: '' })
    const queryClient = useQueryClient()
    const [settingsReloadNonce, setSettingsReloadNonce] = useState<number>(0)

    const normalizedVersionGroupId = useMemo(() => FieldNormalizer.normalizeVersionGroupId(flow), [flow])
    const lastLoadedFlowIdRef = useRef<string | null>(null)

    // Get current unikId from URL
    const currentUnikId = useMemo(() => {
        const { unikId: urlUnikId } = getCurrentUrlIds()
        return urlUnikId
    }, [])

    // Use useQuery for automatic deduplication and caching
    const { data: canvasData, isError: isCanvasError } = useQuery({
        queryKey: publishQueryKeys.canvasByUnik(currentUnikId || '', flow?.id),
        queryFn: async () => {
            if (!currentUnikId || !flow?.id) {
                throw new Error('Missing required parameters')
            }
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
    const resolvedVersionGroupIdRef = useRef<string | null>(resolvedVersionGroupId)
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

                        if (currentFlowId && link.targetCanvasId) {
                            return String(link.targetCanvasId) === currentFlowId
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
                    setGenerationMode('streaming')
                    setDemoMode(settings.demoMode || DEFAULT_DEMO_MODE)
                    setGameMode(settings.gameMode || 'singleplayer')

                    // Load Colyseus settings with defaults
                    if (settings.colyseusSettings) {
                        setColyseusSettings(settings.colyseusSettings)
                    } else {
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
        queryClient.invalidateQueries({ queryKey: publishQueryKeys.canvas(), exact: false })
        queryClient.invalidateQueries({ queryKey: publishQueryKeys.linksByTechnology('playcanvas'), exact: false })
    }, [queryClient])

    const handlePublicToggle = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
                const relevantLinks = links.filter((link) => {
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

                await Promise.all(relevantLinks.map((link) => PublishLinksApi.deleteLink(link.id)))
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
            const errorMessage = error instanceof Error ? error.message : 'Failed to create publication'
            setError(errorMessage)
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
        async (data: typeof settingsData) => {
            const currentFlowId = flowIdRef.current
            if (!currentFlowId || loading) return

            await PlayCanvasPublicationApi.savePlayCanvasSettings(currentFlowId, {
                isPublic,
                projectTitle: data.projectTitle,
                templateId: data.templateId,
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

    return (
        <Box sx={{ width: '100%' }}>
            {/* Technology Description Header */}
            <Typography variant='h4' gutterBottom>
                {t('technologies.playcanvas')}
            </Typography>
            <Typography variant='body2' color='text.secondary' paragraph>
                {t('technologies.playcanvasDescription')}
            </Typography>

            {/* Main Content Card */}
            <PublicationSettingsCard
                isLoading={loading}
                loadingMessage={t('common.loadingSettings', 'Loading settings...')}
                error={error}
                onRetry={handleRetryLoadSettings}
                retryLabel={t('common.retry', 'Повторить')}
            >
                <TextField
                    fullWidth
                    label={t('playcanvas.projectTitle')}
                    margin='normal'
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                />
                <AsyncStatusBar status={autoSaveStatus} variant='inline' size='small' />

                {/* Generation Mode Selector */}
                <GenerationModeSelect
                    value={generationMode}
                    onChange={(mode) => setGenerationMode(mode as 'streaming')}
                    disabled={false}
                    technology='playcanvas'
                />

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
                    <Select
                        value={demoMode}
                        label={t('playcanvas.demoMode.label')}
                        onChange={(e) => setDemoMode(e.target.value as DemoMode)}
                    >
                        <MenuItem value='off'>{t('playcanvas.demoMode.off')}</MenuItem>
                        <MenuItem value='primitives'>{t('playcanvas.demoMode.primitives')}</MenuItem>
                    </Select>
                    <FormHelperText>{t('playcanvas.demoMode.hint')}</FormHelperText>
                </FormControl>

                {/* Game Mode Selector */}
                <GameModeSelector value={gameMode} onChange={setGameMode} disabled={false} />

                {/* Colyseus Settings Panel - only visible when multiplayer mode is selected */}
                <ColyseusSettings settings={colyseusSettings} onChange={setColyseusSettings} visible={gameMode === 'multiplayer'} />

                {/* Make Public Toggle */}
                <PublicationToggle checked={isPublic} onChange={(checked) => handlePublicToggle({ target: { checked } } as any)} />

                {/* Publication Links - New Component */}
                {isPublic && publishLinkRecords.length > 0 && <PublicationLinks links={publishLinkRecords} technology='playcanvas' />}
            </PublicationSettingsCard>

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
                    />
                )
            })()}

            {/* Snackbar for notifications */}
            <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={handleSnackbarClose} message={snackbar.message} />
        </Box>
    )
}

// NOTE: QueryClient is now provided by PublishDialog wrapper
const PlayCanvasPublisher = PlayCanvasPublisherComponent

export default PlayCanvasPublisher
