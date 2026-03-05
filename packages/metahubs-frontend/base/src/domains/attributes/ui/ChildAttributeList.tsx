import { useState, useMemo, useCallback, useEffect } from 'react'
import { Box, Stack, Typography, Chip, Skeleton, Alert, Tooltip, Button } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import StarIcon from '@mui/icons-material/Star'
import StarOutlineIcon from '@mui/icons-material/StarOutline'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { EntityFormDialog, ConfirmDeleteDialog, type TabConfig } from '@universo/template-mui/components/dialogs'
import { BaseEntityMenu, notifyError, FlowListTable } from '@universo/template-mui'
import type { ActionDescriptor, ActionContext } from '@universo/template-mui'
import type { VersionedLocalizedContent, MetaEntityKind } from '@universo/types'
import { TABLE_CHILD_DATA_TYPES } from '@universo/types'
import type { AttributeDataType } from '../../../types'
import {
    Attribute,
    AttributeDisplay,
    AttributeLocalizedPayload,
    AttributeValidationRules,
    toAttributeDisplay,
    getDefaultValidationRules,
    getPhysicalDataType,
    formatPhysicalType
} from '../../../types'
import { normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../utils/codename'
import { useCodenameConfig } from '../../settings/hooks/useCodenameConfig'
import { useSettingValue } from '../../settings/hooks/useSettings'
import { useMetahubPrimaryLocale } from '../../settings/hooks/useMetahubPrimaryLocale'
import { extractLocalizedInput, hasPrimaryContent, ensureLocalizedContent, normalizeLocale } from '../../../utils/localizedInput'
import * as attributesApi from '../api'
import { metahubsQueryKeys, invalidateAttributesQueries } from '../../shared'
import {
    useCopyAttribute,
    useMoveAttribute,
    useToggleAttributeRequired,
    useSetDisplayAttribute,
    useClearDisplayAttribute
} from '../hooks/mutations'
import AttributeFormFields, { PresentationTabFields } from './AttributeFormFields'
import { useContainerRegistry, useAttributeDndState } from './dnd'
import { ExistingCodenamesProvider } from '../../../components'

type GenericFormValues = Record<string, unknown>

type ChildAttributeContextExtras = {
    moveAttribute?: (id: string, direction: 'up' | 'down') => Promise<void>
    toggleRequired?: (id: string, value: boolean) => Promise<void>
    toggleDisplayAttribute?: (id: string, value: boolean) => Promise<void>
}

const extractResponseMessage = (error: unknown): string | undefined => {
    if (!error || typeof error !== 'object' || !('response' in error)) return undefined
    const response = (error as { response?: unknown }).response
    if (!response || typeof response !== 'object') return undefined
    const data = (response as { data?: unknown }).data
    if (!data || typeof data !== 'object') return undefined
    const message = (data as { message?: unknown }).message
    return typeof message === 'string' ? message : undefined
}

const extractResponseData = (error: unknown): Record<string, unknown> | undefined => {
    if (!error || typeof error !== 'object' || !('response' in error)) return undefined
    const response = (error as { response?: unknown }).response
    if (!response || typeof response !== 'object') return undefined
    const data = (response as { data?: unknown }).data
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : undefined
}

const extractResponseCode = (error: unknown): string | undefined => {
    const data = extractResponseData(error)
    const code = data?.code
    return typeof code === 'string' ? code : undefined
}

const extractResponseMaxChildAttributes = (error: unknown): number | undefined => {
    const data = extractResponseData(error)
    const max = data?.maxChildAttributes
    return typeof max === 'number' && Number.isFinite(max) ? max : undefined
}

const extractResponseMaxTableAttributes = (error: unknown): number | undefined => {
    const data = extractResponseData(error)
    const max = data?.maxTableAttributes
    return typeof max === 'number' && Number.isFinite(max) ? max : undefined
}

const getDisplayAttributeFlag = (row: AttributeDisplay): boolean => Boolean((row as { isDisplayAttribute?: boolean }).isDisplayAttribute)

function localizeTableValidationError(
    error: unknown,
    t: (key: string, defaultValue: string, opts?: Record<string, unknown>) => string,
    maxChildAttributesFallback?: number | null
): string | null {
    const code = extractResponseCode(error)
    if (!code) return null
    if (code === 'NESTED_TABLE_FORBIDDEN') {
        return t('attributes.tableValidation.nestedTableNotAllowed', 'Nested TABLE attributes are not allowed')
    }
    if (code === 'TABLE_CHILD_LIMIT_REACHED') {
        const max = extractResponseMaxChildAttributes(error)
        return t('attributes.tableValidation.maxChildAttributes', 'Maximum {{max}} child attributes per TABLE', {
            max: max ?? maxChildAttributesFallback ?? '—'
        })
    }
    if (code === 'TABLE_ATTRIBUTE_LIMIT_REACHED') {
        const max = extractResponseMaxTableAttributes(error)
        return t('attributes.tableValidation.maxTableAttributes', 'Maximum {{max}} TABLE attributes per catalog', { max: max ?? '—' })
    }
    if (code === 'TABLE_DISPLAY_ATTRIBUTE_FORBIDDEN') {
        return t('attributes.tableValidation.tableCannotBeDisplay', 'TABLE attributes cannot be set as the display attribute')
    }
    return null
}

const sanitizeChildAttributeUiConfig = (
    dataType: AttributeDataType,
    targetEntityKind: MetaEntityKind | null | undefined,
    sourceUiConfig: Record<string, unknown>
): Record<string, unknown> => {
    const nextUiConfig = { ...sourceUiConfig }
    const isEnumerationRef = dataType === 'REF' && targetEntityKind === 'enumeration'

    if (!isEnumerationRef) {
        delete nextUiConfig.enumPresentationMode
        delete nextUiConfig.defaultEnumValueId
        delete nextUiConfig.enumAllowEmpty
        delete nextUiConfig.enumLabelEmptyDisplay
        return nextUiConfig
    }

    if (
        nextUiConfig.enumPresentationMode !== 'select' &&
        nextUiConfig.enumPresentationMode !== 'radio' &&
        nextUiConfig.enumPresentationMode !== 'label'
    ) {
        nextUiConfig.enumPresentationMode = 'select'
    }

    if (
        'defaultEnumValueId' in nextUiConfig &&
        nextUiConfig.defaultEnumValueId !== null &&
        typeof nextUiConfig.defaultEnumValueId !== 'string'
    ) {
        delete nextUiConfig.defaultEnumValueId
    }

    if (typeof nextUiConfig.enumAllowEmpty !== 'boolean') {
        nextUiConfig.enumAllowEmpty = true
    }

    if (nextUiConfig.enumLabelEmptyDisplay !== 'empty' && nextUiConfig.enumLabelEmptyDisplay !== 'dash') {
        nextUiConfig.enumLabelEmptyDisplay = 'dash'
    }

    return nextUiConfig
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
        locales: nextLocales
    }
}

/** Map data type to MUI Chip color */
const getDataTypeColor = (
    dataType: AttributeDataType | string
): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' => {
    switch (dataType) {
        case 'STRING':
            return 'primary'
        case 'NUMBER':
            return 'secondary'
        case 'BOOLEAN':
            return 'success'
        case 'DATE':
            return 'warning'
        case 'REF':
            return 'info'
        case 'JSON':
            return 'default'
        case 'TABLE':
            return 'warning'
        default:
            return 'default'
    }
}

interface ChildAttributeListProps {
    metahubId: string
    hubId?: string
    catalogId: string
    parentAttributeId: string
    parentMaxChildAttributes?: number | null
    /** When set, only children matching this search term are shown */
    searchFilter?: string
    onRefresh?: () => void
}

const ChildAttributeList = ({
    metahubId,
    hubId,
    catalogId,
    parentAttributeId,
    parentMaxChildAttributes,
    searchFilter,
    onRefresh
}: ChildAttributeListProps) => {
    const codenameConfig = useCodenameConfig()
    const preferredVlcLocale = useMetahubPrimaryLocale()
    const attributeCodenameScope = useSettingValue<string>('catalogs.attributeCodenameScope') ?? 'per-level'
    const allowedAttributeTypesSetting = useSettingValue<string[]>('catalogs.allowedAttributeTypes')
    const allowAttributeCopySetting = useSettingValue<boolean>('catalogs.allowAttributeCopy')
    const allowAttributeDeleteSetting = useSettingValue<boolean>('catalogs.allowAttributeDelete')
    const allowDeleteLastDisplayAttributeSetting = useSettingValue<boolean>('catalogs.allowDeleteLastDisplayAttribute')
    const allowAttributeCopy = allowAttributeCopySetting !== false
    const allowAttributeDelete = allowAttributeDeleteSetting !== false
    const allowDeleteLastDisplayAttribute = allowDeleteLastDisplayAttributeSetting !== false
    const { t, i18n } = useTranslation(['metahubs', 'common'])
    const { t: tc } = useCommonTranslations()
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)
    const [editState, setEditState] = useState<{ open: boolean; attribute: Attribute | null }>({
        open: false,
        attribute: null
    })
    const [isUpdating, setUpdating] = useState(false)
    const [editDialogError, setEditDialogError] = useState<string | null>(null)
    const [copyState, setCopyState] = useState<{ open: boolean; attribute: Attribute | null }>({
        open: false,
        attribute: null
    })
    const [isCopying, setCopying] = useState(false)
    const [copyDialogError, setCopyDialogError] = useState<string | null>(null)
    const [deleteState, setDeleteState] = useState<{ open: boolean; attribute: Attribute | null }>({
        open: false,
        attribute: null
    })

    // Mutation hooks for child attribute actions
    const moveAttributeMutation = useMoveAttribute()
    const copyAttributeMutation = useCopyAttribute()
    const toggleRequiredMutation = useToggleAttributeRequired()
    const setDisplayAttributeMutation = useSetDisplayAttribute()
    const clearDisplayAttributeMutation = useClearDisplayAttribute()

    const queryKey = useMemo(
        () => ['metahubs', 'childAttributes', metahubId, catalogId, parentAttributeId] as const,
        [metahubId, catalogId, parentAttributeId]
    )

    const { data, isLoading, error } = useQuery({
        queryKey,
        queryFn: async () => {
            if (hubId) {
                return attributesApi.listChildAttributes(metahubId, hubId, catalogId, parentAttributeId)
            }
            return attributesApi.listChildAttributesDirect(metahubId, catalogId, parentAttributeId)
        },
        enabled: !!metahubId && !!catalogId && !!parentAttributeId
    })

    const childAttributes = useMemo(() => data?.items ?? [], [data?.items])
    const maxChildAttributesLimit =
        typeof parentMaxChildAttributes === 'number' && parentMaxChildAttributes > 0 ? parentMaxChildAttributes : null
    const isChildLimitReached = maxChildAttributesLimit !== null && childAttributes.length >= maxChildAttributesLimit

    // When attributeCodenameScope is 'global', fetch ALL attribute codenames (root + children)
    // to enable cross-level duplicate checking in the UI
    const isGlobalScope = attributeCodenameScope === 'global'
    const { data: globalCodenamesData } = useQuery({
        queryKey: metahubsQueryKeys.allAttributeCodenames(metahubId, catalogId),
        queryFn: () => attributesApi.listAllAttributeCodenames(metahubId, catalogId),
        enabled: isGlobalScope && !!metahubId && !!catalogId
    })
    const codenameEntities = isGlobalScope && globalCodenamesData?.items ? globalCodenamesData.items : childAttributes

    /** Map from attribute id to full Attribute for quick context lookups */
    const childAttributeMap = useMemo(() => {
        const map = new Map<string, Attribute>()
        childAttributes.forEach((attr) => map.set(attr.id, attr))
        return map
    }, [childAttributes])

    // DnD: Register this child list as a droppable container
    const containerId = `child-${parentAttributeId}`
    const { register, unregister } = useContainerRegistry()
    const { activeContainerId, overContainerId, pendingTransfer, activeAttribute: dndActiveAttr } = useAttributeDndState()
    const isDropTarget = overContainerId === containerId && activeContainerId !== null && activeContainerId !== containerId
    const isInvalidDropTarget = isDropTarget && isChildLimitReached
    useEffect(() => {
        register({
            id: containerId,
            parentAttributeId,
            items: childAttributes
        })
        return () => unregister(containerId)
    }, [containerId, parentAttributeId, childAttributes, register, unregister])

    /** Invalidate both child-specific and parent-level queries */
    const invalidateChildQueries = useCallback(async () => {
        queryClient.invalidateQueries({ queryKey })
        // Also invalidate element-scoped child attribute & enum caches so stale uiConfig is refreshed
        queryClient.invalidateQueries({ queryKey: ['metahubs', 'childAttributesForElements', metahubId, catalogId] })
        queryClient.invalidateQueries({ queryKey: ['metahubs', 'childEnumValues', metahubId] })
        // Invalidate global codenames cache (for global scope duplicate checking)
        invalidateAttributesQueries.allCodenames(queryClient, metahubId, catalogId)
        if (hubId) {
            await invalidateAttributesQueries.all(queryClient, metahubId, hubId, catalogId)
        } else {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesDirect(metahubId, catalogId) })
        }
        onRefresh?.()
    }, [queryClient, queryKey, hubId, metahubId, catalogId, onRefresh])

    const deleteMutation = useMutation({
        mutationFn: async (attributeId: string) => {
            if (hubId) {
                return attributesApi.deleteAttribute(metahubId, hubId, catalogId, attributeId)
            }
            return attributesApi.deleteAttributeDirect(metahubId, catalogId, attributeId)
        },
        onSuccess: async () => {
            await invalidateChildQueries()
            enqueueSnackbar(t('attributes.deleteSuccess', 'Attribute deleted'), { variant: 'success' })
        },
        onError: (err: Error) => {
            enqueueSnackbar(err.message || t('attributes.deleteError', 'Failed to delete attribute'), { variant: 'error' })
        }
    })

    const allowedChildDataTypes = useMemo(() => {
        const baseChildTypes = TABLE_CHILD_DATA_TYPES as unknown as AttributeDataType[]
        if (!Array.isArray(allowedAttributeTypesSetting)) return baseChildTypes
        const allowedSet = new Set(
            allowedAttributeTypesSetting.filter(
                (item): item is AttributeDataType => typeof item === 'string' && baseChildTypes.includes(item as AttributeDataType)
            )
        )
        const filtered = baseChildTypes.filter((item) => allowedSet.has(item))
        return filtered.length > 0 ? filtered : baseChildTypes
    }, [allowedAttributeTypesSetting])

    const childDataTypeOptions = useMemo(
        () =>
            allowedChildDataTypes.map((dt) => ({
                value: dt,
                label: t(`attributes.dataTypeOptions.${dt.toLowerCase()}`, dt)
            })),
        [allowedChildDataTypes, t]
    )

    const canDeleteChildAttribute = useCallback(
        (attribute: AttributeDisplay | Attribute | null | undefined): boolean => {
            if (!attribute || !allowAttributeDelete) return false
            const isDisplayAttribute = Boolean((attribute as { isDisplayAttribute?: boolean }).isDisplayAttribute)
            if (!isDisplayAttribute) return true
            if (allowDeleteLastDisplayAttribute) return true
            const displayAttributesCount = childAttributes.reduce((count, childAttribute) => {
                return count + (childAttribute.isDisplayAttribute ? 1 : 0)
            }, 0)
            return displayAttributesCount > 1
        },
        [allowAttributeDelete, allowDeleteLastDisplayAttribute, childAttributes]
    )

    const childColumns = useMemo(
        () => [
            {
                id: 'sortOrder',
                label: t('attributes.table.order', '#'),
                width: '5%',
                align: 'center' as const,
                sortable: true,
                sortAccessor: (row: AttributeDisplay) => row.sortOrder ?? 0,
                render: (_row: AttributeDisplay, index: number) => (
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{index + 1}</Typography>
                )
            },
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '35%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: AttributeDisplay) => row.name || '',
                render: (row: AttributeDisplay) => {
                    const rawAttribute = childAttributeMap.get(row.id)
                    const isDisplayAttr = rawAttribute?.isDisplayAttribute ?? getDisplayAttributeFlag(row)
                    return (
                        <Stack direction='row' spacing={0.5} alignItems='center'>
                            {isDisplayAttr && (
                                <Tooltip
                                    title={t(
                                        'attributes.isDisplayAttributeTooltip',
                                        'This attribute is the display representation for this catalog'
                                    )}
                                    arrow
                                    placement='top'
                                >
                                    <StarIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                </Tooltip>
                            )}
                            <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{row.name || '—'}</Typography>
                        </Stack>
                    )
                }
            },
            {
                id: 'codename',
                label: t('attributes.codename', 'Codename'),
                width: '25%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: AttributeDisplay) => row.codename || '',
                render: (row: AttributeDisplay) => (
                    <Typography sx={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 600 }}>{row.codename || '—'}</Typography>
                )
            },
            {
                id: 'dataType',
                label: t('attributes.dataType', 'Type'),
                width: '15%',
                align: 'center' as const,
                render: (row: AttributeDisplay) => {
                    const rules = row.validationRules as AttributeValidationRules | undefined
                    const hasVersioned = rules?.versioned
                    const hasLocalized = rules?.localized
                    const physicalInfo = getPhysicalDataType(row.dataType, rules)
                    const physicalTypeStr = formatPhysicalType(physicalInfo)
                    const tooltipTitle = t('attributes.physicalType.tooltip', 'PostgreSQL: {{type}}', { type: physicalTypeStr })
                    return (
                        <Tooltip title={tooltipTitle} arrow placement='top'>
                            <Stack direction='row' spacing={0.5} justifyContent='center' alignItems='center' sx={{ cursor: 'help' }}>
                                <Chip label={row.dataType} size='small' color={getDataTypeColor(row.dataType)} />
                                {hasVersioned && <Chip label='V' size='small' sx={{ minWidth: 24, height: 20, fontSize: 11 }} />}
                                {hasLocalized && <Chip label='L' size='small' sx={{ minWidth: 24, height: 20, fontSize: 11 }} />}
                            </Stack>
                        </Tooltip>
                    )
                }
            },
            {
                id: 'isRequired',
                label: t('attributes.required', 'Required'),
                width: '10%',
                align: 'center' as const,
                render: (row: AttributeDisplay) => (
                    <Chip
                        label={row.isRequired ? tc('yes', 'Yes') : tc('no', 'No')}
                        size='small'
                        variant='outlined'
                        color={row.isRequired ? 'error' : 'default'}
                    />
                )
            }
        ],
        [t, tc, childAttributeMap]
    )

    /** Action descriptors for child attribute context menu */
    const childActionDescriptors: ActionDescriptor<AttributeDisplay, AttributeLocalizedPayload>[] = useMemo(
        () => [
            {
                id: 'edit',
                labelKey: 'common:actions.edit',
                icon: <EditIcon />,
                order: 10,
                onSelect: (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
                    const attr = childAttributeMap.get(ctx.entity.id)
                    if (attr) setEditState({ open: true, attribute: attr })
                }
            },
            {
                id: 'copy',
                labelKey: 'common:actions.copy',
                icon: <ContentCopyRoundedIcon />,
                order: 11,
                visible: () => allowAttributeCopy,
                onSelect: (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
                    const attr = childAttributeMap.get(ctx.entity.id)
                    if (attr) {
                        setCopyState({ open: true, attribute: attr })
                    }
                }
            },
            {
                id: 'move-up',
                labelKey: 'attributes.actions.moveUp',
                icon: <ArrowUpwardRoundedIcon />,
                order: 20,
                group: 'reorder',
                enabled: (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
                    if (childAttributes.length <= 1) return false
                    const attr = childAttributeMap.get(ctx.entity.id)
                    if (!attr) return false
                    const sortOrders = childAttributes.map((a) => a.sortOrder ?? 0)
                    const minSort = Math.min(...sortOrders)
                    return (attr.sortOrder ?? 0) > minSort
                },
                onSelect: async (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
                    try {
                        const contextExtras = ctx as ActionContext<AttributeDisplay, AttributeLocalizedPayload> &
                            ChildAttributeContextExtras
                        if (typeof contextExtras.moveAttribute === 'function') {
                            await contextExtras.moveAttribute(ctx.entity.id, 'up')
                        }
                    } catch (error: unknown) {
                        notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
                    }
                }
            },
            {
                id: 'move-down',
                labelKey: 'attributes.actions.moveDown',
                icon: <ArrowDownwardRoundedIcon />,
                order: 30,
                group: 'reorder',
                enabled: (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
                    if (childAttributes.length <= 1) return false
                    const attr = childAttributeMap.get(ctx.entity.id)
                    if (!attr) return false
                    const sortOrders = childAttributes.map((a) => a.sortOrder ?? 0)
                    const maxSort = Math.max(...sortOrders)
                    return (attr.sortOrder ?? 0) < maxSort
                },
                onSelect: async (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
                    try {
                        const contextExtras = ctx as ActionContext<AttributeDisplay, AttributeLocalizedPayload> &
                            ChildAttributeContextExtras
                        if (typeof contextExtras.moveAttribute === 'function') {
                            await contextExtras.moveAttribute(ctx.entity.id, 'down')
                        }
                    } catch (error: unknown) {
                        notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
                    }
                }
            },
            {
                id: 'set-required',
                labelKey: 'attributes.actions.setRequired',
                icon: <CheckCircleOutlineIcon />,
                order: 40,
                group: 'flags',
                visible: (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
                    const raw = childAttributeMap.get(ctx.entity.id)
                    const isRequired = raw?.isRequired ?? ctx.entity?.isRequired ?? false
                    return !isRequired
                },
                onSelect: async (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
                    try {
                        const contextExtras = ctx as ActionContext<AttributeDisplay, AttributeLocalizedPayload> &
                            ChildAttributeContextExtras
                        if (typeof contextExtras.toggleRequired === 'function') {
                            await contextExtras.toggleRequired(ctx.entity.id, true)
                        }
                    } catch (error: unknown) {
                        notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
                    }
                }
            },
            {
                id: 'set-optional',
                labelKey: 'attributes.actions.setOptional',
                icon: <RadioButtonUncheckedIcon />,
                order: 41,
                group: 'flags',
                visible: (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
                    const raw = childAttributeMap.get(ctx.entity.id)
                    const isRequired = raw?.isRequired ?? ctx.entity?.isRequired ?? false
                    const isDisplayAttribute = raw?.isDisplayAttribute ?? getDisplayAttributeFlag(ctx.entity)
                    return isRequired && !isDisplayAttribute
                },
                onSelect: async (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
                    try {
                        const contextExtras = ctx as ActionContext<AttributeDisplay, AttributeLocalizedPayload> &
                            ChildAttributeContextExtras
                        if (typeof contextExtras.toggleRequired === 'function') {
                            await contextExtras.toggleRequired(ctx.entity.id, false)
                        }
                    } catch (error: unknown) {
                        notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
                    }
                }
            },
            {
                id: 'set-display-attribute',
                labelKey: 'attributes.actions.setDisplayAttribute',
                icon: <StarOutlineIcon />,
                order: 50,
                group: 'flags',
                visible: (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
                    const raw = childAttributeMap.get(ctx.entity.id)
                    const isDisplayAttribute = raw?.isDisplayAttribute ?? getDisplayAttributeFlag(ctx.entity)
                    return !isDisplayAttribute
                },
                onSelect: async (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
                    try {
                        const contextExtras = ctx as ActionContext<AttributeDisplay, AttributeLocalizedPayload> &
                            ChildAttributeContextExtras
                        if (typeof contextExtras.toggleDisplayAttribute === 'function') {
                            await contextExtras.toggleDisplayAttribute(ctx.entity.id, true)
                        }
                    } catch (error: unknown) {
                        notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
                    }
                }
            },
            {
                id: 'clear-display-attribute',
                labelKey: 'attributes.actions.clearDisplayAttribute',
                icon: <StarIcon />,
                order: 51,
                group: 'flags',
                visible: (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
                    const raw = childAttributeMap.get(ctx.entity.id)
                    const isDisplayAttribute = raw?.isDisplayAttribute ?? getDisplayAttributeFlag(ctx.entity)
                    const displayAttributesCount = childAttributes.reduce(
                        (count, attribute) => count + (attribute.isDisplayAttribute ? 1 : 0),
                        0
                    )
                    return isDisplayAttribute && displayAttributesCount > 1
                },
                onSelect: async (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
                    try {
                        const contextExtras = ctx as ActionContext<AttributeDisplay, AttributeLocalizedPayload> &
                            ChildAttributeContextExtras
                        if (typeof contextExtras.toggleDisplayAttribute === 'function') {
                            await contextExtras.toggleDisplayAttribute(ctx.entity.id, false)
                        }
                    } catch (error: unknown) {
                        notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
                    }
                }
            },
            {
                id: 'delete',
                labelKey: 'common:actions.delete',
                icon: <DeleteIcon />,
                tone: 'danger' as const,
                order: 100,
                group: 'danger',
                enabled: (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
                    const raw = childAttributeMap.get(ctx.entity.id) ?? (ctx.entity as unknown as Attribute)
                    return canDeleteChildAttribute(raw)
                },
                onSelect: (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
                    const attr = childAttributeMap.get(ctx.entity.id) ?? (ctx.entity as unknown as Attribute)
                    setDeleteState({ open: true, attribute: attr })
                }
            }
        ],
        [allowAttributeCopy, canDeleteChildAttribute, childAttributes, childAttributeMap]
    )

    /** Factory function creating action context for BaseEntityMenu */
    const createChildAttributeContext = useCallback(
        (baseContext: Record<string, unknown>) => ({
            ...baseContext,
            childAttributeMap,
            uiLocale: preferredVlcLocale,
            metahubId,
            catalogId,
            moveAttribute: async (id: string, direction: 'up' | 'down') => {
                await moveAttributeMutation.mutateAsync({
                    metahubId,
                    hubId,
                    catalogId,
                    attributeId: id,
                    direction
                })
                await invalidateChildQueries()
            },
            toggleRequired: async (id: string, isRequired: boolean) => {
                await toggleRequiredMutation.mutateAsync({
                    metahubId,
                    hubId,
                    catalogId,
                    attributeId: id,
                    isRequired
                })
                await invalidateChildQueries()
            },
            toggleDisplayAttribute: async (id: string, isDisplayAttribute: boolean) => {
                if (isDisplayAttribute) {
                    await setDisplayAttributeMutation.mutateAsync({
                        metahubId,
                        hubId,
                        catalogId,
                        attributeId: id
                    })
                } else {
                    await clearDisplayAttributeMutation.mutateAsync({
                        metahubId,
                        hubId,
                        catalogId,
                        attributeId: id
                    })
                }
                await invalidateChildQueries()
            },
            helpers: {
                refreshList: invalidateChildQueries,
                enqueueSnackbar: (payload: {
                    message: string
                    options?: { variant?: 'default' | 'error' | 'success' | 'warning' | 'info' }
                }) => {
                    if (payload?.message) {
                        enqueueSnackbar(payload.message, payload.options)
                    }
                }
            }
        }),
        [
            childAttributeMap,
            metahubId,
            hubId,
            catalogId,
            preferredVlcLocale,
            moveAttributeMutation,
            toggleRequiredMutation,
            setDisplayAttributeMutation,
            clearDisplayAttributeMutation,
            invalidateChildQueries,
            enqueueSnackbar
        ]
    )

    const localizedDefaults = useMemo(() => {
        const defaultDataType = allowedChildDataTypes.includes('STRING') ? 'STRING' : allowedChildDataTypes[0] ?? 'STRING'
        return {
            nameVlc: null,
            codenameVlc: null,
            codename: '',
            codenameTouched: false,
            dataType: defaultDataType as AttributeDataType,
            isRequired: childAttributes.length === 0,
            isDisplayAttribute: childAttributes.length === 0,
            targetEntityId: null,
            targetEntityKind: null,
            validationRules:
                defaultDataType === 'STRING'
                    ? {
                          ...getDefaultValidationRules('STRING'),
                          maxLength: 10
                      }
                    : getDefaultValidationRules(defaultDataType),
            uiConfig: {}
        }
    }, [childAttributes.length, allowedChildDataTypes])

    const validate = useCallback(
        (values: GenericFormValues) => {
            const errors: Record<string, string> = {}
            if (!hasPrimaryContent(values.nameVlc)) {
                errors.nameVlc = tc('crud.nameRequired', 'Name is required')
            }
            const normalized = normalizeCodenameForStyle(values.codename ?? '', codenameConfig.style, codenameConfig.alphabet)
            if (!normalized) errors.codename = t('attributes.validation.codenameRequired', 'Codename is required')
            else if (!isValidCodenameForStyle(normalized, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed))
                errors.codename = t('attributes.validation.codenameInvalid')
            if (values.dataType === 'REF') {
                if (!values.targetEntityKind) {
                    errors.targetEntityKind = t(
                        'attributes.validation.targetEntityKindRequired',
                        'Target entity type is required for Reference type'
                    )
                }
                if (!values.targetEntityId) {
                    errors.targetEntityId = t(
                        'attributes.validation.targetEntityIdRequired',
                        'Target entity is required for Reference type'
                    )
                }
            }
            return Object.keys(errors).length > 0 ? errors : null
        },
        [codenameConfig.allowMixed, codenameConfig.alphabet, codenameConfig.style, t, tc]
    )

    const canSave = useCallback(
        (values: GenericFormValues) => {
            const hasBasic =
                !values._hasCodenameDuplicate &&
                hasPrimaryContent(values.nameVlc) &&
                isValidCodenameForStyle(
                    normalizeCodenameForStyle(values.codename ?? '', codenameConfig.style, codenameConfig.alphabet),
                    codenameConfig.style,
                    codenameConfig.alphabet,
                    codenameConfig.allowMixed
                )
            if (values.dataType === 'REF') {
                return hasBasic && Boolean(values.targetEntityKind) && Boolean(values.targetEntityId)
            }
            return hasBasic
        },
        [codenameConfig.allowMixed, codenameConfig.alphabet, codenameConfig.style]
    )

    const buildTabs = useCallback(
        (
            {
                values,
                setValue,
                isLoading: formLoading,
                errors
            }: {
                values: GenericFormValues
                setValue: (name: string, value: unknown) => void
                isLoading: boolean
                errors?: Record<string, string>
            },
            isEditMode: boolean,
            includePresentationTab = true,
            forceDisplayAttributeWhenLocked = true,
            displayAttributeLockedOverride?: boolean,
            editingEntityId?: string | null
        ): TabConfig[] => {
            const tabs: TabConfig[] = [
                {
                    id: 'general',
                    label: t('attributes.tabs.general', 'General'),
                    content: (
                        <AttributeFormFields
                            values={values}
                            setValue={setValue}
                            isLoading={formLoading}
                            errors={errors}
                            editingEntityId={editingEntityId}
                            uiLocale={preferredVlcLocale}
                            nameLabel={tc('fields.name', 'Name')}
                            codenameLabel={t('attributes.codename', 'Codename')}
                            codenameHelper={t('attributes.codenameHelper', 'Unique identifier')}
                            dataTypeLabel={t('attributes.dataType', 'Data Type')}
                            requiredLabel={t('attributes.isRequiredLabel', 'Required')}
                            hideDisplayAttribute
                            dataTypeOptions={childDataTypeOptions}
                            typeSettingsLabel={t('attributes.typeSettings.title', 'Type Settings')}
                            stringMaxLengthLabel={t('attributes.typeSettings.string.maxLength', 'Max Length')}
                            stringMinLengthLabel={t('attributes.typeSettings.string.minLength', 'Min Length')}
                            stringVersionedLabel={t('attributes.typeSettings.string.versioned', 'Versioned (VLC)')}
                            stringLocalizedLabel={t('attributes.typeSettings.string.localized', 'Localized (VLC)')}
                            numberPrecisionLabel={t('attributes.typeSettings.number.precision', 'Precision')}
                            numberScaleLabel={t('attributes.typeSettings.number.scale', 'Scale')}
                            numberMinLabel={t('attributes.typeSettings.number.min', 'Min Value')}
                            numberMaxLabel={t('attributes.typeSettings.number.max', 'Max Value')}
                            numberNonNegativeLabel={t('attributes.typeSettings.number.nonNegative', 'Non-negative only')}
                            dateCompositionLabel={t('attributes.typeSettings.date.composition', 'Date Composition')}
                            dateCompositionOptions={[
                                { value: 'date', label: t('attributes.typeSettings.date.compositionOptions.date', 'Date only') },
                                { value: 'time', label: t('attributes.typeSettings.date.compositionOptions.time', 'Time only') },
                                {
                                    value: 'datetime',
                                    label: t('attributes.typeSettings.date.compositionOptions.datetime', 'Date and Time')
                                }
                            ]}
                            physicalTypeLabel={t('attributes.physicalType.label', 'PostgreSQL type')}
                            metahubId={metahubId}
                            currentCatalogId={catalogId}
                            dataTypeDisabled={isEditMode}
                            dataTypeHelperText={
                                isEditMode
                                    ? t('attributes.edit.typeChangeDisabled', 'Data type cannot be changed after creation')
                                    : undefined
                            }
                            disableVlcToggles={isEditMode}
                        />
                    )
                }
            ]

            if (includePresentationTab) {
                tabs.push({
                    id: 'presentation',
                    label: t('attributes.tabs.presentation', 'Presentation'),
                    content: (
                        <PresentationTabFields
                            values={values}
                            setValue={setValue}
                            isLoading={formLoading}
                            metahubId={metahubId}
                            displayAttributeLabel={t('attributes.isDisplayAttributeLabel', 'Display attribute')}
                            displayAttributeHelper={t(
                                'attributes.isDisplayAttributeHelper',
                                'Use as representation when referencing elements of this catalog'
                            )}
                            displayAttributeLocked={displayAttributeLockedOverride ?? childAttributes.length === 0}
                            forceDisplayAttributeWhenLocked={forceDisplayAttributeWhenLocked}
                            headerAsCheckboxLabel={t('attributes.presentation.headerAsCheckbox', 'Display header as checkbox')}
                            headerAsCheckboxHelper={t(
                                'attributes.presentation.headerAsCheckboxHelper',
                                'Show a checkbox in the column header instead of the text label'
                            )}
                            dataType={values.dataType ?? 'STRING'}
                            targetEntityKind={values.targetEntityKind ?? null}
                            targetEntityId={values.targetEntityId ?? null}
                            isRequired={Boolean(values.isRequired)}
                        />
                    )
                })
            }

            return tabs
        },
        [preferredVlcLocale, t, tc, metahubId, catalogId, childDataTypeOptions, childAttributes.length]
    )

    const handleCreate = async (data: GenericFormValues) => {
        setDialogError(null)
        setCreating(true)
        try {
            const nameVlc = data.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const codenameVlc = data.codenameVlc as VersionedLocalizedContent<string> | null | undefined
            const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
            const { input: codenameInput, primaryLocale: codenamePrimaryLocale } = extractLocalizedInput(codenameVlc)
            if (!nameInput || !namePrimaryLocale) {
                setDialogError(tc('crud.nameRequired'))
                return
            }
            const codename = normalizeCodenameForStyle(data.codename ?? '', codenameConfig.style, codenameConfig.alphabet)
            if (!codename) {
                setDialogError(t('attributes.validation.codenameRequired'))
                return
            }
            const dataType = (data.dataType as string) ?? 'STRING'
            const targetEntityId = dataType === 'REF' ? (data.targetEntityId as string | null | undefined) ?? null : undefined
            const targetEntityKind = dataType === 'REF' ? (data.targetEntityKind as MetaEntityKind | null | undefined) ?? null : undefined
            const uiConfig = (data.uiConfig as Record<string, unknown>) ?? {}
            const normalizedUiConfig = sanitizeChildAttributeUiConfig(dataType as AttributeDataType, targetEntityKind, uiConfig)
            const payload: AttributeLocalizedPayload & {
                validationRules?: Record<string, unknown>
                uiConfig?: Record<string, unknown>
                isRequired?: boolean
                isDisplayAttribute?: boolean
                targetEntityId?: string | null
                targetEntityKind?: MetaEntityKind | null
            } = {
                codename,
                codenameInput,
                codenamePrimaryLocale,
                dataType: dataType as AttributeDataType,
                isRequired: Boolean(data.isRequired),
                isDisplayAttribute: Boolean(data.isDisplayAttribute),
                name: nameInput,
                namePrimaryLocale,
                validationRules: data.validationRules,
                uiConfig: normalizedUiConfig,
                targetEntityId,
                targetEntityKind
            }

            if (hubId) {
                await attributesApi.createChildAttribute(metahubId, hubId, catalogId, parentAttributeId, payload)
            } else {
                await attributesApi.createChildAttributeDirect(metahubId, catalogId, parentAttributeId, payload)
            }

            await invalidateChildQueries()
            setDialogOpen(false)
            enqueueSnackbar(t('attributes.createSuccess', 'Attribute created'), { variant: 'success' })
        } catch (e: unknown) {
            if (extractResponseCode(e) === 'TABLE_CHILD_LIMIT_REACHED') {
                const max = extractResponseMaxChildAttributes(e)
                setDialogError(
                    t('attributes.tableValidation.maxChildAttributes', 'Maximum {{max}} child attributes per TABLE', {
                        max: max ?? maxChildAttributesLimit ?? '—'
                    })
                )
                return
            }
            const msg = extractResponseMessage(e) ?? (e instanceof Error ? e.message : '')
            const localizedMsg = localizeTableValidationError(e, t, maxChildAttributesLimit) || msg || t('attributes.createError')
            setDialogError(localizedMsg)
        } finally {
            setCreating(false)
        }
    }

    const handleUpdate = async (data: GenericFormValues) => {
        if (!editState.attribute) return
        setEditDialogError(null)
        setUpdating(true)
        try {
            const nameVlc = data.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const codenameVlc = data.codenameVlc as VersionedLocalizedContent<string> | null | undefined
            const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
            const { input: codenameInput, primaryLocale: codenamePrimaryLocale } = extractLocalizedInput(codenameVlc)
            if (!nameInput || !namePrimaryLocale) {
                setEditDialogError(tc('crud.nameRequired'))
                return
            }
            const codename = normalizeCodenameForStyle(data.codename ?? '', codenameConfig.style, codenameConfig.alphabet)
            if (!codename) {
                setEditDialogError(t('attributes.validation.codenameRequired'))
                return
            }
            const dataType = (data.dataType as string) ?? editState.attribute.dataType
            const targetEntityId = dataType === 'REF' ? (data.targetEntityId as string | null | undefined) ?? null : null
            const targetEntityKind = dataType === 'REF' ? (data.targetEntityKind as MetaEntityKind | null | undefined) ?? null : null
            const uiConfig = (data.uiConfig as Record<string, unknown>) ?? {}
            const normalizedUiConfig = sanitizeChildAttributeUiConfig(dataType as AttributeDataType, targetEntityKind, uiConfig)
            const payload: AttributeLocalizedPayload & {
                validationRules?: Record<string, unknown>
                uiConfig?: Record<string, unknown>
                isRequired?: boolean
                expectedVersion?: number
                targetEntityId?: string | null
                targetEntityKind?: MetaEntityKind | null
            } = {
                codename,
                codenameInput,
                codenamePrimaryLocale,
                dataType: dataType as AttributeDataType,
                isRequired: Boolean(data.isRequired),
                name: nameInput,
                namePrimaryLocale,
                validationRules: data.validationRules,
                uiConfig: normalizedUiConfig,
                targetEntityId,
                targetEntityKind,
                expectedVersion: editState.attribute.version
            }

            if (hubId) {
                await attributesApi.updateAttribute(metahubId, hubId, catalogId, editState.attribute.id, payload)
            } else {
                await attributesApi.updateAttributeDirect(metahubId, catalogId, editState.attribute.id, payload)
            }

            await invalidateChildQueries()
            setEditState({ open: false, attribute: null })
            enqueueSnackbar(t('attributes.updateSuccess', 'Attribute updated'), { variant: 'success' })
        } catch (e: unknown) {
            const msg = extractResponseMessage(e) ?? (e instanceof Error ? e.message : '')
            setEditDialogError(
                localizeTableValidationError(e, t, maxChildAttributesLimit) ||
                    msg ||
                    t('attributes.updateError', 'Failed to update attribute')
            )
        } finally {
            setUpdating(false)
        }
    }

    const handleCopy = async (data: GenericFormValues) => {
        if (!copyState.attribute) return
        setCopyDialogError(null)
        setCopying(true)
        try {
            const nameVlc = data.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const codenameVlc = data.codenameVlc as VersionedLocalizedContent<string> | null | undefined
            const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
            const { input: codenameInput, primaryLocale: codenamePrimaryLocale } = extractLocalizedInput(codenameVlc)
            if (!nameInput || !namePrimaryLocale) {
                setCopyDialogError(tc('crud.nameRequired', 'Name is required'))
                return
            }

            const codename = normalizeCodenameForStyle(data.codename ?? '', codenameConfig.style, codenameConfig.alphabet)
            if (!codename) {
                setCopyDialogError(t('attributes.validation.codenameRequired', 'Codename is required'))
                return
            }

            await copyAttributeMutation.mutateAsync({
                metahubId,
                hubId,
                catalogId,
                attributeId: copyState.attribute.id,
                data: {
                    codename,
                    codenameInput,
                    codenamePrimaryLocale,
                    name: nameInput,
                    namePrimaryLocale,
                    validationRules: data.validationRules ?? copyState.attribute.validationRules ?? {},
                    uiConfig: data.uiConfig ?? copyState.attribute.uiConfig ?? {},
                    isRequired: typeof data.isRequired === 'boolean' ? data.isRequired : Boolean(copyState.attribute.isRequired)
                }
            })

            await invalidateChildQueries()
            setCopyState({ open: false, attribute: null })
            enqueueSnackbar(t('attributes.copy.success', 'Attribute copied'), { variant: 'success' })
        } catch (error: unknown) {
            if (extractResponseCode(error) === 'TABLE_CHILD_LIMIT_REACHED') {
                const max = extractResponseMaxChildAttributes(error)
                setCopyDialogError(
                    t('attributes.tableValidation.maxChildAttributes', 'Maximum {{max}} child attributes per TABLE', {
                        max: max ?? maxChildAttributesLimit ?? '—'
                    })
                )
                return
            }
            const message = error instanceof Error ? error.message : t('attributes.copy.error', 'Failed to copy attribute')
            setCopyDialogError(message)
        } finally {
            setCopying(false)
        }
    }

    /** Build initial values for edit dialog from the existing attribute. */
    const editInitialValues = useMemo(() => {
        if (!editState.attribute) return localizedDefaults
        const attr = editState.attribute
        return {
            nameVlc: attr.name,
            codenameVlc: attr.codenameLocalized ?? null,
            codename: attr.codename,
            codenameTouched: true,
            dataType: attr.dataType as AttributeDataType,
            isRequired: attr.isRequired,
            isDisplayAttribute: attr.isDisplayAttribute ?? false,
            targetEntityId:
                attr.targetEntityId ?? (attr.validationRules as { targetEntityId?: string | null } | undefined)?.targetEntityId ?? null,
            targetEntityKind:
                attr.targetEntityKind ??
                (attr.validationRules as { targetEntityKind?: MetaEntityKind | null } | undefined)?.targetEntityKind ??
                null,
            validationRules: attr.validationRules ?? {},
            uiConfig: attr.uiConfig ?? {}
        }
    }, [editState.attribute, localizedDefaults])

    const copyInitialValues = useMemo(() => {
        if (!copyState.attribute) return null
        const source = copyState.attribute
        const sourceName = source.codename || 'attribute'
        return {
            nameVlc: appendCopySuffix(source.name ?? null, i18n.language, sourceName),
            codenameVlc: source.codenameLocalized ?? null,
            codename: normalizeCodenameForStyle(`${source.codename}-copy`, codenameConfig.style, codenameConfig.alphabet),
            codenameTouched: true,
            dataType: source.dataType as AttributeDataType,
            isRequired: source.isRequired ?? false,
            targetEntityId: source.targetEntityId ?? null,
            targetEntityKind: source.targetEntityKind ?? null,
            isDisplayAttribute: false,
            validationRules: source.validationRules ?? {},
            uiConfig: source.uiConfig ?? {}
        }
    }, [codenameConfig.alphabet, codenameConfig.style, copyState.attribute, i18n.language])

    // Filtered child attributes (for search) and their display representations
    const filteredChildAttributes = useMemo(() => {
        if (!searchFilter) return childAttributes
        const lowerSearch = searchFilter.toLowerCase()
        return childAttributes.filter((attr) => {
            if (attr.codename.toLowerCase().includes(lowerSearch)) return true
            const name = attr.name
            if (!name) return false
            if (typeof name === 'string') return name.toLowerCase().includes(lowerSearch)
            if (typeof name === 'object' && 'locales' in name) {
                const locales = (name as { locales?: Record<string, { content?: string }> }).locales ?? {}
                return Object.values(locales).some((entry) =>
                    String(entry?.content ?? '')
                        .toLowerCase()
                        .includes(lowerSearch)
                )
            }
            return false
        })
    }, [childAttributes, searchFilter])

    const tableData = useMemo(
        () => filteredChildAttributes.map((attr) => toAttributeDisplay(attr, i18n.language)),
        [filteredChildAttributes, i18n.language]
    )

    if (error) {
        return (
            <Alert severity='error' sx={{ mb: 1 }}>
                {error instanceof Error ? error.message : t('errors.loadingError')}
            </Alert>
        )
    }

    return (
        <ExistingCodenamesProvider entities={codenameEntities}>
            <Box>
                <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ mb: 1 }}>
                    <Typography variant='caption' color='text.secondary'>
                        {t('attributes.childAttributes', 'Child Attributes')} ({childAttributes.length})
                    </Typography>
                    <Tooltip
                        title={
                            isChildLimitReached && maxChildAttributesLimit !== null
                                ? t('attributes.typeSettings.table.maxChildAttributesReached', 'Maximum {{max}} child attributes reached', {
                                      max: maxChildAttributesLimit
                                  })
                                : ''
                        }
                    >
                        <span>
                            <Button
                                variant='contained'
                                size='small'
                                onClick={() => setDialogOpen(true)}
                                startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                                sx={{ borderRadius: 1, height: 28, fontSize: 12, textTransform: 'none' }}
                                disabled={isChildLimitReached}
                            >
                                {tc('create')}
                            </Button>
                        </span>
                    </Tooltip>
                </Stack>

                {isLoading ? (
                    <Skeleton variant='rectangular' height={60} />
                ) : (
                    (() => {
                        // Compute effective data/IDs for ghost row rendering during cross-list drag
                        const baseData = tableData
                        const baseIds = filteredChildAttributes.map((a) => a.id)
                        let effectiveData = baseData
                        let effectiveIds = baseIds

                        if (pendingTransfer) {
                            if (pendingTransfer.fromContainerId === containerId) {
                                // Source container: hide the dragged item
                                effectiveData = baseData.filter((d) => d.id !== pendingTransfer.itemId)
                                effectiveIds = baseIds.filter((id) => id !== pendingTransfer.itemId)
                            } else if (pendingTransfer.toContainerId === containerId && dndActiveAttr) {
                                // Target container: inject ghost at insertion point
                                const ghost = toAttributeDisplay(dndActiveAttr, i18n.language)
                                const insertAt = Math.min(pendingTransfer.insertIndex, baseData.length)
                                effectiveData = [...baseData.slice(0, insertAt), ghost, ...baseData.slice(insertAt)]
                                effectiveIds = [...baseIds.slice(0, insertAt), pendingTransfer.itemId, ...baseIds.slice(insertAt)]
                            }
                        }

                        return (
                            <FlowListTable<AttributeDisplay>
                                data={effectiveData}
                                customColumns={childColumns}
                                compact
                                sortableRows
                                externalDndContext
                                droppableContainerId={containerId}
                                sortableItemIds={effectiveIds}
                                dragHandleAriaLabel={t('attributes.dnd.dragHandle', 'Drag to reorder')}
                                isDropTarget={isDropTarget}
                                isDropTargetInvalid={isInvalidDropTarget}
                                emptyStateMessage={
                                    isInvalidDropTarget && maxChildAttributesLimit !== null
                                        ? t(
                                              'attributes.typeSettings.table.maxChildAttributesReached',
                                              'Maximum {{max}} child attributes reached',
                                              { max: maxChildAttributesLimit }
                                          )
                                        : t('attributes.noChildAttributes', 'No child attributes yet')
                                }
                                renderActions={(row: AttributeDisplay) => {
                                    const originalAttribute = childAttributes.find((a) => a.id === row.id)
                                    if (!originalAttribute) return null
                                    return (
                                        <BaseEntityMenu<AttributeDisplay, AttributeLocalizedPayload>
                                            entity={toAttributeDisplay(originalAttribute, i18n.language)}
                                            entityKind='child-attribute'
                                            descriptors={childActionDescriptors}
                                            namespace='metahubs'
                                            menuButtonLabelKey='flowList:menu.button'
                                            i18nInstance={i18n}
                                            createContext={createChildAttributeContext}
                                        />
                                    )
                                }}
                            />
                        )
                    })()
                )}

                <EntityFormDialog
                    open={isDialogOpen}
                    title={t('attributes.createChildDialog.title', 'Add Child Attribute')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={tc('actions.create', 'Create')}
                    savingButtonText={tc('actions.creating', 'Creating...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    loading={isCreating}
                    error={dialogError || undefined}
                    onClose={() => setDialogOpen(false)}
                    onSave={handleCreate}
                    hideDefaultFields
                    initialExtraValues={localizedDefaults}
                    tabs={(args) => buildTabs(args, false, true, true, undefined, null)}
                    validate={validate}
                    canSave={canSave}
                />

                <EntityFormDialog
                    key={`child-edit-${editState.attribute?.id ?? 'none'}-${editState.attribute?.version ?? 0}`}
                    open={editState.open}
                    mode='edit'
                    title={t('attributes.editChildDialog.title', 'Edit Child Attribute')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={tc('actions.save', 'Save')}
                    savingButtonText={tc('actions.saving', 'Saving...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    loading={isUpdating}
                    error={editDialogError || undefined}
                    onClose={() => setEditState({ open: false, attribute: null })}
                    onSave={handleUpdate}
                    hideDefaultFields
                    initialExtraValues={editInitialValues}
                    tabs={(args) =>
                        buildTabs(
                            args,
                            true,
                            true,
                            true,
                            editState.attribute?.isDisplayAttribute ? true : undefined,
                            editState.attribute?.id ?? null
                        )
                    }
                    validate={validate}
                    canSave={canSave}
                    showDeleteButton
                    deleteButtonText={tc('actions.delete', 'Delete')}
                    deleteButtonDisabled={!canDeleteChildAttribute(editState.attribute)}
                    onDelete={() => {
                        if (editState.attribute) {
                            setDeleteState({ open: true, attribute: editState.attribute })
                            setEditState({ open: false, attribute: null })
                        }
                    }}
                />

                <EntityFormDialog
                    key={`child-copy-${copyState.attribute?.id ?? 'none'}-${copyState.attribute?.version ?? 0}`}
                    open={copyState.open}
                    mode='copy'
                    title={t('attributes.copyTitle', 'Copy Attribute')}
                    saveButtonText={t('attributes.copy.action', 'Copy')}
                    savingButtonText={t('attributes.copy.actionLoading', 'Copying...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    loading={isCopying}
                    error={copyDialogError || undefined}
                    onClose={() => setCopyState({ open: false, attribute: null })}
                    onSave={handleCopy}
                    hideDefaultFields
                    initialExtraValues={copyInitialValues ?? localizedDefaults}
                    tabs={(args) => buildTabs(args, true, true, false, false, null)}
                    validate={validate}
                    canSave={(values) => canSave(values)}
                />

                <ConfirmDeleteDialog
                    open={deleteState.open}
                    title={t('attributes.deleteDialog.title', 'Delete Attribute')}
                    description={t('attributes.deleteChildDialog.message', 'Are you sure you want to delete this child attribute?')}
                    confirmButtonText={tc('actions.delete', 'Delete')}
                    deletingButtonText={tc('actions.deleting', 'Deleting...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onCancel={() => setDeleteState({ open: false, attribute: null })}
                    onConfirm={async () => {
                        if (deleteState.attribute) {
                            await deleteMutation.mutateAsync(deleteState.attribute.id)
                            setDeleteState({ open: false, attribute: null })
                        }
                    }}
                />
            </Box>
        </ExistingCodenamesProvider>
    )
}

export default ChildAttributeList
