import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from '@universo/i18n'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@flowise/store'

import {
    Box,
    Typography,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    IconButton,
    OutlinedInput,
    Popover
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { StyledButton } from '@flowise/template-mui'

// Icons
import { IconX, IconCopy } from '@tabler/icons-react'

// API
import { api } from '@universo/api-client' // Replaced import apikeyApi from '@/api/apikey'

// utils
import { useNotifier } from '@flowise/template-mui/hooks'

const APIKeyDialog = ({ show, dialogProps, onCancel, onConfirm, setError }) => {
    const portalElement = document.getElementById('portal')
    const { t } = useTranslation()

    const theme = useTheme()
    const dispatch = useDispatch()

    // ==============================|| Snackbar ||============================== //

    useNotifier()

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const [keyName, setKeyName] = useState('')
    const [anchorEl, setAnchorEl] = useState(null)
    const openPopOver = Boolean(anchorEl)

    useEffect(() => {
        if (dialogProps.type === 'EDIT' && dialogProps.key) {
            setKeyName(dialogProps.key.keyName)
        } else if (dialogProps.type === 'ADD') {
            setKeyName('')
        }
    }, [dialogProps])

    const handleClosePopOver = () => {
        setAnchorEl(null)
    }

    const addNewKey = async () => {
        try {
            const createResp = await api.apiKeys.createNewAPI(dialogProps.unikId, { keyName })
            if (createResp.data) {
                enqueueSnackbar({
                    message: t('apiKeys:messages.newKeyAdded'),
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'success',
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                <IconX />
                            </Button>
                        )
                    }
                })
                onConfirm()
            }
        } catch (error) {
            if (setError) setError(error)
            enqueueSnackbar({
                message: t('apiKeys:messages.addKeyError', {
                    error: typeof error.response.data === 'object' ? error.response.data.message : error.response.data
                }),
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error',
                    persist: true,
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            <IconX />
                        </Button>
                    )
                }
            })
            onCancel()
        }
    }

    const saveKey = async () => {
        try {
            const saveResp = await api.apiKeys.updateAPI(dialogProps.unikId, dialogProps.key.id, { keyName })
            if (saveResp.data) {
                enqueueSnackbar({
                    message: t('apiKeys:messages.keySaved'),
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'success',
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                <IconX />
                            </Button>
                        )
                    }
                })
                onConfirm()
            }
        } catch (error) {
            if (setError) setError(error)
            enqueueSnackbar({
                message: t('apiKeys:messages.saveKeyError', {
                    error: typeof error.response.data === 'object' ? error.response.data.message : error.response.data
                }),
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error',
                    persist: true,
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            <IconX />
                        </Button>
                    )
                }
            })
            onCancel()
        }
    }

    const component = show ? (
        <Dialog
            fullWidth
            maxWidth='sm'
            open={show}
            onClose={onCancel}
            aria-labelledby='alert-dialog-title'
            aria-describedby='alert-dialog-description'
        >
            <DialogTitle sx={{ fontSize: '1rem' }} id='alert-dialog-title'>
                {dialogProps.title}
            </DialogTitle>
            <DialogContent>
                {dialogProps.type === 'EDIT' && (
                    <Box sx={{ p: 2 }}>
                        <Typography variant='overline'>{t('apiKeys:grid.apiKey')}</Typography>
                        <Stack direction='row' sx={{ mb: 1 }}>
                            <Typography
                                sx={{
                                    p: 1,
                                    borderRadius: 10,
                                    backgroundColor: theme.palette.primary.light,
                                    width: 'max-content',
                                    height: 'max-content'
                                }}
                                variant='h5'
                            >
                                {dialogProps.key.apiKey}
                            </Typography>
                            <IconButton
                                title={t('apiKeys:buttonTitles.copy')}
                                color='success'
                                onClick={(event) => {
                                    navigator.clipboard.writeText(dialogProps.key.apiKey)
                                    setAnchorEl(event.currentTarget)
                                    setTimeout(() => {
                                        handleClosePopOver()
                                    }, 1500)
                                }}
                            >
                                <IconCopy />
                            </IconButton>
                            <Popover
                                open={openPopOver}
                                anchorEl={anchorEl}
                                onClose={handleClosePopOver}
                                anchorOrigin={{
                                    vertical: 'top',
                                    horizontal: 'right'
                                }}
                                transformOrigin={{
                                    vertical: 'top',
                                    horizontal: 'left'
                                }}
                            >
                                <Typography variant='h6' sx={{ pl: 1, pr: 1, color: 'white', background: theme.palette.success.dark }}>
                                    {t('apiKeys:copied')}
                                </Typography>
                            </Popover>
                        </Stack>
                    </Box>
                )}

                <Box sx={{ p: 2 }}>
                    <Stack sx={{ position: 'relative' }} direction='row'>
                        <Typography variant='overline'>{t('apiKeys:grid.keyName')}</Typography>
                    </Stack>
                    <OutlinedInput
                        id='keyName'
                        type='string'
                        fullWidth
                        placeholder={t('apiKeys:placeholders.keyName')}
                        value={keyName}
                        name='keyName'
                        onChange={(e) => setKeyName(e.target.value)}
                    />
                </Box>
            </DialogContent>
            <DialogActions>
                <StyledButton
                    variant='contained'
                    onClick={() => (dialogProps.type === 'ADD' ? addNewKey() : saveKey())}
                    id={dialogProps.customBtnId}
                >
                    {dialogProps.confirmButtonName}
                </StyledButton>
            </DialogActions>
        </Dialog>
    ) : null

    return createPortal(component, portalElement)
}

APIKeyDialog.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onCancel: PropTypes.func,
    onConfirm: PropTypes.func,
    setError: PropTypes.func
}

export default APIKeyDialog
