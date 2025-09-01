import React, { useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material'
import { useTranslation } from 'react-i18next'
import useApi from 'flowise-ui/src/hooks/useApi'
import ResourceConfigTree, { ResourceNode } from '../components/ResourceConfigTree'
import { createResource } from '../api/resources'

interface ResourceDialogProps {
    open: boolean
    onClose: () => void
}

const ResourceDialog: React.FC<ResourceDialogProps> = ({ open, onClose }) => {
    const { t } = useTranslation('resources')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [nodes, setNodes] = useState<ResourceNode[]>([])
    const createApi = useApi(createResource)

    const handleSave = async () => {
        const serialize = (list: ResourceNode[]): any[] => list.map((n) => ({ id: n.resourceId, children: serialize(n.children) }))
        await createApi.request({ titleEn: name, titleRu: name, description, tree: serialize(nodes) })
        if (!createApi.error) onClose()
    }

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth='md'>
            <DialogTitle>{t('dialog.title')}</DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField label={t('dialog.name')} fullWidth value={name} onChange={(e) => setName(e.target.value)} />
                <TextField
                    label={t('dialog.description')}
                    fullWidth
                    multiline
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
                <ResourceConfigTree nodes={nodes} onChange={setNodes} />
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

export default ResourceDialog
