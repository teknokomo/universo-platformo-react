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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { EntityFormDialog, ConfirmDeleteDialog, type TabConfig } from '@universo/template-mui/components/dialogs'
import { BaseEntityMenu, notifyError, FlowListTable, useListDialogs } from '@universo/template-mui'
import type { ActionDescriptor, ActionContext } from '@universo/template-mui'
import type { VersionedLocalizedContent, EntityKind } from '@universo/types'
import { TABLE_CHILD_DATA_TYPES } from '@universo/types'
import type { ComponentDefinitionDataType } from '../../../../../types'
import {
    Component,
    ComponentDisplay,
    ComponentLocalizedPayload,
    ComponentDefinitionValidationRules,
    getVLCString,
    toComponentDisplay,
    getDefaultValidationRules,
    getPhysicalDataType,
    formatPhysicalType
} from '../../../../../types'
import { normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../../../utils/codename'
import { useCodenameConfig } from '../../../../settings/hooks/useCodenameConfig'
import { useSettingValue } from '../../../../settings/hooks/useSettings'
import { useMetahubPrimaryLocale } from '../../../../settings/hooks/useMetahubPrimaryLocale'
import {
    extractLocalizedInput,
    hasPrimaryContent,
    ensureEntityCodenameContent,
    ensureLocalizedContent,
    normalizeLocale
} from '../../../../../utils/localizedInput'
import * as componentsApi from '../api'
import { metahubsQueryKeys, invalidateComponentsQueries } from '../../../../shared'
import {
    useCreateChildComponent,
    useUpdateChildComponent,
    useDeleteChildComponent,
    useCopyChildComponent,
    useMoveComponent,
    useToggleComponentRequired,
    useSetDisplayComponent,
    useClearDisplayComponent
} from '../hooks/mutations'
import ComponentFormFields, { PresentationTabFields } from './ComponentFormFields'
import { useContainerRegistry, useComponentDndState } from './dnd'
import { ExistingCodenamesProvider } from '../../../../../components'

type GenericFormValues = Record<string, unknown>

type ChildComponentContextExtras = {
    moveComponent?: (id: string, direction: 'up' | 'down') => Promise<void>
    toggleRequired?: (id: string, value: boolean) => Promise<void>
    toggleDisplayComponent?: (id: string, value: boolean) => Promise<void>
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

const extractResponseMaxChildComponents = (error: unknown): number | undefined => {
    const data = extractResponseData(error)
    const max = data?.maxChildComponents
    return typeof max === 'number' && Number.isFinite(max) ? max : undefined
}

const extractResponseMaxTableComponents = (error: unknown): number | undefined => {
    const data = extractResponseData(error)
    const max = data?.maxTableComponents
    return typeof max === 'number' && Number.isFinite(max) ? max : undefined
}

const getDisplayComponentFlag = (row: ComponentDisplay): boolean => Boolean((row as { isDisplayComponent?: boolean }).isDisplayComponent)

function localizeTableValidationError(
    error: unknown,
    t: (key: string, defaultValue: string, opts?: Record<string, unknown>) => string,
    maxChildComponentsFallback?: number | null
): string | null {
    const code = extractResponseCode(error)
    if (!code) return null
    if (code === 'NESTED_TABLE_FORBIDDEN') {
        return t('components.tableValidation.nestedTableNotAllowed', 'Nested TABLE components are not allowed')
    }
    if (code === 'TABLE_CHILD_LIMIT_REACHED') {
        const max = extractResponseMaxChildComponents(error)
        return t('components.tableValidation.maxChildComponents', 'Maximum {{max}} child components per TABLE', {
            max: max ?? maxChildComponentsFallback ?? '—'
        })
    }
    if (code === 'TABLE_COMPONENT_LIMIT_REACHED') {
        const max = extractResponseMaxTableComponents(error)
        return t('components.tableValidation.maxTableComponents', 'Maximum {{max}} TABLE components per object', {
            max: max ?? '—'
        })
    }
    if (code === 'TABLE_DISPLAY_COMPONENT_FORBIDDEN') {
        return t('components.tableValidation.tableCannotBeDisplay', 'TABLE components cannot be set as the display component')
    }
    return null
}

const sanitizeChildComponentUiConfig = (
    dataType: ComponentDefinitionDataType,
    targetEntityKind: EntityKind | null | undefined,
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
    dataType: ComponentDefinitionDataType | string
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

interface NestedComponentListProps {
    metahubId: string
    treeEntityId?: string
    objectCollectionId: string
    parentComponentId: string
    parentMaxChildComponents?: number | null
    /** When set, only children matching this search term are shown */
    searchFilter?: string
    onRefresh?: () => void
}

const NestedComponentList = ({
    metahubId,
    treeEntityId,
    objectCollectionId,
    parentComponentId,
    parentMaxChildComponents,
    searchFilter,
    onRefresh
}: NestedComponentListProps) => {
    const codenameConfig = useCodenameConfig()
    const preferredVlcLocale = useMetahubPrimaryLocale()
    const componentCodenameScope = useSettingValue<string>('entity.object.componentCodenameScope') ?? 'per-level'
    const allowedComponentTypesSetting = useSettingValue<string[]>('entity.object.allowedComponentTypes')
    const allowComponentCopySetting = useSettingValue<boolean>('entity.object.allowComponentCopy')
    const allowComponentDeleteSetting = useSettingValue<boolean>('entity.object.allowComponentDelete')
    const allowDeleteLastDisplayComponentSetting = useSettingValue<boolean>('entity.object.allowDeleteLastDisplayComponent')
    const allowComponentCopy = allowComponentCopySetting !== false
    const allowComponentDelete = allowComponentDeleteSetting !== false
    const allowDeleteLastDisplayComponent = allowDeleteLastDisplayComponentSetting !== false
    const { t, i18n } = useTranslation(['metahubs', 'common'])
    const { t: tc } = useCommonTranslations()
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const { dialogs, openCreate, openEdit, openCopy, openDelete, close } = useListDialogs<Component>()
    const [dialogError, setDialogError] = useState<string | null>(null)
    const [editDialogError, setEditDialogError] = useState<string | null>(null)
    const [copyDialogError, setCopyDialogError] = useState<string | null>(null)

    // Mutation hooks for child component actions
    const createChildComponentMutation = useCreateChildComponent()
    const updateChildComponentMutation = useUpdateChildComponent()
    const deleteChildComponentMutation = useDeleteChildComponent()
    const copyChildComponentMutation = useCopyChildComponent()
    const moveComponentMutation = useMoveComponent()
    const toggleRequiredMutation = useToggleComponentRequired()
    const setDisplayComponentMutation = useSetDisplayComponent()
    const clearDisplayComponentMutation = useClearDisplayComponent()

    const queryKey = useMemo(
        () => ['metahubs', 'childComponents', metahubId, objectCollectionId, parentComponentId] as const,
        [metahubId, objectCollectionId, parentComponentId]
    )

    const { data, isLoading, error } = useQuery({
        queryKey,
        queryFn: async () => {
            if (treeEntityId) {
                return componentsApi.listChildComponents(metahubId, treeEntityId, objectCollectionId, parentComponentId)
            }
            return componentsApi.listChildComponentsDirect(metahubId, objectCollectionId, parentComponentId)
        },
        enabled: !!metahubId && !!objectCollectionId && !!parentComponentId
    })

    const childComponents = useMemo(() => data?.items ?? [], [data?.items])
    const maxChildComponentsLimit =
        typeof parentMaxChildComponents === 'number' && parentMaxChildComponents > 0 ? parentMaxChildComponents : null
    const isChildLimitReached = maxChildComponentsLimit !== null && childComponents.length >= maxChildComponentsLimit

    // When componentCodenameScope is 'global', fetch ALL component codenames (root + children)
    // to enable cross-level duplicate checking in the UI
    const isGlobalScope = componentCodenameScope === 'global'
    const { data: globalCodenamesData } = useQuery({
        queryKey: metahubsQueryKeys.allComponentCodenames(metahubId, objectCollectionId),
        queryFn: () => componentsApi.listAllComponentCodenames(metahubId, objectCollectionId),
        enabled: isGlobalScope && !!metahubId && !!objectCollectionId
    })
    const codenameEntities = isGlobalScope && globalCodenamesData?.items ? globalCodenamesData.items : childComponents

    /** Map from component id to full Component for quick context lookups */
    const childComponentMap = useMemo(() => {
        const map = new Map<string, Component>()
        childComponents.forEach((cmp) => map.set(cmp.id, cmp))
        return map
    }, [childComponents])

    // DnD: Register this child list as a droppable container
    const containerId = `child-${parentComponentId}`
    const { register, unregister } = useContainerRegistry()
    const { activeContainerId, overContainerId, pendingTransfer, activeComponent: dndActiveAttr } = useComponentDndState()
    const isDropTarget = overContainerId === containerId && activeContainerId !== null && activeContainerId !== containerId
    const isInvalidDropTarget = isDropTarget && isChildLimitReached
    useEffect(() => {
        register({
            id: containerId,
            parentComponentId,
            items: childComponents
        })
        return () => unregister(containerId)
    }, [containerId, parentComponentId, childComponents, register, unregister])

    /** Invalidate both child-specific and parent-level queries */
    const invalidateChildQueries = useCallback(async () => {
        queryClient.invalidateQueries({ queryKey })
        // Also invalidate element-scoped child component & enum caches so stale uiConfig is refreshed
        queryClient.invalidateQueries({ queryKey: ['metahubs', 'childComponentsForElements', metahubId, objectCollectionId] })
        queryClient.invalidateQueries({ queryKey: ['metahubs', 'childEnumValues', metahubId] })
        // Invalidate global codenames cache (for global scope duplicate checking)
        invalidateComponentsQueries.allCodenames(queryClient, metahubId, objectCollectionId)
        if (treeEntityId) {
            await invalidateComponentsQueries.all(queryClient, metahubId, treeEntityId, objectCollectionId)
        } else {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.componentsDirect(metahubId, objectCollectionId) })
        }
        onRefresh?.()
    }, [queryClient, queryKey, treeEntityId, metahubId, objectCollectionId, onRefresh])

    const allowedChildDataTypes = useMemo(() => {
        const baseChildTypes = TABLE_CHILD_DATA_TYPES as unknown as ComponentDefinitionDataType[]
        if (!Array.isArray(allowedComponentTypesSetting)) return baseChildTypes
        const allowedSet = new Set(
            allowedComponentTypesSetting.filter(
                (item): item is ComponentDefinitionDataType =>
                    typeof item === 'string' && baseChildTypes.includes(item as ComponentDefinitionDataType)
            )
        )
        const filtered = baseChildTypes.filter((item) => allowedSet.has(item))
        return filtered.length > 0 ? filtered : baseChildTypes
    }, [allowedComponentTypesSetting])

    const childDataTypeOptions = useMemo(
        () =>
            allowedChildDataTypes.map((dt) => ({
                value: dt,
                label: t(`components.dataTypeOptions.${dt.toLowerCase()}`, dt)
            })),
        [allowedChildDataTypes, t]
    )

    const canDeleteChildComponent = useCallback(
        (component: ComponentDisplay | Component | null | undefined): boolean => {
            if (!component || !allowComponentDelete) return false
            const isDisplayComponent = Boolean((component as { isDisplayComponent?: boolean }).isDisplayComponent)
            if (!isDisplayComponent) return true
            if (allowDeleteLastDisplayComponent) return true
            const displayComponentsCount = childComponents.reduce((count, childComponent) => {
                return count + (childComponent.isDisplayComponent ? 1 : 0)
            }, 0)
            return displayComponentsCount > 1
        },
        [allowComponentDelete, allowDeleteLastDisplayComponent, childComponents]
    )

    const childColumns = useMemo(
        () => [
            {
                id: 'sortOrder',
                label: t('components.table.order', '#'),
                width: '5%',
                align: 'center' as const,
                sortable: true,
                sortAccessor: (row: ComponentDisplay) => row.sortOrder ?? 0,
                render: (_row: ComponentDisplay, index: number) => (
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{index + 1}</Typography>
                )
            },
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '35%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: ComponentDisplay) => row.name || '',
                render: (row: ComponentDisplay) => {
                    const rawComponent = childComponentMap.get(row.id)
                    const isDisplayAttr = rawComponent?.isDisplayComponent ?? getDisplayComponentFlag(row)
                    return (
                        <Stack direction='row' spacing={0.5} alignItems='center'>
                            {isDisplayAttr && (
                                <Tooltip
                                    title={t(
                                        'components.isDisplayComponentTooltip',
                                        'This component is the display representation for this object'
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
                label: t('components.codename', 'Codename'),
                width: '25%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: ComponentDisplay) => row.codename || '',
                render: (row: ComponentDisplay) => (
                    <Typography sx={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 600 }}>{row.codename || '—'}</Typography>
                )
            },
            {
                id: 'dataType',
                label: t('components.dataType', 'Type'),
                width: '15%',
                align: 'center' as const,
                render: (row: ComponentDisplay) => {
                    const rules = row.validationRules as ComponentDefinitionValidationRules | undefined
                    const hasVersioned = rules?.versioned
                    const hasLocalized = rules?.localized
                    const physicalInfo = getPhysicalDataType(row.dataType, rules)
                    const physicalTypeStr = formatPhysicalType(physicalInfo)
                    const tooltipTitle = t('components.physicalType.tooltip', 'PostgreSQL: {{type}}', { type: physicalTypeStr })
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
                label: t('components.required', 'Required'),
                width: '10%',
                align: 'center' as const,
                render: (row: ComponentDisplay) => (
                    <Chip
                        label={row.isRequired ? tc('yes', 'Yes') : tc('no', 'No')}
                        size='small'
                        variant='outlined'
                        color={row.isRequired ? 'error' : 'default'}
                    />
                )
            }
        ],
        [t, tc, childComponentMap]
    )

    /** Action descriptors for child component context menu */
    const childActionDescriptors: ActionDescriptor<ComponentDisplay, ComponentLocalizedPayload>[] = useMemo(
        () => [
            {
                id: 'edit',
                labelKey: 'common:actions.edit',
                icon: <EditIcon />,
                order: 10,
                onSelect: (ctx: ActionContext<ComponentDisplay, ComponentLocalizedPayload>) => {
                    const cmp = childComponentMap.get(ctx.entity.id)
                    if (cmp) openEdit(cmp)
                }
            },
            {
                id: 'copy',
                labelKey: 'common:actions.copy',
                icon: <ContentCopyRoundedIcon />,
                order: 11,
                visible: () => allowComponentCopy,
                onSelect: (ctx: ActionContext<ComponentDisplay, ComponentLocalizedPayload>) => {
                    const cmp = childComponentMap.get(ctx.entity.id)
                    if (cmp) {
                        openCopy(cmp)
                    }
                }
            },
            {
                id: 'move-up',
                labelKey: 'components.actions.moveUp',
                icon: <ArrowUpwardRoundedIcon />,
                order: 20,
                group: 'reorder',
                enabled: (ctx: ActionContext<ComponentDisplay, ComponentLocalizedPayload>) => {
                    if (childComponents.length <= 1) return false
                    const cmp = childComponentMap.get(ctx.entity.id)
                    if (!cmp) return false
                    const sortOrders = childComponents.map((a) => a.sortOrder ?? 0)
                    const minSort = Math.min(...sortOrders)
                    return (cmp.sortOrder ?? 0) > minSort
                },
                onSelect: async (ctx: ActionContext<ComponentDisplay, ComponentLocalizedPayload>) => {
                    try {
                        const contextExtras = ctx as ActionContext<ComponentDisplay, ComponentLocalizedPayload> &
                            ChildComponentContextExtras
                        if (typeof contextExtras.moveComponent === 'function') {
                            await contextExtras.moveComponent(ctx.entity.id, 'up')
                        }
                    } catch (error: unknown) {
                        notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
                    }
                }
            },
            {
                id: 'move-down',
                labelKey: 'components.actions.moveDown',
                icon: <ArrowDownwardRoundedIcon />,
                order: 30,
                group: 'reorder',
                enabled: (ctx: ActionContext<ComponentDisplay, ComponentLocalizedPayload>) => {
                    if (childComponents.length <= 1) return false
                    const cmp = childComponentMap.get(ctx.entity.id)
                    if (!cmp) return false
                    const sortOrders = childComponents.map((a) => a.sortOrder ?? 0)
                    const maxSort = Math.max(...sortOrders)
                    return (cmp.sortOrder ?? 0) < maxSort
                },
                onSelect: async (ctx: ActionContext<ComponentDisplay, ComponentLocalizedPayload>) => {
                    try {
                        const contextExtras = ctx as ActionContext<ComponentDisplay, ComponentLocalizedPayload> &
                            ChildComponentContextExtras
                        if (typeof contextExtras.moveComponent === 'function') {
                            await contextExtras.moveComponent(ctx.entity.id, 'down')
                        }
                    } catch (error: unknown) {
                        notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
                    }
                }
            },
            {
                id: 'set-required',
                labelKey: 'components.actions.setRequired',
                icon: <CheckCircleOutlineIcon />,
                order: 40,
                group: 'flags',
                visible: (ctx: ActionContext<ComponentDisplay, ComponentLocalizedPayload>) => {
                    const raw = childComponentMap.get(ctx.entity.id)
                    const isRequired = raw?.isRequired ?? ctx.entity?.isRequired ?? false
                    return !isRequired
                },
                onSelect: async (ctx: ActionContext<ComponentDisplay, ComponentLocalizedPayload>) => {
                    try {
                        const contextExtras = ctx as ActionContext<ComponentDisplay, ComponentLocalizedPayload> &
                            ChildComponentContextExtras
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
                labelKey: 'components.actions.setOptional',
                icon: <RadioButtonUncheckedIcon />,
                order: 41,
                group: 'flags',
                visible: (ctx: ActionContext<ComponentDisplay, ComponentLocalizedPayload>) => {
                    const raw = childComponentMap.get(ctx.entity.id)
                    const isRequired = raw?.isRequired ?? ctx.entity?.isRequired ?? false
                    const isDisplayComponent = raw?.isDisplayComponent ?? getDisplayComponentFlag(ctx.entity)
                    return isRequired && !isDisplayComponent
                },
                onSelect: async (ctx: ActionContext<ComponentDisplay, ComponentLocalizedPayload>) => {
                    try {
                        const contextExtras = ctx as ActionContext<ComponentDisplay, ComponentLocalizedPayload> &
                            ChildComponentContextExtras
                        if (typeof contextExtras.toggleRequired === 'function') {
                            await contextExtras.toggleRequired(ctx.entity.id, false)
                        }
                    } catch (error: unknown) {
                        notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
                    }
                }
            },
            {
                id: 'set-display-component',
                labelKey: 'components.actions.setDisplayComponent',
                icon: <StarOutlineIcon />,
                order: 50,
                group: 'flags',
                visible: (ctx: ActionContext<ComponentDisplay, ComponentLocalizedPayload>) => {
                    const raw = childComponentMap.get(ctx.entity.id)
                    const isDisplayComponent = raw?.isDisplayComponent ?? getDisplayComponentFlag(ctx.entity)
                    return !isDisplayComponent
                },
                onSelect: async (ctx: ActionContext<ComponentDisplay, ComponentLocalizedPayload>) => {
                    try {
                        const contextExtras = ctx as ActionContext<ComponentDisplay, ComponentLocalizedPayload> &
                            ChildComponentContextExtras
                        if (typeof contextExtras.toggleDisplayComponent === 'function') {
                            await contextExtras.toggleDisplayComponent(ctx.entity.id, true)
                        }
                    } catch (error: unknown) {
                        notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
                    }
                }
            },
            {
                id: 'clear-display-component',
                labelKey: 'components.actions.clearDisplayComponent',
                icon: <StarIcon />,
                order: 51,
                group: 'flags',
                visible: (ctx: ActionContext<ComponentDisplay, ComponentLocalizedPayload>) => {
                    const raw = childComponentMap.get(ctx.entity.id)
                    const isDisplayComponent = raw?.isDisplayComponent ?? getDisplayComponentFlag(ctx.entity)
                    const displayComponentsCount = childComponents.reduce(
                        (count, component) => count + (component.isDisplayComponent ? 1 : 0),
                        0
                    )
                    return isDisplayComponent && displayComponentsCount > 1
                },
                onSelect: async (ctx: ActionContext<ComponentDisplay, ComponentLocalizedPayload>) => {
                    try {
                        const contextExtras = ctx as ActionContext<ComponentDisplay, ComponentLocalizedPayload> &
                            ChildComponentContextExtras
                        if (typeof contextExtras.toggleDisplayComponent === 'function') {
                            await contextExtras.toggleDisplayComponent(ctx.entity.id, false)
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
                enabled: (ctx: ActionContext<ComponentDisplay, ComponentLocalizedPayload>) => {
                    const raw = childComponentMap.get(ctx.entity.id) ?? (ctx.entity as unknown as Component)
                    return canDeleteChildComponent(raw)
                },
                onSelect: (ctx: ActionContext<ComponentDisplay, ComponentLocalizedPayload>) => {
                    const cmp = childComponentMap.get(ctx.entity.id) ?? (ctx.entity as unknown as Component)
                    openDelete(cmp)
                }
            }
        ],
        [allowComponentCopy, canDeleteChildComponent, childComponents, childComponentMap, openCopy, openDelete, openEdit]
    )

    /** Factory function creating action context for BaseEntityMenu */
    const createChildComponentContext = useCallback(
        (baseContext: Record<string, unknown>) => ({
            ...baseContext,
            childComponentMap,
            uiLocale: preferredVlcLocale,
            metahubId,
            objectCollectionId,
            moveComponent: async (id: string, direction: 'up' | 'down') => {
                await moveComponentMutation.mutateAsync({
                    metahubId,
                    treeEntityId,
                    objectCollectionId,
                    componentId: id,
                    direction
                })
                await invalidateChildQueries()
            },
            toggleRequired: async (id: string, isRequired: boolean) => {
                await toggleRequiredMutation.mutateAsync({
                    metahubId,
                    treeEntityId,
                    objectCollectionId,
                    componentId: id,
                    isRequired
                })
                await invalidateChildQueries()
            },
            toggleDisplayComponent: async (id: string, isDisplayComponent: boolean) => {
                if (isDisplayComponent) {
                    await setDisplayComponentMutation.mutateAsync({
                        metahubId,
                        treeEntityId,
                        objectCollectionId,
                        componentId: id
                    })
                } else {
                    await clearDisplayComponentMutation.mutateAsync({
                        metahubId,
                        treeEntityId,
                        objectCollectionId,
                        componentId: id
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
            childComponentMap,
            metahubId,
            treeEntityId,
            objectCollectionId,
            preferredVlcLocale,
            moveComponentMutation,
            toggleRequiredMutation,
            setDisplayComponentMutation,
            clearDisplayComponentMutation,
            invalidateChildQueries,
            enqueueSnackbar
        ]
    )

    const localizedDefaults = useMemo(() => {
        const defaultDataType = allowedChildDataTypes.includes('STRING') ? 'STRING' : allowedChildDataTypes[0] ?? 'STRING'
        return {
            nameVlc: null,
            codename: null,
            codenameTouched: false,
            dataType: defaultDataType as ComponentDefinitionDataType,
            isRequired: childComponents.length === 0,
            isDisplayComponent: childComponents.length === 0,
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
    }, [childComponents.length, allowedChildDataTypes])

    const validate = useCallback(
        (values: GenericFormValues) => {
            const errors: Record<string, string> = {}
            if (!hasPrimaryContent(values.nameVlc)) {
                errors.nameVlc = tc('crud.nameRequired', 'Name is required')
            }
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
            const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? 'en'
            const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
            const normalized = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
            if (!normalized) errors.codename = t('components.validation.codenameRequired', 'Codename is required')
            else if (!isValidCodenameForStyle(normalized, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed))
                errors.codename = t('components.validation.codenameInvalid')
            if (values.dataType === 'REF') {
                if (!values.targetEntityKind) {
                    errors.targetEntityKind = t(
                        'components.validation.targetEntityKindRequired',
                        'Target entity type is required for Reference type'
                    )
                }
                if (!values.targetEntityId) {
                    errors.targetEntityId = t(
                        'components.validation.targetEntityIdRequired',
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
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
            const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? 'en'
            const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
            const hasBasic =
                !values._hasCodenameDuplicate &&
                hasPrimaryContent(values.nameVlc) &&
                isValidCodenameForStyle(
                    normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet),
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
            forceDisplayComponentWhenLocked = true,
            displayComponentLockedOverride?: boolean,
            editingEntityId?: string | null
        ): TabConfig[] => {
            const tabs: TabConfig[] = [
                {
                    id: 'general',
                    label: t('components.tabs.general', 'General'),
                    content: (
                        <ComponentFormFields
                            values={values}
                            setValue={setValue}
                            isLoading={formLoading}
                            errors={errors}
                            editingEntityId={editingEntityId}
                            uiLocale={preferredVlcLocale}
                            nameLabel={tc('fields.name', 'Name')}
                            codenameLabel={t('components.codename', 'Codename')}
                            codenameHelper={t('components.codenameHelper', 'Unique identifier')}
                            dataTypeLabel={t('components.dataType', 'Data Type')}
                            requiredLabel={t('components.isRequiredLabel', 'Required')}
                            hideDisplayComponent
                            dataTypeOptions={childDataTypeOptions}
                            typeSettingsLabel={t('components.typeSettings.title', 'Type Settings')}
                            stringMaxLengthLabel={t('components.typeSettings.string.maxLength', 'Max Length')}
                            stringMinLengthLabel={t('components.typeSettings.string.minLength', 'Min Length')}
                            stringVersionedLabel={t('components.typeSettings.string.versioned', 'Versioned (VLC)')}
                            stringLocalizedLabel={t('components.typeSettings.string.localized', 'Localized (VLC)')}
                            numberPrecisionLabel={t('components.typeSettings.number.precision', 'Precision')}
                            numberScaleLabel={t('components.typeSettings.number.scale', 'Scale')}
                            numberMinLabel={t('components.typeSettings.number.min', 'Min Value')}
                            numberMaxLabel={t('components.typeSettings.number.max', 'Max Value')}
                            numberNonNegativeLabel={t('components.typeSettings.number.nonNegative', 'Non-negative only')}
                            dateCompositionLabel={t('components.typeSettings.date.composition', 'Date Composition')}
                            dateCompositionOptions={[
                                { value: 'date', label: t('components.typeSettings.date.compositionOptions.date', 'Date only') },
                                { value: 'time', label: t('components.typeSettings.date.compositionOptions.time', 'Time only') },
                                {
                                    value: 'datetime',
                                    label: t('components.typeSettings.date.compositionOptions.datetime', 'Date and Time')
                                }
                            ]}
                            physicalTypeLabel={t('components.physicalType.label', 'PostgreSQL type')}
                            metahubId={metahubId}
                            currentObjectCollectionId={objectCollectionId}
                            dataTypeDisabled={isEditMode}
                            dataTypeHelperText={
                                isEditMode
                                    ? t('components.edit.typeChangeDisabled', 'Data type cannot be changed after creation')
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
                    label: t('components.tabs.presentation', 'Presentation'),
                    content: (
                        <PresentationTabFields
                            values={values}
                            setValue={setValue}
                            isLoading={formLoading}
                            metahubId={metahubId}
                            displayComponentLabel={t('components.isDisplayComponentLabel', 'Display component')}
                            displayComponentHelper={t(
                                'components.isDisplayComponentHelper',
                                'Use as representation when referencing records of this object'
                            )}
                            displayComponentLocked={displayComponentLockedOverride ?? childComponents.length === 0}
                            forceDisplayComponentWhenLocked={forceDisplayComponentWhenLocked}
                            headerAsCheckboxLabel={t('components.presentation.headerAsCheckbox', 'Display header as checkbox')}
                            headerAsCheckboxHelper={t(
                                'components.presentation.headerAsCheckboxHelper',
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
        [preferredVlcLocale, t, tc, metahubId, objectCollectionId, childDataTypeOptions, childComponents.length]
    )

    const handleCreate = async (data: GenericFormValues) => {
        setDialogError(null)
        try {
            const nameVlc = data.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const codenameValue = data.codename as VersionedLocalizedContent<string> | null | undefined
            const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
            if (!nameInput || !namePrimaryLocale) {
                setDialogError(tc('crud.nameRequired'))
                return
            }
            const codenamePrimaryLocale = codenameValue?._primary ?? namePrimaryLocale
            const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
            const codename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
            if (!codename) {
                setDialogError(t('components.validation.codenameRequired'))
                return
            }
            const codenamePayload = ensureLocalizedContent(codenameValue, namePrimaryLocale, codename)
            const dataType = (data.dataType as string) ?? 'STRING'
            const targetEntityId = dataType === 'REF' ? (data.targetEntityId as string | null | undefined) ?? null : undefined
            const targetEntityKind = dataType === 'REF' ? (data.targetEntityKind as EntityKind | null | undefined) ?? null : undefined
            const uiConfig = (data.uiConfig as Record<string, unknown>) ?? {}
            const normalizedUiConfig = sanitizeChildComponentUiConfig(dataType as ComponentDefinitionDataType, targetEntityKind, uiConfig)
            const payload: ComponentLocalizedPayload & {
                validationRules?: Record<string, unknown>
                uiConfig?: Record<string, unknown>
                isRequired?: boolean
                isDisplayComponent?: boolean
                targetEntityId?: string | null
                targetEntityKind?: EntityKind | null
            } = {
                codename: codenamePayload,
                dataType: dataType as ComponentDefinitionDataType,
                isRequired: Boolean(data.isRequired),
                isDisplayComponent: Boolean(data.isDisplayComponent),
                name: nameInput,
                namePrimaryLocale,
                validationRules: data.validationRules,
                uiConfig: normalizedUiConfig,
                targetEntityId,
                targetEntityKind
            }

            close('create')
            createChildComponentMutation.mutate(
                {
                    metahubId,
                    treeEntityId,
                    objectCollectionId,
                    parentComponentId,
                    data: payload
                },
                {
                    onError: (e: unknown) => {
                        if (extractResponseCode(e) === 'TABLE_CHILD_LIMIT_REACHED') {
                            const max = extractResponseMaxChildComponents(e)
                            setDialogError(
                                t('components.tableValidation.maxChildComponents', 'Maximum {{max}} child components per TABLE', {
                                    max: max ?? maxChildComponentsLimit ?? '—'
                                })
                            )
                        } else {
                            const msg = extractResponseMessage(e) ?? (e instanceof Error ? e.message : '')
                            const localizedMsg =
                                localizeTableValidationError(e, t, maxChildComponentsLimit) || msg || t('components.createError')
                            setDialogError(localizedMsg)
                        }
                        openCreate()
                    },
                    onSettled: () => {
                        void onRefresh?.()
                    }
                }
            )
        } catch (e: unknown) {
            if (extractResponseCode(e) === 'TABLE_CHILD_LIMIT_REACHED') {
                const max = extractResponseMaxChildComponents(e)
                setDialogError(
                    t('components.tableValidation.maxChildComponents', 'Maximum {{max}} child components per TABLE', {
                        max: max ?? maxChildComponentsLimit ?? '—'
                    })
                )
                return
            }
            const msg = extractResponseMessage(e) ?? (e instanceof Error ? e.message : '')
            const localizedMsg = localizeTableValidationError(e, t, maxChildComponentsLimit) || msg || t('components.createError')
            setDialogError(localizedMsg)
        }
    }

    const handleUpdate = async (data: GenericFormValues) => {
        if (!dialogs.edit.item) return
        const currentComponent = dialogs.edit.item
        setEditDialogError(null)
        try {
            const nameVlc = data.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const codenameValue = data.codename as VersionedLocalizedContent<string> | null | undefined
            const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
            if (!nameInput || !namePrimaryLocale) {
                setEditDialogError(tc('crud.nameRequired'))
                return
            }
            const codenamePrimaryLocale = codenameValue?._primary ?? namePrimaryLocale
            const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
            const codename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
            if (!codename) {
                setEditDialogError(t('components.validation.codenameRequired'))
                return
            }
            const codenamePayload = ensureLocalizedContent(codenameValue, namePrimaryLocale, codename)
            const dataType = (data.dataType as string) ?? currentComponent.dataType
            const targetEntityId = dataType === 'REF' ? (data.targetEntityId as string | null | undefined) ?? null : null
            const targetEntityKind = dataType === 'REF' ? (data.targetEntityKind as EntityKind | null | undefined) ?? null : null
            const uiConfig = (data.uiConfig as Record<string, unknown>) ?? {}
            const normalizedUiConfig = sanitizeChildComponentUiConfig(dataType as ComponentDefinitionDataType, targetEntityKind, uiConfig)
            const payload: ComponentLocalizedPayload & {
                validationRules?: Record<string, unknown>
                uiConfig?: Record<string, unknown>
                isRequired?: boolean
                expectedVersion?: number
                targetEntityId?: string | null
                targetEntityKind?: EntityKind | null
            } = {
                codename: codenamePayload,
                dataType: dataType as ComponentDefinitionDataType,
                isRequired: Boolean(data.isRequired),
                name: nameInput,
                namePrimaryLocale,
                validationRules: data.validationRules,
                uiConfig: normalizedUiConfig,
                targetEntityId,
                targetEntityKind,
                expectedVersion: currentComponent.version
            }

            close('edit')
            updateChildComponentMutation.mutate(
                {
                    metahubId,
                    treeEntityId,
                    objectCollectionId,
                    parentComponentId,
                    componentId: currentComponent.id,
                    data: payload
                },
                {
                    onError: (e: unknown) => {
                        const msg = extractResponseMessage(e) ?? (e instanceof Error ? e.message : '')
                        setEditDialogError(
                            localizeTableValidationError(e, t, maxChildComponentsLimit) ||
                                msg ||
                                t('components.updateError', 'Failed to update component')
                        )
                        openEdit(currentComponent)
                    },
                    onSettled: () => {
                        void onRefresh?.()
                    }
                }
            )
        } catch (e: unknown) {
            const msg = extractResponseMessage(e) ?? (e instanceof Error ? e.message : '')
            setEditDialogError(
                localizeTableValidationError(e, t, maxChildComponentsLimit) ||
                    msg ||
                    t('components.updateError', 'Failed to update component')
            )
        }
    }

    const handleCopy = (data: GenericFormValues) => {
        if (!dialogs.copy.item) return
        const currentComponent = dialogs.copy.item
        setCopyDialogError(null)
        const nameVlc = data.nameVlc as VersionedLocalizedContent<string> | null | undefined
        const codenameValue = data.codename as VersionedLocalizedContent<string> | null | undefined
        const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
        if (!nameInput || !namePrimaryLocale) {
            setCopyDialogError(tc('crud.nameRequired', 'Name is required'))
            return
        }

        const codenamePrimaryLocale = codenameValue?._primary ?? namePrimaryLocale
        const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
        const codename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
        if (!codename) {
            setCopyDialogError(t('components.validation.codenameRequired', 'Codename is required'))
            return
        }
        const codenamePayload = ensureLocalizedContent(codenameValue, namePrimaryLocale, codename)

        close('copy')
        copyChildComponentMutation.mutate(
            {
                metahubId,
                treeEntityId,
                objectCollectionId,
                parentComponentId,
                componentId: currentComponent.id,
                data: {
                    codename: codenamePayload,
                    name: nameInput,
                    namePrimaryLocale,
                    validationRules: data.validationRules ?? currentComponent.validationRules ?? {},
                    uiConfig: data.uiConfig ?? currentComponent.uiConfig ?? {},
                    isRequired: typeof data.isRequired === 'boolean' ? data.isRequired : Boolean(currentComponent.isRequired)
                }
            },
            {
                onError: (e: unknown) => {
                    const msg = extractResponseMessage(e) ?? (e instanceof Error ? e.message : '')
                    setCopyDialogError(msg || t('components.copyError', 'Failed to copy component'))
                    openCopy(currentComponent)
                },
                onSettled: () => {
                    void onRefresh?.()
                }
            }
        )
    }

    /** Build initial values for edit dialog from the existing component. */
    const editInitialValues = useMemo(() => {
        if (!dialogs.edit.item) return localizedDefaults
        const cmp = dialogs.edit.item
        return {
            nameVlc: cmp.name,
            codename: ensureEntityCodenameContent(cmp, i18n.language, cmp.codename || ''),
            codenameTouched: true,
            dataType: cmp.dataType as ComponentDefinitionDataType,
            isRequired: cmp.isRequired,
            isDisplayComponent: cmp.isDisplayComponent ?? false,
            targetEntityId:
                cmp.targetEntityId ?? (cmp.validationRules as { targetEntityId?: string | null } | undefined)?.targetEntityId ?? null,
            targetEntityKind:
                cmp.targetEntityKind ??
                (cmp.validationRules as { targetEntityKind?: EntityKind | null } | undefined)?.targetEntityKind ??
                null,
            validationRules: cmp.validationRules ?? {},
            uiConfig: cmp.uiConfig ?? {}
        }
    }, [dialogs.edit.item, i18n.language, localizedDefaults])

    const copyInitialValues = useMemo(() => {
        if (!dialogs.copy.item) return null
        const source = dialogs.copy.item
        const sourceName = getVLCString(source.codename) || 'component'
        return {
            nameVlc: appendCopySuffix(source.name ?? null, i18n.language, sourceName),
            codename: null,
            codenameTouched: false,
            dataType: source.dataType as ComponentDefinitionDataType,
            isRequired: source.isRequired ?? false,
            targetEntityId: source.targetEntityId ?? null,
            targetEntityKind: source.targetEntityKind ?? null,
            isDisplayComponent: false,
            validationRules: source.validationRules ?? {},
            uiConfig: source.uiConfig ?? {}
        }
    }, [dialogs.copy.item, i18n.language])

    // Filtered child components (for search) and their display representations
    const filteredChildComponents = useMemo(() => {
        if (!searchFilter) return childComponents
        const lowerSearch = searchFilter.toLowerCase()
        return childComponents.filter((cmp) => {
            if (cmp.codename.toLowerCase().includes(lowerSearch)) return true
            const name = cmp.name
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
    }, [childComponents, searchFilter])

    const tableData = useMemo(
        () => filteredChildComponents.map((cmp) => toComponentDisplay(cmp, i18n.language)),
        [filteredChildComponents, i18n.language]
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
                        {t('components.childComponents', 'Child Components')} ({childComponents.length})
                    </Typography>
                    <Tooltip
                        title={
                            isChildLimitReached && maxChildComponentsLimit !== null
                                ? t('components.typeSettings.table.maxChildComponentsReached', 'Maximum {{max}} child components reached', {
                                      max: maxChildComponentsLimit
                                  })
                                : ''
                        }
                    >
                        <span>
                            <Button
                                variant='contained'
                                size='small'
                                onClick={() => openCreate()}
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
                        const baseIds = filteredChildComponents.map((a) => a.id)
                        let effectiveData = baseData
                        let effectiveIds = baseIds

                        if (pendingTransfer) {
                            if (pendingTransfer.fromContainerId === containerId) {
                                // Source container: hide the dragged item
                                effectiveData = baseData.filter((d) => d.id !== pendingTransfer.itemId)
                                effectiveIds = baseIds.filter((id) => id !== pendingTransfer.itemId)
                            } else if (pendingTransfer.toContainerId === containerId && dndActiveAttr) {
                                // Target container: inject ghost at insertion point
                                const ghost = toComponentDisplay(dndActiveAttr, i18n.language)
                                const insertAt = Math.min(pendingTransfer.insertIndex, baseData.length)
                                effectiveData = [...baseData.slice(0, insertAt), ghost, ...baseData.slice(insertAt)]
                                effectiveIds = [...baseIds.slice(0, insertAt), pendingTransfer.itemId, ...baseIds.slice(insertAt)]
                            }
                        }

                        return (
                            <FlowListTable<ComponentDisplay>
                                data={effectiveData}
                                customColumns={childColumns}
                                compact
                                sortableRows
                                externalDndContext
                                droppableContainerId={containerId}
                                sortableItemIds={effectiveIds}
                                dragHandleAriaLabel={t('components.dnd.dragHandle', 'Drag to reorder')}
                                isDropTarget={isDropTarget}
                                isDropTargetInvalid={isInvalidDropTarget}
                                emptyStateMessage={
                                    isInvalidDropTarget && maxChildComponentsLimit !== null
                                        ? t(
                                              'components.typeSettings.table.maxChildComponentsReached',
                                              'Maximum {{max}} child components reached',
                                              { max: maxChildComponentsLimit }
                                          )
                                        : t('components.noChildComponents', 'No child components yet')
                                }
                                renderActions={(row: ComponentDisplay) => {
                                    const originalComponent = childComponents.find((a) => a.id === row.id)
                                    if (!originalComponent) return null
                                    return (
                                        <BaseEntityMenu<ComponentDisplay, ComponentLocalizedPayload>
                                            entity={toComponentDisplay(originalComponent, i18n.language)}
                                            entityKind='child-component'
                                            descriptors={childActionDescriptors}
                                            namespace='metahubs'
                                            menuButtonLabelKey='flowList:menu.button'
                                            i18nInstance={i18n}
                                            createContext={createChildComponentContext}
                                        />
                                    )
                                }}
                            />
                        )
                    })()
                )}

                <EntityFormDialog
                    open={dialogs.create.open}
                    title={t('components.createChildDialog.title', 'Create Child Component')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={tc('actions.create', 'Create')}
                    savingButtonText={tc('actions.creating', 'Creating...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    loading={createChildComponentMutation.isPending}
                    error={dialogError || undefined}
                    onClose={() => close('create')}
                    onSave={handleCreate}
                    hideDefaultFields
                    initialExtraValues={localizedDefaults}
                    tabs={(args) => buildTabs(args, false, true, true, undefined, null)}
                    validate={validate}
                    canSave={canSave}
                />

                <EntityFormDialog
                    key={`child-edit-${dialogs.edit.item?.id ?? 'none'}-${dialogs.edit.item?.version ?? 0}`}
                    open={dialogs.edit.open}
                    mode='edit'
                    title={t('components.editChildDialog.title', 'Edit Child Component')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={tc('actions.save', 'Save')}
                    savingButtonText={tc('actions.saving', 'Saving...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    loading={updateChildComponentMutation.isPending}
                    error={editDialogError || undefined}
                    onClose={() => close('edit')}
                    onSave={handleUpdate}
                    hideDefaultFields
                    initialExtraValues={editInitialValues}
                    tabs={(args) =>
                        buildTabs(
                            args,
                            true,
                            true,
                            true,
                            dialogs.edit.item?.isDisplayComponent ? true : undefined,
                            dialogs.edit.item?.id ?? null
                        )
                    }
                    validate={validate}
                    canSave={canSave}
                    showDeleteButton
                    deleteButtonText={tc('actions.delete', 'Delete')}
                    deleteButtonDisabled={!canDeleteChildComponent(dialogs.edit.item)}
                    onDelete={() => {
                        if (dialogs.edit.item) {
                            openDelete(dialogs.edit.item)
                            close('edit')
                        }
                    }}
                />

                <EntityFormDialog
                    key={`child-copy-${dialogs.copy.item?.id ?? 'none'}-${dialogs.copy.item?.version ?? 0}`}
                    open={dialogs.copy.open}
                    mode='copy'
                    title={t('components.copyTitle', 'Copy Component')}
                    saveButtonText={t('components.copy.action', 'Copy')}
                    savingButtonText={t('components.copy.actionLoading', 'Copying...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    loading={copyChildComponentMutation.isPending}
                    error={copyDialogError || undefined}
                    onClose={() => close('copy')}
                    onSave={handleCopy}
                    hideDefaultFields
                    initialExtraValues={copyInitialValues ?? localizedDefaults}
                    tabs={(args) => buildTabs(args, true, true, false, false, null)}
                    validate={validate}
                    canSave={(values) => canSave(values)}
                />

                <ConfirmDeleteDialog
                    open={dialogs.delete.open}
                    title={t('components.deleteDialog.title', 'Delete Component')}
                    description={t('components.deleteChildDialog.message', 'Are you sure you want to delete this child component?')}
                    confirmButtonText={tc('actions.delete', 'Delete')}
                    deletingButtonText={tc('actions.deleting', 'Deleting...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onCancel={() => close('delete')}
                    onConfirm={() => {
                        if (!dialogs.delete.item) return
                        const componentId = dialogs.delete.item.id
                        close('delete')
                        deleteChildComponentMutation.mutate(
                            {
                                metahubId,
                                treeEntityId,
                                objectCollectionId,
                                parentComponentId,
                                componentId
                            },
                            {
                                onSettled: () => {
                                    void onRefresh?.()
                                }
                            }
                        )
                    }}
                    loading={deleteChildComponentMutation.isPending}
                />
            </Box>
        </ExistingCodenamesProvider>
    )
}

export default NestedComponentList
