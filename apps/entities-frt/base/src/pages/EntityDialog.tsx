import React, { useState, useEffect } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, MenuItem, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import useApi from 'flowise-ui/src/hooks/useApi'
import { ResourceConfigTree } from '@universo/resources-frt'
import { createEntity, listTemplates, listStatuses } from '../api/entities'

interface EntityDialogProps {
    open: boolean
    onClose: () => void
}

const EntityDialog: React.FC<EntityDialogProps> = ({ open, onClose }) => {
    const { t } = useTranslation('entities')
    const [titleEn, setTitleEn] = useState('')
    const [titleRu, setTitleRu] = useState('')
    const [templateId, setTemplateId] = useState('')
    const [statusId, setStatusId] = useState('')
    const [templates, setTemplates] = useState<any[]>([])
    const [statuses, setStatuses] = useState<any[]>([])
    const createApi = useApi(createEntity)
    const templatesApi = useApi(listTemplates)
    const statusesApi = useApi(listStatuses)

    useEffect(() => {
        if (open) {
            templatesApi.request()
            statusesApi.request()
        }
    }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (templatesApi.data) setTemplates(templatesApi.data as any)
    }, [templatesApi.data])

    useEffect(() => {
        if (statusesApi.data) setStatuses(statusesApi.data as any)
    }, [statusesApi.data])

    const handleSave = async () => {
        await createApi.request({ titleEn, titleRu, templateId, statusId })
        if (!createApi.error) onClose()
    }

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth='md'>
            <DialogTitle>{t('dialog.title')}</DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField label={t('dialog.titleEn')} value={titleEn} onChange={(e) => setTitleEn(e.target.value)} fullWidth />
                <TextField label={t('dialog.titleRu')} value={titleRu} onChange={(e) => setTitleRu(e.target.value)} fullWidth />
                <TextField select label={t('dialog.template')} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                    {templates.map((t) => (
                        <MenuItem key={t.id} value={t.id}>
                            {t.name}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField select label={t('dialog.status')} value={statusId} onChange={(e) => setStatusId(e.target.value)}>
                    {statuses.map((s) => (
                        <MenuItem key={s.id} value={s.id}>
                            {s.name}
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
