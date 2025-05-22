// Universo Platformo | Component for selecting AR.js generation mode
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Select, MenuItem, FormControl, InputLabel, FormHelperText, SelectChangeEvent } from '@mui/material'

export type GenerationMode = 'streaming' | 'pregeneration'

interface GenerationModeSelectProps {
    value: GenerationMode
    onChange: (mode: GenerationMode) => void
    disabled?: boolean
}

export const GenerationModeSelect: React.FC<GenerationModeSelectProps> = ({ value, onChange, disabled = false }) => {
    const { t } = useTranslation('publish')

    const handleChange = (event: SelectChangeEvent) => {
        onChange(event.target.value as GenerationMode)
    }

    return (
        <FormControl fullWidth variant='outlined' margin='normal'>
            <InputLabel>{t('arjs.generationMode.label')}</InputLabel>
            <Select value={value} onChange={handleChange} label={t('arjs.generationMode.label')} disabled={disabled}>
                <MenuItem value='streaming'>{t('arjs.generationMode.streaming')}</MenuItem>
                <MenuItem value='pregeneration' disabled>
                    {t('arjs.generationMode.pregeneration')} ({t('general.comingSoon')})
                </MenuItem>
            </Select>
            <FormHelperText>
                {value === 'streaming' ? t('arjs.generationMode.streamingDescription') : t('arjs.generationMode.pregenerationDescription')}
            </FormHelperText>
        </FormControl>
    )
}

export default GenerationModeSelect 