import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DeleteIcon from '@mui/icons-material/Delete'
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import {
    Alert,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    FormHelperText,
    IconButton,
    InputAdornment,
    InputLabel,
    MenuItem,
    Radio,
    RadioGroup,
    Select,
    Stack,
    Step,
    StepLabel,
    Stepper,
    TextField,
    Typography
} from '@mui/material'
import type {
    PageBlockContent,
    PageBlockContentValidationOptions,
    ResourceSource,
    ResourceType,
    VersionedLocalizedContent
} from '@universo/types'
import { normalizePageBlockContentForStorage, RESOURCE_TYPES, resourceSourceSchema } from '@universo/types'
import { buildTableConstraintText, createLocalizedContent, NUMBER_DEFAULTS, toNumberRules, validateNumber } from '@universo/utils'
import { useTranslation } from 'react-i18next'
import { LocalizedInlineField } from '../forms/LocalizedInlineField'
import { TabularPartEditor } from '../TabularPartEditor'
import { RuntimeInlineTabularEditor } from '../RuntimeInlineTabularEditor'
import { normalizeTabularRowValues } from '../../utils/tabularCellValues'
import PageContainer from '../../crud-dashboard/components/PageContainer'
import { EditorJsBlockEditor } from '@universo/block-editor'
import { ResourcePreview } from '../resource-preview'
import { fetchAppData } from '../../api'

export type FieldType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'REF' | 'JSON' | 'TABLE'

/**
 * Validation rules for form fields.
 * Matches component validation rules from @universo/types.
 */
export interface FieldValidationRules extends Record<string, unknown> {
    // STRING settings
    minLength?: number | null
    maxLength?: number | null
    versioned?: boolean
    localized?: boolean

    // NUMBER settings
    precision?: number
    scale?: number
    min?: number | null
    max?: number | null
    nonNegative?: boolean

    // DATE settings
    dateComposition?: 'date' | 'time' | 'datetime'

    // TABLE settings
    minRows?: number | null
    maxRows?: number | null
}

export interface FieldConfig {
    id: string
    label: string
    type: FieldType
    widget?: 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'date' | 'datetime' | 'reference'
    multilineRows?: number
    required?: boolean
    /** @deprecated Use validationRules.localized instead */
    localized?: boolean
    placeholder?: string
    helperText?: string
    validationRules?: FieldValidationRules
    /** Optional target entity ID for REF fields */
    refTargetEntityId?: string | null
    /** Optional target entity kind for REF fields */
    refTargetEntityKind?: string | null
    /** Optional target constant ID for REF fields pointing to sets. */
    refTargetConstantId?: string | null
    /** Precomputed display label for REF fields pointing to sets. */
    refSetConstantLabel?: string | null
    /** Data type of selected set constant (for diagnostics/UI hints). */
    refSetConstantDataType?: string | null
    /** Runtime options for REF fields (object/enumeration). */
    refOptions?: Array<{
        id: string
        label: string
        codename?: string
        isDefault?: boolean
        sortOrder?: number
    }>
    /** Runtime options for REF->enumeration fields. */
    enumOptions?: Array<{
        id: string
        label: string
        codename?: string
        isDefault?: boolean
        sortOrder?: number
    }>
    /** REF->enumeration presentation mode. */
    enumPresentationMode?: 'select' | 'radio' | 'label'
    /** Optional default enumeration value id. */
    defaultEnumValueId?: string | null
    /** Controls whether empty value can be selected for enumeration references. */
    enumAllowEmpty?: boolean
    /** Defines how empty label-mode value should be rendered. */
    enumLabelEmptyDisplay?: 'empty' | 'dash'
    /** Child components for TABLE-type components. */
    childFields?: FieldConfig[]
    /** UI configuration for TABLE-type components. */
    tableUiConfig?: Record<string, unknown>
    /** Generic UI configuration copied from the metadata component definition. */
    uiConfig?: Record<string, unknown>
    /** Original component UUID — used for TABLE-type API calls (tabular part endpoint). */
    componentId?: string
}

export interface RuntimeObjectCollectionOption {
    id: string
    codename: string
    name?: string | null
}

type FieldSyncMode = 'untilTargetEdited' | 'whenTargetEmpty'
type FieldSyncTransform = 'plainText'

interface FieldSyncTarget {
    fieldId: string
    mode: FieldSyncMode
    manualFlagFieldId?: string
    transform: FieldSyncTransform
}

interface RuntimeRecordPickerConfig {
    targetObjectCodenameField: string
    labelFields: string[]
    limit: number
    allowedObjectCodenames?: string[]
}

interface RuntimeRecordPickerOption {
    id: string
    label: string
}

interface StringSelectOption {
    value: string
    label: string
}

interface FieldVisibilityCondition {
    fieldId: string
    equals?: unknown
    notEquals?: unknown
    in?: unknown[]
    notIn?: unknown[]
}

interface FieldDateOffsetDerivation {
    startFieldId: string
    offsetDaysFieldId: string
    when?: FieldVisibilityCondition
    clearWhen?: FieldVisibilityCondition
}

const EMPTY_OBJECT_COLLECTIONS: RuntimeObjectCollectionOption[] = []

export interface FormDialogProps {
    open: boolean
    title: string
    surface?: 'dialog' | 'page'
    fields: FieldConfig[]
    locale: string
    initialData?: Record<string, unknown>
    isSubmitting?: boolean
    error?: string | null
    requireAnyValue?: boolean
    emptyStateText?: string
    saveButtonText?: string
    savingButtonText?: string
    cancelButtonText?: string
    showDeleteButton?: boolean
    deleteButtonText?: string
    deleteButtonDisabled?: boolean
    onDelete?: () => void
    onClose: () => void
    onSubmit: (data: Record<string, unknown>) => Promise<void>
    isValuePresent?: (field: FieldConfig, value: unknown) => boolean
    /** API base URL — required for TABLE inline editing in EDIT mode. */
    apiBaseUrl?: string
    /** Application UUID — required for TABLE inline editing in EDIT mode. */
    applicationId?: string
    /** Object UUID — required for TABLE inline editing in EDIT mode. */
    objectCollectionId?: string
    /** Row being edited (null = create mode) — used for TABLE rendering. */
    editRowId?: string | null
    /** Copy mode keeps TABLE children immutable because the runtime copies them atomically from the source row. */
    copyMode?: boolean
    renderField?: (params: {
        field: FieldConfig
        value: unknown
        onChange: (value: unknown) => void
        disabled: boolean
        error: string | null
        helperText?: string
        locale: string
    }) => React.ReactNode | undefined
    /** Runtime object registry used by metadata-driven record picker fields. */
    objectCollections?: RuntimeObjectCollectionOption[]
    /** Current workspace scope for runtime record picker fields. */
    currentWorkspaceId?: string | null
    /** Optional metadata-defined wizard steps for guided create/edit forms. */
    wizardSteps?: Array<{
        id: string
        label: string
        helperText?: string
        fieldIds: string[]
    }>
}

const normalizeLocale = (locale?: string) => (locale ? locale.split(/[-_]/)[0].toLowerCase() : 'en')

const isLocalizedContent = (value: unknown): value is VersionedLocalizedContent<string> =>
    Boolean(value && typeof value === 'object' && 'locales' in (value as Record<string, unknown>))

const ensureLocalizedValue = (value: unknown, locale: string): VersionedLocalizedContent<string> | null => {
    if (value == null) return null
    if (isLocalizedContent(value)) return value
    if (typeof value === 'string') {
        return createLocalizedContent(locale, value)
    }
    return createLocalizedContent(locale, String(value))
}

const hasAnyLocalizedContent = (value: VersionedLocalizedContent<string>) =>
    Object.values(value.locales ?? {}).some((entry) => typeof entry?.content === 'string' && entry.content.trim() !== '')

const getLocalizedStringValue = (value: unknown, locale: string): string | null => {
    if (!isLocalizedContent(value)) return null
    const locales = value.locales ?? {}
    const normalizedLocale = normalizeLocale(locale)
    const entry = locales[normalizedLocale]
    if (typeof entry?.content === 'string') return entry.content
    const primary = value._primary
    const primaryEntry = locales[primary]
    if (typeof primaryEntry?.content === 'string') return primaryEntry.content
    const firstEntry = Object.values(locales).find((item) => typeof item?.content === 'string')
    return typeof firstEntry?.content === 'string' ? firstEntry.content : null
}

const isValidTimeString = (value: string) => /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,3})?)?$/.test(value)

const isValidDateString = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const date = new Date(`${value}T00:00:00`)
    return !Number.isNaN(date.getTime())
}

const isValidDateTimeString = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(value)) return false
    const date = new Date(value)
    return !Number.isNaN(date.getTime())
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const isEditorJsBlockContentField = (field: FieldConfig): boolean => {
    const uiConfig = field.uiConfig ?? {}
    return (
        field.type === 'JSON' &&
        (uiConfig.widget === 'editorjsBlockContent' || uiConfig.editor === 'editorjs' || uiConfig.blockContent === true)
    )
}

const isResourceSourceField = (field: FieldConfig): boolean => {
    const uiConfig = field.uiConfig ?? {}
    return field.type === 'JSON' && (uiConfig.widget === 'resourceSource' || uiConfig.resourceSource === true || uiConfig.resource === true)
}

const isStaticallyHiddenField = (field: FieldConfig): boolean => {
    const uiConfig = field.uiConfig ?? {}
    return uiConfig.hidden === true || uiConfig.formHidden === true
}

const readFieldVisibilityCondition = (field: FieldConfig): FieldVisibilityCondition | null => {
    const uiConfig = field.uiConfig ?? {}
    const rawCondition = uiConfig.visibleWhen ?? uiConfig.showWhen
    if (!isRecord(rawCondition)) return null

    const rawFieldId = rawCondition.fieldId ?? rawCondition.field ?? rawCondition.codename
    if (typeof rawFieldId !== 'string' || rawFieldId.trim().length === 0) return null

    const condition: FieldVisibilityCondition = { fieldId: rawFieldId.trim() }

    if ('equals' in rawCondition) {
        condition.equals = rawCondition.equals
    } else if ('value' in rawCondition) {
        condition.equals = rawCondition.value
    }

    if ('notEquals' in rawCondition) {
        condition.notEquals = rawCondition.notEquals
    }

    if (Array.isArray(rawCondition.in)) {
        condition.in = rawCondition.in
    }

    if (Array.isArray(rawCondition.notIn)) {
        condition.notIn = rawCondition.notIn
    }

    return condition
}

const readFieldDateOffsetDerivation = (field: FieldConfig): FieldDateOffsetDerivation | null => {
    const uiConfig = field.uiConfig ?? {}
    const rawDerivation = uiConfig.derivedDateOffset ?? uiConfig.dateOffset
    if (!isRecord(rawDerivation)) return null

    const rawStartField = rawDerivation.startFieldId ?? rawDerivation.startField ?? rawDerivation.fromField
    const rawOffsetField = rawDerivation.offsetDaysFieldId ?? rawDerivation.offsetDaysField ?? rawDerivation.daysField
    const startFieldId = typeof rawStartField === 'string' && rawStartField.trim().length > 0 ? rawStartField.trim() : ''
    const offsetDaysFieldId = typeof rawOffsetField === 'string' && rawOffsetField.trim().length > 0 ? rawOffsetField.trim() : ''
    if (!startFieldId || !offsetDaysFieldId) return null

    return {
        startFieldId,
        offsetDaysFieldId,
        when: readFieldVisibilityCondition({ ...field, uiConfig: { visibleWhen: rawDerivation.when } }) ?? undefined,
        clearWhen: readFieldVisibilityCondition({ ...field, uiConfig: { visibleWhen: rawDerivation.clearWhen } }) ?? undefined
    }
}

const valuesEqual = (left: unknown, right: unknown): boolean => {
    if (Object.is(left, right)) return true
    if (left == null || right == null) return false
    return String(left) === String(right)
}

const matchesFieldVisibilityCondition = (condition: FieldVisibilityCondition, formData: Record<string, unknown>): boolean => {
    const currentValue = formData[condition.fieldId]
    let hasOperator = false

    if ('equals' in condition) {
        hasOperator = true
        if (!valuesEqual(currentValue, condition.equals)) return false
    }

    if ('notEquals' in condition) {
        hasOperator = true
        if (valuesEqual(currentValue, condition.notEquals)) return false
    }

    if (condition.in) {
        hasOperator = true
        if (!condition.in.some((candidate) => valuesEqual(currentValue, candidate))) return false
    }

    if (condition.notIn) {
        hasOperator = true
        if (condition.notIn.some((candidate) => valuesEqual(currentValue, candidate))) return false
    }

    return hasOperator ? true : Boolean(currentValue)
}

const isConditionallyHiddenField = (field: FieldConfig, formData: Record<string, unknown>): boolean => {
    const condition = readFieldVisibilityCondition(field)
    return condition ? !matchesFieldVisibilityCondition(condition, formData) : false
}

const isHiddenField = (field: FieldConfig, formData: Record<string, unknown>): boolean =>
    isStaticallyHiddenField(field) || isConditionallyHiddenField(field, formData)

const readOffsetDays = (value: unknown): number | null => {
    const numeric = typeof value === 'number' ? value : typeof value === 'string' && value.trim().length > 0 ? Number(value) : Number.NaN
    if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric < 0 || numeric > 3650) return null
    return numeric
}

const deriveDateOffsetValue = (derivation: FieldDateOffsetDerivation, formData: Record<string, unknown>): string | null | undefined => {
    if (derivation.clearWhen && matchesFieldVisibilityCondition(derivation.clearWhen, formData)) {
        return null
    }
    if (derivation.when && !matchesFieldVisibilityCondition(derivation.when, formData)) {
        return undefined
    }

    const startValue = formData[derivation.startFieldId]
    const offsetDays = readOffsetDays(formData[derivation.offsetDaysFieldId])
    const startTime =
        typeof startValue === 'string' && startValue.trim().length > 0
            ? Date.parse(startValue)
            : startValue instanceof Date
            ? startValue.getTime()
            : Number.NaN
    if (!Number.isFinite(startTime) || offsetDays === null) return undefined
    return new Date(startTime + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

const readFieldRequirementCondition = (field: FieldConfig): FieldVisibilityCondition | null => {
    const uiConfig = field.uiConfig ?? {}
    const rawCondition = uiConfig.requiredWhen ?? uiConfig.requireWhen
    if (!isRecord(rawCondition)) return null

    const rawFieldId = rawCondition.fieldId ?? rawCondition.field ?? rawCondition.codename
    if (typeof rawFieldId !== 'string' || rawFieldId.trim().length === 0) return null

    const condition: FieldVisibilityCondition = { fieldId: rawFieldId.trim() }
    if ('equals' in rawCondition) {
        condition.equals = rawCondition.equals
    } else if ('value' in rawCondition) {
        condition.equals = rawCondition.value
    }
    if ('notEquals' in rawCondition) condition.notEquals = rawCondition.notEquals
    if (Array.isArray(rawCondition.in)) condition.in = rawCondition.in
    if (Array.isArray(rawCondition.notIn)) condition.notIn = rawCondition.notIn
    return condition
}

const isFieldRequired = (field: FieldConfig, formData: Record<string, unknown>): boolean => {
    if (field.required) return true
    const condition = readFieldRequirementCondition(field)
    return condition ? matchesFieldVisibilityCondition(condition, formData) : false
}

const readStringArray = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) return undefined
    const values = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    return values.length > 0 ? values : undefined
}

const readRuntimeRecordPickerConfig = (field: FieldConfig): RuntimeRecordPickerConfig | null => {
    const uiConfig = field.uiConfig ?? {}
    const rawPicker = uiConfig.runtimeRecordPicker
    const pickerConfig = isRecord(rawPicker) ? rawPicker : {}
    const widget =
        typeof uiConfig.widget === 'string' ? uiConfig.widget : typeof pickerConfig.widget === 'string' ? pickerConfig.widget : null
    const enabled = rawPicker === true || widget === 'runtimeRecordPicker' || widget === 'recordPicker'

    if (!enabled) return null

    const targetObjectCodenameField =
        typeof pickerConfig.targetObjectCodenameField === 'string' && pickerConfig.targetObjectCodenameField.trim().length > 0
            ? pickerConfig.targetObjectCodenameField.trim()
            : typeof uiConfig.targetObjectCodenameField === 'string' && uiConfig.targetObjectCodenameField.trim().length > 0
            ? uiConfig.targetObjectCodenameField.trim()
            : null

    if (!targetObjectCodenameField) return null

    const configuredLimit =
        typeof pickerConfig.limit === 'number' && Number.isFinite(pickerConfig.limit)
            ? pickerConfig.limit
            : typeof uiConfig.runtimeRecordPickerLimit === 'number' && Number.isFinite(uiConfig.runtimeRecordPickerLimit)
            ? uiConfig.runtimeRecordPickerLimit
            : 50

    return {
        targetObjectCodenameField,
        labelFields: readStringArray(pickerConfig.labelFields ?? uiConfig.recordLabelFields) ?? ['Title', 'Name'],
        limit: Math.min(Math.max(Math.trunc(configuredLimit), 1), 100),
        allowedObjectCodenames: readStringArray(pickerConfig.allowedObjectCodenames ?? uiConfig.allowedObjectCodenames)
    }
}

const readStringSelectOptions = (field: FieldConfig, locale: string): StringSelectOption[] => {
    const uiConfig = field.uiConfig ?? {}
    const rawOptions = uiConfig.stringOptions ?? uiConfig.options
    if (!Array.isArray(rawOptions)) return []

    return rawOptions.flatMap((option): StringSelectOption[] => {
        if (typeof option === 'string' && option.trim().length > 0) {
            return [{ value: option, label: option }]
        }
        if (!isRecord(option) || typeof option.value !== 'string' || option.value.trim().length === 0) return []
        const localizedLabel = getLocalizedStringValue(option.label, locale)
        const plainLabel = typeof option.label === 'string' && option.label.trim().length > 0 ? option.label : null
        return [{ value: option.value, label: localizedLabel ?? plainLabel ?? option.value }]
    })
}

const getRuntimeRecordPickerLabel = (row: Record<string, unknown>, labelFields: readonly string[], locale: string): string => {
    for (const field of labelFields) {
        const value = row[field]
        const localizedValue = getLocalizedStringValue(value, locale)
        if (localizedValue && localizedValue.trim().length > 0) return localizedValue
        if (typeof value === 'string' && value.trim().length > 0) return value
        if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    }

    return typeof row.id === 'string' ? row.id : '—'
}

const isLocalizedStringField = (field: FieldConfig): boolean => Boolean(field.validationRules?.localized ?? field.localized)

const readFieldSyncTargets = (field: FieldConfig): FieldSyncTarget[] => {
    const rawTargets = field.uiConfig?.syncTargets ?? field.uiConfig?.syncTo
    const candidates = Array.isArray(rawTargets) ? rawTargets : rawTargets ? [rawTargets] : []

    return candidates.flatMap((candidate): FieldSyncTarget[] => {
        if (typeof candidate === 'string') {
            return [{ fieldId: candidate, mode: 'untilTargetEdited', transform: 'plainText' }]
        }
        if (!isRecord(candidate) || typeof candidate.fieldId !== 'string' || candidate.fieldId.trim().length === 0) {
            return []
        }

        return [
            {
                fieldId: candidate.fieldId.trim(),
                mode: candidate.mode === 'whenTargetEmpty' ? 'whenTargetEmpty' : 'untilTargetEdited',
                manualFlagFieldId:
                    typeof candidate.manualFlagFieldId === 'string' && candidate.manualFlagFieldId.trim().length > 0
                        ? candidate.manualFlagFieldId.trim()
                        : undefined,
                transform: 'plainText'
            }
        ]
    })
}

const readFiniteInteger = (value: unknown): number | null => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    return Math.max(0, Math.trunc(value))
}

const normalizeBlockEditorValue = (value: unknown, options: PageBlockContentValidationOptions): PageBlockContent => {
    const parsedValue =
        typeof value === 'string' && value.trim().length > 0
            ? (() => {
                  try {
                      return JSON.parse(value)
                  } catch {
                      return value
                  }
              })()
            : value

    try {
        return normalizePageBlockContentForStorage(parsedValue ?? { format: 'editorjs', data: { blocks: [] } }, options)
    } catch {
        return normalizePageBlockContentForStorage({ format: 'editorjs', data: { blocks: [] } }, options)
    }
}

const parseJsonStringValue = (value: unknown): unknown => {
    if (typeof value !== 'string') return value
    if (value.trim().length === 0) return undefined
    try {
        return JSON.parse(value)
    } catch {
        return value
    }
}

const readNonEmptyString = (value: unknown): string | null => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : null)

const isTextareaField = (field: FieldConfig): boolean => field.widget === 'textarea' || field.uiConfig?.widget === 'textarea'

const getTextareaRows = (field: FieldConfig): number => {
    if (typeof field.multilineRows === 'number' && Number.isInteger(field.multilineRows) && field.multilineRows > 0) {
        return field.multilineRows
    }
    const rows = field.uiConfig?.rows
    return typeof rows === 'number' && Number.isInteger(rows) && rows > 0 ? rows : 4
}

const hasResourceSourceLocator = (value: unknown): boolean => {
    const parsedValue = parseJsonStringValue(value)
    if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) return false

    const record = parsedValue as Record<string, unknown>
    if (readNonEmptyString(record.url)) return true
    if (readNonEmptyString(record.pageCodename)) return true
    if (readNonEmptyString(record.storageKey)) return true

    const packageDescriptor = record.packageDescriptor
    if (packageDescriptor && typeof packageDescriptor === 'object' && !Array.isArray(packageDescriptor)) {
        return Object.values(packageDescriptor as Record<string, unknown>).some((entry) => readNonEmptyString(entry))
    }

    return false
}

const normalizeResourceSourceValue = (value: unknown): ResourceSource | Record<string, unknown> => {
    const parsedValue = parseJsonStringValue(value)
    const parsed = resourceSourceSchema.safeParse(parsedValue)
    if (parsed.success) return parsed.data
    if (parsedValue && typeof parsedValue === 'object' && !Array.isArray(parsedValue)) {
        return parsedValue as Record<string, unknown>
    }
    return { type: 'url', url: '' }
}

const getResourceSourceErrorKey = (value: unknown): string => {
    const parsed = resourceSourceSchema.safeParse(parseJsonStringValue(value))
    if (parsed.success) return ''

    const issue = parsed.error.issues[0]
    const firstPath = typeof issue?.path?.[0] === 'string' ? issue.path[0] : ''
    const message = issue?.message ?? ''

    if (firstPath === 'url' || message.includes('http and https') || message.includes('absolute')) return 'url'
    if (firstPath === 'pageCodename') return 'pageCodename'
    if (firstPath === 'storageKey') return 'storageKey'
    if (firstPath === 'packageDescriptor') return 'packageDescriptor'
    if (firstPath === 'mimeType') return 'mimeType'
    if (firstPath === 'source' || message.includes('exactly one source locator')) return 'singleLocator'
    if (message.includes('Embed URL host')) return 'embedHost'
    return 'invalid'
}

const getResourceSourceType = (value: ResourceSource | Record<string, unknown>): ResourceType =>
    RESOURCE_TYPES.includes(value.type as ResourceType) ? (value.type as ResourceType) : 'url'

const buildResourceSourceCandidate = (
    current: ResourceSource | Record<string, unknown>,
    patch: Partial<ResourceSource> | Record<string, unknown>
): ResourceSource | Record<string, unknown> => {
    const next = { ...current, ...patch } as Record<string, unknown>
    const parsed = resourceSourceSchema.safeParse(next)
    return parsed.success ? parsed.data : next
}

const getPackageDescriptorLabel = (value: unknown): string => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
    const record = value as Record<string, unknown>
    const candidate = record.codename ?? record.name ?? record.id
    return typeof candidate === 'string' ? candidate : ''
}

const buildDefaultResourceSourceForType = (resourceType: ResourceType): ResourceSource | Record<string, unknown> => {
    switch (resourceType) {
        case 'page':
            return { type: resourceType, pageCodename: '' }
        case 'scorm':
        case 'xapi':
            return { type: resourceType, packageDescriptor: { codename: '' } }
        case 'file':
            return { type: resourceType, storageKey: '' }
        default:
            return { type: resourceType, url: '' }
    }
}

/**
 * Normalize date/datetime input to ensure year has max 4 digits.
 * Browser native date inputs allow typing 5+ digit years which breaks validation.
 */
const normalizeDateValue = (value: string, inputType: 'date' | 'time' | 'datetime-local'): string => {
    if (!value || inputType === 'time') return value

    const dashIndex = value.indexOf('-')
    if (dashIndex <= 0) return value

    const yearPart = value.substring(0, dashIndex)

    if (yearPart.length > 4) {
        const truncatedYear = yearPart.slice(-4)
        return truncatedYear + value.substring(dashIndex)
    }

    return value
}

export const FormDialog: React.FC<FormDialogProps> = ({
    open,
    title,
    surface = 'dialog',
    fields,
    locale,
    initialData,
    isSubmitting = false,
    error = null,
    requireAnyValue = false,
    emptyStateText,
    saveButtonText = 'Save',
    savingButtonText,
    cancelButtonText = 'Cancel',
    showDeleteButton = false,
    deleteButtonText = 'Delete',
    deleteButtonDisabled = false,
    onDelete,
    onClose,
    onSubmit,
    isValuePresent,
    renderField: renderFieldOverride,
    apiBaseUrl,
    applicationId,
    objectCollectionId,
    editRowId,
    copyMode = false,
    objectCollections = EMPTY_OBJECT_COLLECTIONS,
    currentWorkspaceId = null,
    wizardSteps
}) => {
    const [formData, setFormData] = useState<Record<string, unknown>>({})
    const [blockEditorErrors, setBlockEditorErrors] = useState<Record<string, string | null>>({})
    const [isReady, setReady] = useState(false)
    const [activeWizardStep, setActiveWizardStep] = useState(0)
    const wasOpenRef = useRef(false)
    const manuallyChangedFieldIdsRef = useRef<Set<string>>(new Set())
    // Track NUMBER input refs and last cursor zone for zone-aware steppers
    const numberInputRefsRef = useRef<Map<string, HTMLInputElement>>(new Map())
    const numberCursorZoneRef = useRef<Map<string, 'integer' | 'decimal'>>(new Map())
    const fieldById = useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields])
    const syncTargetsBySourceId = useMemo(
        () =>
            new Map(
                fields.map((field) => [field.id, readFieldSyncTargets(field)] as const).filter(([, syncTargets]) => syncTargets.length > 0)
            ),
        [fields]
    )
    const syncTargetsByTargetId = useMemo(() => {
        const targets = new Map<string, FieldSyncTarget[]>()
        for (const field of fields) {
            for (const syncTarget of readFieldSyncTargets(field)) {
                const current = targets.get(syncTarget.fieldId) ?? []
                current.push(syncTarget)
                targets.set(syncTarget.fieldId, current)
            }
        }
        return targets
    }, [fields])

    const applyFieldDefaults = useCallback(
        (seed: Record<string, unknown>) => {
            const next = { ...seed }

            for (const syncTargets of syncTargetsBySourceId.values()) {
                for (const syncTarget of syncTargets) {
                    if (syncTarget.manualFlagFieldId && next[syncTarget.manualFlagFieldId] === undefined) {
                        next[syncTarget.manualFlagFieldId] = false
                    }
                }
            }

            for (const field of fields) {
                if (next[field.id] !== undefined) continue
                if (Object.prototype.hasOwnProperty.call(field.uiConfig ?? {}, 'defaultValue')) {
                    next[field.id] = field.uiConfig?.defaultValue
                    continue
                }
                if (field.type !== 'REF') continue
                if (field.refTargetEntityKind === 'enumeration') {
                    const defaultFromConfig = field.defaultEnumValueId ?? null
                    const defaultFromOptions = field.enumOptions?.find((option) => option.isDefault)?.id ?? null
                    const fallbackDefault = defaultFromConfig ?? defaultFromOptions
                    if (fallbackDefault) {
                        next[field.id] = fallbackDefault
                    }
                    continue
                }

                if (field.refTargetEntityKind === 'set') {
                    const defaultSetConstantId =
                        typeof field.refTargetConstantId === 'string' && field.refTargetConstantId.length > 0
                            ? field.refTargetConstantId
                            : null
                    if (defaultSetConstantId) {
                        next[field.id] = defaultSetConstantId
                    }
                }
            }

            return next
        },
        [fields, syncTargetsBySourceId]
    )

    useEffect(() => {
        const wasOpen = wasOpenRef.current

        if (open && !wasOpen) {
            setReady(false)
            manuallyChangedFieldIdsRef.current = new Set()
            setBlockEditorErrors({})
            setFormData(applyFieldDefaults(initialData ?? {}))
            setActiveWizardStep(0)
            setReady(true)
        } else if (!open && wasOpen) {
            setReady(false)
            manuallyChangedFieldIdsRef.current = new Set()
            setBlockEditorErrors({})
            setActiveWizardStep(0)
        }

        wasOpenRef.current = open
    }, [open, initialData, applyFieldDefaults])

    const normalizedLocale = useMemo(() => normalizeLocale(locale), [locale])

    const { t } = useTranslation('apps')

    const recordPickerFields = useMemo(
        () =>
            fields
                .map((field) => ({ field, config: readRuntimeRecordPickerConfig(field) }))
                .filter((item): item is { field: FieldConfig; config: RuntimeRecordPickerConfig } => Boolean(item.config)),
        [fields]
    )

    const recordPickerFieldIdsByTargetId = useMemo(() => {
        const result = new Map<string, string[]>()
        for (const { field, config } of recordPickerFields) {
            const existing = result.get(config.targetObjectCodenameField) ?? []
            existing.push(field.id)
            result.set(config.targetObjectCodenameField, existing)
        }
        return result
    }, [recordPickerFields])

    const objectCollectionByCodename = useMemo(
        () => new Map(objectCollections.map((item) => [item.codename, item] as const)),
        [objectCollections]
    )

    const recordPickerRequestKey = useMemo(
        () =>
            recordPickerFields
                .map(({ field, config }) => {
                    const targetCodename =
                        typeof formData[config.targetObjectCodenameField] === 'string'
                            ? String(formData[config.targetObjectCodenameField]).trim()
                            : ''
                    const isAllowed = !config.allowedObjectCodenames || config.allowedObjectCodenames.includes(targetCodename)
                    const targetObjectCollectionId = isAllowed ? objectCollectionByCodename.get(targetCodename)?.id ?? '' : ''
                    return [field.id, targetCodename, targetObjectCollectionId, config.labelFields.join(','), String(config.limit)].join(
                        ':'
                    )
                })
                .join('|'),
        [formData, objectCollectionByCodename, recordPickerFields]
    )

    const [recordPickerOptionsByFieldId, setRecordPickerOptionsByFieldId] = useState<
        Record<string, { targetCodename: string; loading: boolean; error: string | null; options: RuntimeRecordPickerOption[] }>
    >({})

    useEffect(() => {
        if (!open || !apiBaseUrl || !applicationId || recordPickerFields.length === 0) {
            setRecordPickerOptionsByFieldId({})
            return
        }

        let isCancelled = false

        for (const { field, config } of recordPickerFields) {
            const targetCodename =
                typeof formData[config.targetObjectCodenameField] === 'string'
                    ? String(formData[config.targetObjectCodenameField]).trim()
                    : ''
            const isAllowed = !config.allowedObjectCodenames || config.allowedObjectCodenames.includes(targetCodename)
            const targetObjectCollectionId = isAllowed ? objectCollectionByCodename.get(targetCodename)?.id ?? null : null

            if (!targetCodename || !targetObjectCollectionId) {
                setRecordPickerOptionsByFieldId((current) => ({
                    ...current,
                    [field.id]: { targetCodename, loading: false, error: null, options: [] }
                }))
                continue
            }

            setRecordPickerOptionsByFieldId((current) => ({
                ...current,
                [field.id]: { targetCodename, loading: true, error: null, options: current[field.id]?.options ?? [] }
            }))

            fetchAppData({
                apiBaseUrl,
                applicationId,
                objectCollectionId: targetObjectCollectionId,
                workspaceId: currentWorkspaceId,
                limit: config.limit,
                offset: 0,
                locale: normalizedLocale
            })
                .then((response) => {
                    if (isCancelled) return
                    setRecordPickerOptionsByFieldId((current) => ({
                        ...current,
                        [field.id]: {
                            targetCodename,
                            loading: false,
                            error: null,
                            options: response.rows.map((row) => ({
                                id: row.id,
                                label: getRuntimeRecordPickerLabel(row, config.labelFields, normalizedLocale)
                            }))
                        }
                    }))
                })
                .catch((error: unknown) => {
                    if (isCancelled) return
                    setRecordPickerOptionsByFieldId((current) => ({
                        ...current,
                        [field.id]: {
                            targetCodename,
                            loading: false,
                            error: error instanceof Error ? error.message : t('recordPicker.loadFailed', 'Unable to load records.'),
                            options: []
                        }
                    }))
                })
        }

        return () => {
            isCancelled = true
        }
    }, [
        open,
        apiBaseUrl,
        applicationId,
        currentWorkspaceId,
        normalizedLocale,
        objectCollectionByCodename,
        recordPickerFields,
        recordPickerRequestKey,
        formData,
        t
    ])

    const resolvePlainTextForSync = useCallback(
        (value: unknown): string => {
            if (typeof value === 'string') return value
            const localizedValue = getLocalizedStringValue(value, normalizedLocale)
            if (typeof localizedValue === 'string') return localizedValue
            if (value === null || value === undefined) return ''
            return String(value)
        },
        [normalizedLocale]
    )

    const buildSyncedFieldValue = useCallback(
        (sourceValue: unknown, targetField: FieldConfig, syncTarget: FieldSyncTarget): unknown => {
            if (syncTarget.transform !== 'plainText') return sourceValue
            if (targetField.type === 'STRING' && isLocalizedStringField(targetField)) {
                if (isLocalizedContent(sourceValue)) return sourceValue
                return createLocalizedContent(normalizedLocale, resolvePlainTextForSync(sourceValue))
            }
            return resolvePlainTextForSync(sourceValue)
        },
        [normalizedLocale, resolvePlainTextForSync]
    )

    const isTargetValuePresentForSync = useCallback((targetField: FieldConfig, value: unknown) => {
        if (value === null || value === undefined) return false
        if (targetField.type === 'STRING' && isLocalizedContent(value)) return hasAnyLocalizedContent(value)
        if (typeof value === 'string') return value.trim().length > 0
        return true
    }, [])

    const handleFieldChange = useCallback(
        (id: string, value: unknown) => {
            manuallyChangedFieldIdsRef.current.add(id)

            setFormData((prev) => {
                const next = { ...prev, [id]: value }

                if (prev[id] !== value) {
                    const dependentRecordPickerFieldIds = recordPickerFieldIdsByTargetId.get(id) ?? []
                    for (const dependentFieldId of dependentRecordPickerFieldIds) {
                        next[dependentFieldId] = null
                    }
                }

                const targetSyncRules = syncTargetsByTargetId.get(id) ?? []
                for (const syncTarget of targetSyncRules) {
                    if (syncTarget.manualFlagFieldId) {
                        next[syncTarget.manualFlagFieldId] = true
                    }
                }

                const syncTargets = syncTargetsBySourceId.get(id) ?? []
                for (const syncTarget of syncTargets) {
                    if (syncTarget.fieldId === id) continue
                    const targetField = fieldById.get(syncTarget.fieldId)
                    if (!targetField) continue

                    const targetWasEdited =
                        manuallyChangedFieldIdsRef.current.has(syncTarget.fieldId) ||
                        (syncTarget.manualFlagFieldId ? next[syncTarget.manualFlagFieldId] === true : false)
                    if (syncTarget.mode === 'untilTargetEdited' && targetWasEdited) continue
                    if (syncTarget.mode === 'whenTargetEmpty' && isTargetValuePresentForSync(targetField, next[syncTarget.fieldId]))
                        continue

                    next[syncTarget.fieldId] = buildSyncedFieldValue(value, targetField, syncTarget)
                    if (syncTarget.manualFlagFieldId && next[syncTarget.manualFlagFieldId] === undefined) {
                        next[syncTarget.manualFlagFieldId] = false
                    }
                }

                return next
            })
        },
        [
            buildSyncedFieldValue,
            fieldById,
            isTargetValuePresentForSync,
            recordPickerFieldIdsByTargetId,
            syncTargetsBySourceId,
            syncTargetsByTargetId
        ]
    )

    const handleBlockEditorValidationError = useCallback((id: string, message: string | null) => {
        setBlockEditorErrors((prev) => {
            if (prev[id] === message) return prev
            return { ...prev, [id]: message }
        })
    }, [])

    const resolveValuePresent = useCallback(
        (field: FieldConfig, value: unknown) => {
            if (isValuePresent) {
                return isValuePresent(field, value)
            }
            if (value === null || value === undefined) return false
            if (field.type === 'STRING') {
                if (field.localized !== false && isLocalizedContent(value)) {
                    return hasAnyLocalizedContent(value)
                }
                if (typeof value === 'string') return value.trim() !== ''
                return String(value).trim() !== ''
            }
            if (field.type === 'NUMBER') {
                return typeof value === 'number' ? !Number.isNaN(value) : value !== ''
            }
            if (field.type === 'BOOLEAN') {
                return value !== undefined
            }
            if (field.type === 'JSON') {
                if (isResourceSourceField(field)) return hasResourceSourceLocator(value)
                if (typeof value === 'string') return value.trim() !== ''
                if (value && typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0
                return true
            }
            if (typeof value === 'string') return value.trim() !== ''
            return true
        },
        [isValuePresent]
    )

    const getStringValueForValidation = useCallback(
        (value: unknown) => {
            if (typeof value === 'string') return value
            const localizedValue = getLocalizedStringValue(value, normalizedLocale)
            if (typeof localizedValue === 'string') return localizedValue
            if (value === null || value === undefined) return null
            return String(value)
        },
        [normalizedLocale]
    )

    /**
     * For VLC fields, check minLength for ALL locales that have content.
     * Returns the locale code that fails validation, or null if all pass.
     */
    const getVlcMinLengthError = useCallback((value: unknown, minLength: number): string | null => {
        if (!isLocalizedContent(value)) return null
        const vlc = value as VersionedLocalizedContent<string>
        const locales = vlc.locales
        for (const [localeCode, entry] of Object.entries(locales)) {
            const content = entry?.content
            if (typeof content === 'string' && content.length > 0 && content.length < minLength) {
                return localeCode
            }
        }
        return null
    }, [])

    const getFieldError = useCallback(
        (field: FieldConfig, value: unknown) => {
            if (!resolveValuePresent(field, value)) return null

            const rules = field.validationRules ?? {}

            if (field.type === 'STRING') {
                const minLength = typeof rules.minLength === 'number' ? rules.minLength : null
                const maxLength = typeof rules.maxLength === 'number' ? rules.maxLength : null

                if (isLocalizedContent(value) && minLength !== null) {
                    const failedLocale = getVlcMinLengthError(value, minLength)
                    if (failedLocale) {
                        return t('validation.vlcMinLength', {
                            defaultValue: 'Language "{{locale}}": minimum length {{min}}',
                            locale: failedLocale.toUpperCase(),
                            min: minLength
                        })
                    }
                }

                const stringValue = getStringValueForValidation(value)
                if (typeof stringValue === 'string') {
                    if (minLength !== null && maxLength !== null) {
                        if (stringValue.length < minLength || stringValue.length > maxLength) {
                            return t('validation.lengthBetween', {
                                defaultValue: 'Length must be between {{min}} and {{max}}',
                                min: minLength,
                                max: maxLength
                            })
                        }
                    } else if (minLength !== null && stringValue.length < minLength) {
                        return t('validation.minLength', {
                            defaultValue: 'Minimum length: {{min}}',
                            min: minLength
                        })
                    } else if (maxLength !== null && stringValue.length > maxLength) {
                        return t('validation.maxLength', {
                            defaultValue: 'Maximum length: {{max}}',
                            max: maxLength
                        })
                    }
                }
            }

            if (field.type === 'NUMBER') {
                if (typeof value !== 'number' || Number.isNaN(value)) {
                    return null
                }

                const result = validateNumber(value, toNumberRules(rules))
                if (result.valid) return null

                switch (result.errorKey) {
                    case 'mustBeNonNegative':
                        return t('validation.nonNegative', 'Must be non-negative')
                    case 'belowMinimum':
                        return t('validation.minValue', {
                            defaultValue: 'Minimum value: {{min}}',
                            min: rules.min
                        })
                    case 'aboveMaximum':
                        return t('validation.maxValue', {
                            defaultValue: 'Maximum value: {{max}}',
                            max: rules.max
                        })
                    case 'tooManyIntegerDigits':
                    case 'tooManyDecimalDigits':
                    case 'exceedsSafeInteger':
                        return t('validation.numberPrecisionExceeded', 'Value exceeds allowed precision')
                    default:
                        return result.errorMessage ?? t('validation.invalidNumber', 'Invalid number')
                }
            }

            if (field.type === 'DATE') {
                if (typeof value !== 'string') return null

                const composition = rules.dateComposition ?? 'datetime'
                if (composition === 'time') {
                    return isValidTimeString(value) ? null : t('validation.timeFormat', 'Expected time format: HH:MM')
                }
                if (composition === 'date') {
                    return isValidDateString(value) ? null : t('validation.dateFormat', 'Expected date format: YYYY-MM-DD')
                }

                return isValidDateTimeString(value) ? null : t('validation.datetimeFormat', 'Expected date & time format: YYYY-MM-DD HH:MM')
            }

            if (isResourceSourceField(field)) {
                if (!hasResourceSourceLocator(value)) return null
                const parsed = resourceSourceSchema.safeParse(parseJsonStringValue(value))
                if (!parsed.success) {
                    const errorKey = getResourceSourceErrorKey(value)
                    switch (errorKey) {
                        case 'url':
                            return t('resourceSource.errors.url', 'Enter an absolute http or https URL.')
                        case 'pageCodename':
                            return t('resourceSource.errors.pageCodename', 'Select or enter a page codename.')
                        case 'storageKey':
                            return t('resourceSource.errors.storageKey', 'Enter a storage key.')
                        case 'packageDescriptor':
                            return t('resourceSource.errors.packageDescriptor', 'Enter a package descriptor.')
                        case 'mimeType':
                            return t('resourceSource.errors.mimeType', 'The MIME type is not supported for this resource.')
                        case 'singleLocator':
                            return t('resourceSource.errors.singleLocator', 'Define exactly one source locator.')
                        case 'embedHost':
                            return t('resourceSource.errors.embedHost', 'This embed host is not allowed.')
                        default:
                            return t('resourceSource.invalid', 'Resource source is not valid.')
                    }
                }
            }

            return null
        },
        [t, getStringValueForValidation, getVlcMinLengthError, resolveValuePresent]
    )

    const hasAnyValue = useMemo(
        () => fields.some((field) => resolveValuePresent(field, formData[field.id])),
        [fields, formData, resolveValuePresent]
    )

    const hasMissingRequired = useMemo(
        () =>
            fields.some((field) => {
                if (isHiddenField(field, formData)) return false
                const required = isFieldRequired(field, formData)
                if (field.type === 'TABLE' && required) {
                    // TABLE required: must have at least max(1, minRows) rows
                    const rows = formData[field.id]
                    const rowCount = Array.isArray(rows) ? rows.length : 0
                    const tableMinRows = typeof field.validationRules?.minRows === 'number' ? field.validationRules.minRows : null
                    const minRequired = Math.max(1, tableMinRows ?? 1)
                    if (rowCount < minRequired) return true
                    return false
                }
                if (required && !resolveValuePresent(field, formData[field.id])) return true
                return false
            }),
        [fields, formData, resolveValuePresent]
    )

    const hasValidationErrors = useMemo(
        () =>
            fields.some(
                (field) =>
                    !isHiddenField(field, formData) &&
                    (Boolean(getFieldError(field, formData[field.id])) || Boolean(blockEditorErrors[field.id]))
            ),
        [blockEditorErrors, fields, formData, getFieldError]
    )

    const hasMissingRequiredForFields = useCallback(
        (candidateFields: FieldConfig[]) =>
            candidateFields.some((field) => {
                const required = isFieldRequired(field, formData)
                if (field.type === 'TABLE') {
                    const value = formData[field.id]
                    const rowCount = Array.isArray(value) ? value.length : 0
                    const minRequired =
                        typeof field.validationRules?.minRows === 'number' && Number.isInteger(field.validationRules.minRows)
                            ? field.validationRules.minRows
                            : required
                            ? 1
                            : 0
                    if (rowCount < minRequired) return true
                    return false
                }
                if (required && !resolveValuePresent(field, formData[field.id])) return true
                return false
            }),
        [formData, resolveValuePresent]
    )

    const hasValidationErrorsForFields = useCallback(
        (candidateFields: FieldConfig[]) =>
            candidateFields.some((field) => Boolean(getFieldError(field, formData[field.id])) || Boolean(blockEditorErrors[field.id])),
        [blockEditorErrors, formData, getFieldError]
    )

    const buildPayload = useCallback(() => {
        const payload: Record<string, unknown> = {}
        fields.forEach((field) => {
            const dateOffsetDerivation = readFieldDateOffsetDerivation(field)
            const derivedValue = dateOffsetDerivation ? deriveDateOffsetValue(dateOffsetDerivation, formData) : undefined
            if (derivedValue !== undefined) {
                payload[field.id] = derivedValue
                return
            }
            if (isConditionallyHiddenField(field, formData)) return
            const value = formData[field.id]
            if (!resolveValuePresent(field, value)) return
            // Strip internal-only properties from TABLE row arrays before sending to the API
            if (field.type === 'TABLE' && Array.isArray(value)) {
                payload[field.id] = value.map((row: Record<string, unknown>) => {
                    const { _localId, __rowId, ...rest } = row
                    return field.childFields ? normalizeTabularRowValues(rest, field.childFields, normalizedLocale) : rest
                })
            } else {
                payload[field.id] = value
            }
        })
        return payload
    }, [fields, formData, normalizedLocale, resolveValuePresent])

    const handleSubmit = async () => {
        if (hasMissingRequired) return
        if (requireAnyValue && !hasAnyValue) return
        await onSubmit(buildPayload())
    }

    const renderField = (field: FieldConfig) => {
        const value = formData[field.id]
        const disabled = isSubmitting
        const rules = field.validationRules
        const fieldError = getFieldError(field, value)
        const helperText = fieldError ?? field.helperText

        const customField = renderFieldOverride?.({
            field,
            value,
            onChange: (next) => handleFieldChange(field.id, next),
            disabled,
            error: fieldError,
            helperText,
            locale: normalizedLocale
        })

        if (customField !== undefined) {
            return customField
        }

        switch (field.type) {
            case 'STRING': {
                const isLocalized = rules?.localized ?? field.localized
                const isVersioned = rules?.versioned
                const isMultiline = isTextareaField(field)
                const multilineRows = getTextareaRows(field)

                const vlcErrorLocale = isLocalizedContent(value) && rules?.minLength ? getVlcMinLengthError(value, rules.minLength) : null

                if (isLocalized) {
                    return (
                        <LocalizedInlineField
                            mode='localized'
                            label={field.label}
                            required={field.required}
                            value={ensureLocalizedValue(value, normalizedLocale)}
                            onChange={(next) => handleFieldChange(field.id, next)}
                            uiLocale={locale}
                            disabled={disabled}
                            error={fieldError}
                            errorLocale={vlcErrorLocale}
                            helperText={field.helperText}
                            multiline={isMultiline}
                            rows={isMultiline ? multilineRows : undefined}
                            maxLength={rules?.maxLength}
                            minLength={rules?.minLength}
                        />
                    )
                }

                if (isVersioned) {
                    return (
                        <LocalizedInlineField
                            mode='versioned'
                            label={field.label}
                            required={field.required}
                            value={ensureLocalizedValue(value, normalizedLocale)}
                            onChange={(next) => handleFieldChange(field.id, next)}
                            uiLocale={locale}
                            disabled={disabled}
                            error={fieldError}
                            errorLocale={vlcErrorLocale}
                            helperText={field.helperText}
                            multiline={isMultiline}
                            rows={isMultiline ? multilineRows : undefined}
                            maxLength={rules?.maxLength}
                            minLength={rules?.minLength}
                        />
                    )
                }

                const stringOptions = readStringSelectOptions(field, normalizedLocale)
                if (stringOptions.length > 0) {
                    const stringValue = typeof value === 'string' ? value : ''
                    return (
                        <FormControl fullWidth error={Boolean(fieldError)}>
                            <InputLabel id={`${field.id}-string-select-label`}>{field.label}</InputLabel>
                            <Select
                                labelId={`${field.id}-string-select-label`}
                                value={stringOptions.some((option) => option.value === stringValue) ? stringValue : ''}
                                label={field.label}
                                onChange={(event) => handleFieldChange(field.id, event.target.value || null)}
                                required={field.required}
                                disabled={disabled}
                                sx={{ bgcolor: 'background.default' }}
                                MenuProps={{ PaperProps: { sx: { '& .MuiMenuItem-root': { minHeight: 40 } } } }}
                            >
                                {!field.required && <MenuItem value=''> </MenuItem>}
                                {stringOptions.map((option) => (
                                    <MenuItem key={option.value} value={option.value}>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </Select>
                            {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
                        </FormControl>
                    )
                }

                const recordPickerConfig = readRuntimeRecordPickerConfig(field)
                if (recordPickerConfig) {
                    const targetCodename =
                        typeof formData[recordPickerConfig.targetObjectCodenameField] === 'string'
                            ? String(formData[recordPickerConfig.targetObjectCodenameField]).trim()
                            : ''
                    const isAllowed =
                        !recordPickerConfig.allowedObjectCodenames || recordPickerConfig.allowedObjectCodenames.includes(targetCodename)
                    const pickerState = recordPickerOptionsByFieldId[field.id]
                    const pickerOptions = pickerState?.targetCodename === targetCodename ? pickerState.options : []
                    const stringValue = typeof value === 'string' ? value : ''
                    const hasSelectedOption = pickerOptions.some((option) => option.id === stringValue)
                    const selectValue = hasSelectedOption ? stringValue : ''
                    const pickerHelperText =
                        fieldError ??
                        pickerState?.error ??
                        field.helperText ??
                        (!targetCodename
                            ? t('recordPicker.selectTargetObjectFirst', 'Select the target object first.')
                            : !isAllowed
                            ? t('recordPicker.unsupportedTargetObject', 'This target object is not available for selection.')
                            : pickerState?.loading
                            ? t('recordPicker.loading', 'Loading records...')
                            : undefined)

                    return (
                        <FormControl fullWidth error={Boolean(fieldError || pickerState?.error)}>
                            <InputLabel id={`${field.id}-runtime-record-picker-label`}>{field.label}</InputLabel>
                            <Select
                                labelId={`${field.id}-runtime-record-picker-label`}
                                value={selectValue}
                                label={field.label}
                                onChange={(event) => handleFieldChange(field.id, event.target.value || null)}
                                required={field.required}
                                disabled={disabled || !targetCodename || !isAllowed || pickerState?.loading}
                                sx={{ bgcolor: 'background.default' }}
                                MenuProps={{ PaperProps: { sx: { '& .MuiMenuItem-root': { minHeight: 40 } } } }}
                            >
                                {!field.required && <MenuItem value=''> </MenuItem>}
                                {!hasSelectedOption && stringValue ? <MenuItem value={stringValue}>{stringValue}</MenuItem> : null}
                                {pickerOptions.map((option) => (
                                    <MenuItem key={option.id} value={option.id}>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </Select>
                            {pickerHelperText ? <FormHelperText>{pickerHelperText}</FormHelperText> : null}
                        </FormControl>
                    )
                }

                return (
                    <TextField
                        fullWidth
                        multiline={isMultiline}
                        rows={isMultiline ? multilineRows : undefined}
                        label={field.label}
                        value={typeof value === 'string' ? value : value == null ? '' : String(value)}
                        onChange={(event) => handleFieldChange(field.id, event.target.value)}
                        required={field.required}
                        disabled={disabled}
                        placeholder={field.placeholder}
                        error={Boolean(fieldError)}
                        helperText={helperText}
                        inputProps={{
                            minLength: rules?.minLength ?? undefined,
                            maxLength: rules?.maxLength ?? undefined
                        }}
                    />
                )
            }
            case 'NUMBER': {
                const precision = rules?.precision ?? NUMBER_DEFAULTS.precision
                const scale = rules?.scale ?? NUMBER_DEFAULTS.scale
                const maxIntegerDigits = precision - scale
                const allowNegative = !rules?.nonNegative
                const fieldLocale = normalizeLocale(locale)
                const decimalSeparator = scale > 0 ? (fieldLocale === 'ru' ? ',' : '.') : ''

                const formatNumberValue = (val: unknown): string => {
                    if (val === null || val === undefined || val === '') {
                        if (!field.required) return ''
                        return scale > 0 ? `0${decimalSeparator}${'0'.repeat(scale)}` : '0'
                    }
                    if (typeof val === 'number') {
                        if (Number.isNaN(val)) {
                            if (!field.required) return ''
                            return scale > 0 ? `0${decimalSeparator}${'0'.repeat(scale)}` : '0'
                        }
                        return scale > 0 ? val.toFixed(scale).replace('.', decimalSeparator) : String(Math.trunc(val))
                    }
                    const parsed = parseFloat(String(val))
                    if (Number.isNaN(parsed)) {
                        if (!field.required) return ''
                        return scale > 0 ? `0${decimalSeparator}${'0'.repeat(scale)}` : '0'
                    }
                    return scale > 0 ? parsed.toFixed(scale).replace('.', decimalSeparator) : String(Math.trunc(parsed))
                }

                const selectNumberPart = (target: HTMLInputElement) => {
                    // Guard against stale DOM target after re-render (rAF may fire after unmount)
                    if (!target || target.value == null) return
                    if (scale <= 0) {
                        target.setSelectionRange(0, target.value.length)
                        numberCursorZoneRef.current.set(field.id, 'integer')
                        return
                    }
                    const valueText = target.value
                    const signOffset = valueText.startsWith('-') ? 1 : 0
                    const separatorIndex = valueText.indexOf(decimalSeparator)
                    if (separatorIndex === -1) {
                        target.setSelectionRange(signOffset, valueText.length)
                        numberCursorZoneRef.current.set(field.id, 'integer')
                        return
                    }
                    const cursor = target.selectionStart ?? 0
                    if (cursor <= separatorIndex) {
                        target.setSelectionRange(signOffset, separatorIndex)
                        numberCursorZoneRef.current.set(field.id, 'integer')
                    } else {
                        target.setSelectionRange(separatorIndex + 1, valueText.length)
                        numberCursorZoneRef.current.set(field.id, 'decimal')
                    }
                }

                const handleNumberFocus = (event: React.FocusEvent<HTMLInputElement>) => {
                    const target = event.target
                    window.requestAnimationFrame(() => selectNumberPart(target))
                }

                const handleNumberClick = (event: React.MouseEvent<HTMLInputElement>) => {
                    const target = event.target as HTMLInputElement
                    window.requestAnimationFrame(() => selectNumberPart(target))
                }

                const handleNumberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
                    const inputValue = event.target.value

                    if (inputValue === '' || inputValue === '-') {
                        handleFieldChange(field.id, null)
                        return
                    }

                    const normalizedInput = inputValue.replace(/,/g, '.')

                    const validPattern = allowNegative ? /^-?\d*\.?\d*$/ : /^\d*\.?\d*$/

                    if (!validPattern.test(normalizedInput)) {
                        return
                    }

                    const isNegative = normalizedInput.startsWith('-')
                    const absValue = isNegative ? normalizedInput.slice(1) : normalizedInput
                    const [intPart = '', decPart = ''] = absValue.split('.')

                    if (intPart.length > maxIntegerDigits) {
                        return
                    }
                    if (decPart.length > scale) {
                        return
                    }

                    const parsed = parseFloat(normalizedInput)
                    if (Number.isFinite(parsed)) {
                        handleFieldChange(field.id, parsed)
                    }
                }

                const handleNumberKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
                    const key = event.key
                    const target = event.target as HTMLInputElement
                    const currentValue = target.value
                    const selectionStart = target.selectionStart ?? 0
                    const selectionEnd = target.selectionEnd ?? selectionStart
                    const hasSelection = selectionEnd > selectionStart
                    const separatorIndex = scale > 0 ? currentValue.indexOf(decimalSeparator) : -1

                    if ((key === 'Backspace' || key === 'Delete') && scale > 0 && separatorIndex !== -1) {
                        const selectionCrossesSeparator = selectionStart <= separatorIndex && selectionEnd > separatorIndex
                        const backspaceOnSeparator =
                            key === 'Backspace' && selectionStart === separatorIndex + 1 && selectionEnd === selectionStart
                        const deleteOnSeparator = key === 'Delete' && selectionStart === separatorIndex && selectionEnd === selectionStart
                        if (selectionCrossesSeparator || backspaceOnSeparator || deleteOnSeparator) {
                            event.preventDefault()
                            return
                        }
                    }

                    // ArrowUp/ArrowDown: trigger zone-aware stepper increment/decrement
                    if (key === 'ArrowUp') {
                        event.preventDefault()
                        const zone: 'integer' | 'decimal' =
                            scale > 0 && separatorIndex !== -1 && selectionStart > separatorIndex ? 'decimal' : 'integer'
                        numberCursorZoneRef.current.set(field.id, zone)
                        handleStepUp(zone)
                        return
                    }
                    if (key === 'ArrowDown') {
                        event.preventDefault()
                        const zone: 'integer' | 'decimal' =
                            scale > 0 && separatorIndex !== -1 && selectionStart > separatorIndex ? 'decimal' : 'integer'
                        numberCursorZoneRef.current.set(field.id, zone)
                        handleStepDown(zone)
                        return
                    }

                    if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) {
                        return
                    }

                    if (event.ctrlKey || event.metaKey) {
                        return
                    }

                    if (key === '-') {
                        if (!allowNegative) {
                            event.preventDefault()
                            return
                        }
                        if (selectionStart !== 0 || currentValue.includes('-')) {
                            event.preventDefault()
                        }
                        return
                    }

                    if (key === '.' || key === ',') {
                        if (scale === 0) {
                            event.preventDefault()
                            return
                        }
                        event.preventDefault()
                        if (separatorIndex !== -1) {
                            const decimalStart = separatorIndex + 1
                            window.requestAnimationFrame(() => target.setSelectionRange(decimalStart, currentValue.length))
                        }
                        return
                    }

                    if (/^\d$/.test(key)) {
                        if (scale > 0 && separatorIndex !== -1 && selectionStart > separatorIndex) {
                            event.preventDefault()
                            const decimalStart = separatorIndex + 1
                            const localIndex = Math.min(selectionStart, currentValue.length) - decimalStart
                            const decimalChars = currentValue.slice(decimalStart).split('')
                            if (localIndex >= 0 && localIndex < decimalChars.length) {
                                decimalChars[localIndex] = key
                                const nextValue = `${currentValue.slice(0, decimalStart)}${decimalChars.join('')}`
                                const parsed = parseFloat(nextValue.replace(/,/g, '.'))
                                if (Number.isFinite(parsed)) {
                                    handleFieldChange(field.id, parsed)
                                }
                                const nextCaret = Math.min(decimalStart + localIndex + 1, decimalStart + scale)
                                window.requestAnimationFrame(() => target.setSelectionRange(nextCaret, nextCaret))
                                return
                            }
                        }

                        const normalizedValue = currentValue.replace(/,/g, '.')
                        const isNeg = normalizedValue.startsWith('-')
                        const absVal = isNeg ? normalizedValue.slice(1) : normalizedValue
                        const decimalIndex = absVal.indexOf('.')

                        if (decimalIndex === -1) {
                            const intPartLength = absVal.length
                            if (intPartLength >= maxIntegerDigits && selectionStart >= (isNeg ? 1 : 0) && !hasSelection) {
                                event.preventDefault()
                            }
                        } else {
                            const adjustedPos = isNeg ? selectionStart - 1 : selectionStart
                            if (adjustedPos <= decimalIndex) {
                                const intPart = absVal.slice(0, decimalIndex)
                                if (intPart.length >= maxIntegerDigits && !hasSelection) {
                                    event.preventDefault()
                                }
                            } else {
                                const decPart = absVal.slice(decimalIndex + 1)
                                if (decPart.length >= scale && !hasSelection) {
                                    event.preventDefault()
                                }
                            }
                        }
                        return
                    }

                    event.preventDefault()
                }

                const handleNumberBlur = () => {
                    if ((value === null || value === undefined) && field.required) {
                        handleFieldChange(field.id, 0)
                    }
                }

                const constraintParts: string[] = []

                const formatInfo =
                    scale > 0
                        ? t('validation.numberLengthWithScale', {
                              defaultValue: 'Length: {{integer}},{{scale}}',
                              integer: maxIntegerDigits,
                              scale
                          })
                        : t('validation.numberLength', {
                              defaultValue: 'Length: {{integer}}',
                              integer: maxIntegerDigits
                          })
                constraintParts.push(formatInfo)

                if (typeof rules?.min === 'number' && typeof rules?.max === 'number') {
                    constraintParts.push(
                        t('validation.range', {
                            defaultValue: 'Range: {{min}}–{{max}}',
                            min: rules.min,
                            max: rules.max
                        })
                    )
                } else if (typeof rules?.min === 'number') {
                    constraintParts.push(
                        t('validation.min', {
                            defaultValue: 'Min: {{min}}',
                            min: rules.min
                        })
                    )
                } else if (typeof rules?.max === 'number') {
                    constraintParts.push(
                        t('validation.max', {
                            defaultValue: 'Max: {{max}}',
                            max: rules.max
                        })
                    )
                }
                if (rules?.nonNegative) {
                    constraintParts.push(t('validation.nonNegativeOnly', 'Non-negative only'))
                }

                const numberHelperText = fieldError ?? constraintParts.join(', ')

                // Zone-aware stepper: integer zone → step 1, decimal zone → step 10^(-scale)
                const numberRules = toNumberRules(rules)
                const getStepValue = (zone?: 'integer' | 'decimal') => {
                    if (scale <= 0) return 1
                    return zone === 'decimal' ? Math.pow(10, -scale) : 1
                }
                const handleStepUp = (zone?: 'integer' | 'decimal') => {
                    const effectiveZone = zone ?? numberCursorZoneRef.current.get(field.id) ?? 'integer'
                    const step = getStepValue(effectiveZone)
                    const current = typeof value === 'number' && Number.isFinite(value) ? value : 0
                    let next = Number((current + step).toFixed(scale))
                    if (typeof rules?.max === 'number' && next > rules.max) next = rules.max
                    if (!validateNumber(next, numberRules).valid) return
                    handleFieldChange(field.id, next)
                }
                const handleStepDown = (zone?: 'integer' | 'decimal') => {
                    const effectiveZone = zone ?? numberCursorZoneRef.current.get(field.id) ?? 'integer'
                    const step = getStepValue(effectiveZone)
                    const current = typeof value === 'number' && Number.isFinite(value) ? value : 0
                    let next = Number((current - step).toFixed(scale))
                    if (rules?.nonNegative && next < 0) next = 0
                    if (typeof rules?.min === 'number' && next < rules.min) next = rules.min
                    if (!validateNumber(next, numberRules).valid) return
                    handleFieldChange(field.id, next)
                }

                return (
                    <TextField
                        fullWidth
                        type='text'
                        inputMode='decimal'
                        label={field.label}
                        value={formatNumberValue(value)}
                        onChange={handleNumberChange}
                        onKeyDown={handleNumberKeyDown}
                        onFocus={handleNumberFocus}
                        onClick={handleNumberClick}
                        onBlur={handleNumberBlur}
                        required={field.required}
                        disabled={disabled}
                        placeholder={scale > 0 ? `0${decimalSeparator}${'0'.repeat(scale)}` : '0'}
                        error={Boolean(fieldError)}
                        helperText={numberHelperText}
                        inputRef={(el: HTMLInputElement | null) => {
                            if (el) {
                                numberInputRefsRef.current.set(field.id, el)
                            } else {
                                numberInputRefsRef.current.delete(field.id)
                            }
                        }}
                        inputProps={{ style: { textAlign: 'right' } }}
                        InputProps={{
                            endAdornment: !disabled ? (
                                <InputAdornment position='end'>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', ml: 0.5, mr: -0.5 }}>
                                        <IconButton
                                            size='small'
                                            tabIndex={-1}
                                            onClick={() => handleStepUp()}
                                            sx={{ width: 20, height: 16, p: 0 }}
                                            aria-label={t('number.increment', 'Increment')}
                                        >
                                            <ArrowDropUpIcon sx={{ fontSize: 18 }} />
                                        </IconButton>
                                        <IconButton
                                            size='small'
                                            tabIndex={-1}
                                            onClick={() => handleStepDown()}
                                            sx={{ width: 20, height: 16, p: 0 }}
                                            aria-label={t('number.decrement', 'Decrement')}
                                        >
                                            <ArrowDropDownIcon sx={{ fontSize: 18 }} />
                                        </IconButton>
                                    </Box>
                                </InputAdornment>
                            ) : undefined
                        }}
                    />
                )
            }
            case 'BOOLEAN':
                return (
                    <FormControlLabel
                        control={
                            <Checkbox checked={Boolean(value)} onChange={(event) => handleFieldChange(field.id, event.target.checked)} />
                        }
                        label={field.label}
                        disabled={disabled}
                    />
                )
            case 'DATE': {
                const composition = rules?.dateComposition ?? 'datetime'
                let inputType: 'date' | 'time' | 'datetime-local'
                let maxValue: string | undefined

                switch (composition) {
                    case 'date':
                        inputType = 'date'
                        maxValue = '9999-12-31'
                        break
                    case 'time':
                        inputType = 'time'
                        maxValue = undefined
                        break
                    case 'datetime':
                    default:
                        inputType = 'datetime-local'
                        maxValue = '9999-12-31T23:59'
                        break
                }

                return (
                    <TextField
                        fullWidth
                        type={inputType}
                        label={field.label}
                        value={(value as string) ?? ''}
                        onChange={(event) => {
                            const normalizedValue = normalizeDateValue(event.target.value, inputType)
                            handleFieldChange(field.id, normalizedValue)
                        }}
                        required={field.required}
                        disabled={disabled}
                        InputLabelProps={{ shrink: true }}
                        error={Boolean(fieldError)}
                        helperText={helperText}
                        inputProps={{ max: maxValue }}
                    />
                )
            }
            case 'JSON': {
                if (isResourceSourceField(field)) {
                    const resourceValue = normalizeResourceSourceValue(value)
                    const resourceType = getResourceSourceType(resourceValue)
                    const updateResourceSource = (patch: Partial<ResourceSource> | Record<string, unknown>) => {
                        handleFieldChange(field.id, buildResourceSourceCandidate(resourceValue, patch))
                    }

                    const locatorField =
                        resourceType === 'page' ? (
                            <TextField
                                fullWidth
                                size='small'
                                label={t('resourceSource.pageCodename', 'Page codename')}
                                value={typeof resourceValue.pageCodename === 'string' ? resourceValue.pageCodename : ''}
                                onChange={(event) => updateResourceSource({ pageCodename: event.target.value })}
                                required={field.required}
                                disabled={disabled}
                                error={Boolean(fieldError)}
                            />
                        ) : resourceType === 'scorm' || resourceType === 'xapi' ? (
                            <TextField
                                fullWidth
                                size='small'
                                label={t('resourceSource.packageDescriptor', 'Package descriptor')}
                                value={getPackageDescriptorLabel(resourceValue.packageDescriptor)}
                                onChange={(event) =>
                                    updateResourceSource({
                                        packageDescriptor: {
                                            codename: event.target.value
                                        }
                                    })
                                }
                                required={field.required}
                                disabled={disabled}
                                error={Boolean(fieldError)}
                            />
                        ) : resourceType === 'file' || typeof resourceValue.storageKey === 'string' ? (
                            <TextField
                                fullWidth
                                size='small'
                                label={t('resourceSource.storageKey', 'Storage key')}
                                value={typeof resourceValue.storageKey === 'string' ? resourceValue.storageKey : ''}
                                onChange={(event) => updateResourceSource({ storageKey: event.target.value })}
                                required={field.required}
                                disabled={disabled}
                                error={Boolean(fieldError)}
                            />
                        ) : (
                            <TextField
                                fullWidth
                                size='small'
                                label={t('resourceSource.url', 'Source URL')}
                                value={typeof resourceValue.url === 'string' ? resourceValue.url : ''}
                                onChange={(event) => updateResourceSource({ url: event.target.value })}
                                required={field.required}
                                disabled={disabled}
                                error={Boolean(fieldError)}
                                placeholder='https://'
                            />
                        )

                    return (
                        <Stack spacing={1.25}>
                            <Typography variant='body2' color='text.secondary'>
                                {field.label}
                                {field.required ? ' *' : ''}
                            </Typography>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                <FormControl size='small' sx={{ minWidth: { xs: '100%', sm: 180 } }} error={Boolean(fieldError)}>
                                    <InputLabel id={`${field.id}-resource-type-label`}>
                                        {t('resourceSource.type', 'Resource type')}
                                    </InputLabel>
                                    <Select
                                        labelId={`${field.id}-resource-type-label`}
                                        value={resourceType}
                                        label={t('resourceSource.type', 'Resource type')}
                                        onChange={(event) =>
                                            handleFieldChange(
                                                field.id,
                                                buildDefaultResourceSourceForType(event.target.value as ResourceType)
                                            )
                                        }
                                        disabled={disabled}
                                    >
                                        {RESOURCE_TYPES.map((type) => (
                                            <MenuItem key={type} value={type}>
                                                {t(`resourceSource.types.${type}`, type)}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <Box sx={{ flex: 1 }}>{locatorField}</Box>
                            </Stack>
                            <FormControl size='small' sx={{ maxWidth: { xs: '100%', sm: 220 } }}>
                                <InputLabel id={`${field.id}-launch-mode-label`}>{t('resourceSource.launchMode', 'Launch')}</InputLabel>
                                <Select
                                    labelId={`${field.id}-launch-mode-label`}
                                    value={typeof resourceValue.launchMode === 'string' ? resourceValue.launchMode : 'inline'}
                                    label={t('resourceSource.launchMode', 'Launch')}
                                    onChange={(event) => updateResourceSource({ launchMode: event.target.value })}
                                    disabled={disabled}
                                >
                                    <MenuItem value='inline'>{t('resourceSource.launchModes.inline', 'Inline')}</MenuItem>
                                    <MenuItem value='newTab'>{t('resourceSource.launchModes.newTab', 'New tab')}</MenuItem>
                                    <MenuItem value='download'>{t('resourceSource.launchModes.download', 'Download')}</MenuItem>
                                </Select>
                            </FormControl>
                            {fieldError || helperText ? <FormHelperText error={Boolean(fieldError)}>{helperText}</FormHelperText> : null}
                            {hasResourceSourceLocator(resourceValue) && !fieldError ? (
                                <ResourcePreview source={resourceValue} title={field.label} />
                            ) : null}
                        </Stack>
                    )
                }

                if (isEditorJsBlockContentField(field)) {
                    const blockEditorConfig = isRecord(field.uiConfig?.blockEditor) ? field.uiConfig.blockEditor : field.uiConfig ?? {}
                    const allowedBlockTypes = readStringArray(blockEditorConfig.allowedBlockTypes)
                    const maxBlocks = readFiniteInteger(blockEditorConfig.maxBlocks)
                    const validationOptions = {
                        allowedBlockTypes,
                        maxBlocks
                    } satisfies PageBlockContentValidationOptions
                    const blockEditorValue = normalizeBlockEditorValue(value, validationOptions)
                    const blockEditorError = blockEditorErrors[field.id] ?? null

                    return (
                        <Stack spacing={1}>
                            <Typography variant='body2' color='text.secondary'>
                                {field.label}
                                {field.required ? ' *' : ''}
                            </Typography>
                            <EditorJsBlockEditor
                                value={blockEditorValue}
                                allowedBlockTypes={allowedBlockTypes}
                                maxBlocks={maxBlocks}
                                readOnly={disabled}
                                locale={locale}
                                contentLocale={normalizedLocale}
                                labels={{
                                    loading: t('blockEditor.loading', 'Loading editor...'),
                                    loadError: t('blockEditor.loadError', 'The block editor could not be loaded.'),
                                    validationError: t('blockEditor.validationError', 'The editor content is not valid.'),
                                    fallbackLabel: t('blockEditor.fallbackLabel', 'Editor.js blocks JSON'),
                                    fallbackHelper: t(
                                        'blockEditor.fallbackHelper',
                                        'Fallback JSON editor for recovery when the visual editor cannot be loaded.'
                                    ),
                                    retry: t('blockEditor.retry', 'Retry')
                                }}
                                onChange={(nextValue) => handleFieldChange(field.id, nextValue)}
                                onValidationError={(message) => handleBlockEditorValidationError(field.id, message)}
                            />
                            {blockEditorError || helperText ? (
                                <FormHelperText error={Boolean(blockEditorError || fieldError)}>
                                    {blockEditorError ?? helperText}
                                </FormHelperText>
                            ) : null}
                        </Stack>
                    )
                }

                const stringValue =
                    typeof value === 'string' ? value : value && typeof value === 'object' ? JSON.stringify(value, null, 2) : ''
                return (
                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label={field.label}
                        value={stringValue}
                        onChange={(event) => {
                            try {
                                handleFieldChange(field.id, JSON.parse(event.target.value))
                            } catch {
                                handleFieldChange(field.id, event.target.value)
                            }
                        }}
                        required={field.required}
                        disabled={disabled}
                        placeholder={field.placeholder}
                        error={Boolean(fieldError)}
                        helperText={helperText}
                    />
                )
            }
            case 'REF':
                if (field.refTargetEntityKind === 'set') {
                    const setLabelFromOption =
                        Array.isArray(field.refOptions) && field.refOptions.length > 0 ? field.refOptions[0].label : null
                    const displayLabel =
                        (typeof field.refSetConstantLabel === 'string' && field.refSetConstantLabel.trim().length > 0
                            ? field.refSetConstantLabel
                            : setLabelFromOption) ?? '—'
                    return (
                        <Stack spacing={0.5}>
                            <Typography variant='body2' color='text.secondary'>
                                {field.label}
                            </Typography>
                            <Typography variant='body1'>{displayLabel}</Typography>
                            {helperText ? <FormHelperText error={Boolean(fieldError)}>{helperText}</FormHelperText> : null}
                        </Stack>
                    )
                }

                if (field.refTargetEntityKind === 'enumeration' && Array.isArray(field.enumOptions)) {
                    const options = field.refOptions && field.refOptions.length > 0 ? field.refOptions : field.enumOptions
                    const mode = field.enumPresentationMode ?? 'select'
                    const selectedOption = options.find((option) => option.id === value)
                    const allowEmpty = field.enumAllowEmpty !== false
                    const emptyDisplay = field.enumLabelEmptyDisplay === 'empty' ? 'empty' : 'dash'

                    if (mode === 'label') {
                        return (
                            <Stack spacing={0.5}>
                                <Typography variant='body2' color='text.secondary'>
                                    {field.label}
                                </Typography>
                                <Typography variant='body1'>{selectedOption?.label ?? (emptyDisplay === 'empty' ? '' : '—')}</Typography>
                                {helperText ? <FormHelperText error={Boolean(fieldError)}>{helperText}</FormHelperText> : null}
                            </Stack>
                        )
                    }

                    if (mode === 'radio') {
                        return (
                            <FormControl error={Boolean(fieldError)} required={field.required} disabled={disabled}>
                                <Typography variant='body2' sx={{ mb: 0.5 }}>
                                    {field.label}
                                </Typography>
                                <RadioGroup
                                    value={typeof value === 'string' ? value : ''}
                                    onChange={(event) => handleFieldChange(field.id, event.target.value || null)}
                                >
                                    {options.map((option) => (
                                        <FormControlLabel
                                            key={option.id}
                                            value={option.id}
                                            control={<Radio size='small' />}
                                            label={option.label}
                                        />
                                    ))}
                                </RadioGroup>
                                {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
                            </FormControl>
                        )
                    }

                    return (
                        <FormControl fullWidth error={Boolean(fieldError)}>
                            <InputLabel id={`${field.id}-enum-select-label`}>{field.label}</InputLabel>
                            <Select
                                labelId={`${field.id}-enum-select-label`}
                                value={typeof value === 'string' ? value : ''}
                                label={field.label}
                                onChange={(event) => handleFieldChange(field.id, event.target.value || null)}
                                required={field.required}
                                disabled={disabled}
                                sx={{ bgcolor: 'background.default' }}
                                MenuProps={{ PaperProps: { sx: { '& .MuiMenuItem-root': { minHeight: 40 } } } }}
                            >
                                {!field.required && allowEmpty && <MenuItem value=''> </MenuItem>}
                                {!allowEmpty && <MenuItem value='' sx={{ display: 'none' }} />}
                                {options.map((option) => (
                                    <MenuItem key={option.id} value={option.id}>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </Select>
                            {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
                        </FormControl>
                    )
                }

                if (Array.isArray(field.refOptions) && field.refOptions.length > 0) {
                    return (
                        <FormControl fullWidth error={Boolean(fieldError)}>
                            <InputLabel id={`${field.id}-ref-select-label`}>{field.label}</InputLabel>
                            <Select
                                labelId={`${field.id}-ref-select-label`}
                                value={typeof value === 'string' ? value : ''}
                                label={field.label}
                                onChange={(event) => handleFieldChange(field.id, event.target.value || null)}
                                required={field.required}
                                disabled={disabled}
                                sx={{ bgcolor: 'background.default' }}
                                MenuProps={{ PaperProps: { sx: { '& .MuiMenuItem-root': { minHeight: 40 } } } }}
                            >
                                {!field.required && <MenuItem value=''> </MenuItem>}
                                {field.refOptions.map((option) => (
                                    <MenuItem key={option.id} value={option.id}>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </Select>
                            {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
                        </FormControl>
                    )
                }

                return (
                    <TextField
                        fullWidth
                        label={field.label}
                        value={(value as string) ?? ''}
                        onChange={(event) => handleFieldChange(field.id, event.target.value)}
                        required={field.required}
                        disabled={disabled}
                        placeholder={field.placeholder}
                        error={Boolean(fieldError)}
                        helperText={helperText}
                    />
                )
            case 'TABLE': {
                const childFieldDefs = field.childFields ?? []
                const tableValue = (formData[field.id] as Record<string, unknown>[]) ?? []
                const tableShowTitle = field.tableUiConfig?.showTitle !== false
                const tableMinRows = field.validationRules?.minRows as number | undefined
                const tableMaxRows = field.validationRules?.maxRows as number | undefined
                const rowCount = tableValue.length

                const { helperText: tableHelperText, isMissing: checkMissing } = buildTableConstraintText({
                    required: field.required,
                    minRows: tableMinRows,
                    maxRows: tableMaxRows,
                    t
                })
                const tableMissing = checkMissing(rowCount)

                if (copyMode) {
                    return (
                        <Box sx={{ py: 1, px: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
                            <Typography variant='body2' color='text.secondary'>
                                {t('table.copiedUnchanged', 'Table rows are copied unchanged from the source record.')}
                            </Typography>
                        </Box>
                    )
                }

                // EDIT mode: inline editor with deferred persistence (commit on form Save)
                if (editRowId && apiBaseUrl && applicationId && objectCollectionId) {
                    return (
                        <Box>
                            <RuntimeInlineTabularEditor
                                apiBaseUrl={apiBaseUrl}
                                applicationId={applicationId}
                                objectCollectionId={objectCollectionId}
                                parentRecordId={editRowId}
                                componentId={field.componentId ?? field.id}
                                childFields={childFieldDefs}
                                showTitle={tableShowTitle}
                                label={field.label}
                                locale={locale}
                                deferPersistence
                                onChange={(rows) => handleFieldChange(field.id, rows)}
                                minRows={tableMinRows}
                                maxRows={tableMaxRows}
                            />
                            {tableHelperText && (
                                <Typography variant='caption' color={tableMissing ? 'error' : 'text.secondary'} sx={{ mt: 0.5, ml: 1.75 }}>
                                    {tableHelperText}
                                </Typography>
                            )}
                        </Box>
                    )
                }

                // CREATE mode: inline local editor
                if (childFieldDefs.length > 0) {
                    return (
                        <Box>
                            <TabularPartEditor
                                label={field.label}
                                value={tableValue}
                                onChange={(rows) => handleFieldChange(field.id, rows)}
                                childFields={childFieldDefs}
                                showTitle={tableShowTitle}
                                locale={locale}
                                minRows={tableMinRows}
                                maxRows={tableMaxRows}
                            />
                            {tableHelperText && (
                                <Typography variant='caption' color={tableMissing ? 'error' : 'text.secondary'} sx={{ mt: 0.5, ml: 1.75 }}>
                                    {tableHelperText}
                                </Typography>
                            )}
                        </Box>
                    )
                }

                // Fallback: no child fields configured
                return (
                    <Box sx={{ py: 1, px: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
                        <Typography variant='body2' color='text.secondary'>
                            {field.label}
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>
                            {t('table.editAfterSave', 'Table data can be edited after saving the record.')}
                        </Typography>
                    </Box>
                )
            }
            default:
                return (
                    <TextField
                        fullWidth
                        label={field.label}
                        value={typeof value === 'string' ? value : value == null ? '' : String(value)}
                        onChange={(event) => handleFieldChange(field.id, event.target.value)}
                        required={field.required}
                        disabled={disabled}
                        placeholder={field.placeholder}
                        error={Boolean(fieldError)}
                        helperText={helperText}
                    />
                )
        }
    }

    const visibleFields = useMemo(() => fields.filter((field) => !isHiddenField(field, formData)), [fields, formData])
    const normalizedWizardSteps = useMemo(() => {
        const fieldIds = new Set(visibleFields.map((field) => field.id))
        return (wizardSteps ?? [])
            .map((step) => ({
                ...step,
                fieldIds: step.fieldIds.filter((fieldId) => fieldIds.has(fieldId))
            }))
            .filter((step) => step.fieldIds.length > 0)
    }, [visibleFields, wizardSteps])
    const hasWizard = normalizedWizardSteps.length > 1
    const wizardFieldIds = useMemo(() => new Set(normalizedWizardSteps.flatMap((step) => step.fieldIds)), [normalizedWizardSteps])
    const currentWizardStep = hasWizard ? normalizedWizardSteps[Math.min(activeWizardStep, normalizedWizardSteps.length - 1)] : null
    const fieldsForActiveStep = currentWizardStep
        ? visibleFields.filter((field) => currentWizardStep.fieldIds.includes(field.id))
        : visibleFields
    const unassignedWizardFields = hasWizard
        ? visibleFields.filter((field) => !wizardFieldIds.has(field.id) && activeWizardStep === normalizedWizardSteps.length - 1)
        : []
    const renderedFields = hasWizard ? [...fieldsForActiveStep, ...unassignedWizardFields] : visibleFields
    const currentStepHasErrors = hasWizard
        ? hasMissingRequiredForFields(renderedFields) || hasValidationErrorsForFields(renderedFields)
        : false
    const isLastWizardStep = !hasWizard || activeWizardStep >= normalizedWizardSteps.length - 1
    const isSubmitDisabled =
        isSubmitting || !isReady || fields.length === 0 || hasMissingRequired || hasValidationErrors || (requireAnyValue && !hasAnyValue)
    const hasTableFields = visibleFields.some((f) => f.type === 'TABLE')
    const dialogMaxWidth = hasTableFields ? 'md' : 'sm'

    const formBody = (
        <Stack spacing={2} sx={surface === 'page' ? undefined : { mt: 1 }}>
            {error && <Alert severity='error'>{error}</Alert>}
            {hasWizard ? (
                <Stack spacing={1}>
                    <Stepper activeStep={activeWizardStep} alternativeLabel sx={{ mb: 0.5 }}>
                        {normalizedWizardSteps.map((step) => (
                            <Step key={step.id}>
                                <StepLabel>{step.label}</StepLabel>
                            </Step>
                        ))}
                    </Stepper>
                    {currentWizardStep?.helperText ? (
                        <Typography variant='body2' color='text.secondary'>
                            {currentWizardStep.helperText}
                        </Typography>
                    ) : null}
                </Stack>
            ) : null}
            {!isReady ? (
                <Stack alignItems='center' justifyContent='center' sx={{ py: 3 }}>
                    <CircularProgress size={20} />
                </Stack>
            ) : visibleFields.length === 0 || renderedFields.length === 0 ? (
                <Typography color='text.secondary'>{emptyStateText}</Typography>
            ) : (
                renderedFields.map((field) => {
                    const required = isFieldRequired(field, formData)
                    const renderedField = required === field.required ? field : { ...field, required }
                    return <React.Fragment key={field.id}>{renderField(renderedField)}</React.Fragment>
                })
            )}
        </Stack>
    )

    const actionButtons = (
        <>
            {showDeleteButton ? (
                <Button
                    data-testid='entity-form-delete'
                    onClick={deleteButtonDisabled ? undefined : onDelete}
                    disabled={isSubmitting || deleteButtonDisabled}
                    variant='outlined'
                    startIcon={<DeleteIcon />}
                    sx={surface === 'page' ? undefined : { borderRadius: 1, mr: 'auto' }}
                >
                    {deleteButtonText}
                </Button>
            ) : null}
            <Box sx={{ display: 'flex', gap: 1, ml: surface === 'page' ? 'auto' : 0 }}>
                <Button data-testid='entity-form-cancel' onClick={onClose} disabled={isSubmitting}>
                    {cancelButtonText}
                </Button>
                {hasWizard && activeWizardStep > 0 ? (
                    <Button
                        data-testid='entity-form-back'
                        onClick={() => setActiveWizardStep((current) => Math.max(0, current - 1))}
                        disabled={isSubmitting}
                    >
                        {t('formWizard.back', 'Back')}
                    </Button>
                ) : null}
                {hasWizard && !isLastWizardStep ? (
                    <Button
                        data-testid='entity-form-next'
                        onClick={() => setActiveWizardStep((current) => Math.min(normalizedWizardSteps.length - 1, current + 1))}
                        variant='contained'
                        disabled={isSubmitting || !isReady || currentStepHasErrors}
                    >
                        {t('formWizard.next', 'Next')}
                    </Button>
                ) : null}
                <Button
                    data-testid='entity-form-submit'
                    onClick={handleSubmit}
                    variant='contained'
                    disabled={isSubmitDisabled}
                    sx={{ display: hasWizard && !isLastWizardStep ? 'none' : undefined }}
                    startIcon={isSubmitting ? <CircularProgress size={16} /> : null}
                >
                    {isSubmitting ? savingButtonText ?? saveButtonText : saveButtonText}
                </Button>
            </Box>
        </>
    )

    if (!open) return null

    if (surface === 'page') {
        return (
            <PageContainer title={title} actions={actionButtons}>
                <Box sx={{ maxWidth: hasTableFields ? 1100 : 820 }}>{formBody}</Box>
            </PageContainer>
        )
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth={dialogMaxWidth} fullWidth PaperProps={{ sx: { borderRadius: 1 } }}>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent sx={{ overflowY: 'visible', overflowX: 'visible' }}>{formBody}</DialogContent>
            <DialogActions sx={{ p: 3, pt: 2, justifyContent: showDeleteButton ? 'space-between' : 'flex-end' }}>
                {actionButtons}
            </DialogActions>
        </Dialog>
    )
}

export default FormDialog
