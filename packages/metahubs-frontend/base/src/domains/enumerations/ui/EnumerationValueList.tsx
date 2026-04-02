import { useCallback, useMemo, useState, type ChangeEvent } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Divider, Stack, Switch, FormControlLabel, Tabs, Tab, Tooltip, Typography } from '@mui/material'
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
import { ConfirmDeleteDialog, EntityFormDialog } from '@universo/template-mui/components/dialogs'
import type { VersionedLocalizedContent } from '@universo/types'
import type { ActionDescriptor, ActionContext, DragEndEvent } from '@universo/template-mui'
import {
    buildInitialValues as buildEnumInitialValues,
    buildFormTabs as buildEnumFormTabs,
    validateEnumerationForm,
    canSaveEnumerationForm,
    toPayload as enumToPayload
} from './EnumerationActions'
import type { EnumerationActionContext, EnumerationDisplayWithHub } from './EnumerationActions'
import { useUpdateEnumerationAtMetahub } from '../hooks'
import { useMetahubHubs } from '../../hubs/hooks'
import { useMetahubPrimaryLocale } from '../../settings/hooks/useMetahubPrimaryLocale'
import type { EnumerationValue, EnumerationValueDisplay, Enumeration, EnumerationLocalizedPayload } from '../../../types'
import { getVLCString, toEnumerationValueDisplay } from '../../../types'
import {
    normalizeLocale,
    extractLocalizedInput,
    hasPrimaryContent,
    ensureLocalizedContent,
    ensureEntityCodenameContent
} from '../../../utils/localizedInput'
import { sanitizeCodenameForStyle, normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../utils/codename'
import { useCodenameConfig } from '../../settings/hooks/useCodenameConfig'
import { CodenameField, ExistingCodenamesProvider } from '../../../components'
import { getEnumerationValueBlockingReferences, getEnumerationById, listEnumerationValues } from '../api'
import {
    useCopyEnumerationValue,
    useCreateEnumerationValue,
    useDeleteEnumerationValue,
    useMoveEnumerationValue,
    useReorderEnumerationValue,
    useUpdateEnumerationValue
} from '../hooks'
import { metahubsQueryKeys } from '../../shared'
import { DragOverlayValueRow } from './dnd'

type ValueFormValues = {
    nameVlc: VersionedLocalizedContent<string> | null
    descriptionVlc: VersionedLocalizedContent<string> | null
    codename: VersionedLocalizedContent<string> | null
    codenameTouched?: boolean
    isDefault?: boolean
}

type CopyValueFormValues = {
    nameVlc: VersionedLocalizedContent<string> | null
    descriptionVlc: VersionedLocalizedContent<string> | null
    codename: VersionedLocalizedContent<string> | null
    codenameTouched?: boolean
    isDefault?: boolean
}

type GenericFormValues = Record<string, unknown>

type ValueActionContext = ActionContext<EnumerationValueDisplay, never> & {
    valueMap: Map<string, EnumerationValue>
    valueOrderMap: Map<string, number>
    valueCount: number
    openEditDialog: (value: EnumerationValue) => void
    openDeleteDialog: (value: EnumerationValue) => void
    setDefaultValue: (value: EnumerationValue) => Promise<void>
    clearDefaultValue: (value: EnumerationValue) => Promise<void>
    moveValue: (value: EnumerationValue, direction: 'up' | 'down') => Promise<void>
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
                        label={translate('enumerationValues.isDefault', 'Default value')}
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
                label={translate('enumerationValues.codename', 'Codename')}
                helperText={translate('enumerationValues.codenameHelper', 'Unique identifier')}
                error={errors.codename}
                disabled={isLoading}
                required
                editingEntityId={editingEntityId}
            />
        </Stack>
    )
}

const EnumerationValueList = () => {
    const codenameConfig = useCodenameConfig()
    const { metahubId, enumerationId } = useParams<{ metahubId: string; enumerationId: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()
    const { enqueueSnackbar } = useSnackbar()

    const [search, setSearch] = useState('')
    const { dialogs, openCreate, openEdit, openCopy, openDelete, close } = useListDialogs<EnumerationValue>()
    const [dialogError, setDialogError] = useState<string | null>(null)
    const pendingInteractionMessage = tc('pendingCreateBlocked', 'This item is still being created. Please wait a moment and try again.')

    const createMutation = useCreateEnumerationValue()
    const updateMutation = useUpdateEnumerationValue()
    const deleteMutation = useDeleteEnumerationValue()
    const moveMutation = useMoveEnumerationValue()
    const copyMutation = useCopyEnumerationValue()
    const reorderMutation = useReorderEnumerationValue()

    const preferredVlcLocale = useMetahubPrimaryLocale()
    const updateEnumMutation = useUpdateEnumerationAtMetahub()
    const queryClient = useQueryClient()
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    // DnD: Handle value reorder
    const handleValueReorder = useCallback(
        async (valueId: string, newSortOrder: number) => {
            if (!metahubId || !enumerationId) return
            try {
                await reorderMutation.mutateAsync({
                    metahubId,
                    enumerationId,
                    valueId,
                    newSortOrder
                })
                enqueueSnackbar(t('enumerationValues.reorderSuccess', 'Value order updated'), { variant: 'success' })
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : t('enumerationValues.reorderError', 'Failed to reorder value')
                enqueueSnackbar(message, { variant: 'error' })
            }
        },
        [metahubId, enumerationId, reorderMutation, enqueueSnackbar, t]
    )

    const {
        data: valuesResponse,
        isLoading,
        error
    } = useQuery({
        queryKey: metahubId && enumerationId ? metahubsQueryKeys.enumerationValuesList(metahubId, enumerationId) : ['empty'],
        queryFn: () => listEnumerationValues(metahubId!, enumerationId!),
        enabled: Boolean(metahubId && enumerationId)
    })

    const values = useMemo(() => valuesResponse?.items ?? [], [valuesResponse?.items])

    // Fetch parent enumeration for Settings edit dialog
    const { data: enumerationForHubResolution } = useQuery({
        queryKey:
            metahubId && enumerationId
                ? metahubsQueryKeys.enumerationDetail(metahubId, enumerationId)
                : ['metahubs', 'enumerations', 'detail', 'empty'],
        queryFn: async () => {
            if (!metahubId || !enumerationId) throw new Error('metahubId and enumerationId are required')
            return getEnumerationById(metahubId, enumerationId)
        },
        enabled: !!metahubId && !!enumerationId
    })

    // Hubs for the Settings edit dialog (shared hook — staleTime: 5min, deduplication via same queryKey)
    const allHubs = useMetahubHubs(metahubId)

    const [copyDialogError, setCopyDialogError] = useState<string | null>(null)

    const { data: blockingInfo } = useQuery({
        queryKey:
            metahubId && enumerationId && dialogs.edit.item?.id
                ? ['metahubs', 'enumerationValueBlockingRefs', metahubId, enumerationId, dialogs.edit.item.id]
                : ['metahubs', 'enumerationValueBlockingRefs', 'empty'],
        queryFn: () => getEnumerationValueBlockingReferences(metahubId!, enumerationId!, dialogs.edit.item!.id),
        enabled: Boolean(metahubId && enumerationId && dialogs.edit.item?.id)
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
    const sortedFilteredValues = useMemo(
        () => [...filteredValues].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
        [filteredValues]
    )

    // DnD: Handle drag end event (from FlowListTable InternalDndWrapper)
    const handleDragEnd = useCallback(
        async (event: DragEndEvent) => {
            const { active, over } = event
            if (!over || active.id === over.id) return

            const oldIndex = sortedFilteredValues.findIndex((v) => v.id === String(active.id))
            const overIndex = sortedFilteredValues.findIndex((v) => v.id === String(over.id))
            if (oldIndex === -1 || overIndex === -1) return

            const newSortOrder = sortedFilteredValues[overIndex].sortOrder ?? overIndex + 1
            await handleValueReorder(String(active.id), newSortOrder)
        },
        [sortedFilteredValues, handleValueReorder]
    )

    // DnD: Render drag overlay
    const renderDragOverlay = useCallback(
        (activeId: string | null) => {
            if (!activeId) return null
            const val = sortedFilteredValues.find((v) => v.id === activeId)
            if (!val) return null
            return <DragOverlayValueRow value={toEnumerationValueDisplay(val, i18n.language)} />
        },
        [sortedFilteredValues, i18n.language]
    )

    const tableData = useMemo<EnumerationValueDisplay[]>(
        () =>
            filteredValues
                .map((value) => toEnumerationValueDisplay(value, i18n.language))
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
        [filteredValues, i18n.language]
    )

    const valueMap = useMemo(() => new Map(values.map((value) => [value.id, value])), [values])

    const handlePendingValueInteraction = useCallback(
        (valueId: string) => {
            if (!metahubId || !enumerationId) return
            revealPendingEntityFeedback({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.enumerationValues(metahubId, enumerationId),
                entityId: valueId
            })
            enqueueSnackbar(pendingInteractionMessage, { variant: 'info' })
        },
        [enqueueSnackbar, enumerationId, metahubId, pendingInteractionMessage, queryClient]
    )
    const valueOrderMap = useMemo(() => {
        const sortedIds = values
            .slice()
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id))
            .map((item) => item.id)
        return new Map(sortedIds.map((id, index) => [id, index]))
    }, [values])
    const createValueActionContext = useCallback(
        (base: Partial<ActionContext<EnumerationValueDisplay, never>>): ValueActionContext => ({
            ...(base as ActionContext<EnumerationValueDisplay, never>),
            valueMap,
            valueOrderMap,
            valueCount: values.length,
            openEditDialog: (value: EnumerationValue) => {
                setDialogError(null)
                openEdit(value)
            },
            openDeleteDialog: (value: EnumerationValue) => {
                openDelete(value)
            },
            setDefaultValue: async (value: EnumerationValue) => {
                if (!metahubId || !enumerationId) return
                if (value.isDefault) return
                updateMutation.mutate({
                    metahubId,
                    enumerationId,
                    valueId: value.id,
                    data: {
                        isDefault: true,
                        expectedVersion: value.version
                    }
                })
            },
            clearDefaultValue: async (value: EnumerationValue) => {
                if (!metahubId || !enumerationId) return
                if (!value.isDefault) return
                updateMutation.mutate({
                    metahubId,
                    enumerationId,
                    valueId: value.id,
                    data: {
                        isDefault: false,
                        expectedVersion: value.version
                    }
                })
            },
            moveValue: async (value: EnumerationValue, direction: 'up' | 'down') => {
                if (!metahubId || !enumerationId) return
                await moveMutation.mutateAsync({
                    metahubId,
                    enumerationId,
                    valueId: value.id,
                    direction
                })
            }
        }),
        [valueMap, valueOrderMap, values.length, metahubId, enumerationId, updateMutation, moveMutation]
    )
    const toValueActionContext = useCallback((ctx: ActionContext<EnumerationValueDisplay, never>) => ctx as ValueActionContext, [])

    const valueActions = useMemo<ActionDescriptor<EnumerationValueDisplay, never>[]>(
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
                labelKey: 'enumerationValues.actions.setDefault',
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
                labelKey: 'enumerationValues.actions.clearDefault',
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
                labelKey: 'attributes.actions.moveUp',
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
                labelKey: 'attributes.actions.moveDown',
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
        [toValueActionContext]
    )

    const valueColumns = useMemo(
        () => [
            {
                id: 'sortOrder',
                label: t('attributes.table.order', '#'),
                width: '4%',
                align: 'center' as const,
                render: (row: EnumerationValueDisplay) => (
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{row.sortOrder ?? 0}</Typography>
                )
            },
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '30%',
                align: 'left' as const,
                render: (row: EnumerationValueDisplay) => (
                    <Stack direction='row' spacing={0.5} alignItems='center'>
                        {row.isDefault && (
                            <Tooltip title={t('enumerationValues.defaultTooltip', 'This value is used by default.')} arrow>
                                <StarIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                            </Tooltip>
                        )}
                        <Typography sx={{ fontSize: 14, fontWeight: 500, wordBreak: 'break-word' }}>{row.name || '—'}</Typography>
                    </Stack>
                )
            },
            {
                id: 'description',
                label: tc('table.description', 'Description'),
                width: '30%',
                align: 'left' as const,
                render: (row: EnumerationValueDisplay) => (
                    <Typography sx={{ fontSize: 14, wordBreak: 'break-word' }}>{row.description || '—'}</Typography>
                )
            },
            {
                id: 'codename',
                label: t('enumerationValues.codename', 'Codename'),
                width: '20%',
                align: 'left' as const,
                render: (row: EnumerationValueDisplay) => (
                    <Typography sx={{ fontSize: 14, fontWeight: 600, fontFamily: 'monospace' }}>{row.codename}</Typography>
                )
            }
        ],
        [t, tc]
    )

    const formDefaults = useMemo<ValueFormValues>(
        () => ({
            nameVlc: null,
            descriptionVlc: null,
            codename: null,
            codenameTouched: false,
            isDefault: false
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
            isDefault: dialogs.edit.item.isDefault ?? false
        }
    }, [dialogs.edit.item, formDefaults, i18n.language])

    const copyInitialValues = useMemo<CopyValueFormValues>(() => {
        if (!dialogs.copy.item) {
            return {
                nameVlc: null,
                descriptionVlc: null,
                codename: null,
                codenameTouched: false,
                isDefault: false
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
            isDefault: false
        }
    }, [codenameConfig.alphabet, codenameConfig.style, dialogs.copy.item, i18n.language])

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
            errors.codename = t('enumerationValues.validation.codenameRequired', 'Codename is required')
        } else if (!isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)) {
            errors.codename = t('enumerationValues.validation.codenameInvalid', 'Codename contains invalid characters')
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
        if (!metahubId || !enumerationId) return
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
        const codenamePayload = ensureLocalizedContent(codenameValue, namePrimaryLocale ?? codenamePrimaryLocale, codename)

        if (!nameInput || !namePrimaryLocale) {
            setDialogError(tc('crud.nameRequired', 'Name is required'))
            return
        }
        if (!codename) {
            setDialogError(t('enumerationValues.validation.codenameRequired', 'Codename is required'))
            return
        }

        if (!dialogs.edit.item) {
            createMutation.mutate({
                metahubId,
                enumerationId,
                data: {
                    codename: codenamePayload,
                    name: nameInput,
                    description: descriptionInput,
                    namePrimaryLocale,
                    descriptionPrimaryLocale,
                    isDefault
                }
            })

            close('create')
            setDialogError(null)
            return
        }

        const currentEditingValue = dialogs.edit.item
        close('edit')
        setDialogError(null)

        updateMutation.mutate(
            {
                metahubId,
                enumerationId,
                valueId: currentEditingValue.id,
                data: {
                    codename: codenamePayload,
                    name: nameInput,
                    description: descriptionInput,
                    namePrimaryLocale,
                    descriptionPrimaryLocale,
                    isDefault,
                    expectedVersion: currentEditingValue.version
                }
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
                            : t('enumerationValues.updateError', 'Failed to update enumeration value')

                    openEdit(currentEditingValue)
                    setDialogError(message)
                }
            }
        )
    }

    if (!metahubId || !enumerationId) {
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
    return (
        <MainCard
            sx={{ maxWidth: '100%', width: '100%' }}
            contentSX={{ px: 0, py: 0 }}
            disableContentPadding
            disableHeader
            border={false}
            shadow={false}
        >
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
                            searchPlaceholder={t('enumerationValues.searchPlaceholder', 'Search enumeration values...')}
                            onSearchChange={(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setSearch(e.target.value)}
                            title={t('enumerationValues.title', 'Values')}
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
                                <Tab value='values' label={t('enumerationValues.title', 'Values')} />
                                <Tab value='settings' label={t('settings.title')} />
                            </Tabs>
                        </Box>

                        {!isBusy && tableData.length === 0 ? (
                            <EmptyListState
                                image={APIEmptySVG}
                                imageAlt='No enumeration values'
                                title={t('enumerationValues.empty', 'No values yet')}
                                description={t(
                                    'enumerationValues.emptyDescription',
                                    'Add values to define available options in this enumeration'
                                )}
                            />
                        ) : (
                            <Box sx={{ mx: { xs: -1.5, md: -2 } }}>
                                <FlowListTable<EnumerationValueDisplay>
                                    data={tableData}
                                    customColumns={valueColumns}
                                    onPendingInteractionAttempt={(row: EnumerationValueDisplay) => handlePendingValueInteraction(row.id)}
                                    sortableRows
                                    sortableItemIds={sortedFilteredValues.map((v) => v.id)}
                                    dragHandleAriaLabel={t('enumerationValues.dnd.dragHandle', 'Drag to reorder')}
                                    dragDisabled={isBusy}
                                    onSortableDragEnd={handleDragEnd}
                                    renderDragOverlay={renderDragOverlay}
                                    renderActions={(row: EnumerationValueDisplay) => (
                                        <BaseEntityMenu<EnumerationValueDisplay, never>
                                            entity={row}
                                            entityKind='enumerationValue'
                                            descriptors={valueActions}
                                            namespace='metahubs'
                                            menuButtonLabelKey='flowList:menu.button'
                                            i18nInstance={i18n}
                                            createContext={createValueActionContext}
                                        />
                                    )}
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
                            ? t('enumerationValues.editDialog.title', 'Edit enumeration value')
                            : t('enumerationValues.createDialog.title', 'Create value')
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
                    extraFields={({
                        values,
                        setValue,
                        isLoading,
                        errors
                    }: {
                        values: Record<string, unknown>
                        setValue: (name: string, value: unknown) => void
                        isLoading: boolean
                        errors: Record<string, string>
                    }) => (
                        <ValueFormFields
                            values={values}
                            setValue={setValue}
                            isLoading={isLoading}
                            errors={errors ?? {}}
                            uiLocale={i18n.language}
                            translate={(key, defaultValue) => t(key, defaultValue ? { defaultValue } : {})}
                            editingEntityId={dialogs.edit.item?.id}
                        />
                    )}
                    validate={validateForm}
                    canSave={canSaveForm}
                    showDeleteButton={Boolean(dialogs.edit.item)}
                    deleteButtonText={tc('actions.delete', 'Delete')}
                    deleteButtonDisabled={Boolean(dialogs.edit.item && blockingInfo && !blockingInfo.canDelete)}
                    deleteButtonDisabledReason={
                        dialogs.edit.item && blockingInfo && !blockingInfo.canDelete
                            ? t(
                                  'enumerationValues.deleteBlockedReason',
                                  'Deletion is blocked because this value is used in defaults or predefined elements.'
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
                    title={t('enumerationValues.copyTitle', 'Copy Value')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={t('enumerationValues.copy.action', 'Copy')}
                    savingButtonText={t('enumerationValues.copy.actionLoading', 'Copying...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    loading={copyMutation.isPending}
                    error={copyDialogError || undefined}
                    onClose={() => {
                        close('copy')
                        setCopyDialogError(null)
                    }}
                    onSave={async (formValues: GenericFormValues) => {
                        if (!metahubId || !enumerationId || !dialogs.copy.item) return
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
                        const codenamePayload = ensureLocalizedContent(codenameValue, namePrimaryLocale ?? codenamePrimaryLocale, codename)

                        if (!nameInput || !namePrimaryLocale) {
                            setCopyDialogError(tc('crud.nameRequired', 'Name is required'))
                            return
                        }
                        if (!codename) {
                            setCopyDialogError(t('enumerationValues.validation.codenameRequired', 'Codename is required'))
                            return
                        }

                        copyMutation.mutate({
                            metahubId,
                            enumerationId,
                            valueId: dialogs.copy.item.id,
                            data: {
                                codename: codenamePayload,
                                name: nameInput,
                                description: descriptionInput,
                                namePrimaryLocale,
                                descriptionPrimaryLocale,
                                isDefault
                            }
                        })
                        close('copy')
                    }}
                    hideDefaultFields
                    initialExtraValues={copyInitialValues}
                    extraFields={({
                        values,
                        setValue,
                        isLoading,
                        errors
                    }: {
                        values: Record<string, unknown>
                        setValue: (name: string, value: unknown) => void
                        isLoading: boolean
                        errors: Record<string, string>
                    }) => (
                        <ValueFormFields
                            values={values}
                            setValue={setValue}
                            isLoading={isLoading}
                            errors={errors ?? {}}
                            uiLocale={i18n.language}
                            translate={(key, defaultValue) => t(key, defaultValue ? { defaultValue } : {})}
                            editingEntityId={null}
                        />
                    )}
                    validate={validateForm}
                    canSave={canSaveForm}
                />

                <ConfirmDeleteDialog
                    open={dialogs.delete.open}
                    title={t('enumerationValues.deleteDialog.title', 'Delete enumeration value')}
                    description={t(
                        'enumerationValues.deleteDialog.message',
                        'Are you sure you want to delete this enumeration value? This action cannot be undone.'
                    )}
                    confirmButtonText={tc('actions.delete', 'Delete')}
                    deletingButtonText={tc('actions.deleting', 'Deleting...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onCancel={() => close('delete')}
                    onConfirm={() => {
                        if (!dialogs.delete.item || !metahubId || !enumerationId) return
                        deleteMutation.mutate(
                            {
                                metahubId,
                                enumerationId,
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
                                            : t('enumerationValues.deleteError', 'Failed to delete enumeration value')
                                    enqueueSnackbar(message, { variant: 'error' })
                                }
                            }
                        )
                        close('delete')
                    }}
                    loading={deleteMutation.isPending}
                />

                {/* Settings edit dialog overlay for parent enumeration */}
                {enumerationForHubResolution &&
                    enumerationId &&
                    (() => {
                        const enumDisplay: EnumerationDisplayWithHub = {
                            id: enumerationForHubResolution.id,
                            metahubId: enumerationForHubResolution.metahubId,
                            codename: enumerationForHubResolution.codename,
                            name:
                                getVLCString(enumerationForHubResolution.name, preferredVlcLocale) || enumerationForHubResolution.codename,
                            description: getVLCString(enumerationForHubResolution.description, preferredVlcLocale) || '',
                            isSingleHub: enumerationForHubResolution.isSingleHub,
                            isRequiredHub: enumerationForHubResolution.isRequiredHub,
                            sortOrder: enumerationForHubResolution.sortOrder,
                            createdAt: enumerationForHubResolution.createdAt,
                            updatedAt: enumerationForHubResolution.updatedAt,
                            hubId: enumerationForHubResolution.hubs?.[0]?.id,
                            hubs: enumerationForHubResolution.hubs?.map((h) => ({
                                id: h.id,
                                name: typeof h.name === 'string' ? h.name : h.codename || '',
                                codename: h.codename || ''
                            }))
                        }
                        const enumerationMap = new Map<string, Enumeration>([[enumerationForHubResolution.id, enumerationForHubResolution]])
                        const settingsCtx: EnumerationActionContext = {
                            entity: enumDisplay,
                            entityKind: 'enumeration' as const,
                            t,
                            enumerationMap,
                            currentHubId: enumerationForHubResolution.hubs?.[0]?.id ?? null,
                            uiLocale: preferredVlcLocale,
                            api: {
                                updateEntity: async (id: string, patch: EnumerationLocalizedPayload) => {
                                    if (!metahubId) return
                                    updateEnumMutation.mutate({
                                        metahubId,
                                        enumerationId: id,
                                        data: { ...patch, expectedVersion: enumerationForHubResolution.version }
                                    })
                                }
                            },
                            helpers: {
                                refreshList: async () => {
                                    if (metahubId && enumerationId) {
                                        void queryClient.invalidateQueries({
                                            queryKey: metahubsQueryKeys.enumerationDetail(metahubId, enumerationId)
                                        })
                                        void queryClient.invalidateQueries({
                                            queryKey: metahubsQueryKeys.allEnumerations(metahubId)
                                        })
                                        // Invalidate breadcrumb queries so page title refreshes immediately
                                        void queryClient.invalidateQueries({
                                            queryKey: ['breadcrumb', 'enumeration', metahubId, enumerationId]
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
                                title={t('enumerations.editTitle', 'Edit Enumeration')}
                                nameLabel={tc('fields.name', 'Name')}
                                descriptionLabel={tc('fields.description', 'Description')}
                                saveButtonText={tc('actions.save', 'Save')}
                                savingButtonText={tc('actions.saving', 'Saving...')}
                                cancelButtonText={tc('actions.cancel', 'Cancel')}
                                hideDefaultFields
                                initialExtraValues={buildEnumInitialValues(settingsCtx)}
                                tabs={buildEnumFormTabs(settingsCtx, allHubs, enumerationId)}
                                validate={(values) => validateEnumerationForm(settingsCtx, values)}
                                canSave={canSaveEnumerationForm}
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
        </MainCard>
    )
}

export default EnumerationValueList
