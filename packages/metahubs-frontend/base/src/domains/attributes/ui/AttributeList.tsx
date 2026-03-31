import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Skeleton, Stack, Typography, Chip, Alert, Tooltip, Tabs, Tab, IconButton } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import InfoIcon from '@mui/icons-material/Info'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import StarIcon from '@mui/icons-material/Star'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useSnackbar } from 'notistack'
import { useQueryClient } from '@tanstack/react-query'

// project imports
import {
    TemplateMainCard as MainCard,
    ToolbarControls,
    EmptyListState,
    APIEmptySVG,
    PaginationControls,
    FlowListTable,
    useConfirm,
    revealPendingEntityFeedback,
    useListDialogs
} from '@universo/template-mui'
import type { ActionDescriptor, ActionContext } from '@universo/template-mui'
import { EntityFormDialog, ConfirmDeleteDialog, ConflictResolutionDialog, type TabConfig } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'

import {
    useCreateAttribute,
    useCopyAttribute,
    useUpdateAttribute,
    useDeleteAttribute,
    useMoveAttribute,
    useReorderAttribute,
    useToggleAttributeRequired,
    useSetDisplayAttribute,
    useClearDisplayAttribute,
    useAttributeListData
} from '../hooks'
import { invalidateAttributesQueries, metahubsQueryKeys } from '../../shared'
import type { VersionedLocalizedContent } from '@universo/types'
import {
    Attribute,
    AttributeDisplay,
    AttributeDataType,
    AttributeLocalizedPayload,
    toAttributeDisplay,
    getDefaultValidationRules,
    getPhysicalDataType,
    formatPhysicalType,
    CatalogLocalizedPayload,
    getVLCString
} from '../../../types'
import { isOptimisticLockConflict, extractConflictInfo, type ConflictInfo } from '@universo/utils'
import { getCatalogSystemFieldDefinition } from '@universo/utils'
import { normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../utils/codename'
import { extractLocalizedInput, hasPrimaryContent, ensureLocalizedContent } from '../../../utils/localizedInput'
import attributeActions from './AttributeActions'
import AttributeFormFields, { PresentationTabFields } from './AttributeFormFields'
import ChildAttributeList from './ChildAttributeList'
import { AttributeDndProvider, AttributeDndContainerRegistryProvider, useAttributeDndState } from './dnd'
import { useCodenameConfig } from '../../settings/hooks/useCodenameConfig'
import { useMetahubPrimaryLocale } from '../../settings/hooks/useMetahubPrimaryLocale'
import { useSettingValue } from '../../settings/hooks/useSettings'
import { ExistingCodenamesProvider } from '../../../components'
import {
    buildInitialValues as buildCatalogInitialValues,
    buildFormTabs as buildCatalogFormTabs,
    validateCatalogForm,
    canSaveCatalogForm,
    toPayload as catalogToPayload
} from '../../catalogs/ui/CatalogActions'
import type { CatalogDisplayWithHub } from '../../catalogs/ui/CatalogActions'
import { useUpdateCatalogAtMetahub } from '../../catalogs/hooks/mutations'
import type { AttributeFormValues, ConfirmSpec, CatalogTab } from './attributeListUtils'
import {
    extractResponseData,
    hasResponseStatus,
    extractResponseMessage,
    extractResponseCode,
    extractResponseMaxChildAttributes,
    sanitizeAttributeUiConfig,
    getDataTypeColor
} from './attributeListUtils'

type GenericFormValues = Record<string, unknown>

/**
 * Render-prop component that reads DnD state and provides `isDropTarget` + ghost row data for a container.
 * Must be used inside <AttributeDndProvider>.
 */
const DndDropTarget: React.FC<{
    containerId: string
    children: (props: {
        isDropTarget: boolean
        pendingTransfer: import('./dnd').PendingTransfer | null
        activeAttribute: Attribute | undefined
    }) => React.ReactNode
}> = ({ containerId, children }) => {
    const { activeContainerId, overContainerId, pendingTransfer, activeAttribute } = useAttributeDndState()
    const isDropTarget = overContainerId === containerId && activeContainerId !== null && activeContainerId !== containerId
    return <>{children({ isDropTarget, pendingTransfer, activeAttribute })}</>
}

const AttributeListContent = () => {
    const navigate = useNavigate()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const codenameConfig = useCodenameConfig()
    const preferredVlcLocale = useMetahubPrimaryLocale()

    const {
        metahubId,
        hubIdParam,
        catalogId,
        effectiveHubId,
        hubs,
        isSystemView,
        activeCatalogTab,
        isDedicatedSystemRoute,
        requestedCatalogTab,
        isCatalogResolutionLoading,
        catalogResolutionError,
        catalogForHubResolution,
        isLoading,
        error,
        attributes,
        paginationResult,
        searchValue,
        handleSearchChange,
        codenameEntities,
        attributeMap,
        platformSystemAttributesPolicy,
        limitValue,
        totalAttributes,
        limitReached,
        childSearchMatchParentIds,
        attributeCodenameScope
    } = useAttributeListData()

    const { dialogs, openCreate, openDelete, openConflict, close } = useListDialogs<Attribute>()
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [expandedTableIds, setExpandedTableIds] = useState<Set<string>>(new Set())
    const updateCatalogMutation = useUpdateCatalogAtMetahub()

    const buildCatalogTabPath = useCallback(
        (tab: Extract<CatalogTab, 'attributes' | 'system' | 'elements'>) => {
            if (!metahubId || !catalogId) return ''
            const suffix = tab === 'system' ? 'system' : tab
            if (hubIdParam) {
                return `/metahub/${metahubId}/hub/${hubIdParam}/catalog/${catalogId}/${suffix}`
            }
            return `/metahub/${metahubId}/catalog/${catalogId}/${suffix}`
        },
        [catalogId, hubIdParam, metahubId]
    )

    useEffect(() => {
        if (!metahubId || !catalogId) return
        if (requestedCatalogTab !== 'system' || isDedicatedSystemRoute) return
        const nextPath = buildCatalogTabPath('system')
        if (nextPath) {
            navigate(nextPath, { replace: true })
        }
    }, [buildCatalogTabPath, catalogId, isDedicatedSystemRoute, metahubId, navigate, requestedCatalogTab])

    useEffect(() => {
        paginationResult.actions.goToPage(1)
        setExpandedTableIds(new Set())
    }, [activeCatalogTab, catalogId, paginationResult.actions])

    // Auto-expand TABLE parents that have matching child attributes during search
    useEffect(() => {
        if (childSearchMatchParentIds.length > 0) {
            setExpandedTableIds((prev) => {
                const next = new Set(prev)
                childSearchMatchParentIds.forEach((id) => next.add(id))
                return next
            })
        }
    }, [childSearchMatchParentIds])

    const { confirm } = useConfirm()

    const createAttributeMutation = useCreateAttribute()
    const copyAttributeMutation = useCopyAttribute()
    const updateAttributeMutation = useUpdateAttribute()
    const deleteAttributeMutation = useDeleteAttribute()
    const moveAttributeMutation = useMoveAttribute()
    const reorderMutation = useReorderAttribute()
    const toggleRequiredMutation = useToggleAttributeRequired()
    const setDisplayAttributeMutation = useSetDisplayAttribute()
    const clearDisplayAttributeMutation = useClearDisplayAttribute()
    const pendingInteractionMessage = tc('pendingCreateBlocked', 'This item is still being created. Please wait a moment and try again.')

    // DnD cross-list permission settings
    const allowCrossListRootChildren = useSettingValue<boolean>('catalogs.allowAttributeMoveBetweenRootAndChildren') ?? true
    const allowCrossListBetweenChildren = useSettingValue<boolean>('catalogs.allowAttributeMoveBetweenChildLists') ?? true

    const systemAttributeActions = useMemo<ActionDescriptor<AttributeDisplay, AttributeLocalizedPayload>[]>(
        () => [
            {
                id: 'disable-system-field',
                labelKey: 'attributes.actions.disableSystemField',
                icon: <RadioButtonUncheckedIcon fontSize='small' />,
                order: 10,
                visible: (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
                    const current = attributeMap.get(ctx.entity.id)
                    const systemKey = current?.system?.systemKey ?? ctx.entity.system?.systemKey ?? null
                    const definition = systemKey ? getCatalogSystemFieldDefinition(systemKey) : null
                    const isBlockedPlatformToggle = definition?.layer === 'upl' && !platformSystemAttributesPolicy.allowConfiguration
                    return (
                        (current?.system?.isEnabled ?? ctx.entity.system?.isEnabled ?? true) === true &&
                        definition?.canDisable !== false &&
                        !isBlockedPlatformToggle
                    )
                },
                onSelect: async (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
                    if (typeof ctx.toggleSystemEnabled === 'function') {
                        await ctx.toggleSystemEnabled(ctx.entity.id, false)
                    }
                }
            },
            {
                id: 'enable-system-field',
                labelKey: 'attributes.actions.enableSystemField',
                icon: <CheckCircleOutlineIcon fontSize='small' />,
                order: 11,
                visible: (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
                    const current = attributeMap.get(ctx.entity.id)
                    const systemKey = current?.system?.systemKey ?? ctx.entity.system?.systemKey ?? null
                    const definition = systemKey ? getCatalogSystemFieldDefinition(systemKey) : null
                    const isBlockedPlatformToggle = definition?.layer === 'upl' && !platformSystemAttributesPolicy.allowConfiguration
                    return (current?.system?.isEnabled ?? ctx.entity.system?.isEnabled ?? true) === false && !isBlockedPlatformToggle
                },
                onSelect: async (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
                    if (typeof ctx.toggleSystemEnabled === 'function') {
                        await ctx.toggleSystemEnabled(ctx.entity.id, true)
                    }
                }
            }
        ],
        [attributeMap, platformSystemAttributesPolicy.allowConfiguration]
    )

    const handlePendingAttributeInteraction = useCallback(
        (attributeId: string) => {
            if (!metahubId || !catalogId) return
            revealPendingEntityFeedback({
                queryClient,
                queryKeyPrefix: effectiveHubId
                    ? metahubsQueryKeys.attributes(metahubId, effectiveHubId, catalogId)
                    : metahubsQueryKeys.attributesDirect(metahubId, catalogId),
                entityId: attributeId
            })
            enqueueSnackbar(pendingInteractionMessage, { variant: 'info' })
        },
        [catalogId, effectiveHubId, enqueueSnackbar, metahubId, pendingInteractionMessage, queryClient]
    )

    // DnD: Handle reorder (same-list + cross-list transfer)
    const handleReorder = useCallback(
        async (
            attributeId: string,
            newSortOrder: number,
            newParentAttributeId?: string | null,
            currentParentAttributeId?: string | null
        ) => {
            if (!metahubId || !catalogId) return

            try {
                await reorderMutation.mutateAsync({
                    metahubId,
                    hubId: effectiveHubId,
                    catalogId,
                    attributeId,
                    newSortOrder,
                    newParentAttributeId,
                    currentParentAttributeId
                })
                enqueueSnackbar(t('attributes.reorderSuccess', 'Attribute order updated'), { variant: 'success' })
            } catch (error: unknown) {
                // Handle CODENAME_CONFLICT (409) — offer auto-rename
                const responseData = extractResponseData(error)
                const responseCode = extractResponseCode(error)
                const responseStatus =
                    error && typeof error === 'object' && 'response' in error
                        ? (error as { response?: { status?: number } }).response?.status ?? 0
                        : 0

                if (responseStatus === 409 && responseCode === 'TABLE_CHILD_LIMIT_REACHED') {
                    const max = extractResponseMaxChildAttributes(error)
                    enqueueSnackbar(
                        t('attributes.tableValidation.maxChildAttributes', 'Maximum {{max}} child attributes per TABLE', {
                            max: max ?? '—'
                        }),
                        { variant: 'error' }
                    )
                    return
                }

                if (responseStatus === 409 && responseCode === 'CODENAME_CONFLICT') {
                    const conflictCodename = typeof responseData?.codename === 'string' ? responseData.codename : ''
                    const shouldAutoRename = await confirm({
                        title: t('attributes.dnd.codenameConflictTitle', 'Codename conflict'),
                        description: t(
                            'attributes.dnd.codenameConflictDescription',
                            'An attribute with codename "{{codename}}" already exists in the target list. Move with automatic codename rename?',
                            { codename: conflictCodename }
                        ),
                        confirmButtonName: t('attributes.dnd.confirmMove', 'Move'),
                        cancelButtonName: tc('actions.cancel', 'Cancel')
                    })
                    if (shouldAutoRename) {
                        try {
                            await reorderMutation.mutateAsync({
                                metahubId,
                                hubId: effectiveHubId,
                                catalogId,
                                attributeId,
                                newSortOrder,
                                newParentAttributeId,
                                autoRenameCodename: true,
                                currentParentAttributeId
                            })
                            enqueueSnackbar(t('attributes.reorderSuccess', 'Attribute order updated'), { variant: 'success' })
                        } catch (retryError: unknown) {
                            if (extractResponseCode(retryError) === 'TABLE_CHILD_LIMIT_REACHED') {
                                const max = extractResponseMaxChildAttributes(retryError)
                                enqueueSnackbar(
                                    t('attributes.tableValidation.maxChildAttributes', 'Maximum {{max}} child attributes per TABLE', {
                                        max: max ?? '—'
                                    }),
                                    { variant: 'error' }
                                )
                                return
                            }
                            const msg =
                                retryError instanceof Error
                                    ? retryError.message
                                    : t('attributes.reorderError', 'Failed to reorder attribute')
                            enqueueSnackbar(msg, { variant: 'error' })
                        }
                    }
                    return
                }

                // Other errors — show generic snackbar
                const message = error instanceof Error ? error.message : t('attributes.reorderError', 'Failed to reorder attribute')
                enqueueSnackbar(message, { variant: 'error' })
            }
        },
        [metahubId, catalogId, effectiveHubId, reorderMutation, confirm, enqueueSnackbar, t, tc]
    )

    // DnD: Validate cross-list transfer before applying
    const handleValidateTransfer = useCallback(
        async (attribute: Attribute, targetParentId: string | null, targetContainerItemCount: number): Promise<boolean> => {
            // Display attribute cannot be moved between lists (root ↔ child)
            if (attribute.isDisplayAttribute) {
                await confirm({
                    title: t('attributes.dnd.displayAttributeBlockedTitle', 'Cannot move display attribute'),
                    description: t(
                        'attributes.dnd.displayAttributeBlockedDescription',
                        'This attribute is the display attribute for its list. Assign another attribute as the display attribute first, then try again.'
                    ),
                    confirmButtonName: tc('ok', 'OK'),
                    hideCancelButton: true
                })
                return false
            }

            // TABLE attributes can only exist at root level
            if (attribute.dataType === 'TABLE' && targetParentId !== null) {
                await confirm({
                    title: t('attributes.dnd.tableCannotMoveTitle', 'Cannot move TABLE attribute'),
                    description: t('attributes.dnd.tableCannotMoveDescription', 'TABLE attributes can only exist at the root level.'),
                    confirmButtonName: tc('ok', 'OK'),
                    hideCancelButton: true
                })
                return false
            }

            // Child TABLE limit validation
            if (targetParentId !== null) {
                const targetParent = attributeMap.get(targetParentId)
                const maxChildAttributes =
                    typeof targetParent?.validationRules?.maxChildAttributes === 'number' &&
                    targetParent.validationRules.maxChildAttributes > 0
                        ? targetParent.validationRules.maxChildAttributes
                        : null

                if (maxChildAttributes !== null && targetContainerItemCount >= maxChildAttributes) {
                    await confirm({
                        title: t('attributes.dnd.tableChildLimitTitle', 'Cannot move attribute'),
                        description: t('attributes.tableValidation.maxChildAttributes', 'Maximum {{max}} child attributes per TABLE', {
                            max: maxChildAttributes
                        }),
                        confirmButtonName: tc('ok', 'OK'),
                        hideCancelButton: true
                    })
                    return false
                }
            }

            // Moving to an empty child table — attribute will become display + required
            if (targetParentId !== null && targetContainerItemCount === 0) {
                const shouldMove = await confirm({
                    title: t('attributes.dnd.firstChildAttributeTitle', 'First child attribute'),
                    description: t(
                        'attributes.dnd.firstChildAttributeDescription',
                        'This will be the first attribute in the table. It will automatically become the display attribute and required. After that, it cannot be moved out until another attribute is set as the display attribute.'
                    ),
                    confirmButtonName: t('attributes.dnd.confirmMove', 'Move'),
                    cancelButtonName: tc('actions.cancel', 'Cancel')
                })
                if (!shouldMove) return false
            }

            return true
        },
        [attributeMap, confirm, t, tc]
    )

    const localizedFormDefaults = useMemo<AttributeFormValues>(() => {
        const hasNoAttributes = (attributes?.length ?? 0) === 0
        return {
            nameVlc: null,
            codename: null,
            codenameTouched: false,
            dataType: 'STRING',
            isRequired: hasNoAttributes,
            isDisplayAttribute: hasNoAttributes,
            targetEntityId: null,
            targetEntityKind: null,
            targetConstantId: null,
            validationRules: {
                ...getDefaultValidationRules('STRING'),
                maxLength: 10
            },
            uiConfig: {}
        }
    }, [attributes?.length])

    const validateAttributeForm = useCallback(
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
                errors.codename = t('attributes.validation.codenameRequired', 'Codename is required')
            } else if (
                !isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            ) {
                errors.codename = t('attributes.validation.codenameInvalid', 'Codename contains invalid characters')
            }
            // REF type requires target entity
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
                if (values.targetEntityKind === 'set' && !values.targetConstantId) {
                    errors.targetConstantId = t(
                        'attributes.validation.targetConstantIdRequired',
                        'Target constant is required for references to Set'
                    )
                }
            }
            if (values.dataType === 'REF' && values.targetEntityKind !== 'set' && values.targetConstantId) {
                errors.targetConstantId = t(
                    'attributes.validation.targetConstantOnlyForSet',
                    'Target constant can be selected only for references to Set'
                )
            }
            return Object.keys(errors).length > 0 ? errors : null
        },
        [codenameConfig.allowMixed, codenameConfig.alphabet, codenameConfig.style, t, tc]
    )

    const canSaveAttributeForm = useCallback(
        (values: GenericFormValues) => {
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
            const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? 'en'
            const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
            const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
            const hasBasicInfo =
                !values._hasCodenameDuplicate &&
                hasPrimaryContent(nameVlc) &&
                Boolean(normalizedCodename) &&
                isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            if (values.dataType === 'REF') {
                const hasTarget = Boolean(values.targetEntityKind) && Boolean(values.targetEntityId)
                if (!hasTarget) return false
                if (values.targetEntityKind === 'set') {
                    return Boolean(values.targetConstantId)
                }
                return true
            }
            return hasBasicInfo
        },
        [codenameConfig.allowMixed, codenameConfig.alphabet, codenameConfig.style]
    )

    const renderTabs = useCallback(
        ({
            values,
            setValue,
            isLoading,
            errors
        }: {
            values: GenericFormValues
            setValue: (name: string, value: unknown) => void
            isLoading: boolean
            errors?: Record<string, string>
        }): TabConfig[] => {
            const fieldErrors = errors ?? {}
            const displayAttributeLocked = (attributes?.length ?? 0) === 0
            return [
                {
                    id: 'general',
                    label: t('attributes.tabs.general', 'General'),
                    content: (
                        <AttributeFormFields
                            values={values}
                            setValue={setValue}
                            isLoading={isLoading}
                            errors={fieldErrors}
                            uiLocale={i18n.language}
                            nameLabel={tc('fields.name', 'Name')}
                            codenameLabel={t('attributes.codename', 'Codename')}
                            codenameHelper={t('attributes.codenameHelper', 'Unique identifier')}
                            dataTypeLabel={t('attributes.dataType', 'Data Type')}
                            requiredLabel={t('attributes.isRequiredLabel', 'Required')}
                            displayAttributeLabel={t('attributes.isDisplayAttributeLabel', 'Display attribute')}
                            displayAttributeHelper={t(
                                'attributes.isDisplayAttributeHelper',
                                'Use as representation when referencing elements of this catalog'
                            )}
                            displayAttributeLocked={displayAttributeLocked}
                            dataTypeOptions={[
                                { value: 'STRING', label: t('attributes.dataTypeOptions.string', 'String') },
                                { value: 'NUMBER', label: t('attributes.dataTypeOptions.number', 'Number') },
                                { value: 'BOOLEAN', label: t('attributes.dataTypeOptions.boolean', 'Boolean') },
                                { value: 'DATE', label: t('attributes.dataTypeOptions.date', 'Date') },
                                { value: 'REF', label: t('attributes.dataTypeOptions.ref', 'Reference') },
                                { value: 'JSON', label: t('attributes.dataTypeOptions.json', 'JSON') },
                                { value: 'TABLE', label: t('attributes.dataTypeOptions.table', 'Table') }
                            ]}
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
                                { value: 'datetime', label: t('attributes.typeSettings.date.compositionOptions.datetime', 'Date and Time') }
                            ]}
                            physicalTypeLabel={t('attributes.physicalType.label', 'PostgreSQL type')}
                            metahubId={metahubId!}
                            currentCatalogId={catalogId}
                            hideDisplayAttribute
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
                            isLoading={isLoading}
                            metahubId={metahubId}
                            displayAttributeLabel={t('attributes.isDisplayAttributeLabel', 'Display attribute')}
                            displayAttributeHelper={t(
                                'attributes.isDisplayAttributeHelper',
                                'Use as representation when referencing elements of this catalog'
                            )}
                            displayAttributeLocked={displayAttributeLocked}
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
            ]
        },
        [i18n.language, t, tc, metahubId, catalogId, attributes?.length]
    )

    const attributeColumns = useMemo(() => {
        const columns = [
            {
                id: 'sortOrder',
                label: t('attributes.table.order', '#'),
                width: '3%',
                align: 'center' as const,
                sortable: true,
                sortAccessor: (row: AttributeDisplay) => row.sortOrder ?? 0,
                render: (_row: AttributeDisplay, index: number) => (
                    <Typography sx={{ fontSize: 13, fontWeight: 600, textAlign: 'center' }}>{index + 1}</Typography>
                )
            },
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: isSystemView ? '30%' : '35%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: AttributeDisplay) => row.name || '',
                render: (row: AttributeDisplay) => {
                    const rawAttribute = attributeMap.get(row.id)
                    const isDisplayAttr = rawAttribute?.isDisplayAttribute ?? row.isDisplayAttribute ?? false
                    const systemMetadata = rawAttribute?.system ?? row.system ?? null
                    return (
                        <Stack spacing={0.25}>
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
                                        <StarIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                    </Tooltip>
                                )}
                                <Typography
                                    sx={{
                                        fontSize: 14,
                                        fontWeight: 500,
                                        wordBreak: 'break-word'
                                    }}
                                >
                                    {row.name || '—'}
                                </Typography>
                            </Stack>
                            {isSystemView && systemMetadata?.systemKey && (
                                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                                    {t('attributes.system.keyLabel', 'System key')}: {systemMetadata.systemKey}
                                </Typography>
                            )}
                        </Stack>
                    )
                }
            },
            {
                id: 'codename',
                label: t('attributes.codename', 'Codename'),
                width: isSystemView ? '18%' : '20%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: AttributeDisplay) => row.codename || '',
                render: (row: AttributeDisplay) => (
                    <Typography
                        sx={{
                            fontSize: 14,
                            fontWeight: 600,
                            fontFamily: 'monospace',
                            wordBreak: 'break-word'
                        }}
                    >
                        {row.codename || '—'}
                    </Typography>
                )
            },
            {
                id: 'dataType',
                label: t('attributes.dataType', 'Type'),
                width: isSystemView ? '24%' : '17%',
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
                            <Stack spacing={0.4} justifyContent='center' alignItems='center' sx={{ cursor: 'help' }}>
                                <Stack direction='row' spacing={0.5} justifyContent='center' alignItems='center'>
                                    <Chip label={row.dataType} size='small' color={getDataTypeColor(row.dataType)} />
                                    {hasVersioned && <Chip label='V' size='small' sx={{ minWidth: 24, height: 20, fontSize: 11 }} />}
                                    {hasLocalized && <Chip label='L' size='small' sx={{ minWidth: 24, height: 20, fontSize: 11 }} />}
                                </Stack>
                                <Typography sx={{ fontSize: 11, color: 'text.secondary', textAlign: 'center' }}>
                                    {physicalTypeStr}
                                </Typography>
                            </Stack>
                        </Tooltip>
                    )
                }
            }
        ]

        if (isSystemView) {
            columns.push({
                id: 'systemStatus',
                label: t('attributes.system.status', 'Status'),
                width: '12%',
                align: 'center' as const,
                render: (row: AttributeDisplay) => {
                    const rawAttribute = attributeMap.get(row.id)
                    const isEnabled = rawAttribute?.system?.isEnabled ?? row.system?.isEnabled ?? true
                    return (
                        <Chip
                            label={isEnabled ? t('attributes.system.enabled', 'Enabled') : t('attributes.system.disabled', 'Disabled')}
                            size='small'
                            variant='outlined'
                            color={isEnabled ? 'success' : 'default'}
                        />
                    )
                }
            })
        } else {
            columns.push({
                id: 'isRequired',
                label: t('attributes.required', 'Required'),
                width: '15%',
                align: 'center' as const,
                render: (row: AttributeDisplay) => (
                    <Chip
                        label={row.isRequired ? tc('yes', 'Yes') : tc('no', 'No')}
                        size='small'
                        variant='outlined'
                        color={row.isRequired ? 'error' : 'default'}
                    />
                )
            })
        }

        return columns
    }, [attributeMap, isSystemView, t, tc])

    const createAttributeContext = useCallback(
        (baseContext: ActionBaseContext) => ({
            ...baseContext,
            attributeMap,
            uiLocale: i18n.language,
            metahubId,
            catalogId,
            api: {
                updateEntity: (id: string, patch: AttributeLocalizedPayload) => {
                    if (!metahubId || !catalogId) return Promise.resolve()
                    const rawCodename = getVLCString(patch.codename, patch.codename?._primary ?? 'en')
                    const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
                    if (!normalizedCodename) {
                        throw new Error(t('attributes.validation.codenameRequired', 'Codename is required'))
                    }
                    if (
                        !isValidCodenameForStyle(
                            normalizedCodename,
                            codenameConfig.style,
                            codenameConfig.alphabet,
                            codenameConfig.allowMixed
                        )
                    ) {
                        throw new Error(t('attributes.validation.codenameInvalid', 'Codename contains invalid characters'))
                    }
                    const dataType = patch.dataType ?? 'STRING'
                    const codenamePayload = ensureLocalizedContent(patch.codename, patch.codename?._primary ?? 'en', normalizedCodename)
                    const attribute = attributeMap.get(id)
                    const expectedVersion = attribute?.version
                    updateAttributeMutation.mutate(
                        {
                            metahubId,
                            hubId: effectiveHubId,
                            catalogId,
                            attributeId: id,
                            data: { ...patch, codename: codenamePayload, dataType, isRequired: patch.isRequired, expectedVersion }
                        },
                        {
                            onError: (error: unknown) => {
                                if (isOptimisticLockConflict(error)) {
                                    const conflict = extractConflictInfo(error)
                                    if (conflict) {
                                        openConflict({
                                            conflict,
                                            pendingUpdate: {
                                                id,
                                                patch: { ...patch, codename: codenamePayload, dataType, isRequired: patch.isRequired }
                                            }
                                        })
                                    }
                                }
                            }
                        }
                    )

                    return Promise.resolve()
                },
                deleteEntity: (id: string) => {
                    if (!metahubId || !catalogId) return
                    return deleteAttributeMutation.mutateAsync({
                        metahubId,
                        hubId: effectiveHubId, // Optional - undefined for hub-less catalogs
                        catalogId,
                        attributeId: id
                    })
                },
                copyEntity: (id: string, payload: AttributeLocalizedPayload & Record<string, unknown>) => {
                    if (!metahubId || !catalogId) return Promise.resolve()
                    copyAttributeMutation.mutate({
                        metahubId,
                        hubId: effectiveHubId,
                        catalogId,
                        attributeId: id,
                        data: payload
                    })

                    return Promise.resolve()
                }
            },
            moveAttribute: async (id: string, direction: 'up' | 'down') => {
                if (!metahubId || !catalogId) return
                await moveAttributeMutation.mutateAsync({
                    metahubId,
                    hubId: effectiveHubId, // Optional - undefined for hub-less catalogs
                    catalogId,
                    attributeId: id,
                    direction
                })
                // Invalidate queries - effectiveHubId is optional for direct queries
                if (effectiveHubId) {
                    await invalidateAttributesQueries.all(queryClient, metahubId, effectiveHubId, catalogId)
                } else {
                    // Invalidate direct queries for hub-less catalogs
                    queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesDirect(metahubId, catalogId) })
                }
            },
            toggleRequired: async (id: string, isRequired: boolean) => {
                if (!metahubId || !catalogId) return
                await toggleRequiredMutation.mutateAsync({
                    metahubId,
                    hubId: effectiveHubId,
                    catalogId,
                    attributeId: id,
                    isRequired
                })
                if (effectiveHubId) {
                    await invalidateAttributesQueries.all(queryClient, metahubId, effectiveHubId, catalogId)
                } else {
                    queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesDirect(metahubId, catalogId) })
                }
            },
            toggleDisplayAttribute: async (id: string, isDisplayAttribute: boolean) => {
                if (!metahubId || !catalogId) return
                if (isDisplayAttribute) {
                    await setDisplayAttributeMutation.mutateAsync({
                        metahubId,
                        hubId: effectiveHubId,
                        catalogId,
                        attributeId: id
                    })
                } else {
                    await clearDisplayAttributeMutation.mutateAsync({
                        metahubId,
                        hubId: effectiveHubId,
                        catalogId,
                        attributeId: id
                    })
                }
                if (effectiveHubId) {
                    await invalidateAttributesQueries.all(queryClient, metahubId, effectiveHubId, catalogId)
                } else {
                    queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesDirect(metahubId, catalogId) })
                }
            },
            toggleSystemEnabled: async (id: string, isEnabled: boolean) => {
                if (!metahubId || !catalogId) return
                const attribute = attributeMap.get(id)
                await updateAttributeMutation.mutateAsync({
                    metahubId,
                    hubId: effectiveHubId,
                    catalogId,
                    attributeId: id,
                    data: {
                        isEnabled,
                        expectedVersion: attribute?.version
                    }
                })
            },
            helpers: {
                refreshList: () => {
                    if (metahubId && catalogId) {
                        // Always invalidate global codenames cache (for global scope duplicate checking)
                        invalidateAttributesQueries.allCodenames(queryClient, metahubId, catalogId)
                        if (effectiveHubId) {
                            void invalidateAttributesQueries.all(queryClient, metahubId, effectiveHubId, catalogId)
                        } else {
                            // Invalidate direct queries for hub-less catalogs
                            void queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesDirect(metahubId, catalogId) })
                        }
                    }
                },
                confirm: async (spec: ConfirmSpec) => {
                    const confirmed = await confirm({
                        title: spec.titleKey ? baseContext.t(spec.titleKey, spec.interpolate) : spec.title,
                        description: spec.descriptionKey ? baseContext.t(spec.descriptionKey, spec.interpolate) : spec.description,
                        confirmButtonName: spec.confirmKey
                            ? baseContext.t(spec.confirmKey)
                            : spec.confirmButtonName || baseContext.t('confirm.delete.confirm'),
                        cancelButtonName: spec.cancelKey
                            ? baseContext.t(spec.cancelKey)
                            : spec.cancelButtonName || baseContext.t('confirm.delete.cancel')
                    })
                    return confirmed
                },
                enqueueSnackbar: (payload: {
                    message: string
                    options?: { variant?: 'default' | 'error' | 'success' | 'warning' | 'info' }
                }) => {
                    if (payload?.message) {
                        enqueueSnackbar(payload.message, payload.options)
                    }
                },
                openDeleteDialog: (attribute: Attribute) => {
                    const actualAttribute = attributeMap.get(attribute.id) ?? attribute
                    if (actualAttribute?.isDisplayAttribute) {
                        enqueueSnackbar(
                            t(
                                'attributes.deleteDisplayAttributeBlocked',
                                'Нельзя удалить атрибут-представление. Сначала назначьте представлением другой атрибут.'
                            ),
                            { variant: 'warning' }
                        )
                        return
                    }
                    openDelete(attribute)
                }
            }
        }),
        [
            attributeMap,
            catalogId,
            clearDisplayAttributeMutation,
            codenameConfig.allowMixed,
            codenameConfig.alphabet,
            codenameConfig.style,
            copyAttributeMutation,
            confirm,
            deleteAttributeMutation,
            enqueueSnackbar,
            effectiveHubId,
            i18n.language,
            metahubId,
            moveAttributeMutation,
            queryClient,
            setDisplayAttributeMutation,
            t,
            toggleRequiredMutation,
            updateAttributeMutation
        ]
    )

    // Validate metahubId and catalogId from URL AFTER all hooks
    if (!metahubId || !catalogId) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Invalid catalog'
                title={t('errors.noHubId', 'No hub ID provided')}
                description={t('errors.pleaseSelectHub', 'Please select a hub')}
            />
        )
    }

    // Show loading while resolving catalog (only when no hubId in URL)
    if (!hubIdParam && isCatalogResolutionLoading) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Loading'
                title={tc('loading', 'Loading')}
                description={t('common:loading', 'Loading...')}
            />
        )
    }

    // Show error if catalog resolution failed
    if (!hubIdParam && catalogResolutionError) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Error loading catalog'
                title={t('errors.loadingError', 'Error loading catalog')}
                description={
                    catalogResolutionError instanceof Error ? catalogResolutionError.message : String(catalogResolutionError || '')
                }
            />
        )
    }

    const handleAddNew = () => {
        openCreate()
    }

    const handleDialogClose = () => {
        close('create')
    }

    const handleCatalogTabChange = (_event: unknown, nextTab: CatalogTab) => {
        if (!metahubId || !catalogId) return
        if (nextTab === 'settings') {
            setEditDialogOpen(true)
            return
        }
        if (nextTab === 'attributes' || nextTab === 'system') {
            navigate(buildCatalogTabPath(nextTab))
            return
        }
        navigate(buildCatalogTabPath('elements'))
    }

    const handleCreateAttribute = (data: GenericFormValues) => {
        // Validation is handled by EntityFormDialog's validate/canSave props.
        const nameVlc = data.nameVlc as VersionedLocalizedContent<string> | null | undefined
        const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
        const codenameValue = data.codename as VersionedLocalizedContent<string> | null | undefined
        const rawCodename = getVLCString(codenameValue || undefined, codenameValue?._primary ?? namePrimaryLocale ?? 'en')
        const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
        const codenamePayload = ensureLocalizedContent(codenameValue, namePrimaryLocale ?? 'en', normalizedCodename || '')

        const dataType = (data.dataType as AttributeDataType | undefined) ?? 'STRING'
        const isRequired = Boolean(data.isRequired)
        const validationRules = data.validationRules as AttributeValidationRules | undefined
        const isDisplayAttribute = Boolean(data.isDisplayAttribute)
        const uiConfig = (data.uiConfig as Record<string, unknown>) ?? {}

        // REF type: extract target entity info
        const targetEntityId = dataType === 'REF' ? (data.targetEntityId as string | null) : undefined
        const targetEntityKind = dataType === 'REF' ? (data.targetEntityKind as MetaEntityKind | null) : undefined
        const targetConstantId =
            dataType === 'REF' && targetEntityKind === 'set' ? (data.targetConstantId as string | null) ?? null : undefined
        const normalizedUiConfig = sanitizeAttributeUiConfig(dataType, targetEntityKind, uiConfig)

        // Fire-and-forget: optimistic card via onMutate, errors via onError snackbar,
        // cache invalidation via onSettled. Dialog closes immediately.
        createAttributeMutation.mutate({
            metahubId,
            hubId: effectiveHubId,
            catalogId,
            data: {
                codename: codenamePayload,
                dataType,
                isRequired,
                name: nameInput ?? {},
                namePrimaryLocale: namePrimaryLocale ?? '',
                validationRules,
                isDisplayAttribute,
                targetEntityId,
                targetEntityKind,
                targetConstantId,
                uiConfig: normalizedUiConfig
            }
        })
    }

    const renderAttributeActions = (row: AttributeDisplay) => {
        const originalAttribute = attributes.find((a) => a.id === row.id)
        if (!originalAttribute) return null

        const displayEntity = toAttributeDisplay(originalAttribute, i18n.language)
        const descriptors: ActionDescriptor<AttributeDisplay, AttributeLocalizedPayload>[] = isSystemView
            ? systemAttributeActions
            : [...attributeActions]
        const actionContext = createAttributeContext({
            entity: displayEntity,
            entityKind: 'attribute',
            t
        })
        const visibleDescriptors = descriptors.filter(
            (descriptor) =>
                (!descriptor.entityKinds || descriptor.entityKinds.includes('attribute')) &&
                (!descriptor.visible || descriptor.visible(actionContext))
        )

        return (
            <Stack direction='row' spacing={0} alignItems='center'>
                {!isSystemView && row.dataType === 'TABLE' && (
                    <IconButton
                        size='small'
                        onClick={(e) => {
                            e.stopPropagation()
                            setExpandedTableIds((prev) => {
                                const next = new Set(prev)
                                if (next.has(row.id)) {
                                    next.delete(row.id)
                                } else {
                                    next.add(row.id)
                                }
                                return next
                            })
                        }}
                        sx={{ width: 28, height: 28, p: 0.5 }}
                    >
                        {expandedTableIds.has(row.id) ? (
                            <KeyboardArrowUpIcon fontSize='small' />
                        ) : (
                            <KeyboardArrowDownIcon fontSize='small' />
                        )}
                    </IconButton>
                )}
                {visibleDescriptors.length > 0 && (
                    <BaseEntityMenu<AttributeDisplay, AttributeLocalizedPayload>
                        entity={displayEntity}
                        entityKind='attribute'
                        descriptors={visibleDescriptors}
                        namespace='metahubs'
                        menuButtonLabelKey='flowList:menu.button'
                        i18nInstance={i18n}
                        createContext={createAttributeContext}
                    />
                )}
            </Stack>
        )
    }

    // Transform Attribute data for table display
    const getAttributeTableData = (attr: Attribute): AttributeDisplay => toAttributeDisplay(attr, i18n.language)

    return (
        <AttributeDndContainerRegistryProvider>
            <ExistingCodenamesProvider entities={codenameEntities}>
                <MainCard
                    sx={{ maxWidth: '100%', width: '100%' }}
                    contentSX={{ px: 0, py: 0 }}
                    disableContentPadding
                    disableHeader
                    border={false}
                    shadow={false}
                >
                    {error ? (
                        <EmptyListState
                            image={APIEmptySVG}
                            imageAlt='Connection error'
                            title={t('errors.connectionFailed')}
                            description={!hasResponseStatus(error) ? t('errors.checkConnection') : t('errors.pleaseTryLater')}
                            action={{
                                label: t('actions.retry'),
                                onClick: () => paginationResult.actions.goToPage(1)
                            }}
                        />
                    ) : (
                        <Stack flexDirection='column' sx={{ gap: 1 }}>
                            <ViewHeader
                                search={true}
                                searchPlaceholder={t('attributes.searchPlaceholder')}
                                onSearchChange={handleSearchChange}
                                title={isSystemView ? t('attributes.system.title', 'System Attributes') : t('attributes.title')}
                            >
                                <ToolbarControls
                                    primaryAction={
                                        isSystemView
                                            ? undefined
                                            : {
                                                  label: tc('create'),
                                                  onClick: handleAddNew,
                                                  startIcon: <AddRoundedIcon />,
                                                  disabled: limitReached
                                              }
                                    }
                                />
                            </ViewHeader>

                            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                                <Tabs
                                    value={activeCatalogTab}
                                    onChange={handleCatalogTabChange}
                                    aria-label={t('catalogs.title', 'Catalogs')}
                                    textColor='primary'
                                    indicatorColor='primary'
                                    sx={{
                                        minHeight: 40,
                                        '& .MuiTab-root': {
                                            minHeight: 40,
                                            textTransform: 'none'
                                        }
                                    }}
                                >
                                    <Tab value='attributes' label={t('attributes.title')} />
                                    <Tab value='system' label={t('attributes.tabs.system', 'System')} />
                                    <Tab value='elements' label={t('elements.title')} />
                                    <Tab value='settings' label={t('settings.title')} />
                                </Tabs>
                            </Box>

                            {isSystemView && (
                                <Alert
                                    severity='info'
                                    icon={<InfoIcon />}
                                    sx={{
                                        mx: { xs: -1.5, md: -2 },
                                        mt: 0,
                                        mb: 2
                                    }}
                                >
                                    {t(
                                        'attributes.system.hint',
                                        'System attributes are managed by the platform. You can only enable or disable supported attributes.'
                                    )}
                                </Alert>
                            )}

                            {!isSystemView && limitReached && (
                                <Alert
                                    severity='info'
                                    icon={<InfoIcon />}
                                    sx={{
                                        mx: { xs: -1.5, md: -2 },
                                        mt: 0,
                                        mb: 2
                                    }}
                                >
                                    {t('attributes.limitReached', { limit: limitValue })}
                                </Alert>
                            )}

                            {isLoading && attributes.length === 0 ? (
                                <Skeleton variant='rectangular' height={120} />
                            ) : !isLoading && attributes.length === 0 ? (
                                <EmptyListState
                                    image={APIEmptySVG}
                                    imageAlt='No attributes'
                                    title={isSystemView ? t('attributes.system.empty', 'No system attributes') : t('attributes.empty')}
                                    description={
                                        isSystemView
                                            ? t('attributes.system.emptyDescription', 'This catalog has no configurable system attributes.')
                                            : t('attributes.emptyDescription')
                                    }
                                />
                            ) : (
                                <Box sx={{ mx: { xs: -1.5, md: -2 } }}>
                                    {isSystemView ? (
                                        <FlowListTable<AttributeDisplay>
                                            data={attributes.map(getAttributeTableData)}
                                            customColumns={attributeColumns}
                                            sortStateId='catalog-system-attributes'
                                            initialOrder='asc'
                                            initialOrderBy='sortOrder'
                                            onPendingInteractionAttempt={(row: AttributeDisplay) =>
                                                handlePendingAttributeInteraction(row.id)
                                            }
                                            renderActions={renderAttributeActions}
                                        />
                                    ) : (
                                        <AttributeDndProvider
                                            rootItems={attributes}
                                            allowCrossListRootChildren={allowCrossListRootChildren}
                                            allowCrossListBetweenChildren={allowCrossListBetweenChildren}
                                            onReorder={handleReorder}
                                            onValidateTransfer={handleValidateTransfer}
                                            uiLocale={i18n.language}
                                        >
                                            <DndDropTarget containerId='root'>
                                                {({ isDropTarget, pendingTransfer: pt, activeAttribute: activeAttr }) => {
                                                    const baseData = attributes.map(getAttributeTableData)
                                                    const baseIds = attributes.map((a) => a.id)
                                                    let effectiveData = baseData
                                                    let effectiveIds = baseIds

                                                    if (pt) {
                                                        if (pt.fromContainerId === 'root') {
                                                            effectiveData = baseData.filter((d) => d.id !== pt.itemId)
                                                            effectiveIds = baseIds.filter((id) => id !== pt.itemId)
                                                        } else if (pt.toContainerId === 'root' && activeAttr) {
                                                            const ghost = toAttributeDisplay(activeAttr, i18n.language)
                                                            const insertAt = Math.min(pt.insertIndex, baseData.length)
                                                            effectiveData = [
                                                                ...baseData.slice(0, insertAt),
                                                                ghost,
                                                                ...baseData.slice(insertAt)
                                                            ]
                                                            effectiveIds = [
                                                                ...baseIds.slice(0, insertAt),
                                                                pt.itemId,
                                                                ...baseIds.slice(insertAt)
                                                            ]
                                                        }
                                                    }

                                                    return (
                                                        <FlowListTable<AttributeDisplay>
                                                            data={effectiveData}
                                                            customColumns={attributeColumns}
                                                            onPendingInteractionAttempt={(row: AttributeDisplay) =>
                                                                handlePendingAttributeInteraction(row.id)
                                                            }
                                                            sortableRows
                                                            externalDndContext
                                                            droppableContainerId='root'
                                                            sortableItemIds={effectiveIds}
                                                            dragHandleAriaLabel={t('attributes.dnd.dragHandle', 'Drag to reorder')}
                                                            isDropTarget={isDropTarget}
                                                            renderActions={renderAttributeActions}
                                                            renderRowExpansion={(row: AttributeDisplay) => {
                                                                if (row.dataType !== 'TABLE') return null
                                                                if (!expandedTableIds.has(row.id)) return null
                                                                return (
                                                                    <Box sx={{ pl: 1, pr: 1, pb: 1 }}>
                                                                        <Box
                                                                            sx={{
                                                                                borderTop: '1px dashed',
                                                                                borderColor: 'divider',
                                                                                mx: 2,
                                                                                mb: 1
                                                                            }}
                                                                        />
                                                                        <ChildAttributeList
                                                                            metahubId={metahubId!}
                                                                            hubId={effectiveHubId}
                                                                            catalogId={catalogId!}
                                                                            parentAttributeId={row.id}
                                                                            parentMaxChildAttributes={
                                                                                row.validationRules?.maxChildAttributes > 0 &&
                                                                                typeof row.validationRules.maxChildAttributes === 'number'
                                                                                    ? row.validationRules.maxChildAttributes
                                                                                    : null
                                                                            }
                                                                            searchFilter={
                                                                                childSearchMatchParentIds.includes(row.id)
                                                                                    ? searchValue
                                                                                    : undefined
                                                                            }
                                                                            onRefresh={async () => {
                                                                                if (metahubId && catalogId) {
                                                                                    invalidateAttributesQueries.allCodenames(
                                                                                        queryClient,
                                                                                        metahubId!,
                                                                                        catalogId!
                                                                                    )
                                                                                }
                                                                                if (effectiveHubId) {
                                                                                    await invalidateAttributesQueries.all(
                                                                                        queryClient,
                                                                                        metahubId!,
                                                                                        effectiveHubId,
                                                                                        catalogId!
                                                                                    )
                                                                                } else {
                                                                                    queryClient.invalidateQueries({
                                                                                        queryKey: metahubsQueryKeys.attributesDirect(
                                                                                            metahubId!,
                                                                                            catalogId!
                                                                                        )
                                                                                    })
                                                                                }
                                                                            }}
                                                                        />
                                                                    </Box>
                                                                )
                                                            }}
                                                        />
                                                    )
                                                }}
                                            </DndDropTarget>
                                        </AttributeDndProvider>
                                    )}
                                </Box>
                            )}

                            {/* Table Pagination at bottom */}
                            {!isLoading && attributes.length > 0 && (
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
                        open={dialogs.create.open}
                        title={t('attributes.createDialog.title', 'Add Attribute')}
                        nameLabel={tc('fields.name', 'Name')}
                        descriptionLabel={tc('fields.description', 'Description')}
                        saveButtonText={tc('actions.create', 'Create')}
                        savingButtonText={tc('actions.creating', 'Creating...')}
                        cancelButtonText={tc('actions.cancel', 'Cancel')}
                        onClose={handleDialogClose}
                        onSave={handleCreateAttribute}
                        hideDefaultFields
                        initialExtraValues={localizedFormDefaults}
                        tabs={renderTabs}
                        validate={validateAttributeForm}
                        canSave={canSaveAttributeForm}
                    />

                    {/* Independent ConfirmDeleteDialog */}
                    <ConfirmDeleteDialog
                        open={dialogs.delete.open}
                        title={t('attributes.deleteDialog.title')}
                        description={t('attributes.deleteDialog.message')}
                        confirmButtonText={tc('actions.delete', 'Delete')}
                        deletingButtonText={tc('actions.deleting', 'Deleting...')}
                        cancelButtonText={tc('actions.cancel', 'Cancel')}
                        onCancel={() => close('delete')}
                        onConfirm={() => {
                            if (!dialogs.delete.item) return
                            const actualAttribute = attributeMap.get(dialogs.delete.item.id) ?? dialogs.delete.item
                            if (actualAttribute?.isDisplayAttribute) {
                                enqueueSnackbar(
                                    t(
                                        'attributes.deleteDisplayAttributeBlocked',
                                        'Нельзя удалить атрибут-представление. Сначала назначьте представлением другой атрибут.'
                                    ),
                                    { variant: 'warning' }
                                )
                                close('delete')
                                return
                            }

                            deleteAttributeMutation.mutate(
                                {
                                    metahubId,
                                    hubId: effectiveHubId,
                                    catalogId,
                                    attributeId: dialogs.delete.item.id
                                },
                                {
                                    onError: (err: unknown) => {
                                        const responseMessage = extractResponseMessage(err)
                                        const message =
                                            typeof responseMessage === 'string'
                                                ? responseMessage
                                                : err instanceof Error
                                                ? err.message
                                                : typeof err === 'string'
                                                ? err
                                                : t('attributes.deleteError')
                                        enqueueSnackbar(message, { variant: 'error' })
                                    }
                                }
                            )
                        }}
                    />
                    <ConflictResolutionDialog
                        open={dialogs.conflict.open}
                        conflict={(dialogs.conflict.data as { conflict?: ConflictInfo })?.conflict ?? null}
                        onCancel={() => {
                            close('conflict')
                            if (metahubId && catalogId) {
                                // Invalidate global codenames cache (for global scope duplicate checking)
                                invalidateAttributesQueries.allCodenames(queryClient, metahubId, catalogId)
                                if (effectiveHubId) {
                                    invalidateAttributesQueries.all(queryClient, metahubId, effectiveHubId, catalogId)
                                } else {
                                    queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesDirect(metahubId, catalogId) })
                                }
                            }
                        }}
                        onOverwrite={async () => {
                            const pendingUpdate = (dialogs.conflict.data as { pendingUpdate?: { id: string; patch: AttributeLocalizedPayload } })?.pendingUpdate
                            if (pendingUpdate && metahubId && catalogId) {
                                const { id, patch } = pendingUpdate
                                await updateAttributeMutation.mutateAsync({
                                    metahubId,
                                    hubId: effectiveHubId,
                                    catalogId,
                                    attributeId: id,
                                    data: patch
                                })
                                close('conflict')
                            }
                        }}
                        isLoading={updateAttributeMutation.isPending}
                    />

                    {/* Settings edit dialog overlay for parent catalog */}
                    {catalogForHubResolution &&
                        catalogId &&
                        (() => {
                            const catalogDisplay: CatalogDisplayWithHub = {
                                id: catalogForHubResolution.id,
                                metahubId: catalogForHubResolution.metahubId,
                                codename: catalogForHubResolution.codename,
                                name: getVLCString(catalogForHubResolution.name, preferredVlcLocale) || catalogForHubResolution.codename,
                                description: getVLCString(catalogForHubResolution.description, preferredVlcLocale) || '',
                                isSingleHub: catalogForHubResolution.isSingleHub,
                                isRequiredHub: catalogForHubResolution.isRequiredHub,
                                sortOrder: catalogForHubResolution.sortOrder,
                                createdAt: catalogForHubResolution.createdAt,
                                updatedAt: catalogForHubResolution.updatedAt,
                                hubId: effectiveHubId || undefined,
                                hubs: catalogForHubResolution.hubs?.map((h) => ({
                                    id: h.id,
                                    name: typeof h.name === 'string' ? h.name : h.codename || '',
                                    codename: h.codename || ''
                                }))
                            }
                            const catalogMap = new Map<string, Catalog>([[catalogForHubResolution.id, catalogForHubResolution]])
                            const settingsCtx = {
                                entity: catalogDisplay,
                                entityKind: 'catalog' as const,
                                t,
                                catalogMap,
                                currentHubId: effectiveHubId || null,
                                uiLocale: preferredVlcLocale,
                                api: {
                                    updateEntity: (id: string, patch: CatalogLocalizedPayload) => {
                                        if (!metahubId) return
                                        updateCatalogMutation.mutate({
                                            metahubId,
                                            catalogId: id,
                                            data: { ...patch, expectedVersion: catalogForHubResolution.version }
                                        })
                                    }
                                },
                                helpers: {
                                    refreshList: () => {
                                        if (metahubId && catalogId) {
                                            void queryClient.invalidateQueries({
                                                queryKey: metahubsQueryKeys.catalogDetail(metahubId, catalogId)
                                            })
                                            void queryClient.invalidateQueries({
                                                queryKey: metahubsQueryKeys.allCatalogs(metahubId)
                                            })
                                            // Invalidate breadcrumb queries so page title refreshes immediately
                                            void queryClient.invalidateQueries({
                                                queryKey: ['breadcrumb', 'catalog-standalone', metahubId, catalogId]
                                            })
                                            void queryClient.invalidateQueries({
                                                queryKey: ['breadcrumb', 'catalog', metahubId]
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
                                    title={t('catalogs.editTitle', 'Edit Catalog')}
                                    nameLabel={tc('fields.name', 'Name')}
                                    descriptionLabel={tc('fields.description', 'Description')}
                                    saveButtonText={tc('actions.save', 'Save')}
                                    savingButtonText={tc('actions.saving', 'Saving...')}
                                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                                    hideDefaultFields
                                    initialExtraValues={buildCatalogInitialValues(settingsCtx)}
                                    tabs={buildCatalogFormTabs(settingsCtx, hubs, catalogId)}
                                    validate={(values) => validateCatalogForm(settingsCtx, values)}
                                    canSave={canSaveCatalogForm}
                                    onSave={(data) => {
                                        const payload = catalogToPayload(data)
                                        settingsCtx.api.updateEntity(catalogForHubResolution.id, payload)
                                    }}
                                    onClose={() => setEditDialogOpen(false)}
                                />
                            )
                        })()}
                </MainCard>
            </ExistingCodenamesProvider>
        </AttributeDndContainerRegistryProvider>
    )
}

const AttributeList = () => <AttributeListContent />

export default AttributeList
