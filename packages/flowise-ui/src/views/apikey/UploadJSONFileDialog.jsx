import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from '@universo/i18n'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@flowise/store'

// Material
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Box, Typography, Stack } from '@mui/material'

// Project imports
import { StyledButton } from '@flowise/template-mui'
import { ConfirmDialog } from '@flowise/template-mui'
import { File } from '@flowise/template-mui'

// Icons
import { IconFileUpload, IconX } from '@tabler/icons-react'

// API
import apikeyAPI from '@/api/apikey'

// utils
import { useNotifier } from '@flowise/template-mui/hooks'

// const
import { HIDE_CANVAS_DIALOG, SHOW_CANVAS_DIALOG } from '@flowise/store'
import { Dropdown } from '@flowise/template-mui'

const importModes = [
    {
        label: 'Add & Overwrite',
        name: 'overwriteIfExist',
        description: 'Add keys and overwrite existing keys with the same name'
    },
    {
        label: 'Add & Ignore',
        name: 'ignoreIfExist',
        description: 'Add keys and ignore existing keys with the same name'
    },
    {
        label: 'Add & Verify',
        name: 'errorIfExist',
        description: 'Add Keys and throw error if key with same name exists'
    },
    {
        label: 'Replace All',
        name: 'replaceAll',
        description: 'Replace all keys with the imported keys'
    }
]

const UploadJSONFileDialog = ({ show, dialogProps, onCancel, onConfirm }) => {
    const portalElement = document.getElementById('portal')
    const { t } = useTranslation('api-keys')

    const dispatch = useDispatch()

    // ==============================|| Snackbar ||============================== //

    useNotifier()

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const [selectedFile, setSelectedFile] = useState()
    const [importMode, setImportMode] = useState('overwrite')

    useEffect(() => {
        return () => {
            setSelectedFile()
        }
    }, [dialogProps])

    useEffect(() => {
        if (show) dispatch({ type: SHOW_CANVAS_DIALOG })
        else dispatch({ type: HIDE_CANVAS_DIALOG })
        return () => dispatch({ type: HIDE_CANVAS_DIALOG })
    }, [show, dispatch])

    const importKeys = async () => {
        try {
            const obj = {
                importMode: importMode,
                jsonFile: selectedFile
            }
            const createResp = await apikeyAPI.importAPI(dialogProps.unikId, obj)
            if (createResp.data) {
                enqueueSnackbar({
                    message: t('apiKeys.messages.importSuccess'),
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
                onConfirm(createResp.data.id)
            }
        } catch (error) {
            enqueueSnackbar({
                message: t('apiKeys.messages.importError', {
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
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <IconFileUpload style={{ marginRight: '10px' }} />
                    {t('apiKeys.import')}
                </div>
            </DialogTitle>
            <DialogContent>
                <Box sx={{ p: 2 }}>
                    <Stack sx={{ position: 'relative' }} direction='row'>
                        <Typography variant='overline'>
                            {t('apiKeys.importFile')}
                            <span style={{ color: 'red' }}>&nbsp;*</span>
                        </Typography>
                    </Stack>
                    <File
                        disabled={false}
                        fileType='.json'
                        onChange={(newValue) => setSelectedFile(newValue)}
                        value={selectedFile ?? t('apiKeys.chooseFile')}
                    />
                </Box>
                <Box sx={{ p: 2 }}>
                    <Stack sx={{ position: 'relative' }} direction='row'>
                        <Typography variant='overline'>
                            {t('apiKeys.importMode')}
                            <span style={{ color: 'red' }}>&nbsp;*</span>
                        </Typography>
                    </Stack>
                    <Dropdown
                        key={importMode}
                        name={importMode}
                        options={importModes}
                        onSelect={(newValue) => setImportMode(newValue)}
                        value={importMode ?? t('apiKeys.chooseOption')}
                    />
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => onCancel()}>{dialogProps.cancelButtonName}</Button>
                <StyledButton disabled={!selectedFile} variant='contained' onClick={importKeys}>
                    {dialogProps.confirmButtonName}
                </StyledButton>
            </DialogActions>
            <ConfirmDialog />
        </Dialog>
    ) : null

    return createPortal(component, portalElement)
}

UploadJSONFileDialog.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onCancel: PropTypes.func,
    onConfirm: PropTypes.func
}

export default UploadJSONFileDialog
