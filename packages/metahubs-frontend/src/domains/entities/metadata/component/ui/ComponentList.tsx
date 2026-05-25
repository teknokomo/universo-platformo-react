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
    useCreateComponent,
    useCopyComponent,
    useUpdateComponent,
    useDeleteComponent,
    useMoveComponent,
    useReorderComponent,
    useToggleComponentRequired,
    useSetDisplayComponent,
    useClearDisplayComponent,
    useComponentListData
} from '../hooks'
import {
    invalidateComponentsQueries,
    isSharedEntityActive,
    isSharedEntityMovable,
    isSharedEntityRow,
    metahubsQueryKeys,
    sortSharedEntityList,
    useUpsertSharedEntityOverride
} from '../../../../shared'
import type { EntityKind, VersionedLocalizedContent } from '@universo/types'
import {
    Component,
    ComponentDisplay,
    ComponentDefinitionDataType,
    ComponentLocalizedPayload,
    toComponentDisplay,
    getDefaultValidationRules,
    getPhysicalDataType,
    formatPhysicalType,
    ObjectCollectionLocalizedPayload,
    getVLCString
} from '../../../../../types'
import { isOptimisticLockConflict, extractConflictInfo, type ConflictInfo } from '@universo/utils'
import { getObjectSystemComponent } from '@universo/utils'
import { normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../../../utils/codename'
import { extractLocalizedInput, hasPrimaryContent, ensureLocalizedContent } from '../../../../../utils/localizedInput'
import componentActions from './ComponentActions'
import ComponentFormFields, { PresentationTabFields } from './ComponentFormFields'
import { shouldForceFirstComponentDefaults } from './componentDisplayRules'
import NestedComponentList from './NestedComponentList'
import { ComponentDndProvider, ComponentDndContainerRegistryProvider, useComponentDndState } from './dnd'
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
    buildInitialValues as buildObjectInitialValues,
    buildFormTabs as buildObjectCollectionFormTabs,
    validateObjectCollectionForm,
    canSaveObjectCollectionForm,
    toPayload as objectToPayload
} from '../../../presets/ui/ObjectCollectionActions'
import type { ObjectCollectionDisplayWithContainer } from '../../../presets/ui/ObjectCollectionActions'
import { useUpdateObjectCollectionAtMetahub } from '../../../presets/hooks/objectCollectionMutations'
import type { ComponentFormValues, ConfirmSpec, ObjectTab } from './componentListUtils'
import {
    extractResponseData,
    hasResponseStatus,
    extractResponseMessage,
    extractResponseCode,
    extractResponseMaxChildComponents,
    sanitizeComponentUiConfig,
    getDataTypeColor
} from './componentListUtils'
import { buildObjectCollectionAuthoringPath } from '../../../../shared/entityMetadataRoutePaths'

type GenericFormValues = Record<string, unknown>

const DIALOG_SAVE_CANCEL = { __dialogCancelled: true } as const

type ComponentListContentProps = {
    metahubId?: string
    treeEntityId?: string | null
    objectCollectionId?: string
    sharedEntityMode?: boolean
    title?: string | null
    emptyTitle?: string
    emptyDescription?: string
    renderPageShell?: boolean
    showObjectTabs?: boolean
    showSettingsTab?: boolean
    allowSystemTab?: boolean
}

const DndDropTarget: React.FC<{
    containerId: string
    children: (props: {
        isDropTarget: boolean
        pendingTransfer: import('./dnd').PendingTransfer | null
        activeComponent: Component | undefined
    }) => React.ReactNode
}> = ({ containerId, children }) => {
    const { activeContainerId, overContainerId, pendingTransfer, activeComponent } = useComponentDndState()
    const isDropTarget = overContainerId === containerId && activeContainerId !== null && activeContainerId !== containerId
    return <>{children({ isDropTarget, pendingTransfer, activeComponent })}</>
}

export const ComponentListContent = ({
    metahubId: metahubIdProp,
    treeEntityId: hubIdProp,
    objectCollectionId: objectIdProp,
    sharedEntityMode = false,
    title,
    emptyTitle,
    emptyDescription,
    renderPageShell = true,
    showObjectTabs = true,
    showSettingsTab = true,
    allowSystemTab = true
}: ComponentListContentProps = {}) => {
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
        objectCollectionId,
        effectiveTreeEntityId,
        treeEntities,
        isSystemView,
        activeObjectTab,
        isDedicatedSystemRoute,
        requestedObjectTab,
        isObjectResolutionLoading,
        objectResolutionError,
        objectForHubResolution,
        isLoading,
        error,
        components,
        paginationResult,
        searchValue,
        handleSearchChange,
        codenameEntities,
        componentMap,
        platformSystemComponentsPolicy,
        limitValue,
        limitReached,
        childSearchMatchParentIds,
        includeShared
    } = useComponentListData({
        metahubId: metahubIdProp,
        treeEntityId: hubIdProp,
        objectCollectionId: objectIdProp,
        resolveObjectDetails: showSettingsTab,
        allowSystemView: showObjectTabs && allowSystemTab,
        includeSharedEntities: !sharedEntityMode
    })

    const { dialogs, openCreate, openDelete, openConflict, close } = useListDialogs<Component>()
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [expandedTableIds, setExpandedTableIds] = useState<Set<string>>(new Set())
    const updateObjectCollectionMutation = useUpdateObjectCollectionAtMetahub()

    const buildObjectTabPath = useCallback(
        (tab: Extract<ObjectTab, 'components' | 'system' | 'records'>) => {
            return buildObjectCollectionAuthoringPath({
                metahubId,
                treeEntityId: hubIdParam,
                kindKey,
                objectCollectionId,
                tab
            })
        },
        [objectCollectionId, hubIdParam, kindKey, metahubId]
    )

    useEffect(() => {
        if (!metahubId || !objectCollectionId) return
        if (requestedObjectTab !== 'system' || isDedicatedSystemRoute) return
        const nextPath = buildObjectTabPath('system')
        if (nextPath) {
            navigate(nextPath, { replace: true })
        }
    }, [buildObjectTabPath, objectCollectionId, isDedicatedSystemRoute, metahubId, navigate, requestedObjectTab])

    useEffect(() => {
        paginationResult.actions.goToPage(1)
        setExpandedTableIds(new Set())
    }, [activeObjectTab, objectCollectionId, paginationResult.actions])

    // Auto-expand TABLE parents that have matching child components during search
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

    const createComponentMutation = useCreateComponent()
    const copyComponentMutation = useCopyComponent()
    const updateComponentMutation = useUpdateComponent()
    const deleteComponentMutation = useDeleteComponent()
    const moveComponentMutation = useMoveComponent()
    const reorderMutation = useReorderComponent()
    const upsertSharedEntityOverrideMutation = useUpsertSharedEntityOverride()
    const toggleRequiredMutation = useToggleComponentRequired()
    const setDisplayComponentMutation = useSetDisplayComponent()
    const clearDisplayComponentMutation = useClearDisplayComponent()
    const pendingInteractionMessage = tc('pendingCreateBlocked', 'This item is still being created. Please wait a moment and try again.')

    // DnD cross-list permission settings
    const allowCrossListRootChildren = useSettingValue<boolean>('entity.object.allowComponentMoveBetweenRootAndChildren') ?? true
    const allowCrossListBetweenChildren = useSettingValue<boolean>('entity.object.allowComponentMoveBetweenChildLists') ?? true

    const systemComponentActions = useMemo<ActionDescriptor<ComponentDisplay, ComponentLocalizedPayload>[]>(
        () => [
            {
                id: 'disable-system-field',
                labelKey: 'components.actions.disableSystemField',
                icon: <RadioButtonUncheckedIcon fontSize='small' />,
                order: 10,
                visible: (ctx: ActionContext<ComponentDisplay, ComponentLocalizedPayload>) => {
                    const current = componentMap.get(ctx.entity.id)
                    const systemKey = current?.system?.systemKey ?? ctx.entity.system?.systemKey ?? null
                    const definition = systemKey ? getObjectSystemComponent(systemKey) : null
                    const isBlockedPlatformToggle = definition?.layer === 'upl' && !platformSystemComponentsPolicy.allowConfiguration
                    return (
                        (current?.system?.isEnabled ?? ctx.entity.system?.isEnabled ?? true) === true &&
                        definition?.canDisable !== false &&
                        !isBlockedPlatformToggle
                    )
                },
                onSelect: async (ctx: ActionContext<ComponentDisplay, ComponentLocalizedPayload>) => {
                    if (typeof ctx.toggleSystemEnabled === 'function') {
                        await ctx.toggleSystemEnabled(ctx.entity.id, false)
                    }
                }
            },
            {
                id: 'enable-system-field',
                labelKey: 'components.actions.enableSystemField',
                icon: <CheckCircleOutlineIcon fontSize='small' />,
                order: 11,
                visible: (ctx: ActionContext<ComponentDisplay, ComponentLocalizedPayload>) => {
                    const current = componentMap.get(ctx.entity.id)
                    const systemKey = current?.system?.systemKey ?? ctx.entity.system?.systemKey ?? null
                    const definition = systemKey ? getObjectSystemComponent(systemKey) : null
                    const isBlockedPlatformToggle = definition?.layer === 'upl' && !platformSystemComponentsPolicy.allowConfiguration
                    return (current?.system?.isEnabled ?? ctx.entity.system?.isEnabled ?? true) === false && !isBlockedPlatformToggle
                },
                onSelect: async (ctx: ActionContext<ComponentDisplay, ComponentLocalizedPayload>) => {
                    if (typeof ctx.toggleSystemEnabled === 'function') {
                        await ctx.toggleSystemEnabled(ctx.entity.id, true)
                    }
                }
            }
        ],
        [componentMap, platformSystemComponentsPolicy.allowConfiguration]
    )

    const handlePendingComponentInteraction = useCallback(
        (componentId: string) => {
            if (!metahubId || !objectCollectionId) return
            revealPendingEntityFeedback({
                queryClient,
                queryKeyPrefix: effectiveTreeEntityId
                    ? metahubsQueryKeys.components(metahubId, effectiveTreeEntityId, objectCollectionId)
                    : metahubsQueryKeys.componentsDirect(metahubId, objectCollectionId),
                entityId: componentId
            })
            enqueueSnackbar(pendingInteractionMessage, { variant: 'info' })
        },
        [objectCollectionId, effectiveTreeEntityId, enqueueSnackbar, metahubId, pendingInteractionMessage, queryClient]
    )

    // DnD: Handle reorder (same-list + cross-list transfer)
    const handleReorder = useCallback(
        async (
            componentId: string,
            newSortOrder: number,
            newParentComponentId?: string | null,
            currentParentComponentId?: string | null,
            mergedOrderIds?: string[]
        ) => {
            if (!metahubId || !objectCollectionId) return

            try {
                await reorderMutation.mutateAsync({
                    metahubId,
                    treeEntityId: effectiveTreeEntityId,
                    objectCollectionId,
                    componentId,
                    newSortOrder,
                    newParentComponentId,
                    currentParentComponentId,
                    mergedOrderIds
                })
                enqueueSnackbar(t('components.reorderSuccess', 'Component order updated'), { variant: 'success' })
            } catch (error: unknown) {
                // Handle CODENAME_CONFLICT (409) — offer auto-rename
                const responseData = extractResponseData(error)
                const responseCode = extractResponseCode(error)
                const responseStatus =
                    error && typeof error === 'object' && 'response' in error
                        ? (error as { response?: { status?: number } }).response?.status ?? 0
                        : 0

                if (responseStatus === 409 && responseCode === 'TABLE_CHILD_LIMIT_REACHED') {
                    const max = extractResponseMaxChildComponents(error)
                    enqueueSnackbar(
                        t('components.tableValidation.maxChildComponents', 'Maximum {{max}} child components per TABLE', {
                            max: max ?? '—'
                        }),
                        { variant: 'error' }
                    )
                    return
                }

                if (responseStatus === 409 && responseCode === 'CODENAME_CONFLICT') {
                    const conflictCodename = typeof responseData?.codename === 'string' ? responseData.codename : ''
                    const shouldAutoRename = await confirm({
                        title: t('components.dnd.codenameConflictTitle', 'Codename conflict'),
                        description: t(
                            'components.dnd.codenameConflictDescription',
                            'An component with codename "{{codename}}" already exists in the target list. Move with automatic codename rename?',
                            { codename: conflictCodename }
                        ),
                        confirmButtonName: t('components.dnd.confirmMove', 'Move'),
                        cancelButtonName: tc('actions.cancel', 'Cancel')
                    })
                    if (shouldAutoRename) {
                        try {
                            await reorderMutation.mutateAsync({
                                metahubId,
                                treeEntityId: effectiveTreeEntityId,
                                objectCollectionId,
                                componentId,
                                newSortOrder,
                                newParentComponentId,
                                autoRenameCodename: true,
                                currentParentComponentId,
                                mergedOrderIds
                            })
                            enqueueSnackbar(t('components.reorderSuccess', 'Component order updated'), { variant: 'success' })
                        } catch (retryError: unknown) {
                            if (extractResponseCode(retryError) === 'TABLE_CHILD_LIMIT_REACHED') {
                                const max = extractResponseMaxChildComponents(retryError)
                                enqueueSnackbar(
                                    t('components.tableValidation.maxChildComponents', 'Maximum {{max}} child components per TABLE', {
                                        max: max ?? '—'
                                    }),
                                    { variant: 'error' }
                                )
                                return
                            }
                            const msg =
                                retryError instanceof Error
                                    ? retryError.message
                                    : t('components.reorderError', 'Failed to reorder component')
                            enqueueSnackbar(msg, { variant: 'error' })
                        }
                    }
                    return
                }

                // Other errors — show generic snackbar
                const message = error instanceof Error ? error.message : t('components.reorderError', 'Failed to reorder component')
                enqueueSnackbar(message, { variant: 'error' })
            }
        },
        [metahubId, objectCollectionId, effectiveTreeEntityId, reorderMutation, confirm, enqueueSnackbar, t, tc]
    )

    const sortedComponents = useMemo(() => sortSharedEntityList(components ?? []), [components])

    const componentTableData = useMemo(
        () => sortedComponents.map((component) => toComponentDisplay(component, i18n.language)),
        [i18n.language, sortedComponents]
    )

    const hasSharedRows = useMemo(
        () => includeShared && componentTableData.some((row) => isSharedEntityRow(row)),
        [componentTableData, includeShared]
    )

    const firstLocalRowId = useMemo(() => {
        if (!hasSharedRows) return null
        return componentTableData.find((row) => !isSharedEntityRow(row))?.id ?? null
    }, [componentTableData, hasSharedRows])

    const getComponentRowSx = useCallback(
        (row: ComponentDisplay) => {
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

    const isComponentRowDragDisabled = useCallback(
        (row: ComponentDisplay) => hasSharedRows && isSharedEntityRow(row) && !isSharedEntityMovable(row),
        [hasSharedRows]
    )

    // DnD: Validate cross-list transfer before applying
    const handleValidateTransfer = useCallback(
        async (component: Component, targetParentId: string | null, targetContainerItemCount: number): Promise<boolean> => {
            // Display component cannot be moved between lists (root ↔ child)
            if (component.isDisplayComponent) {
                await confirm({
                    title: t('components.dnd.displayComponentBlockedTitle', 'Cannot move display component'),
                    description: t(
                        'components.dnd.displayComponentBlockedDescription',
                        'This component is the display component for its list. Assign another component as the display component first, then try again.'
                    ),
                    confirmButtonName: tc('ok', 'OK'),
                    hideCancelButton: true
                })
                return false
            }

            // TABLE components can only exist at root level
            if (component.dataType === 'TABLE' && targetParentId !== null) {
                await confirm({
                    title: t('components.dnd.tableCannotMoveTitle', 'Cannot move TABLE component'),
                    description: t('components.dnd.tableCannotMoveDescription', 'TABLE components can only exist at the root level.'),
                    confirmButtonName: tc('ok', 'OK'),
                    hideCancelButton: true
                })
                return false
            }

            // Child TABLE limit validation
            if (targetParentId !== null) {
                const targetParent = componentMap.get(targetParentId)
                const maxChildComponents =
                    typeof targetParent?.validationRules?.maxChildComponents === 'number' &&
                    targetParent.validationRules.maxChildComponents > 0
                        ? targetParent.validationRules.maxChildComponents
                        : null

                if (maxChildComponents !== null && targetContainerItemCount >= maxChildComponents) {
                    await confirm({
                        title: t('components.dnd.tableChildLimitTitle', 'Cannot move component'),
                        description: t('components.tableValidation.maxChildComponents', 'Maximum {{max}} child components per TABLE', {
                            max: maxChildComponents
                        }),
                        confirmButtonName: tc('ok', 'OK'),
                        hideCancelButton: true
                    })
                    return false
                }
            }

            // Moving to an empty child table — component will become display + required
            if (targetParentId !== null && targetContainerItemCount === 0) {
                const shouldMove = await confirm({
                    title: t('components.dnd.firstChildComponentTitle', 'First child component'),
                    description: t(
                        'components.dnd.firstChildComponentDescription',
                        'This will be the first component in the table. It will automatically become the display component and required. After that, it cannot be moved out until another component is set as the display component.'
                    ),
                    confirmButtonName: t('components.dnd.confirmMove', 'Move'),
                    cancelButtonName: tc('actions.cancel', 'Cancel')
                })
                if (!shouldMove) return false
            }

            return true
        },
        [componentMap, confirm, t, tc]
    )

    const localizedFormDefaults = useMemo<ComponentFormValues>(() => {
        const shouldForceDefaults = shouldForceFirstComponentDefaults(components?.length ?? 0, sharedEntityMode)
        return {
            nameVlc: null,
            codename: null,
            codenameTouched: false,
            dataType: 'STRING',
            isRequired: shouldForceDefaults,
            isDisplayComponent: shouldForceDefaults,
            targetEntityId: null,
            targetEntityKind: null,
            targetConstantId: null,
            validationRules: {
                ...getDefaultValidationRules('STRING'),
                maxLength: 10
            },
            uiConfig: {}
        }
    }, [components?.length, sharedEntityMode])

    const validateComponentForm = useCallback(
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
                errors.codename = t('components.validation.codenameRequired', 'Codename is required')
            } else if (
                !isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            ) {
                errors.codename = t('components.validation.codenameInvalid', 'Codename contains invalid characters')
            }
            // REF type requires target entity
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
                if (values.targetEntityKind === 'set' && !values.targetConstantId) {
                    errors.targetConstantId = t(
                        'components.validation.targetConstantIdRequired',
                        'Target constant is required for references to Set'
                    )
                }
            }
            if (values.dataType === 'REF' && values.targetEntityKind !== 'set' && values.targetConstantId) {
                errors.targetConstantId = t(
                    'components.validation.targetConstantOnlyForSet',
                    'Target constant can be selected only for references to Set'
                )
            }
            return Object.keys(errors).length > 0 ? errors : null
        },
        [codenameConfig.allowMixed, codenameConfig.alphabet, codenameConfig.style, t, tc]
    )

    const canSaveComponentForm = useCallback(
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
            const displayComponentLocked = shouldForceFirstComponentDefaults(components?.length ?? 0, sharedEntityMode)
            const tabs: TabConfig[] = [
                {
                    id: 'general',
                    label: t('components.tabs.general', 'General'),
                    content: (
                        <ComponentFormFields
                            values={values}
                            setValue={setValue}
                            isLoading={isLoading}
                            errors={fieldErrors}
                            uiLocale={i18n.language}
                            nameLabel={tc('fields.name', 'Name')}
                            codenameLabel={t('components.codename', 'Codename')}
                            codenameHelper={t('components.codenameHelper', 'Unique identifier')}
                            dataTypeLabel={t('components.dataType', 'Data Type')}
                            requiredLabel={t('components.isRequiredLabel', 'Required')}
                            displayComponentLabel={t('components.isDisplayComponentLabel', 'Display component')}
                            displayComponentHelper={t(
                                'components.isDisplayComponentHelper',
                                'Use as representation when referencing records of this object'
                            )}
                            displayComponentLocked={displayComponentLocked}
                            dataTypeOptions={[
                                { value: 'STRING', label: t('components.dataTypeOptions.string', 'String') },
                                { value: 'NUMBER', label: t('components.dataTypeOptions.number', 'Number') },
                                { value: 'BOOLEAN', label: t('components.dataTypeOptions.boolean', 'Boolean') },
                                { value: 'DATE', label: t('components.dataTypeOptions.date', 'Date') },
                                { value: 'REF', label: t('components.dataTypeOptions.ref', 'Reference') },
                                { value: 'JSON', label: t('components.dataTypeOptions.json', 'JSON') },
                                { value: 'TABLE', label: t('components.dataTypeOptions.table', 'Table') }
                            ]}
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
                            metahubId={metahubId!}
                            currentObjectCollectionId={objectCollectionId}
                            hideDisplayComponent
                        />
                    )
                },
                {
                    id: 'presentation',
                    label: t('components.tabs.presentation', 'Presentation'),
                    content: (
                        <Stack spacing={2}>
                            <PresentationTabFields
                                values={values}
                                setValue={setValue}
                                isLoading={isLoading}
                                metahubId={metahubId}
                                displayComponentLabel={t('components.isDisplayComponentLabel', 'Display component')}
                                displayComponentHelper={t(
                                    'components.isDisplayComponentHelper',
                                    'Use as representation when referencing records of this object'
                                )}
                                displayComponentLocked={displayComponentLocked}
                                forceDisplayComponentWhenLocked={displayComponentLocked}
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
                            {sharedEntityMode ? (
                                <SharedEntitySettingsFields
                                    metahubId={metahubId}
                                    entityKind='component'
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
                            entityKind='component'
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
        [components?.length, objectCollectionId, i18n.language, metahubId, sharedEntityMode, t, tc]
    )

    const componentColumns = useMemo(() => {
        const columns = [
            {
                id: 'sortOrder',
                label: t('components.table.order', '#'),
                width: '3%',
                align: 'center' as const,
                sortable: true,
                sortAccessor: (row: ComponentDisplay) => row.sortOrder ?? 0,
                render: (_row: ComponentDisplay, index: number) => (
                    <Typography sx={{ fontSize: 13, fontWeight: 600, textAlign: 'center' }}>{index + 1}</Typography>
                )
            },
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: isSystemView ? '30%' : '35%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: ComponentDisplay) => row.name || '',
                render: (row: ComponentDisplay) => {
                    const rawComponent = componentMap.get(row.id)
                    const isDisplayAttr = rawComponent?.isDisplayComponent ?? row.isDisplayComponent ?? false
                    const systemMetadata = rawComponent?.system ?? row.system ?? null
                    return (
                        <Stack spacing={0.5}>
                            <Stack direction='row' spacing={0.5} alignItems='center' flexWrap='wrap' useFlexGap>
                                {isDisplayAttr && (
                                    <Tooltip
                                        title={t(
                                            'components.isDisplayComponentTooltip',
                                            'This component is the display representation for this object'
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
                                    {t('components.system.keyLabel', 'System key')}: {systemMetadata.systemKey}
                                </Typography>
                            )}
                        </Stack>
                    )
                }
            },
            {
                id: 'codename',
                label: t('components.codename', 'Codename'),
                width: isSystemView ? '18%' : '20%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: ComponentDisplay) => row.codename || '',
                render: (row: ComponentDisplay) => (
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
                label: t('components.dataType', 'Type'),
                width: isSystemView ? '24%' : '17%',
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
                label: t('components.system.status', 'Status'),
                width: '12%',
                align: 'center' as const,
                render: (row: ComponentDisplay) => {
                    const rawComponent = componentMap.get(row.id)
                    const isEnabled = rawComponent?.system?.isEnabled ?? row.system?.isEnabled ?? true
                    return (
                        <Chip
                            label={isEnabled ? t('components.system.enabled', 'Enabled') : t('components.system.disabled', 'Disabled')}
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
                label: t('components.required', 'Required'),
                width: '15%',
                align: 'center' as const,
                render: (row: ComponentDisplay) => (
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
    }, [componentMap, includeShared, isSystemView, t, tc])

    const createComponentContext = useCallback(
        (baseContext: ActionContext<ComponentDisplay, ComponentLocalizedPayload>) => ({
            ...baseContext,
            componentMap,
            uiLocale: i18n.language,
            metahubId,
            objectCollectionId,
            sharedEntityMode,
            api: {
                updateEntity: (id: string, patch: ComponentLocalizedPayload) => {
                    if (!metahubId || !objectCollectionId) return Promise.resolve()
                    const sharedExcludedTargetIds = readSharedExcludedTargetIdsField(patch)
                    const { [SHARED_EXCLUDED_TARGET_IDS_FIELD]: _ignored, ...payloadWithoutSharedExclusions } =
                        patch as ComponentLocalizedPayload & Record<string, unknown>
                    const rawCodename = getVLCString(patch.codename, patch.codename?._primary ?? 'en')
                    const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
                    if (!normalizedCodename) {
                        throw new Error(t('components.validation.codenameRequired', 'Codename is required'))
                    }
                    if (
                        !isValidCodenameForStyle(
                            normalizedCodename,
                            codenameConfig.style,
                            codenameConfig.alphabet,
                            codenameConfig.allowMixed
                        )
                    ) {
                        throw new Error(t('components.validation.codenameInvalid', 'Codename contains invalid characters'))
                    }
                    const dataType = patch.dataType ?? 'STRING'
                    const codenamePayload = ensureLocalizedContent(patch.codename, patch.codename?._primary ?? 'en', normalizedCodename)
                    const component = componentMap.get(id)
                    const expectedVersion = component?.version

                    return updateComponentMutation
                        .mutateAsync({
                            metahubId,
                            treeEntityId: effectiveTreeEntityId,
                            objectCollectionId,
                            componentId: id,
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
                                    entityKind: 'component',
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
                    if (!metahubId || !objectCollectionId) return
                    return deleteComponentMutation.mutateAsync({
                        metahubId,
                        treeEntityId: effectiveTreeEntityId, // Optional - undefined for hub-less objectCollections
                        objectCollectionId,
                        componentId: id
                    })
                },
                copyEntity: (id: string, payload: ComponentLocalizedPayload & Record<string, unknown>) => {
                    if (!metahubId || !objectCollectionId) return Promise.resolve()
                    copyComponentMutation.mutate({
                        metahubId,
                        treeEntityId: effectiveTreeEntityId,
                        objectCollectionId,
                        componentId: id,
                        data: payload
                    })

                    return Promise.resolve()
                }
            },
            moveComponent: async (id: string, direction: 'up' | 'down') => {
                if (!metahubId || !objectCollectionId) return
                await moveComponentMutation.mutateAsync({
                    metahubId,
                    treeEntityId: effectiveTreeEntityId, // Optional - undefined for hub-less objectCollections
                    objectCollectionId,
                    componentId: id,
                    direction
                })
                // Invalidate queries - effectiveTreeEntityId is optional for direct queries
                if (effectiveTreeEntityId) {
                    await invalidateComponentsQueries.all(queryClient, metahubId, effectiveTreeEntityId, objectCollectionId)
                } else {
                    // Invalidate direct queries for hub-less objectCollections
                    queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.componentsDirect(metahubId, objectCollectionId) })
                }
            },
            toggleRequired: async (id: string, isRequired: boolean) => {
                if (!metahubId || !objectCollectionId) return
                await toggleRequiredMutation.mutateAsync({
                    metahubId,
                    treeEntityId: effectiveTreeEntityId,
                    objectCollectionId,
                    componentId: id,
                    isRequired
                })
                if (effectiveTreeEntityId) {
                    await invalidateComponentsQueries.all(queryClient, metahubId, effectiveTreeEntityId, objectCollectionId)
                } else {
                    queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.componentsDirect(metahubId, objectCollectionId) })
                }
            },
            toggleDisplayComponent: async (id: string, isDisplayComponent: boolean) => {
                if (!metahubId || !objectCollectionId) return
                if (isDisplayComponent) {
                    await setDisplayComponentMutation.mutateAsync({
                        metahubId,
                        treeEntityId: effectiveTreeEntityId,
                        objectCollectionId,
                        componentId: id
                    })
                } else {
                    await clearDisplayComponentMutation.mutateAsync({
                        metahubId,
                        treeEntityId: effectiveTreeEntityId,
                        objectCollectionId,
                        componentId: id
                    })
                }
                if (effectiveTreeEntityId) {
                    await invalidateComponentsQueries.all(queryClient, metahubId, effectiveTreeEntityId, objectCollectionId)
                } else {
                    queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.componentsDirect(metahubId, objectCollectionId) })
                }
            },
            toggleSystemEnabled: async (id: string, isEnabled: boolean) => {
                if (!metahubId || !objectCollectionId) return
                const component = componentMap.get(id)
                await updateComponentMutation.mutateAsync({
                    metahubId,
                    treeEntityId: effectiveTreeEntityId,
                    objectCollectionId,
                    componentId: id,
                    data: {
                        isEnabled,
                        expectedVersion: component?.version
                    }
                })
            },
            helpers: {
                refreshList: () => {
                    if (metahubId && objectCollectionId) {
                        // Always invalidate global codenames cache (for global scope duplicate checking)
                        invalidateComponentsQueries.allCodenames(queryClient, metahubId, objectCollectionId)
                        if (effectiveTreeEntityId) {
                            void invalidateComponentsQueries.all(queryClient, metahubId, effectiveTreeEntityId, objectCollectionId)
                        } else {
                            // Invalidate direct queries for hub-less objectCollections
                            void queryClient.invalidateQueries({
                                queryKey: metahubsQueryKeys.componentsDirect(metahubId, objectCollectionId)
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
                openDeleteDialog: (component: Component) => {
                    const actualComponent = componentMap.get(component.id) ?? component
                    if (actualComponent?.isDisplayComponent) {
                        enqueueSnackbar(
                            t(
                                'components.deleteDisplayComponentBlocked',
                                'Display component cannot be deleted. Set another component as display first.'
                            ),
                            { variant: 'warning' }
                        )
                        return
                    }
                    openDelete(component)
                }
            }
        }),
        [
            componentMap,
            objectCollectionId,
            clearDisplayComponentMutation,
            codenameConfig.allowMixed,
            codenameConfig.alphabet,
            codenameConfig.style,
            copyComponentMutation,
            confirm,
            deleteComponentMutation,
            enqueueSnackbar,
            effectiveTreeEntityId,
            i18n.language,
            metahubId,
            moveComponentMutation,
            openConflict,
            openDelete,
            queryClient,
            setDisplayComponentMutation,
            sharedEntityMode,
            t,
            toggleRequiredMutation,
            updateComponentMutation
        ]
    )

    // Validate metahubId and objectCollectionId from URL AFTER all hooks
    if (!metahubId || !objectCollectionId) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Invalid object'
                title={t('errors.noTreeEntityId', 'No hub ID provided')}
                description={t('errors.pleaseSelectHub', 'Please select a hub')}
            />
        )
    }

    // Show loading while resolving object (only when no treeEntityId in URL)
    if (showSettingsTab && !hubIdParam && isObjectResolutionLoading) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Loading'
                title={tc('loading', 'Loading')}
                description={t('common:loading', 'Loading...')}
            />
        )
    }

    // Show error if object resolution failed
    if (showSettingsTab && !hubIdParam && objectResolutionError) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Error loading object'
                title={t('errors.loadingError', 'Error loading object')}
                description={objectResolutionError instanceof Error ? objectResolutionError.message : String(objectResolutionError || '')}
            />
        )
    }

    const handleAddNew = () => {
        openCreate()
    }

    const handleDialogClose = () => {
        close('create')
    }

    const handleObjectTabChange = (_event: unknown, nextTab: ObjectTab) => {
        if (!metahubId || !objectCollectionId) return
        if (!showObjectTabs) return
        if (nextTab === 'settings') {
            setEditDialogOpen(true)
            return
        }
        if (nextTab === 'components' || nextTab === 'system') {
            navigate(buildObjectTabPath(nextTab))
            return
        }
        navigate(buildObjectTabPath('records'))
    }

    const handleCreateComponent = (data: GenericFormValues) => {
        // Validation is handled by EntityFormDialog's validate/canSave props.
        const nameVlc = data.nameVlc as VersionedLocalizedContent<string> | null | undefined
        const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
        const codenameValue = data.codename as VersionedLocalizedContent<string> | null | undefined
        const rawCodename = getVLCString(codenameValue || undefined, codenameValue?._primary ?? namePrimaryLocale ?? 'en')
        const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
        const codenamePayload = ensureLocalizedContent(codenameValue, namePrimaryLocale ?? 'en', normalizedCodename || '')

        const dataType = (data.dataType as ComponentDefinitionDataType | undefined) ?? 'STRING'
        const isRequired = Boolean(data.isRequired)
        const validationRules = data.validationRules as ComponentDefinitionValidationRules | undefined
        const isDisplayComponent = Boolean(data.isDisplayComponent)
        const uiConfig = (data.uiConfig as Record<string, unknown>) ?? {}

        // REF type: extract target entity info
        const targetEntityId = dataType === 'REF' ? (data.targetEntityId as string | null) : undefined
        const targetEntityKind = dataType === 'REF' ? (data.targetEntityKind as EntityKind | null) : undefined
        const targetConstantId =
            dataType === 'REF' && targetEntityKind === 'set' ? (data.targetConstantId as string | null) ?? null : undefined
        const normalizedUiConfig = sanitizeComponentUiConfig(dataType, targetEntityKind, uiConfig)

        // Fire-and-forget: optimistic card via onMutate, errors via onError snackbar,
        // cache invalidation via onSettled. Dialog closes immediately.
        createComponentMutation.mutate({
            metahubId,
            treeEntityId: effectiveTreeEntityId,
            objectCollectionId,
            data: {
                codename: codenamePayload,
                dataType,
                isRequired,
                name: nameInput ?? {},
                namePrimaryLocale: namePrimaryLocale ?? '',
                validationRules,
                isDisplayComponent,
                targetEntityId,
                targetEntityKind,
                targetConstantId,
                uiConfig: normalizedUiConfig
            }
        })
    }

    const renderComponentActions = (row: ComponentDisplay) => {
        const originalComponent = componentMap.get(row.id)
        if (!originalComponent) return null

        const isMergedSharedRow = includeShared && isSharedEntityRow(row)
        const isSharedRowActive = isSharedEntityActive(row)

        const handleSharedRowOverride = async (patch: { isExcluded?: boolean; isActive?: boolean | null }, successMessage: string) => {
            if (!metahubId || !objectCollectionId) return

            try {
                await upsertSharedEntityOverrideMutation.mutateAsync({
                    metahubId,
                    data: {
                        entityKind: 'component',
                        sharedEntityId: row.id,
                        targetObjectId: objectCollectionId,
                        ...patch
                    }
                })

                if (effectiveTreeEntityId) {
                    await invalidateComponentsQueries.all(queryClient, metahubId, effectiveTreeEntityId, objectCollectionId)
                } else {
                    await queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.componentsDirect(metahubId, objectCollectionId)
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

        const displayEntity = toComponentDisplay(originalComponent, i18n.language)
        const descriptors: ActionDescriptor<ComponentDisplay, ComponentLocalizedPayload>[] = isSystemView
            ? systemComponentActions
            : includeShared
            ? componentActions.filter((descriptor) => descriptor.id !== 'move-up' && descriptor.id !== 'move-down')
            : [...componentActions]
        const actionContext = createComponentContext({
            entity: displayEntity,
            entityKind: 'component',
            t
        })
        const visibleDescriptors = descriptors.filter(
            (descriptor) =>
                (!descriptor.entityKinds || descriptor.entityKinds.includes('component')) &&
                (!descriptor.visible || descriptor.visible(actionContext))
        )
        const sharedRowDescriptors: ActionDescriptor<ComponentDisplay, ComponentLocalizedPayload>[] = []

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
                    <BaseEntityMenu<ComponentDisplay, ComponentLocalizedPayload>
                        entity={displayEntity}
                        entityKind='component'
                        descriptors={menuDescriptors}
                        namespace='metahubs'
                        menuButtonLabelKey='flowList:menu.button'
                        i18nInstance={i18n}
                        createContext={createComponentContext}
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
                        searchPlaceholder={t('components.searchPlaceholder')}
                        onSearchChange={handleSearchChange}
                        controlsAlign={renderPageShell ? 'start' : 'end'}
                        title={
                            title !== undefined
                                ? title
                                : isSystemView
                                ? t('components.system.title', 'System Components')
                                : t('components.title')
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

                    {showObjectTabs ? (
                        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                            <Tabs
                                value={activeObjectTab}
                                onChange={handleObjectTabChange}
                                aria-label={t('objects.title', 'Objects')}
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
                                <Tab value='components' label={t('components.title')} />
                                {allowSystemTab ? <Tab value='system' label={t('components.tabs.system', 'System')} /> : null}
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
                                'components.system.hint',
                                'System components are provided by the platform. You can only enable or disable supported components.'
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
                            {t('components.limitReached', { limit: limitValue })}
                        </Alert>
                    ) : null}

                    {isLoading && components.length === 0 ? (
                        <Skeleton variant='rectangular' height={120} />
                    ) : !isLoading && components.length === 0 ? (
                        <EmptyListState
                            image={APIEmptySVG}
                            imageAlt='No components'
                            title={
                                emptyTitle ?? (isSystemView ? t('components.system.empty', 'No system components') : t('components.empty'))
                            }
                            description={
                                emptyDescription ??
                                (isSystemView
                                    ? t('components.system.emptyDescription', 'This object has no configurable system components.')
                                    : t('components.emptyDescription'))
                            }
                        />
                    ) : (
                        <Box sx={{ mx: contentOffsetSx }}>
                            {isSystemView ? (
                                <FlowListTable<ComponentDisplay>
                                    data={componentTableData}
                                    customColumns={componentColumns}
                                    sortStateId='object-system-components'
                                    initialOrder='asc'
                                    initialOrderBy='sortOrder'
                                    onPendingInteractionAttempt={(row: ComponentDisplay) => handlePendingComponentInteraction(row.id)}
                                    renderActions={renderComponentActions}
                                />
                            ) : (
                                <ComponentDndProvider
                                    rootItems={sortedComponents}
                                    allowCrossListRootChildren={allowCrossListRootChildren}
                                    allowCrossListBetweenChildren={allowCrossListBetweenChildren}
                                    onReorder={handleReorder}
                                    onValidateTransfer={handleValidateTransfer}
                                    uiLocale={i18n.language}
                                >
                                    <DndDropTarget containerId='root'>
                                        {({ isDropTarget, pendingTransfer: pt, activeComponent: activeAttr }) => {
                                            const baseData = componentTableData
                                            const baseIds = sortedComponents.map((component) => component.id)
                                            let effectiveData = baseData
                                            let effectiveIds = baseIds

                                            if (pt) {
                                                if (pt.fromContainerId === 'root') {
                                                    effectiveData = baseData.filter((d) => d.id !== pt.itemId)
                                                    effectiveIds = baseIds.filter((id) => id !== pt.itemId)
                                                } else if (pt.toContainerId === 'root' && activeAttr) {
                                                    const ghost = toComponentDisplay(activeAttr, i18n.language)
                                                    const insertAt = Math.min(pt.insertIndex, baseData.length)
                                                    effectiveData = [...baseData.slice(0, insertAt), ghost, ...baseData.slice(insertAt)]
                                                    effectiveIds = [...baseIds.slice(0, insertAt), pt.itemId, ...baseIds.slice(insertAt)]
                                                }
                                            }

                                            return (
                                                <FlowListTable<ComponentDisplay>
                                                    data={effectiveData}
                                                    customColumns={componentColumns}
                                                    onPendingInteractionAttempt={(row: ComponentDisplay) =>
                                                        handlePendingComponentInteraction(row.id)
                                                    }
                                                    sortableRows
                                                    externalDndContext
                                                    droppableContainerId='root'
                                                    sortableItemIds={effectiveIds}
                                                    dragHandleAriaLabel={t('components.dnd.dragHandle', 'Drag to reorder')}
                                                    isDropTarget={isDropTarget}
                                                    getRowSx={getComponentRowSx}
                                                    isRowDragDisabled={isComponentRowDragDisabled}
                                                    renderActions={renderComponentActions}
                                                    renderRowExpansion={(row: ComponentDisplay) => {
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
                                                                <NestedComponentList
                                                                    metahubId={metahubId!}
                                                                    treeEntityId={effectiveTreeEntityId}
                                                                    objectCollectionId={objectCollectionId!}
                                                                    parentComponentId={row.id}
                                                                    parentMaxChildComponents={
                                                                        row.validationRules?.maxChildComponents > 0 &&
                                                                        typeof row.validationRules.maxChildComponents === 'number'
                                                                            ? row.validationRules.maxChildComponents
                                                                            : null
                                                                    }
                                                                    searchFilter={
                                                                        childSearchMatchParentIds.includes(row.id) ? searchValue : undefined
                                                                    }
                                                                    onRefresh={async () => {
                                                                        if (metahubId && objectCollectionId) {
                                                                            invalidateComponentsQueries.allCodenames(
                                                                                queryClient,
                                                                                metahubId,
                                                                                objectCollectionId
                                                                            )
                                                                        }
                                                                        if (effectiveTreeEntityId) {
                                                                            await invalidateComponentsQueries.all(
                                                                                queryClient,
                                                                                metahubId!,
                                                                                effectiveTreeEntityId,
                                                                                objectCollectionId!
                                                                            )
                                                                        } else {
                                                                            queryClient.invalidateQueries({
                                                                                queryKey: metahubsQueryKeys.componentsDirect(
                                                                                    metahubId!,
                                                                                    objectCollectionId!
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
                                </ComponentDndProvider>
                            )}
                        </Box>
                    )}

                    {!isLoading && components.length > 0 ? (
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
                title={t('components.createDialog.title', 'Create Component')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={tc('actions.create', 'Create')}
                savingButtonText={tc('actions.creating', 'Creating...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onClose={handleDialogClose}
                onSave={handleCreateComponent}
                hideDefaultFields
                initialExtraValues={localizedFormDefaults}
                tabs={renderTabs}
                validate={validateComponentForm}
                canSave={canSaveComponentForm}
            />

            <ConfirmDeleteDialog
                open={dialogs.delete.open}
                title={t('components.deleteDialog.title')}
                description={t('components.deleteDialog.message')}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => close('delete')}
                onConfirm={() => {
                    if (!dialogs.delete.item) return
                    const actualComponent = componentMap.get(dialogs.delete.item.id) ?? dialogs.delete.item
                    if (actualComponent?.isDisplayComponent) {
                        enqueueSnackbar(
                            t(
                                'components.deleteDisplayComponentBlocked',
                                'Display component cannot be deleted. Set another component as display first.'
                            ),
                            { variant: 'warning' }
                        )
                        close('delete')
                        return
                    }

                    deleteComponentMutation.mutate(
                        {
                            metahubId,
                            treeEntityId: effectiveTreeEntityId,
                            objectCollectionId,
                            componentId: dialogs.delete.item.id
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
                                        : t('components.deleteError')
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
                    if (metahubId && objectCollectionId) {
                        invalidateComponentsQueries.allCodenames(queryClient, metahubId, objectCollectionId)
                        if (effectiveTreeEntityId) {
                            invalidateComponentsQueries.all(queryClient, metahubId, effectiveTreeEntityId, objectCollectionId)
                        } else {
                            queryClient.invalidateQueries({
                                queryKey: metahubsQueryKeys.componentsDirect(metahubId, objectCollectionId)
                            })
                        }
                    }
                }}
                onOverwrite={async () => {
                    const pendingUpdate = (dialogs.conflict.data as { pendingUpdate?: { id: string; patch: ComponentLocalizedPayload } })
                        ?.pendingUpdate
                    if (pendingUpdate && metahubId && objectCollectionId) {
                        const { id, patch } = pendingUpdate
                        await updateComponentMutation.mutateAsync({
                            metahubId,
                            treeEntityId: effectiveTreeEntityId,
                            objectCollectionId,
                            componentId: id,
                            data: patch
                        })
                        close('conflict')
                    }
                }}
                isLoading={updateComponentMutation.isPending}
            />

            {showSettingsTab &&
                objectForHubResolution &&
                objectCollectionId &&
                (() => {
                    const objectDisplay: ObjectCollectionDisplayWithContainer = {
                        id: objectForHubResolution.id,
                        metahubId: objectForHubResolution.metahubId,
                        codename: objectForHubResolution.codename,
                        name: getVLCString(objectForHubResolution.name, preferredVlcLocale) || objectForHubResolution.codename,
                        description: getVLCString(objectForHubResolution.description, preferredVlcLocale) || '',
                        isSingleHub: objectForHubResolution.isSingleHub,
                        isRequiredHub: objectForHubResolution.isRequiredHub,
                        sortOrder: objectForHubResolution.sortOrder,
                        createdAt: objectForHubResolution.createdAt,
                        updatedAt: objectForHubResolution.updatedAt,
                        treeEntityId: effectiveTreeEntityId || undefined,
                        treeEntities: objectForHubResolution.treeEntities?.map((h) => ({
                            id: h.id,
                            name: typeof h.name === 'string' ? h.name : h.codename || '',
                            codename: h.codename || ''
                        }))
                    }
                    const objectMap = new Map<string, ObjectCollectionEntity>([[objectForHubResolution.id, objectForHubResolution]])
                    const settingsCtx = {
                        entity: objectDisplay,
                        entityKind: 'object' as const,
                        t,
                        objectMap,
                        metahubId,
                        currentTreeEntityId: effectiveTreeEntityId || null,
                        uiLocale: preferredVlcLocale,
                        api: {
                            updateEntity: (id: string, patch: ObjectCollectionLocalizedPayload) => {
                                if (!metahubId) return
                                updateObjectCollectionMutation.mutate({
                                    metahubId,
                                    objectCollectionId: id,
                                    data: { ...patch, expectedVersion: objectForHubResolution.version }
                                })
                            }
                        },
                        helpers: {
                            refreshList: () => {
                                if (metahubId && objectCollectionId) {
                                    void queryClient.invalidateQueries({
                                        queryKey: metahubsQueryKeys.objectCollectionDetail(metahubId, objectCollectionId)
                                    })
                                    void queryClient.invalidateQueries({
                                        queryKey: metahubsQueryKeys.allObjectCollections(metahubId)
                                    })
                                    void queryClient.invalidateQueries({
                                        queryKey: ['breadcrumb', 'object-standalone', metahubId, objectCollectionId]
                                    })
                                    void queryClient.invalidateQueries({
                                        queryKey: ['breadcrumb', 'object', metahubId]
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
                            title={t('objects.editTitle', 'Edit Object')}
                            nameLabel={tc('fields.name', 'Name')}
                            descriptionLabel={tc('fields.description', 'Description')}
                            saveButtonText={tc('actions.save', 'Save')}
                            savingButtonText={tc('actions.saving', 'Saving...')}
                            cancelButtonText={tc('actions.cancel', 'Cancel')}
                            hideDefaultFields
                            initialExtraValues={buildObjectInitialValues(settingsCtx)}
                            tabs={buildObjectCollectionFormTabs(settingsCtx, treeEntities, objectCollectionId)}
                            validate={(values) => validateObjectCollectionForm(settingsCtx, values)}
                            canSave={canSaveObjectCollectionForm}
                            onSave={(data) => {
                                const payload = objectToPayload(data)
                                settingsCtx.api.updateEntity(objectForHubResolution.id, payload)
                            }}
                            onClose={() => setEditDialogOpen(false)}
                        />
                    )
                })()}
        </>
    )

    return (
        <ComponentDndContainerRegistryProvider>
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
        </ComponentDndContainerRegistryProvider>
    )
}

const ComponentList = () => <ComponentListContent />

export default ComponentList
