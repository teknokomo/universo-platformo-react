// Universo Platformo | Colyseus Settings Component
// JSX component for Flowise compatibility - configures Colyseus server settings

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Box,
    TextField,
    Typography,
    Collapse,
    FormHelperText
} from '@mui/material'

/**
 * Validates server host format
 * @param {string} host - Server host to validate
 * @returns {boolean} - True if valid
 */
const isValidHost = (host) => {
    if (!host || host.trim() === '') return false

    // Allow localhost
    if (host === 'localhost') return true

    // Allow IP addresses (basic validation)
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    if (ipRegex.test(host)) return true

    // Allow domain names (basic validation)
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    return domainRegex.test(host)
}

/**
 * Validates port number
 * @param {number} port - Port number to validate
 * @returns {boolean} - True if valid
 */
const isValidPort = (port) => {
    return !isNaN(port) && port >= 1 && port <= 65535
}

/**
 * Validates room name format
 * @param {string} roomName - Room name to validate
 * @returns {boolean} - True if valid
 */
const isValidRoomName = (roomName) => {
    if (!roomName || roomName.trim() === '') return false
    // Allow alphanumeric characters, underscores, and hyphens
    const roomNameRegex = /^[a-zA-Z0-9_-]+$/
    return roomNameRegex.test(roomName) && roomName.length >= 3 && roomName.length <= 32
}

/**
 * Colyseus Settings Component
 * Provides configuration fields for Colyseus server connection with validation
 */
const ColyseusSettings = ({
    settings = {
        serverHost: 'localhost',
        serverPort: 2567,
        roomName: 'mmoomm_room'
    },
    onChange,
    visible = false
}) => {
    const { t } = useTranslation('publish')
    const [errors, setErrors] = useState({})

    // Validate settings when they change
    useEffect(() => {
        const newErrors = {}

        if (!isValidHost(settings.serverHost)) {
            newErrors.serverHost = t('playcanvas.colyseusSettings.errors.invalidHost')
        }

        if (!isValidPort(settings.serverPort)) {
            newErrors.serverPort = t('playcanvas.colyseusSettings.errors.invalidPort')
        }

        if (!isValidRoomName(settings.roomName)) {
            newErrors.roomName = t('playcanvas.colyseusSettings.errors.invalidRoomName')
        }

        setErrors(newErrors)
    }, [settings, t])

    const handleHostChange = (event) => {
        const newHost = event.target.value
        onChange({
            ...settings,
            serverHost: newHost
        })
    }

    const handlePortChange = (event) => {
        const port = parseInt(event.target.value, 10)
        onChange({
            ...settings,
            serverPort: isNaN(port) ? '' : port
        })
    }

    const handleRoomNameChange = (event) => {
        const newRoomName = event.target.value
        onChange({
            ...settings,
            roomName: newRoomName
        })
    }

    return (
        <Collapse in={visible}>
            <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="h6" gutterBottom>
                    {t('playcanvas.colyseusSettings.title')}
                </Typography>

                <TextField
                    fullWidth
                    label={t('playcanvas.colyseusSettings.serverHost')}
                    value={settings.serverHost}
                    onChange={handleHostChange}
                    margin="normal"
                    variant="outlined"
                    placeholder="localhost"
                    error={!!errors.serverHost}
                    helperText={errors.serverHost || t('playcanvas.colyseusSettings.hostHelp')}
                />

                <TextField
                    fullWidth
                    label={t('playcanvas.colyseusSettings.serverPort')}
                    type="number"
                    value={settings.serverPort}
                    onChange={handlePortChange}
                    margin="normal"
                    variant="outlined"
                    placeholder="2567"
                    error={!!errors.serverPort}
                    helperText={errors.serverPort || t('playcanvas.colyseusSettings.portHelp')}
                    inputProps={{
                        min: 1,
                        max: 65535
                    }}
                />

                <TextField
                    fullWidth
                    label={t('playcanvas.colyseusSettings.roomName')}
                    value={settings.roomName}
                    onChange={handleRoomNameChange}
                    margin="normal"
                    variant="outlined"
                    placeholder="mmoomm_room"
                    error={!!errors.roomName}
                    helperText={errors.roomName || t('playcanvas.colyseusSettings.roomNameHelp')}
                />

                <FormHelperText sx={{ mt: 1 }}>
                    {t('playcanvas.colyseusSettings.description')}
                </FormHelperText>
            </Box>
        </Collapse>
    )
}

export default ColyseusSettings