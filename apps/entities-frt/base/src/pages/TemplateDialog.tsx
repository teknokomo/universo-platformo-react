import React, { useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import useApi from 'flowise-ui/src/hooks/useApi'
import { ResourceConfigTree } from '@universo/resources-frt'
import { createTemplate } from '../api/entities'

interface TemplateDialogProps {
    open: boolean
    onClose: () => void
}

const TemplateDialog: React.FC<TemplateDialogProps> = ({ open, onClose }) => {
    const { t } = useTranslation('entities')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const createApi = useApi(createTemplate)

    const handleSave = async () => {
        await createApi.request({ name, description })
        if (!createApi.error) onClose()
    }

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth='md'>
            <DialogTitle>{t('templates.dialog.title')}</DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField label={t('templates.dialog.name')} value={name} onChange={(e) => setName(e.target.value)} fullWidth />
                <TextField
                    label={t('templates.dialog.description')}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    fullWidth
                    multiline
                />
                <ResourceConfigTree />
                {createApi.error && <Typography color='error'>{t('templates.dialog.error')}</Typography>}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('templates.dialog.cancel')}</Button>
                <Button variant='contained' onClick={handleSave} disabled={createApi.loading}>
                    {t('templates.dialog.save')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default TemplateDialog
