import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { useTranslation } from '@universo/i18n/hooks'
import { Stack, Typography, Dialog, DialogContent, DialogTitle, DialogActions, Box } from '@mui/material'
import CredentialInputHandler from '@flowise/template-mui/ui-components/dialogs/CredentialInputHandler'
import { Dropdown } from '@flowise/template-mui'
import { StyledButton } from '@flowise/template-mui'
import { api } from '@universo/api-client' // Replaced import assistantsApi from '@/api/assistants'
import useApi from '@flowise/template-mui/hooks/useApi'
import { useParams } from 'react-router-dom'

const LoadAssistantDialog = ({ show, dialogProps, onCancel, onAssistantSelected, setError }) => {
    const portalElement = document.getElementById('portal')
    const { unikId } = useParams()
    const { t } = useTranslation('assistants')

    const getAllAvailableAssistantsApi = useApi(api.assistants.getAllAvailableAssistants)

    const [credentialId, setCredentialId] = useState('')
    const [availableAssistantsOptions, setAvailableAssistantsOptions] = useState([])
    const [selectedOpenAIAssistantId, setSelectedOpenAIAssistantId] = useState('')

    useEffect(() => {
        return () => {
            setCredentialId('')
            setAvailableAssistantsOptions([])
            setSelectedOpenAIAssistantId('')
        }
    }, [dialogProps])

    useEffect(() => {
        if (getAllAvailableAssistantsApi.data && getAllAvailableAssistantsApi.data.length) {
            const assistants = []
            for (let i = 0; i < getAllAvailableAssistantsApi.data.length; i += 1) {
                assistants.push({
                    label: getAllAvailableAssistantsApi.data[i].name,
                    name: getAllAvailableAssistantsApi.data[i].id,
                    description: getAllAvailableAssistantsApi.data[i].instructions
                })
            }
            setAvailableAssistantsOptions(assistants)
        }
    }, [getAllAvailableAssistantsApi.data])

    useEffect(() => {
        if (getAllAvailableAssistantsApi.error && setError) {
            setError(getAllAvailableAssistantsApi.error)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getAllAvailableAssistantsApi.error])

    const component = show ? (
        <Dialog
            fullWidth
            maxWidth='xs'
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
                            {t('assistants.openai.credential')}
                            <span style={{ color: 'red' }}>&nbsp;*</span>
                        </Typography>
                    </Stack>
                    <CredentialInputHandler
                        key={credentialId}
                        data={credentialId ? { credential: credentialId } : {}}
                        inputParam={{
                            label: t('assistants.vectorStore.credential'),
                            name: 'credential',
                            type: 'credential',
                            credentialNames: ['openAIApi']
                        }}
                        onSelect={(newValue) => {
                            setCredentialId(newValue)
                            if (newValue && unikId) getAllAvailableAssistantsApi.request(newValue, unikId)
                        }}
                    />
                </Box>
                {credentialId && (
                    <Box sx={{ p: 2 }}>
                        <Stack sx={{ position: 'relative' }} direction='row'>
                            <Typography variant='overline'>
                                {t('assistants.title')}
                                <span style={{ color: 'red' }}>&nbsp;*</span>
                            </Typography>
                        </Stack>
                        <Dropdown
                            name={selectedOpenAIAssistantId}
                            options={availableAssistantsOptions}
                            onSelect={(newValue) => setSelectedOpenAIAssistantId(newValue)}
                            value={selectedOpenAIAssistantId ?? 'choose an option'}
                        />
                    </Box>
                )}
            </DialogContent>
            {selectedOpenAIAssistantId && (
                <DialogActions>
                    <StyledButton variant='contained' onClick={() => onAssistantSelected(selectedOpenAIAssistantId, credentialId)}>
                        {t('assistants.openai.load')}
                    </StyledButton>
                </DialogActions>
            )}
        </Dialog>
    ) : null

    return createPortal(component, portalElement)
}

LoadAssistantDialog.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onCancel: PropTypes.func,
    onAssistantSelected: PropTypes.func,
    setError: PropTypes.func
}

export default LoadAssistantDialog
