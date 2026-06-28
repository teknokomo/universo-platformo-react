import { useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import type { TFunction } from 'i18next'
import type { VersionedLocalizedContent } from '@universo-react/types'
import { createLocalizedContent, normalizeLocale } from '@universo-react/utils'
import { LocalizedInlineField } from '../../../components/forms/LocalizedInlineField'
import { CellStyleDialogField } from '../../../components/dialogs/CellStyleDialogField'
import type { FieldConfig } from '../../../components/dialogs/FormDialog'

type CellEditDialogMode = 'create' | 'edit'

export interface CellEditDialogProps {
    open: boolean
    mode: CellEditDialogMode
    t: TFunction<'interpretationNetwork'>
    locale: string
    fields: FieldConfig[]
    styleFields: FieldConfig[]
    initialData: Record<string, unknown>
    isSubmitting: boolean
    error?: string | null
    onClose: () => void
    onSubmit: (data: Record<string, unknown>) => Promise<void>
}

const findField = (fields: FieldConfig[], codename: string): FieldConfig | undefined =>
    fields.find((field) => field.codename === codename || field.id === codename)

const readInitialValue = (initialData: Record<string, unknown>, field: FieldConfig | undefined): unknown =>
    field?.id ? initialData[field.id] ?? initialData[field.codename ?? ''] : undefined

const isLocalizedValue = (value: unknown): value is VersionedLocalizedContent<string> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'locales' in value)

const toLocalizedValue = (value: unknown, locale: string): VersionedLocalizedContent<string> => {
    if (isLocalizedValue(value)) return value
    return createLocalizedContent(locale, typeof value === 'string' ? value : '')
}

export function CellEditDialog({
    open,
    mode,
    t,
    locale,
    fields,
    styleFields,
    initialData,
    isSubmitting,
    error,
    onClose,
    onSubmit
}: CellEditDialogProps) {
    const normalizedLocale = normalizeLocale(locale)
    const titleField = useMemo(() => findField(fields, 'CellValue'), [fields])
    const descriptionField = useMemo(() => findField(fields, 'CellDescription'), [fields])
    const [tab, setTab] = useState<'basic' | 'style'>('basic')
    const [draft, setDraft] = useState<Record<string, unknown>>({})

    useEffect(() => {
        if (!open) return
        const titleValue = toLocalizedValue(readInitialValue(initialData, titleField), normalizedLocale)
        const descriptionValue = toLocalizedValue(readInitialValue(initialData, descriptionField), normalizedLocale)
        setDraft({
            ...Object.fromEntries(styleFields.map((field) => [field.id, initialData[field.id] ?? initialData[field.codename ?? '']])),
            ...(titleField?.id ? { [titleField.id]: titleValue } : {}),
            ...(descriptionField?.id ? { [descriptionField.id]: descriptionValue } : {})
        })
        setTab('basic')
    }, [descriptionField, initialData, normalizedLocale, open, styleFields, titleField])

    const handleFieldChange = (field: FieldConfig | undefined, value: unknown) => {
        if (!field?.id) return
        setDraft((prev) => ({ ...prev, [field.id]: value }))
    }

    const handleSubmit = async () => {
        await onSubmit(draft)
    }

    return (
        <Dialog open={open} onClose={isSubmitting ? undefined : onClose} maxWidth='sm' fullWidth>
            <DialogTitle>
                {mode === 'edit' ? t('workspace.cell.editTitle', 'Edit cell') : t('workspace.cell.createTitle', 'Add cell')}
            </DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ pt: 0.5 }}>
                    {error ? <Alert severity='error'>{error}</Alert> : null}
                    <Tabs value={tab} onChange={(_event, next) => setTab(next)} aria-label={t('workspace.cell.tabs', 'Cell settings')}>
                        <Tab value='basic' label={t('workspace.cell.basicTab', 'Basic')} />
                        <Tab value='style' label={t('workspace.cell.styleTab', 'Style')} />
                    </Tabs>
                    {tab === 'basic' ? (
                        <Stack spacing={2}>
                            {titleField ? (
                                <LocalizedInlineField
                                    mode='localized'
                                    label={t('workspace.cell.titleField', 'Title')}
                                    value={toLocalizedValue(draft[titleField.id], normalizedLocale)}
                                    onChange={(value) => handleFieldChange(titleField, value)}
                                    uiLocale={normalizedLocale}
                                    required
                                    size='small'
                                />
                            ) : null}
                            {descriptionField ? (
                                <LocalizedInlineField
                                    mode='localized'
                                    label={t('workspace.cell.descriptionField', 'Description')}
                                    value={toLocalizedValue(draft[descriptionField.id], normalizedLocale)}
                                    onChange={(value) => handleFieldChange(descriptionField, value)}
                                    uiLocale={normalizedLocale}
                                    multiline
                                    rows={4}
                                    size='small'
                                />
                            ) : null}
                            {!titleField && !descriptionField ? (
                                <Alert severity='warning'>
                                    {t('workspace.cell.metadataUnavailable', 'Cell metadata fields are not available.')}
                                </Alert>
                            ) : null}
                        </Stack>
                    ) : null}
                    {tab === 'style' ? (
                        <Stack spacing={2}>
                            {styleFields.length > 0 ? (
                                styleFields.map((field) => (
                                    <Box key={field.id}>
                                        <CellStyleDialogField
                                            field={field}
                                            value={draft[field.id]}
                                            onChange={(value) => handleFieldChange(field, value)}
                                            disabled={isSubmitting}
                                        />
                                    </Box>
                                ))
                            ) : (
                                <Alert severity='info'>
                                    {t('workspace.cellStyle.unavailable', 'Cell style fields are not available.')}
                                </Alert>
                            )}
                        </Stack>
                    ) : null}
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button type='button' onClick={onClose} disabled={isSubmitting} color='inherit'>
                    {t('workspace.actions.cancel', 'Cancel')}
                </Button>
                <Button type='button' onClick={handleSubmit} disabled={isSubmitting} variant='contained'>
                    {mode === 'edit' ? t('workspace.actions.save', 'Save') : t('workspace.actions.create', 'Create')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}
