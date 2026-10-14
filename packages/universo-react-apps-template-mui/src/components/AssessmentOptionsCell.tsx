import { useState } from 'react'
import Button from '@mui/material/Button'
import { useTranslation } from 'react-i18next'
import { getAssessmentOptionCount, resolveAssessmentOptionBounds } from '../utils/assessmentOptions'
import type { AssessmentOptionValue } from '../utils/assessmentOptions'
import { AssessmentOptionsEditorDialog } from './AssessmentOptionsEditorDialog'

export interface AssessmentOptionsCellProps {
    value: unknown
    locale: string
    minOptions?: unknown
    maxOptions?: unknown
    tabIndex: 0 | -1
    onSave?: (options: AssessmentOptionValue[]) => void
}

export function AssessmentOptionsCell({ value, locale, minOptions, maxOptions, tabIndex, onSave }: AssessmentOptionsCellProps) {
    const { t } = useTranslation('quiz')
    const [open, setOpen] = useState(false)
    const count = getAssessmentOptionCount(value)
    const bounds = resolveAssessmentOptionBounds({ minOptions, maxOptions })

    return (
        <>
            <Button
                size='small'
                variant='text'
                tabIndex={tabIndex}
                disabled={!onSave}
                onClick={(event) => {
                    event.stopPropagation()
                    setOpen(true)
                }}
            >
                {t('optionsEditor.editAnswers', { count })}
            </Button>
            {open ? (
                <AssessmentOptionsEditorDialog
                    open={open}
                    value={value}
                    locale={locale}
                    minOptions={bounds.min}
                    maxOptions={bounds.max}
                    onClose={() => setOpen(false)}
                    onSave={(options) => {
                        onSave?.(options)
                        setOpen(false)
                    }}
                />
            ) : null}
        </>
    )
}
