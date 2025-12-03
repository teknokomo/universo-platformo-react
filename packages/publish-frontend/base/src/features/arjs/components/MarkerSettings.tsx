// Universo Platformo | Marker Settings Component
// Component for configuring AR marker settings

import React from 'react'
import { useTranslation } from 'react-i18next'
import { FormControl, InputLabel, Select, MenuItem, Box, Typography } from '@mui/material'
import type { MarkerType } from '../../../types/publication.types'

export interface MarkerSettingsProps {
    markerType: MarkerType
    markerValue: string
    disabled?: boolean
    onMarkerTypeChange: (value: MarkerType) => void
    onMarkerValueChange: (value: string) => void
}

/**
 * Get marker image URL
 * @param markerType - Type of marker (preset or custom)
 * @param markerValue - Marker value/name
 * @returns URL to marker image
 */
const getMarkerImage = (markerType: MarkerType, markerValue: string): string => {
    if (markerType === 'preset') {
        return `https://raw.githubusercontent.com/AR-js-org/AR.js/master/data/images/${markerValue}.png`
    }
    return ''
}

/**
 * Marker Settings Component
 * Handles marker type and value selection for AR.js
 */
export const MarkerSettings = React.memo<MarkerSettingsProps>(({ markerType, markerValue, disabled = false, onMarkerValueChange }) => {
    const { t } = useTranslation('publish')

    return (
        <>
            <FormControl fullWidth variant='outlined' margin='normal'>
                <InputLabel>{t('marker.presetLabel')}</InputLabel>
                <Select
                    value={markerValue}
                    onChange={(e) => onMarkerValueChange(e.target.value)}
                    label={t('marker.presetLabel')}
                    disabled={disabled}
                >
                    <MenuItem value='hiro'>{t('marker.hiro')}</MenuItem>
                </Select>
            </FormControl>

            {/* Marker Preview */}
            <Box sx={{ textAlign: 'center', my: 2 }}>
                <Typography variant='body2' color='text.secondary' gutterBottom>
                    {t('preview.title')}
                </Typography>
                {markerType === 'preset' && markerValue && (
                    <Box
                        component='img'
                        src={getMarkerImage(markerType, markerValue)}
                        alt={t('marker.alt')}
                        sx={{ maxWidth: '200px', border: '1px solid #eee' }}
                    />
                )}
                <Typography variant='caption' display='block' sx={{ mt: 1 }}>
                    {t('marker.instruction')}
                </Typography>
            </Box>
        </>
    )
})

MarkerSettings.displayName = 'MarkerSettings'
