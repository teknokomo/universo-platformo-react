import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { alpha, type Theme } from '@mui/material/styles'
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

import {
    TemplateMainCard as MainCard,
    ToolbarControls,
    EmptyListState,
    APIEmptySVG,
    PaginationControls,
    FlowListTable,
    useConfirm,
    ViewHeaderMUI as ViewHeader,
    BaseEntityMenu,
    revealPendingEntityFeedback,
    useListDialogs
} from '@universo/template-mui'
import type { ActionDescriptor, ActionContext } from '@universo/template-mui'
import { EntityFormDialog, ConfirmDeleteDialog, ConflictResolutionDialog, type TabConfig } from '@universo/template-mui/components/dialogs'

import {
    useCreateFieldDefinition,
    useCopyFieldDefinition,
    useUpdateFieldDefinition,
    useDeleteFieldDefinition,
    useMoveFieldDefinition,
    useReorderFieldDefinition,
    useToggleFieldDefinitionRequired,
    useSetDisplayFieldDefinition,
    useClearDisplayFieldDefinition,
    useFieldDefinitionListData
} from '../hooks'
import {
    invalidateFieldDefinitionsQueries,
    isSharedEntityActive,
    isSharedEntityMovable,
    isSharedEntityRow,
    metahubsQueryKeys,
    sortSharedEntityList,
    useUpsertSharedEntityOverride
} from '../../../../shared'
import type { EntityKind, VersionedLocalizedContent } from '@universo/types'
import {
    FieldDefinition,
    FieldDefinitionDisplay,
    FieldDefinitionDataType,
    FieldDefinitionLocalizedPayload,
    toFieldDefinitionDisplay,
    getDefaultValidationRules,
    getPhysicalDataType,
    formatPhysicalType,
    LinkedCollectionLocalizedPayload,
    getVLCString
} from '../../../../../types'
import { isOptimisticLockConflict, extractConflictInfo, type ConflictInfo } from '@universo/utils'
import { getCatalogSystemFieldDefinition } from '@universo/utils'
import { normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../../../utils/codename'
import { extractLocalizedInput, hasPrimaryContent, ensureLocalizedContent } from '../../../../../utils/localizedInput'
import fieldDefinitionActions from './FieldDefinitionActions'
import FieldDefinitionFormFields, { PresentationTabFields } from './FieldDefinitionFormFields'
import { shouldForceFirstAttributeDefaults } from './fieldDefinitionDisplayRules'
import NestedFieldDefinitionList from './NestedFieldDefinitionList'
import { FieldDefinitionDndProvider, FieldDefinitionDndContainerRegistryProvider, useFieldDefinitionDndState } from './dnd'
import SharedEntitySettingsFields from '../../../../shared/ui/SharedEntitySettingsFields'
import {
    readSharedExcludedTargetIdsField,
    SHARED_EXCLUDED_TARGET_IDS_FIELD,
    syncSharedEntityExclusions
} from '../../../../shared/sharedEntityExclusions'
import { useCodenameConfig } from '../../../../settings/hooks/useCodenameConfig'
import { useMetahubPrimaryLocale } from '../../../../settings/hooks/useMetahubPrimaryLocale'
import { useSettingValue } from '../../../../settings/hooks/useSettings'
import { ExistingCodenamesProvider } from '../../../../../components'
import {
    buildInitialValues as buildCatalogInitialValues,
    buildFormTabs as buildLinkedCollectionFormTabs,
    validateLinkedCollectionForm,
    canSaveLinkedCollectionForm,
    toPayload as catalogToPayload
} from '../../../presets/ui/LinkedCollectionActions'
import type { LinkedCollectionDisplayWithContainer } from '../../../presets/ui/LinkedCollectionActions'
import { useUpdateLinkedCollectionAtMetahub } from '../../../presets/hooks/linkedCollectionMutations'
import type { AttributeFormValues, ConfirmSpec, CatalogTab } from './fieldDefinitionListUtils'
import {
    extractResponseData,
    hasResponseStatus,
    extractResponseMessage,
    extractResponseCode,
    extractResponseMaxChildAttributes,
    sanitizeAttributeUiConfig,
    getDataTypeColor
} from './fieldDefinitionListUtils'
import { buildLinkedCollectionAuthoringPath } from '../../../../shared/entityMetadataRoutePaths'

type GenericFormValues = Record<string, unknown>

const DIALOG_SAVE_CANCEL = { __dialogCancelled: true } as const

type FieldDefinitionListContentProps = {
    metahubId?: string
    treeEntityId?: string | null
    linkedCollectionId?: string
    sharedEntityMode?: boolean
    title?: string | null
    emptyTitle?: string
    emptyDescription?: string
    renderPageShell?: boolean
    showCatalogTabs?: boolean
    showSettingsTab?: boolean
    allowSystemTab?: boolean
}

const DndDropTarget: React.FC<{
    containerId: string
    children: (props: {
        isDropTarget: boolean
        pendingTransfer: import('./dnd').PendingTransfer | null
        activeFieldDefinition: FieldDefinition | undefined
    }) => React.ReactNode
}> = ({ containerId, children }) => {
    const { activeContainerId, overContainerId, pendingTransfer, activeFieldDefinition } = useFieldDefinitionDndState()
    const isDropTarget = overContainerId === containerId && activeContainerId !== null && activeContainerId !== containerId
    return <>{children({ isDropTarget, pendingTransfer, activeFieldDefinition })}</>
}

export const FieldDefinitionListContent = ({
    metahubId: metahubIdProp,
    treeEntityId: hubIdProp,
    linkedCollectionId: catalogIdProp,
    sharedEntityMode = false,
    title,
    emptyTitle,
    emptyDescription,
    renderPageShell = true,
    showCatalogTabs = true,
    showSettingsTab = true,
    allowSystemTab = true
}: FieldDefinitionListContentProps = {}) => {
    const navigate = useNavigate()
    const { kindKey } = useParams<{ kindKey?: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const codenameConfig = useCodenameConfig()
    const preferredVlcLocale = useMetahubPrimaryLocale()

    const {
        metahubId,
        hubIdParam,
        linkedCollectionId,
        effectiveTreeEntityId,
        treeEntities,
        isSystemView,
        activeCatalogTab,
        isDedicatedSystemRoute,
        requestedCatalogTab,
        isCatalogResolutionLoading,
        catalogResolutionError,
        catalogForHubResolution,
        isLoading,
        error,
        fieldDefinitions,
        paginationResult,
        searchValue,
        handleSearchChange,
        codenameEntities,
        attributeMap,
        platformSystemFieldDefinitionsPolicy,
        limitValue,
        limitReached,
        childSearchMatchParentIds,
        includeShared
    } = useFieldDefinitionListData({
        metahubId: metahubIdProp,
        treeEntityId: hubIdProp,
        linkedCollectionId: catalogIdProp,
        resolveCatalogDetails: showSettingsTab,
        allowSystemView: showCatalogTabs && allowSystemTab,
        includeSharedEntities: !sharedEntityMode
    })

    const { dialogs, openCreate, openDelete, openConflict, close } = useListDialogs<FieldDefinition>()
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [expandedTableIds, setExpandedTableIds] = useState<Set<string>>(new Set())
    const updateLinkedCollectionMutation = useUpdateLinkedCollectionAtMetahub()

    const buildCatalogTabPath = useCallback(
        (tab: Extract<CatalogTab, 'fieldDefinitions' | 'system' | 'records'>) => {
            return buildLinkedCollectionAuthoringPath({
                metahubId,
                treeEntityId: hubIdParam,
                kindKey,
                linkedCollectionId,
                tab
            })
        },
        [linkedCollectionId, hubIdParam, kindKey, metahubId]
    )

    useEffect(() => {
        if (!metahubId || !linkedCollectionId) return
        if (requestedCatalogTab !== 'system' || isDedicatedSystemRoute) return
        const nextPath = buildCatalogTabPath('system')
        if (nextPath) {
            navigate(nextPath, { replace: true })
        }
    }, [buildCatalogTabPath, linkedCollectionId, isDedicatedSystemRoute, metahubId, navigate, requestedCatalogTab])

    useEffect(() => {
        paginationResult.actions.goToPage(1)
        setExpandedTableIds(new Set())
    }, [activeCatalogTab, linkedCollectionId, paginationResult.actions])

    // Auto-expand TABLE parents that have matching child fieldDefinitions during search
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

    const createAttributeMutation = useCreateFieldDefinition()
    const copyAttributeMutation = useCopyFieldDefinition()
    const updateAttributeMutation = useUpdateFieldDefinition()
    const deleteAttributeMutation = useDeleteFieldDefinition()
    const moveAttributeMutation = useMoveFieldDefinition()
    const reorderMutation = useReorderFieldDefinition()
    const upsertSharedEntityOverrideMutation = useUpsertSharedEntityOverride()
    const toggleRequiredMutation = useToggleFieldDefinitionRequired()
    const setDisplayAttributeMutation = useSetDisplayFieldDefinition()
    const clearDisplayAttributeMutation = useClearDisplayFieldDefinition()
    const pendingInteractionMessage = tc('pendingCreateBlocked', 'This item is still being created. Please wait a moment and try again.')

    // DnD cross-list permission settings
    const allowCrossListRootChildren = useSettingValue<boolean>('entity.catalog.allowAttributeMoveBetweenRootAndChildren') ?? true
    const allowCrossListBetweenChildren = useSettingValue<boolean>('entity.catalog.allowAttributeMoveBetweenChildLists') ?? true

    const systemFieldDefinitionActions = useMemo<ActionDescriptor<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload>[]>(
        () => [
            {
                id: 'disable-system-field',
                labelKey: 'fieldDefinitions.actions.disableSystemField',
                icon: <RadioButtonUncheckedIcon fontSize='small' />,
                order: 10,
                visible: (ctx: ActionContext<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload>) => {
                    const current = attributeMap.get(ctx.entity.id)
                    const systemKey = current?.system?.systemKey ?? ctx.entity.system?.systemKey ?? null
                    const definition = systemKey ? getCatalogSystemFieldDefinition(systemKey) : null
                    const isBlockedPlatformToggle = definition?.layer === 'upl' && !platformSystemFieldDefinitionsPolicy.allowConfiguration
                    return (
                        (current?.system?.isEnabled ?? ctx.entity.system?.isEnabled ?? true) === true &&
                        definition?.canDisable !== false &&
                        !isBlockedPlatformToggle
                    )
                },
                onSelect: async (ctx: ActionContext<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload>) => {
                    if (typeof ctx.toggleSystemEnabled === 'function') {
                        await ctx.toggleSystemEnabled(ctx.entity.id, false)
                    }
                }
            },
            {
                id: 'enable-system-field',
                labelKey: 'fieldDefinitions.actions.enableSystemField',
                icon: <CheckCircleOutlineIcon fontSize='small' />,
                order: 11,
                visible: (ctx: ActionContext<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload>) => {
                    const current = attributeMap.get(ctx.entity.id)
                    const systemKey = current?.system?.systemKey ?? ctx.entity.system?.systemKey ?? null
                    const definition = systemKey ? getCatalogSystemFieldDefinition(systemKey) : null
                    const isBlockedPlatformToggle = definition?.layer === 'upl' && !platformSystemFieldDefinitionsPolicy.allowConfiguration
                    return (current?.system?.isEnabled ?? ctx.entity.system?.isEnabled ?? true) === false && !isBlockedPlatformToggle
                },
                onSelect: async (ctx: ActionContext<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload>) => {
                    if (typeof ctx.toggleSystemEnabled === 'function') {
                        await ctx.toggleSystemEnabled(ctx.entity.id, true)
                    }
                }
            }
        ],
        [attributeMap, platformSystemFieldDefinitionsPolicy.allowConfiguration]
    )

    const handlePendingAttributeInteraction = useCallback(
        (fieldDefinitionId: string) => {
            if (!metahubId || !linkedCollectionId) return
            revealPendingEntityFeedback({
                queryClient,
                queryKeyPrefix: effectiveTreeEntityId
                    ? metahubsQueryKeys.fieldDefinitions(metahubId, effectiveTreeEntityId, linkedCollectionId)
                    : metahubsQueryKeys.fieldDefinitionsDirect(metahubId, linkedCollectionId),
                entityId: fieldDefinitionId
            })
            enqueueSnackbar(pendingInteractionMessage, { variant: 'info' })
        },
        [linkedCollectionId, effectiveTreeEntityId, enqueueSnackbar, metahubId, pendingInteractionMessage, queryClient]
    )

    // DnD: Handle reorder (same-list + cross-list transfer)
    const handleReorder = useCallback(
        async (
            fieldDefinitionId: string,
            newSortOrder: number,
            newParentAttributeId?: string | null,
            currentParentAttributeId?: string | null,
            mergedOrderIds?: string[]
        ) => {
            if (!metahubId || !linkedCollectionId) return

            try {
                await reorderMutation.mutateAsync({
                    metahubId,
                    treeEntityId: effectiveTreeEntityId,
                    linkedCollectionId,
                    fieldDefinitionId,
                    newSortOrder,
                    newParentAttributeId,
                    currentParentAttributeId,
                    mergedOrderIds
                })
                enqueueSnackbar(t('fieldDefinitions.reorderSuccess', 'Attribute order updated'), { variant: 'success' })
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
                        t('fieldDefinitions.tableValidation.maxChildAttributes', 'Maximum {{max}} child fieldDefinitions per TABLE', {
                            max: max ?? '—'
                        }),
                        { variant: 'error' }
                    )
                    return
                }

                if (responseStatus === 409 && responseCode === 'CODENAME_CONFLICT') {
                    const conflictCodename = typeof responseData?.codename === 'string' ? responseData.codename : ''
                    const shouldAutoRename = await confirm({
                        title: t('fieldDefinitions.dnd.codenameConflictTitle', 'Codename conflict'),
                        description: t(
                            'fieldDefinitions.dnd.codenameConflictDescription',
                            'An attribute with codename "{{codename}}" already exists in the target list. Move with automatic codename rename?',
                            { codename: conflictCodename }
                        ),
                        confirmButtonName: t('fieldDefinitions.dnd.confirmMove', 'Move'),
                        cancelButtonName: tc('actions.cancel', 'Cancel')
                    })
                    if (shouldAutoRename) {
                        try {
                            await reorderMutation.mutateAsync({
                                metahubId,
                                treeEntityId: effectiveTreeEntityId,
                                linkedCollectionId,
                                fieldDefinitionId,
                                newSortOrder,
                                newParentAttributeId,
                                autoRenameCodename: true,
                                currentParentAttributeId,
                                mergedOrderIds
                            })
                            enqueueSnackbar(t('fieldDefinitions.reorderSuccess', 'Attribute order updated'), { variant: 'success' })
                        } catch (retryError: unknown) {
                            if (extractResponseCode(retryError) === 'TABLE_CHILD_LIMIT_REACHED') {
                                const max = extractResponseMaxChildAttributes(retryError)
                                enqueueSnackbar(
                                    t(
                                        'fieldDefinitions.tableValidation.maxChildAttributes',
                                        'Maximum {{max}} child fieldDefinitions per TABLE',
                                        {
                                            max: max ?? '—'
                                        }
                                    ),
                                    { variant: 'error' }
                                )
                                return
                            }
                            const msg =
                                retryError instanceof Error
                                    ? retryError.message
                                    : t('fieldDefinitions.reorderError', 'Failed to reorder attribute')
                            enqueueSnackbar(msg, { variant: 'error' })
                        }
                    }
                    return
                }

                // Other errors — show generic snackbar
                const message = error instanceof Error ? error.message : t('fieldDefinitions.reorderError', 'Failed to reorder attribute')
                enqueueSnackbar(message, { variant: 'error' })
            }
        },
        [metahubId, linkedCollectionId, effectiveTreeEntityId, reorderMutation, confirm, enqueueSnackbar, t, tc]
    )

    const sortedAttributes = useMemo(() => sortSharedEntityList(fieldDefinitions ?? []), [fieldDefinitions])

    const attributeTableData = useMemo(
        () => sortedAttributes.map((attribute) => toFieldDefinitionDisplay(attribute, i18n.language)),
        [i18n.language, sortedAttributes]
    )

    const hasSharedRows = useMemo(
        () => includeShared && attributeTableData.some((row) => isSharedEntityRow(row)),
        [attributeTableData, includeShared]
    )

    const firstLocalRowId = useMemo(() => {
        if (!hasSharedRows) return null
        return attributeTableData.find((row) => !isSharedEntityRow(row))?.id ?? null
    }, [attributeTableData, hasSharedRows])

    const getAttributeRowSx = useCallback(
        (row: FieldDefinitionDisplay) => {
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

    const isAttributeRowDragDisabled = useCallback(
        (row: FieldDefinitionDisplay) => hasSharedRows && isSharedEntityRow(row) && !isSharedEntityMovable(row),
        [hasSharedRows]
    )

    // DnD: Validate cross-list transfer before applying
    const handleValidateTransfer = useCallback(
        async (attribute: FieldDefinition, targetParentId: string | null, targetContainerItemCount: number): Promise<boolean> => {
            // Display attribute cannot be moved between lists (root ↔ child)
            if (attribute.isDisplayAttribute) {
                await confirm({
                    title: t('fieldDefinitions.dnd.displayAttributeBlockedTitle', 'Cannot move display attribute'),
                    description: t(
                        'fieldDefinitions.dnd.displayAttributeBlockedDescription',
                        'This attribute is the display attribute for its list. Assign another attribute as the display attribute first, then try again.'
                    ),
                    confirmButtonName: tc('ok', 'OK'),
                    hideCancelButton: true
                })
                return false
            }

            // TABLE fieldDefinitions can only exist at root level
            if (attribute.dataType === 'TABLE' && targetParentId !== null) {
                await confirm({
                    title: t('fieldDefinitions.dnd.tableCannotMoveTitle', 'Cannot move TABLE attribute'),
                    description: t(
                        'fieldDefinitions.dnd.tableCannotMoveDescription',
                        'TABLE fieldDefinitions can only exist at the root level.'
                    ),
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
                        title: t('fieldDefinitions.dnd.tableChildLimitTitle', 'Cannot move attribute'),
                        description: t(
                            'fieldDefinitions.tableValidation.maxChildAttributes',
                            'Maximum {{max}} child fieldDefinitions per TABLE',
                            {
                                max: maxChildAttributes
                            }
                        ),
                        confirmButtonName: tc('ok', 'OK'),
                        hideCancelButton: true
                    })
                    return false
                }
            }

            // Moving to an empty child table — attribute will become display + required
            if (targetParentId !== null && targetContainerItemCount === 0) {
                const shouldMove = await confirm({
                    title: t('fieldDefinitions.dnd.firstChildAttributeTitle', 'First child attribute'),
                    description: t(
                        'fieldDefinitions.dnd.firstChildAttributeDescription',
                        'This will be the first attribute in the table. It will automatically become the display attribute and required. After that, it cannot be moved out until another attribute is set as the display attribute.'
                    ),
                    confirmButtonName: t('fieldDefinitions.dnd.confirmMove', 'Move'),
                    cancelButtonName: tc('actions.cancel', 'Cancel')
                })
                if (!shouldMove) return false
            }

            return true
        },
        [attributeMap, confirm, t, tc]
    )

    const localizedFormDefaults = useMemo<AttributeFormValues>(() => {
        const shouldForceDefaults = shouldForceFirstAttributeDefaults(fieldDefinitions?.length ?? 0, sharedEntityMode)
        return {
            nameVlc: null,
            codename: null,
            codenameTouched: false,
            dataType: 'STRING',
            isRequired: shouldForceDefaults,
            isDisplayAttribute: shouldForceDefaults,
            targetEntityId: null,
            targetEntityKind: null,
            targetConstantId: null,
            validationRules: {
                ...getDefaultValidationRules('STRING'),
                maxLength: 10
            },
            uiConfig: {}
        }
    }, [fieldDefinitions?.length, sharedEntityMode])

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
                errors.codename = t('fieldDefinitions.validation.codenameRequired', 'Codename is required')
            } else if (
                !isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            ) {
                errors.codename = t('fieldDefinitions.validation.codenameInvalid', 'Codename contains invalid characters')
            }
            // REF type requires target entity
            if (values.dataType === 'REF') {
                if (!values.targetEntityKind) {
                    errors.targetEntityKind = t(
                        'fieldDefinitions.validation.targetEntityKindRequired',
                        'Target entity type is required for Reference type'
                    )
                }
                if (!values.targetEntityId) {
                    errors.targetEntityId = t(
                        'fieldDefinitions.validation.targetEntityIdRequired',
                        'Target entity is required for Reference type'
                    )
                }
                if (values.targetEntityKind === 'set' && !values.targetConstantId) {
                    errors.targetConstantId = t(
                        'fieldDefinitions.validation.targetConstantIdRequired',
                        'Target constant is required for references to Set'
                    )
                }
            }
            if (values.dataType === 'REF' && values.targetEntityKind !== 'set' && values.targetConstantId) {
                errors.targetConstantId = t(
                    'fieldDefinitions.validation.targetConstantOnlyForSet',
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
            const displayAttributeLocked = shouldForceFirstAttributeDefaults(fieldDefinitions?.length ?? 0, sharedEntityMode)
            const tabs: TabConfig[] = [
                {
                    id: 'general',
                    label: t('fieldDefinitions.tabs.general', 'General'),
                    content: (
                        <FieldDefinitionFormFields
                            values={values}
                            setValue={setValue}
                            isLoading={isLoading}
                            errors={fieldErrors}
                            uiLocale={i18n.language}
                            nameLabel={tc('fields.name', 'Name')}
                            codenameLabel={t('fieldDefinitions.codename', 'Codename')}
                            codenameHelper={t('fieldDefinitions.codenameHelper', 'Unique identifier')}
                            dataTypeLabel={t('fieldDefinitions.dataType', 'Data Type')}
                            requiredLabel={t('fieldDefinitions.isRequiredLabel', 'Required')}
                            displayAttributeLabel={t('fieldDefinitions.isDisplayAttributeLabel', 'Display attribute')}
                            displayAttributeHelper={t(
                                'fieldDefinitions.isDisplayAttributeHelper',
                                'Use as representation when referencing records of this catalog'
                            )}
                            displayAttributeLocked={displayAttributeLocked}
                            dataTypeOptions={[
                                { value: 'STRING', label: t('fieldDefinitions.dataTypeOptions.string', 'String') },
                                { value: 'NUMBER', label: t('fieldDefinitions.dataTypeOptions.number', 'Number') },
                                { value: 'BOOLEAN', label: t('fieldDefinitions.dataTypeOptions.boolean', 'Boolean') },
                                { value: 'DATE', label: t('fieldDefinitions.dataTypeOptions.date', 'Date') },
                                { value: 'REF', label: t('fieldDefinitions.dataTypeOptions.ref', 'Reference') },
                                { value: 'JSON', label: t('fieldDefinitions.dataTypeOptions.json', 'JSON') },
                                { value: 'TABLE', label: t('fieldDefinitions.dataTypeOptions.table', 'Table') }
                            ]}
                            typeSettingsLabel={t('fieldDefinitions.typeSettings.title', 'Type Settings')}
                            stringMaxLengthLabel={t('fieldDefinitions.typeSettings.string.maxLength', 'Max Length')}
                            stringMinLengthLabel={t('fieldDefinitions.typeSettings.string.minLength', 'Min Length')}
                            stringVersionedLabel={t('fieldDefinitions.typeSettings.string.versioned', 'Versioned (VLC)')}
                            stringLocalizedLabel={t('fieldDefinitions.typeSettings.string.localized', 'Localized (VLC)')}
                            numberPrecisionLabel={t('fieldDefinitions.typeSettings.number.precision', 'Precision')}
                            numberScaleLabel={t('fieldDefinitions.typeSettings.number.scale', 'Scale')}
                            numberMinLabel={t('fieldDefinitions.typeSettings.number.min', 'Min Value')}
                            numberMaxLabel={t('fieldDefinitions.typeSettings.number.max', 'Max Value')}
                            numberNonNegativeLabel={t('fieldDefinitions.typeSettings.number.nonNegative', 'Non-negative only')}
                            dateCompositionLabel={t('fieldDefinitions.typeSettings.date.composition', 'Date Composition')}
                            dateCompositionOptions={[
                                { value: 'date', label: t('fieldDefinitions.typeSettings.date.compositionOptions.date', 'Date only') },
                                { value: 'time', label: t('fieldDefinitions.typeSettings.date.compositionOptions.time', 'Time only') },
                                {
                                    value: 'datetime',
                                    label: t('fieldDefinitions.typeSettings.date.compositionOptions.datetime', 'Date and Time')
                                }
                            ]}
                            physicalTypeLabel={t('fieldDefinitions.physicalType.label', 'PostgreSQL type')}
                            metahubId={metahubId!}
                            currentLinkedCollectionId={linkedCollectionId}
                            hideDisplayAttribute
                        />
                    )
                },
                {
                    id: 'presentation',
                    label: t('fieldDefinitions.tabs.presentation', 'Presentation'),
                    content: (
                        <Stack spacing={2}>
                            <PresentationTabFields
                                values={values}
                                setValue={setValue}
                                isLoading={isLoading}
                                metahubId={metahubId}
                                displayAttributeLabel={t('fieldDefinitions.isDisplayAttributeLabel', 'Display attribute')}
                                displayAttributeHelper={t(
                                    'fieldDefinitions.isDisplayAttributeHelper',
                                    'Use as representation when referencing records of this catalog'
                                )}
                                displayAttributeLocked={displayAttributeLocked}
                                forceDisplayAttributeWhenLocked={displayAttributeLocked}
                                headerAsCheckboxLabel={t('fieldDefinitions.presentation.headerAsCheckbox', 'Display header as checkbox')}
                                headerAsCheckboxHelper={t(
                                    'fieldDefinitions.presentation.headerAsCheckboxHelper',
                                    'Show a checkbox in the column header instead of the text label'
                                )}
                                dataType={values.dataType ?? 'STRING'}
                                targetEntityKind={values.targetEntityKind ?? null}
                                targetEntityId={values.targetEntityId ?? null}
                                isRequired={Boolean(values.isRequired)}
                            />
                            {sharedEntityMode ? (
                                <SharedEntitySettingsFields
                                    metahubId={metahubId}
                                    entityKind='attribute'
                                    sharedEntityId={null}
                                    storageField='uiConfig'
                                    section='behavior'
                                    values={values}
                                    setValue={setValue}
                                    isLoading={isLoading}
                                />
                            ) : null}
                        </Stack>
                    )
                }
            ]

            if (sharedEntityMode) {
                tabs.push({
                    id: 'exclusions',
                    label: t('metahubs:shared.exclusions.tab', 'Exclusions'),
                    content: (
                        <SharedEntitySettingsFields
                            metahubId={metahubId}
                            entityKind='attribute'
                            sharedEntityId={null}
                            storageField='uiConfig'
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
        [fieldDefinitions?.length, linkedCollectionId, i18n.language, metahubId, sharedEntityMode, t, tc]
    )

    const attributeColumns = useMemo(() => {
        const columns = [
            {
                id: 'sortOrder',
                label: t('fieldDefinitions.table.order', '#'),
                width: '3%',
                align: 'center' as const,
                sortable: true,
                sortAccessor: (row: FieldDefinitionDisplay) => row.sortOrder ?? 0,
                render: (_row: FieldDefinitionDisplay, index: number) => (
                    <Typography sx={{ fontSize: 13, fontWeight: 600, textAlign: 'center' }}>{index + 1}</Typography>
                )
            },
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: isSystemView ? '30%' : '35%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: FieldDefinitionDisplay) => row.name || '',
                render: (row: FieldDefinitionDisplay) => {
                    const rawAttribute = attributeMap.get(row.id)
                    const isDisplayAttr = rawAttribute?.isDisplayAttribute ?? row.isDisplayAttribute ?? false
                    const systemMetadata = rawAttribute?.system ?? row.system ?? null
                    return (
                        <Stack spacing={0.5}>
                            <Stack direction='row' spacing={0.5} alignItems='center' flexWrap='wrap' useFlexGap>
                                {isDisplayAttr && (
                                    <Tooltip
                                        title={t(
                                            'fieldDefinitions.isDisplayAttributeTooltip',
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
                                {includeShared && isSharedEntityRow(row) ? (
                                    <Chip label={t('metahubs:shared.list.badge', 'Shared')} size='small' color='info' variant='outlined' />
                                ) : null}
                                {includeShared && isSharedEntityRow(row) && !isSharedEntityActive(row) ? (
                                    <Chip label={t('metahubs:shared.list.inactive', 'Inactive')} size='small' variant='outlined' />
                                ) : null}
                            </Stack>
                            {isSystemView && systemMetadata?.systemKey && (
                                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                                    {t('fieldDefinitions.system.keyLabel', 'System key')}: {systemMetadata.systemKey}
                                </Typography>
                            )}
                        </Stack>
                    )
                }
            },
            {
                id: 'codename',
                label: t('fieldDefinitions.codename', 'Codename'),
                width: isSystemView ? '18%' : '20%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: FieldDefinitionDisplay) => row.codename || '',
                render: (row: FieldDefinitionDisplay) => (
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
                label: t('fieldDefinitions.dataType', 'Type'),
                width: isSystemView ? '24%' : '17%',
                align: 'center' as const,
                render: (row: FieldDefinitionDisplay) => {
                    const rules = row.validationRules as FieldDefinitionValidationRules | undefined
                    const hasVersioned = rules?.versioned
                    const hasLocalized = rules?.localized
                    const physicalInfo = getPhysicalDataType(row.dataType, rules)
                    const physicalTypeStr = formatPhysicalType(physicalInfo)
                    const tooltipTitle = t('fieldDefinitions.physicalType.tooltip', 'PostgreSQL: {{type}}', { type: physicalTypeStr })
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
                label: t('fieldDefinitions.system.status', 'Status'),
                width: '12%',
                align: 'center' as const,
                render: (row: FieldDefinitionDisplay) => {
                    const rawAttribute = attributeMap.get(row.id)
                    const isEnabled = rawAttribute?.system?.isEnabled ?? row.system?.isEnabled ?? true
                    return (
                        <Chip
                            label={
                                isEnabled
                                    ? t('fieldDefinitions.system.enabled', 'Enabled')
                                    : t('fieldDefinitions.system.disabled', 'Disabled')
                            }
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
                label: t('fieldDefinitions.required', 'Required'),
                width: '15%',
                align: 'center' as const,
                render: (row: FieldDefinitionDisplay) => (
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
    }, [attributeMap, includeShared, isSystemView, t, tc])

    const createAttributeContext = useCallback(
        (baseContext: ActionContext<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload>) => ({
            ...baseContext,
            attributeMap,
            uiLocale: i18n.language,
            metahubId,
            linkedCollectionId,
            sharedEntityMode,
            api: {
                updateEntity: (id: string, patch: FieldDefinitionLocalizedPayload) => {
                    if (!metahubId || !linkedCollectionId) return Promise.resolve()
                    const sharedExcludedTargetIds = readSharedExcludedTargetIdsField(patch)
                    const { [SHARED_EXCLUDED_TARGET_IDS_FIELD]: _ignored, ...payloadWithoutSharedExclusions } =
                        patch as FieldDefinitionLocalizedPayload & Record<string, unknown>
                    const rawCodename = getVLCString(patch.codename, patch.codename?._primary ?? 'en')
                    const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
                    if (!normalizedCodename) {
                        throw new Error(t('fieldDefinitions.validation.codenameRequired', 'Codename is required'))
                    }
                    if (
                        !isValidCodenameForStyle(
                            normalizedCodename,
                            codenameConfig.style,
                            codenameConfig.alphabet,
                            codenameConfig.allowMixed
                        )
                    ) {
                        throw new Error(t('fieldDefinitions.validation.codenameInvalid', 'Codename contains invalid characters'))
                    }
                    const dataType = patch.dataType ?? 'STRING'
                    const codenamePayload = ensureLocalizedContent(patch.codename, patch.codename?._primary ?? 'en', normalizedCodename)
                    const attribute = attributeMap.get(id)
                    const expectedVersion = attribute?.version

                    return updateAttributeMutation
                        .mutateAsync({
                            metahubId,
                            treeEntityId: effectiveTreeEntityId,
                            linkedCollectionId,
                            fieldDefinitionId: id,
                            data: {
                                ...payloadWithoutSharedExclusions,
                                codename: codenamePayload,
                                dataType,
                                isRequired: patch.isRequired,
                                expectedVersion
                            }
                        })
                        .then(async () => {
                            if (sharedEntityMode && sharedExcludedTargetIds !== undefined) {
                                await syncSharedEntityExclusions({
                                    metahubId,
                                    entityKind: 'attribute',
                                    sharedEntityId: id,
                                    excludedTargetIds: sharedExcludedTargetIds
                                })
                            }
                        })
                        .catch((error: unknown) => {
                            if (isOptimisticLockConflict(error)) {
                                const conflict = extractConflictInfo(error)
                                if (conflict) {
                                    openConflict({
                                        conflict,
                                        pendingUpdate: {
                                            id,
                                            patch: {
                                                ...payloadWithoutSharedExclusions,
                                                codename: codenamePayload,
                                                dataType,
                                                isRequired: patch.isRequired
                                            }
                                        }
                                    })
                                }
                                throw DIALOG_SAVE_CANCEL
                            }

                            throw error
                        })
                },
                deleteEntity: (id: string) => {
                    if (!metahubId || !linkedCollectionId) return
                    return deleteAttributeMutation.mutateAsync({
                        metahubId,
                        treeEntityId: effectiveTreeEntityId, // Optional - undefined for hub-less linkedCollections
                        linkedCollectionId,
                        fieldDefinitionId: id
                    })
                },
                copyEntity: (id: string, payload: FieldDefinitionLocalizedPayload & Record<string, unknown>) => {
                    if (!metahubId || !linkedCollectionId) return Promise.resolve()
                    copyAttributeMutation.mutate({
                        metahubId,
                        treeEntityId: effectiveTreeEntityId,
                        linkedCollectionId,
                        fieldDefinitionId: id,
                        data: payload
                    })

                    return Promise.resolve()
                }
            },
            moveAttribute: async (id: string, direction: 'up' | 'down') => {
                if (!metahubId || !linkedCollectionId) return
                await moveAttributeMutation.mutateAsync({
                    metahubId,
                    treeEntityId: effectiveTreeEntityId, // Optional - undefined for hub-less linkedCollections
                    linkedCollectionId,
                    fieldDefinitionId: id,
                    direction
                })
                // Invalidate queries - effectiveTreeEntityId is optional for direct queries
                if (effectiveTreeEntityId) {
                    await invalidateFieldDefinitionsQueries.all(queryClient, metahubId, effectiveTreeEntityId, linkedCollectionId)
                } else {
                    // Invalidate direct queries for hub-less linkedCollections
                    queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.fieldDefinitionsDirect(metahubId, linkedCollectionId) })
                }
            },
            toggleRequired: async (id: string, isRequired: boolean) => {
                if (!metahubId || !linkedCollectionId) return
                await toggleRequiredMutation.mutateAsync({
                    metahubId,
                    treeEntityId: effectiveTreeEntityId,
                    linkedCollectionId,
                    fieldDefinitionId: id,
                    isRequired
                })
                if (effectiveTreeEntityId) {
                    await invalidateFieldDefinitionsQueries.all(queryClient, metahubId, effectiveTreeEntityId, linkedCollectionId)
                } else {
                    queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.fieldDefinitionsDirect(metahubId, linkedCollectionId) })
                }
            },
            toggleDisplayAttribute: async (id: string, isDisplayAttribute: boolean) => {
                if (!metahubId || !linkedCollectionId) return
                if (isDisplayAttribute) {
                    await setDisplayAttributeMutation.mutateAsync({
                        metahubId,
                        treeEntityId: effectiveTreeEntityId,
                        linkedCollectionId,
                        fieldDefinitionId: id
                    })
                } else {
                    await clearDisplayAttributeMutation.mutateAsync({
                        metahubId,
                        treeEntityId: effectiveTreeEntityId,
                        linkedCollectionId,
                        fieldDefinitionId: id
                    })
                }
                if (effectiveTreeEntityId) {
                    await invalidateFieldDefinitionsQueries.all(queryClient, metahubId, effectiveTreeEntityId, linkedCollectionId)
                } else {
                    queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.fieldDefinitionsDirect(metahubId, linkedCollectionId) })
                }
            },
            toggleSystemEnabled: async (id: string, isEnabled: boolean) => {
                if (!metahubId || !linkedCollectionId) return
                const attribute = attributeMap.get(id)
                await updateAttributeMutation.mutateAsync({
                    metahubId,
                    treeEntityId: effectiveTreeEntityId,
                    linkedCollectionId,
                    fieldDefinitionId: id,
                    data: {
                        isEnabled,
                        expectedVersion: attribute?.version
                    }
                })
            },
            helpers: {
                refreshList: () => {
                    if (metahubId && linkedCollectionId) {
                        // Always invalidate global codenames cache (for global scope duplicate checking)
                        invalidateFieldDefinitionsQueries.allCodenames(queryClient, metahubId, linkedCollectionId)
                        if (effectiveTreeEntityId) {
                            void invalidateFieldDefinitionsQueries.all(queryClient, metahubId, effectiveTreeEntityId, linkedCollectionId)
                        } else {
                            // Invalidate direct queries for hub-less linkedCollections
                            void queryClient.invalidateQueries({
                                queryKey: metahubsQueryKeys.fieldDefinitionsDirect(metahubId, linkedCollectionId)
                            })
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
                openDeleteDialog: (attribute: FieldDefinition) => {
                    const actualAttribute = attributeMap.get(attribute.id) ?? attribute
                    if (actualAttribute?.isDisplayAttribute) {
                        enqueueSnackbar(
                            t(
                                'fieldDefinitions.deleteDisplayAttributeBlocked',
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
            linkedCollectionId,
            clearDisplayAttributeMutation,
            codenameConfig.allowMixed,
            codenameConfig.alphabet,
            codenameConfig.style,
            copyAttributeMutation,
            confirm,
            deleteAttributeMutation,
            enqueueSnackbar,
            effectiveTreeEntityId,
            i18n.language,
            metahubId,
            moveAttributeMutation,
            openConflict,
            openDelete,
            queryClient,
            setDisplayAttributeMutation,
            sharedEntityMode,
            t,
            toggleRequiredMutation,
            updateAttributeMutation
        ]
    )

    // Validate metahubId and linkedCollectionId from URL AFTER all hooks
    if (!metahubId || !linkedCollectionId) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Invalid catalog'
                title={t('errors.noTreeEntityId', 'No hub ID provided')}
                description={t('errors.pleaseSelectHub', 'Please select a hub')}
            />
        )
    }

    // Show loading while resolving catalog (only when no treeEntityId in URL)
    if (showSettingsTab && !hubIdParam && isCatalogResolutionLoading) {
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
    if (showSettingsTab && !hubIdParam && catalogResolutionError) {
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
        if (!metahubId || !linkedCollectionId) return
        if (!showCatalogTabs) return
        if (nextTab === 'settings') {
            setEditDialogOpen(true)
            return
        }
        if (nextTab === 'fieldDefinitions' || nextTab === 'system') {
            navigate(buildCatalogTabPath(nextTab))
            return
        }
        navigate(buildCatalogTabPath('records'))
    }

    const handleCreateAttribute = (data: GenericFormValues) => {
        // Validation is handled by EntityFormDialog's validate/canSave props.
        const nameVlc = data.nameVlc as VersionedLocalizedContent<string> | null | undefined
        const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
        const codenameValue = data.codename as VersionedLocalizedContent<string> | null | undefined
        const rawCodename = getVLCString(codenameValue || undefined, codenameValue?._primary ?? namePrimaryLocale ?? 'en')
        const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
        const codenamePayload = ensureLocalizedContent(codenameValue, namePrimaryLocale ?? 'en', normalizedCodename || '')

        const dataType = (data.dataType as FieldDefinitionDataType | undefined) ?? 'STRING'
        const isRequired = Boolean(data.isRequired)
        const validationRules = data.validationRules as FieldDefinitionValidationRules | undefined
        const isDisplayAttribute = Boolean(data.isDisplayAttribute)
        const uiConfig = (data.uiConfig as Record<string, unknown>) ?? {}

        // REF type: extract target entity info
        const targetEntityId = dataType === 'REF' ? (data.targetEntityId as string | null) : undefined
        const targetEntityKind = dataType === 'REF' ? (data.targetEntityKind as EntityKind | null) : undefined
        const targetConstantId =
            dataType === 'REF' && targetEntityKind === 'set' ? (data.targetConstantId as string | null) ?? null : undefined
        const normalizedUiConfig = sanitizeAttributeUiConfig(dataType, targetEntityKind, uiConfig)

        // Fire-and-forget: optimistic card via onMutate, errors via onError snackbar,
        // cache invalidation via onSettled. Dialog closes immediately.
        createAttributeMutation.mutate({
            metahubId,
            treeEntityId: effectiveTreeEntityId,
            linkedCollectionId,
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

    const renderFieldDefinitionActions = (row: FieldDefinitionDisplay) => {
        const originalAttribute = attributeMap.get(row.id)
        if (!originalAttribute) return null

        const isMergedSharedRow = includeShared && isSharedEntityRow(row)
        const isSharedRowActive = isSharedEntityActive(row)

        const handleSharedRowOverride = async (patch: { isExcluded?: boolean; isActive?: boolean | null }, successMessage: string) => {
            if (!metahubId || !linkedCollectionId) return

            try {
                await upsertSharedEntityOverrideMutation.mutateAsync({
                    metahubId,
                    data: {
                        entityKind: 'attribute',
                        sharedEntityId: row.id,
                        targetObjectId: linkedCollectionId,
                        ...patch
                    }
                })

                if (effectiveTreeEntityId) {
                    await invalidateFieldDefinitionsQueries.all(queryClient, metahubId, effectiveTreeEntityId, linkedCollectionId)
                } else {
                    await queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.fieldDefinitionsDirect(metahubId, linkedCollectionId)
                    })
                }

                enqueueSnackbar(successMessage, { variant: 'success' })
            } catch (error: unknown) {
                const message =
                    extractResponseMessage(error) ??
                    (error instanceof Error
                        ? error.message
                        : t('metahubs:shared.list.messages.actionError', 'Failed to update shared entity state'))
                enqueueSnackbar(message, { variant: 'error' })
            }
        }

        const displayEntity = toFieldDefinitionDisplay(originalAttribute, i18n.language)
        const descriptors: ActionDescriptor<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload>[] = isSystemView
            ? systemFieldDefinitionActions
            : includeShared
            ? fieldDefinitionActions.filter((descriptor) => descriptor.id !== 'move-up' && descriptor.id !== 'move-down')
            : [...fieldDefinitionActions]
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
        const sharedRowDescriptors: ActionDescriptor<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload>[] = []

        if (isMergedSharedRow && row.sharedBehavior?.canDeactivate !== false) {
            sharedRowDescriptors.push({
                id: isSharedRowActive ? 'deactivate' : 'activate',
                labelKey: isSharedRowActive ? 'shared.list.actions.deactivate' : 'shared.list.actions.activate',
                order: 10,
                onSelect: async () => {
                    await handleSharedRowOverride(
                        { isActive: isSharedRowActive ? false : null },
                        isSharedRowActive
                            ? t('metahubs:shared.list.messages.deactivated', 'Shared entity disabled for this target')
                            : t('metahubs:shared.list.messages.activated', 'Shared entity enabled for this target')
                    )
                }
            })
        }

        if (isMergedSharedRow && row.sharedBehavior?.canExclude !== false) {
            sharedRowDescriptors.push({
                id: 'exclude',
                labelKey: 'shared.list.actions.exclude',
                order: 20,
                tone: 'danger',
                dividerBefore: sharedRowDescriptors.length > 0,
                onSelect: async () => {
                    await handleSharedRowOverride(
                        { isExcluded: true },
                        t('metahubs:shared.list.messages.excluded', 'Shared entity excluded from this target')
                    )
                }
            })
        }

        const menuDescriptors = isMergedSharedRow ? sharedRowDescriptors : visibleDescriptors

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
                {menuDescriptors.length > 0 && (
                    <BaseEntityMenu<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload>
                        entity={displayEntity}
                        entityKind='attribute'
                        descriptors={menuDescriptors}
                        namespace='metahubs'
                        menuButtonLabelKey='flowList:menu.button'
                        i18nInstance={i18n}
                        createContext={createAttributeContext}
                    />
                )}
            </Stack>
        )
    }

    const contentOffsetSx = 0

    const body = (
        <>
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
                        searchPlaceholder={t('fieldDefinitions.searchPlaceholder')}
                        onSearchChange={handleSearchChange}
                        controlsAlign={renderPageShell ? 'start' : 'end'}
                        title={
                            title !== undefined
                                ? title
                                : isSystemView
                                ? t('fieldDefinitions.system.title', 'System Attributes')
                                : t('fieldDefinitions.title')
                        }
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

                    {showCatalogTabs ? (
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
                                <Tab value='fieldDefinitions' label={t('fieldDefinitions.title')} />
                                {allowSystemTab ? <Tab value='system' label={t('fieldDefinitions.tabs.system', 'System')} /> : null}
                                <Tab value='records' label={t('records.title')} />
                                {showSettingsTab ? <Tab value='settings' label={t('settings.title')} /> : null}
                            </Tabs>
                        </Box>
                    ) : null}

                    {allowSystemTab && isSystemView ? (
                        <Alert
                            severity='info'
                            icon={<InfoIcon />}
                            sx={{
                                mx: contentOffsetSx,
                                mt: 0,
                                mb: 2
                            }}
                        >
                            {t(
                                'fieldDefinitions.system.hint',
                                'System fieldDefinitions are provided by the platform. You can only enable or disable supported fieldDefinitions.'
                            )}
                        </Alert>
                    ) : null}

                    {!isSystemView && limitReached ? (
                        <Alert
                            severity='info'
                            icon={<InfoIcon />}
                            sx={{
                                mx: contentOffsetSx,
                                mt: 0,
                                mb: 2
                            }}
                        >
                            {t('fieldDefinitions.limitReached', { limit: limitValue })}
                        </Alert>
                    ) : null}

                    {isLoading && fieldDefinitions.length === 0 ? (
                        <Skeleton variant='rectangular' height={120} />
                    ) : !isLoading && fieldDefinitions.length === 0 ? (
                        <EmptyListState
                            image={APIEmptySVG}
                            imageAlt='No fieldDefinitions'
                            title={
                                emptyTitle ??
                                (isSystemView
                                    ? t('fieldDefinitions.system.empty', 'No system fieldDefinitions')
                                    : t('fieldDefinitions.empty'))
                            }
                            description={
                                emptyDescription ??
                                (isSystemView
                                    ? t(
                                          'fieldDefinitions.system.emptyDescription',
                                          'This catalog has no configurable system fieldDefinitions.'
                                      )
                                    : t('fieldDefinitions.emptyDescription'))
                            }
                        />
                    ) : (
                        <Box sx={{ mx: contentOffsetSx }}>
                            {isSystemView ? (
                                <FlowListTable<FieldDefinitionDisplay>
                                    data={attributeTableData}
                                    customColumns={attributeColumns}
                                    sortStateId='catalog-system-fieldDefinitions'
                                    initialOrder='asc'
                                    initialOrderBy='sortOrder'
                                    onPendingInteractionAttempt={(row: FieldDefinitionDisplay) => handlePendingAttributeInteraction(row.id)}
                                    renderActions={renderFieldDefinitionActions}
                                />
                            ) : (
                                <FieldDefinitionDndProvider
                                    rootItems={sortedAttributes}
                                    allowCrossListRootChildren={allowCrossListRootChildren}
                                    allowCrossListBetweenChildren={allowCrossListBetweenChildren}
                                    onReorder={handleReorder}
                                    onValidateTransfer={handleValidateTransfer}
                                    uiLocale={i18n.language}
                                >
                                    <DndDropTarget containerId='root'>
                                        {({ isDropTarget, pendingTransfer: pt, activeFieldDefinition: activeAttr }) => {
                                            const baseData = attributeTableData
                                            const baseIds = sortedAttributes.map((attribute) => attribute.id)
                                            let effectiveData = baseData
                                            let effectiveIds = baseIds

                                            if (pt) {
                                                if (pt.fromContainerId === 'root') {
                                                    effectiveData = baseData.filter((d) => d.id !== pt.itemId)
                                                    effectiveIds = baseIds.filter((id) => id !== pt.itemId)
                                                } else if (pt.toContainerId === 'root' && activeAttr) {
                                                    const ghost = toFieldDefinitionDisplay(activeAttr, i18n.language)
                                                    const insertAt = Math.min(pt.insertIndex, baseData.length)
                                                    effectiveData = [...baseData.slice(0, insertAt), ghost, ...baseData.slice(insertAt)]
                                                    effectiveIds = [...baseIds.slice(0, insertAt), pt.itemId, ...baseIds.slice(insertAt)]
                                                }
                                            }

                                            return (
                                                <FlowListTable<FieldDefinitionDisplay>
                                                    data={effectiveData}
                                                    customColumns={attributeColumns}
                                                    onPendingInteractionAttempt={(row: FieldDefinitionDisplay) =>
                                                        handlePendingAttributeInteraction(row.id)
                                                    }
                                                    sortableRows
                                                    externalDndContext
                                                    droppableContainerId='root'
                                                    sortableItemIds={effectiveIds}
                                                    dragHandleAriaLabel={t('fieldDefinitions.dnd.dragHandle', 'Drag to reorder')}
                                                    isDropTarget={isDropTarget}
                                                    getRowSx={getAttributeRowSx}
                                                    isRowDragDisabled={isAttributeRowDragDisabled}
                                                    renderActions={renderFieldDefinitionActions}
                                                    renderRowExpansion={(row: FieldDefinitionDisplay) => {
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
                                                                <NestedFieldDefinitionList
                                                                    metahubId={metahubId!}
                                                                    treeEntityId={effectiveTreeEntityId}
                                                                    linkedCollectionId={linkedCollectionId!}
                                                                    parentAttributeId={row.id}
                                                                    parentMaxChildAttributes={
                                                                        row.validationRules?.maxChildAttributes > 0 &&
                                                                        typeof row.validationRules.maxChildAttributes === 'number'
                                                                            ? row.validationRules.maxChildAttributes
                                                                            : null
                                                                    }
                                                                    searchFilter={
                                                                        childSearchMatchParentIds.includes(row.id) ? searchValue : undefined
                                                                    }
                                                                    onRefresh={async () => {
                                                                        if (metahubId && linkedCollectionId) {
                                                                            invalidateFieldDefinitionsQueries.allCodenames(
                                                                                queryClient,
                                                                                metahubId,
                                                                                linkedCollectionId
                                                                            )
                                                                        }
                                                                        if (effectiveTreeEntityId) {
                                                                            await invalidateFieldDefinitionsQueries.all(
                                                                                queryClient,
                                                                                metahubId!,
                                                                                effectiveTreeEntityId,
                                                                                linkedCollectionId!
                                                                            )
                                                                        } else {
                                                                            queryClient.invalidateQueries({
                                                                                queryKey: metahubsQueryKeys.fieldDefinitionsDirect(
                                                                                    metahubId!,
                                                                                    linkedCollectionId!
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
                                </FieldDefinitionDndProvider>
                            )}
                        </Box>
                    )}

                    {!isLoading && fieldDefinitions.length > 0 ? (
                        <Box sx={{ mx: contentOffsetSx, mt: 2 }}>
                            <PaginationControls
                                pagination={paginationResult.pagination}
                                actions={paginationResult.actions}
                                isLoading={paginationResult.isLoading}
                                rowsPerPageOptions={[10, 20, 50, 100]}
                                namespace='common'
                            />
                        </Box>
                    ) : null}
                </Stack>
            )}

            <EntityFormDialog
                open={dialogs.create.open}
                title={t('fieldDefinitions.createDialog.title', 'Add Attribute')}
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

            <ConfirmDeleteDialog
                open={dialogs.delete.open}
                title={t('fieldDefinitions.deleteDialog.title')}
                description={t('fieldDefinitions.deleteDialog.message')}
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
                                'fieldDefinitions.deleteDisplayAttributeBlocked',
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
                            treeEntityId: effectiveTreeEntityId,
                            linkedCollectionId,
                            fieldDefinitionId: dialogs.delete.item.id
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
                                        : t('fieldDefinitions.deleteError')
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
                    if (metahubId && linkedCollectionId) {
                        invalidateFieldDefinitionsQueries.allCodenames(queryClient, metahubId, linkedCollectionId)
                        if (effectiveTreeEntityId) {
                            invalidateFieldDefinitionsQueries.all(queryClient, metahubId, effectiveTreeEntityId, linkedCollectionId)
                        } else {
                            queryClient.invalidateQueries({
                                queryKey: metahubsQueryKeys.fieldDefinitionsDirect(metahubId, linkedCollectionId)
                            })
                        }
                    }
                }}
                onOverwrite={async () => {
                    const pendingUpdate = (
                        dialogs.conflict.data as { pendingUpdate?: { id: string; patch: FieldDefinitionLocalizedPayload } }
                    )?.pendingUpdate
                    if (pendingUpdate && metahubId && linkedCollectionId) {
                        const { id, patch } = pendingUpdate
                        await updateAttributeMutation.mutateAsync({
                            metahubId,
                            treeEntityId: effectiveTreeEntityId,
                            linkedCollectionId,
                            fieldDefinitionId: id,
                            data: patch
                        })
                        close('conflict')
                    }
                }}
                isLoading={updateAttributeMutation.isPending}
            />

            {showSettingsTab &&
                catalogForHubResolution &&
                linkedCollectionId &&
                (() => {
                    const catalogDisplay: LinkedCollectionDisplayWithContainer = {
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
                        treeEntityId: effectiveTreeEntityId || undefined,
                        treeEntities: catalogForHubResolution.treeEntities?.map((h) => ({
                            id: h.id,
                            name: typeof h.name === 'string' ? h.name : h.codename || '',
                            codename: h.codename || ''
                        }))
                    }
                    const catalogMap = new Map<string, LinkedCollectionEntity>([[catalogForHubResolution.id, catalogForHubResolution]])
                    const settingsCtx = {
                        entity: catalogDisplay,
                        entityKind: 'catalog' as const,
                        t,
                        catalogMap,
                        metahubId,
                        currentTreeEntityId: effectiveTreeEntityId || null,
                        uiLocale: preferredVlcLocale,
                        api: {
                            updateEntity: (id: string, patch: LinkedCollectionLocalizedPayload) => {
                                if (!metahubId) return
                                updateLinkedCollectionMutation.mutate({
                                    metahubId,
                                    linkedCollectionId: id,
                                    data: { ...patch, expectedVersion: catalogForHubResolution.version }
                                })
                            }
                        },
                        helpers: {
                            refreshList: () => {
                                if (metahubId && linkedCollectionId) {
                                    void queryClient.invalidateQueries({
                                        queryKey: metahubsQueryKeys.linkedCollectionDetail(metahubId, linkedCollectionId)
                                    })
                                    void queryClient.invalidateQueries({
                                        queryKey: metahubsQueryKeys.allLinkedCollections(metahubId)
                                    })
                                    void queryClient.invalidateQueries({
                                        queryKey: ['breadcrumb', 'catalog-standalone', metahubId, linkedCollectionId]
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
                            title={t('catalogs.editTitle', 'Edit LinkedCollectionEntity')}
                            nameLabel={tc('fields.name', 'Name')}
                            descriptionLabel={tc('fields.description', 'Description')}
                            saveButtonText={tc('actions.save', 'Save')}
                            savingButtonText={tc('actions.saving', 'Saving...')}
                            cancelButtonText={tc('actions.cancel', 'Cancel')}
                            hideDefaultFields
                            initialExtraValues={buildCatalogInitialValues(settingsCtx)}
                            tabs={buildLinkedCollectionFormTabs(settingsCtx, treeEntities, linkedCollectionId)}
                            validate={(values) => validateLinkedCollectionForm(settingsCtx, values)}
                            canSave={canSaveLinkedCollectionForm}
                            onSave={(data) => {
                                const payload = catalogToPayload(data)
                                settingsCtx.api.updateEntity(catalogForHubResolution.id, payload)
                            }}
                            onClose={() => setEditDialogOpen(false)}
                        />
                    )
                })()}
        </>
    )

    return (
        <FieldDefinitionDndContainerRegistryProvider>
            <ExistingCodenamesProvider entities={codenameEntities}>
                {renderPageShell ? (
                    <MainCard
                        sx={{ maxWidth: '100%', width: '100%' }}
                        contentSX={{ px: 0, py: 0 }}
                        disableContentPadding
                        disableHeader
                        border={false}
                        shadow={false}
                    >
                        {body}
                    </MainCard>
                ) : (
                    body
                )}
            </ExistingCodenamesProvider>
        </FieldDefinitionDndContainerRegistryProvider>
    )
}

const FieldDefinitionList = () => <FieldDefinitionListContent />

export default FieldDefinitionList
