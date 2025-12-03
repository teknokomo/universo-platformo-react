// Universo Platformo | Game Mode Selector Component
// TypeScript component for selecting between Single Player and Multiplayer modes

import React from 'react'
import { useTranslation } from 'react-i18next'
import { FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, FormHelperText, Box } from '@mui/material'
import type { GameModeSelectorProps } from '../types'

/**
 * Game Mode Selector Component
 * Provides radio button interface for selecting game mode
 */
const GameModeSelector: React.FC<GameModeSelectorProps> = ({ value = 'singleplayer', onChange, disabled = false }) => {
    const { t } = useTranslation('publish')

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
        onChange(event.target.value as 'singleplayer' | 'multiplayer')
    }

    return (
        <Box sx={{ my: 2 }}>
            <FormControl component='fieldset' fullWidth disabled={disabled}>
                <FormLabel component='legend' sx={{ mb: 1 }}>
                    {t('playcanvas.gameMode.label')}
                </FormLabel>
                <RadioGroup value={value} onChange={handleChange} name='game-mode-selector'>
                    <FormControlLabel value='singleplayer' control={<Radio />} label={t('playcanvas.gameMode.singleplayer')} />
                    <FormControlLabel value='multiplayer' control={<Radio />} label={t('playcanvas.gameMode.multiplayer')} />
                </RadioGroup>
                <FormHelperText>
                    {value === 'singleplayer'
                        ? t('playcanvas.gameMode.singleplayerDescription')
                        : t('playcanvas.gameMode.multiplayerDescription')}
                </FormHelperText>
            </FormControl>
        </Box>
    )
}

export default GameModeSelector
