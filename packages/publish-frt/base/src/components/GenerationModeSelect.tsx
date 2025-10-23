// Universo Platformo | Component for selecting generation mode for different technologies
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Select, MenuItem, FormControl, InputLabel, FormHelperText, SelectChangeEvent } from '@mui/material'

export type GenerationMode = 'streaming' | 'pregeneration'
export type Technology = 'arjs' | 'playcanvas'

interface GenerationModeSelectProps {
    value: GenerationMode
    onChange: (mode: GenerationMode) => void
    disabled?: boolean
    technology?: Technology // New prop for technology selection
}

export const GenerationModeSelect: React.FC<GenerationModeSelectProps> = ({
    value,
    onChange,
    disabled = false,
    technology = 'arjs' // Default to arjs for backward compatibility
}) => {
    const { t } = useTranslation('publish')

    const handleChange = (event: SelectChangeEvent) => {
        onChange(event.target.value as GenerationMode)
    }

    return (
        <FormControl fullWidth variant='outlined' margin='normal'>
            <InputLabel>{t(`${technology}.generationMode.label`)}</InputLabel>
            <Select value={value} onChange={handleChange} label={t(`${technology}.generationMode.label`)} disabled={disabled}>
                <MenuItem value='streaming'>{t(`${technology}.generationMode.streaming`)}</MenuItem>
                <MenuItem value='pregeneration' disabled>
                    {t(`${technology}.generationMode.pregeneration`)} ({t('general.comingSoon')})
                </MenuItem>
            </Select>
            <FormHelperText>
                {value === 'streaming'
                    ? t(`${technology}.generationMode.streamingDescription`)
                    : t(`${technology}.generationMode.pregenerationDescription`)}
            </FormHelperText>
        </FormControl>
    )
}

export default GenerationModeSelect
