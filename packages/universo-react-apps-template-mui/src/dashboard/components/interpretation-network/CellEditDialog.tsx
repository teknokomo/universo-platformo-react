import { useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormLabel from '@mui/material/FormLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import type { TFunction } from 'i18next'
import {
    calculateInterpretationNetworkContrastRatio,
    parseInterpretationNetworkHexColor,
    type MatrixColor,
    type VersionedLocalizedContent
} from '@universo-react/types'
import { createLocalizedContent, normalizeLocale } from '@universo-react/utils'
import { LocalizedInlineField } from '../../../components/forms/LocalizedInlineField'
import type { FieldConfig } from '../../../components/dialogs/FormDialog'
import type { MatrixAxisOption } from './model'
import { MATRIX_CELL_PLACEMENT_FIELD, type MatrixCellPlacement } from './matrixCellData'
import { InterpretationNetworkCellStyleEditor } from './InterpretationNetworkCellStyleEditor'

type CellEditDialogMode = 'create' | 'edit'
type AxisKind = 'existing' | 'new'

export interface CellEditDialogProps {
    open: boolean
    mode: CellEditDialogMode
    t: TFunction<'interpretationNetwork'>
    locale: string
    fields: FieldConfig[]
    styleFields: FieldConfig[]
    initialData: Record<string, unknown>
    axisOptions?: {
        rows: MatrixAxisOption[]
        columns: MatrixAxisOption[]
    }
    initialPlacement?: MatrixCellPlacement
    allowNewAxes?: boolean
    hidePlacementFields?: boolean
    hideAxisLabelFields?: boolean
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

const readLocalizedText = (value: unknown, locale: string): string => {
    if (typeof value === 'string') return value.trim()
    if (!isLocalizedValue(value)) return ''
    const primaryLocale = value._primary ?? locale
    const localized =
        value.locales?.[primaryLocale]?.content ??
        value.locales?.[locale]?.content ??
        value.locales?.en?.content ??
        value.locales?.ru?.content ??
        ''
    return typeof localized === 'string' ? localized.trim() : ''
}

const findOption = (options: MatrixAxisOption[] | undefined, key: string | undefined): MatrixAxisOption | null =>
    (key ? options?.find((option) => option.key === key) : undefined) ?? null

const DEFAULT_CELL_FILL = '#FFFFFF'
const DEFAULT_CELL_TEXT = '#000000'

const toThemeMatrixColor = (value: unknown, fallback: '#FFFFFF' | '#000000'): MatrixColor => {
    const parsed = parseInterpretationNetworkHexColor(value)
    if (parsed) return parsed
    if (typeof value === 'string') {
        const rgb = value.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i)
        if (rgb) {
            const channels = rgb.slice(1, 4).map(Number)
            if (channels.every((channel) => channel >= 0 && channel <= 255)) {
                const parsedRgb = parseInterpretationNetworkHexColor(
                    `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
                )
                if (parsedRgb) return parsedRgb
            }
        }
    }
    return parseInterpretationNetworkHexColor(fallback)!
}

export const resolveCellStyleContrast = ({
    fill,
    text,
    themePaper,
    themeText
}: {
    fill: unknown
    text: unknown
    themePaper: unknown
    themeText: unknown
}): number => {
    const effectiveFill = parseInterpretationNetworkHexColor(fill) ?? toThemeMatrixColor(themePaper, DEFAULT_CELL_FILL)
    const effectiveText = parseInterpretationNetworkHexColor(text) ?? toThemeMatrixColor(themeText, DEFAULT_CELL_TEXT)
    return calculateInterpretationNetworkContrastRatio(effectiveText, effectiveFill)
}

const placementLabelValue = (
    value: unknown,
    fallback: MatrixAxisOption | null | undefined,
    locale: string
): VersionedLocalizedContent<string> => {
    if (isLocalizedValue(value)) return value
    if (typeof value === 'string') return createLocalizedContent(locale, value)
    if (fallback?.labelValue && isLocalizedValue(fallback.labelValue)) return fallback.labelValue
    return createLocalizedContent(locale, fallback?.label ?? '')
}

export function CellEditDialog({
    open,
    mode,
    t,
    locale,
    fields,
    styleFields,
    initialData,
    axisOptions,
    initialPlacement,
    allowNewAxes = false,
    hidePlacementFields = false,
    hideAxisLabelFields = false,
    isSubmitting,
    error,
    onClose,
    onSubmit
}: CellEditDialogProps) {
    const theme = useTheme()
    const normalizedLocale = normalizeLocale(locale)
    const rowLabelField = useMemo(() => findField(fields, 'RowLabel'), [fields])
    const columnLabelField = useMemo(() => findField(fields, 'ColLabel'), [fields])
    const titleField = useMemo(() => findField(fields, 'CellValue'), [fields])
    const descriptionField = useMemo(() => findField(fields, 'CellDescription'), [fields])
    const [tab, setTab] = useState<'basic' | 'style'>('basic')
    const [draft, setDraft] = useState<Record<string, unknown>>({})
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
    const [rowKind, setRowKind] = useState<AxisKind>('new')
    const [columnKind, setColumnKind] = useState<AxisKind>('new')
    const [selectedRow, setSelectedRow] = useState<MatrixAxisOption | null>(null)
    const [selectedColumn, setSelectedColumn] = useState<MatrixAxisOption | null>(null)
    const [styleEditorResetKey, setStyleEditorResetKey] = useState(0)
    const rowIsSystemManaged = mode === 'create' && !allowNewAxes && (hidePlacementFields || initialPlacement?.row?.kind === 'new')
    const columnIsSystemManaged = mode === 'create' && !allowNewAxes && (hidePlacementFields || initialPlacement?.column?.kind === 'new')
    const placementIsSystemManaged = rowIsSystemManaged && columnIsSystemManaged
    const rowLabelIsHidden = hideAxisLabelFields && Boolean(rowLabelField)
    const columnLabelIsHidden = hideAxisLabelFields && Boolean(columnLabelField)

    useEffect(() => {
        if (!open) return
        const initialRow =
            initialPlacement?.row?.kind === 'existing' ? initialPlacement.row.option : findOption(axisOptions?.rows, undefined)
        const initialColumn =
            initialPlacement?.column?.kind === 'existing' ? initialPlacement.column.option : findOption(axisOptions?.columns, undefined)
        const titleValue = toLocalizedValue(readInitialValue(initialData, titleField), normalizedLocale)
        const descriptionValue = toLocalizedValue(readInitialValue(initialData, descriptionField), normalizedLocale)
        const rowLabelValue = placementLabelValue(readInitialValue(initialData, rowLabelField), initialRow, normalizedLocale)
        const columnLabelValue = placementLabelValue(readInitialValue(initialData, columnLabelField), initialColumn, normalizedLocale)
        const nextRowKind = allowNewAxes || initialPlacement?.row?.kind === 'new' ? initialPlacement?.row?.kind ?? 'new' : 'existing'
        const nextColumnKind =
            allowNewAxes || initialPlacement?.column?.kind === 'new' ? initialPlacement?.column?.kind ?? 'new' : 'existing'
        setDraft({
            ...Object.fromEntries(styleFields.map((field) => [field.id, initialData[field.id] ?? initialData[field.codename ?? '']])),
            ...(rowLabelField?.id ? { [rowLabelField.id]: rowLabelValue } : {}),
            ...(columnLabelField?.id ? { [columnLabelField.id]: columnLabelValue } : {}),
            ...(titleField?.id ? { [titleField.id]: titleValue } : {}),
            ...(descriptionField?.id ? { [descriptionField.id]: descriptionValue } : {})
        })
        setRowKind(nextRowKind)
        setColumnKind(nextColumnKind)
        setSelectedRow(initialRow)
        setSelectedColumn(initialColumn)
        setValidationErrors({})
        setTab('basic')
        setStyleEditorResetKey((value) => value + 1)
    }, [
        axisOptions?.columns,
        axisOptions?.rows,
        allowNewAxes,
        columnLabelField,
        descriptionField,
        initialData,
        initialPlacement,
        normalizedLocale,
        open,
        rowLabelField,
        styleFields,
        titleField
    ])

    const handleFieldChange = (field: FieldConfig | undefined, value: unknown) => {
        if (!field?.id) return
        setDraft((prev) => ({ ...prev, [field.id]: value }))
        setValidationErrors((prev) => {
            if (!prev[field.id]) return prev
            const next = { ...prev }
            delete next[field.id]
            return next
        })
    }

    const handleSubmit = async () => {
        const requiredFields = [rowLabelField, columnLabelField, titleField].filter((field): field is FieldConfig => Boolean(field?.id))
        const nextErrors = Object.fromEntries(
            requiredFields.flatMap((field) => {
                const hiddenAxisLabel =
                    (field.id === rowLabelField?.id && rowLabelIsHidden) || (field.id === columnLabelField?.id && columnLabelIsHidden)
                const createPlacementOwnsLabel =
                    mode === 'create' &&
                    ((field.id === rowLabelField?.id && rowKind === 'existing') ||
                        (field.id === rowLabelField?.id && rowIsSystemManaged) ||
                        (field.id === columnLabelField?.id && columnKind === 'existing') ||
                        (field.id === columnLabelField?.id && columnIsSystemManaged))
                if (hiddenAxisLabel || createPlacementOwnsLabel) {
                    return []
                }
                return readLocalizedText(draft[field.id], normalizedLocale)
                    ? []
                    : [[field.id, t('workspace.cell.requiredField', 'This field is required.')]]
            })
        )
        if (mode === 'create' && rowKind === 'existing' && !selectedRow && !rowIsSystemManaged) {
            nextErrors.__rowPlacement = t('workspace.cell.selectExistingRowRequired', 'Select an existing row.')
        }
        if (mode === 'create' && columnKind === 'existing' && !selectedColumn && !columnIsSystemManaged) {
            nextErrors.__columnPlacement = t('workspace.cell.selectExistingColumnRequired', 'Select an existing column.')
        }
        if (mode === 'create' && !allowNewAxes && rowKind === 'new' && !rowIsSystemManaged) {
            nextErrors.__rowPlacement = t('workspace.cell.selectExistingRowRequired', 'Select an existing row.')
        }
        if (mode === 'create' && !allowNewAxes && columnKind === 'new' && !columnIsSystemManaged) {
            nextErrors.__columnPlacement = t('workspace.cell.selectExistingColumnRequired', 'Select an existing column.')
        }
        if (Object.keys(nextErrors).length > 0) {
            setValidationErrors(nextErrors)
            setTab('basic')
            return
        }
        const normalizedStyleFields = styleFields.filter((field) => field.validationRules?.format === 'hexColor')
        const nextDraft = { ...draft }
        const colorFieldErrors = normalizedStyleFields.flatMap((field) => {
            const value = nextDraft[field.id]
            if (value === null || value === undefined || value === '') {
                nextDraft[field.id] = null
                return []
            }
            const normalized = parseInterpretationNetworkHexColor(value)
            if (normalized) {
                nextDraft[field.id] = normalized
                return []
            }
            return [[field.id, t('cellStyle.invalidColor', 'Enter a hexadecimal color such as #1E88E5.')]]
        })
        if (colorFieldErrors.length > 0) {
            setValidationErrors((current) => ({ ...current, ...Object.fromEntries(colorFieldErrors) }))
            setTab('style')
            return
        }
        const placement: MatrixCellPlacement | undefined =
            mode === 'create'
                ? {
                      row: rowIsSystemManaged
                          ? initialPlacement?.row ?? { kind: 'new' }
                          : rowKind === 'existing' && selectedRow
                          ? { kind: 'existing', option: selectedRow }
                          : {
                                kind: 'new',
                                labelValue: rowLabelField?.id ? draft[rowLabelField.id] : undefined
                            },
                      column: columnIsSystemManaged
                          ? initialPlacement?.column ?? { kind: 'new' }
                          : columnKind === 'existing' && selectedColumn
                          ? { kind: 'existing', option: selectedColumn }
                          : {
                                kind: 'new',
                                labelValue: columnLabelField?.id ? draft[columnLabelField.id] : undefined
                            },
                      parentCellId: initialPlacement?.parentCellId ?? null
                  }
                : undefined
        await onSubmit(placement ? { ...nextDraft, [MATRIX_CELL_PLACEMENT_FIELD]: placement } : nextDraft)
    }

    const handleAxisKindChange = (axis: 'row' | 'column', nextKind: AxisKind) => {
        if (axis === 'row') {
            setRowKind(nextKind)
            if (nextKind === 'existing' && selectedRow && rowLabelField?.id) {
                handleFieldChange(rowLabelField, placementLabelValue(undefined, selectedRow, normalizedLocale))
            }
            return
        }
        setColumnKind(nextKind)
        if (nextKind === 'existing' && selectedColumn && columnLabelField?.id) {
            handleFieldChange(columnLabelField, placementLabelValue(undefined, selectedColumn, normalizedLocale))
        }
    }

    const renderAxisPlacement = ({
        axis,
        field,
        kind,
        selected,
        options,
        title,
        existingLabel,
        newLabel,
        selectLabel,
        newFieldLabel,
        error
    }: {
        axis: 'row' | 'column'
        field: FieldConfig | undefined
        kind: AxisKind
        selected: MatrixAxisOption | null
        options: MatrixAxisOption[]
        title: string
        existingLabel: string
        newLabel: string
        selectLabel: string
        newFieldLabel: string
        error?: string
    }) => {
        if (!field) return null
        const hasExistingOptions = options.length > 0
        const newAxisIsSystemManaged =
            mode === 'create' &&
            !allowNewAxes &&
            kind === 'new' &&
            (axis === 'row' ? initialPlacement?.row?.kind === 'new' : initialPlacement?.column?.kind === 'new')
        return (
            <Stack spacing={1}>
                {allowNewAxes ? (
                    <FormControl component='fieldset'>
                        <FormLabel component='legend'>{title}</FormLabel>
                        <RadioGroup
                            row
                            value={kind}
                            onChange={(event) => handleAxisKindChange(axis, event.target.value as AxisKind)}
                            aria-label={title}
                        >
                            <FormControlLabel
                                value='existing'
                                control={<Radio size='small' />}
                                disabled={!hasExistingOptions}
                                label={existingLabel}
                            />
                            <FormControlLabel value='new' control={<Radio size='small' />} label={newLabel} />
                        </RadioGroup>
                    </FormControl>
                ) : (
                    <Typography variant='subtitle2'>{title}</Typography>
                )}
                {newAxisIsSystemManaged ? (
                    <Typography variant='body2' color='text.secondary'>
                        {t('workspace.cell.axisCreatedAutomatically', 'Created automatically for the new cell.')}
                    </Typography>
                ) : kind === 'existing' ? (
                    <Autocomplete
                        options={options}
                        value={selected}
                        disabled={!hasExistingOptions || isSubmitting}
                        getOptionLabel={(option) => option.label}
                        isOptionEqualToValue={(option, value) => option.key === value.key}
                        onChange={(_event, option) => {
                            if (axis === 'row') {
                                setSelectedRow(option)
                            } else {
                                setSelectedColumn(option)
                            }
                            if (option) {
                                handleFieldChange(field, placementLabelValue(undefined, option, normalizedLocale))
                            }
                        }}
                        renderInput={(params) => (
                            <TextField {...params} label={selectLabel} required error={Boolean(error)} helperText={error} />
                        )}
                    />
                ) : (
                    <LocalizedInlineField
                        mode='localized'
                        label={newFieldLabel}
                        value={toLocalizedValue(draft[field.id], normalizedLocale)}
                        onChange={(value) => handleFieldChange(field, value)}
                        uiLocale={normalizedLocale}
                        autoInitialize={false}
                        error={validationErrors[field.id]}
                        required
                    />
                )}
            </Stack>
        )
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
                            {mode === 'create' ? (
                                placementIsSystemManaged ? null : (
                                    <Stack spacing={2}>
                                        <Typography variant='subtitle2'>{t('workspace.cell.placementTitle', 'Placement')}</Typography>
                                        {renderAxisPlacement({
                                            axis: 'row',
                                            field: rowLabelField,
                                            kind: rowKind,
                                            selected: selectedRow,
                                            options: axisOptions?.rows ?? [],
                                            title: t('workspace.cell.rowPlacement', 'Row'),
                                            existingLabel: t('workspace.cell.useExistingRow', 'Existing row'),
                                            newLabel: t('workspace.cell.useNewRow', 'New row'),
                                            selectLabel: t('workspace.cell.existingRowField', 'Select row'),
                                            newFieldLabel: t('workspace.cell.newRowField', 'New row name'),
                                            error: validationErrors.__rowPlacement
                                        })}
                                        {renderAxisPlacement({
                                            axis: 'column',
                                            field: columnLabelField,
                                            kind: columnKind,
                                            selected: selectedColumn,
                                            options: axisOptions?.columns ?? [],
                                            title: t('workspace.cell.columnPlacement', 'Column'),
                                            existingLabel: t('workspace.cell.useExistingColumn', 'Existing column'),
                                            newLabel: t('workspace.cell.useNewColumn', 'New column'),
                                            selectLabel: t('workspace.cell.existingColumnField', 'Select column'),
                                            newFieldLabel: t('workspace.cell.newColumnField', 'New column name'),
                                            error: validationErrors.__columnPlacement
                                        })}
                                    </Stack>
                                )
                            ) : (
                                <>
                                    {rowLabelField && !rowLabelIsHidden ? (
                                        <LocalizedInlineField
                                            mode='localized'
                                            label={t('workspace.cell.rowLabelField', 'Row label')}
                                            value={toLocalizedValue(draft[rowLabelField.id], normalizedLocale)}
                                            onChange={(value) => handleFieldChange(rowLabelField, value)}
                                            uiLocale={normalizedLocale}
                                            autoInitialize={false}
                                            error={validationErrors[rowLabelField.id]}
                                            required
                                        />
                                    ) : null}
                                    {columnLabelField && !columnLabelIsHidden ? (
                                        <LocalizedInlineField
                                            mode='localized'
                                            label={t('workspace.cell.columnLabelField', 'Column label')}
                                            value={toLocalizedValue(draft[columnLabelField.id], normalizedLocale)}
                                            onChange={(value) => handleFieldChange(columnLabelField, value)}
                                            uiLocale={normalizedLocale}
                                            autoInitialize={false}
                                            error={validationErrors[columnLabelField.id]}
                                            required
                                        />
                                    ) : null}
                                </>
                            )}
                            {titleField ? (
                                <LocalizedInlineField
                                    mode='localized'
                                    label={t('workspace.cell.titleField', 'Title')}
                                    value={toLocalizedValue(draft[titleField.id], normalizedLocale)}
                                    onChange={(value) => handleFieldChange(titleField, value)}
                                    uiLocale={normalizedLocale}
                                    autoInitialize={false}
                                    error={validationErrors[titleField.id]}
                                    required
                                />
                            ) : null}
                            {descriptionField ? (
                                <LocalizedInlineField
                                    mode='localized'
                                    label={t('workspace.cell.descriptionField', 'Description')}
                                    value={toLocalizedValue(draft[descriptionField.id], normalizedLocale)}
                                    onChange={(value) => handleFieldChange(descriptionField, value)}
                                    uiLocale={normalizedLocale}
                                    autoInitialize={false}
                                    multiline
                                    rows={4}
                                />
                            ) : null}
                            {!rowLabelField && !columnLabelField && !titleField && !descriptionField ? (
                                <Alert severity='warning'>
                                    {t('workspace.cell.metadataUnavailable', 'Cell metadata fields are not available.')}
                                </Alert>
                            ) : null}
                        </Stack>
                    ) : null}
                    {tab === 'style' ? (
                        <Stack spacing={2}>
                            {styleFields.length > 0 ? (
                                <InterpretationNetworkCellStyleEditor
                                    t={t}
                                    fields={styleFields}
                                    draft={draft}
                                    disabled={isSubmitting}
                                    resetKey={styleEditorResetKey}
                                    validationErrors={validationErrors}
                                    themePaper={theme.palette.background.paper}
                                    onChange={handleFieldChange}
                                />
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
