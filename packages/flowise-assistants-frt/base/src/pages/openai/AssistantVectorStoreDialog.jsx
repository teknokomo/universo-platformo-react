import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { useState, useEffect } from 'react'
import { omit } from 'lodash'
import { useDispatch } from 'react-redux'
import { useParams } from 'react-router-dom'
import { useTranslation } from '@universo/i18n'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@flowise/store'

// Material
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Box, Stack, OutlinedInput, Typography } from '@mui/material'

// Project imports
import { StyledButton } from '@flowise/template-mui'
import { ConfirmDialog } from '@flowise/template-mui'
import { SwitchInput } from '@flowise/template-mui'
import { Dropdown } from '@flowise/template-mui'
import { BackdropLoader } from '@flowise/template-mui'

// Icons
import { IconX } from '@tabler/icons-react'

// API
import { api } from '@universo/api-client' // Replaced import assistantsApi from '@/api/assistants'

// Hooks
import useApi from '@flowise/template-mui/hooks/useApi'

// utils
import { useNotifier } from '@flowise/template-mui/hooks'
import { formatBytes } from '@universo/utils/ui-utils/genericHelper'

// const
import { HIDE_CANVAS_DIALOG, SHOW_CANVAS_DIALOG } from '@flowise/store'

const AssistantVectorStoreDialog = ({ show, dialogProps, onCancel, onConfirm, onDelete, setError }) => {
    const portalElement = document.getElementById('portal')
    const { unikId } = useParams()
    const { t } = useTranslation()

    const dispatch = useDispatch()

    // ==============================|| Snackbar ||============================== //

    useNotifier()

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const getVectorStoreApi = useApi((...args) => api.assistants.getVectorStore(...args))
    const listVectorStoresApi = useApi((...args) => api.assistants.listVectorStores(...args))

    const [name, setName] = useState('')
    const [isExpirationOn, setExpirationOnOff] = useState(false)
    const [expirationDays, setExpirationDays] = useState(7)
    const [availableVectorStoreOptions, setAvailableVectorStoreOptions] = useState([{ label: t('assistants:vectorStore.createNew'), name: '-create-' }])
    const [selectedVectorStore, setSelectedVectorStore] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (getVectorStoreApi.data) {
            if (getVectorStoreApi.data.name) {
                setName(getVectorStoreApi.data.name)
            } else {
                setName('')
            }

            if (getVectorStoreApi.data.id) {
                setSelectedVectorStore(getVectorStoreApi.data.id)
            } else {
                setSelectedVectorStore('')
            }

            if (getVectorStoreApi.data.expires_after && getVectorStoreApi.data.expires_after.days) {
                setExpirationDays(getVectorStoreApi.data.expires_after.days)
                setExpirationOnOff(true)
            } else {
                setExpirationDays(7)
                setExpirationOnOff(false)
            }
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getVectorStoreApi.data])

    useEffect(() => {
        if (listVectorStoresApi.data) {
            let vectorStores = []
            for (let i = 0; i < listVectorStoresApi.data.length; i += 1) {
                vectorStores.push({
                    label: listVectorStoresApi.data[i]?.name ?? listVectorStoresApi.data[i].id,
                    name: listVectorStoresApi.data[i].id,
                    description: `${listVectorStoresApi.data[i]?.file_counts?.total} ${t('assistants:vectorStore.files')} (${formatBytes(
                        listVectorStoresApi.data[i]?.usage_bytes
                    )})`
                })
            }
            vectorStores = vectorStores.filter((vs) => vs.name !== '-create-')
            vectorStores.unshift({ label: t('assistants:vectorStore.createNew'), name: '-create-' })
            setAvailableVectorStoreOptions(vectorStores)
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listVectorStoresApi.data])

    useEffect(() => {
        if (getVectorStoreApi.error && setError) {
            setError(getVectorStoreApi.error)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getVectorStoreApi.error])

    useEffect(() => {
        if (dialogProps.type === 'EDIT' && dialogProps.data) {
            getVectorStoreApi.request(unikId, dialogProps.data.id, dialogProps.credential)
            listVectorStoresApi.request(unikId, dialogProps.credential)
        } else if (dialogProps.type === 'ADD') {
            listVectorStoresApi.request(unikId, dialogProps.credential)
        }

        return () => {
            setName('')
            setExpirationOnOff(false)
            setExpirationDays(7)
            setSelectedVectorStore('')
            setAvailableVectorStoreOptions([{ label: t('assistants:vectorStore.createNew'), name: '-create-' }])
            setLoading(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dialogProps, unikId])

    useEffect(() => {
        if (show) dispatch({ type: SHOW_CANVAS_DIALOG })
        else dispatch({ type: HIDE_CANVAS_DIALOG })
        return () => dispatch({ type: HIDE_CANVAS_DIALOG })
    }, [show, dispatch])

    const deleteVectorStore = async () => {
        setLoading(true)
        try {
            await api.assistants.deleteVectorStore(unikId, selectedVectorStore, dialogProps.credential)
            enqueueSnackbar({
                message: t('assistants:vectorStore.deleteSuccess'),
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
            onDelete(selectedVectorStore)
            setLoading(false)
        } catch (error) {
            if (setError) setError(error)
            enqueueSnackbar({
                message: t('assistants:vectorStore.deleteError', {
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
            setLoading(false)
            onCancel()
        }
    }

    const addNewVectorStore = async () => {
        setLoading(true)
        try {
            const obj = {
                name: name !== '' ? name : null,
                expires_after: isExpirationOn ? { anchor: 'last_active_at', days: parseFloat(expirationDays) } : null
            }
            const createResp = await api.assistants.createVectorStore(unikId, dialogProps.credential, obj)
            enqueueSnackbar({
                message: t('assistants:vectorStore.addSuccess'),
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
            onConfirm(createResp)
            setLoading(false)
        } catch (error) {
            if (setError) setError(error)
            enqueueSnackbar({
                message: t('assistants:vectorStore.addError', {
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
            setLoading(false)
            onCancel()
        }
    }

    const saveVectorStore = async (selectedVectorStoreId) => {
        setLoading(true)
        try {
            const saveObj = {
                name: name !== '' ? name : null,
                expires_after: isExpirationOn ? { anchor: 'last_active_at', days: parseFloat(expirationDays) } : null
            }
            const saveResp = await api.assistants.updateVectorStore(unikId, selectedVectorStoreId, dialogProps.credential, saveObj)
            enqueueSnackbar({
                message: t('assistants:vectorStore.saveSuccess'),
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
            if ('files' in saveResp) {
                const files = saveResp.files
                onConfirm(omit(saveResp, ['files']), files)
            } else {
                onConfirm(saveResp)
            }
            setLoading(false)
        } catch (error) {
            if (setError) setError(error)
            enqueueSnackbar({
                message: t('assistants:vectorStore.saveError', {
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
            setLoading(false)
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
                <Box sx={{ p: 2 }}>
                    <Stack sx={{ position: 'relative' }} direction='row'>
                        <Typography variant='overline'>
                            {t('assistants:vectorStore.selectVectorStore')}
                            <span style={{ color: 'red' }}>&nbsp;*</span>
                        </Typography>
                    </Stack>
                    <Dropdown
                        name={selectedVectorStore}
                        options={availableVectorStoreOptions}
                        loading={listVectorStoresApi.loading}
                        onSelect={(newValue) => {
                            setSelectedVectorStore(newValue)
                            if (newValue === '-create-') {
                                setName('')
                                setExpirationOnOff(false)
                                setExpirationDays(7)
                            } else {
                                getVectorStoreApi.request(unikId, newValue, dialogProps.credential)
                            }
                        }}
                        value={selectedVectorStore ?? 'choose an option'}
                    />
                </Box>

                {selectedVectorStore !== '' && (
                    <>
                        <Box sx={{ p: 2 }}>
                            <Stack sx={{ position: 'relative' }} direction='row'>
                                <Typography variant='overline'>{t('assistants:vectorStore.name')}</Typography>
                            </Stack>
                            <OutlinedInput
                                id='vsName'
                                type='string'
                                fullWidth
                                placeholder={t('assistants:vectorStore.myVectorStore')}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </Box>

                        <Box sx={{ p: 2 }}>
                            <Stack sx={{ position: 'relative' }} direction='row'>
                                <Typography variant='overline'>{t('assistants:vectorStore.expiration')}</Typography>
                            </Stack>
                            <SwitchInput onChange={(newValue) => setExpirationOnOff(newValue)} value={isExpirationOn} />
                        </Box>

                        {isExpirationOn && (
                            <Box sx={{ p: 2 }}>
                                <Stack sx={{ position: 'relative' }} direction='row'>
                                    <Typography variant='overline'>
                                        {t('assistants:vectorStore.expirationDays')}
                                        <span style={{ color: 'red' }}>&nbsp;*</span>
                                    </Typography>
                                </Stack>
                                <OutlinedInput
                                    id='expDays'
                                    type='number'
                                    fullWidth
                                    value={expirationDays}
                                    onChange={(e) => setExpirationDays(e.target.value)}
                                />
                            </Box>
                        )}
                    </>
                )}
            </DialogContent>
            <DialogActions>
                {dialogProps.type === 'EDIT' && (
                    <StyledButton color='error' variant='contained' onClick={() => deleteVectorStore()}>
                        {t('assistants:common.delete')}
                    </StyledButton>
                )}
                <StyledButton
                    disabled={!selectedVectorStore}
                    variant='contained'
                    onClick={() => (selectedVectorStore === '-create-' ? addNewVectorStore() : saveVectorStore(selectedVectorStore))}
                >
                    {dialogProps.confirmButtonName}
                </StyledButton>
            </DialogActions>
            <ConfirmDialog />
            {loading && <BackdropLoader open={loading} />}
        </Dialog>
    ) : null

    return createPortal(component, portalElement)
}

AssistantVectorStoreDialog.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onCancel: PropTypes.func,
    onConfirm: PropTypes.func,
    onDelete: PropTypes.func,
    setError: PropTypes.func
}

export default AssistantVectorStoreDialog
