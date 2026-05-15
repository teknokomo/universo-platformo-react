import { useCallback, useMemo, useState, type ChangeEvent } from 'react'
import { useParams } from 'react-router-dom'
import { alpha, type Theme } from '@mui/material/styles'
import { Box, Chip, Divider, Stack, Switch, FormControlLabel, Tabs, Tab, Tooltip, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import StarOutlineRoundedIcon from '@mui/icons-material/StarOutlineRounded'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import StarIcon from '@mui/icons-material/Star'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import {
    TemplateMainCard as MainCard,
    ToolbarControls,
    EmptyListState,
    APIEmptySVG,
    FlowListTable,
    ViewHeaderMUI as ViewHeader,
    LocalizedInlineField,
    useCodenameAutoFillVlc,
    BaseEntityMenu,
    revealPendingEntityFeedback,
    useListDialogs
} from '@universo/template-mui'
import { ConfirmDeleteDialog, EntityFormDialog, type TabConfig } from '@universo/template-mui/components/dialogs'
import type { VersionedLocalizedContent } from '@universo/types'
import type { ActionDescriptor, ActionContext, DragEndEvent } from '@universo/template-mui'
import {
    buildInitialValues as buildEnumInitialValues,
    buildFormTabs as buildEnumFormTabs,
    validateOptionListForm,
    canSaveOptionListForm,
    toPayload as enumToPayload
} from './OptionListActions'
import type { OptionListActionContext, OptionListDisplayWithContainer } from './OptionListActions'
import { useUpdateOptionListAtMetahub } from '../hooks/optionListMutations'
import { useTreeEntities } from '../hooks/useTreeEntities'
import { useMetahubPrimaryLocale } from '../../../settings/hooks/useMetahubPrimaryLocale'
import type { OptionValue, OptionValueDisplay, OptionListEntity, OptionListLocalizedPayload } from '../../../../types'
import { getVLCString, toOptionValueDisplay } from '../../../../types'
import {
    normalizeLocale,
    extractLocalizedInput,
    hasPrimaryContent,
    ensureLocalizedContent,
    ensureEntityCodenameContent
} from '../../../../utils/localizedInput'
import { sanitizeCodenameForStyle, normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../../utils/codename'
import { useCodenameConfig } from '../../../settings/hooks/useCodenameConfig'
import { CodenameField, ExistingCodenamesProvider } from '../../../../components'
import { getOptionValueBlockingReferences, getOptionListById, listOptionValues } from '../api/optionLists'
import {
    useCopyOptionValue,
    useCreateOptionValue,
    useDeleteOptionValue,
    useMoveOptionValue,
    useReorderOptionValue,
    useUpdateOptionValue
} from '../hooks/optionListMutations'
import {
    invalidateOptionValuesQueries,
    isSharedEntityActive,
    isSharedEntityMovable,
    isSharedEntityRow,
    metahubsQueryKeys,
    reorderSharedEntityIds,
    sortSharedEntityList,
    useUpsertSharedEntityOverride
} from '../../../shared'
import SharedEntitySettingsFields from '../../../shared/ui/SharedEntitySettingsFields'
import { readSharedExcludedTargetIdsField, syncSharedEntityExclusions } from '../../../shared/sharedEntityExclusions'
import { DragOverlayValueRow } from './shared/DragOverlayValueRow'
import { resolveEntityChildKindKey } from '../../../shared/entityMetadataRoutePaths'

type ValueFormValues = {
    nameVlc: VersionedLocalizedContent<string> | null
    descriptionVlc: VersionedLocalizedContent<string> | null
    codename: VersionedLocalizedContent<string> | null
    codenameTouched?: boolean
    isDefault?: boolean
    presentation?: Record<string, unknown>
}

type CopyValueFormValues = {
    nameVlc: VersionedLocalizedContent<string> | null
    descriptionVlc: VersionedLocalizedContent<string> | null
    codename: VersionedLocalizedContent<string> | null
    codenameTouched?: boolean
    isDefault?: boolean
    presentation?: Record<string, unknown>
}

type GenericFormValues = Record<string, unknown>

const DIALOG_SAVE_CANCEL = { __dialogCancelled: true } as const

type SelectableOptionListContentProps = {
    metahubId?: string
    optionListId?: string
    sharedEntityMode?: boolean
    title?: string | null
    emptyTitle?: string
    emptyDescription?: string
    renderPageShell?: boolean
    showSettingsTab?: boolean
}

type ValueActionContext = ActionContext<OptionValueDisplay, never> & {
    valueMap: Map<string, OptionValue>
    valueOrderMap: Map<string, number>
    valueCount: number
    openEditDialog: (value: OptionValue) => void
    openDeleteDialog: (value: OptionValue) => void
    setDefaultValue: (value: OptionValue) => Promise<void>
    clearDefaultValue: (value: OptionValue) => Promise<void>
    moveValue: (value: OptionValue, direction: 'up' | 'down') => Promise<void>
}

const extractResponseMessage = (error: unknown): string | undefined => {
    if (!error || typeof error !== 'object' || !('response' in error)) return undefined
    const response = (error as { response?: unknown }).response
    if (!response || typeof response !== 'object') return undefined
    const data = (response as { data?: unknown }).data
    if (!data || typeof data !== 'object') return undefined
    const responseError = (data as { error?: unknown }).error
    if (typeof responseError === 'string') return responseError
    const responseMessage = (data as { message?: unknown }).message
    return typeof responseMessage === 'string' ? responseMessage : undefined
}

const appendCopySuffix = (
    value: VersionedLocalizedContent<string> | null | undefined,
    uiLocale: string,
    fallback: string
): VersionedLocalizedContent<string> => {
    const normalizedLocale = normalizeLocale(uiLocale)
    const suffix = normalizedLocale === 'ru' ? ' (копия)' : ' (copy)'
    const source = ensureLocalizedContent(value, normalizedLocale, fallback)
    const nextLocales = { ...(source.locales ?? {}) } as Record<string, { content?: string }>
    for (const [locale, localeValue] of Object.entries(nextLocales)) {
        const localeSuffix = normalizeLocale(locale) === 'ru' ? ' (копия)' : ' (copy)'
        const content = typeof localeValue?.content === 'string' ? localeValue.content.trim() : ''
        if (content.length > 0) {
            nextLocales[locale] = { ...localeValue, content: `${content}${localeSuffix}` }
        }
    }
    const hasAny = Object.values(nextLocales).some((entry) => typeof entry?.content === 'string' && entry.content.trim().length > 0)
    if (!hasAny) {
        nextLocales[normalizedLocale] = { content: `${fallback || 'Copy'}${suffix}` }
    }
    return {
        ...source,
        locales: nextLocales as VersionedLocalizedContent<string>['locales']
    }
}

const ValueFormFields = ({
    values,
    setValue,
    isLoading,
    errors,
    uiLocale,
    translate,
    showDefaultToggle = true,
    editingEntityId
}: {
    values: GenericFormValues
    setValue: (name: string, value: unknown) => void
    isLoading: boolean
    errors: Record<string, string>
    uiLocale: string
    translate: (key: string, defaultValue?: string) => string
    showDefaultToggle?: boolean
    editingEntityId?: string | null
}) => {
    const codenameConfig = useCodenameConfig()
    const nameVlc = (values.nameVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const descriptionVlc = (values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const codename = (values.codename as VersionedLocalizedContent<string> | null | undefined) ?? null
    const codenameTouched = Boolean(values.codenameTouched)
    useCodenameAutoFillVlc({
        codename,
        codenameTouched,
        nameVlc,
        deriveCodename: (nameContent: string) =>
            sanitizeCodenameForStyle(
                nameContent,
                codenameConfig.style,
                codenameConfig.alphabet,
                codenameConfig.allowMixed,
                codenameConfig.autoConvertMixedAlphabets
            ),
        setValue: setValue as (field: 'codename' | 'codenameTouched', value: VersionedLocalizedContent<string> | null | boolean) => void
    })

    return (
        <Stack spacing={2}>
            <LocalizedInlineField
                mode='localized'
                label={translate('common:fields.name', 'Name')}
                required
                disabled={isLoading}
                value={nameVlc}
                onChange={(next: VersionedLocalizedContent<string> | null) => setValue('nameVlc', next)}
                error={errors.nameVlc || null}
                helperText={errors.nameVlc}
                uiLocale={uiLocale}
            />

            <LocalizedInlineField
                mode='localized'
                label={translate('common:fields.description', 'Description')}
                disabled={isLoading}
                value={descriptionVlc}
                onChange={(next: VersionedLocalizedContent<string> | null) => setValue('descriptionVlc', next)}
                uiLocale={uiLocale}
                multiline
                rows={2}
            />

            <Divider />

            {showDefaultToggle ? (
                <>
                    <FormControlLabel
                        control={<Switch checked={Boolean(values.isDefault)} onChange={(_, checked) => setValue('isDefault', checked)} />}
                        label={translate('optionValues.isDefault', 'Default value')}
                        disabled={isLoading}
                    />

                    <Divider />
                </>
            ) : null}

            <CodenameField
                value={codename}
                onChange={(value) => setValue('codename', value)}
                touched={codenameTouched}
                onTouchedChange={(touched: boolean) => setValue('codenameTouched', touched)}
                onDuplicateStatusChange={(dup) => setValue('_hasCodenameDuplicate', dup)}
                uiLocale={uiLocale}
                label={translate('optionValues.codename', 'Codename')}
                helperText={translate('optionValues.codenameHelper', 'Unique identifier')}
                error={errors.codename}
                disabled={isLoading}
                required
                editingEntityId={editingEntityId}
            />
        </Stack>
    )
}

export const SelectableOptionListContent = ({
    metahubId: metahubIdProp,
    optionListId: optionListIdProp,
    sharedEntityMode = false,
    title,
    emptyTitle,
    emptyDescription,
    renderPageShell = true,
    showSettingsTab = true
}: SelectableOptionListContentProps = {}) => {
    const codenameConfig = useCodenameConfig()
    const {
        metahubId: routeMetahubId,
        optionListId: routeOptionListId,
        kindKey: routeKindKey
    } = useParams<{ metahubId: string; optionListId: string; kindKey?: string }>()
    const metahubId = metahubIdProp ?? routeMetahubId
    const optionListId = optionListIdProp ?? routeOptionListId
    const kindKey = resolveEntityChildKindKey({ routeKindKey, childObjectKind: 'enumeration' })
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()
    const { enqueueSnackbar } = useSnackbar()

    const [search, setSearch] = useState('')
    const { dialogs, openCreate, openEdit, openCopy, openDelete, close } = useListDialogs<OptionValue>()
    const [dialogError, setDialogError] = useState<string | null>(null)
    const pendingInteractionMessage = tc('pendingCreateBlocked', 'This item is still being created. Please wait a moment and try again.')

    const createMutation = useCreateOptionValue()
    const updateMutation = useUpdateOptionValue()
    const deleteMutation = useDeleteOptionValue()
    const moveMutation = useMoveOptionValue()
    const copyMutation = useCopyOptionValue()
    const reorderMutation = useReorderOptionValue()
    const upsertSharedEntityOverrideMutation = useUpsertSharedEntityOverride()

    const preferredVlcLocale = useMetahubPrimaryLocale()
    const updateOptionListMetaMutation = useUpdateOptionListAtMetahub()
    const queryClient = useQueryClient()
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const includeSharedValues = !sharedEntityMode
    // DnD: Handle value reorder
    const handleValueReorder = useCallback(
        async (valueId: string, newSortOrder: number, mergedOrderIds?: string[]) => {
            if (!metahubId || !optionListId) return
            try {
                await reorderMutation.mutateAsync({
                    metahubId,
                    optionListId,
                    kindKey,
                    valueId,
                    newSortOrder,
                    mergedOrderIds
                })
                enqueueSnackbar(t('optionValues.reorderSuccess', 'Value order updated'), { variant: 'success' })
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : t('optionValues.reorderError', 'Failed to reorder value')
                enqueueSnackbar(message, { variant: 'error' })
            }
        },
        [metahubId, optionListId, reorderMutation, enqueueSnackbar, t, kindKey]
    )

    const {
        data: valuesResponse,
        isLoading,
        error
    } = useQuery({
        queryKey:
            metahubId && optionListId
                ? metahubsQueryKeys.optionValuesList(metahubId, optionListId, {
                      includeShared: includeSharedValues,
                      kindKey
                  })
                : ['empty'],
        queryFn: () => listOptionValues(metahubId!, optionListId!, { includeShared: includeSharedValues, kindKey }),
        enabled: Boolean(metahubId && optionListId)
    })

    const values = useMemo(() => valuesResponse?.items ?? [], [valuesResponse?.items])

    // Fetch parent enumeration for Settings edit dialog
    const { data: enumerationForHubResolution } = useQuery({
        queryKey:
            metahubId && optionListId
                ? metahubsQueryKeys.optionListDetail(metahubId, optionListId, kindKey)
                : ['metahubs', 'optionLists', 'detail', 'empty'],
        queryFn: async () => {
            if (!metahubId || !optionListId) throw new Error('metahubId and optionListId are required')
            return getOptionListById(metahubId, optionListId, kindKey)
        },
        enabled: showSettingsTab && !!metahubId && !!optionListId
    })

    // TreeEntities for the Settings edit dialog (shared hook — staleTime: 5min, deduplication via same queryKey)
    const allTreeEntities = useTreeEntities(metahubId)

    const [copyDialogError, setCopyDialogError] = useState<string | null>(null)

    const { data: blockingInfo } = useQuery({
        queryKey:
            metahubId && optionListId && dialogs.edit.item?.id
                ? ['metahubs', 'enumerationValueBlockingRefs', metahubId, optionListId, dialogs.edit.item.id]
                : ['metahubs', 'enumerationValueBlockingRefs', 'empty'],
        queryFn: () => getOptionValueBlockingReferences(metahubId!, optionListId!, dialogs.edit.item!.id, kindKey),
        enabled: Boolean(metahubId && optionListId && dialogs.edit.item?.id)
    })

    const filteredValues = useMemo(() => {
        const searchValue = search.trim().toLowerCase()
        if (!searchValue) return values
        return values.filter((value) => {
            const displayName = getVLCString(value.name, i18n.language) || getVLCString(value.name, 'en') || value.codename
            return displayName.toLowerCase().includes(searchValue) || value.codename.toLowerCase().includes(searchValue)
        })
    }, [values, search, i18n.language])

    // Sorted raw values for DnD items — must match tableData order
    const sortedFilteredValues = useMemo(() => sortSharedEntityList(filteredValues), [filteredValues])

    // DnD: Handle drag end event (from FlowListTable InternalDndWrapper)
    const handleDragEnd = useCallback(
        async (event: DragEndEvent) => {
            const { active, over } = event
            if (!over || active.id === over.id) return

            const oldIndex = sortedFilteredValues.findIndex((v) => v.id === String(active.id))
            const overIndex = sortedFilteredValues.findIndex((v) => v.id === String(over.id))
            if (oldIndex === -1 || overIndex === -1) return

            const newSortOrder = sortedFilteredValues[overIndex].sortOrder ?? overIndex + 1
            const mergedOrderIds = includeSharedValues
                ? reorderSharedEntityIds(
                      sortedFilteredValues.map((value) => value.id),
                      String(active.id),
                      String(over.id)
                  ).filter((id) => {
                      const row = sortedFilteredValues.find((value) => value.id === id)
                      return row ? isSharedEntityMovable(row) : false
                  })
                : undefined

            await handleValueReorder(String(active.id), newSortOrder, mergedOrderIds)
        },
        [handleValueReorder, includeSharedValues, sortedFilteredValues]
    )

    // DnD: Render drag overlay
    const renderDragOverlay = useCallback(
        (activeId: string | null) => {
            if (!activeId) return null
            const val = sortedFilteredValues.find((v) => v.id === activeId)
            if (!val) return null
            return <DragOverlayValueRow value={toOptionValueDisplay(val, i18n.language)} />
        },
        [sortedFilteredValues, i18n.language]
    )

    const tableData = useMemo<OptionValueDisplay[]>(
        () => sortedFilteredValues.map((value) => toOptionValueDisplay(value, i18n.language)),
        [i18n.language, sortedFilteredValues]
    )

    const hasSharedRows = useMemo(
        () => includeSharedValues && tableData.some((row) => isSharedEntityRow(row)),
        [includeSharedValues, tableData]
    )

    const firstLocalRowId = useMemo(() => {
        if (!hasSharedRows) return null
        return tableData.find((row) => !isSharedEntityRow(row))?.id ?? null
    }, [hasSharedRows, tableData])

    const getValueRowSx = useCallback(
        (row: OptionValueDisplay) => {
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

    const isValueRowDragDisabled = useCallback(
        (row: OptionValueDisplay) => hasSharedRows && isSharedEntityRow(row) && !isSharedEntityMovable(row),
        [hasSharedRows]
    )

    const valueMap = useMemo(() => new Map(values.map((value) => [value.id, value])), [values])

    const handlePendingValueInteraction = useCallback(
        (valueId: string) => {
            if (!metahubId || !optionListId) return
            revealPendingEntityFeedback({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.optionValues(metahubId, optionListId, kindKey),
                entityId: valueId
            })
            enqueueSnackbar(pendingInteractionMessage, { variant: 'info' })
        },
        [enqueueSnackbar, optionListId, kindKey, metahubId, pendingInteractionMessage, queryClient]
    )
    const valueOrderMap = useMemo(() => {
        const sortedIds = sortSharedEntityList(values).map((item) => item.id)
        return new Map(sortedIds.map((id, index) => [id, index]))
    }, [values])
    const createValueActionContext = useCallback(
        (base: Partial<ActionContext<OptionValueDisplay, never>>): ValueActionContext => ({
            ...(base as ActionContext<OptionValueDisplay, never>),
            valueMap,
            valueOrderMap,
            valueCount: values.length,
            openEditDialog: (value: OptionValue) => {
                setDialogError(null)
                openEdit(value)
            },
            openDeleteDialog: (value: OptionValue) => {
                openDelete(value)
            },
            setDefaultValue: async (value: OptionValue) => {
                if (!metahubId || !optionListId) return
                if (value.isDefault) return
                updateMutation.mutate({
                    metahubId,
                    optionListId,
                    kindKey,
                    valueId: value.id,
                    data: {
                        isDefault: true,
                        expectedVersion: value.version
                    }
                })
            },
            clearDefaultValue: async (value: OptionValue) => {
                if (!metahubId || !optionListId) return
                if (!value.isDefault) return
                updateMutation.mutate({
                    metahubId,
                    optionListId,
                    kindKey,
                    valueId: value.id,
                    data: {
                        isDefault: false,
                        expectedVersion: value.version
                    }
                })
            },
            moveValue: async (value: OptionValue, direction: 'up' | 'down') => {
                if (!metahubId || !optionListId) return
                await moveMutation.mutateAsync({
                    metahubId,
                    optionListId,
                    kindKey,
                    valueId: value.id,
                    direction
                })
            }
        }),
        [valueMap, valueOrderMap, values.length, kindKey, metahubId, optionListId, moveMutation, openDelete, openEdit, updateMutation]
    )
    const toValueActionContext = useCallback((ctx: ActionContext<OptionValueDisplay, never>) => ctx as ValueActionContext, [])

    const valueActions = useMemo<ActionDescriptor<OptionValueDisplay, never>[]>(
        () => [
            {
                id: 'edit',
                labelKey: 'common:actions.edit',
                order: 10,
                icon: <EditRoundedIcon fontSize='small' />,
                onSelect: (ctx) => {
                    const valueCtx = toValueActionContext(ctx)
                    const source = valueCtx.valueMap.get(valueCtx.entity.id)
                    if (source) {
                        valueCtx.openEditDialog(source)
                    }
                }
            },
            {
                id: 'copy',
                labelKey: 'common:actions.copy',
                order: 11,
                icon: <ContentCopyRoundedIcon fontSize='small' />,
                onSelect: (ctx) => {
                    const valueCtx = toValueActionContext(ctx)
                    const source = valueCtx.valueMap.get(valueCtx.entity.id)
                    if (source) {
                        setCopyDialogError(null)
                        openCopy(source)
                    }
                }
            },
            {
                id: 'set-default',
                labelKey: 'optionValues.actions.setDefault',
                order: 20,
                icon: <StarRoundedIcon fontSize='small' />,
                visible: (ctx) => {
                    const valueCtx = toValueActionContext(ctx)
                    const source = valueCtx.valueMap.get(valueCtx.entity.id)
                    return !source?.isDefault
                },
                onSelect: async (ctx) => {
                    const valueCtx = toValueActionContext(ctx)
                    const source = valueCtx.valueMap.get(valueCtx.entity.id)
                    if (source) {
                        await valueCtx.setDefaultValue(source)
                    }
                }
            },
            {
                id: 'clear-default',
                labelKey: 'optionValues.actions.clearDefault',
                order: 21,
                icon: <StarOutlineRoundedIcon fontSize='small' />,
                visible: (ctx) => {
                    const valueCtx = toValueActionContext(ctx)
                    const source = valueCtx.valueMap.get(valueCtx.entity.id)
                    return Boolean(source?.isDefault)
                },
                onSelect: async (ctx) => {
                    const valueCtx = toValueActionContext(ctx)
                    const source = valueCtx.valueMap.get(valueCtx.entity.id)
                    if (source) {
                        await valueCtx.clearDefaultValue(source)
                    }
                }
            },
            {
                id: 'move-up',
                labelKey: 'components.actions.moveUp',
                order: 30,
                dividerBefore: true,
                icon: <ArrowUpwardRoundedIcon fontSize='small' />,
                enabled: (ctx) => {
                    const valueCtx = toValueActionContext(ctx)
                    const orderMap = valueCtx.valueOrderMap
                    if (!orderMap || orderMap.size <= 1) return false
                    const index = orderMap.get(valueCtx.entity.id)
                    return typeof index === 'number' && index > 0
                },
                onSelect: async (ctx) => {
                    const valueCtx = toValueActionContext(ctx)
                    const source = valueCtx.valueMap.get(valueCtx.entity.id)
                    if (source) {
                        await valueCtx.moveValue(source, 'up')
                    }
                }
            },
            {
                id: 'move-down',
                labelKey: 'components.actions.moveDown',
                order: 40,
                icon: <ArrowDownwardRoundedIcon fontSize='small' />,
                enabled: (ctx) => {
                    const valueCtx = toValueActionContext(ctx)
                    const orderMap = valueCtx.valueOrderMap
                    if (!orderMap || orderMap.size <= 1) return false
                    const index = orderMap.get(valueCtx.entity.id)
                    if (typeof index !== 'number') return false
                    return index < orderMap.size - 1
                },
                onSelect: async (ctx) => {
                    const valueCtx = toValueActionContext(ctx)
                    const source = valueCtx.valueMap.get(valueCtx.entity.id)
                    if (source) {
                        await valueCtx.moveValue(source, 'down')
                    }
                }
            },
            {
                id: 'delete',
                labelKey: 'common:actions.delete',
                order: 100,
                dividerBefore: true,
                icon: <DeleteRoundedIcon fontSize='small' />,
                tone: 'danger',
                onSelect: (ctx) => {
                    const valueCtx = toValueActionContext(ctx)
                    const source = valueCtx.valueMap.get(valueCtx.entity.id)
                    if (source) {
                        valueCtx.openDeleteDialog(source)
                    }
                }
            }
        ],
        [openCopy, toValueActionContext]
    )

    const valueActionDescriptors = useMemo(
        () =>
            includeSharedValues
                ? valueActions.filter((descriptor) => descriptor.id !== 'move-up' && descriptor.id !== 'move-down')
                : valueActions,
        [includeSharedValues, valueActions]
    )

    const valueColumns = useMemo(
        () => [
            {
                id: 'sortOrder',
                label: t('components.table.order', '#'),
                width: '4%',
                align: 'center' as const,
                render: (row: OptionValueDisplay) => <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{row.sortOrder ?? 0}</Typography>
            },
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '30%',
                align: 'left' as const,
                render: (row: OptionValueDisplay) => (
                    <Stack spacing={0.5}>
                        <Stack direction='row' spacing={0.5} alignItems='center' flexWrap='wrap' useFlexGap>
                            {row.isDefault && (
                                <Tooltip title={t('optionValues.defaultTooltip', 'This value is used by default.')} arrow>
                                    <StarIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                </Tooltip>
                            )}
                            <Typography sx={{ fontSize: 14, fontWeight: 500, wordBreak: 'break-word' }}>{row.name || '—'}</Typography>
                            {includeSharedValues && isSharedEntityRow(row) ? (
                                <Chip label={t('metahubs:shared.list.badge', 'Shared')} size='small' color='info' variant='outlined' />
                            ) : null}
                            {includeSharedValues && isSharedEntityRow(row) && !isSharedEntityActive(row) ? (
                                <Chip label={t('metahubs:shared.list.inactive', 'Inactive')} size='small' variant='outlined' />
                            ) : null}
                        </Stack>
                    </Stack>
                )
            },
            {
                id: 'description',
                label: tc('table.description', 'Description'),
                width: '30%',
                align: 'left' as const,
                render: (row: OptionValueDisplay) => (
                    <Typography sx={{ fontSize: 14, wordBreak: 'break-word' }}>{row.description || '—'}</Typography>
                )
            },
            {
                id: 'codename',
                label: t('optionValues.codename', 'Codename'),
                width: '20%',
                align: 'left' as const,
                render: (row: OptionValueDisplay) => (
                    <Typography sx={{ fontSize: 14, fontWeight: 600, fontFamily: 'monospace' }}>{row.codename}</Typography>
                )
            }
        ],
        [includeSharedValues, t, tc]
    )

    const formDefaults = useMemo<ValueFormValues>(
        () => ({
            nameVlc: null,
            descriptionVlc: null,
            codename: null,
            codenameTouched: false,
            isDefault: false,
            presentation: undefined
        }),
        []
    )

    const initialFormValues = useMemo<ValueFormValues>(() => {
        if (!dialogs.edit.item) return formDefaults
        const normalizedName =
            ensureLocalizedContent(
                dialogs.edit.item.name ?? null,
                i18n.language,
                getVLCString(dialogs.edit.item.name, i18n.language) || dialogs.edit.item.codename || ''
            ) ?? null
        const normalizedDescription =
            ensureLocalizedContent(
                dialogs.edit.item.description ?? null,
                i18n.language,
                getVLCString(dialogs.edit.item.description, i18n.language) || ''
            ) ?? null
        return {
            nameVlc: normalizedName,
            descriptionVlc: normalizedDescription,
            codename: ensureEntityCodenameContent(dialogs.edit.item, i18n.language, dialogs.edit.item.codename || ''),
            codenameTouched: true,
            isDefault: dialogs.edit.item.isDefault ?? false,
            presentation: dialogs.edit.item.presentation
        }
    }, [dialogs.edit.item, formDefaults, i18n.language])

    const copyInitialValues = useMemo<CopyValueFormValues>(() => {
        if (!dialogs.copy.item) {
            return {
                nameVlc: null,
                descriptionVlc: null,
                codename: null,
                codenameTouched: false,
                isDefault: false,
                presentation: undefined
            }
        }
        const source = dialogs.copy.item
        const sourceName = getVLCString(source.codename) || 'value'
        const normalizedDescription =
            ensureLocalizedContent(source.description ?? null, i18n.language, getVLCString(source.description, i18n.language) || '') ?? null
        return {
            nameVlc: appendCopySuffix(source.name ?? null, i18n.language, sourceName),
            descriptionVlc: normalizedDescription,
            codename: null,
            codenameTouched: false,
            isDefault: false,
            presentation: source.presentation
        }
    }, [dialogs.copy.item, i18n.language])

    const renderValueTabs = useCallback(
        ({
            values,
            setValue,
            isLoading,
            errors,
            editingEntityId
        }: {
            values: Record<string, unknown>
            setValue: (name: string, value: unknown) => void
            isLoading: boolean
            errors: Record<string, string>
            editingEntityId: string | null
        }): TabConfig[] => {
            const tabs: TabConfig[] = [
                {
                    id: 'general',
                    label: t('optionValues.tabs.general', 'General'),
                    content: (
                        <ValueFormFields
                            values={values}
                            setValue={setValue}
                            isLoading={isLoading}
                            errors={errors ?? {}}
                            uiLocale={i18n.language}
                            translate={(key, defaultValue) => t(key, defaultValue ? { defaultValue } : {})}
                            editingEntityId={editingEntityId}
                        />
                    )
                }
            ]

            if (sharedEntityMode) {
                tabs.push({
                    id: 'presentation',
                    label: t('optionValues.tabs.presentation', 'Presentation'),
                    content: (
                        <SharedEntitySettingsFields
                            metahubId={metahubId}
                            entityKind='value'
                            sharedEntityId={editingEntityId}
                            storageField='presentation'
                            section='behavior'
                            values={values}
                            setValue={setValue}
                            isLoading={isLoading}
                        />
                    )
                })
                tabs.push({
                    id: 'exclusions',
                    label: t('metahubs:shared.exclusions.tab', 'Exclusions'),
                    content: (
                        <SharedEntitySettingsFields
                            metahubId={metahubId}
                            entityKind='value'
                            sharedEntityId={editingEntityId}
                            storageField='presentation'
                            section='exclusions'
                            values={values}
                            setValue={setValue}
                            isLoading={isLoading}
                        />
                    )
                })
            }

            return tabs
        },
        [i18n.language, metahubId, sharedEntityMode, t]
    )

    const handleSharedValueOverride = useCallback(
        async (row: OptionValueDisplay, patch: { isExcluded?: boolean; isActive?: boolean | null }, successMessage: string) => {
            if (!metahubId || !optionListId) return

            try {
                await upsertSharedEntityOverrideMutation.mutateAsync({
                    metahubId,
                    data: {
                        entityKind: 'value',
                        sharedEntityId: row.id,
                        targetObjectId: optionListId,
                        ...patch
                    }
                })
                await invalidateOptionValuesQueries.all(queryClient, metahubId, optionListId, kindKey)
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
        [optionListId, enqueueSnackbar, kindKey, metahubId, queryClient, t, upsertSharedEntityOverrideMutation]
    )

    const validateForm = (valuesToValidate: GenericFormValues) => {
        const errors: Record<string, string> = {}
        const nameVlc = valuesToValidate.nameVlc as VersionedLocalizedContent<string> | null | undefined
        if (!hasPrimaryContent(nameVlc)) {
            errors.nameVlc = tc('crud.nameRequired', 'Name is required')
        }
        const codenameValue = valuesToValidate.codename as VersionedLocalizedContent<string> | null | undefined
        const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? 'en'
        const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
        const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
        if (!normalizedCodename) {
            errors.codename = t('optionValues.validation.codenameRequired', 'Codename is required')
        } else if (!isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)) {
            errors.codename = t('optionValues.validation.codenameInvalid', 'Codename contains invalid characters')
        }
        return Object.keys(errors).length > 0 ? errors : null
    }

    const canSaveForm = (valuesToValidate: GenericFormValues) => {
        const nameVlc = valuesToValidate.nameVlc as VersionedLocalizedContent<string> | null | undefined
        const codenameValue = valuesToValidate.codename as VersionedLocalizedContent<string> | null | undefined
        const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? 'en'
        const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
        const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
        return (
            !valuesToValidate._hasCodenameDuplicate &&
            hasPrimaryContent(nameVlc) &&
            Boolean(normalizedCodename) &&
            isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
        )
    }

    const handleSave = async (formValues: GenericFormValues) => {
        if (!metahubId || !optionListId) return
        setDialogError(null)

        const nameVlc = formValues.nameVlc as VersionedLocalizedContent<string> | null | undefined
        const descriptionVlc = formValues.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
        const codenameValue = formValues.codename as VersionedLocalizedContent<string> | null | undefined
        const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
        const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)
        const codenamePrimaryLocale = codenameValue?._primary ?? namePrimaryLocale ?? 'en'
        const codenameRaw = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
        const codename = normalizeCodenameForStyle(codenameRaw, codenameConfig.style, codenameConfig.alphabet)
        const isDefault = Boolean(formValues.isDefault)
        const presentation = formValues.presentation as Record<string, unknown> | undefined
        const sharedExcludedTargetIds = readSharedExcludedTargetIdsField(formValues)
        const codenamePayload = ensureLocalizedContent(codenameValue, namePrimaryLocale ?? codenamePrimaryLocale, codename)

        if (!nameInput || !namePrimaryLocale) {
            setDialogError(tc('crud.nameRequired', 'Name is required'))
            return
        }
        if (!codename) {
            setDialogError(t('optionValues.validation.codenameRequired', 'Codename is required'))
            return
        }

        if (!dialogs.edit.item) {
            await createMutation.mutateAsync({
                metahubId,
                optionListId,
                kindKey,
                data: {
                    codename: codenamePayload,
                    name: nameInput,
                    description: descriptionInput,
                    namePrimaryLocale,
                    descriptionPrimaryLocale,
                    isDefault,
                    presentation: presentation && Object.keys(presentation).length > 0 ? presentation : undefined
                }
            })

            close('create')
            setDialogError(null)
            return
        }

        const currentEditingValue = dialogs.edit.item
        try {
            await updateMutation.mutateAsync({
                metahubId,
                optionListId,
                kindKey,
                valueId: currentEditingValue.id,
                data: {
                    codename: codenamePayload,
                    name: nameInput,
                    description: descriptionInput,
                    namePrimaryLocale,
                    descriptionPrimaryLocale,
                    isDefault,
                    presentation: presentation && Object.keys(presentation).length > 0 ? presentation : undefined,
                    expectedVersion: currentEditingValue.version
                }
            })
        } catch (e: unknown) {
            const responseMessage = extractResponseMessage(e)
            const message =
                typeof responseMessage === 'string'
                    ? responseMessage
                    : e instanceof Error
                    ? e.message
                    : typeof e === 'string'
                    ? e
                    : t('optionValues.updateError', 'Failed to update enumeration value')

            openEdit(currentEditingValue)
            setDialogError(message)
            throw DIALOG_SAVE_CANCEL
        }

        try {
            if (sharedEntityMode && sharedExcludedTargetIds !== undefined) {
                await syncSharedEntityExclusions({
                    metahubId,
                    entityKind: 'value',
                    sharedEntityId: currentEditingValue.id,
                    excludedTargetIds: sharedExcludedTargetIds
                })
            }
            close('edit')
            setDialogError(null)
        } catch (e: unknown) {
            const responseMessage = extractResponseMessage(e)
            const message =
                typeof responseMessage === 'string'
                    ? responseMessage
                    : e instanceof Error
                    ? e.message
                    : typeof e === 'string'
                    ? e
                    : t('optionValues.updateError', 'Failed to update enumeration value')

            setDialogError(message)
            throw DIALOG_SAVE_CANCEL
        }
    }

    if (!metahubId || !optionListId) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Invalid enumeration'
                title={t('metahubs:errors.invalidMetahub')}
                description={t('metahubs:errors.pleaseSelectMetahub')}
            />
        )
    }

    const isBusy = isLoading
    const contentOffsetSx = 0
    const content = (
        <ExistingCodenamesProvider entities={values}>
            {error ? (
                <EmptyListState
                    image={APIEmptySVG}
                    imageAlt='Connection error'
                    title={t('errors.connectionFailed')}
                    description={t('errors.pleaseTryLater')}
                />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 1 }}>
                    <ViewHeader
                        search={true}
                        searchPlaceholder={t('optionValues.searchPlaceholder', 'Search enumeration values...')}
                        onSearchChange={(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setSearch(e.target.value)}
                        title={title === undefined ? t('optionValues.title', 'Values') : title}
                        controlsAlign={renderPageShell ? 'start' : 'end'}
                    >
                        <ToolbarControls
                            primaryAction={{
                                label: tc('create'),
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
                                value='values'
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
                                <Tab value='values' label={t('optionValues.title', 'Values')} />
                                <Tab value='settings' label={t('settings.title')} />
                            </Tabs>
                        </Box>
                    ) : null}

                    {!isBusy && tableData.length === 0 ? (
                        <EmptyListState
                            image={APIEmptySVG}
                            imageAlt='No enumeration values'
                            title={emptyTitle ?? t('optionValues.empty', 'No values yet')}
                            description={
                                emptyDescription ??
                                t('optionValues.emptyDescription', 'Add values to define available options in this enumeration')
                            }
                        />
                    ) : (
                        <Box sx={{ mx: contentOffsetSx }}>
                            <FlowListTable<OptionValueDisplay>
                                data={tableData}
                                customColumns={valueColumns}
                                onPendingInteractionAttempt={(row: OptionValueDisplay) => handlePendingValueInteraction(row.id)}
                                sortableRows
                                sortableItemIds={tableData.map((value) => value.id)}
                                dragHandleAriaLabel={t('optionValues.dnd.dragHandle', 'Drag to reorder')}
                                dragDisabled={isBusy}
                                getRowSx={getValueRowSx}
                                isRowDragDisabled={isValueRowDragDisabled}
                                onSortableDragEnd={handleDragEnd}
                                renderDragOverlay={renderDragOverlay}
                                renderActions={(row: OptionValueDisplay) => {
                                    const sharedRowDescriptors: typeof valueActionDescriptors = []

                                    if (includeSharedValues && isSharedEntityRow(row) && row.sharedBehavior?.canDeactivate !== false) {
                                        const isActive = isSharedEntityActive(row)
                                        sharedRowDescriptors.push({
                                            id: isActive ? 'deactivate' : 'activate',
                                            labelKey: isActive ? 'shared.list.actions.deactivate' : 'shared.list.actions.activate',
                                            order: 10,
                                            onSelect: async () => {
                                                await handleSharedValueOverride(
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

                                    if (includeSharedValues && isSharedEntityRow(row) && row.sharedBehavior?.canExclude !== false) {
                                        sharedRowDescriptors.push({
                                            id: 'exclude',
                                            labelKey: 'shared.list.actions.exclude',
                                            order: 20,
                                            tone: 'danger',
                                            dividerBefore: sharedRowDescriptors.length > 0,
                                            onSelect: async () => {
                                                await handleSharedValueOverride(
                                                    row,
                                                    { isExcluded: true },
                                                    t('metahubs:shared.list.messages.excluded', 'Shared entity excluded from this target')
                                                )
                                            }
                                        })
                                    }

                                    const descriptors =
                                        includeSharedValues && isSharedEntityRow(row) ? sharedRowDescriptors : valueActionDescriptors

                                    return descriptors.length === 0 ? null : (
                                        <BaseEntityMenu<OptionValueDisplay, never>
                                            entity={row}
                                            entityKind='enumerationValue'
                                            descriptors={descriptors}
                                            namespace='metahubs'
                                            menuButtonLabelKey='flowList:menu.button'
                                            i18nInstance={i18n}
                                            createContext={createValueActionContext}
                                        />
                                    )
                                }}
                            />
                        </Box>
                    )}
                </Stack>
            )}

            <EntityFormDialog
                key={`enum-value-edit-${dialogs.edit.item?.id ?? 'none'}-${dialogs.edit.item?.version ?? 0}`}
                open={dialogs.create.open || dialogs.edit.open}
                mode='edit'
                title={
                    dialogs.edit.item
                        ? t('optionValues.editDialog.title', 'Edit enumeration value')
                        : t('optionValues.createDialog.title', 'Create value')
                }
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={dialogs.edit.item ? tc('actions.save', 'Save') : tc('actions.create', 'Create')}
                savingButtonText={dialogs.edit.item ? tc('actions.saving', 'Saving...') : tc('actions.creating', 'Creating...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={createMutation.isPending || updateMutation.isPending}
                error={dialogError || undefined}
                onClose={() => {
                    if (dialogs.edit.open) {
                        close('edit')
                    } else {
                        close('create')
                    }
                    setDialogError(null)
                }}
                onSave={handleSave}
                hideDefaultFields
                initialExtraValues={initialFormValues}
                tabs={({ values, setValue, isLoading, errors }) =>
                    renderValueTabs({
                        values,
                        setValue,
                        isLoading,
                        errors,
                        editingEntityId: dialogs.edit.item?.id ?? null
                    })
                }
                validate={validateForm}
                canSave={canSaveForm}
                showDeleteButton={Boolean(dialogs.edit.item)}
                deleteButtonText={tc('actions.delete', 'Delete')}
                deleteButtonDisabled={Boolean(dialogs.edit.item && blockingInfo && !blockingInfo.canDelete)}
                deleteButtonDisabledReason={
                    dialogs.edit.item && blockingInfo && !blockingInfo.canDelete
                        ? t(
                              'optionValues.deleteBlockedReason',
                              'Deletion is blocked because this value is used in defaults or predefined records.'
                          )
                        : undefined
                }
                onDelete={() => {
                    if (dialogs.edit.item) {
                        openDelete(dialogs.edit.item)
                        close('edit')
                    }
                }}
            />

            <EntityFormDialog
                key={`enum-value-copy-${dialogs.copy.item?.id ?? 'none'}-${dialogs.copy.item?.version ?? 0}`}
                open={dialogs.copy.open}
                mode='copy'
                title={t('optionValues.copyTitle', 'Copy Value')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={t('optionValues.copy.action', 'Copy')}
                savingButtonText={t('optionValues.copy.actionLoading', 'Copying...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={copyMutation.isPending}
                error={copyDialogError || undefined}
                onClose={() => {
                    close('copy')
                    setCopyDialogError(null)
                }}
                onSave={async (formValues: GenericFormValues) => {
                    if (!metahubId || !optionListId || !dialogs.copy.item) return
                    setCopyDialogError(null)

                    const nameVlc = formValues.nameVlc as VersionedLocalizedContent<string> | null | undefined
                    const descriptionVlc = formValues.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
                    const codenameValue = formValues.codename as VersionedLocalizedContent<string> | null | undefined
                    const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
                    const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)
                    const codenamePrimaryLocale = codenameValue?._primary ?? namePrimaryLocale ?? 'en'
                    const codenameRaw = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
                    const codename = normalizeCodenameForStyle(codenameRaw, codenameConfig.style, codenameConfig.alphabet)
                    const isDefault = Boolean(formValues.isDefault)
                    const presentation = formValues.presentation as Record<string, unknown> | undefined
                    const codenamePayload = ensureLocalizedContent(codenameValue, namePrimaryLocale ?? codenamePrimaryLocale, codename)

                    if (!nameInput || !namePrimaryLocale) {
                        setCopyDialogError(tc('crud.nameRequired', 'Name is required'))
                        return
                    }
                    if (!codename) {
                        setCopyDialogError(t('optionValues.validation.codenameRequired', 'Codename is required'))
                        return
                    }

                    copyMutation.mutate({
                        metahubId,
                        optionListId,
                        kindKey,
                        valueId: dialogs.copy.item.id,
                        data: {
                            codename: codenamePayload,
                            name: nameInput,
                            description: descriptionInput,
                            namePrimaryLocale,
                            descriptionPrimaryLocale,
                            isDefault,
                            presentation: presentation && Object.keys(presentation).length > 0 ? presentation : undefined
                        }
                    })
                    close('copy')
                }}
                hideDefaultFields
                initialExtraValues={copyInitialValues}
                tabs={({ values, setValue, isLoading, errors }) =>
                    renderValueTabs({
                        values,
                        setValue,
                        isLoading,
                        errors,
                        editingEntityId: null
                    })
                }
                validate={validateForm}
                canSave={canSaveForm}
            />

            <ConfirmDeleteDialog
                open={dialogs.delete.open}
                title={t('optionValues.deleteDialog.title', 'Delete enumeration value')}
                description={t(
                    'optionValues.deleteDialog.message',
                    'Are you sure you want to delete this enumeration value? This action cannot be undone.'
                )}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => close('delete')}
                onConfirm={() => {
                    if (!dialogs.delete.item || !metahubId || !optionListId) return
                    deleteMutation.mutate(
                        {
                            metahubId,
                            optionListId,
                            kindKey,
                            valueId: dialogs.delete.item.id
                        },
                        {
                            onError: (e: unknown) => {
                                const responseMessage = extractResponseMessage(e)
                                const message =
                                    typeof responseMessage === 'string'
                                        ? responseMessage
                                        : e instanceof Error
                                        ? e.message
                                        : typeof e === 'string'
                                        ? e
                                        : t('optionValues.deleteError', 'Failed to delete enumeration value')
                                enqueueSnackbar(message, { variant: 'error' })
                            }
                        }
                    )
                    close('delete')
                }}
                loading={deleteMutation.isPending}
            />

            {showSettingsTab &&
                enumerationForHubResolution &&
                optionListId &&
                (() => {
                    const enumDisplay: OptionListDisplayWithContainer = {
                        id: enumerationForHubResolution.id,
                        metahubId: enumerationForHubResolution.metahubId,
                        codename: enumerationForHubResolution.codename,
                        name: getVLCString(enumerationForHubResolution.name, preferredVlcLocale) || enumerationForHubResolution.codename,
                        description: getVLCString(enumerationForHubResolution.description, preferredVlcLocale) || '',
                        isSingleHub: enumerationForHubResolution.isSingleHub,
                        isRequiredHub: enumerationForHubResolution.isRequiredHub,
                        sortOrder: enumerationForHubResolution.sortOrder,
                        createdAt: enumerationForHubResolution.createdAt,
                        updatedAt: enumerationForHubResolution.updatedAt,
                        treeEntityId: enumerationForHubResolution.treeEntities?.[0]?.id,
                        treeEntities: enumerationForHubResolution.treeEntities?.map((h) => ({
                            id: h.id,
                            name: typeof h.name === 'string' ? h.name : h.codename || '',
                            codename: h.codename || ''
                        }))
                    }
                    const enumerationMap = new Map<string, OptionListEntity>([
                        [enumerationForHubResolution.id, enumerationForHubResolution]
                    ])
                    const settingsCtx: OptionListActionContext = {
                        entity: enumDisplay,
                        entityKind: 'enumeration' as const,
                        t,
                        enumerationMap,
                        metahubId,
                        currentTreeEntityId: enumerationForHubResolution.treeEntities?.[0]?.id ?? null,
                        uiLocale: preferredVlcLocale,
                        api: {
                            updateEntity: async (id: string, patch: OptionListLocalizedPayload) => {
                                if (!metahubId) return
                                updateOptionListMetaMutation.mutate({
                                    metahubId,
                                    optionListId: id,
                                    kindKey,
                                    data: { ...patch, expectedVersion: enumerationForHubResolution.version }
                                })
                            }
                        },
                        helpers: {
                            refreshList: async () => {
                                if (metahubId && optionListId) {
                                    void queryClient.invalidateQueries({
                                        queryKey: metahubsQueryKeys.optionListDetail(metahubId, optionListId, kindKey)
                                    })
                                    void queryClient.invalidateQueries({
                                        queryKey: metahubsQueryKeys.allOptionListsScope(metahubId, kindKey)
                                    })
                                    // Invalidate breadcrumb queries so page title refreshes immediately
                                    void queryClient.invalidateQueries({
                                        queryKey: ['breadcrumb', 'enumeration', metahubId, optionListId]
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
                            title={t('enumerations.editTitle', 'Edit OptionListEntity')}
                            nameLabel={tc('fields.name', 'Name')}
                            descriptionLabel={tc('fields.description', 'Description')}
                            saveButtonText={tc('actions.save', 'Save')}
                            savingButtonText={tc('actions.saving', 'Saving...')}
                            cancelButtonText={tc('actions.cancel', 'Cancel')}
                            hideDefaultFields
                            initialExtraValues={buildEnumInitialValues(settingsCtx)}
                            tabs={buildEnumFormTabs(settingsCtx, allTreeEntities, optionListId)}
                            validate={(values) => validateOptionListForm(settingsCtx, values)}
                            canSave={canSaveOptionListForm}
                            onSave={async (data) => {
                                const payload = enumToPayload(data)
                                await settingsCtx.api?.updateEntity?.(enumerationForHubResolution.id, payload)
                                await settingsCtx.helpers?.refreshList?.()
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

const SelectableOptionList = () => <SelectableOptionListContent />

export default SelectableOptionList
