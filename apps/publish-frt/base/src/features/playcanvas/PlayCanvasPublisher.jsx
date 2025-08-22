import React, { useEffect, useState, useRef } from 'react'
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
    FormHelperText
} from '@mui/material'

import TemplateSelect from '../../components/TemplateSelect'
import GenerationModeSelect from '../../components/GenerationModeSelect'
import GameModeSelector from '../../components/GameModeSelector'
import ColyseusSettings from '../../components/ColyseusSettings'
import PublicationLink from '../../components/PublicationLink'
import { PlayCanvasPublicationApi } from '../../api'
import { DEFAULT_DEMO_MODE } from '../../types/publication.types'

const DEFAULT_VERSION = '2.9.0'
const DEFAULT_TEMPLATE = 'mmoomm-playcanvas'

const PlayCanvasPublisher = ({ flow }) => {
    const { t } = useTranslation('publish')
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
    const [publishedUrl, setPublishedUrl] = useState('')

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

                    // Generate published URL if public
                    if (settings.isPublic) {
                        const fullPublicUrl = `${window.location.origin}/p/${flow.id}`
                        setPublishedUrl(fullPublicUrl)
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
    }, [flow?.id])

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

    useEffect(() => {
        if (!loading) {
            const tId = setTimeout(saveSettings, 500)
            return () => clearTimeout(tId)
        }
    }, [projectTitle, isPublic, templateId, libraryVersion, generationMode, demoMode, gameMode, colyseusSettings, loading, flow?.id]) // Add gameMode and colyseusSettings to dependencies

    // Update published URL when isPublic changes
    useEffect(() => {
        if (!loading && flow?.id) {
            if (isPublic) {
                const fullPublicUrl = `${window.location.origin}/p/${flow.id}`
                setPublishedUrl(fullPublicUrl)
            } else {
                setPublishedUrl('')
            }
        }
    }, [isPublic, flow?.id, loading])

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
                    <GameModeSelector
                        value={gameMode}
                        onChange={setGameMode}
                        disabled={false}
                    />

                    {/* Colyseus Settings Panel - only visible when multiplayer mode is selected */}
                    <ColyseusSettings
                        settings={colyseusSettings}
                        onChange={setColyseusSettings}
                        visible={gameMode === 'multiplayer'}
                    />

                    {/* Make Public Toggle - moved to bottom like in ARJSPublisher */}
                    <Box sx={{ my: 3, width: '100%' }}>
                        <FormControl fullWidth variant='outlined'>
                            <FormControlLabel
                                control={<Switch checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />}
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

                    {/* Publication Link - moved to bottom after toggle */}
                    {isPublic && publishedUrl && (
                        <PublicationLink
                            url={publishedUrl}
                            labelKey='playcanvas.publishedUrl'
                            helpTextKey='playcanvas.openInBrowser'
                            viewTooltipKey='playcanvas.viewApp'
                        />
                    )}
                </CardContent>
            </Card>
        </Box>
    )
}

export default PlayCanvasPublisher
