import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DeleteIcon from '@mui/icons-material/Delete'
import { Box, Button, Checkbox, FormControlLabel, FormHelperText, IconButton, Stack, Switch, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { HexColorPickerPopover } from '@universo-react/template-mui'
import {
    INTERPRETATION_NETWORK_DEFAULT_CELL_STYLE_COLORS,
    type InterpretationNetworkCellStylePolicy,
    type InterpretationNetworkWorkspaceWidgetConfig
} from '@universo-react/types'

import {
    normalizeCellStyleColor,
    normalizeCellStylePolicy,
    type InterpretationNetworkWorkspaceWidgetConfigDraftSetter
} from './interpretationNetworkWorkspaceWidgetEditorDialogConfig'

interface InterpretationNetworkWorkspaceWidgetEditorDialogCellStyleSectionProps {
    draft: InterpretationNetworkWorkspaceWidgetConfig
    setDraft: InterpretationNetworkWorkspaceWidgetConfigDraftSetter
    newCellStyleColor: string
    setNewCellStyleColor: (color: string) => void
}

export default function InterpretationNetworkWorkspaceWidgetEditorDialogCellStyleSection({
    draft,
    setDraft,
    newCellStyleColor,
    setNewCellStyleColor
}: InterpretationNetworkWorkspaceWidgetEditorDialogCellStyleSectionProps) {
    const { t } = useTranslation('metahubs')
    const cellStylePolicy = normalizeCellStylePolicy(draft.cellStylePolicy)
    const normalizedNewCellStyleColor = normalizeCellStyleColor(newCellStyleColor)
    const hasNewCellStyleColorValue = newCellStyleColor.trim().length > 0
    const isInvalidNewCellStyleColor = hasNewCellStyleColorValue && normalizedNewCellStyleColor === undefined
    const isDuplicateNewCellStyleColor =
        normalizedNewCellStyleColor !== undefined && cellStylePolicy.allowedColors.includes(normalizedNewCellStyleColor)
    const newCellStyleColorHelperText = isInvalidNewCellStyleColor
        ? t('layouts.interpretationNetworkEditor.cellStylePolicy.invalidColor', 'Enter a valid HEX color, such as #336C9E.')
        : isDuplicateNewCellStyleColor
        ? t('layouts.interpretationNetworkEditor.cellStylePolicy.duplicateColor', 'This color is already in the palette.')
        : undefined
    const canAddNewCellStyleColor =
        normalizedNewCellStyleColor !== undefined && !cellStylePolicy.allowedColors.includes(normalizedNewCellStyleColor)

    const updateCellStylePolicy = (update: (current: InterpretationNetworkCellStylePolicy) => InterpretationNetworkCellStylePolicy) => {
        setDraft((current) => ({
            ...current,
            cellStylePolicy: normalizeCellStylePolicy(update(normalizeCellStylePolicy(current.cellStylePolicy)))
        }))
    }

    const addCellStyleColor = (color: string) => {
        updateCellStylePolicy((current) => ({
            ...current,
            allowedColors: [...current.allowedColors, color]
        }))
    }

    const moveCellStyleColor = (index: number, offset: -1 | 1) => {
        updateCellStylePolicy((current) => {
            const destination = index + offset
            if (destination < 0 || destination >= current.allowedColors.length) {
                return current
            }

            const allowedColors = [...current.allowedColors]
            ;[allowedColors[index], allowedColors[destination]] = [allowedColors[destination], allowedColors[index]]
            return { ...current, allowedColors }
        })
    }

    return (
        <>
            <Stack spacing={1.25}>
                <Stack spacing={0.5}>
                    <Typography variant='subtitle2'>
                        {t('layouts.interpretationNetworkEditor.cellStylePolicy.title', 'Cell styles')}
                    </Typography>
                    <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                        {t(
                            'layouts.interpretationNetworkEditor.cellStylePolicy.description',
                            'Control which colors and cell properties users can change.'
                        )}
                    </Typography>
                </Stack>

                <FormControlLabel
                    control={
                        <Switch
                            checked={cellStylePolicy.allowCustomColors}
                            onChange={(event) =>
                                updateCellStylePolicy((current) => ({ ...current, allowCustomColors: event.target.checked }))
                            }
                            slotProps={{
                                input: {
                                    'aria-label': t(
                                        'layouts.interpretationNetworkEditor.cellStylePolicy.allowCustomColors',
                                        'Allow custom colors'
                                    )
                                }
                            }}
                        />
                    }
                    label={t('layouts.interpretationNetworkEditor.cellStylePolicy.allowCustomColors', 'Allow custom colors')}
                />
                <FormHelperText>
                    {t(
                        'layouts.interpretationNetworkEditor.cellStylePolicy.allowCustomColorsHelp',
                        'When enabled, users can choose colors outside the preset list.'
                    )}
                </FormHelperText>

                <Stack spacing={0.75}>
                    <Typography variant='body2' sx={{ fontWeight: 600 }}>
                        {t('layouts.interpretationNetworkEditor.cellStylePolicy.allowedColors', 'Allowed colors')}
                    </Typography>
                    <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                        {t(
                            'layouts.interpretationNetworkEditor.cellStylePolicy.allowedColorsHelp',
                            'Set the ordered preset palette available for cell styles.'
                        )}
                    </Typography>
                    {cellStylePolicy.allowedColors.length === 0 ? (
                        <FormHelperText>
                            {t(
                                'layouts.interpretationNetworkEditor.cellStylePolicy.emptyColors',
                                'The preset list is empty. Users can use custom colors only when enabled.'
                            )}
                        </FormHelperText>
                    ) : (
                        <Stack
                            spacing={0.75}
                            role='list'
                            aria-label={t('layouts.interpretationNetworkEditor.cellStylePolicy.allowedColors', 'Allowed colors')}
                        >
                            {cellStylePolicy.allowedColors.map((color, index) => (
                                <Stack
                                    key={color}
                                    role='listitem'
                                    direction={{ xs: 'column', sm: 'row' }}
                                    spacing={0.75}
                                    sx={{
                                        p: 1,
                                        border: 1,
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                        alignItems: { sm: 'center' },
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <Stack direction='row' spacing={1} sx={{ alignItems: 'center' }}>
                                        <Box
                                            component='span'
                                            aria-hidden='true'
                                            sx={{
                                                width: 24,
                                                height: 24,
                                                flex: '0 0 auto',
                                                borderRadius: 0.75,
                                                border: 1,
                                                borderColor: 'divider',
                                                backgroundColor: color
                                            }}
                                        />
                                        <Typography component='span' variant='body2'>
                                            {color}
                                        </Typography>
                                    </Stack>
                                    <Stack direction='row' spacing={0.5}>
                                        <IconButton
                                            size='small'
                                            aria-label={t('layouts.interpretationNetworkEditor.cellStylePolicy.moveColorUp', {
                                                color
                                            })}
                                            disabled={index === 0}
                                            onClick={() => moveCellStyleColor(index, -1)}
                                        >
                                            <ArrowUpwardIcon fontSize='small' />
                                        </IconButton>
                                        <IconButton
                                            size='small'
                                            aria-label={t('layouts.interpretationNetworkEditor.cellStylePolicy.moveColorDown', {
                                                color
                                            })}
                                            disabled={index === cellStylePolicy.allowedColors.length - 1}
                                            onClick={() => moveCellStyleColor(index, 1)}
                                        >
                                            <ArrowDownwardIcon fontSize='small' />
                                        </IconButton>
                                        <IconButton
                                            size='small'
                                            aria-label={t('layouts.interpretationNetworkEditor.cellStylePolicy.removeColor', {
                                                color
                                            })}
                                            onClick={() =>
                                                updateCellStylePolicy((current) => ({
                                                    ...current,
                                                    allowedColors: current.allowedColors.filter((item) => item !== color)
                                                }))
                                            }
                                        >
                                            <DeleteIcon fontSize='small' />
                                        </IconButton>
                                    </Stack>
                                </Stack>
                            ))}
                        </Stack>
                    )}
                </Stack>

                <Stack spacing={0.75}>
                    <Typography variant='body2' sx={{ fontWeight: 600 }}>
                        {t('layouts.interpretationNetworkEditor.cellStylePolicy.palette', 'Default palette')}
                    </Typography>
                    <Stack
                        direction='row'
                        role='group'
                        aria-label={t('layouts.interpretationNetworkEditor.cellStylePolicy.palette', 'Default palette')}
                        sx={{ flexWrap: 'wrap', gap: 0.5 }}
                    >
                        {INTERPRETATION_NETWORK_DEFAULT_CELL_STYLE_COLORS.map((color) => {
                            const normalizedColor = normalizeCellStyleColor(color) ?? color
                            const isAllowed = cellStylePolicy.allowedColors.includes(normalizedColor)
                            return (
                                <IconButton
                                    key={color}
                                    size='small'
                                    aria-label={t('layouts.interpretationNetworkEditor.cellStylePolicy.addPaletteColor', { color })}
                                    disabled={isAllowed}
                                    onClick={() => addCellStyleColor(color)}
                                    sx={{ width: 40, height: 40, border: 1, borderColor: 'divider' }}
                                >
                                    <Box
                                        component='span'
                                        aria-hidden='true'
                                        sx={{
                                            width: 22,
                                            height: 22,
                                            borderRadius: 0.75,
                                            border: 1,
                                            borderColor: 'divider',
                                            backgroundColor: color
                                        }}
                                    />
                                </IconButton>
                            )
                        })}
                    </Stack>
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ alignItems: { sm: 'center' } }}>
                    <HexColorPickerPopover
                        id='interpretation-network-custom-cell-color'
                        size='small'
                        label={t('layouts.interpretationNetworkEditor.cellStylePolicy.customColor', 'Custom color (HEX)')}
                        pickerLabel={t('layouts.interpretationNetworkEditor.cellStylePolicy.colorPicker', 'Choose custom color')}
                        value={newCellStyleColor}
                        error={isInvalidNewCellStyleColor}
                        helperText={newCellStyleColorHelperText}
                        onChange={setNewCellStyleColor}
                        sx={{ flex: '1 1 240px', minWidth: 0 }}
                        testId='interpretation-network-custom-cell-color'
                    />
                    <Button
                        variant='outlined'
                        startIcon={<AddIcon />}
                        disabled={!canAddNewCellStyleColor}
                        onClick={() => {
                            if (normalizedNewCellStyleColor) {
                                addCellStyleColor(normalizedNewCellStyleColor)
                            }
                        }}
                    >
                        {t('layouts.interpretationNetworkEditor.cellStylePolicy.addCustomColor', 'Add custom color')}
                    </Button>
                </Stack>

                <Stack spacing={0.25}>
                    <Typography variant='body2' sx={{ fontWeight: 600 }}>
                        {t('layouts.interpretationNetworkEditor.cellStylePolicy.editable.title', 'Editable properties')}
                    </Typography>
                    {(['fillColor', 'textColor', 'borderColor', 'borderWidth', 'borderStyle'] as const).map((property) => (
                        <FormControlLabel
                            key={property}
                            sx={{ m: 0 }}
                            control={
                                <Checkbox
                                    checked={cellStylePolicy.editable[property]}
                                    onChange={(_, checked) =>
                                        updateCellStylePolicy((current) => ({
                                            ...current,
                                            editable: {
                                                ...current.editable,
                                                [property]: checked
                                            }
                                        }))
                                    }
                                    slotProps={{
                                        input: {
                                            'aria-label': t(`layouts.interpretationNetworkEditor.cellStylePolicy.editable.${property}`)
                                        }
                                    }}
                                />
                            }
                            label={t(`layouts.interpretationNetworkEditor.cellStylePolicy.editable.${property}`)}
                        />
                    ))}
                </Stack>
            </Stack>
        </>
    )
}
