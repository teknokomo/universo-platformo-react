// Universo Platformo | Library Settings Component
// Component for configuring AR.js and A-Frame library versions and sources

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Typography, FormControl, InputLabel, Select, MenuItem, Grid, FormHelperText, Alert } from '@mui/material'
import type { LibrarySource, GlobalLibrarySettings } from '../../../types'

export interface LibrarySettingsProps {
    arjsVersion: string
    arjsSource: LibrarySource
    aframeVersion: string
    aframeSource: LibrarySource
    disabled?: boolean
    globalSettings?: GlobalLibrarySettings | null
    isLegacyScenario?: boolean
    alert?: { type: 'info' | 'warning' | 'error'; message: string } | null
    onArjsVersionChange: (version: string) => void
    onArjsSourceChange: (source: LibrarySource) => void
    onAframeVersionChange: (version: string) => void
    onAframeSourceChange: (source: LibrarySource) => void
    onAlertClose?: () => void
}

/**
 * Library Settings Component
 * Handles AR.js and A-Frame library configuration with global settings support
 */
export const LibrarySettings = React.memo<LibrarySettingsProps>(
    ({
        arjsVersion,
        arjsSource,
        aframeVersion,
        aframeSource,
        disabled = false,
        globalSettings,
        isLegacyScenario = false,
        alert,
        onArjsVersionChange,
        onArjsSourceChange,
        onAframeVersionChange,
        onAframeSourceChange,
        onAlertClose
    }) => {
        const { t } = useTranslation('publish')

        const isSourceDisabled =
            disabled || (globalSettings?.enforceGlobalLibraryManagement && (!isLegacyScenario || globalSettings?.autoCorrectLegacySettings))

        return (
            <Box sx={{ mt: 3, mb: 2 }}>
                <Typography variant='subtitle2' gutterBottom>
                    Настройки библиотек
                </Typography>

                {/* Global settings warning - only for enforcement mode and non-legacy scenarios */}
                {globalSettings?.enforceGlobalLibraryManagement && !isLegacyScenario && (
                    <Alert severity='info' sx={{ mb: 2 }}>
                        {t('arjs.globalLibraryManagement.enforcedMessage', {
                            source:
                                (globalSettings.defaultLibrarySource as string) === 'official'
                                    ? t('arjs.globalLibraryManagement.officialSource')
                                    : t('arjs.globalLibraryManagement.kiberplanoSource')
                        })}
                    </Alert>
                )}

                {/* Legacy Configuration Alert - shown in place of standard message */}
                {alert && isLegacyScenario && (
                    <Alert severity={alert.type} sx={{ mb: 2 }} onClose={onAlertClose}>
                        {alert.message}
                    </Alert>
                )}

                {/* AR.js Configuration */}
                <Box sx={{ mb: 2 }}>
                    <Typography variant='body2' color='text.secondary' gutterBottom>
                        AR.js
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={6}>
                            <FormControl fullWidth size='small'>
                                <InputLabel>Версия</InputLabel>
                                <Select
                                    value={arjsVersion}
                                    onChange={(e) => onArjsVersionChange(e.target.value)}
                                    label='Версия'
                                    disabled={disabled}
                                >
                                    <MenuItem value='3.4.7'>3.4.7</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={6}>
                            <FormControl fullWidth size='small'>
                                <InputLabel>Сервер</InputLabel>
                                <Select
                                    value={arjsSource}
                                    onChange={(e) => onArjsSourceChange(e.target.value as LibrarySource)}
                                    label='Сервер'
                                    disabled={isSourceDisabled}
                                >
                                    <MenuItem value='official'>Официальный сервер</MenuItem>
                                    <MenuItem value='kiberplano'>Сервер Kiberplano</MenuItem>
                                </Select>
                                {isSourceDisabled && <FormHelperText>Источник управляется глобально</FormHelperText>}
                            </FormControl>
                        </Grid>
                    </Grid>
                </Box>

                {/* A-Frame Configuration */}
                <Box sx={{ mb: 2 }}>
                    <Typography variant='body2' color='text.secondary' gutterBottom>
                        A-Frame
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={6}>
                            <FormControl fullWidth size='small'>
                                <InputLabel>Версия</InputLabel>
                                <Select
                                    value={aframeVersion}
                                    onChange={(e) => onAframeVersionChange(e.target.value)}
                                    label='Версия'
                                    disabled={disabled}
                                >
                                    <MenuItem value='1.7.1'>1.7.1</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={6}>
                            <FormControl fullWidth size='small'>
                                <InputLabel>Сервер</InputLabel>
                                <Select
                                    value={aframeSource}
                                    onChange={(e) => onAframeSourceChange(e.target.value as LibrarySource)}
                                    label='Сервер'
                                    disabled={isSourceDisabled}
                                >
                                    <MenuItem value='official'>Официальный сервер</MenuItem>
                                    <MenuItem value='kiberplano'>Сервер Kiberplano</MenuItem>
                                </Select>
                                {isSourceDisabled && <FormHelperText>Источник управляется глобально</FormHelperText>}
                            </FormControl>
                        </Grid>
                    </Grid>
                </Box>
            </Box>
        )
    }
)

LibrarySettings.displayName = 'LibrarySettings'
