import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { useState, useEffect } from 'react'
import { Box, Typography, Dialog, DialogActions, DialogContent, DialogTitle, OutlinedInput } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { StyledButton } from '../../../../../packages/ui/src/ui-component/button/StyledButton'
import api from '../../../../../packages/ui/src/api'
import { useTranslation } from 'react-i18next'

// Universo Platformo | Local API module for Metaverse, using the base axios instance
const metaverseApi = {
    createMetaverse: (data) => api.post('/metaverses', data),
    updateMetaverse: (id, data) => api.put(`/metaverses/${id}`, data)
}

const MetaverseDialog = ({ show, dialogProps, onCancel, onConfirm, setError }) => {
    const portalElement = document.getElementById('portal')
    const theme = useTheme()
    const { t } = useTranslation('metaverse')
    const [metaverseName, setMetaverseName] = useState('')
    const [metaverseDescription, setMetaverseDescription] = useState('')

    useEffect(() => {
        if (dialogProps.type === 'EDIT' && dialogProps.metaverse) {
            setMetaverseName(dialogProps.metaverse.name)
            setMetaverseDescription(dialogProps.metaverse.description || '')
        } else if (dialogProps.type === 'ADD') {
            setMetaverseName('')
            setMetaverseDescription('')
        }
    }, [dialogProps])

    const createMetaverse = async () => {
        try {
            const payload = { name: metaverseName }
            if (metaverseDescription.trim()) {
                payload.description = metaverseDescription
            }
            const response = await metaverseApi.createMetaverse(payload)
            if (response.data) {
                onConfirm(response.data)
            }
        } catch (error) {
            setError(error)
            onCancel()
        }
    }

    const updateMetaverse = async () => {
        try {
            const payload = { name: metaverseName }
            if (metaverseDescription.trim()) {
                payload.description = metaverseDescription
            }
            const response = await metaverseApi.updateMetaverse(dialogProps.metaverse.id, payload)
            if (response.data) {
                onConfirm(response.data)
            }
        } catch (error) {
            setError(error)
            onCancel()
        }
    }

    const handleConfirm = () => {
        if (dialogProps.type === 'ADD') {
            createMetaverse()
        } else if (dialogProps.type === 'EDIT') {
            updateMetaverse()
        }
    }

    const component = show ? (
        <Dialog fullWidth maxWidth='sm' open={show} onClose={onCancel} aria-labelledby='metaverse-dialog-title'>
            <DialogTitle id='metaverse-dialog-title' sx={{ fontSize: '1rem' }}>
                {dialogProps.title}
            </DialogTitle>
            <DialogContent>
                <Box sx={{ p: 2 }}>
                    <Typography variant='overline'>{t('dialog.name')}</Typography>
                    <OutlinedInput
                        id='metaverseName'
                        type='text'
                        fullWidth
                        placeholder={t('dialog.namePlaceholder')}
                        value={metaverseName}
                        onChange={(e) => setMetaverseName(e.target.value)}
                        sx={{ mb: 2 }}
                    />
                    <Typography variant='overline'>{t('dialog.description')}</Typography>
                    <OutlinedInput
                        id='metaverseDescription'
                        type='text'
                        fullWidth
                        multiline
                        rows={3}
                        placeholder={t('dialog.descriptionPlaceholder')}
                        value={metaverseDescription}
                        onChange={(e) => setMetaverseDescription(e.target.value)}
                    />
                </Box>
            </DialogContent>
            <DialogActions>
                <StyledButton variant='contained' onClick={handleConfirm}>
                    {dialogProps.confirmButtonName}
                </StyledButton>
            </DialogActions>
        </Dialog>
    ) : null

    return createPortal(component, portalElement)
}

MetaverseDialog.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onCancel: PropTypes.func,
    onConfirm: PropTypes.func,
    setError: PropTypes.func
}

export default MetaverseDialog
