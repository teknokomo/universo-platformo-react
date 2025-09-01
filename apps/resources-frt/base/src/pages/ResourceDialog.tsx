import React from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material'
import { useTranslation } from 'react-i18next'
import ResourceConfigTree from '../components/ResourceConfigTree'

interface ResourceDialogProps {
    open: boolean
    onClose: () => void
}

const ResourceDialog: React.FC<ResourceDialogProps> = ({ open, onClose }) => {
    const { t } = useTranslation('resources')
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth='md'>
            <DialogTitle>{t('dialog.title')}</DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField label={t('dialog.name')} fullWidth />
                <TextField label={t('dialog.description')} fullWidth multiline />
                <ResourceConfigTree />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('dialog.cancel')}</Button>
                <Button variant='contained'>{t('dialog.save')}</Button>
            </DialogActions>
        </Dialog>
    )
}

export default ResourceDialog
