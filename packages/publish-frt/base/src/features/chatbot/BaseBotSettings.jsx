// Universo Platformo | Base Bot Settings component for all bot types
import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction, SET_CANVAS } from '@flowise/store'
import { SketchPicker } from 'react-color'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { Card, Box, Typography, Button, Switch, OutlinedInput, Popover, Stack, IconButton } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// Project import
import { StyledButton } from '@flowise/template-mui/ui-components/button/StyledButton'
import { TooltipWithParser } from '@flowise/template-mui/ui-components/tooltip/TooltipWithParser'

// Icons
import { IconX, IconCopy, IconArrowUpRightCircle } from '@tabler/icons-react'

// API
import canvasesApi from '@/api/canvases'

// utils
import useNotifier from '@flowise/template-mui/hooks/useNotifier'

// Const
import { baseURL } from '@flowise/store'

// ==============================|| Base Bot Settings ||============================== //

const BaseBotSettings = ({
    canvasId,
    unikId: propUnikId,
    configKey,
    formatConfig,
    renderFields,
    defaultConfig,
    updateTranslationKey,
    onColorChanged,
    onTextChanged: propOnTextChanged,
    onBooleanChanged: propOnBooleanChanged
}) => {
    const dispatch = useDispatch()
    const theme = useTheme()
    const canvas = useSelector((state) => state.canvas.currentCanvas)
    const botConfig = canvas[configKey] ?? defaultConfig
    const { t } = useTranslation('canvases')
    const { unikId: paramsUnikId } = useParams()
    const unikId = propUnikId || paramsUnikId

    useNotifier()

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    // Universo Platformo | Determine public status from new structure
    const getChatbotPublicStatus = () => {
        try {
            if (canvas[configKey]) {
                const config = typeof canvas[configKey] === 'string' ? JSON.parse(canvas[configKey]) : canvas[configKey]
                // Check if new structure with chatbot block exists
                if (config.chatbot && typeof config.chatbot.isPublic === 'boolean') {
                    return config.chatbot.isPublic
                }
                // Fallback to old structure for backward compatibility
                if (typeof config.isPublic === 'boolean') {
                    return config.isPublic
                }
            }
            // Return false if no technology-specific configuration exists
            return false
        } catch (error) {
            console.warn('Error determining chatbot public status, defaulting to false:', error)
            return false
        }
    }

    const [isCanvasPublic, setCanvasIsPublic] = useState(getChatbotPublicStatus())
    const [colorAnchorEl, setColorAnchorEl] = useState(null)
    const [selectedColorConfig, setSelectedColorConfig] = useState('')
    const [sketchPickerColor, setSketchPickerColor] = useState('')
    const openColorPopOver = Boolean(colorAnchorEl)

    // Universo Platformo | Update public status when canvas changes
    useEffect(() => {
        setCanvasIsPublic(getChatbotPublicStatus())
    }, [canvas])

    // Shared methods for all bot settings
    const onSave = async () => {
        try {
            // Universo Platformo | Safely get the configuration
            let configJSON = null
            try {
                if (typeof formatConfig === 'function') {
                    const configObj = formatConfig()
                    configJSON = JSON.stringify(configObj)
                    console.log('Форматированная конфигурация для сохранения:', configJSON)
                } else {
                    // Universo Platformo | If formatConfig is not a function, use an empty object
                    configJSON = JSON.stringify({})
                    console.warn('formatConfig не является функцией')
                }
            } catch (formatError) {
                console.error('Ошибка при форматировании конфигурации:', formatError)
                configJSON = JSON.stringify({})
            }

            if (!configJSON) {
                throw new Error('Не удалось создать конфигурацию для сохранения')
            }

            const updateData = {
                [configKey]: configJSON
            }

            console.log('Сохраняем конфигурацию:', updateData)

            const saveResp = await canvasesApi.updateCanvas(unikId, canvasId, updateData)
            if (saveResp.data) {
                enqueueSnackbar({
                    message: t(`canvases.${updateTranslationKey}.configSaved`),
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
                dispatch({ type: SET_CANVAS, canvas: saveResp.data })
            }
        } catch (error) {
            console.error('Ошибка при сохранении конфигурации:', error)
            enqueueSnackbar({
                message: t(`canvases.${updateTranslationKey}.saveError`),
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

    const onSwitchChange = async (checked) => {
        try {
            // Universo Platformo | Get formatted configuration with updated isPublic status
            let configObj = {}
            try {
                if (typeof formatConfig === 'function') {
                    configObj = formatConfig()
                    console.log('Форматированная конфигурация:', configObj)
                } else {
                    // Universo Platformo | Use minimal structure if formatConfig is not a function
                    configObj = {
                        chatbot: {
                            isPublic: checked,
                            displayMode: 'chat'
                        }
                    }
                }
            } catch (configFormatError) {
                console.error('Ошибка при форматировании конфигурации:', configFormatError)
                // Universo Platformo | Use minimal structure if formatting failed
                configObj = {
                    chatbot: {
                        isPublic: checked,
                        displayMode: 'chat'
                    }
                }
            }

            // Universo Platformo | Set isPublic in the appropriate technology block
            if (configKey === 'chatbotConfig') {
                // Ensure chatbot block exists and set isPublic
                if (!configObj.chatbot) {
                    configObj.chatbot = {}
                }
                configObj.chatbot.isPublic = checked
            }
            // Add other technology blocks here as they are implemented

            const configJSON = JSON.stringify(configObj)

            // Universo Platformo | Always save configuration with updated isPublic status
            const updateData = {
                [configKey]: configJSON
            }

            // Universo Platformo | Also determine if global isPublic should be set
            // Set global isPublic to true if any technology is public
            const needsGlobalPublic = checked || (await hasOtherPublicTechnologies(configKey, checked))
            if (needsGlobalPublic !== canvas.isPublic) {
                updateData.isPublic = needsGlobalPublic
            }

            console.log('Данные для обновления:', updateData)

            const saveResp = await canvasesApi.updateCanvas(unikId, canvasId, updateData)
            if (saveResp.data) {
                enqueueSnackbar({
                    message: t(`canvases.${updateTranslationKey}.configSaved`),
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
                dispatch({ type: SET_CANVAS, canvas: saveResp.data })
                setCanvasIsPublic(checked)
            }
        } catch (error) {
            console.error('Ошибка при обновлении статуса публичности:', error)
            enqueueSnackbar({
                message: t(`canvases.${updateTranslationKey}.saveError`),
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

    // Universo Platformo | Helper function to check if other technologies are public
    const hasOtherPublicTechnologies = async (currentConfigKey, currentPublicStatus) => {
        try {
            const configKeys = ['chatbotConfig'] // Add other technology config keys as they are implemented

            for (const key of configKeys) {
                if (key === currentConfigKey) continue // Skip current technology

                const rawConfig = canvas[key]
                if (rawConfig) {
                    const config = typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig

                    // Check for new structure
                    if (key === 'chatbotConfig' && config.chatbot?.isPublic) return true
                    if (key === 'chatbotConfig' && config.arjs?.isPublic) return true
                    // Add other technology checks here

                    // Fallback to old structure
                    if (config.isPublic) return true
                }
            }
            return false
        } catch (error) {
            console.warn('Error checking other public technologies:', error)
            return false
        }
    }

    const handleClosePopOver = () => {
        setColorAnchorEl(null)
    }

    const onColorSelected = (hexColor) => {
        try {
            // Universo Platformo | Call the handler passed from the parent component
            if (typeof onColorChanged === 'function') {
                onColorChanged(hexColor.hex, selectedColorConfig)
            }
            setSketchPickerColor(hexColor.hex)
        } catch (error) {
            console.error('Ошибка при обработке выбора цвета:', error)
        }
    }

    // Utility components for rendering common field types
    const colorField = (color, fieldName, fieldLabel) => {
        return (
            <>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant='subtitle1'>{fieldLabel}</Typography>
                    <Box
                        id={fieldName}
                        sx={{
                            height: 24,
                            width: 24,
                            borderRadius: 1,
                            border: '2px solid #ccc',
                            backgroundColor: color,
                            display: 'inline-block',
                            cursor: 'pointer'
                        }}
                        onClick={(e) => {
                            setSelectedColorConfig(fieldName)
                            setSketchPickerColor(color)
                            setColorAnchorEl(e.currentTarget)
                        }}
                    />
                </Box>
            </>
        )
    }

    const booleanField = (value, fieldName, fieldLabel) => {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant='subtitle1'>{fieldLabel}</Typography>
                <Switch checked={value} onChange={(e) => onBooleanChanged(e.target.checked, fieldName)} />
            </Box>
        )
    }

    const textField = (message, fieldName, fieldLabel, fieldType = 'string', placeholder = '') => {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', mb: 2 }}>
                <Typography variant='subtitle1' sx={{ mb: 1 }}>
                    {fieldLabel}
                </Typography>
                <OutlinedInput
                    id={fieldName}
                    type={fieldType}
                    placeholder={placeholder}
                    value={message}
                    onChange={(e) => onTextChanged(e.target.value, fieldName)}
                    sx={{ width: '100%' }}
                />
            </Box>
        )
    }

    // Universo Platformo | Use event handlers provided by client component
    const onTextChanged = (value, fieldName) => {
        if (typeof propOnTextChanged === 'function') {
            propOnTextChanged(value, fieldName)
        } else {
            console.warn('onTextChanged handler not provided')
        }
    }

    const onBooleanChanged = (value, fieldName) => {
        if (typeof propOnBooleanChanged === 'function') {
            propOnBooleanChanged(value, fieldName)
        } else {
            console.warn('onBooleanChanged handler not provided')
        }
    }

    // Render the base settings UI
    return (
        <Box sx={{ p: 2 }}>
            <Stack direction='row' spacing={1} sx={{ display: 'flex', alignItems: 'center', mt: 3, mb: 3 }}>
                <OutlinedInput
                    sx={{ display: 'none' }}
                    id='copy-bot-link'
                    value={`${baseURL}/chatbot/${canvasId}`}
                    aria-describedby='helper-text-copy-bot-link'
                    readOnly={true}
                />
                <OutlinedInput
                    id='outlined-adornment-bot-link'
                    value={`${baseURL}/chatbot/${canvasId}`}
                    aria-describedby='helper-text-bot-link'
                    readOnly={true}
                    disabled={!isCanvasPublic}
                    sx={{ width: '100%' }}
                    endAdornment={
                        <IconButton
                            aria-label='Copy'
                            disabled={!isCanvasPublic}
                            onClick={(e) => {
                                try {
                                    navigator.clipboard.writeText(`${baseURL}/chatbot/${canvasId}`)
                                    enqueueSnackbar({
                                        message: 'Ссылка скопирована',
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
                                } catch (err) {
                                    console.error('Failed to copy:', err)
                                    const copyText = document.getElementById('copy-bot-link')
                                    copyText.select()
                                    copyText.setSelectionRange(0, 99999)
                                    document.execCommand('copy')
                                }
                            }}
                            title='Копировать ссылку'
                            edge='end'
                        >
                            <IconCopy />
                        </IconButton>
                    }
                />
                {isCanvasPublic && (
                    <IconButton
                        title='Открыть в новой вкладке'
                        color='primary'
                        onClick={() => {
                            const url = `${baseURL}/chatbot/${canvasId}`
                            window.open(url, '_blank')
                        }}
                    >
                        <IconArrowUpRightCircle />
                    </IconButton>
                )}
            </Stack>

            <Card sx={{ p: 3, borderRadius: '8px' }}>
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                        <Typography variant='h4'>Заголовок</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant='subtitle1' sx={{ mr: 2 }}>
                                Сделать публичным
                            </Typography>
                            <Switch checked={isCanvasPublic} onChange={(e) => onSwitchChange(e.target.checked)} />
                        </Box>
                    </Box>

                    {renderFields({
                        botConfig,
                        colorField,
                        booleanField,
                        textField
                    })}

                    <Stack direction='row' spacing={1} sx={{ mt: 3 }}>
                        <StyledButton
                            variant='contained'
                            onClick={onSave}
                            sx={{
                                backgroundColor: theme.palette.primary.main,
                                '&:hover': {
                                    backgroundColor: theme.palette.primary.dark
                                }
                            }}
                        >
                            Сохранить изменения
                        </StyledButton>
                    </Stack>
                </Box>
            </Card>

            <Popover
                open={openColorPopOver}
                anchorEl={colorAnchorEl}
                onClose={handleClosePopOver}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left'
                }}
            >
                <SketchPicker color={sketchPickerColor} onChange={onColorSelected} />
            </Popover>
        </Box>
    )
}

BaseBotSettings.propTypes = {
    canvasId: PropTypes.string,
    unikId: PropTypes.string,
    configKey: PropTypes.string.isRequired,
    formatConfig: PropTypes.func.isRequired,
    renderFields: PropTypes.func.isRequired,
    defaultConfig: PropTypes.object.isRequired,
    updateTranslationKey: PropTypes.string.isRequired,
    onColorChanged: PropTypes.func,
    onTextChanged: PropTypes.func,
    onBooleanChanged: PropTypes.func
}

export default BaseBotSettings
