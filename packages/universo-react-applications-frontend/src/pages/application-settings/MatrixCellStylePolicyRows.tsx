import { useState } from 'react'
import { Box, Button, FormControlLabel, Stack, Switch, Typography } from '@mui/material'
import { parseInterpretationNetworkHexColor } from '@universo-react/types'
import { HexColorPickerPopover } from '@universo-react/template-mui'
import type { MatrixSettingsRowsProps } from './matrixSettingsTypes'
import { MatrixSettingsRow as SettingsRow } from './MatrixSettingsRow'
import { testIdInputProps } from './SettingsPanels'

export const MatrixCellStylePolicyRows = ({ t, isSaving, localSettings, setLocalSettings }: MatrixSettingsRowsProps) => {
    const [draftColor, setDraftColor] = useState('#1E88E5')
    const policy = localSettings.cellStylePolicy
    const normalizedDraftColor = parseInterpretationNetworkHexColor(draftColor)
    const alreadyAllowed = normalizedDraftColor !== null && policy.allowedColors.includes(normalizedDraftColor)

    const updatePolicy = (patch: Partial<typeof policy>) => {
        setLocalSettings((current) => ({
            ...current,
            cellStylePolicy: { ...current.cellStylePolicy, ...patch }
        }))
    }

    const updateEditableProperty = (property: keyof typeof policy.editable, checked: boolean) => {
        setLocalSettings((current) => ({
            ...current,
            cellStylePolicy: {
                ...current.cellStylePolicy,
                editable: { ...current.cellStylePolicy.editable, [property]: checked }
            }
        }))
    }

    const addAllowedColor = () => {
        if (!normalizedDraftColor || alreadyAllowed) return
        updatePolicy({ allowedColors: [...policy.allowedColors, normalizedDraftColor] })
    }

    const moveColor = (index: number, offset: -1 | 1) => {
        const targetIndex = index + offset
        if (targetIndex < 0 || targetIndex >= policy.allowedColors.length) return
        const allowedColors = [...policy.allowedColors]
        ;[allowedColors[index], allowedColors[targetIndex]] = [allowedColors[targetIndex], allowedColors[index]]
        updatePolicy({ allowedColors })
    }

    const removeColor = (color: string) => updatePolicy({ allowedColors: policy.allowedColors.filter((item) => item !== color) })

    return (
        <SettingsRow
            testId='application-setting-matrix-cell-style-policy'
            title={t('settings.matrix.cellStylePolicy.title', 'Cell style policy')}
            description={t(
                'settings.matrix.cellStylePolicy.description',
                'Choose which cell colors users may apply, which parts they can change, and whether custom colors are available.'
            )}
        >
            <Stack spacing={1.5} sx={{ width: { xs: '100%', sm: 360 }, minWidth: 0 }}>
                <FormControlLabel
                    control={
                        <Switch
                            checked={policy.editable.fillColor}
                            disabled={isSaving}
                            onChange={(event) => updateEditableProperty('fillColor', event.target.checked)}
                            slotProps={{ input: testIdInputProps('application-settings-cell-style-fill-color') }}
                        />
                    }
                    label={t('settings.matrix.cellStylePolicy.fillColor', 'Allow fill color changes')}
                />
                <FormControlLabel
                    control={
                        <Switch
                            checked={policy.editable.textColor}
                            disabled={isSaving}
                            onChange={(event) => updateEditableProperty('textColor', event.target.checked)}
                            slotProps={{ input: testIdInputProps('application-settings-cell-style-text-color') }}
                        />
                    }
                    label={t('settings.matrix.cellStylePolicy.textColor', 'Allow text color changes')}
                />
                <FormControlLabel
                    control={
                        <Switch
                            checked={policy.editable.borderColor}
                            disabled={isSaving}
                            onChange={(event) => updateEditableProperty('borderColor', event.target.checked)}
                            slotProps={{ input: testIdInputProps('application-settings-cell-style-border-color') }}
                        />
                    }
                    label={t('settings.matrix.cellStylePolicy.borderColor', 'Allow border color changes')}
                />
                <FormControlLabel
                    control={
                        <Switch
                            checked={policy.editable.borderWidth}
                            disabled={isSaving}
                            onChange={(event) => updateEditableProperty('borderWidth', event.target.checked)}
                            slotProps={{ input: testIdInputProps('application-settings-cell-style-border-width') }}
                        />
                    }
                    label={t('settings.matrix.cellStylePolicy.borderWidth', 'Allow border width changes')}
                />
                <FormControlLabel
                    control={
                        <Switch
                            checked={policy.editable.borderStyle}
                            disabled={isSaving}
                            onChange={(event) => updateEditableProperty('borderStyle', event.target.checked)}
                            slotProps={{ input: testIdInputProps('application-settings-cell-style-border-style') }}
                        />
                    }
                    label={t('settings.matrix.cellStylePolicy.borderStyle', 'Allow border style changes')}
                />
                <FormControlLabel
                    control={
                        <Switch
                            checked={policy.allowCustomColors}
                            disabled={isSaving}
                            onChange={(event) => updatePolicy({ allowCustomColors: event.target.checked })}
                            slotProps={{ input: testIdInputProps('application-settings-cell-style-custom-colors') }}
                        />
                    }
                    label={t('settings.matrix.cellStylePolicy.customColors', 'Allow custom colors')}
                />
                <Stack spacing={1}>
                    <Typography variant='subtitle2'>{t('settings.matrix.cellStylePolicy.allowedColors', 'Allowed colors')}</Typography>
                    {policy.allowedColors.length === 0 ? (
                        <Typography
                            variant='body2'
                            sx={{ color: 'text.secondary' }}
                            data-testid='application-settings-cell-style-empty-colors'
                        >
                            {t('settings.matrix.cellStylePolicy.noAllowedColors', 'No preset colors are available.')}
                        </Typography>
                    ) : (
                        policy.allowedColors.map((color, index) => (
                            <Stack key={color} direction='row' spacing={1} sx={{ alignItems: 'center' }}>
                                <Box
                                    aria-hidden='true'
                                    sx={{
                                        width: 24,
                                        height: 24,
                                        flex: '0 0 auto',
                                        bgcolor: color,
                                        border: 1,
                                        borderColor: 'divider',
                                        borderRadius: 0.75
                                    }}
                                />
                                <Typography variant='body2' sx={{ flex: 1, fontFamily: 'monospace' }}>
                                    {color}
                                </Typography>
                                <Button
                                    size='small'
                                    aria-label={t('settings.matrix.cellStylePolicy.moveColorUp', {
                                        defaultValue: 'Move {{color}} up',
                                        color
                                    })}
                                    disabled={isSaving || index === 0}
                                    onClick={() => moveColor(index, -1)}
                                >
                                    ↑
                                </Button>
                                <Button
                                    size='small'
                                    aria-label={t('settings.matrix.cellStylePolicy.moveColorDown', {
                                        defaultValue: 'Move {{color}} down',
                                        color
                                    })}
                                    disabled={isSaving || index === policy.allowedColors.length - 1}
                                    onClick={() => moveColor(index, 1)}
                                >
                                    ↓
                                </Button>
                                <Button
                                    size='small'
                                    color='inherit'
                                    aria-label={t('settings.matrix.cellStylePolicy.removeColor', {
                                        defaultValue: 'Remove {{color}}',
                                        color
                                    })}
                                    disabled={isSaving}
                                    onClick={() => removeColor(color)}
                                >
                                    {t('settings.matrix.remove', 'Remove')}
                                </Button>
                            </Stack>
                        ))
                    )}
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' }, width: '100%' }}>
                        <HexColorPickerPopover
                            id='application-settings-cell-style-new-color'
                            label={t('settings.matrix.cellStylePolicy.newColor', 'New color (HEX)')}
                            pickerLabel={t('settings.matrix.cellStylePolicy.colorPicker', {
                                label: t('settings.matrix.cellStylePolicy.newColor', 'New color (HEX)'),
                                defaultValue: 'Choose color for {{label}}'
                            })}
                            value={draftColor}
                            error={!normalizedDraftColor}
                            helperText={
                                normalizedDraftColor
                                    ? undefined
                                    : t('settings.matrix.cellStylePolicy.invalidHexColor', 'Enter a valid HEX color, such as #1E88E5.')
                            }
                            disabled={isSaving}
                            onChange={(value) => setDraftColor(value.toUpperCase())}
                            testId='application-settings-cell-style-new-color'
                            sx={{
                                flex: '1 1 180px',
                                minWidth: 0,
                                '& .MuiOutlinedInput-root': { height: 40, alignItems: 'center' }
                            }}
                        />
                        <Button
                            variant='outlined'
                            size='medium'
                            disabled={isSaving || !normalizedDraftColor || alreadyAllowed}
                            onClick={addAllowedColor}
                            data-testid='application-settings-cell-style-add-color'
                            sx={{ minHeight: 40, minWidth: { xs: '100%', sm: 112 } }}
                        >
                            {t('settings.matrix.cellStylePolicy.addColor', 'Add color')}
                        </Button>
                    </Stack>
                </Stack>
            </Stack>
        </SettingsRow>
    )
}
