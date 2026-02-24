import { useState, useMemo, useCallback } from 'react'
import { Box, Stack, Typography, Chip, Skeleton, Alert, Tooltip, Button } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
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
import { FlowListTable, BaseEntityMenu, notifyError } from '@universo/template-mui'
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
    getPhysicalDataType,
    formatPhysicalType
} from '../../../types'
import { sanitizeCodename, isValidCodename } from '../../../utils/codename'
import { extractLocalizedInput, hasPrimaryContent } from '../../../utils/localizedInput'
import * as attributesApi from '../api'
import { metahubsQueryKeys, invalidateAttributesQueries } from '../../shared'
import { useMoveAttribute, useToggleAttributeRequired, useSetDisplayAttribute, useClearDisplayAttribute } from '../hooks/mutations'
import AttributeFormFields, { PresentationTabFields } from './AttributeFormFields'

/**
 * Map known backend TABLE validation error messages to localized i18n strings.
 * Returns the localized string if matched, or null to fall back to default error.
 */
function localizeTableValidationError(
    msg: string,
    t: (key: string, defaultValue: string, opts?: Record<string, unknown>) => string
): string | null {
    if (!msg) return null
    if (msg.includes('Nested TABLE attributes are not allowed')) {
        return t('attributes.tableValidation.nestedTableNotAllowed', 'Nested TABLE attributes are not allowed')
    }
    const maxChildMatch = msg.match(/Maximum (\d+) child attributes per TABLE/)
    if (maxChildMatch) {
        return t('attributes.tableValidation.maxChildAttributes', 'Maximum {{max}} child attributes per TABLE', { max: maxChildMatch[1] })
    }
    const maxTableMatch = msg.match(/Maximum (\d+) TABLE attributes per catalog/)
    if (maxTableMatch) {
        return t('attributes.tableValidation.maxTableAttributes', 'Maximum {{max}} TABLE attributes per catalog', { max: maxTableMatch[1] })
    }
    if (msg.includes('TABLE attributes cannot be set as display attribute')) {
        return t('attributes.tableValidation.tableCannotBeDisplay', 'TABLE attributes cannot be set as the display attribute')
    }
    if (msg.includes('TABLE attributes cannot be set as required')) {
        return t('attributes.tableValidation.tableCannotBeRequired', 'TABLE attributes cannot be set as required')
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
    /** When set, only children matching this search term are shown */
    searchFilter?: string
    onRefresh?: () => void
}

const ChildAttributeList = ({ metahubId, hubId, catalogId, parentAttributeId, searchFilter, onRefresh }: ChildAttributeListProps) => {
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
    const [deleteState, setDeleteState] = useState<{ open: boolean; attribute: Attribute | null }>({
        open: false,
        attribute: null
    })

    // Mutation hooks for child attribute actions
    const moveAttributeMutation = useMoveAttribute()
    const toggleRequiredMutation = useToggleAttributeRequired()
    const setDisplayAttributeMutation = useSetDisplayAttribute()
    const clearDisplayAttributeMutation = useClearDisplayAttribute()

    const queryKey = ['metahubs', 'childAttributes', metahubId, catalogId, parentAttributeId] as const

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

    const childAttributes = data?.items ?? []

    /** Map from attribute id to full Attribute for quick context lookups */
    const childAttributeMap = useMemo(() => {
        const map = new Map<string, Attribute>()
        childAttributes.forEach((attr) => map.set(attr.id, attr))
        return map
    }, [childAttributes])

    /** Invalidate both child-specific and parent-level queries */
    const invalidateChildQueries = useCallback(async () => {
        queryClient.invalidateQueries({ queryKey })
        // Also invalidate element-scoped child attribute & enum caches so stale uiConfig is refreshed
        queryClient.invalidateQueries({ queryKey: ['metahubs', 'childAttributesForElements', metahubId, catalogId] })
        queryClient.invalidateQueries({ queryKey: ['metahubs', 'childEnumValues', metahubId] })
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

    const childDataTypeOptions = useMemo(
        () =>
            TABLE_CHILD_DATA_TYPES.map((dt) => ({
                value: dt as AttributeDataType,
                label: t(`attributes.dataTypeOptions.${dt.toLowerCase()}`, dt)
            })),
        [t]
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
                    const isDisplayAttr = rawAttribute?.isDisplayAttribute ?? (row as any)?.isDisplayAttribute ?? false
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
        [t, tc]
    )

    const images = useMemo(() => {
        const map: Record<string, any[]> = {}
        childAttributes.forEach((attr) => {
            if (attr?.id) map[attr.id] = []
        })
        return map
    }, [childAttributes])

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
                        if (typeof (ctx as any).moveAttribute === 'function') {
                            await (ctx as any).moveAttribute(ctx.entity.id, 'up')
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
                        if (typeof (ctx as any).moveAttribute === 'function') {
                            await (ctx as any).moveAttribute(ctx.entity.id, 'down')
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
                        if (typeof (ctx as any).toggleRequired === 'function') {
                            await (ctx as any).toggleRequired(ctx.entity.id, true)
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
                    return isRequired
                },
                onSelect: async (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
                    try {
                        if (typeof (ctx as any).toggleRequired === 'function') {
                            await (ctx as any).toggleRequired(ctx.entity.id, false)
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
                    const isDisplayAttribute = raw?.isDisplayAttribute ?? (ctx.entity as any)?.isDisplayAttribute ?? false
                    return !isDisplayAttribute
                },
                onSelect: async (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
                    try {
                        if (typeof (ctx as any).toggleDisplayAttribute === 'function') {
                            await (ctx as any).toggleDisplayAttribute(ctx.entity.id, true)
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
                    const isDisplayAttribute = raw?.isDisplayAttribute ?? (ctx.entity as any)?.isDisplayAttribute ?? false
                    return isDisplayAttribute
                },
                onSelect: async (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
                    try {
                        if (typeof (ctx as any).toggleDisplayAttribute === 'function') {
                            await (ctx as any).toggleDisplayAttribute(ctx.entity.id, false)
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
                    const raw = childAttributeMap.get(ctx.entity.id)
                    return !(raw?.isDisplayAttribute ?? (ctx.entity as any)?.isDisplayAttribute ?? false)
                },
                onSelect: (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
                    const attr = childAttributeMap.get(ctx.entity.id) ?? (ctx.entity as unknown as Attribute)
                    setDeleteState({ open: true, attribute: attr })
                }
            }
        ],
        [childAttributes, childAttributeMap]
    )

    /** Factory function creating action context for BaseEntityMenu */
    const createChildAttributeContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            childAttributeMap,
            uiLocale: i18n.language,
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
            i18n.language,
            metahubId,
            hubId,
            catalogId,
            moveAttributeMutation,
            toggleRequiredMutation,
            setDisplayAttributeMutation,
            clearDisplayAttributeMutation,
            invalidateChildQueries,
            enqueueSnackbar
        ]
    )

    const localizedDefaults = useMemo(
        () => ({
            nameVlc: null,
            codename: '',
            codenameTouched: false,
            dataType: 'STRING' as AttributeDataType,
            isRequired: false,
            isDisplayAttribute: childAttributes.length === 0,
            targetEntityId: null,
            targetEntityKind: null,
            validationRules: {},
            uiConfig: {}
        }),
        [childAttributes.length]
    )

    const validate = useCallback(
        (values: Record<string, any>) => {
            const errors: Record<string, string> = {}
            if (!hasPrimaryContent(values.nameVlc)) {
                errors.nameVlc = tc('crud.nameRequired', 'Name is required')
            }
            const normalized = sanitizeCodename(values.codename ?? '')
            if (!normalized) errors.codename = t('attributes.validation.codenameRequired', 'Codename is required')
            else if (!isValidCodename(normalized)) errors.codename = t('attributes.validation.codenameInvalid')
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
        [t, tc]
    )

    const canSave = useCallback((values: Record<string, any>) => {
        const hasBasic = hasPrimaryContent(values.nameVlc) && isValidCodename(sanitizeCodename(values.codename ?? ''))
        if (values.dataType === 'REF') {
            return hasBasic && Boolean(values.targetEntityKind) && Boolean(values.targetEntityId)
        }
        return hasBasic
    }, [])

    const buildTabs = useCallback(
        (
            {
                values,
                setValue,
                isLoading: formLoading,
                errors
            }: {
                values: Record<string, any>
                setValue: (name: string, value: any) => void
                isLoading: boolean
                errors?: Record<string, string>
            },
            isEditMode: boolean
        ): TabConfig[] => [
            {
                id: 'general',
                label: t('attributes.tabs.general', 'General'),
                content: (
                    <AttributeFormFields
                        values={values}
                        setValue={setValue}
                        isLoading={formLoading}
                        errors={errors}
                        uiLocale={i18n.language}
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
                            isEditMode ? t('attributes.edit.typeChangeDisabled', 'Data type cannot be changed after creation') : undefined
                        }
                        disableVlcToggles={isEditMode}
                    />
                )
            },
            {
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
                        displayAttributeLocked={childAttributes.length === 0}
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
            }
        ],
        [i18n.language, t, tc, metahubId, catalogId, childDataTypeOptions, childAttributes.length]
    )

    const handleCreate = async (data: Record<string, any>) => {
        setDialogError(null)
        setCreating(true)
        try {
            const nameVlc = data.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
            if (!nameInput || !namePrimaryLocale) {
                setDialogError(tc('crud.nameRequired'))
                return
            }
            const codename = sanitizeCodename(data.codename ?? '')
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
                dataType: dataType as any,
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
            const msg =
                e && typeof e === 'object' && 'response' in e ? (e as any).response?.data?.message : e instanceof Error ? e.message : ''
            const localizedMsg = localizeTableValidationError(msg, t) || t('attributes.createError')
            setDialogError(localizedMsg)
        } finally {
            setCreating(false)
        }
    }

    const handleUpdate = async (data: Record<string, any>) => {
        if (!editState.attribute) return
        setEditDialogError(null)
        setUpdating(true)
        try {
            const nameVlc = data.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
            if (!nameInput || !namePrimaryLocale) {
                setEditDialogError(tc('crud.nameRequired'))
                return
            }
            const codename = sanitizeCodename(data.codename ?? '')
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
                dataType: dataType as any,
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
            const msg =
                e && typeof e === 'object' && 'response' in e ? (e as any).response?.data?.message : e instanceof Error ? e.message : ''
            setEditDialogError(localizeTableValidationError(msg, t) || t('attributes.updateError', 'Failed to update attribute'))
        } finally {
            setUpdating(false)
        }
    }

    /** Build initial values for edit dialog from the existing attribute. */
    const editInitialValues = useMemo(() => {
        if (!editState.attribute) return localizedDefaults
        const attr = editState.attribute
        return {
            nameVlc: attr.name,
            codename: attr.codename,
            codenameTouched: true,
            dataType: attr.dataType as AttributeDataType,
            isRequired: attr.isRequired,
            isDisplayAttribute: attr.isDisplayAttribute ?? false,
            targetEntityId: attr.targetEntityId ?? (attr.validationRules as any)?.targetEntityId ?? null,
            targetEntityKind: attr.targetEntityKind ?? (attr.validationRules as any)?.targetEntityKind ?? null,
            validationRules: attr.validationRules ?? {},
            uiConfig: attr.uiConfig ?? {}
        }
    }, [editState.attribute, localizedDefaults])

    const tableData = useMemo(() => {
        let filtered = childAttributes
        if (searchFilter) {
            const lowerSearch = searchFilter.toLowerCase()
            filtered = childAttributes.filter((attr) => {
                if (attr.codename.toLowerCase().includes(lowerSearch)) return true
                const name = attr.name
                if (!name) return false
                if (typeof name === 'string') return name.toLowerCase().includes(lowerSearch)
                if (typeof name === 'object' && 'locales' in (name as any)) {
                    const locales = (name as any).locales ?? {}
                    return Object.values(locales).some((entry: any) =>
                        String(entry?.content ?? '')
                            .toLowerCase()
                            .includes(lowerSearch)
                    )
                }
                return false
            })
        }
        return filtered.map((attr) => toAttributeDisplay(attr, i18n.language))
    }, [childAttributes, i18n.language, searchFilter])

    if (error) {
        return (
            <Alert severity='error' sx={{ mb: 1 }}>
                {error instanceof Error ? error.message : t('errors.loadingError')}
            </Alert>
        )
    }

    return (
        <Box>
            <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ mb: 1 }}>
                <Typography variant='caption' color='text.secondary'>
                    {t('attributes.childAttributes', 'Child Attributes')} ({childAttributes.length})
                </Typography>
                <Button
                    variant='contained'
                    size='small'
                    onClick={() => setDialogOpen(true)}
                    startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                    sx={{ borderRadius: 1, height: 28, fontSize: 12, textTransform: 'none' }}
                >
                    {tc('create')}
                </Button>
            </Stack>

            {isLoading ? (
                <Skeleton variant='rectangular' height={60} />
            ) : childAttributes.length === 0 ? (
                <Typography variant='body2' color='text.secondary' sx={{ py: 1, textAlign: 'center' }}>
                    {t('attributes.noChildAttributes', 'No child attributes yet')}
                </Typography>
            ) : (
                <FlowListTable
                    data={tableData}
                    images={images}
                    isLoading={isLoading}
                    customColumns={childColumns}
                    i18nNamespace='flowList'
                    compact
                    renderActions={(row: any) => {
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
                tabs={(args) => buildTabs(args, false)}
                validate={validate}
                canSave={canSave}
            />

            <EntityFormDialog
                key={`child-edit-${editState.attribute?.id ?? 'none'}-${editState.attribute?.version ?? 0}`}
                open={editState.open}
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
                tabs={(args) => buildTabs(args, true)}
                validate={validate}
                canSave={canSave}
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
    )
}

export default ChildAttributeList
