import React, { useState, useEffect } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, MenuItem, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import useApi from 'flowise-ui/src/hooks/useApi'
import { ResourceConfigTree } from '@universo/resources-frt'
import { createEntity, listTemplates } from '../api/entities'

interface EntityDialogProps {
    open: boolean
    onClose: () => void
}

const EntityDialog: React.FC<EntityDialogProps> = ({ open, onClose }) => {
    const { t } = useTranslation('entities')
    const [name, setName] = useState('')
    const [template, setTemplate] = useState('')
    const [templates, setTemplates] = useState<string[]>([])
    const createApi = useApi(createEntity)
    const templatesApi = useApi(listTemplates)

    useEffect(() => {
        if (open) templatesApi.request()
    }, [open, templatesApi])

    useEffect(() => {
        if (templatesApi.data) setTemplates((templatesApi.data as any).map((t: any) => t.name))
    }, [templatesApi.data])

    const handleSave = async () => {
        await createApi.request({ name, template })
        if (!createApi.error) onClose()
    }

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth='md'>
            <DialogTitle>{t('dialog.title')}</DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField label={t('dialog.name')} value={name} onChange={(e) => setName(e.target.value)} fullWidth />
                <TextField select label={t('dialog.template')} value={template} onChange={(e) => setTemplate(e.target.value)}>
                    {templates.map((tName) => (
                        <MenuItem key={tName} value={tName}>
                            {tName}
                        </MenuItem>
                    ))}
                </TextField>
                <ResourceConfigTree />
                <TextField label={t('dialog.owners')} fullWidth />
                {createApi.error && <Typography color='error'>{t('dialog.error')}</Typography>}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('dialog.cancel')}</Button>
                <Button variant='contained' onClick={handleSave} disabled={createApi.loading}>
                    {t('dialog.save')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default EntityDialog
