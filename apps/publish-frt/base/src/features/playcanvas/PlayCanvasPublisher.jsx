import React, { useEffect, useState } from 'react'
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
    CircularProgress
} from '@mui/material'

import TemplateSelect from '../../components/TemplateSelect'
import { PlayCanvasPublicationApi } from '../../api'

const DEFAULT_VERSION = '2.9.0'
const DEFAULT_TEMPLATE = 'mmoomm'

const PlayCanvasPublisher = ({ flow }) => {
    const { t } = useTranslation('publish')
    const [projectTitle, setProjectTitle] = useState(flow?.name || '')
    const [isPublic, setIsPublic] = useState(false)
    const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE)
    const [libraryVersion, setLibraryVersion] = useState(DEFAULT_VERSION)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

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
                    setTemplateId(settings.templateId || DEFAULT_TEMPLATE)
                    const libVer = settings.libraryConfig?.playcanvas?.version
                    setLibraryVersion(libVer || DEFAULT_VERSION)
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
        if (!flow?.id) return
        try {
            await PlayCanvasPublicationApi.savePlayCanvasSettings(flow.id, {
                isPublic,
                projectTitle,
                generationMode: 'streaming',
                templateId,
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
    }, [projectTitle, isPublic, templateId, libraryVersion, loading])

    if (loading) return (
        <Box sx={{ p: 2 }}><CircularProgress /></Box>
    )
    if (error) return (
        <Box sx={{ p: 2 }}><Typography color='error'>{error}</Typography></Box>
    )

    return (
        <Box sx={{ p: 2 }}>
            <TextField
                fullWidth
                label={t('playcanvas.projectTitle')}
                margin='normal'
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
            />
            <FormControlLabel
                control={<Switch checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />}
                label={t('configuration.makePublic')}
                sx={{ my: 1 }}
            />
            <TemplateSelect selectedTemplate={templateId} onTemplateChange={setTemplateId} />
            <FormControl fullWidth margin='normal'>
                <InputLabel>{t('playcanvas.libraryVersion.label')}</InputLabel>
                <Select
                    value={libraryVersion}
                    label={t('playcanvas.libraryVersion.label')}
                    onChange={(e) => setLibraryVersion(e.target.value)}
                >
                    <MenuItem value='2.9.0'>2.9.0</MenuItem>
                </Select>
            </FormControl>
            <Typography variant='caption'>{t('playcanvas.libraryVersion.hint')}</Typography>
        </Box>
    )
}

export default PlayCanvasPublisher
