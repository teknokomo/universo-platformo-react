// Universo Platformo | Timer Settings Component
// Component for configuring quiz timer settings

import React from 'react'
import { useTranslation } from 'react-i18next'
import {
    Box,
    Typography,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Switch,
    FormControlLabel,
    FormHelperText
} from '@mui/material'
import type { TimerPosition } from '../../../types/publication.types'

export interface TimerSettingsProps {
    enabled: boolean
    limitSeconds: number
    position: TimerPosition
    disabled?: boolean
    onEnabledChange: (enabled: boolean) => void
    onLimitSecondsChange: (seconds: number) => void
    onPositionChange: (position: TimerPosition) => void
}

/**
 * Timer Settings Component
 * Handles timer configuration for quiz templates
 */
export const TimerSettings = React.memo<TimerSettingsProps>(
    ({ enabled, limitSeconds, position, disabled = false, onEnabledChange, onLimitSecondsChange, onPositionChange }) => {
        const { t } = useTranslation('publish')

        const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = parseInt(e.target.value, 10)
            if (value >= 10 && value <= 3600) {
                onLimitSecondsChange(value)
            }
        }

        return (
            <Box sx={{ mt: 3, mb: 2 }}>
                <Typography variant='subtitle2' gutterBottom>
                    {t('publisher.timer.title', 'Настройки таймера')}
                </Typography>

                <FormControlLabel
                    control={
                        <Switch
                            checked={enabled}
                            onChange={(e) => onEnabledChange(e.target.checked)}
                            disabled={disabled}
                            inputProps={{
                                'aria-label': t('publisher.timer.enabled', 'Включить таймер'),
                                role: 'switch'
                            }}
                        />
                    }
                    label={t('publisher.timer.enabled', 'Включить таймер')}
                />
                <FormHelperText>
                    {t('publisher.timer.enabledHelp', 'Добавить обратный отсчёт времени для прохождения квиза')}
                </FormHelperText>

                {enabled && (
                    <>
                        <TextField
                            fullWidth
                            type='number'
                            label={t('publisher.timer.limitSeconds', 'Лимит времени (секунды)')}
                            value={limitSeconds}
                            onChange={handleLimitChange}
                            disabled={disabled}
                            inputProps={{ min: 10, max: 3600, step: 10 }}
                            helperText={t('publisher.timer.limitSecondsHelp', 'От 10 до 3600 секунд (1 час)')}
                            margin='normal'
                        />

                        <FormControl fullWidth margin='normal'>
                            <InputLabel>{t('publisher.timer.position', 'Позиция таймера')}</InputLabel>
                            <Select
                                value={position}
                                onChange={(e) => onPositionChange(e.target.value as TimerPosition)}
                                disabled={disabled}
                                label={t('publisher.timer.position', 'Позиция таймера')}
                            >
                                <MenuItem value='top-left'>{t('publisher.timer.topLeft', 'Вверху слева')}</MenuItem>
                                <MenuItem value='top-center'>{t('publisher.timer.topCenter', 'Вверху по центру')}</MenuItem>
                                <MenuItem value='top-right'>{t('publisher.timer.topRight', 'Вверху справа')}</MenuItem>
                                <MenuItem value='bottom-left'>{t('publisher.timer.bottomLeft', 'Внизу слева')}</MenuItem>
                                <MenuItem value='bottom-right'>{t('publisher.timer.bottomRight', 'Внизу справа')}</MenuItem>
                            </Select>
                            <FormHelperText>{t('publisher.timer.positionHelp', 'Выберите расположение таймера на экране')}</FormHelperText>
                        </FormControl>
                    </>
                )}
            </Box>
        )
    }
)

TimerSettings.displayName = 'TimerSettings'
