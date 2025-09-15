import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { useState, useEffect } from 'react'
import { Box, Typography, Dialog, DialogActions, DialogContent, DialogTitle, OutlinedInput } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { StyledButton } from '@ui/ui-component/button/StyledButton'
import api from '@ui/api'
import { useTranslation } from 'react-i18next'

// Universo Platformo | Local API module for Unik, using the base axios instance
const uniksApi = {
    createUnik: (data) => api.post('/uniks', data),
    updateUnik: (id, data) => api.put(`/unik/${id}`, data)
}

const UnikDialog = ({ show, dialogProps, onCancel, onConfirm, setError }) => {
    const portalElement = document.getElementById('portal')
    const theme = useTheme()
    const { t } = useTranslation('uniks')
    const [unikName, setUnikName] = useState('')

    useEffect(() => {
        if (dialogProps.type === 'EDIT' && dialogProps.unik) {
            setUnikName(dialogProps.unik.name)
        } else if (dialogProps.type === 'ADD') {
            setUnikName('')
        }
    }, [dialogProps])

    const createUnik = async () => {
        try {
            const response = await uniksApi.createUnik({ name: unikName })
            if (response.data) {
                onConfirm(response.data)
            }
        } catch (error) {
            setError(error)
            onCancel()
        }
    }

    const updateUnik = async () => {
        try {
            const response = await uniksApi.updateUnik(dialogProps.unik.id, { name: unikName })
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
            createUnik()
        } else if (dialogProps.type === 'EDIT') {
            updateUnik()
        }
    }

    const component = show ? (
        <Dialog fullWidth maxWidth='sm' open={show} onClose={onCancel} aria-labelledby='unik-dialog-title'>
            <DialogTitle id='unik-dialog-title' sx={{ fontSize: '1rem' }}>
                {dialogProps.title}
            </DialogTitle>
            <DialogContent>
                <Box sx={{ p: 2 }}>
                    <Typography variant='overline'>{t('name')}</Typography>
                    <OutlinedInput
                        id='unikName'
                        type='text'
                        fullWidth
                        placeholder={t('namePlaceholder')}
                        value={unikName}
                        onChange={(e) => setUnikName(e.target.value)}
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

UnikDialog.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onCancel: PropTypes.func,
    onConfirm: PropTypes.func,
    setError: PropTypes.func
}

export default UnikDialog
