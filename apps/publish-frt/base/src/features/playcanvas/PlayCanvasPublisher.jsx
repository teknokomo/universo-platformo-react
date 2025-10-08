import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
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
    Snackbar
} from '@mui/material'

import TemplateSelect from '../../components/TemplateSelect'
import GenerationModeSelect from '../../components/GenerationModeSelect'
import GameModeSelector from '../../components/GameModeSelector'
import ColyseusSettings from '../../components/ColyseusSettings'
import { PublicationLinks } from '../../components/PublicationLinks'
import { PublishVersionSection } from '../../components/PublishVersionSection'
import { PlayCanvasPublicationApi, PublishLinksApi, getCurrentUrlIds } from '../../api'
import { DEFAULT_DEMO_MODE } from '../../types/publication.types'
import { isValidBase58 } from '../../utils/base58Validator'

const DEFAULT_VERSION = '2.9.0'
const DEFAULT_TEMPLATE = 'mmoomm-playcanvas'

const PlayCanvasPublisher = ({ flow }) => {
    const { t } = useTranslation('publish')

    // Debug: log flow object to see what fields are available
    useEffect(() => {
        console.log('[PlayCanvasPublisher] flow object:', flow)
        console.log('[PlayCanvasPublisher] versionGroupId:', flow?.versionGroupId)
        console.log('[PlayCanvasPublisher] version_group_id:', flow?.version_group_id)
    }, [flow])

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
            if (!flow?.id && !flow?.versionGroupId) {
                return []
            }

            try {
                const links = await PublishLinksApi.listLinks({
                    technology: 'playcanvas',
                    versionGroupId: flow?.versionGroupId ?? null
                })

                const filtered = links.filter((link) => {
                    if (flow?.versionGroupId && link.versionGroupId === flow.versionGroupId) {
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
                    console.log('[PlayCanvasPublisher] Invalid or empty links, retrying in 500ms...')
                    await new Promise((resolve) => setTimeout(resolve, 500))
                    return loadPublishLinks(1)
                }

                setPublishLinkRecords(filtered)

                // Update public state based on actual links
                const hasGroupLink = filtered.some(link => link.targetType === 'group')
                setIsPublic(hasGroupLink)

                return filtered
            } catch (apiError) {
                console.error('PlayCanvasPublisher: failed to load publish links', apiError)
                setPublishLinkRecords([])
                return []
            }
        },
        [flow?.id, flow?.versionGroupId]
    )

    useEffect(() => {
        loadPublishLinks()
    }, [loadPublishLinks])

    useEffect(() => {
        const load = async () => {
            if (!flow?.id) {
                setLoading(false)
                return
            }
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

                    if (settings.isPublic) {
                        await loadPublishLinks()
                    }
                }
            } catch (e) {
                console.error('PlayCanvasPublisher: load error', e)
                setError(e.message)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [flow?.id, loadPublishLinks])

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
        setIsPublic(nextValue)

        if (!nextValue) {
            // Remove all group links for this technology
            try {
                const links = await PublishLinksApi.listLinks({ technology: 'playcanvas' })
                const groupLinks = links.filter(link => link.targetType === 'group')
                await Promise.all(groupLinks.map(link => PublishLinksApi.deleteLink(link.id)))
                await loadPublishLinks()
                setSnackbar({ open: true, message: t('notifications.publicationRemoved') })
            } catch (error) {
                console.error('[PlayCanvasPublisher] Error removing publication:', error)
                setSnackbar({ open: true, message: t('notifications.publicationError') })
                setIsPublic(true) // Revert toggle on error
            }
            return
        }

        // Create publication link when enabling public access
        try {
            if (!flow?.id) {
                console.error('[PlayCanvasPublisher] Cannot create publication: flow.id is missing')
                return
            }

            // Extract versionGroupId from flow (supports both camelCase and snake_case)
            const versionGroupId = flow?.versionGroupId || flow?.version_group_id

            // Create group link using unified API with versionGroupId
            await PublishLinksApi.createGroupLink(flow.id, 'playcanvas', versionGroupId)

            // Reload links to display the new publication
            await loadPublishLinks()

            // Show success notification
            setSnackbar({ open: true, message: t('notifications.publicationCreated') })
        } catch (error) {
            console.error('[PlayCanvasPublisher] Error creating publication:', error)
            setError(error.message || 'Failed to create publication')
            setSnackbar({ open: true, message: t('notifications.publicationError') })
            setIsPublic(false) // Revert toggle on error
        }
    }

    const handleSnackbarClose = () => {
        setSnackbar({ ...snackbar, open: false })
    }

    useEffect(() => {
        if (!loading) {
            const tId = setTimeout(saveSettings, 500)
            return () => clearTimeout(tId)
        }
    }, [projectTitle, isPublic, templateId, libraryVersion, generationMode, demoMode, gameMode, colyseusSettings, loading, flow?.id]) // Add gameMode and colyseusSettings to dependencies

    if (loading)
        return (
            <Box sx={{ p: 2 }}>
                <CircularProgress />
            </Box>
        )
    if (error)
        return (
            <Box sx={{ p: 2 }}>
                <Typography color='error'>{error}</Typography>
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

            {/* Main Content Card */}
            <Card variant='outlined' sx={{ mb: 3 }}>
                <CardContent>
                    <TextField
                        fullWidth
                        label={t('playcanvas.projectTitle')}
                        margin='normal'
                        value={projectTitle}
                        onChange={(e) => setProjectTitle(e.target.value)}
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
                const versionGroupId = flow?.versionGroupId || flow?.version_group_id

                // Debug: show what we have
                console.log('[PlayCanvasPublisher] Render check:', {
                    hasFlow: !!flow,
                    flowId: flow?.id,
                    versionGroupId,
                    unikId,
                    spaceId,
                    flowKeys: flow ? Object.keys(flow) : []
                })

                // Check if we have all required data
                const isActiveVersion = flow?.isActive ?? flow?.is_active

                // Check if this is an inactive version
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

export default PlayCanvasPublisher
