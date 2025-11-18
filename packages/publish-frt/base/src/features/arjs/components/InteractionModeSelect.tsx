// Universo Platformo | Interaction Mode Select Component
// Component for selecting quiz interaction mode (buttons or nodes)

import React from 'react'
import { useTranslation } from 'react-i18next'
import { FormControl, InputLabel, Select, MenuItem, FormHelperText } from '@mui/material'
import type { QuizInteractionMode } from '../../../types/publication.types'

export interface InteractionModeSelectProps {
    value: QuizInteractionMode
    disabled?: boolean
    onChange: (mode: QuizInteractionMode) => void
}

/**
 * Interaction Mode Select Component
 * Allows users to choose between button-based and node-based quiz interaction
 */
export const InteractionModeSelect = React.memo<InteractionModeSelectProps>(({ value, disabled = false, onChange }) => {
    const { t } = useTranslation('publish')

    return (
        <FormControl fullWidth margin='normal'>
            <InputLabel>{t('arjs.interactionMode.label', 'Режим взаимодействия')}</InputLabel>
            <Select
                value={value}
                onChange={(e) => onChange(e.target.value as QuizInteractionMode)}
                disabled={disabled}
                label={t('arjs.interactionMode.label', 'Режим взаимодействия')}
            >
                <MenuItem value='buttons'>{t('arjs.interactionMode.buttons', 'Кнопки ответов')}</MenuItem>
                <MenuItem value='nodes'>{t('arjs.interactionMode.nodes', 'Соединение узлов')}</MenuItem>
            </Select>
            <FormHelperText>
                {value === 'buttons'
                    ? t('arjs.interactionMode.buttonsDescription', 'Традиционный режим с кнопками выбора ответа')
                    : t('arjs.interactionMode.nodesDescription', 'Соедините вопросы с ответами перетаскиванием линий')}
            </FormHelperText>
        </FormControl>
    )
})

InteractionModeSelect.displayName = 'InteractionModeSelect'
