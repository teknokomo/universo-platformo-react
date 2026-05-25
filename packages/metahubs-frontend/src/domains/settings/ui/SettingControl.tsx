/**
 * Universo Platformo | Setting Control
 *
 * Renders the appropriate MUI control for a setting based on its valueType.
 * Supports: boolean (Switch), select, multiselect, string, number.
 */

import { useCallback } from 'react'
import {
    Switch,
    FormControlLabel,
    Select,
    MenuItem,
    TextField,
    FormGroup,
    Checkbox,
    FormControl,
    InputLabel,
    Box,
    SelectChangeEvent
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { buildEntitySurfaceSettingKey } from '@universo/types'

export interface SettingControlProps {
    /** Setting key (dot-notation, e.g. 'general.codenameStyle') */
    settingKey: string
    /** Value type from the registry */
    valueType: string
    /** Current effective value */
    value: unknown
    /** Available options for select / multiselect */
    options?: readonly string[]
    /** Callback when value changes */
    onChange: (newValue: unknown) => void
    /** Whether the control is disabled */
    disabled?: boolean
}

const SettingControl = ({ settingKey, valueType, value, options, onChange, disabled }: SettingControlProps) => {
    const { t } = useTranslation('metahubs')

    const handleSwitchChange = useCallback(
        (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
            onChange(checked)
        },
        [onChange]
    )

    const handleSelectChange = useCallback(
        (event: SelectChangeEvent<string>) => {
            onChange(event.target.value)
        },
        [onChange]
    )

    const handleMultiselectToggle = useCallback(
        (option: string) => {
            const current = Array.isArray(value) ? (value as string[]) : []
            const next = current.includes(option) ? current.filter((v) => v !== option) : [...current, option]
            onChange(next)
        },
        [value, onChange]
    )

    const handleTextChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            onChange(valueType === 'number' ? Number(event.target.value) : event.target.value)
        },
        [valueType, onChange]
    )

    const isCompactMultiselect = settingKey === buildEntitySurfaceSettingKey('objectCollection', 'allowedComponentTypes')

    switch (valueType) {
        case 'boolean':
            return (
                <FormControlLabel
                    control={<Switch checked={Boolean(value)} onChange={handleSwitchChange} disabled={disabled} />}
                    label=''
                    sx={{ ml: 0 }}
                />
            )

        case 'select':
            return (
                <FormControl size='small' sx={{ minWidth: 240 }} disabled={disabled}>
                    <InputLabel id={`setting-${settingKey}-label`}>{t(`settings.keys.${settingKey}`)}</InputLabel>
                    <Select
                        labelId={`setting-${settingKey}-label`}
                        value={typeof value === 'string' ? value : ''}
                        onChange={handleSelectChange}
                        label={t(`settings.keys.${settingKey}`)}
                    >
                        {(options ?? []).map((opt) => {
                            // Try to find a translated label; fallback to raw option
                            const labelKey = getOptionLabelKey(settingKey, opt)
                            const label = t(labelKey, { defaultValue: opt })
                            return (
                                <MenuItem key={opt} value={opt}>
                                    {label}
                                </MenuItem>
                            )
                        })}
                    </Select>
                </FormControl>
            )

        case 'multiselect':
            return (
                <FormGroup>
                    <Box
                        sx={
                            isCompactMultiselect
                                ? {
                                      display: 'flex',
                                      flexDirection: 'row',
                                      flexWrap: 'wrap',
                                      rowGap: 0.5,
                                      columnGap: 1.5,
                                      maxWidth: 520
                                  }
                                : { display: 'flex', flexDirection: 'column', gap: 0.5 }
                        }
                    >
                        {(options ?? []).map((opt) => {
                            const checked = Array.isArray(value) && (value as string[]).includes(opt)
                            const labelKey = getOptionLabelKey(settingKey, opt)
                            const label = t(labelKey, { defaultValue: opt })
                            return (
                                <FormControlLabel
                                    key={opt}
                                    control={
                                        <Checkbox
                                            checked={checked}
                                            onChange={() => handleMultiselectToggle(opt)}
                                            size='small'
                                            disabled={disabled}
                                        />
                                    }
                                    label={label}
                                    sx={isCompactMultiselect ? { ml: 0, mr: 0 } : { ml: 0 }}
                                />
                            )
                        })}
                    </Box>
                </FormGroup>
            )

        case 'number':
            return (
                <TextField
                    size='small'
                    type='number'
                    value={typeof value === 'number' ? value : ''}
                    onChange={handleTextChange}
                    disabled={disabled}
                    sx={{ minWidth: 160 }}
                />
            )

        case 'string':
        default:
            return (
                <TextField
                    size='small'
                    value={typeof value === 'string' ? value : ''}
                    onChange={handleTextChange}
                    disabled={disabled}
                    sx={{ minWidth: 240 }}
                />
            )
    }
}

/**
 * Map a setting key + option value to the corresponding i18n label key.
 * For example:
 *   'general.codenameStyle' + 'kebab-case' → 'settings.codenameStyles.kebab-case'
 *   'entity.object.componentCodenameScope' + 'per-level' → 'settings.componentCodenameScopes.per-level'
 */
function getOptionLabelKey(settingKey: string, option: string): string {
    if (settingKey === 'general.codenameStyle') {
        return `settings.codenameStyles.${option}`
    }
    if (settingKey === 'general.codenameAlphabet') {
        return `settings.codenameAlphabets.${option}`
    }
    if (settingKey === buildEntitySurfaceSettingKey('objectCollection', 'componentCodenameScope')) {
        return `settings.componentCodenameScopes.${option}`
    }
    if (settingKey === buildEntitySurfaceSettingKey('objectCollection', 'allowedComponentTypes')) {
        return `components.dataTypeOptions.${option.toLowerCase()}`
    }
    if (settingKey === buildEntitySurfaceSettingKey('valueGroup', 'constantCodenameScope')) {
        return `settings.componentCodenameScopes.${option}`
    }
    if (settingKey === buildEntitySurfaceSettingKey('valueGroup', 'allowedConstantTypes')) {
        return `components.dataTypeOptions.${option.toLowerCase()}`
    }
    if (settingKey === 'general.language') {
        return `settings.languages.${option}`
    }
    if (settingKey === 'common.dialogSizePreset') {
        return `settings.dialogSizePresets.${option}`
    }
    if (settingKey === 'common.dialogCloseBehavior') {
        return `settings.dialogCloseBehaviors.${option}`
    }
    return option
}

export default SettingControl
