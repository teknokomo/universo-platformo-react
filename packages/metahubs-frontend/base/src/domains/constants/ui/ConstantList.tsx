import { useCallback, useMemo, useState, type ChangeEvent } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Chip, Stack, Tabs, Tab, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import {
    TemplateMainCard as MainCard,
    APIEmptySVG,
    BaseEntityMenu,
    EmptyListState,
    FlowListTable,
    PaginationControls,
    ToolbarControls,
    useDebouncedSearch,
    usePaginated,
    ViewHeaderMUI as ViewHeader
} from '@universo/template-mui'
import { ConfirmDeleteDialog, ConflictResolutionDialog, EntityFormDialog, type TabConfig } from '@universo/template-mui/components/dialogs'
import type { DragEndEvent } from '@universo/template-mui'
import type { ConstantDataType, VersionedLocalizedContent } from '@universo/types'
import {
    extractConflictInfo,
    isOptimisticLockConflict,
    NUMBER_DEFAULTS,
    toNumberRules,
    validateNumber,
    type ConflictInfo
} from '@universo/utils'
import { useCodenameConfig } from '../../settings/hooks/useCodenameConfig'
import { useMetahubPrimaryLocale } from '../../settings/hooks/useMetahubPrimaryLocale'
import { useSettingValue } from '../../settings/hooks/useSettings'
import { fetchAllPaginatedItems, metahubsQueryKeys } from '../../shared'
import { getSetById } from '../../sets'
import * as constantsApi from '../api'
import { useCopyConstant, useCreateConstant, useDeleteConstant, useMoveConstant, useReorderConstant, useUpdateConstant } from '../hooks'
import constantActions from './ConstantActions'
import { ConstantGeneralFields, ConstantValueFields, ensureConstantValidationRules } from './ConstantFormFields'
import { ExistingCodenamesProvider } from '../../../components'
import type {
    Constant,
    ConstantDisplay,
    ConstantLocalizedPayload,
    MetahubSet,
    SetLocalizedPayload,
    Hub,
    PaginatedResponse
} from '../../../types'
import { getVLCString, toConstantDisplay } from '../../../types'
import { extractLocalizedInput, hasPrimaryContent, normalizeLocale } from '../../../utils/localizedInput'
import { isValidCodenameForStyle, normalizeCodenameForStyle } from '../../../utils/codename'
import {
    buildInitialValues as buildSetInitialValues,
    buildFormTabs as buildSetFormTabs,
    validateSetForm,
    canSaveSetForm,
    toPayload as setToPayload
} from '../../sets/ui/SetActions'
import type { SetDisplayWithHub } from '../../sets/ui/SetActions'
import { useUpdateSetAtMetahub } from '../../sets/hooks/mutations'
import * as hubsApi from '../../hubs'

type GenericFormValues = Record<string, unknown>

type ConstantFormValues = {
    nameVlc: VersionedLocalizedContent<string> | null
    codenameVlc?: VersionedLocalizedContent<string> | null
    codename: string
    codenameTouched?: boolean
    dataType: ConstantDataType
    validationRules: Record<string, unknown>
    value: unknown
    _editingEntityId?: string | null
}

const DEFAULT_FORM_VALUES: ConstantFormValues = {
    nameVlc: null,
    codenameVlc: null,
    codename: '',
    codenameTouched: false,
    dataType: 'STRING',
    validationRules: { maxLength: 10, localized: false, versioned: false },
    value: null,
    _editingEntityId: null
}

const appendCopySuffix = (
    value: VersionedLocalizedContent<string> | null | undefined,
    uiLocale: string,
    fallback: string
): VersionedLocalizedContent<string> => {
    const normalizedLocale = normalizeLocale(uiLocale)
    const suffix = normalizedLocale === 'ru' ? ' (копия)' : ' (copy)'
    if (!value?.locales) {
        return {
            _schema: '1',
            _primary: normalizedLocale,
            locales: {
                [normalizedLocale]: {
                    content: `${fallback}${suffix}`,
                    version: 1,
                    isActive: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            }
        }
    }

    const nextLocales = Object.fromEntries(
        Object.entries(value.locales).map(([locale, localeValue]) => {
            const localeSuffix = normalizeLocale(locale) === 'ru' ? ' (копия)' : ' (copy)'
            const content = typeof localeValue?.content === 'string' ? localeValue.content.trim() : ''
            return [locale, { ...localeValue, content: content ? `${content}${localeSuffix}` : `${fallback}${localeSuffix}` }]
        })
    )

    return { ...value, locales: nextLocales }
}

const buildInitialFormValues = (
    source: Constant | null,
    mode: 'create' | 'edit' | 'copy',
    codenameStyle: 'kebab-case' | 'pascal-case',
    codenameAlphabet: 'en' | 'en-ru',
    uiLocale: string
): ConstantFormValues => {
    if (!source) return DEFAULT_FORM_VALUES

    if (mode === 'edit') {
        return {
            nameVlc: source.name ?? null,
            codenameVlc: source.codenameLocalized ?? null,
            codename: source.codename,
            codenameTouched: true,
            dataType: source.dataType,
            validationRules: (source.validationRules as Record<string, unknown>) ?? {},
            value: source.value ?? null,
            _editingEntityId: source.id
        }
    }

    const copiedCodename = normalizeCodenameForStyle(`${source.codename}-copy`, codenameStyle, codenameAlphabet)
    return {
        nameVlc: appendCopySuffix(source.name ?? null, uiLocale, source.codename || 'Copy'),
        codenameVlc: source.codenameLocalized ?? null,
        codename: copiedCodename,
        codenameTouched: true,
        dataType: source.dataType,
        validationRules: (source.validationRules as Record<string, unknown>) ?? {},
        value: source.value ?? null,
        _editingEntityId: null
    }
}

const normalizeDateComposition = (value: unknown): 'date' | 'time' | 'datetime' => {
    if (typeof value !== 'string') return 'datetime'
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[_\s-]+/g, '')
    if (normalized === 'date' || normalized === 'dateonly') return 'date'
    if (normalized === 'time' || normalized === 'timeonly') return 'time'
    return 'datetime'
}

const formatDateConstantValue = (rawValue: string, dateComposition: unknown, uiLocale: string): string | null => {
    const parsed = new Date(rawValue)
    if (Number.isNaN(parsed.getTime())) {
        return null
    }

    const normalizedLocale = normalizeLocale(uiLocale)
    const locale = normalizedLocale === 'ru' ? 'ru-RU' : uiLocale
    const composition = normalizeDateComposition(dateComposition)

    if (composition === 'date') {
        return new Intl.DateTimeFormat(locale, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: 'UTC'
        }).format(parsed)
    }

    if (composition === 'time') {
        return new Intl.DateTimeFormat(locale, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: 'UTC'
        }).format(parsed)
    }

    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(parsed)
}

const renderConstantValue = (row: ConstantDisplay, uiLocale: string, labels: { boolTrue: string; boolFalse: string }): string => {
    const value = row.value
    if (value === null || value === undefined) return '—'
    if (row.dataType === 'BOOLEAN') {
        if (typeof value === 'boolean') return value ? labels.boolTrue : labels.boolFalse
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase()
            if (normalized === 'true') return labels.boolTrue
            if (normalized === 'false') return labels.boolFalse
        }
    }
    if (row.dataType === 'DATE' && typeof value === 'string') {
        return formatDateConstantValue(value, row.validationRules?.dateComposition, uiLocale) ?? value
    }
    if (typeof value === 'string') return value
    if (typeof value === 'number') return String(value)
    if (typeof value === 'object') {
        const localized = getVLCString(value as VersionedLocalizedContent<string>, uiLocale)
        if (localized) return localized
        try {
            return JSON.stringify(value)
        } catch {
            return '—'
        }
    }
    return String(value)
}

const extractResponseMessage = (error: unknown): string | undefined => {
    if (!error || typeof error !== 'object' || !('response' in error)) return undefined
    const response = (error as { response?: unknown }).response
    if (!response || typeof response !== 'object' || !('data' in response)) return undefined
    const data = (response as { data?: unknown }).data
    if (!data || typeof data !== 'object') return undefined
    const message = (data as { error?: unknown; message?: unknown }).error ?? (data as { message?: unknown }).message
    return typeof message === 'string' ? message : undefined
}

const isLocalizedContent = (value: unknown): value is VersionedLocalizedContent<string> =>
    Boolean(value && typeof value === 'object' && 'locales' in (value as Record<string, unknown>))

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

const ConstantList = () => {
    const { metahubId, hubId: hubIdParam, setId } = useParams<{ metahubId: string; hubId?: string; setId: string }>()
    const { t, i18n } = useTranslation('metahubs')
    const { t: tc } = useCommonTranslations()
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const codenameConfig = useCodenameConfig()
    const preferredVlcLocale = useMetahubPrimaryLocale()
    const constantCodenameScope = useSettingValue<string>('sets.constantCodenameScope') ?? 'per-level'
    const updateSetMutation = useUpdateSetAtMetahub()

    const [editingConstant, setEditingConstant] = useState<Constant | null>(null)
    const [copySource, setCopySource] = useState<Constant | null>(null)
    const [dialogError, setDialogError] = useState<string | null>(null)
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [deleteState, setDeleteState] = useState<{ open: boolean; constant: Constant | null }>({ open: false, constant: null })
    const [conflictState, setConflictState] = useState<{
        open: boolean
        conflict: ConflictInfo | null
        pendingUpdate: { id: string; patch: ConstantLocalizedPayload } | null
    }>({ open: false, conflict: null, pendingUpdate: null })

    const {
        data: setForHubResolution,
        isLoading: isSetResolutionLoading,
        error: setResolutionError
    } = useQuery({
        queryKey: metahubId && setId ? metahubsQueryKeys.setDetail(metahubId, setId) : ['metahubs', 'sets', 'detail', 'empty'],
        queryFn: async () => {
            if (!metahubId || !setId) throw new Error('metahubId and setId are required')
            return getSetById(metahubId, setId)
        },
        enabled: !!metahubId && !!setId && !hubIdParam
    })

    const effectiveHubId = hubIdParam || setForHubResolution?.hubs?.[0]?.id
    const hubsListParams = useMemo(() => ({ limit: 1000, offset: 0, sortBy: 'sortOrder' as const, sortOrder: 'asc' as const }), [])

    // Fetch hubs for the Settings edit dialog (SetActions.buildFormTabs needs hubs)
    const { data: hubsData } = useQuery<PaginatedResponse<Hub>>({
        queryKey: metahubId ? metahubsQueryKeys.hubsList(metahubId, hubsListParams) : ['metahubs', 'hubs', 'list', 'empty'],
        queryFn: async () => {
            if (!metahubId) {
                return { items: [], pagination: { limit: 1000, offset: 0, count: 0, total: 0, hasMore: false } }
            }
            return fetchAllPaginatedItems((params) => hubsApi.listHubs(metahubId, params), {
                limit: hubsListParams.limit,
                sortBy: hubsListParams.sortBy,
                sortOrder: hubsListParams.sortOrder
            })
        },
        enabled: !!metahubId,
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000,
        retry: false
    })
    const allHubs = useMemo(() => hubsData?.items ?? [], [hubsData?.items])

    const canLoadConstants = !!metahubId && !!setId && (!hubIdParam || !isSetResolutionLoading)

    const paginationResult = usePaginated<Constant, 'codename' | 'created' | 'updated' | 'sortOrder'>({
        queryKeyFn:
            metahubId && setId
                ? (params) =>
                      effectiveHubId
                          ? metahubsQueryKeys.constantsList(metahubId, effectiveHubId, setId, { ...params, locale: i18n.language })
                          : metahubsQueryKeys.constantsListDirect(metahubId, setId, { ...params, locale: i18n.language })
                : () => ['empty'],
        queryFn:
            metahubId && setId
                ? (params) =>
                      effectiveHubId
                          ? constantsApi.listConstants(metahubId, effectiveHubId, setId, { ...params, locale: i18n.language })
                          : constantsApi.listConstantsDirect(metahubId, setId, { ...params, locale: i18n.language })
                : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'sortOrder',
        sortOrder: 'asc',
        enabled: canLoadConstants
    })

    const { data: constants, isLoading, error } = paginationResult
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    const isGlobalScope = constantCodenameScope === 'global'
    const { data: globalCodenamesData } = useQuery({
        queryKey: metahubsQueryKeys.allConstantCodenames(metahubId ?? '', setId ?? ''),
        queryFn: () => constantsApi.listAllConstantCodenames(metahubId ?? '', setId ?? ''),
        enabled: isGlobalScope && !!metahubId && !!setId
    })

    const codenameEntities = useMemo(() => {
        if (isGlobalScope && globalCodenamesData?.items) return globalCodenamesData.items
        return constants ?? []
    }, [constants, globalCodenamesData?.items, isGlobalScope])

    const constantsMap = useMemo(() => new Map((constants ?? []).map((constant) => [constant.id, constant])), [constants])
    const sortedConstants = useMemo(
        () => [...(constants ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id)),
        [constants]
    )
    const orderMap = useMemo(() => new Map(sortedConstants.map((constant, index) => [constant.id, index])), [sortedConstants])
    const tableData = useMemo(
        () => sortedConstants.map((constant) => toConstantDisplay(constant, i18n.language)),
        [sortedConstants, i18n.language]
    )

    const createConstantMutation = useCreateConstant()
    const copyConstantMutation = useCopyConstant()
    const updateConstantMutation = useUpdateConstant()
    const deleteConstantMutation = useDeleteConstant()
    const moveConstantMutation = useMoveConstant()
    const reorderConstantMutation = useReorderConstant()
    const boolValueLabels = useMemo(
        () => ({
            boolTrue: t('constants.value.boolTrue', 'True'),
            boolFalse: t('constants.value.boolFalse', 'False')
        }),
        [t]
    )
    const dataTypeLabels = useMemo(
        () => ({
            STRING: t('attributes.dataTypeOptions.string', 'String'),
            NUMBER: t('attributes.dataTypeOptions.number', 'Number'),
            BOOLEAN: t('attributes.dataTypeOptions.boolean', 'Boolean'),
            DATE: t('attributes.dataTypeOptions.date', 'Date')
        }),
        [t]
    )

    const dialogMode: 'create' | 'edit' | 'copy' = editingConstant ? 'edit' : copySource ? 'copy' : 'create'
    const initialFormValues = useMemo(
        () =>
            buildInitialFormValues(editingConstant ?? copySource, dialogMode, codenameConfig.style, codenameConfig.alphabet, i18n.language),
        [copySource, dialogMode, editingConstant, codenameConfig.alphabet, codenameConfig.style, i18n.language]
    )

    const resolveValueValidationError = useCallback(
        (values: GenericFormValues): string | null => {
            const dataType = (values.dataType as ConstantDataType | undefined) ?? 'STRING'
            const validationRules = ensureConstantValidationRules(dataType, values.validationRules as Record<string, unknown> | undefined)
            const value = values.value

            if (value === null || value === undefined) {
                return null
            }

            if (dataType === 'STRING') {
                const minLength = typeof validationRules.minLength === 'number' ? validationRules.minLength : null
                const maxLength = typeof validationRules.maxLength === 'number' ? validationRules.maxLength : null
                const localized = validationRules.localized === true

                const validateLength = (input: string): string | null => {
                    if (minLength !== null && maxLength !== null && (input.length < minLength || input.length > maxLength)) {
                        return t('validation.lengthBetween', 'Length must be between {{min}} and {{max}}', {
                            min: minLength,
                            max: maxLength
                        })
                    }
                    if (minLength !== null && input.length < minLength) {
                        return t('validation.minLength', 'Minimum length: {{min}}', { min: minLength })
                    }
                    if (maxLength !== null && input.length > maxLength) {
                        return t('validation.maxLength', 'Maximum length: {{max}}', { max: maxLength })
                    }
                    return null
                }

                if (localized && isLocalizedContent(value)) {
                    for (const localeValue of Object.values(value.locales ?? {})) {
                        const content = typeof localeValue?.content === 'string' ? localeValue.content : ''
                        if (content.length === 0) continue
                        const error = validateLength(content)
                        if (error) return error
                    }
                    return null
                }

                if (typeof value === 'string') {
                    return validateLength(value)
                }

                return null
            }

            if (dataType === 'NUMBER') {
                if (typeof value !== 'number' || !Number.isFinite(value)) {
                    return t('validation.invalidNumber', 'Invalid number')
                }

                const numberRules = toNumberRules(validationRules)
                const validationResult = validateNumber(value, numberRules)
                if (validationResult.valid) return null

                if (validationResult.errorKey === 'mustBeNonNegative') {
                    return t('validation.nonNegative', 'Must be non-negative')
                }
                if (validationResult.errorKey === 'belowMinimum') {
                    return t('validation.minValue', 'Minimum value: {{min}}', {
                        min: typeof numberRules.min === 'number' ? numberRules.min : 0
                    })
                }
                if (validationResult.errorKey === 'aboveMaximum') {
                    return t('validation.maxValue', 'Maximum value: {{max}}', {
                        max: typeof numberRules.max === 'number' ? numberRules.max : 0
                    })
                }
                if (validationResult.errorKey === 'tooManyIntegerDigits' || validationResult.errorKey === 'tooManyDecimalDigits') {
                    const precision = numberRules.precision ?? NUMBER_DEFAULTS.precision
                    const scale = numberRules.scale ?? NUMBER_DEFAULTS.scale
                    const maxIntegerDigits = Math.max(1, precision - scale)
                    return scale > 0
                        ? t('validation.numberLengthWithScale', 'Length: {{integer}},{{scale}}', {
                              integer: maxIntegerDigits,
                              scale
                          })
                        : t('validation.numberLength', 'Length: {{integer}}', { integer: maxIntegerDigits })
                }
                return t('validation.invalidNumber', 'Invalid number')
            }

            if (dataType === 'DATE') {
                if (typeof value !== 'string' || value.trim().length === 0) {
                    return t('validation.datetimeFormat', 'Expected date & time format: YYYY-MM-DD HH:MM')
                }

                const composition = typeof validationRules.dateComposition === 'string' ? validationRules.dateComposition : 'datetime'
                const normalizedValue = value.trim()

                if (composition === 'date') {
                    if (isValidDateString(normalizedValue.slice(0, 10))) return null
                    const parsed = new Date(normalizedValue)
                    return Number.isNaN(parsed.getTime()) ? t('validation.dateFormat', 'Expected date format: YYYY-MM-DD') : null
                }

                if (composition === 'time') {
                    if (isValidTimeString(normalizedValue)) return null
                    if (normalizedValue.startsWith('1970-01-01T')) {
                        const timePart = normalizedValue.slice(11, 19).replace(/:00$/, '')
                        if (isValidTimeString(timePart)) return null
                    }
                    const parsed = new Date(normalizedValue)
                    return Number.isNaN(parsed.getTime()) ? t('validation.timeFormat', 'Expected time format: HH:MM') : null
                }

                if (isValidDateTimeString(normalizedValue)) return null
                const parsed = new Date(normalizedValue)
                return Number.isNaN(parsed.getTime())
                    ? t('validation.datetimeFormat', 'Expected date & time format: YYYY-MM-DD HH:MM')
                    : null
            }

            return null
        },
        [t]
    )

    const validateForm = useCallback(
        (values: GenericFormValues) => {
            const errors: Record<string, string> = {}
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            if (!hasPrimaryContent(nameVlc)) {
                errors.nameVlc = tc('crud.nameRequired', 'Name is required')
            }

            const rawCodename = typeof values.codename === 'string' ? values.codename : ''
            const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
            if (!normalizedCodename) {
                errors.codename = t('constants.validation.codenameRequired', 'Codename is required')
            } else if (
                !isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            ) {
                errors.codename = t('constants.validation.codenameInvalid', 'Codename contains invalid characters')
            }

            const valueError = resolveValueValidationError(values)
            if (valueError) {
                errors.value = valueError
            }

            return Object.keys(errors).length > 0 ? errors : null
        },
        [codenameConfig.allowMixed, codenameConfig.alphabet, codenameConfig.style, resolveValueValidationError, t, tc]
    )

    const canSaveForm = useCallback(
        (values: GenericFormValues) => {
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const rawCodename = typeof values.codename === 'string' ? values.codename : ''
            const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
            return (
                !values._hasCodenameDuplicate &&
                hasPrimaryContent(nameVlc) &&
                Boolean(normalizedCodename) &&
                isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed) &&
                !resolveValueValidationError(values)
            )
        },
        [codenameConfig.allowMixed, codenameConfig.alphabet, codenameConfig.style, resolveValueValidationError]
    )

    const buildPayload = useCallback(
        (values: GenericFormValues): ConstantLocalizedPayload => {
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const codenameVlc = values.codenameVlc as VersionedLocalizedContent<string> | null | undefined
            const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
            const { input: codenameInput, primaryLocale: codenamePrimaryLocale } = extractLocalizedInput(codenameVlc)
            const codename = normalizeCodenameForStyle(String(values.codename || ''), codenameConfig.style, codenameConfig.alphabet)
            const dataType = (values.dataType as ConstantDataType | undefined) ?? 'STRING'

            return {
                codename,
                codenameInput,
                codenamePrimaryLocale,
                dataType,
                name: nameInput ?? {},
                namePrimaryLocale,
                validationRules: (values.validationRules as Record<string, unknown> | undefined) ?? {},
                value: values.value
            }
        },
        [codenameConfig.alphabet, codenameConfig.style]
    )

    const handleSave = useCallback(
        async (values: GenericFormValues) => {
            if (!metahubId || !setId) return
            setDialogError(null)

            try {
                const payload = buildPayload(values)
                if (editingConstant) {
                    await updateConstantMutation.mutateAsync({
                        metahubId,
                        hubId: effectiveHubId,
                        setId,
                        constantId: editingConstant.id,
                        data: {
                            ...payload,
                            expectedVersion: editingConstant.version
                        }
                    })
                } else if (copySource) {
                    await copyConstantMutation.mutateAsync({
                        metahubId,
                        hubId: effectiveHubId,
                        setId,
                        constantId: copySource.id,
                        data: payload
                    })
                } else {
                    await createConstantMutation.mutateAsync({
                        metahubId,
                        hubId: effectiveHubId,
                        setId,
                        data: payload
                    })
                }

                setDialogOpen(false)
                setEditingConstant(null)
                setCopySource(null)
                setDialogError(null)
            } catch (error: unknown) {
                if (editingConstant && isOptimisticLockConflict(error)) {
                    const conflict = extractConflictInfo(error)
                    setConflictState({
                        open: true,
                        conflict,
                        pendingUpdate: {
                            id: editingConstant.id,
                            patch: buildPayload(values)
                        }
                    })
                    return
                }

                const responseMessage = extractResponseMessage(error)
                const message =
                    typeof responseMessage === 'string'
                        ? responseMessage
                        : error instanceof Error
                        ? error.message
                        : t('constants.createError', 'Failed to save constant')
                setDialogError(message)
            }
        },
        [
            buildPayload,
            copyConstantMutation,
            copySource,
            createConstantMutation,
            editingConstant,
            effectiveHubId,
            metahubId,
            setId,
            t,
            updateConstantMutation
        ]
    )

    const handleMove = useCallback(
        async (id: string, direction: 'up' | 'down') => {
            if (!metahubId || !setId) return
            try {
                await moveConstantMutation.mutateAsync({
                    metahubId,
                    hubId: effectiveHubId,
                    setId,
                    constantId: id,
                    direction
                })
                enqueueSnackbar(t('constants.moveSuccess', 'Constant order updated'), { variant: 'success' })
            } catch (error: unknown) {
                const message =
                    extractResponseMessage(error) ||
                    (error instanceof Error ? error.message : t('constants.moveError', 'Failed to update constant order'))
                enqueueSnackbar(message, { variant: 'error' })
            }
        },
        [effectiveHubId, enqueueSnackbar, metahubId, moveConstantMutation, setId, t]
    )

    const handleSortableDragEnd = useCallback(
        async (event: DragEndEvent) => {
            if (!metahubId || !setId) return
            const { active, over } = event
            if (!over || active.id === over.id) return

            const overConstant = sortedConstants.find((constant) => constant.id === String(over.id))
            if (!overConstant) return

            try {
                await reorderConstantMutation.mutateAsync({
                    metahubId,
                    hubId: effectiveHubId,
                    setId,
                    constantId: String(active.id),
                    newSortOrder: overConstant.sortOrder ?? 1
                })
                enqueueSnackbar(t('constants.reorderSuccess', 'Constant order updated'), { variant: 'success' })
            } catch (error: unknown) {
                const message = extractResponseMessage(error) || (error instanceof Error ? error.message : t('constants.reorderError'))
                enqueueSnackbar(message, { variant: 'error' })
            }
        },
        [effectiveHubId, enqueueSnackbar, metahubId, reorderConstantMutation, setId, sortedConstants, t]
    )

    const renderDragOverlay = useCallback(
        (activeId: string | null) => {
            if (!activeId) return null
            const row = tableData.find((item) => item.id === activeId)
            if (!row) return null
            return (
                <Box
                    sx={{
                        px: 1.5,
                        py: 1,
                        borderRadius: 1,
                        boxShadow: 6,
                        bgcolor: 'background.paper',
                        minWidth: 260
                    }}
                >
                    <Stack spacing={0.25}>
                        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{row.name || row.codename}</Typography>
                        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{row.codename}</Typography>
                    </Stack>
                </Box>
            )
        },
        [tableData]
    )

    const columns = useMemo(
        () => [
            {
                id: 'sortOrder',
                label: t('constants.table.order', '#'),
                width: '4%',
                align: 'center' as const,
                render: (row: ConstantDisplay) => <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{row.sortOrder ?? 0}</Typography>
            },
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '24%',
                align: 'left' as const,
                render: (row: ConstantDisplay) => (
                    <Typography sx={{ fontSize: 14, fontWeight: 500, wordBreak: 'break-word' }}>{row.name || '—'}</Typography>
                )
            },
            {
                id: 'codename',
                label: t('constants.codename', 'Codename'),
                width: '20%',
                align: 'left' as const,
                render: (row: ConstantDisplay) => (
                    <Typography sx={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 600 }}>{row.codename}</Typography>
                )
            },
            {
                id: 'dataType',
                label: t('constants.dataType', 'Data Type'),
                width: '12%',
                align: 'left' as const,
                render: (row: ConstantDisplay) => (
                    <Chip size='small' label={dataTypeLabels[row.dataType] ?? row.dataType} variant='outlined' />
                )
            },
            {
                id: 'value',
                label: t('constants.value.title', 'Value'),
                width: '30%',
                align: 'left' as const,
                render: (row: ConstantDisplay) => (
                    <Typography sx={{ fontSize: 13, color: 'text.secondary', wordBreak: 'break-word' }}>
                        {renderConstantValue(row, i18n.language, boolValueLabels)}
                    </Typography>
                )
            }
        ],
        [boolValueLabels, dataTypeLabels, i18n.language, t, tc]
    )

    const createActionContext = useCallback(
        (base: Record<string, unknown>) => ({
            ...base,
            orderMap,
            totalCount: sortedConstants.length,
            openEditDialog: (entity: ConstantDisplay) => {
                const source = constantsMap.get(entity.id)
                if (!source) return
                setEditingConstant(source)
                setCopySource(null)
                setDialogError(null)
                setDialogOpen(true)
            },
            openCopyDialog: (entity: ConstantDisplay) => {
                const source = constantsMap.get(entity.id)
                if (!source) return
                setCopySource(source)
                setEditingConstant(null)
                setDialogError(null)
                setDialogOpen(true)
            },
            openDeleteDialog: (entity: ConstantDisplay) => {
                const source = constantsMap.get(entity.id)
                if (!source) return
                setDeleteState({ open: true, constant: source })
            },
            moveConstant: handleMove
        }),
        [constantsMap, handleMove, orderMap, sortedConstants.length]
    )

    if (!metahubId || !setId) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Invalid set'
                title={t('errors.notFound', 'Not found')}
                description={t('constants.setRequired', 'Set context is required')}
            />
        )
    }

    const isBusy =
        isLoading ||
        createConstantMutation.isPending ||
        copyConstantMutation.isPending ||
        updateConstantMutation.isPending ||
        deleteConstantMutation.isPending

    return (
        <MainCard
            sx={{ maxWidth: '100%', width: '100%' }}
            contentSX={{ px: 0, py: 0 }}
            disableContentPadding
            disableHeader
            border={false}
            shadow={false}
        >
            <ExistingCodenamesProvider entities={codenameEntities}>
                {setResolutionError ? (
                    <EmptyListState
                        image={APIEmptySVG}
                        imageAlt='Set not found'
                        title={t('errors.notFound', 'Not found')}
                        description={t('constants.setNotFound', 'Set not found')}
                    />
                ) : error ? (
                    <EmptyListState
                        image={APIEmptySVG}
                        imageAlt='Connection error'
                        title={t('errors.connectionFailed', 'Connection failed')}
                        description={t('errors.pleaseTryLater', 'Please try later')}
                    />
                ) : (
                    <Stack flexDirection='column' sx={{ gap: 1 }}>
                        <ViewHeader
                            title={t('constants.title', 'Constants')}
                            search
                            searchValue={searchValue}
                            searchPlaceholder={t('constants.searchPlaceholder', 'Search constants...')}
                            onSearchChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                                handleSearchChange(event.target.value)
                            }
                        >
                            <ToolbarControls
                                primaryAction={{
                                    label: tc('create', 'Create'),
                                    onClick: () => {
                                        setEditingConstant(null)
                                        setCopySource(null)
                                        setDialogError(null)
                                        setDialogOpen(true)
                                    },
                                    startIcon: <AddRoundedIcon />
                                }}
                            />
                        </ViewHeader>

                        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                            <Tabs
                                value='constants'
                                onChange={(_event: unknown, nextTab: string) => {
                                    if (nextTab === 'settings') {
                                        setEditDialogOpen(true)
                                    }
                                }}
                                textColor='primary'
                                indicatorColor='primary'
                                sx={{
                                    minHeight: 40,
                                    '& .MuiTab-root': { minHeight: 40, textTransform: 'none' }
                                }}
                            >
                                <Tab value='constants' label={t('constants.title')} />
                                <Tab value='settings' label={t('settings.title')} />
                            </Tabs>
                        </Box>

                        {!isBusy && tableData.length === 0 ? (
                            <EmptyListState
                                image={APIEmptySVG}
                                imageAlt='No constants'
                                title={t('constants.empty', 'No constants yet')}
                                description={t('constants.emptyDescription', 'Create constants to store reusable typed values')}
                            />
                        ) : (
                            <Box sx={{ mx: { xs: -1.5, md: -2 } }}>
                                <FlowListTable<ConstantDisplay>
                                    data={tableData}
                                    customColumns={columns}
                                    sortableRows
                                    sortableItemIds={sortedConstants.map((constant) => constant.id)}
                                    dragHandleAriaLabel={t('constants.dnd.dragHandle', 'Drag to reorder')}
                                    dragDisabled={isBusy}
                                    onSortableDragEnd={handleSortableDragEnd}
                                    renderDragOverlay={renderDragOverlay}
                                    renderActions={(row: ConstantDisplay) => (
                                        <BaseEntityMenu<ConstantDisplay, ConstantLocalizedPayload>
                                            entity={row}
                                            entityKind='constant'
                                            descriptors={constantActions}
                                            namespace='metahubs'
                                            menuButtonLabelKey='flowList:menu.button'
                                            i18nInstance={i18n}
                                            createContext={createActionContext}
                                        />
                                    )}
                                />
                            </Box>
                        )}
                        {!isLoading && tableData.length > 0 && (
                            <Box sx={{ mx: { xs: -1.5, md: -2 }, mt: 2 }}>
                                <PaginationControls
                                    pagination={paginationResult.pagination}
                                    actions={paginationResult.actions}
                                    isLoading={paginationResult.isLoading}
                                    rowsPerPageOptions={[10, 20, 50, 100]}
                                    namespace='common'
                                />
                            </Box>
                        )}
                    </Stack>
                )}

                <EntityFormDialog
                    key={`constant-form-${dialogMode}-${editingConstant?.id ?? copySource?.id ?? 'new'}-${editingConstant?.version ?? 0}`}
                    open={isDialogOpen}
                    mode={dialogMode}
                    title={
                        dialogMode === 'edit'
                            ? t('constants.editDialog.title', 'Edit Constant')
                            : dialogMode === 'copy'
                            ? t('constants.copyDialog.title', 'Copy Constant')
                            : t('constants.createDialog.title', 'Create Constant')
                    }
                    nameLabel={tc('fields.name', 'Name')}
                    saveButtonText={
                        dialogMode === 'edit'
                            ? tc('actions.save', 'Save')
                            : dialogMode === 'copy'
                            ? t('constants.copy.action', 'Copy')
                            : tc('actions.create', 'Create')
                    }
                    savingButtonText={
                        dialogMode === 'edit'
                            ? tc('actions.saving', 'Saving...')
                            : dialogMode === 'copy'
                            ? t('constants.copy.actionLoading', 'Copying...')
                            : tc('actions.creating', 'Creating...')
                    }
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    loading={createConstantMutation.isPending || copyConstantMutation.isPending || updateConstantMutation.isPending}
                    error={dialogError || undefined}
                    onClose={() => {
                        setDialogOpen(false)
                        setEditingConstant(null)
                        setCopySource(null)
                        setDialogError(null)
                    }}
                    onSave={handleSave}
                    hideDefaultFields
                    initialExtraValues={initialFormValues}
                    tabs={({
                        values,
                        setValue,
                        isLoading: formLoading,
                        errors
                    }: {
                        values: Record<string, unknown>
                        setValue: (name: string, value: unknown) => void
                        isLoading: boolean
                        errors: Record<string, string>
                    }): TabConfig[] => [
                        {
                            id: 'general',
                            label: t('constants.tabs.general', 'General'),
                            content: (
                                <ConstantGeneralFields
                                    values={values}
                                    setValue={setValue}
                                    isLoading={formLoading}
                                    errors={errors ?? {}}
                                    uiLocale={i18n.language}
                                    dataTypeDisabled={dialogMode === 'edit'}
                                    labels={{
                                        name: tc('fields.name', 'Name'),
                                        codename: t('constants.codename', 'Codename'),
                                        codenameHelper: t('constants.codenameHelper', 'Unique identifier'),
                                        dataType: t('constants.dataType', 'Data Type'),
                                        typeSettings: t('constants.typeSettings.title', 'Type Settings'),
                                        dataTypeOptions: {
                                            string: t('attributes.dataTypeOptions.string', 'String'),
                                            number: t('attributes.dataTypeOptions.number', 'Number'),
                                            boolean: t('attributes.dataTypeOptions.boolean', 'Boolean'),
                                            date: t('attributes.dataTypeOptions.date', 'Date')
                                        },
                                        stringMinLength: t('constants.typeSettings.string.minLength', 'Min Length'),
                                        stringMaxLength: t('constants.typeSettings.string.maxLength', 'Max Length'),
                                        stringLocalized: t('constants.typeSettings.string.localized', 'Localized (VLC)'),
                                        stringVersioned: t('constants.typeSettings.string.versioned', 'Versioned (VLC)'),
                                        numberPrecision: t('constants.typeSettings.number.precision', 'Length'),
                                        numberScale: t('constants.typeSettings.number.scale', 'Decimal places'),
                                        numberMin: t('constants.typeSettings.number.min', 'Min Value'),
                                        numberMax: t('constants.typeSettings.number.max', 'Max Value'),
                                        numberNonNegative: t('constants.typeSettings.number.nonNegative', 'Non-negative only'),
                                        dateComposition: t('constants.typeSettings.date.composition', 'Date Composition'),
                                        dateCompositionOptions: {
                                            date: t('constants.typeSettings.date.compositionOptions.date', 'Date only'),
                                            time: t('constants.typeSettings.date.compositionOptions.time', 'Time only'),
                                            datetime: t('constants.typeSettings.date.compositionOptions.datetime', 'Date and Time')
                                        }
                                    }}
                                />
                            )
                        },
                        {
                            id: 'value',
                            label: t('constants.tabs.value', 'Value'),
                            content: (
                                <ConstantValueFields
                                    values={values}
                                    setValue={setValue}
                                    isLoading={formLoading}
                                    uiLocale={i18n.language}
                                    error={errors?.value ?? null}
                                    labels={{
                                        value: t('constants.value.title', 'Value'),
                                        valueLocalized: t('constants.value.localizedTitle', 'Localized value'),
                                        boolTrue: t('constants.value.boolTrue', 'True'),
                                        boolFalse: t('constants.value.boolFalse', 'False')
                                    }}
                                />
                            )
                        }
                    ]}
                    validate={validateForm}
                    canSave={canSaveForm}
                />

                <ConfirmDeleteDialog
                    open={deleteState.open}
                    title={t('constants.deleteDialog.title', 'Delete Constant')}
                    description={t('constants.deleteDialog.message', 'Are you sure you want to delete this constant?')}
                    confirmButtonText={tc('actions.delete', 'Delete')}
                    deletingButtonText={tc('actions.deleting', 'Deleting...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onCancel={() => setDeleteState({ open: false, constant: null })}
                    onConfirm={async () => {
                        if (!deleteState.constant || !metahubId || !setId) return
                        try {
                            await deleteConstantMutation.mutateAsync({
                                metahubId,
                                hubId: effectiveHubId,
                                setId,
                                constantId: deleteState.constant.id
                            })
                            setDeleteState({ open: false, constant: null })
                        } catch (error: unknown) {
                            const message =
                                extractResponseMessage(error) ||
                                (error instanceof Error ? error.message : t('constants.deleteError', 'Failed to delete constant'))
                            enqueueSnackbar(message, { variant: 'error' })
                        }
                    }}
                    loading={deleteConstantMutation.isPending}
                />

                <ConflictResolutionDialog
                    open={conflictState.open}
                    conflict={conflictState.conflict}
                    onCancel={() => {
                        setConflictState({ open: false, conflict: null, pendingUpdate: null })
                        if (metahubId && setId) {
                            if (effectiveHubId) {
                                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.constants(metahubId, effectiveHubId, setId) })
                            } else {
                                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.constantsDirect(metahubId, setId) })
                            }
                            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allConstantCodenames(metahubId, setId) })
                        }
                    }}
                    onOverwrite={async () => {
                        if (!conflictState.pendingUpdate || !metahubId || !setId) return
                        await updateConstantMutation.mutateAsync({
                            metahubId,
                            hubId: effectiveHubId,
                            setId,
                            constantId: conflictState.pendingUpdate.id,
                            data: conflictState.pendingUpdate.patch
                        })
                        setConflictState({ open: false, conflict: null, pendingUpdate: null })
                    }}
                    isLoading={updateConstantMutation.isPending}
                />

                {/* Settings edit dialog overlay for parent set */}
                {setForHubResolution &&
                    setId &&
                    (() => {
                        const setDisplay: SetDisplayWithHub = {
                            id: setForHubResolution.id,
                            metahubId: setForHubResolution.metahubId,
                            codename: setForHubResolution.codename,
                            name: getVLCString(setForHubResolution.name, preferredVlcLocale) || setForHubResolution.codename,
                            description: getVLCString(setForHubResolution.description, preferredVlcLocale) || '',
                            isSingleHub: setForHubResolution.isSingleHub,
                            isRequiredHub: setForHubResolution.isRequiredHub,
                            sortOrder: setForHubResolution.sortOrder,
                            createdAt: setForHubResolution.createdAt,
                            updatedAt: setForHubResolution.updatedAt,
                            hubId: effectiveHubId || undefined,
                            hubs: setForHubResolution.hubs?.map((h) => ({
                                id: h.id,
                                name: typeof h.name === 'string' ? h.name : h.codename || '',
                                codename: h.codename || ''
                            }))
                        }
                        const setMap = new Map<string, MetahubSet>([[setForHubResolution.id, setForHubResolution]])
                        const settingsCtx = {
                            entity: setDisplay,
                            entityKind: 'set' as const,
                            t,
                            setMap,
                            currentHubId: effectiveHubId || null,
                            uiLocale: preferredVlcLocale,
                            api: {
                                updateEntity: async (id: string, patch: SetLocalizedPayload) => {
                                    if (!metahubId) return
                                    await updateSetMutation.mutateAsync({
                                        metahubId,
                                        setId: id,
                                        data: { ...patch, expectedVersion: setForHubResolution.version }
                                    })
                                }
                            },
                            helpers: {
                                refreshList: async () => {
                                    if (metahubId && setId) {
                                        await queryClient.invalidateQueries({
                                            queryKey: metahubsQueryKeys.setDetail(metahubId, setId)
                                        })
                                        await queryClient.invalidateQueries({
                                            queryKey: metahubsQueryKeys.allSets(metahubId)
                                        })
                                        // Invalidate breadcrumb queries so page title refreshes immediately
                                        await queryClient.invalidateQueries({
                                            queryKey: ['breadcrumb', 'set-standalone', metahubId, setId]
                                        })
                                    }
                                },
                                enqueueSnackbar: (payload: {
                                    message: string
                                    options?: { variant?: 'default' | 'error' | 'success' | 'warning' | 'info' }
                                }) => {
                                    if (payload?.message) enqueueSnackbar(payload.message, payload.options)
                                }
                            }
                        }
                        return (
                            <EntityFormDialog
                                open={editDialogOpen}
                                mode='edit'
                                title={t('sets.editTitle', 'Edit Set')}
                                nameLabel={tc('fields.name', 'Name')}
                                descriptionLabel={tc('fields.description', 'Description')}
                                saveButtonText={tc('actions.save', 'Save')}
                                savingButtonText={tc('actions.saving', 'Saving...')}
                                cancelButtonText={tc('actions.cancel', 'Cancel')}
                                hideDefaultFields
                                initialExtraValues={buildSetInitialValues(settingsCtx)}
                                tabs={buildSetFormTabs(settingsCtx, allHubs, setId)}
                                validate={(values) => validateSetForm(settingsCtx, values)}
                                canSave={canSaveSetForm}
                                onSave={async (data) => {
                                    const payload = setToPayload(data)
                                    await settingsCtx.api.updateEntity(setForHubResolution.id, payload)
                                    await settingsCtx.helpers.refreshList()
                                }}
                                onClose={() => setEditDialogOpen(false)}
                            />
                        )
                    })()}
            </ExistingCodenamesProvider>
        </MainCard>
    )
}

export default ConstantList
