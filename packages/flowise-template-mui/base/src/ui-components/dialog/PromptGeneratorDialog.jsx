import { createPortal } from 'react-dom'
import { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import PropTypes from 'prop-types'
import { OutlinedInput, DialogActions, Button, Dialog, DialogContent, DialogTitle } from '@mui/material'
import { StyledButton } from '../button/StyledButton'
// TODO: use api.assistants
import { closeSnackbar as closeSnackbarAction, enqueueSnackbar as enqueueSnackbarAction } from '@flowise/store'
import { IconX, IconWand, IconArrowLeft, IconNotebook, IconLanguage, IconMail, IconCode, IconReport, IconWorld } from '@tabler/icons-react'
import useNotifier from '@flowise/template-mui/hooks/useNotifier'
import { LoadingButton } from '@mui/lab'
import { useTranslation } from '@universo/i18n'

const getDefaultInstructions = (t) => [
    {
        text: t('promptGenerator.summarize'),
        img: <IconNotebook />
    },
    {
        text: t('promptGenerator.translate'),
        img: <IconLanguage />
    },
    {
        text: t('promptGenerator.email'),
        img: <IconMail />
    },
    {
        text: t('promptGenerator.convertCode'),
        img: <IconCode />
    },
    {
        text: t('promptGenerator.research'),
        img: <IconReport />
    },
    {
        text: t('promptGenerator.planTrip'),
        img: <IconWorld />
    }
]

const AssistantPromptGenerator = ({ show, dialogProps, onCancel, onConfirm }) => {
    const { t } = useTranslation()
    const defaultInstructions = getDefaultInstructions(t)
    const portalElement = document.getElementById('portal')
    const [customAssistantInstruction, setCustomAssistantInstruction] = useState('')
    const [generatedInstruction, setGeneratedInstruction] = useState('')
    const [loading, setLoading] = useState(false)

    // ==============================|| Snackbar ||============================== //
    const dispatch = useDispatch()
    useNotifier()
    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const onGenerate = async () => {
        try {
            setLoading(true)
            const selectedChatModelObj = {
                name: dialogProps.data.selectedChatModel.name,
                inputs: dialogProps.data.selectedChatModel.inputs
            }
            const resp = await api.assistants.generateAssistantInstruction(dialogProps.data.unikId, {
                selectedChatModel: selectedChatModelObj,
                task: customAssistantInstruction
            })

            if (resp.data) {
                setLoading(false)
                if (resp.data.content) {
                    setGeneratedInstruction(resp.data.content)
                }
            }
        } catch (error) {
            setLoading(false)
            enqueueSnackbar({
                message: typeof error.response.data === 'object' ? error.response.data.message : error.response.data,
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
        }
    }

    // clear the state when dialog is closed
    useEffect(() => {
        if (!show) {
            setCustomAssistantInstruction('')
            setGeneratedInstruction('')
        }
    }, [show])

    const component = show ? (
        <>
            <Dialog
                fullWidth
                maxWidth='md'
                open={show}
                onClose={onCancel}
                aria-labelledby='alert-dialog-title'
                aria-describedby='alert-dialog-description'
            >
                <DialogTitle sx={{ fontSize: '1rem' }} id='alert-dialog-title'>
                    {dialogProps.title}
                </DialogTitle>
                <DialogContent>
                    <span>{dialogProps.description}</span>
                    <div
                        style={{
                            display: 'block',
                            flexDirection: 'row',
                            width: '100%',
                            marginTop: '15px'
                        }}
                    >
                        {defaultInstructions.map((instruction, index) => {
                            return (
                                <Button
                                    size='small'
                                    key={index}
                                    sx={{ textTransform: 'none', mr: 1, mb: 1, borderRadius: '16px' }}
                                    variant='outlined'
                                    color='inherit'
                                    onClick={() => {
                                        setCustomAssistantInstruction(instruction.text)
                                        setGeneratedInstruction('')
                                    }}
                                    startIcon={instruction.img}
                                >
                                    {instruction.text}
                                </Button>
                            )
                        })}
                    </div>
                    {!generatedInstruction && (
                        <OutlinedInput
                            sx={{ mt: 2, width: '100%' }}
                            type={'text'}
                            multiline={true}
                            rows={12}
                            disabled={loading}
                            value={customAssistantInstruction}
                            placeholder={t('promptGenerator.taskPlaceholder')}
                            onChange={(event) => setCustomAssistantInstruction(event.target.value)}
                        />
                    )}
                    {generatedInstruction && (
                        <OutlinedInput
                            sx={{ mt: 2, width: '100%' }}
                            type={'text'}
                            multiline={true}
                            rows={12}
                            value={generatedInstruction}
                            onChange={(event) => setGeneratedInstruction(event.target.value)}
                        />
                    )}
                </DialogContent>
                <DialogActions sx={{ pb: 3, pr: 3 }}>
                    {!generatedInstruction && (
                        <LoadingButton
                            loading={loading}
                            variant='contained'
                            onClick={() => {
                                onGenerate()
                            }}
                            startIcon={<IconWand size={20} />}
                        >
                            {t('promptGenerator.generate')}
                        </LoadingButton>
                    )}
                    {generatedInstruction && (
                        <Button
                            variant='outlined'
                            startIcon={<IconArrowLeft size={20} />}
                            onClick={() => {
                                setGeneratedInstruction('')
                            }}
                        >
                            {t('promptGenerator.back')}
                        </Button>
                    )}
                    {generatedInstruction && (
                        <StyledButton variant='contained' onClick={() => onConfirm(generatedInstruction)}>
                            {t('promptGenerator.apply')}
                        </StyledButton>
                    )}
                </DialogActions>
            </Dialog>
        </>
    ) : null

    return createPortal(component, portalElement)
}

AssistantPromptGenerator.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onConfirm: PropTypes.func,
    onCancel: PropTypes.func
}

export default AssistantPromptGenerator
