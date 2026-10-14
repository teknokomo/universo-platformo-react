import { useEffect, useMemo, useState } from 'react'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import { Alert, Box, Button, FormControlLabel, IconButton, Radio, RadioGroup, Stack, TextField } from '@mui/material'
import type { LocaleCode, VersionedLocalizedContent } from '@universo-react/types'
import { generateUuidV7, getVLCString, isUuidV7, updateLocalizedContentLocale } from '@universo-react/utils'
import { StandardDialog } from '@universo-react/template-mui/components/dialogs'
import { useTranslation } from 'react-i18next'

const DEFAULT_MIN_OPTIONS = 2
const DEFAULT_MAX_OPTIONS = 20
const MAX_OPTION_LABEL_LENGTH = 2000

type AssessmentOption = {
    id: string
    label: unknown
    isCorrect: boolean
}

type AssessmentOptionDraft = AssessmentOption & { text: string }

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const getLocaleCode = (locale: string): LocaleCode => locale.split(/[-_]/)[0].toLowerCase() as LocaleCode

const readOptionText = (value: unknown, locale: string): string => {
    if (typeof value === 'string') return value
    if (!isRecord(value)) return ''
    return getVLCString(value as Parameters<typeof getVLCString>[0], locale)
}

const writeOptionText = (original: unknown, text: string, locale: LocaleCode): unknown => {
    if (!isRecord(original)) return text

    if (isRecord(original.locales)) {
        return updateLocalizedContentLocale(original as unknown as VersionedLocalizedContent<string>, locale, text)
    }

    if (Object.values(original).every((entry) => typeof entry === 'string')) {
        return { ...original, [locale]: text }
    }

    return text
}

const readOptions = (value: unknown, locale: string): AssessmentOptionDraft[] => {
    if (!Array.isArray(value)) return []

    const usedIds = new Set<string>()
    return value.filter(isRecord).map((raw) => {
        const existingId = typeof raw.id === 'string' && raw.id.trim() ? raw.id : null
        const id = existingId && isUuidV7(existingId) && !usedIds.has(existingId) ? existingId : generateUuidV7()
        usedIds.add(id)
        const label = raw.label ?? raw.text ?? ''
        return {
            id,
            label,
            text: readOptionText(label, locale),
            isCorrect: raw.isCorrect === true || raw.is_correct === true
        }
    })
}

export interface AssessmentOptionsEditorDialogProps {
    open: boolean
    value: unknown
    locale: string
    minOptions?: number
    maxOptions?: number
    onClose: () => void
    onSave: (options: AssessmentOption[]) => void
}

export function AssessmentOptionsEditorDialog({
    open,
    value,
    locale,
    minOptions = DEFAULT_MIN_OPTIONS,
    maxOptions = DEFAULT_MAX_OPTIONS,
    onClose,
    onSave
}: AssessmentOptionsEditorDialogProps) {
    const { t } = useTranslation(['metahubs', 'common'])
    const [draft, setDraft] = useState<AssessmentOptionDraft[]>([])
    const normalizedLocale = useMemo(() => getLocaleCode(locale), [locale])
    const resolvedMinOptions = Number.isInteger(minOptions) && minOptions >= 1 ? minOptions : DEFAULT_MIN_OPTIONS
    const resolvedMaxOptions =
        Number.isInteger(maxOptions) && maxOptions >= resolvedMinOptions ? maxOptions : Math.max(DEFAULT_MAX_OPTIONS, resolvedMinOptions)

    useEffect(() => {
        if (open) setDraft(readOptions(value, locale))
    }, [locale, open, value])

    const canSave =
        draft.length >= resolvedMinOptions &&
        draft.length <= resolvedMaxOptions &&
        draft.every((option) => option.text.trim().length > 0 && option.text.length <= MAX_OPTION_LABEL_LENGTH) &&
        draft.filter((option) => option.isCorrect).length === 1

    const setCorrectOption = (optionId: string) => {
        setDraft((current) => current.map((option) => ({ ...option, isCorrect: option.id === optionId })))
    }

    const addOption = () => {
        if (draft.length >= resolvedMaxOptions) return
        setDraft((current) => [...current, { id: generateUuidV7(), label: '', text: '', isCorrect: false }])
    }

    const removeOption = (optionId: string) => {
        setDraft((current) => current.filter((option) => option.id !== optionId))
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
        onSave(
            draft.map(({ id, label, text, isCorrect }) => ({
                id,
                label: writeOptionText(label, text.trim(), normalizedLocale),
                isCorrect
            }))
        )
    }

    const helpText =
        resolvedMinOptions === resolvedMaxOptions
            ? t(
                  'records.table.assessmentOptions.helpExact',
                  'Add exactly {{count}} non-empty options and mark exactly one correct answer.',
                  {
                      count: resolvedMinOptions
                  }
              )
            : t(
                  'records.table.assessmentOptions.help',
                  'Add between {{minOptions}} and {{maxOptions}} non-empty options and mark exactly one correct answer.',
                  {
                      minOptions: resolvedMinOptions,
                      maxOptions: resolvedMaxOptions
                  }
              )

    return (
        <StandardDialog
            open={open}
            onClose={onClose}
            title={t('records.table.assessmentOptions.title', 'Answer options')}
            maxWidth='md'
            actions={
                <>
                    <Button onClick={onClose}>{t('records.table.cancel', 'Cancel')}</Button>
                    <Button variant='contained' onClick={handleSave} disabled={!canSave}>
                        {t('common:save', 'Save')}
                    </Button>
                </>
            }
        >
            <Stack spacing={2} sx={{ pt: 1 }}>
                <Alert severity='info'>{helpText}</Alert>
                <RadioGroup
                    aria-label={t('records.table.assessmentOptions.correctAnswer', 'Correct answer')}
                    value={draft.find((option) => option.isCorrect)?.id ?? ''}
                    onChange={(_, optionId) => setCorrectOption(optionId)}
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
                                    value={option.id}
                                    control={<Radio />}
                                    label={t('records.table.assessmentOptions.correct', 'Option {{number}} is correct', {
                                        number: index + 1
                                    })}
                                    sx={{ minWidth: { sm: 112 }, m: 0 }}
                                />
                                <TextField
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    maxRows={3}
                                    label={t('records.table.assessmentOptions.optionLabel', 'Option {{number}}', { number: index + 1 })}
                                    value={option.text}
                                    onChange={(event) =>
                                        setDraft((current) =>
                                            current.map((item) => (item.id === option.id ? { ...item, text: event.target.value } : item))
                                        )
                                    }
                                    slotProps={{ htmlInput: { maxLength: MAX_OPTION_LABEL_LENGTH, rows: 2 } }}
                                />
                                <Stack direction='row' spacing={0.25} sx={{ justifyContent: 'flex-end' }}>
                                    <IconButton
                                        aria-label={t('records.table.assessmentOptions.moveUp', 'Move option {{number}} up', {
                                            number: index + 1
                                        })}
                                        disabled={index === 0}
                                        onClick={() => moveOption(index, -1)}
                                    >
                                        <ArrowUpwardRoundedIcon />
                                    </IconButton>
                                    <IconButton
                                        aria-label={t('records.table.assessmentOptions.moveDown', 'Move option {{number}} down', {
                                            number: index + 1
                                        })}
                                        disabled={index === draft.length - 1}
                                        onClick={() => moveOption(index, 1)}
                                    >
                                        <ArrowDownwardRoundedIcon />
                                    </IconButton>
                                    <IconButton
                                        aria-label={t('records.table.assessmentOptions.remove', 'Remove option {{number}}', {
                                            number: index + 1
                                        })}
                                        disabled={draft.length <= resolvedMinOptions}
                                        onClick={() => removeOption(option.id)}
                                    >
                                        <DeleteOutlineRoundedIcon />
                                    </IconButton>
                                </Stack>
                            </Stack>
                        ))}
                    </Stack>
                </RadioGroup>
                <Box>
                    <Button startIcon={<AddRoundedIcon />} onClick={addOption} disabled={draft.length >= resolvedMaxOptions}>
                        {t('records.table.assessmentOptions.add', 'Add option')}
                    </Button>
                </Box>
            </Stack>
        </StandardDialog>
    )
}

export default AssessmentOptionsEditorDialog
