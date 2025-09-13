import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Box, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useApi } from '../hooks/useApi'
import * as sectionsApi from '../api/sections'
import { Section } from '../types'

interface SectionDialogProps {
    open: boolean
    onClose: () => void
    onSave: () => void
    section?: Section | null
    metaverseId?: string
}

const SectionDialog: React.FC<SectionDialogProps> = ({ open, onClose, onSave, section, metaverseId }) => {
    const { t } = useTranslation('entities')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [isLoading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const { request: createSection } = useApi(sectionsApi.createSection)
    const { request: updateSection } = useApi(sectionsApi.updateSection)

    useEffect(() => {
        if (section) {
            setName(section.name)
            setDescription(section.description || '')
        } else {
            setName('')
            setDescription('')
        }
        setError(null)
    }, [section, open])

    const handleSave = async () => {
        if (!(name || '').trim()) {
            setError(t('sections.nameRequired', 'Name is required'))
            return
        }

        // Validate metaverse context for new sections
        if (!section && !metaverseId) {
            setError(t('sections.metaverseRequired', 'Metaverse context is required for creating sections'))
            return
        }

        try {
            setLoading(true)
            setError(null)

            if (section) {
                await updateSection(section.id, { name: (name || '').trim(), description: (description || '').trim() || undefined })
            } else {
                // Section-metaverse link is now created atomically on backend
                await createSection({
                    name: (name || '').trim(),
                    description: (description || '').trim() || undefined,
                    metaverseId: metaverseId!
                })
            }

            onSave()
        } catch (err: any) {
            setError(err.message || t('sections.saveError', 'Failed to save section'))
        } finally {
            setLoading(false)
        }
    }

    const handleClose = () => {
        setName('')
        setDescription('')
        setError(null)
        onClose()
    }

    return (
        <Dialog open={open} onClose={handleClose} maxWidth='sm' fullWidth>
            <DialogTitle>{section ? t('sections.editSection', 'Edit Section') : t('sections.createSection', 'Create Section')}</DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    <TextField
                        label={t('sections.name', 'Name')}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        fullWidth
                        required
                        error={!!error && !(name || '').trim()}
                        helperText={error && !(name || '').trim() ? error : ''}
                    />
                    <TextField
                        label={t('sections.description', 'Description')}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        fullWidth
                        multiline
                        rows={3}
                    />
                    {error && (name || '').trim() && (
                        <Typography color='error' variant='body2'>
                            {error}
                        </Typography>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={isLoading}>
                    {t('common.cancel', 'Cancel')}
                </Button>
                <Button onClick={handleSave} variant='contained' disabled={isLoading || !(name || '').trim()}>
                    {isLoading ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default SectionDialog
