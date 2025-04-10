import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@/store/actions'
import { useTranslation } from 'react-i18next'

// Material
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Box, Typography, OutlinedInput } from '@mui/material'

// Project imports
import { StyledButton } from '@/ui-component/button/StyledButton'
import ConfirmDialog from '@/ui-component/dialog/ConfirmDialog'

// Icons
import { IconX, IconVariable } from '@tabler/icons-react'

// API
import variablesApi from '@/api/variables'

// Hooks

// utils
import useNotifier from '@/utils/useNotifier'

// const
import { HIDE_CANVAS_DIALOG, SHOW_CANVAS_DIALOG } from '@/store/actions'
import { Dropdown } from '@/ui-component/dropdown/Dropdown'

const AddEditVariableDialog = ({ show, dialogProps, onCancel, onConfirm, setError }) => {
    const portalElement = document.getElementById('portal')
    const dispatch = useDispatch()
    const { t } = useTranslation('variables')

    // ==============================|| Snackbar ||============================== //

    useNotifier()

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const [variableName, setVariableName] = useState('')
    const [variableValue, setVariableValue] = useState('')
    const [variableType, setVariableType] = useState('static')
    const [dialogType, setDialogType] = useState('ADD')
    const [variable, setVariable] = useState({})

    const variableTypes = [
        {
            label: 'Static',
            name: 'static',
            description: t('variables.typeDescriptions.static')
        },
        {
            label: 'Runtime',
            name: 'runtime',
            description: t('variables.typeDescriptions.runtime')
        }
    ]

    useEffect(() => {
        if (dialogProps.type === 'EDIT' && dialogProps.data) {
            setVariableName(dialogProps.data.name)
            setVariableValue(dialogProps.data.value)
            setVariableType(dialogProps.data.type)
            setDialogType('EDIT')
            setVariable(dialogProps.data)
        } else if (dialogProps.type === 'ADD') {
            setVariableName('')
            setVariableValue('')
            setVariableType('static')
            setDialogType('ADD')
            setVariable({})
        }

        return () => {
            setVariableName('')
            setVariableValue('')
            setVariableType('static')
            setDialogType('ADD')
            setVariable({})
        }
    }, [dialogProps])

    useEffect(() => {
        if (show) dispatch({ type: SHOW_CANVAS_DIALOG })
        else dispatch({ type: HIDE_CANVAS_DIALOG })
        return () => dispatch({ type: HIDE_CANVAS_DIALOG })
    }, [show, dispatch])

    const addNewVariable = async () => {
        try {
            const obj = {
                name: variableName,
                value: variableValue,
                type: variableType
            }
            const createResp = await variablesApi.createVariable(dialogProps.unikId, obj)
            if (createResp.data) {
                enqueueSnackbar({
                    message: t('variables.messages.newVariableAdded'),
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
        } catch (err) {
            if (setError) setError(err)
            enqueueSnackbar({
                message: t('variables.messages.addError', {
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

    const saveVariable = async () => {
        try {
            const saveObj = {
                name: variableName,
                value: variableValue,
                type: variableType
            }

            const saveResp = await variablesApi.updateVariable(dialogProps.unikId, variable.id, saveObj)
            if (saveResp.data) {
                enqueueSnackbar({
                    message: t('variables.messages.variableSaved'),
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
                onConfirm(saveResp.data.id)
            }
        } catch (error) {
            if (setError) setError(err)
            enqueueSnackbar({
                message: t('variables.messages.saveError', {
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
                    <IconVariable style={{ marginRight: '10px' }} />
                    {dialogProps.type === 'ADD' ? t('variables.addVariable') : t('variables.editVariable')}
                </div>
            </DialogTitle>
            <DialogContent>
                <Box sx={{ p: 2 }}>
                    <div style={{ display: 'flex', flexDirection: 'row' }}>
                        <Typography>
                            {t('variables.variableName')}<span style={{ color: 'red' }}>&nbsp;*</span>
                        </Typography>

                        <div style={{ flexGrow: 1 }}></div>
                    </div>
                    <OutlinedInput
                        size='small'
                        sx={{ mt: 1 }}
                        type='string'
                        fullWidth
                        key='variableName'
                        onChange={(e) => setVariableName(e.target.value)}
                        value={variableName ?? ''}
                        id='txtInput_variableName'
                    />
                </Box>
                <Box sx={{ p: 2 }}>
                    <div style={{ display: 'flex', flexDirection: 'row' }}>
                        <Typography>
                            {t('variables.type')}<span style={{ color: 'red' }}>&nbsp;*</span>
                        </Typography>
                        <div style={{ flexGrow: 1 }}></div>
                    </div>
                    <Dropdown
                        key={variableType}
                        name='variableType'
                        options={variableTypes}
                        onSelect={(newValue) => setVariableType(newValue)}
                        value={variableType ?? t('variables.chooseOption')}
                        id='dropdown_variableType'
                    />
                </Box>
                {variableType === 'static' && (
                    <Box sx={{ p: 2 }}>
                        <div style={{ display: 'flex', flexDirection: 'row' }}>
                            <Typography>
                                {t('variables.value')}<span style={{ color: 'red' }}>&nbsp;*</span>
                            </Typography>
                            <div style={{ flexGrow: 1 }}></div>
                        </div>
                        <OutlinedInput
                            size='small'
                            sx={{ mt: 1 }}
                            type='string'
                            fullWidth
                            key='variableValue'
                            onChange={(e) => setVariableValue(e.target.value)}
                            value={variableValue ?? ''}
                            id='txtInput_variableValue'
                        />
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <StyledButton
                    disabled={!variableName || !variableType || (variableType === 'static' && !variableValue)}
                    variant='contained'
                    onClick={() => (dialogType === 'ADD' ? addNewVariable() : saveVariable())}
                    id='btn_confirmAddingNewVariable'
                >
                    {dialogProps.confirmButtonName}
                </StyledButton>
            </DialogActions>
            <ConfirmDialog />
        </Dialog>
    ) : null

    return createPortal(component, portalElement)
}

AddEditVariableDialog.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onCancel: PropTypes.func,
    onConfirm: PropTypes.func,
    setError: PropTypes.func
}

export default AddEditVariableDialog
