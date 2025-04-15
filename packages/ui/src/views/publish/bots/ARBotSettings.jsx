// Universo Platformo | AR Bot Settings implementation
import { useState } from 'react'
import PropTypes from 'prop-types'

// Project import
import BaseBotSettings from './BaseBotSettings'

// ==============================|| AR Bot Settings ||============================== //

const defaultConfig = {
    backgroundColor: '#ffffff',
    markerColor: '#000000',
    modelScale: 1.0,
    textColor: '#303235',
    cameraControls: true,
    title: 'My AR Experience',
    displayMode: 'ar',
    scene: {
        component: 'arscene',
        detectionMode: 'mono',
        matrixCodeType: '3x3',
        debugMode: false,
        children: []
    }
}

const ARBotSettings = ({ chatflowid, unikId }) => {
    const [title, setTitle] = useState(defaultConfig.title)
    const [backgroundColor, setBackgroundColor] = useState(defaultConfig.backgroundColor)
    const [markerColor, setMarkerColor] = useState(defaultConfig.markerColor)
    const [modelScale, setModelScale] = useState(defaultConfig.modelScale)
    const [textColor, setTextColor] = useState(defaultConfig.textColor)
    const [cameraControls, setCameraControls] = useState(defaultConfig.cameraControls)
    const [markerPatternURL, setMarkerPatternURL] = useState('')
    const [modelURL, setModelURL] = useState('')

    const formatConfig = () => {
        // Universo Platformo | Safe parsing of numeric values
        const safeParseFloat = (value, defaultValue) => {
            const parsed = parseFloat(value)
            return isNaN(parsed) ? defaultValue : parsed
        }

        // Universo Platformo | Create an object with fields at the root for backward compatibility
        const configObj = {
            title: title || defaultConfig.title,
            backgroundColor: backgroundColor || defaultConfig.backgroundColor,
            textColor: textColor || defaultConfig.textColor,
            markerPatternURL: markerPatternURL || '',
            modelURL: modelURL || '',
            modelScale: safeParseFloat(modelScale, defaultConfig.modelScale),
            cameraControls: cameraControls !== undefined ? cameraControls : defaultConfig.cameraControls,
            markerColor: markerColor || defaultConfig.markerColor,
            displayMode: 'ar' // Universo Platformo | Always set AR mode for this config
        }

        return configObj
    }

    const handleTextChange = (value, fieldName) => {
        switch (fieldName) {
            case 'title':
                setTitle(value)
                break
            case 'markerPatternURL':
                setMarkerPatternURL(value)
                break
            case 'modelURL':
                setModelURL(value)
                break
            case 'modelScale':
                setModelScale(parseFloat(value))
                break
            default:
                break
        }
    }

    const handleBooleanChange = (value, fieldName) => {
        switch (fieldName) {
            case 'cameraControls':
                setCameraControls(value)
                break
            default:
                break
        }
    }

    const handleColorChange = (value, fieldName) => {
        switch (fieldName) {
            case 'backgroundColor':
                setBackgroundColor(value)
                break
            case 'textColor':
                setTextColor(value)
                break
            case 'markerColor':
                setMarkerColor(value)
                break
            default:
                break
        }
    }

    const renderFields = ({ botConfig, colorField, booleanField, textField }) => {
        // Universo Platformo | Initialize states from configuration if they are not already set
        const config = { ...defaultConfig, ...botConfig }

        if (title === defaultConfig.title && config.title) setTitle(config.title)
        if (backgroundColor === defaultConfig.backgroundColor && config.backgroundColor) setBackgroundColor(config.backgroundColor)
        if (markerColor === defaultConfig.markerColor && config.markerColor) setMarkerColor(config.markerColor)
        if (modelScale === defaultConfig.modelScale && config.modelScale) setModelScale(config.modelScale)
        if (textColor === defaultConfig.textColor && config.textColor) setTextColor(config.textColor)
        if (cameraControls === defaultConfig.cameraControls && config.cameraControls !== undefined) setCameraControls(config.cameraControls)
        if (markerPatternURL === '' && config.markerPatternURL) setMarkerPatternURL(config.markerPatternURL)
        if (modelURL === '' && config.modelURL) setModelURL(config.modelURL)

        return (
            <>
                <h4>General AR Settings</h4>
                {textField(title, 'title', 'AR Experience Title')}
                {colorField(backgroundColor, 'backgroundColor', 'Background Color')}
                {colorField(textColor, 'textColor', 'Text Color')}

                <h4>Marker Settings</h4>
                {textField(markerPatternURL, 'markerPatternURL', 'Marker Pattern URL')}
                {colorField(markerColor, 'markerColor', 'Marker Color')}

                <h4>3D Model Settings</h4>
                {textField(modelURL, 'modelURL', '3D Model URL (GLTF/GLB)')}
                {textField(modelScale, 'modelScale', 'Model Scale', 'number')}

                <h4>Additional Settings</h4>
                {booleanField(cameraControls, 'cameraControls', 'Enable Camera Controls')}
            </>
        )
    }

    return (
        <BaseBotSettings
            chatflowid={chatflowid}
            unikId={unikId}
            configKey='arbotConfig'
            formatConfig={formatConfig}
            renderFields={renderFields}
            defaultConfig={defaultConfig}
            updateTranslationKey='shareARbot'
            onTextChanged={handleTextChange}
            onBooleanChanged={handleBooleanChange}
            onColorChanged={handleColorChange}
        />
    )
}

ARBotSettings.propTypes = {
    chatflowid: PropTypes.string,
    unikId: PropTypes.string
}

export default ARBotSettings
