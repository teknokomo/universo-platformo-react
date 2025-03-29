import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    CircularProgress,
    Stepper,
    Step,
    StepLabel,
    Select,
    MenuItem,
    FormControl,
    InputLabel
} from '@mui/material'

const NvidiaNIMDialog = ({ open, onClose, onComplete }) => {
    const portalElement = document.getElementById('portal')
    const { t } = useTranslation()

    const modelOptions = {
        'nv-mistralai/mistral-nemo-12b-instruct:latest': {
            label: 'Mistral Nemo 12B Instruct',
            licenseUrl: 'https://catalog.ngc.nvidia.com/orgs/nvidia/teams/nv-mistralai/containers/mistral-nemo-12b-instruct'
        },
        'meta/llama-3.1-8b-instruct-rtx:latest': {
            label: 'Llama 3.1 8B Instruct',
            licenseUrl: 'https://catalog.ngc.nvidia.com/orgs/nim/teams/meta/containers/llama-3.1-8b-instruct'
        }
    }

    const [activeStep, setActiveStep] = useState(0)
    const [loading, setLoading] = useState(false)
    const [imageTag, setImageTag] = useState('')
    const [pollInterval, setPollInterval] = useState(null)

    const steps = [t('dialog.nvidiaNIM.steps.download'), t('dialog.nvidiaNIM.steps.pullImage'), t('dialog.nvidiaNIM.steps.startContainer')]

    const handleDownloadInstaller = async () => {
        try {
            setLoading(true)
            await axios.get('/api/v1/nvidia-nim/download-installer')
            setLoading(false)
        } catch (err) {
            let errorData = err.message
            if (typeof err === 'string') {
                errorData = err
            } else if (err.response?.data) {
                errorData = err.response.data.message
            }
            alert('Failed to download installer: ' + errorData)
            setLoading(false)
        }
    }

    const preload = async () => {
        try {
            setLoading(true)
            await axios.get('/api/v1/nvidia-nim/preload')
            setLoading(false)
            setActiveStep(1)
        } catch (err) {
            let errorData = err.message
            if (typeof err === 'string') {
                errorData = err
            } else if (err.response?.data) {
                errorData = err.response.data.message
            }
            alert('Failed to preload: ' + errorData)
            setLoading(false)
        }
    }

    const handlePullImage = async () => {
        try {
            setLoading(true)
            try {
                const imageResponse = await axios.post('/api/v1/nvidia-nim/get-image', { imageTag })
                if (imageResponse.data && imageResponse.data.tag === imageTag) {
                    setLoading(false)
                    setActiveStep(2)
                    return
                }
            } catch (err) {
                // Continue if image not found
                if (err.response?.status !== 404) {
                    throw err
                }
            }

            // Get token first
            const tokenResponse = await axios.get('/api/v1/nvidia-nim/get-token')
            const apiKey = tokenResponse.data.access_token

            // Pull image
            await axios.post('/api/v1/nvidia-nim/pull-image', {
                imageTag,
                apiKey
            })

            // Start polling for image status
            const interval = setInterval(async () => {
                try {
                    const imageResponse = await axios.post('/api/v1/nvidia-nim/get-image', { imageTag })
                    if (imageResponse.data) {
                        clearInterval(interval)
                        setLoading(false)
                        setActiveStep(2)
                    }
                } catch (err) {
                    // Continue polling if image not found
                    if (err.response?.status !== 404) {
                        clearInterval(interval)
                        alert('Failed to check image status: ' + err.message)
                        setLoading(false)
                    }
                }
            }, 5000)

            setPollInterval(interval)
        } catch (err) {
            let errorData = err.message
            if (typeof err === 'string') {
                errorData = err
            } else if (err.response?.data) {
                errorData = err.response.data.message
            }
            alert('Failed to pull image: ' + errorData)
            setLoading(false)
        }
    }

    const handleStartContainer = async () => {
        try {
            setLoading(true)
            try {
                const containerResponse = await axios.post('/api/v1/nvidia-nim/get-container', { imageTag })
                if (containerResponse.data && containerResponse.data && containerResponse.data.status === 'running') {
                    // wait additional 10 seconds for container to be ready
                    await new Promise((resolve) => setTimeout(resolve, 10000))
                    setLoading(false)
                    onComplete(containerResponse.data)
                    onClose()
                    return
                }
            } catch (err) {
                // Continue if container not found
                if (err.response?.status !== 404) {
                    throw err
                }
            }

            const tokenResponse = await axios.get('/api/v1/nvidia-nim/get-token')
            const apiKey = tokenResponse.data.access_token

            await axios.post('/api/v1/nvidia-nim/start-container', {
                imageTag,
                apiKey
            })

            // Start polling for container status
            const interval = setInterval(async () => {
                try {
                    const containerResponse = await axios.post('/api/v1/nvidia-nim/get-container', { imageTag })
                    if (containerResponse.data) {
                        clearInterval(interval)
                        setLoading(false)
                        onComplete(containerResponse.data)
                        onClose()
                    }
                } catch (err) {
                    // Continue polling if container not found
                    if (err.response?.status !== 404) {
                        clearInterval(interval)
                        alert('Failed to check container status: ' + err.message)
                        setLoading(false)
                    }
                }
            }, 5000)

            setPollInterval(interval)
        } catch (err) {
            let errorData = err.message
            if (typeof err === 'string') {
                errorData = err
            } else if (err.response?.data) {
                errorData = err.response.data.message
            }
            alert('Failed to start container: ' + errorData)
            setLoading(false)
        }
    }

    const handleNext = () => {
        if (activeStep === 1 && !imageTag) {
            alert('Please enter an image tag')
            return
        }

        switch (activeStep) {
            case 0:
                preload()
                break
            case 1:
                handlePullImage()
                break
            case 2:
                handleStartContainer()
                break
            default:
                setActiveStep((prev) => prev + 1)
        }
    }

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollInterval) {
                clearInterval(pollInterval)
            }
        }
    }, [pollInterval])

    // clear state on close
    useEffect(() => {
        if (!open) {
            setActiveStep(0)
            setLoading(false)
            setImageTag('')
        }
    }, [open])

    const component = open ? (
        <Dialog open={open}>
            <DialogTitle>{t('dialog.nvidiaNIM.title')}</DialogTitle>
            <DialogContent>
                <Stepper activeStep={activeStep}>
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>

                {activeStep === 0 && (
                    <div style={{ marginTop: 20 }}>
                        <p style={{ marginBottom: 20 }}>
                            {t('dialog.nvidiaNIM.downloadPrompt')}
                        </p>
                        {loading && <CircularProgress />}
                    </div>
                )}

                {activeStep === 1 && (
                    <div>
                        <FormControl fullWidth sx={{ mt: 2 }}>
                            <InputLabel>{t('dialog.nvidiaNIM.model')}</InputLabel>
                            <Select label={t('dialog.nvidiaNIM.model')} value={imageTag} onChange={(e) => setImageTag(e.target.value)}>
                                {Object.entries(modelOptions).map(([value, { label }]) => (
                                    <MenuItem key={value} value={value}>
                                        {label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        {imageTag && (
                            <Button
                                variant='text'
                                size='small'
                                sx={{ mt: 1 }}
                                onClick={() => window.open(modelOptions[imageTag].licenseUrl, '_blank')}
                            >
                                {t('dialog.nvidiaNIM.viewLicense')}
                            </Button>
                        )}
                        {loading && (
                            <div>
                                <div style={{ marginBottom: 20 }} />
                                <CircularProgress />
                                <p>{t('dialog.nvidiaNIM.pullingImage')}</p>
                            </div>
                        )}
                    </div>
                )}

                {activeStep === 2 && (
                    <div>
                        {loading ? (
                            <>
                                <div style={{ marginBottom: 20 }} />
                                <CircularProgress />
                                <p>{t('dialog.nvidiaNIM.startingContainer')}</p>
                            </>
                        ) : (
                            <p>{t('dialog.nvidiaNIM.imageReady')}</p>
                        )}
                    </div>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} variant='outline'>
                    {t('dialog.nvidiaNIM.cancel')}
                </Button>
                {activeStep === 0 && (
                    <Button onClick={handleNext} variant='outline' color='secondary'>
                        {t('dialog.nvidiaNIM.next')}
                    </Button>
                )}
                <Button onClick={activeStep === 0 ? handleDownloadInstaller : handleNext} disabled={loading}>
                    {activeStep === 0 ? t('dialog.nvidiaNIM.download') : t('dialog.nvidiaNIM.next')}
                </Button>
            </DialogActions>
        </Dialog>
    ) : null

    return createPortal(component, portalElement)
}

NvidiaNIMDialog.propTypes = {
    open: PropTypes.bool,
    onClose: PropTypes.func,
    onComplete: PropTypes.func
}

export default NvidiaNIMDialog
