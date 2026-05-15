import { useCallback, useMemo, useState, type ChangeEvent } from 'react'
import { alpha, type Theme } from '@mui/material/styles'
import { Box, Chip, Stack, Tabs, Tab, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { useQueryClient } from '@tanstack/react-query'
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
    ViewHeaderMUI as ViewHeader,
    revealPendingEntityFeedback,
    useListDialogs
} from '@universo/template-mui'
import { ConfirmDeleteDialog, ConflictResolutionDialog, EntityFormDialog, type TabConfig } from '@universo/template-mui/components/dialogs'
import type { DragEndEvent } from '@universo/template-mui'
import type { FixedValueDataType, VersionedLocalizedContent } from '@universo/types'
import {
    extractConflictInfo,
    isOptimisticLockConflict,
    NUMBER_DEFAULTS,
    toNumberRules,
    validateNumber,
    type ConflictInfo
} from '@universo/utils'
import { useCodenameConfig } from '../../../../settings/hooks/useCodenameConfig'
import { useMetahubPrimaryLocale } from '../../../../settings/hooks/useMetahubPrimaryLocale'
import {
    invalidateFixedValuesQueries,
    isSharedEntityActive,
    isSharedEntityMovable,
    isSharedEntityRow,
    metahubsQueryKeys,
    reorderSharedEntityIds,
    useUpsertSharedEntityOverride
} from '../../../../shared'
import SharedEntitySettingsFields from '../../../../shared/ui/SharedEntitySettingsFields'
import { readSharedExcludedTargetIdsField, syncSharedEntityExclusions } from '../../../../shared/sharedEntityExclusions'
import {
    useCopyFixedValue,
    useCreateFixedValue,
    useDeleteFixedValue,
    useMoveFixedValue,
    useReorderFixedValue,
    useUpdateFixedValue
} from '../hooks'
import { useFixedValueListData } from '../hooks/useFixedValueListData'
import fixedValueActions from './FixedValueActions'
import { FixedValueGeneralFields, ConstantValueFields, ensureConstantValidationRules } from './FixedValueFormFields'
import { ExistingCodenamesProvider } from '../../../../../components'
import type {
    FixedValue,
    FixedValueDisplay,
    FixedValueLocalizedPayload,
    ValueGroupEntity,
    ValueGroupLocalizedPayload
} from '../../../../../types'
import { getVLCString } from '../../../../../types'
import { extractLocalizedInput, ensureLocalizedContent, hasPrimaryContent } from '../../../../../utils/localizedInput'
import { isValidCodenameForStyle, normalizeCodenameForStyle } from '../../../../../utils/codename'
import {
    buildInitialValues as buildSetInitialValues,
    buildFormTabs as buildValueGroupFormTabs,
    validateValueGroupForm,
    canSaveValueGroupForm,
    toPayload as setToPayload
} from '../../../presets/ui/ValueGroupActions'
import type { ValueGroupDisplayWithContainer } from '../../../presets/ui/ValueGroupActions'
import { useUpdateValueGroupAtMetahub } from '../../../presets/hooks/valueGroupMutations'
import {
    buildInitialFormValues,
    extractResponseMessage,
    isLocalizedContent,
    isValidTimeString,
    isValidDateString,
    isValidDateTimeString,
    renderConstantValue
} from './fixedValueListUtils'

type GenericFormValues = Record<string, unknown>

const DIALOG_SAVE_CANCEL = { __dialogCancelled: true } as const

type FixedValueListContentProps = {
    metahubId?: string
    treeEntityId?: string | null
    valueGroupId?: string
    sharedEntityMode?: boolean
    title?: string | null
    emptyTitle?: string
    emptyDescription?: string
    renderPageShell?: boolean
    showSettingsTab?: boolean
}

export const FixedValueListContent = ({
    metahubId: metahubIdProp,
    treeEntityId: hubIdProp,
    valueGroupId: setIdProp,
    sharedEntityMode = false,
    title,
    emptyTitle,
    emptyDescription,
    renderPageShell = true,
    showSettingsTab = true
}: FixedValueListContentProps = {}) => {
    const { t, i18n } = useTranslation('metahubs')
    const { t: tc } = useCommonTranslations()
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const codenameConfig = useCodenameConfig()
    const preferredVlcLocale = useMetahubPrimaryLocale()
    const updateValueGroupMutation = useUpdateValueGroupAtMetahub()

    const {
        metahubId,
        valueGroupId,
        effectiveTreeEntityId,
        setForHubResolution,
        setResolutionError,
        allHubs,
        isLoading,
        error,
        paginationResult,
        searchValue,
        handleSearchChange,
        codenameEntities,
        constantsMap,
        sortedConstants,
        orderMap,
        tableData,
        kindKey,
        includeShared
    } = useFixedValueListData({
        metahubId: metahubIdProp,
        treeEntityId: hubIdProp,
        valueGroupId: setIdProp,
        resolveSetDetails: showSettingsTab,
        includeSharedEntities: !sharedEntityMode
    })

    const { dialogs, openCreate, openEdit, openCopy, openDelete, openConflict, close } = useListDialogs<FixedValue>()
    const editingFixedValue = dialogs.edit.item
    const copySource = dialogs.copy.item
    const isDialogOpen = dialogs.create.open || dialogs.edit.open || dialogs.copy.open
    const [dialogError, setDialogError] = useState<string | null>(null)
    const pendingInteractionMessage = tc('pendingCreateBlocked', 'This item is still being created. Please wait a moment and try again.')
    const [editDialogOpen, setEditDialogOpen] = useState(false)

    const handlePendingConstantInteraction = useCallback(
        (fixedValueId: string) => {
            if (!metahubId || !valueGroupId) return
            revealPendingEntityFeedback({
                queryClient,
                queryKeyPrefix: effectiveTreeEntityId
                    ? metahubsQueryKeys.fixedValues(metahubId, effectiveTreeEntityId, valueGroupId, kindKey)
                    : metahubsQueryKeys.fixedValuesDirect(metahubId, valueGroupId, kindKey),
                entityId: fixedValueId
            })
            enqueueSnackbar(pendingInteractionMessage, { variant: 'info' })
        },
        [effectiveTreeEntityId, enqueueSnackbar, kindKey, metahubId, pendingInteractionMessage, queryClient, valueGroupId]
    )

    const createFixedValueMutation = useCreateFixedValue()
    const copyFixedValueMutation = useCopyFixedValue()
    const updateFixedValueMutation = useUpdateFixedValue()
    const deleteConstantMutation = useDeleteFixedValue()
    const moveFixedValueMutation = useMoveFixedValue()
    const reorderConstantMutation = useReorderFixedValue()
    const upsertSharedEntityOverrideMutation = useUpsertSharedEntityOverride()
    const boolValueLabels = useMemo(
        () => ({
            boolTrue: t('fixedValues.value.boolTrue', 'True'),
            boolFalse: t('fixedValues.value.boolFalse', 'False')
        }),
        [t]
    )
    const dataTypeLabels = useMemo(
        () => ({
            STRING: t('components.dataTypeOptions.string', 'String'),
            NUMBER: t('components.dataTypeOptions.number', 'Number'),
            BOOLEAN: t('components.dataTypeOptions.boolean', 'Boolean'),
            DATE: t('components.dataTypeOptions.date', 'Date')
        }),
        [t]
    )

    const dialogMode: 'create' | 'edit' | 'copy' = editingFixedValue ? 'edit' : copySource ? 'copy' : 'create'
    const initialFormValues = useMemo(
        () =>
            buildInitialFormValues(
                editingFixedValue ?? copySource,
                dialogMode,
                codenameConfig.style,
                codenameConfig.alphabet,
                i18n.language
            ),
        [copySource, dialogMode, editingFixedValue, codenameConfig.alphabet, codenameConfig.style, i18n.language]
    )

    const resolveValueValidationError = useCallback(
        (values: GenericFormValues): string | null => {
            const dataType = (values.dataType as FixedValueDataType | undefined) ?? 'STRING'
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

            const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
            const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? 'en'
            const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
            const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
            if (!normalizedCodename) {
                errors.codename = t('fixedValues.validation.codenameRequired', 'Codename is required')
            } else if (
                !isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            ) {
                errors.codename = t('fixedValues.validation.codenameInvalid', 'Codename contains invalid characters')
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
            const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
            const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? 'en'
            const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
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
        (values: GenericFormValues): FixedValueLocalizedPayload => {
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
            const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
            const codenamePrimaryLocale = codenameValue?._primary ?? namePrimaryLocale ?? 'en'
            const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
            const codename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
            const dataType = (values.dataType as FixedValueDataType | undefined) ?? 'STRING'
            const codenamePayload = ensureLocalizedContent(codenameValue, namePrimaryLocale ?? codenamePrimaryLocale, codename)

            return {
                codename: codenamePayload,
                dataType,
                name: nameInput ?? {},
                namePrimaryLocale,
                validationRules: (values.validationRules as Record<string, unknown> | undefined) ?? {},
                uiConfig: (values.uiConfig as Record<string, unknown> | undefined) ?? undefined,
                value: values.value
            }
        },
        [codenameConfig.alphabet, codenameConfig.style]
    )

    const handleSave = useCallback(
        async (values: GenericFormValues) => {
            if (!metahubId || !valueGroupId) return
            setDialogError(null)

            try {
                const payload = buildPayload(values)
                const sharedExcludedTargetIds = readSharedExcludedTargetIdsField(values)
                if (editingFixedValue) {
                    await updateFixedValueMutation.mutateAsync({
                        metahubId,
                        treeEntityId: effectiveTreeEntityId,
                        kindKey,
                        valueGroupId,
                        fixedValueId: editingFixedValue.id,
                        data: {
                            ...payload,
                            expectedVersion: editingFixedValue.version
                        }
                    })
                    if (sharedEntityMode && sharedExcludedTargetIds !== undefined) {
                        await syncSharedEntityExclusions({
                            metahubId,
                            entityKind: 'constant',
                            sharedEntityId: editingFixedValue.id,
                            excludedTargetIds: sharedExcludedTargetIds
                        })
                    }
                } else if (copySource) {
                    await copyFixedValueMutation.mutateAsync({
                        metahubId,
                        treeEntityId: effectiveTreeEntityId,
                        kindKey,
                        valueGroupId,
                        fixedValueId: copySource.id,
                        data: payload
                    })
                } else {
                    await createFixedValueMutation.mutateAsync({
                        metahubId,
                        treeEntityId: effectiveTreeEntityId,
                        kindKey,
                        valueGroupId,
                        data: payload
                    })
                }

                close('create')
                close('edit')
                close('copy')
                setDialogError(null)
            } catch (error: unknown) {
                if (editingFixedValue && isOptimisticLockConflict(error)) {
                    const conflict = extractConflictInfo(error)
                    openConflict({
                        conflict,
                        pendingUpdate: {
                            id: editingFixedValue.id,
                            patch: buildPayload(values)
                        }
                    })
                    throw DIALOG_SAVE_CANCEL
                }

                const responseMessage = extractResponseMessage(error)
                const message =
                    typeof responseMessage === 'string'
                        ? responseMessage
                        : error instanceof Error
                        ? error.message
                        : t('fixedValues.createError', 'Failed to save constant')
                setDialogError(message)
            }
        },
        [
            buildPayload,
            close,
            copyFixedValueMutation,
            copySource,
            createFixedValueMutation,
            editingFixedValue,
            effectiveTreeEntityId,
            kindKey,
            metahubId,
            openConflict,
            sharedEntityMode,
            valueGroupId,
            t,
            updateFixedValueMutation
        ]
    )

    const handleMove = useCallback(
        async (id: string, direction: 'up' | 'down') => {
            if (!metahubId || !valueGroupId) return
            try {
                await moveFixedValueMutation.mutateAsync({
                    metahubId,
                    treeEntityId: effectiveTreeEntityId,
                    kindKey,
                    valueGroupId,
                    fixedValueId: id,
                    direction
                })
                enqueueSnackbar(t('fixedValues.moveSuccess', 'Fixed value order updated'), { variant: 'success' })
            } catch (error: unknown) {
                const message =
                    extractResponseMessage(error) ||
                    (error instanceof Error ? error.message : t('fixedValues.moveError', 'Failed to update constant order'))
                enqueueSnackbar(message, { variant: 'error' })
            }
        },
        [effectiveTreeEntityId, enqueueSnackbar, kindKey, metahubId, moveFixedValueMutation, valueGroupId, t]
    )

    const handleSortableDragEnd = useCallback(
        async (event: DragEndEvent) => {
            if (!metahubId || !valueGroupId) return
            const { active, over } = event
            if (!over || active.id === over.id) return

            const overConstant = tableData.find((constant) => constant.id === String(over.id))
            if (!overConstant) return

            const mergedOrderIds = includeShared
                ? reorderSharedEntityIds(
                      tableData.map((constant) => constant.id),
                      String(active.id),
                      String(over.id)
                  ).filter((id) => {
                      const row = tableData.find((constant) => constant.id === id)
                      return row ? isSharedEntityMovable(row) : false
                  })
                : undefined

            try {
                await reorderConstantMutation.mutateAsync({
                    metahubId,
                    treeEntityId: effectiveTreeEntityId,
                    kindKey,
                    valueGroupId,
                    fixedValueId: String(active.id),
                    newSortOrder: overConstant.sortOrder ?? 1,
                    mergedOrderIds
                })
                enqueueSnackbar(t('fixedValues.reorderSuccess', 'Fixed value order updated'), { variant: 'success' })
            } catch (error: unknown) {
                const message = extractResponseMessage(error) || (error instanceof Error ? error.message : t('fixedValues.reorderError'))
                enqueueSnackbar(message, { variant: 'error' })
            }
        },
        [effectiveTreeEntityId, enqueueSnackbar, includeShared, kindKey, metahubId, reorderConstantMutation, valueGroupId, tableData, t]
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

    const hasSharedRows = useMemo(() => includeShared && tableData.some((row) => isSharedEntityRow(row)), [includeShared, tableData])

    const firstLocalRowId = useMemo(() => {
        if (!hasSharedRows) return null
        return tableData.find((row) => !isSharedEntityRow(row))?.id ?? null
    }, [hasSharedRows, tableData])

    const getConstantRowSx = useCallback(
        (row: FixedValueDisplay) => {
            if (!hasSharedRows) return undefined

            const isShared = isSharedEntityRow(row)
            const isInactive = isShared && !isSharedEntityActive(row)
            const isFirstLocalRow = row.id === firstLocalRowId

            if (!isShared && !isFirstLocalRow) {
                return undefined
            }

            return (theme: Theme) => ({
                ...(isShared
                    ? {
                          backgroundColor: alpha(theme.palette.info.main, isInactive ? 0.1 : 0.06)
                      }
                    : null),
                ...(isInactive
                    ? {
                          opacity: 0.78
                      }
                    : null),
                ...(isFirstLocalRow
                    ? {
                          '& td, & th': {
                              borderTop: `2px solid ${alpha(theme.palette.info.main, 0.2)}`
                          }
                      }
                    : null)
            })
        },
        [firstLocalRowId, hasSharedRows]
    )

    const isConstantRowDragDisabled = useCallback(
        (row: FixedValueDisplay) => hasSharedRows && isSharedEntityRow(row) && !isSharedEntityMovable(row),
        [hasSharedRows]
    )

    const constantActionDescriptors = useMemo(
        () =>
            includeShared
                ? fixedValueActions.filter((descriptor) => descriptor.id !== 'move-up' && descriptor.id !== 'move-down')
                : fixedValueActions,
        [includeShared]
    )

    const columns = useMemo(
        () => [
            {
                id: 'sortOrder',
                label: t('fixedValues.table.order', '#'),
                width: '4%',
                align: 'center' as const,
                render: (row: FixedValueDisplay) => <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{row.sortOrder ?? 0}</Typography>
            },
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '24%',
                align: 'left' as const,
                render: (row: FixedValueDisplay) => (
                    <Stack spacing={0.5}>
                        <Stack direction='row' spacing={0.75} alignItems='center' flexWrap='wrap' useFlexGap>
                            <Typography sx={{ fontSize: 14, fontWeight: 500, wordBreak: 'break-word' }}>{row.name || '—'}</Typography>
                            {includeShared && isSharedEntityRow(row) ? (
                                <Chip label={t('metahubs:shared.list.badge', 'Shared')} size='small' color='info' variant='outlined' />
                            ) : null}
                            {includeShared && isSharedEntityRow(row) && !isSharedEntityActive(row) ? (
                                <Chip label={t('metahubs:shared.list.inactive', 'Inactive')} size='small' variant='outlined' />
                            ) : null}
                        </Stack>
                    </Stack>
                )
            },
            {
                id: 'codename',
                label: t('fixedValues.codename', 'Codename'),
                width: '20%',
                align: 'left' as const,
                render: (row: FixedValueDisplay) => (
                    <Typography sx={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 600 }}>{row.codename}</Typography>
                )
            },
            {
                id: 'dataType',
                label: t('fixedValues.dataType', 'Data Type'),
                width: '12%',
                align: 'left' as const,
                render: (row: FixedValueDisplay) => (
                    <Chip size='small' label={dataTypeLabels[row.dataType] ?? row.dataType} variant='outlined' />
                )
            },
            {
                id: 'value',
                label: t('fixedValues.value.title', 'Value'),
                width: '30%',
                align: 'left' as const,
                render: (row: FixedValueDisplay) => (
                    <Typography sx={{ fontSize: 13, color: 'text.secondary', wordBreak: 'break-word' }}>
                        {renderConstantValue(row, i18n.language, boolValueLabels)}
                    </Typography>
                )
            }
        ],
        [boolValueLabels, dataTypeLabels, i18n.language, includeShared, t, tc]
    )

    const createActionContext = useCallback(
        (base: Record<string, unknown>) => ({
            ...base,
            orderMap,
            totalCount: sortedConstants.length,
            openEditDialog: (entity: FixedValueDisplay) => {
                const source = constantsMap.get(entity.id)
                if (!source) return
                setDialogError(null)
                openEdit(source)
            },
            openCopyDialog: (entity: FixedValueDisplay) => {
                const source = constantsMap.get(entity.id)
                if (!source) return
                setDialogError(null)
                openCopy(source)
            },
            openDeleteDialog: (entity: FixedValueDisplay) => {
                const source = constantsMap.get(entity.id)
                if (!source) return
                openDelete(source)
            },
            moveFixedValue: handleMove
        }),
        [constantsMap, handleMove, openCopy, openDelete, openEdit, orderMap, sortedConstants.length]
    )

    const handleSharedConstantOverride = useCallback(
        async (row: FixedValueDisplay, patch: { isExcluded?: boolean; isActive?: boolean | null }, successMessage: string) => {
            if (!metahubId || !valueGroupId) return

            try {
                await upsertSharedEntityOverrideMutation.mutateAsync({
                    metahubId,
                    data: {
                        entityKind: 'constant',
                        sharedEntityId: row.id,
                        targetObjectId: valueGroupId,
                        ...patch
                    }
                })
                await invalidateFixedValuesQueries.all(queryClient, metahubId, valueGroupId, effectiveTreeEntityId ?? undefined, kindKey)
                enqueueSnackbar(successMessage, { variant: 'success' })
            } catch (error: unknown) {
                const message =
                    extractResponseMessage(error) ??
                    (error instanceof Error
                        ? error.message
                        : t('metahubs:shared.list.messages.actionError', 'Failed to update shared entity state'))
                enqueueSnackbar(message, { variant: 'error' })
            }
        },
        [effectiveTreeEntityId, enqueueSnackbar, kindKey, metahubId, queryClient, valueGroupId, t, upsertSharedEntityOverrideMutation]
    )

    if (!metahubId || !valueGroupId) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Invalid set'
                title={t('errors.notFound', 'Not found')}
                description={t('fixedValues.setRequired', 'Set context is required')}
            />
        )
    }

    const isBusy =
        isLoading ||
        createFixedValueMutation.isPending ||
        copyFixedValueMutation.isPending ||
        updateFixedValueMutation.isPending ||
        deleteConstantMutation.isPending
    const contentOffsetSx = 0

    const content = (
        <ExistingCodenamesProvider entities={codenameEntities}>
            {setResolutionError ? (
                <EmptyListState
                    image={APIEmptySVG}
                    imageAlt='Set not found'
                    title={t('errors.notFound', 'Not found')}
                    description={t('fixedValues.setNotFound', 'Set not found')}
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
                        title={title === undefined ? t('fixedValues.title', 'Constants') : title}
                        search
                        searchValue={searchValue}
                        searchPlaceholder={t('fixedValues.searchPlaceholder', 'Search fixedValues...')}
                        onSearchChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                            handleSearchChange(event.target.value)
                        }
                        controlsAlign={renderPageShell ? 'start' : 'end'}
                    >
                        <ToolbarControls
                            primaryAction={{
                                label: tc('create', 'Create'),
                                onClick: () => {
                                    setDialogError(null)
                                    openCreate()
                                },
                                startIcon: <AddRoundedIcon />
                            }}
                        />
                    </ViewHeader>

                    {showSettingsTab ? (
                        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                            <Tabs
                                value='fixedValues'
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
                                <Tab value='fixedValues' label={t('fixedValues.title')} />
                                <Tab value='settings' label={t('settings.title')} />
                            </Tabs>
                        </Box>
                    ) : null}

                    {!isBusy && tableData.length === 0 ? (
                        <EmptyListState
                            image={APIEmptySVG}
                            imageAlt='No fixedValues'
                            title={emptyTitle ?? t('fixedValues.empty', 'No fixedValues yet')}
                            description={
                                emptyDescription ?? t('fixedValues.emptyDescription', 'Create fixedValues to store reusable typed values')
                            }
                        />
                    ) : (
                        <Box sx={{ mx: contentOffsetSx }}>
                            <FlowListTable<FixedValueDisplay>
                                data={tableData}
                                customColumns={columns}
                                onPendingInteractionAttempt={(row: FixedValueDisplay) => handlePendingConstantInteraction(row.id)}
                                sortableRows
                                sortableItemIds={tableData.map((constant) => constant.id)}
                                dragHandleAriaLabel={t('fixedValues.dnd.dragHandle', 'Drag to reorder')}
                                dragDisabled={isBusy}
                                getRowSx={getConstantRowSx}
                                isRowDragDisabled={isConstantRowDragDisabled}
                                onSortableDragEnd={handleSortableDragEnd}
                                renderDragOverlay={renderDragOverlay}
                                renderActions={(row: FixedValueDisplay) => {
                                    const sharedRowDescriptors: typeof constantActionDescriptors = []

                                    if (includeShared && isSharedEntityRow(row) && row.sharedBehavior?.canDeactivate !== false) {
                                        const isActive = isSharedEntityActive(row)
                                        sharedRowDescriptors.push({
                                            id: isActive ? 'deactivate' : 'activate',
                                            labelKey: isActive ? 'shared.list.actions.deactivate' : 'shared.list.actions.activate',
                                            order: 10,
                                            onSelect: async () => {
                                                await handleSharedConstantOverride(
                                                    row,
                                                    { isActive: isActive ? false : null },
                                                    isActive
                                                        ? t(
                                                              'metahubs:shared.list.messages.deactivated',
                                                              'Shared entity disabled for this target'
                                                          )
                                                        : t(
                                                              'metahubs:shared.list.messages.activated',
                                                              'Shared entity enabled for this target'
                                                          )
                                                )
                                            }
                                        })
                                    }

                                    if (includeShared && isSharedEntityRow(row) && row.sharedBehavior?.canExclude !== false) {
                                        sharedRowDescriptors.push({
                                            id: 'exclude',
                                            labelKey: 'shared.list.actions.exclude',
                                            order: 20,
                                            tone: 'danger',
                                            dividerBefore: sharedRowDescriptors.length > 0,
                                            onSelect: async () => {
                                                await handleSharedConstantOverride(
                                                    row,
                                                    { isExcluded: true },
                                                    t('metahubs:shared.list.messages.excluded', 'Shared entity excluded from this target')
                                                )
                                            }
                                        })
                                    }

                                    const descriptors =
                                        includeShared && isSharedEntityRow(row) ? sharedRowDescriptors : constantActionDescriptors

                                    return descriptors.length === 0 ? null : (
                                        <BaseEntityMenu<FixedValueDisplay, FixedValueLocalizedPayload>
                                            entity={row}
                                            entityKind='constant'
                                            descriptors={descriptors}
                                            namespace='metahubs'
                                            menuButtonLabelKey='flowList:menu.button'
                                            i18nInstance={i18n}
                                            createContext={createActionContext}
                                        />
                                    )
                                }}
                            />
                        </Box>
                    )}
                    {!isLoading && tableData.length > 0 && (
                        <Box sx={{ mx: contentOffsetSx, mt: 2 }}>
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
                key={`constant-form-${dialogMode}-${editingFixedValue?.id ?? copySource?.id ?? 'new'}-${editingFixedValue?.version ?? 0}`}
                open={isDialogOpen}
                mode={dialogMode}
                title={
                    dialogMode === 'edit'
                        ? t('fixedValues.editDialog.title', 'Edit Constant')
                        : dialogMode === 'copy'
                        ? t('fixedValues.copyDialog.title', 'Copy Constant')
                        : t('fixedValues.createDialog.title', 'Create Constant')
                }
                nameLabel={tc('fields.name', 'Name')}
                saveButtonText={
                    dialogMode === 'edit'
                        ? tc('actions.save', 'Save')
                        : dialogMode === 'copy'
                        ? t('fixedValues.copy.action', 'Copy')
                        : tc('actions.create', 'Create')
                }
                savingButtonText={
                    dialogMode === 'edit'
                        ? tc('actions.saving', 'Saving...')
                        : dialogMode === 'copy'
                        ? t('fixedValues.copy.actionLoading', 'Copying...')
                        : tc('actions.creating', 'Creating...')
                }
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={createFixedValueMutation.isPending || copyFixedValueMutation.isPending || updateFixedValueMutation.isPending}
                error={dialogError || undefined}
                onClose={() => {
                    close('create')
                    close('edit')
                    close('copy')
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
                }): TabConfig[] => {
                    const tabs: TabConfig[] = [
                        {
                            id: 'general',
                            label: t('fixedValues.tabs.general', 'General'),
                            content: (
                                <FixedValueGeneralFields
                                    values={values}
                                    setValue={setValue}
                                    isLoading={formLoading}
                                    errors={errors ?? {}}
                                    uiLocale={i18n.language}
                                    dataTypeDisabled={dialogMode === 'edit'}
                                    labels={{
                                        name: tc('fields.name', 'Name'),
                                        codename: t('fixedValues.codename', 'Codename'),
                                        codenameHelper: t('fixedValues.codenameHelper', 'Unique identifier'),
                                        dataType: t('fixedValues.dataType', 'Data Type'),
                                        typeSettings: t('fixedValues.typeSettings.title', 'Type Settings'),
                                        dataTypeOptions: {
                                            string: t('components.dataTypeOptions.string', 'String'),
                                            number: t('components.dataTypeOptions.number', 'Number'),
                                            boolean: t('components.dataTypeOptions.boolean', 'Boolean'),
                                            date: t('components.dataTypeOptions.date', 'Date')
                                        },
                                        stringMinLength: t('fixedValues.typeSettings.string.minLength', 'Min Length'),
                                        stringMaxLength: t('fixedValues.typeSettings.string.maxLength', 'Max Length'),
                                        stringLocalized: t('fixedValues.typeSettings.string.localized', 'Localized (VLC)'),
                                        stringVersioned: t('fixedValues.typeSettings.string.versioned', 'Versioned (VLC)'),
                                        numberPrecision: t('fixedValues.typeSettings.number.precision', 'Length'),
                                        numberScale: t('fixedValues.typeSettings.number.scale', 'Decimal places'),
                                        numberMin: t('fixedValues.typeSettings.number.min', 'Min Value'),
                                        numberMax: t('fixedValues.typeSettings.number.max', 'Max Value'),
                                        numberNonNegative: t('fixedValues.typeSettings.number.nonNegative', 'Non-negative only'),
                                        dateComposition: t('fixedValues.typeSettings.date.composition', 'Date Composition'),
                                        dateCompositionOptions: {
                                            date: t('fixedValues.typeSettings.date.compositionOptions.date', 'Date only'),
                                            time: t('fixedValues.typeSettings.date.compositionOptions.time', 'Time only'),
                                            datetime: t('fixedValues.typeSettings.date.compositionOptions.datetime', 'Date and Time')
                                        }
                                    }}
                                />
                            )
                        },
                        {
                            id: 'value',
                            label: t('fixedValues.tabs.value', 'Value'),
                            content: (
                                <ConstantValueFields
                                    values={values}
                                    setValue={setValue}
                                    isLoading={formLoading}
                                    uiLocale={i18n.language}
                                    error={errors?.value ?? null}
                                    labels={{
                                        value: t('fixedValues.value.title', 'Value'),
                                        valueLocalized: t('fixedValues.value.localizedTitle', 'Localized value'),
                                        boolTrue: t('fixedValues.value.boolTrue', 'True'),
                                        boolFalse: t('fixedValues.value.boolFalse', 'False')
                                    }}
                                />
                            )
                        }
                    ]

                    if (sharedEntityMode) {
                        tabs.push({
                            id: 'presentation',
                            label: t('fixedValues.tabs.presentation', 'Presentation'),
                            content: (
                                <SharedEntitySettingsFields
                                    metahubId={metahubId}
                                    entityKind='constant'
                                    sharedEntityId={dialogMode === 'edit' ? editingFixedValue?.id : null}
                                    storageField='uiConfig'
                                    section='behavior'
                                    values={values}
                                    setValue={setValue}
                                    isLoading={formLoading}
                                />
                            )
                        })
                        tabs.push({
                            id: 'exclusions',
                            label: t('metahubs:shared.exclusions.tab', 'Exclusions'),
                            content: (
                                <SharedEntitySettingsFields
                                    metahubId={metahubId}
                                    entityKind='constant'
                                    sharedEntityId={dialogMode === 'edit' ? editingFixedValue?.id : null}
                                    storageField='uiConfig'
                                    section='exclusions'
                                    values={values}
                                    setValue={setValue}
                                    isLoading={formLoading}
                                />
                            )
                        })
                    }

                    return tabs
                }}
                validate={validateForm}
                canSave={canSaveForm}
            />

            <ConfirmDeleteDialog
                open={dialogs.delete.open}
                title={t('fixedValues.deleteDialog.title', 'Delete Fixed Value')}
                description={t('fixedValues.deleteDialog.message', 'Are you sure you want to delete this fixed value?')}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => close('delete')}
                onConfirm={() => {
                    if (!dialogs.delete.item || !metahubId || !valueGroupId) return
                    deleteConstantMutation.mutate(
                        {
                            metahubId,
                            treeEntityId: effectiveTreeEntityId,
                            kindKey,
                            valueGroupId,
                            fixedValueId: dialogs.delete.item.id
                        },
                        {
                            onError: (error: unknown) => {
                                const message =
                                    extractResponseMessage(error) ||
                                    (error instanceof Error ? error.message : t('fixedValues.deleteError', 'Failed to delete fixed value'))
                                enqueueSnackbar(message, { variant: 'error' })
                            }
                        }
                    )
                }}
                loading={deleteConstantMutation.isPending}
            />

            <ConflictResolutionDialog
                open={dialogs.conflict.open}
                conflict={(dialogs.conflict.data as { conflict?: ConflictInfo })?.conflict ?? null}
                onCancel={() => {
                    close('conflict')
                    if (metahubId && valueGroupId) {
                        if (effectiveTreeEntityId) {
                            queryClient.invalidateQueries({
                                queryKey: metahubsQueryKeys.fixedValues(metahubId, effectiveTreeEntityId, valueGroupId, kindKey)
                            })
                        } else {
                            queryClient.invalidateQueries({
                                queryKey: metahubsQueryKeys.fixedValuesDirect(metahubId, valueGroupId, kindKey)
                            })
                        }
                        queryClient.invalidateQueries({
                            queryKey: metahubsQueryKeys.allFixedValueCodenames(metahubId, valueGroupId, kindKey)
                        })
                    }
                }}
                onOverwrite={async () => {
                    const pendingUpdate = (dialogs.conflict.data as { pendingUpdate?: { id: string; patch: FixedValueLocalizedPayload } })
                        ?.pendingUpdate
                    if (!pendingUpdate || !metahubId || !valueGroupId) return
                    await updateFixedValueMutation.mutateAsync({
                        metahubId,
                        treeEntityId: effectiveTreeEntityId,
                        kindKey,
                        valueGroupId,
                        fixedValueId: pendingUpdate.id,
                        data: pendingUpdate.patch
                    })
                    close('conflict')
                }}
                isLoading={updateFixedValueMutation.isPending}
            />

            {showSettingsTab &&
                setForHubResolution &&
                valueGroupId &&
                (() => {
                    const setDisplay: ValueGroupDisplayWithContainer = {
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
                        treeEntityId: effectiveTreeEntityId || undefined,
                        treeEntities: setForHubResolution.treeEntities?.map((h) => ({
                            id: h.id,
                            name: typeof h.name === 'string' ? h.name : h.codename || '',
                            codename: h.codename || ''
                        }))
                    }
                    const setMap = new Map<string, ValueGroupEntity>([[setForHubResolution.id, setForHubResolution]])
                    const settingsCtx = {
                        entity: setDisplay,
                        entityKind: 'set' as const,
                        t,
                        setMap,
                        metahubId,
                        currentTreeEntityId: effectiveTreeEntityId || null,
                        uiLocale: preferredVlcLocale,
                        api: {
                            updateEntity: (id: string, patch: ValueGroupLocalizedPayload) => {
                                if (!metahubId) return
                                updateValueGroupMutation.mutate({
                                    metahubId,
                                    valueGroupId: id,
                                    kindKey,
                                    data: { ...patch, expectedVersion: setForHubResolution.version }
                                })
                            }
                        },
                        helpers: {
                            refreshList: () => {
                                if (metahubId && valueGroupId) {
                                    void queryClient.invalidateQueries({
                                        queryKey: metahubsQueryKeys.valueGroupDetail(metahubId, valueGroupId, kindKey)
                                    })
                                    void queryClient.invalidateQueries({
                                        queryKey: metahubsQueryKeys.allValueGroups(metahubId, kindKey)
                                    })
                                    void queryClient.invalidateQueries({
                                        queryKey: ['breadcrumb', 'set-standalone', metahubId, valueGroupId]
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
                            tabs={buildValueGroupFormTabs(settingsCtx, allHubs, valueGroupId)}
                            validate={(values) => validateValueGroupForm(settingsCtx, values)}
                            canSave={canSaveValueGroupForm}
                            onSave={(data) => {
                                const payload = setToPayload(data)
                                settingsCtx.api.updateEntity(setForHubResolution.id, payload)
                            }}
                            onClose={() => setEditDialogOpen(false)}
                        />
                    )
                })()}
        </ExistingCodenamesProvider>
    )

    if (!renderPageShell) {
        return content
    }

    return (
        <MainCard
            sx={{ maxWidth: '100%', width: '100%' }}
            contentSX={{ px: 0, py: 0 }}
            disableContentPadding
            disableHeader
            border={false}
            shadow={false}
        >
            {content}
        </MainCard>
    )
}

const FixedValueList = () => <FixedValueListContent />

export default FixedValueList
