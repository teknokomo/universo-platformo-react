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
import {
    invalidateConstantsQueries,
    isSharedEntityActive,
    isSharedEntityMovable,
    isSharedEntityRow,
    metahubsQueryKeys,
    reorderSharedEntityIds,
    useUpsertSharedEntityOverride
} from '../../shared'
import SharedEntitySettingsFields from '../../shared/ui/SharedEntitySettingsFields'
import { readSharedExcludedTargetIdsField, syncSharedEntityExclusions } from '../../shared/sharedEntityExclusions'
import { useCopyConstant, useCreateConstant, useDeleteConstant, useMoveConstant, useReorderConstant, useUpdateConstant } from '../hooks'
import { useConstantListData } from '../hooks/useConstantListData'
import constantActions from './ConstantActions'
import { ConstantGeneralFields, ConstantValueFields, ensureConstantValidationRules } from './ConstantFormFields'
import { ExistingCodenamesProvider } from '../../../components'
import type { Constant, ConstantDisplay, ConstantLocalizedPayload, MetahubSet, SetLocalizedPayload } from '../../../types'
import { getVLCString } from '../../../types'
import { extractLocalizedInput, ensureLocalizedContent, hasPrimaryContent } from '../../../utils/localizedInput'
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
import {
    buildInitialFormValues,
    extractResponseMessage,
    isLocalizedContent,
    isValidTimeString,
    isValidDateString,
    isValidDateTimeString,
    renderConstantValue
} from './constantListUtils'

type GenericFormValues = Record<string, unknown>

const DIALOG_SAVE_CANCEL = { __dialogCancelled: true } as const

type ConstantListContentProps = {
    metahubId?: string
    hubId?: string | null
    setId?: string
    sharedEntityMode?: boolean
    title?: string | null
    emptyTitle?: string
    emptyDescription?: string
    renderPageShell?: boolean
    showSettingsTab?: boolean
}

export const ConstantListContent = ({
    metahubId: metahubIdProp,
    hubId: hubIdProp,
    setId: setIdProp,
    sharedEntityMode = false,
    title,
    emptyTitle,
    emptyDescription,
    renderPageShell = true,
    showSettingsTab = true
}: ConstantListContentProps = {}) => {
    const { t, i18n } = useTranslation('metahubs')
    const { t: tc } = useCommonTranslations()
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const codenameConfig = useCodenameConfig()
    const preferredVlcLocale = useMetahubPrimaryLocale()
    const updateSetMutation = useUpdateSetAtMetahub()

    const {
        metahubId,
        setId,
        effectiveHubId,
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
    } = useConstantListData({
        metahubId: metahubIdProp,
        hubId: hubIdProp,
        setId: setIdProp,
        resolveSetDetails: showSettingsTab,
        includeSharedEntities: !sharedEntityMode
    })

    const { dialogs, openCreate, openEdit, openCopy, openDelete, openConflict, close } = useListDialogs<Constant>()
    const editingConstant = dialogs.edit.item
    const copySource = dialogs.copy.item
    const isDialogOpen = dialogs.create.open || dialogs.edit.open || dialogs.copy.open
    const [dialogError, setDialogError] = useState<string | null>(null)
    const pendingInteractionMessage = tc('pendingCreateBlocked', 'This item is still being created. Please wait a moment and try again.')
    const [editDialogOpen, setEditDialogOpen] = useState(false)

    const handlePendingConstantInteraction = useCallback(
        (constantId: string) => {
            if (!metahubId || !setId) return
            revealPendingEntityFeedback({
                queryClient,
                queryKeyPrefix: effectiveHubId
                    ? metahubsQueryKeys.constants(metahubId, effectiveHubId, setId, kindKey)
                    : metahubsQueryKeys.constantsDirect(metahubId, setId, kindKey),
                entityId: constantId
            })
            enqueueSnackbar(pendingInteractionMessage, { variant: 'info' })
        },
        [effectiveHubId, enqueueSnackbar, kindKey, metahubId, pendingInteractionMessage, queryClient, setId]
    )

    const createConstantMutation = useCreateConstant()
    const copyConstantMutation = useCopyConstant()
    const updateConstantMutation = useUpdateConstant()
    const deleteConstantMutation = useDeleteConstant()
    const moveConstantMutation = useMoveConstant()
    const reorderConstantMutation = useReorderConstant()
    const upsertSharedEntityOverrideMutation = useUpsertSharedEntityOverride()
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

            const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
            const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? 'en'
            const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
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
        (values: GenericFormValues): ConstantLocalizedPayload => {
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
            const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
            const codenamePrimaryLocale = codenameValue?._primary ?? namePrimaryLocale ?? 'en'
            const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
            const codename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
            const dataType = (values.dataType as ConstantDataType | undefined) ?? 'STRING'
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
            if (!metahubId || !setId) return
            setDialogError(null)

            try {
                const payload = buildPayload(values)
                const sharedExcludedTargetIds = readSharedExcludedTargetIdsField(values)
                if (editingConstant) {
                    await updateConstantMutation.mutateAsync({
                        metahubId,
                        hubId: effectiveHubId,
                        kindKey,
                        setId,
                        constantId: editingConstant.id,
                        data: {
                            ...payload,
                            expectedVersion: editingConstant.version
                        }
                    })
                    if (sharedEntityMode && sharedExcludedTargetIds !== undefined) {
                        await syncSharedEntityExclusions({
                            metahubId,
                            entityKind: 'constant',
                            sharedEntityId: editingConstant.id,
                            excludedTargetIds: sharedExcludedTargetIds
                        })
                    }
                } else if (copySource) {
                    await copyConstantMutation.mutateAsync({
                        metahubId,
                        hubId: effectiveHubId,
                        kindKey,
                        setId,
                        constantId: copySource.id,
                        data: payload
                    })
                } else {
                    await createConstantMutation.mutateAsync({
                        metahubId,
                        hubId: effectiveHubId,
                        kindKey,
                        setId,
                        data: payload
                    })
                }

                close('create')
                close('edit')
                close('copy')
                setDialogError(null)
            } catch (error: unknown) {
                if (editingConstant && isOptimisticLockConflict(error)) {
                    const conflict = extractConflictInfo(error)
                    openConflict({
                        conflict,
                        pendingUpdate: {
                            id: editingConstant.id,
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
                        : t('constants.createError', 'Failed to save constant')
                setDialogError(message)
            }
        },
        [
            buildPayload,
            close,
            copyConstantMutation,
            copySource,
            createConstantMutation,
            editingConstant,
            effectiveHubId,
            kindKey,
            metahubId,
            openConflict,
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
                    kindKey,
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
        [effectiveHubId, enqueueSnackbar, kindKey, metahubId, moveConstantMutation, setId, t]
    )

    const handleSortableDragEnd = useCallback(
        async (event: DragEndEvent) => {
            if (!metahubId || !setId) return
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
                    hubId: effectiveHubId,
                    kindKey,
                    setId,
                    constantId: String(active.id),
                    newSortOrder: overConstant.sortOrder ?? 1,
                    mergedOrderIds
                })
                enqueueSnackbar(t('constants.reorderSuccess', 'Constant order updated'), { variant: 'success' })
            } catch (error: unknown) {
                const message = extractResponseMessage(error) || (error instanceof Error ? error.message : t('constants.reorderError'))
                enqueueSnackbar(message, { variant: 'error' })
            }
        },
        [effectiveHubId, enqueueSnackbar, includeShared, kindKey, metahubId, reorderConstantMutation, setId, tableData, t]
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
        (row: ConstantDisplay) => {
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
        (row: ConstantDisplay) => hasSharedRows && isSharedEntityRow(row) && !isSharedEntityMovable(row),
        [hasSharedRows]
    )

    const constantActionDescriptors = useMemo(
        () =>
            includeShared
                ? constantActions.filter((descriptor) => descriptor.id !== 'move-up' && descriptor.id !== 'move-down')
                : constantActions,
        [includeShared]
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
        [boolValueLabels, dataTypeLabels, firstLocalRowId, hasSharedRows, i18n.language, includeShared, t, tc]
    )

    const createActionContext = useCallback(
        (base: Record<string, unknown>) => ({
            ...base,
            orderMap,
            totalCount: sortedConstants.length,
            openEditDialog: (entity: ConstantDisplay) => {
                const source = constantsMap.get(entity.id)
                if (!source) return
                setDialogError(null)
                openEdit(source)
            },
            openCopyDialog: (entity: ConstantDisplay) => {
                const source = constantsMap.get(entity.id)
                if (!source) return
                setDialogError(null)
                openCopy(source)
            },
            openDeleteDialog: (entity: ConstantDisplay) => {
                const source = constantsMap.get(entity.id)
                if (!source) return
                openDelete(source)
            },
            moveConstant: handleMove
        }),
        [constantsMap, handleMove, openCopy, openDelete, openEdit, orderMap, sortedConstants.length]
    )

    const handleSharedConstantOverride = useCallback(
        async (row: ConstantDisplay, patch: { isExcluded?: boolean; isActive?: boolean | null }, successMessage: string) => {
            if (!metahubId || !setId) return

            try {
                await upsertSharedEntityOverrideMutation.mutateAsync({
                    metahubId,
                    data: {
                        entityKind: 'constant',
                        sharedEntityId: row.id,
                        targetObjectId: setId,
                        ...patch
                    }
                })
                await invalidateConstantsQueries.all(queryClient, metahubId, setId, effectiveHubId ?? undefined, kindKey)
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
        [effectiveHubId, enqueueSnackbar, kindKey, metahubId, queryClient, setId, t, upsertSharedEntityOverrideMutation]
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
    const contentOffsetSx = renderPageShell ? { xs: -1.5, md: -2 } : 0

    const content = (
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
                        title={title === undefined ? t('constants.title', 'Constants') : title}
                        search
                        searchValue={searchValue}
                        searchPlaceholder={t('constants.searchPlaceholder', 'Search constants...')}
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
                    ) : null}

                    {!isBusy && tableData.length === 0 ? (
                        <EmptyListState
                            image={APIEmptySVG}
                            imageAlt='No constants'
                            title={emptyTitle ?? t('constants.empty', 'No constants yet')}
                            description={
                                emptyDescription ?? t('constants.emptyDescription', 'Create constants to store reusable typed values')
                            }
                        />
                    ) : (
                        <Box sx={{ mx: contentOffsetSx }}>
                            <FlowListTable<ConstantDisplay>
                                data={tableData}
                                customColumns={columns}
                                onPendingInteractionAttempt={(row: ConstantDisplay) => handlePendingConstantInteraction(row.id)}
                                sortableRows
                                sortableItemIds={tableData.map((constant) => constant.id)}
                                dragHandleAriaLabel={t('constants.dnd.dragHandle', 'Drag to reorder')}
                                dragDisabled={isBusy}
                                getRowSx={getConstantRowSx}
                                isRowDragDisabled={isConstantRowDragDisabled}
                                onSortableDragEnd={handleSortableDragEnd}
                                renderDragOverlay={renderDragOverlay}
                                renderActions={(row: ConstantDisplay) => {
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
                                        <BaseEntityMenu<ConstantDisplay, ConstantLocalizedPayload>
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
                    ]

                    if (sharedEntityMode) {
                        tabs.push({
                            id: 'presentation',
                            label: t('constants.tabs.presentation', 'Presentation'),
                            content: (
                                <SharedEntitySettingsFields
                                    metahubId={metahubId}
                                    entityKind='constant'
                                    sharedEntityId={dialogMode === 'edit' ? editingConstant?.id : null}
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
                                    sharedEntityId={dialogMode === 'edit' ? editingConstant?.id : null}
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
                title={t('constants.deleteDialog.title', 'Delete Constant')}
                description={t('constants.deleteDialog.message', 'Are you sure you want to delete this constant?')}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => close('delete')}
                onConfirm={() => {
                    if (!dialogs.delete.item || !metahubId || !setId) return
                    deleteConstantMutation.mutate(
                        {
                            metahubId,
                            hubId: effectiveHubId,
                            kindKey,
                            setId,
                            constantId: dialogs.delete.item.id
                        },
                        {
                            onError: (error: unknown) => {
                                const message =
                                    extractResponseMessage(error) ||
                                    (error instanceof Error ? error.message : t('constants.deleteError', 'Failed to delete constant'))
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
                    if (metahubId && setId) {
                        if (effectiveHubId) {
                            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.constants(metahubId, effectiveHubId, setId, kindKey) })
                        } else {
                            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.constantsDirect(metahubId, setId, kindKey) })
                        }
                        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allConstantCodenames(metahubId, setId, kindKey) })
                    }
                }}
                onOverwrite={async () => {
                    const pendingUpdate = (dialogs.conflict.data as { pendingUpdate?: { id: string; patch: ConstantLocalizedPayload } })
                        ?.pendingUpdate
                    if (!pendingUpdate || !metahubId || !setId) return
                    await updateConstantMutation.mutateAsync({
                        metahubId,
                        hubId: effectiveHubId,
                        kindKey,
                        setId,
                        constantId: pendingUpdate.id,
                        data: pendingUpdate.patch
                    })
                    close('conflict')
                }}
                isLoading={updateConstantMutation.isPending}
            />

            {showSettingsTab &&
                setForHubResolution &&
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
                        metahubId,
                        currentHubId: effectiveHubId || null,
                        uiLocale: preferredVlcLocale,
                        api: {
                            updateEntity: (id: string, patch: SetLocalizedPayload) => {
                                if (!metahubId) return
                                updateSetMutation.mutate({
                                    metahubId,
                                    setId: id,
                                    kindKey,
                                    data: { ...patch, expectedVersion: setForHubResolution.version }
                                })
                            }
                        },
                        helpers: {
                            refreshList: () => {
                                if (metahubId && setId) {
                                    void queryClient.invalidateQueries({
                                        queryKey: metahubsQueryKeys.setDetail(metahubId, setId, kindKey)
                                    })
                                    void queryClient.invalidateQueries({
                                        queryKey: metahubsQueryKeys.allSets(metahubId, kindKey)
                                    })
                                    void queryClient.invalidateQueries({
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

const ConstantList = () => <ConstantListContent />

export default ConstantList
