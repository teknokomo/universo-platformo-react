import { useId, useState } from 'react'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import { Alert, Box, Button, FormControlLabel, FormHelperText, IconButton, Radio, RadioGroup, Stack, TextField } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { generateUuidV7, isUuidV7 } from '@universo-react/utils'
import { StandardDialog } from './dialogs/StandardDialog'
import {
    canSaveAssessmentOptionDrafts,
    createAssessmentOptionDraft,
    MAX_ASSESSMENT_OPTION_TEXT_LENGTH,
    readAssessmentOptionDrafts,
    resolveAssessmentOptionBounds,
    serializeAssessmentOptionDrafts
} from '../utils/assessmentOptions'
import type { AssessmentOptionDraft, AssessmentOptionValue } from '../utils/assessmentOptions'

export interface AssessmentOptionsEditorDialogProps {
    open: boolean
    value: unknown
    locale: string
    minOptions: number
    maxOptions: number
    onClose: () => void
    onSave: (options: AssessmentOptionValue[]) => void
}

const normalizeAssessmentOptionDraftIds = (options: AssessmentOptionDraft[]): AssessmentOptionDraft[] => {
    const usedIds = new Set<string>()

    return options.map((option) => {
        let id = option.id
        if (!isUuidV7(id) || usedIds.has(id.toLowerCase())) {
            do {
                id = generateUuidV7()
            } while (usedIds.has(id.toLowerCase()))
        }

        usedIds.add(id.toLowerCase())
        return id === option.id ? option : { ...option, id }
    })
}

export function AssessmentOptionsEditorDialog({
    open,
    value,
    locale,
    minOptions,
    maxOptions,
    onClose,
    onSave
}: AssessmentOptionsEditorDialogProps) {
    const { t } = useTranslation('quiz')
    const correctAnswerHelperId = useId()
    const bounds = resolveAssessmentOptionBounds({ minOptions, maxOptions })
    const [draft, setDraft] = useState<AssessmentOptionDraft[]>(() =>
        normalizeAssessmentOptionDraftIds(readAssessmentOptionDrafts(value, locale))
    )
    const correctOptions = draft.reduce((count, option) => count + Number(option.isCorrect), 0)
    const correctIndex = correctOptions === 1 ? draft.findIndex((option) => option.isCorrect) : -1
    const canSave = canSaveAssessmentOptionDrafts(draft, bounds)

    const setCorrectOption = (selectedIndex: number) => {
        setDraft((current) => current.map((option, index) => ({ ...option, isCorrect: index === selectedIndex })))
    }

    const addOption = () => {
        const newOption = createAssessmentOptionDraft(draft, locale)
        setDraft((current) => (current.length >= bounds.max ? current : [...current, newOption]))
    }

    const removeOption = (optionIndex: number) => {
        setDraft((current) => current.filter((_, index) => index !== optionIndex))
    }

    const moveOption = (index: number, offset: -1 | 1) => {
        setDraft((current) => {
            const targetIndex = index + offset
            if (targetIndex < 0 || targetIndex >= current.length) return current
            const next = [...current]
            ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
            return next
        })
    }

    const handleSave = () => {
        if (!canSave) return
        onSave(serializeAssessmentOptionDrafts(draft, locale))
    }

    const helpText =
        bounds.min === bounds.max
            ? t('optionsEditor.helpExact', { count: bounds.min })
            : t('optionsEditor.help', {
                  min: bounds.min,
                  max: bounds.max
              })

    return (
        <StandardDialog
            open={open}
            onClose={onClose}
            title={t('optionsEditor.dialogTitle')}
            maxWidth='md'
            actions={
                <>
                    <Button onClick={onClose}>{t('optionsEditor.cancel')}</Button>
                    <Button variant='contained' onClick={handleSave} disabled={!canSave}>
                        {t('optionsEditor.save')}
                    </Button>
                </>
            }
        >
            <Stack spacing={2} sx={{ pt: 1, minWidth: 0 }}>
                <Alert severity='info'>{helpText}</Alert>
                <RadioGroup
                    aria-label={t('optionsEditor.correctAnswerGroup')}
                    aria-describedby={correctOptions !== 1 ? correctAnswerHelperId : undefined}
                    aria-invalid={correctOptions !== 1}
                    value={correctIndex < 0 ? '' : String(correctIndex)}
                    onChange={(_, selectedIndex) => setCorrectOption(Number(selectedIndex))}
                >
                    <Stack spacing={1.5}>
                        {draft.map((option, index) => (
                            <Stack
                                key={option.id}
                                direction={{ xs: 'column', sm: 'row' }}
                                spacing={1}
                                sx={{ minWidth: 0, alignItems: { xs: 'stretch', sm: 'center' } }}
                            >
                                <FormControlLabel
                                    value={String(index)}
                                    control={<Radio />}
                                    label={t('optionsEditor.correctAnswerOption', { number: index + 1 })}
                                    sx={{ minWidth: { sm: 180 }, m: 0 }}
                                />
                                <TextField
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    maxRows={3}
                                    required
                                    error={!option.text.trim()}
                                    helperText={!option.text.trim() ? t('optionsEditor.optionRequired') : undefined}
                                    label={t('optionsEditor.optionLabel', { number: index + 1 })}
                                    value={option.text}
                                    onChange={(event) =>
                                        setDraft((current) =>
                                            current.map((item, itemIndex) =>
                                                itemIndex === index ? { ...item, text: event.target.value } : item
                                            )
                                        )
                                    }
                                    slotProps={{ htmlInput: { maxLength: MAX_ASSESSMENT_OPTION_TEXT_LENGTH, rows: 2 } }}
                                />
                                <Stack direction='row' spacing={0.25} sx={{ justifyContent: 'flex-end', flexShrink: 0 }}>
                                    <IconButton
                                        aria-label={t('optionsEditor.moveUp', { number: index + 1 })}
                                        disabled={index === 0}
                                        onClick={() => moveOption(index, -1)}
                                    >
                                        <ArrowUpwardRoundedIcon />
                                    </IconButton>
                                    <IconButton
                                        aria-label={t('optionsEditor.moveDown', { number: index + 1 })}
                                        disabled={index === draft.length - 1}
                                        onClick={() => moveOption(index, 1)}
                                    >
                                        <ArrowDownwardRoundedIcon />
                                    </IconButton>
                                    <IconButton
                                        aria-label={t('optionsEditor.remove', { number: index + 1 })}
                                        disabled={draft.length <= bounds.min}
                                        onClick={() => removeOption(index)}
                                    >
                                        <DeleteOutlineRoundedIcon />
                                    </IconButton>
                                </Stack>
                            </Stack>
                        ))}
                    </Stack>
                </RadioGroup>
                {correctOptions !== 1 && (
                    <FormHelperText id={correctAnswerHelperId} error role='alert'>
                        {t('optionsEditor.correctAnswerRequired')}
                    </FormHelperText>
                )}
                <Box>
                    <Button startIcon={<AddRoundedIcon />} onClick={addOption} disabled={draft.length >= bounds.max}>
                        {t('optionsEditor.add')}
                    </Button>
                </Box>
            </Stack>
        </StandardDialog>
    )
}
