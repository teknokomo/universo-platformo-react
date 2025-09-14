import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Box, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useApi } from '../hooks/useApi'
import * as metaversesApi from '../api/metaverses'
import { Metaverse } from '../types'

interface MetaverseDialogProps {
    open: boolean
    onClose: () => void
    onSave: () => void
    metaverse?: Metaverse | null
}

const MetaverseDialog: React.FC<MetaverseDialogProps> = ({ open, onClose, onSave, metaverse }) => {
    const { t } = useTranslation('metaverses')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [isLoading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const { request: createMetaverse } = useApi(metaversesApi.createMetaverse)
    const { request: updateMetaverse } = useApi(metaversesApi.updateMetaverse)

    useEffect(() => {
        if (metaverse) {
            setName(metaverse.name)
            setDescription(metaverse.description || '')
        } else {
            setName('')
            setDescription('')
        }
        setError(null)
    }, [metaverse, open])

    const handleSave = async () => {
        if (!(name || '').trim()) {
            setError(t('metaverses.nameRequired', 'Name is required'))
            return
        }

        try {
            setLoading(true)
            setError(null)

            if (metaverse) {
                await updateMetaverse(metaverse.id, { name: (name || '').trim(), description: (description || '').trim() || undefined })
            } else {
                await createMetaverse({ name: (name || '').trim(), description: (description || '').trim() || undefined })
            }

            onSave()
        } catch (err: any) {
            setError(err.message || t('metaverses.saveError', 'Failed to save metaverse'))
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
            <DialogTitle>
                {metaverse ? t('metaverses.editMetaverse', 'Edit Metaverse') : t('metaverses.createMetaverse', 'Create Metaverse')}
            </DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    <TextField
                        label={t('metaverses.name', 'Name')}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        fullWidth
                        required
                        error={!!error && !(name || '').trim()}
                        helperText={error && !(name || '').trim() ? error : ''}
                    />
                    <TextField
                        label={t('metaverses.description', 'Description')}
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

export default MetaverseDialog
