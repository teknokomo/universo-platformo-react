import PropTypes from 'prop-types'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from '@universo/i18n/hooks'

// material-ui
import { IconButton } from '@mui/material'
import { IconEdit } from '@tabler/icons-react'

// project imports
import { AsyncDropdown } from '../dropdown/AsyncDropdown'
import AddEditCredentialDialog from '../dialogs/AddEditCredentialDialog'
import CredentialListDialog from '../dialogs/CredentialListDialog'

// API
import { api } from '@universo/api-client' // Replaced: import credentialsApi from '../../api/credentials'

const CredentialInputHandler = ({ inputParam, data, onSelect, disabled = false }) => {
    const ref = useRef(null)
    const { unikId } = useParams()
    const { t } = useTranslation('canvas')
    const [credentialId, setCredentialId] = useState(data?.credential ?? '')
    const [showCredentialListDialog, setShowCredentialListDialog] = useState(false)
    const [credentialListDialogProps, setCredentialListDialogProps] = useState({})
    const [showSpecificCredentialDialog, setShowSpecificCredentialDialog] = useState(false)
    const [specificCredentialDialogProps, setSpecificCredentialDialogProps] = useState({})
    const [reloadTimestamp, setReloadTimestamp] = useState(Date.now().toString())

    const editCredential = (id) => {
        const dialogProp = {
            type: 'EDIT',
            cancelButtonName: t('common.cancel'),
            confirmButtonName: t('common.save'),
            credentialId: id,
            unikId
        }
        setSpecificCredentialDialogProps(dialogProp)
        setShowSpecificCredentialDialog(true)
    }

    const addAsyncOption = async () => {
        try {
            const names = inputParam.credentialNames.length > 1 ? inputParam.credentialNames.join('&') : inputParam.credentialNames[0]
            const response = await api.credentials.getSpecificComponentCredential(names)
            if (!response?.data) return

            if (Array.isArray(response.data)) {
                setCredentialListDialogProps({
                    title: t('credentials.addNew'),
                    componentsCredentials: response.data
                })
                setShowCredentialListDialog(true)
            } else {
                setSpecificCredentialDialogProps({
                    type: 'ADD',
                    cancelButtonName: t('common.cancel'),
                    confirmButtonName: t('common.add'),
                    credentialComponent: response.data,
                    unikId
                })
                setShowSpecificCredentialDialog(true)
            }
        } catch (error) {
            console.error('[spaces-frt][CredentialInputHandler] Failed to load credentials', error)
        }
    }

    const onConfirmAsyncOption = (selectedCredentialId = '') => {
        setCredentialId(selectedCredentialId)
        setReloadTimestamp(Date.now().toString())
        setSpecificCredentialDialogProps({})
        setShowSpecificCredentialDialog(false)
        onSelect(selectedCredentialId)
    }

    const onCredentialSelected = (credentialComponent) => {
        setShowCredentialListDialog(false)
        setSpecificCredentialDialogProps({
            type: 'ADD',
            cancelButtonName: t('common.cancel'),
            confirmButtonName: t('common.add'),
            credentialComponent,
            unikId
        })
        setShowSpecificCredentialDialog(true)
    }

    useEffect(() => {
        setCredentialId(data?.credential ?? '')
    }, [data])

    return (
        <div ref={ref}>
            {inputParam?.type === 'credential' && (
                <div key={reloadTimestamp} style={{ display: 'flex', flexDirection: 'row' }}>
                    <AsyncDropdown
                        disabled={disabled}
                        name={inputParam.name}
                        nodeData={data}
                        value={credentialId ?? t('credentials.chooseAnOption')}
                        isCreateNewOption
                        credentialNames={inputParam.credentialNames}
                        onSelect={(newValue) => {
                            setCredentialId(newValue)
                            onSelect(newValue)
                        }}
                        onCreateNew={() => addAsyncOption(inputParam.name)}
                        unikId={unikId}
                    />
                    {credentialId && (
                        <IconButton title={t('common.edit')} color='primary' size='small' onClick={() => editCredential(credentialId)}>
                            <IconEdit />
                        </IconButton>
                    )}
                </div>
            )}

            {showSpecificCredentialDialog && (
                <AddEditCredentialDialog
                    show={showSpecificCredentialDialog}
                    dialogProps={specificCredentialDialogProps}
                    onCancel={() => setShowSpecificCredentialDialog(false)}
                    onConfirm={onConfirmAsyncOption}
                />
            )}

            {showCredentialListDialog && (
                <CredentialListDialog
                    show={showCredentialListDialog}
                    dialogProps={credentialListDialogProps}
                    onCancel={() => setShowCredentialListDialog(false)}
                    onCredentialSelected={onCredentialSelected}
                />
            )}
        </div>
    )
}

CredentialInputHandler.propTypes = {
    inputParam: PropTypes.object,
    data: PropTypes.object,
    onSelect: PropTypes.func,
    disabled: PropTypes.bool
}

export default CredentialInputHandler
