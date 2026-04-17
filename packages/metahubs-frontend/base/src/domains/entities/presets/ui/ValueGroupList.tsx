import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate, Link, useParams } from 'react-router-dom'
import { Box, ButtonBase, Chip, Skeleton, Stack, Tab, Tabs, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useSnackbar } from 'notistack'
import { useQueryClient } from '@tanstack/react-query'

// project imports
import {
    TemplateMainCard as MainCard,
    ItemCard,
    ToolbarControls,
    EmptyListState,
    SkeletonGrid,
    APIEmptySVG,
    PaginationControls,
    FlowListTable,
    gridSpacing,
    EntitySelectionPanel,
    revealPendingEntityFeedback
} from '@universo/template-mui'
import type { DragEndEvent, EntitySelectionLabels } from '@universo/template-mui'
import { EntityFormDialog, ConfirmDeleteDialog, ConflictResolutionDialog } from '@universo/template-mui/components/dialogs'
import type { TabConfig } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'

import {
    useCreateValueGroup,
    useCreateValueGroupAtMetahub,
    useUpdateValueGroup,
    useUpdateValueGroupAtMetahub,
    useDeleteValueGroup,
    useCopyValueGroup,
    useReorderValueGroup
} from '../hooks/valueGroupMutations'
import { useValueGroupListData } from '../hooks/useValueGroupListData'
import { useStandardEntityListState, createEntityCopyCallback } from '../hooks/useStandardEntityListState'
import { STORAGE_KEYS } from '../../../../view-preferences/storage'
import * as setsApi from '../api/valueGroups'
import type { ValueGroupWithContainers } from '../api/valueGroups'
import { invalidateValueGroupsQueries, metahubsQueryKeys } from '../../../shared'
import type { VersionedLocalizedContent } from '@universo/types'
import { isOptimisticLockConflict, extractConflictInfo, isPendingEntity, getPendingAction, type ConflictInfo } from '@universo/utils'
import { ValueGroupLocalizedPayload, getVLCString } from '../../../../types'
import { normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../../utils/codename'
import { ensureLocalizedContent, extractLocalizedInput, hasPrimaryContent } from '../../../../utils/localizedInput'
import { useCodenameConfig } from '../../../settings/hooks/useCodenameConfig'
import { useMetahubPrimaryLocale } from '../../../settings/hooks/useMetahubPrimaryLocale'
import { ValueGroupDeleteDialog, ContainerSelectionPanel, ExistingCodenamesProvider } from '../../../../components'
import valueGroupActions, { ValueGroupDisplayWithContainer } from './ValueGroupActions'
import GeneralTabFields from '../../../shared/ui/GeneralTabFields'
import {
    DIALOG_SAVE_CANCEL,
    extractResponseStatus,
    extractResponseMessage,
    toValueGroupWithContainersDisplay,
    type ValueGroupWithContainersDisplay,
    type ValueGroupFormValues,
    type ValueGroupMenuBaseContext,
    type ConfirmSpec
} from './valueGroupListUtils'
import {
    buildTreeEntityAuthoringPath,
    buildValueGroupAuthoringPath,
    resolveEntityChildKindKey
} from '../../../shared/entityMetadataRoutePaths'

export const ValueGroupListContent = () => {
    const navigate = useNavigate()
    const { kindKey: routeKindKey } = useParams<{ kindKey?: string }>()
    const codenameConfig = useCodenameConfig()
    const preferredVlcLocale = useMetahubPrimaryLocale()
    const { t, i18n } = useTranslation('metahubs')
    const { t: tc } = useCommonTranslations()
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()

    const {
        metahubId,
        treeEntityId,
        isHubScoped,
        treeEntities,
        isLoading,
        error,
        paginationResult,
        searchValue,
        handleSearchChange,
        sortedValueGroups,
        images,
        setMap,
        allValueGroupsById,
        existingSetCodenames,
        attachableExistingValueGroups,
        entityKindKey,
        allowCopy,
        allowDelete,
        allowAttachExistingEntities
    } = useValueGroupListData()
    const kindKey = entityKindKey
    const buildSetPath = useCallback(
        (valueGroupId: string) =>
            buildValueGroupAuthoringPath({
                metahubId,
                valueGroupId,
                treeEntityId: isHubScoped ? treeEntityId : null,
                kindKey: routeKindKey
            }),
        [treeEntityId, isHubScoped, metahubId, routeKindKey]
    )
    const buildHubPath = useCallback(
        (tab: 'treeEntities' | 'linkedCollections' | 'valueGroups' | 'optionLists') =>
            buildTreeEntityAuthoringPath({
                metahubId,
                treeEntityId,
                kindKey: routeKindKey,
                tab
            }),
        [treeEntityId, metahubId, routeKindKey]
    )
    const buildAssociatedHubSetPath = useCallback(
        (nextTreeEntityId: string) =>
            buildTreeEntityAuthoringPath({
                metahubId,
                treeEntityId: nextTreeEntityId,
                kindKey: resolveEntityChildKindKey({ routeKindKey, childObjectKind: 'hub' }),
                tab: 'valueGroups'
            }),
        [metahubId, routeKindKey]
    )

    const {
        dialogs,
        openCreate,
        openDelete,
        openConflict,
        close,
        view,
        setView,
        confirm,
        blockingDeleteDialogState,
        openBlockingDelete,
        closeBlockingDelete
    } = useStandardEntityListState<ValueGroupWithContainers>(
        isHubScoped ? STORAGE_KEYS.VALUE_GROUP_DISPLAY_STYLE : STORAGE_KEYS.ALL_VALUE_GROUPS_DISPLAY_STYLE
    )

    const [isAttachDialogOpen, setAttachDialogOpen] = useState(false)
    const [isAttachingExisting, setAttachingExisting] = useState(false)
    const [attachDialogError, setAttachDialogError] = useState<string | null>(null)
    const [pendingSetNavigation, setPendingSetNavigation] = useState<{ pendingId: string; codename: string } | null>(null)
    const pendingInteractionMessage = tc('pendingCreateBlocked', 'This item is still being created. Please wait a moment and try again.')

    // Filter entity actions based on settings (allowCopy / allowDelete)
    const filteredValueGroupActions = useMemo(
        () =>
            valueGroupActions.filter((a) => {
                if (a.id === 'copy' && !allowCopy) return false
                if (a.id === 'delete' && !allowDelete) return false
                return true
            }),
        [allowCopy, allowDelete]
    )

    const createValueGroupMutation = useCreateValueGroup()
    const createValueGroupAtMetahubMutation = useCreateValueGroupAtMetahub()
    const updateValueGroupMutation = useUpdateValueGroup()
    const deleteValueGroupMutation = useDeleteValueGroup()
    const updateValueGroupAtMetahubMutation = useUpdateValueGroupAtMetahub()
    const copyValueGroupMutation = useCopyValueGroup()
    const reorderValueGroupMutation = useReorderValueGroup()

    useEffect(() => {
        if (!pendingSetNavigation || !metahubId) return

        if (sortedValueGroups.some((set) => set.id === pendingSetNavigation.pendingId)) {
            return
        }

        const resolvedSet = sortedValueGroups.find((set) => !isPendingEntity(set) && set.codename === pendingSetNavigation.codename)

        if (!resolvedSet) return

        setPendingSetNavigation(null)
        const nextPath = buildSetPath(resolvedSet.id)
        if (nextPath) {
            navigate(nextPath)
        }
    }, [buildSetPath, metahubId, navigate, pendingSetNavigation, sortedValueGroups])

    const handlePendingSetInteraction = useCallback(
        (pendingValueGroupId: string) => {
            if (!metahubId) return
            const pendingSet = setMap.get(pendingValueGroupId)
            if (pendingSet?.codename) {
                setPendingSetNavigation({ pendingId: pendingSet.id, codename: pendingSet.codename })
            }
            revealPendingEntityFeedback({
                queryClient,
                queryKeyPrefix:
                    isHubScoped && treeEntityId
                        ? metahubsQueryKeys.valueGroupsScope(metahubId, treeEntityId, entityKindKey)
                        : metahubsQueryKeys.allValueGroupsScope(metahubId, entityKindKey),
                entityId: pendingValueGroupId,
                extraQueryKeys: [
                    isHubScoped && treeEntityId
                        ? metahubsQueryKeys.valueGroupDetailInTreeEntity(metahubId, treeEntityId, pendingValueGroupId, entityKindKey)
                        : metahubsQueryKeys.valueGroupDetail(metahubId, pendingValueGroupId, entityKindKey)
                ]
            })
            enqueueSnackbar(pendingInteractionMessage, { variant: 'info' })
        },
        [enqueueSnackbar, entityKindKey, treeEntityId, isHubScoped, metahubId, pendingInteractionMessage, queryClient, setMap]
    )

    const attachExistingSetSelectionLabels = useMemo<EntitySelectionLabels>(
        () => ({
            title: t('sets.attachExisting.selectionTitle', 'ValueGroups'),
            addButton: t('common:actions.add', 'Add'),
            dialogTitle: t('sets.attachExisting.selectDialogTitle', 'Select valueGroups'),
            emptyMessage: t('sets.attachExisting.emptySelection', 'No valueGroups selected'),
            noAvailableMessage: t('sets.attachExisting.noAvailable', 'No valueGroups available to add'),
            searchPlaceholder: t('common:search', 'Search...'),
            cancelButton: t('common:actions.cancel', 'Cancel'),
            confirmButton: t('common:actions.add', 'Add'),
            removeTitle: t('common:actions.remove', 'Remove'),
            nameHeader: t('table.name', 'Name'),
            codenameHeader: t('common:fields.codename', 'Codename')
        }),
        [t]
    )

    // Form defaults with current hub auto-selected in hub-scoped mode (N:M relationship)
    const localizedFormDefaults = useMemo<ValueGroupFormValues>(
        () => ({
            nameVlc: null,
            descriptionVlc: null,
            codename: null,
            codenameTouched: false,
            treeEntityIds: treeEntityId ? [treeEntityId] : [], // Auto-select current hub
            isSingleHub: false,
            isRequiredHub: false // Default: set can exist without treeEntities
        }),
        [treeEntityId]
    )

    const validateValueGroupForm = useCallback(
        (values: GenericFormValues) => {
            const errors: Record<string, string> = {}
            const treeEntityIds = Array.isArray(values.treeEntityIds) ? values.treeEntityIds : []
            const isRequiredHub = Boolean(values.isRequiredHub)
            // TreeEntity validation only if isRequiredHub is true
            if (isRequiredHub && treeEntityIds.length === 0) {
                errors.treeEntityIds = t('sets.validation.hubRequired', 'At least one hub is required')
            }
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            if (!hasPrimaryContent(nameVlc)) {
                errors.nameVlc = tc('crud.nameRequired', 'Name is required')
            }
            const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
            const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? 'en'
            const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
            const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
            if (!normalizedCodename) {
                errors.codename = t('sets.validation.codenameRequired', 'Codename is required')
            } else if (
                !isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            ) {
                errors.codename = t('sets.validation.codenameInvalid', 'Codename contains invalid characters')
            }
            return Object.keys(errors).length > 0 ? errors : null
        },
        [codenameConfig.allowMixed, codenameConfig.alphabet, codenameConfig.style, t, tc]
    )

    const canSaveValueGroupForm = useCallback(
        (values: GenericFormValues) => {
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
            const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? 'en'
            const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
            const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
            const treeEntityIds = Array.isArray(values.treeEntityIds) ? values.treeEntityIds : []
            const isRequiredHub = Boolean(values.isRequiredHub)
            // TreeEntity requirement only if isRequiredHub is true
            const hubsValid = !isRequiredHub || treeEntityIds.length > 0
            return (
                !values._hasCodenameDuplicate &&
                hubsValid &&
                hasPrimaryContent(nameVlc) &&
                Boolean(normalizedCodename) &&
                isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            )
        },
        [codenameConfig.allowMixed, codenameConfig.alphabet, codenameConfig.style]
    )

    /**
     * Build tabs for the EntityFormDialog (N:M relationship)
     * Tab 1: General (name, description, codename)
     * Tab 2: TreeEntities (hub selection panel with isSingleHub toggle, current hub pre-selected)
     */
    const buildFormTabs = useCallback(
        ({
            values,
            setValue,
            isLoading: isFormLoading,
            errors
        }: {
            values: GenericFormValues
            setValue: (name: string, value: unknown) => void
            isLoading: boolean
            errors: Record<string, string>
        }): TabConfig[] => {
            const treeEntityIds = Array.isArray(values.treeEntityIds) ? values.treeEntityIds : []
            const isSingleHub = Boolean(values.isSingleHub)
            const isRequiredHub = Boolean(values.isRequiredHub)

            return [
                {
                    id: 'general',
                    label: t('sets.tabs.general', 'Основное'),
                    content: (
                        <GeneralTabFields
                            values={values}
                            setValue={setValue}
                            isLoading={isFormLoading}
                            errors={errors}
                            uiLocale={preferredVlcLocale}
                            nameLabel={tc('fields.name', 'Name')}
                            descriptionLabel={tc('fields.description', 'Description')}
                            codenameLabel={t('sets.codename', 'Codename')}
                            codenameHelper={t('sets.codenameHelper', 'Unique identifier')}
                        />
                    )
                },
                {
                    id: 'treeEntities',
                    label: t('sets.tabs.treeEntities', 'Хабы'),
                    content: (
                        <ContainerSelectionPanel
                            availableContainers={treeEntities}
                            selectedContainerIds={treeEntityIds}
                            onSelectionChange={(newTreeEntityIds) => setValue('treeEntityIds', newTreeEntityIds)}
                            isContainerRequired={isRequiredHub}
                            onRequiredContainerChange={(value) => setValue('isRequiredHub', value)}
                            isSingleContainer={isSingleHub}
                            onSingleContainerChange={(value) => setValue('isSingleHub', value)}
                            disabled={isFormLoading}
                            error={errors.treeEntityIds}
                            uiLocale={preferredVlcLocale}
                            currentContainerId={treeEntityId ?? null}
                        />
                    )
                }
            ]
        },
        [treeEntities, preferredVlcLocale, t, tc, treeEntityId]
    )

    const setColumns = useMemo(() => {
        // Base columns for both modes
        const baseColumns = [
            {
                id: 'sortOrder',
                label: t('sets.table.order', '#'),
                width: '4%',
                align: 'center' as const,
                sortable: true,
                sortAccessor: (row: ValueGroupWithContainersDisplay) => row.sortOrder ?? 0,
                render: (row: ValueGroupWithContainersDisplay) => (
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                        {typeof row.sortOrder === 'number' ? row.sortOrder : '—'}
                    </Typography>
                )
            },
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: isHubScoped ? '25%' : '20%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: ValueGroupWithContainersDisplay) => row.name?.toLowerCase() ?? '',
                render: (row: ValueGroupWithContainersDisplay) => {
                    const href = buildSetPath(row.id)
                    return isPendingEntity(row) ? (
                        <ButtonBase
                            onClick={() => handlePendingSetInteraction(row.id)}
                            sx={{ alignItems: 'flex-start', display: 'inline-flex', justifyContent: 'flex-start', textAlign: 'left' }}
                        >
                            <Typography
                                sx={{
                                    fontSize: 14,
                                    fontWeight: 500,
                                    wordBreak: 'break-word',
                                    '&:hover': {
                                        textDecoration: 'underline',
                                        color: 'primary.main'
                                    }
                                }}
                            >
                                {row.name || '—'}
                            </Typography>
                        </ButtonBase>
                    ) : (
                        <Link to={href} style={{ textDecoration: 'none', color: 'inherit' }}>
                            <Typography
                                sx={{
                                    fontSize: 14,
                                    fontWeight: 500,
                                    wordBreak: 'break-word',
                                    '&:hover': {
                                        textDecoration: 'underline',
                                        color: 'primary.main'
                                    }
                                }}
                            >
                                {row.name || '—'}
                            </Typography>
                        </Link>
                    )
                }
            },
            {
                id: 'description',
                label: tc('table.description', 'Description'),
                width: isHubScoped ? '30%' : '25%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: ValueGroupWithContainersDisplay) => row.description?.toLowerCase() ?? '',
                render: (row: ValueGroupWithContainersDisplay) => (
                    <Typography
                        sx={{
                            fontSize: 14,
                            wordBreak: 'break-word'
                        }}
                    >
                        {row.description || '—'}
                    </Typography>
                )
            },
            {
                id: 'codename',
                label: t('sets.codename', 'Codename'),
                width: '15%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: ValueGroupWithContainersDisplay) => row.codename?.toLowerCase() ?? '',
                render: (row: ValueGroupWithContainersDisplay) => (
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
            }
        ]

        // TreeEntity column only for global mode
        const hubColumn = {
            id: 'hub',
            label: t('hubs.title', 'TreeEntity'),
            width: '15%',
            align: 'left' as const,
            render: (row: ValueGroupWithContainersDisplay) => (
                <Stack direction='column' spacing={0.5}>
                    {row.allTreeEntities.map((hub) =>
                        isPendingEntity(row) ? (
                            <Chip
                                key={hub.id}
                                label={hub.name}
                                size='small'
                                variant='outlined'
                                clickable
                                onClick={() => handlePendingSetInteraction(row.id)}
                                sx={{
                                    maxWidth: '100%',
                                    '&:hover': {
                                        backgroundColor: 'action.hover'
                                    }
                                }}
                            />
                        ) : (
                            <Link key={hub.id} to={buildAssociatedHubSetPath(hub.id)} style={{ textDecoration: 'none', color: 'inherit' }}>
                                <Chip
                                    label={hub.name}
                                    size='small'
                                    variant='outlined'
                                    sx={{
                                        maxWidth: '100%',
                                        '&:hover': {
                                            backgroundColor: 'action.hover'
                                        }
                                    }}
                                />
                            </Link>
                        )
                    )}
                    {row.allTreeEntities.length === 0 && (
                        <Typography variant='body2' color='text.secondary'>
                            —
                        </Typography>
                    )}
                </Stack>
            )
        }

        // Count columns
        const countColumns = [
            {
                id: 'fixedValuesCount',
                label: t('sets.fixedValuesHeader', 'Constants'),
                width: '10%',
                align: 'center' as const,
                render: (row: ValueGroupWithContainersDisplay) =>
                    typeof row.fixedValuesCount === 'number' ? (
                        isPendingEntity(row) ? (
                            <ButtonBase onClick={() => handlePendingSetInteraction(row.id)}>
                                <Typography
                                    sx={{
                                        fontSize: 14,
                                        '&:hover': {
                                            textDecoration: 'underline',
                                            color: 'primary.main'
                                        }
                                    }}
                                >
                                    {row.fixedValuesCount}
                                </Typography>
                            </ButtonBase>
                        ) : (
                            <Link to={buildSetPath(row.id)} style={{ textDecoration: 'none', color: 'inherit' }}>
                                <Typography
                                    sx={{
                                        fontSize: 14,
                                        '&:hover': {
                                            textDecoration: 'underline',
                                            color: 'primary.main'
                                        }
                                    }}
                                >
                                    {row.fixedValuesCount}
                                </Typography>
                            </Link>
                        )
                    ) : (
                        '—'
                    )
            }
        ]

        // Combine columns based on mode
        if (isHubScoped) {
            return [...baseColumns, ...countColumns]
        } else {
            return [...baseColumns, hubColumn, ...countColumns]
        }
    }, [buildSetPath, buildAssociatedHubSetPath, handlePendingSetInteraction, isHubScoped, t, tc])

    const createValueGroupContext = useCallback(
        (baseContext: ValueGroupMenuBaseContext) => ({
            ...baseContext,
            setMap,
            metahubId,
            uiLocale: preferredVlcLocale,
            treeEntities, // Pass treeEntities for hub selector in edit dialog (N:M)
            currentTreeEntityId: isHubScoped ? treeEntityId ?? null : null,
            api: {
                updateEntity: (id: string, patch: ValueGroupLocalizedPayload & { expectedVersion?: number }) => {
                    if (!metahubId) return Promise.resolve()
                    const set = setMap.get(id)
                    const rawCodename = getVLCString(patch.codename, patch.codename?._primary ?? 'en')
                    const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
                    if (!normalizedCodename) {
                        throw new Error(t('sets.validation.codenameRequired', 'Codename is required'))
                    }
                    const codenamePayload = ensureLocalizedContent(patch.codename, patch.codename?._primary ?? 'en', normalizedCodename)
                    // Include expectedVersion for optimistic locking if set has version
                    const expectedVersion = set?.version
                    const dataWithVersion = { ...patch, codename: codenamePayload, expectedVersion }

                    const targetTreeEntityId = isHubScoped ? treeEntityId! : set?.treeEntities?.[0]?.id
                    const mutationOptions = {
                        onError: (error: unknown) => {
                            if (!isOptimisticLockConflict(error)) return
                            const conflict = extractConflictInfo(error)
                            if (!conflict) return
                            openConflict({
                                conflict,
                                pendingData: { ...patch, codename: codenamePayload },
                                valueGroupId: id
                            })
                        }
                    }

                    if (targetTreeEntityId) {
                        updateValueGroupMutation.mutate(
                            {
                                metahubId,
                                treeEntityId: targetTreeEntityId,
                                valueGroupId: id,
                                kindKey,
                                data: dataWithVersion
                            },
                            { onError: mutationOptions.onError }
                        )
                    } else {
                        updateValueGroupAtMetahubMutation.mutate(
                            {
                                metahubId,
                                valueGroupId: id,
                                kindKey,
                                data: dataWithVersion
                            },
                            { onError: mutationOptions.onError }
                        )
                    }

                    return Promise.resolve()
                },
                deleteEntity: (id: string) => {
                    if (!metahubId) return
                    const set = setMap.get(id)

                    if (isHubScoped && treeEntityId) {
                        // TreeEntity-scoped mode: use treeEntityId from URL
                        return deleteValueGroupMutation.mutateAsync({
                            metahubId,
                            treeEntityId,
                            valueGroupId: id,
                            kindKey,
                            force: false
                        })
                    } else {
                        // Global mode: check if set has treeEntities
                        const targetTreeEntityId = set?.treeEntities?.[0]?.id
                        return deleteValueGroupMutation.mutateAsync({
                            metahubId,
                            treeEntityId: targetTreeEntityId, // undefined for valueGroups without treeEntities
                            valueGroupId: id,
                            kindKey,
                            force: Boolean(targetTreeEntityId) // force=true if has multiple treeEntities
                        })
                    }
                },
                copyEntity: createEntityCopyCallback<ValueGroupLocalizedPayload & Record<string, unknown>>({
                    metahubId,
                    mutation: copyValueGroupMutation,
                    entityIdKey: 'valueGroupId',
                    kindKey
                })
            },
            helpers: {
                refreshList: () => {
                    if (metahubId) {
                        if (isHubScoped && treeEntityId) {
                            void invalidateValueGroupsQueries.all(queryClient, metahubId, treeEntityId)
                        } else {
                            // In global mode, invalidate all valueGroups cache
                            void queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allValueGroupsScope(metahubId, kindKey) })
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
                openDeleteDialog: (entity: ValueGroupDisplayWithContainer | ValueGroupDisplay) => {
                    const set = setMap.get(entity.id)
                    if (!set) return
                    const containersCount = Array.isArray(set.treeEntities) ? set.treeEntities.length : 0
                    const willDeleteSet = !isHubScoped || (!set.isRequiredHub && containersCount === 1)

                    if (willDeleteSet) {
                        openBlockingDelete(set)
                        return
                    }

                    openDelete(set)
                }
            }
        }),
        [
            confirm,
            copyValueGroupMutation,
            codenameConfig.alphabet,
            codenameConfig.style,
            deleteValueGroupMutation,
            enqueueSnackbar,
            kindKey,
            openBlockingDelete,
            openConflict,
            openDelete,
            setMap,
            treeEntities,
            treeEntityId,
            isHubScoped,
            metahubId,
            preferredVlcLocale,
            queryClient,
            t,
            updateValueGroupMutation,
            updateValueGroupAtMetahubMutation
        ]
    )

    // Validate metahubId from URL AFTER all hooks
    // In hub-scoped mode, also validate treeEntityId
    if (!metahubId || (isHubScoped && !treeEntityId)) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt={isHubScoped ? 'Invalid hub' : 'Invalid metahub'}
                title={isHubScoped ? t('metahubs:errors.invalidHub') : t('metahubs:errors.invalidMetahub')}
                description={isHubScoped ? t('metahubs:errors.pleaseSelectHub') : t('metahubs:errors.pleaseSelectMetahub')}
            />
        )
    }

    const handleAddNew = () => {
        openCreate()
    }

    const handleDialogClose = () => {
        close('create')
    }

    const handleOpenAttachExistingDialog = () => {
        setAttachDialogError(null)
        setAttachDialogOpen(true)
    }

    const handleCloseAttachExistingDialog = () => {
        if (isAttachingExisting) return
        setAttachDialogError(null)
        setAttachDialogOpen(false)
    }

    const handleAttachExistingValueGroups = async (data: GenericFormValues) => {
        if (!metahubId || !treeEntityId) return

        const selectedValueGroupIds = Array.isArray(data.selectedValueGroupIds)
            ? data.selectedValueGroupIds.filter((id): id is string => typeof id === 'string')
            : []
        if (selectedValueGroupIds.length === 0) {
            return
        }

        setAttachDialogError(null)
        setAttachingExisting(true)
        try {
            const selectedValueGroups = selectedValueGroupIds
                .map((valueGroupId) => allValueGroupsById.get(valueGroupId))
                .filter((set): set is ValueGroupWithContainers => Boolean(set))
            const failed: string[] = []

            for (const set of selectedValueGroups) {
                try {
                    const currentTreeEntityIds = Array.isArray(set.treeEntities) ? set.treeEntities.map((hub) => hub.id) : []
                    const nextTreeEntityIds = Array.from(new Set([...currentTreeEntityIds, treeEntityId]))
                    await setsApi.updateValueGroupAtMetahub(
                        metahubId,
                        set.id,
                        {
                            treeEntityIds: nextTreeEntityIds,
                            expectedVersion: set.version
                        },
                        kindKey
                    )
                } catch (error) {
                    failed.push(getVLCString(set.name, preferredVlcLocale) || getVLCString(set.name, 'en') || set.codename)
                    // eslint-disable-next-line no-console
                    console.error('Failed to attach existing set to current hub', error)
                }
            }

            await Promise.all([
                invalidateValueGroupsQueries.all(queryClient, metahubId, treeEntityId),
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allValueGroupsScope(metahubId, kindKey) })
            ])

            if (failed.length === 0) {
                enqueueSnackbar(
                    t('sets.attachExisting.success', { count: selectedValueGroups.length, defaultValue: 'Added {{count}} set(s).' }),
                    {
                        variant: 'success'
                    }
                )
                setAttachDialogOpen(false)
                return
            }

            const successCount = selectedValueGroups.length - failed.length
            if (successCount > 0) {
                enqueueSnackbar(
                    t('sets.attachExisting.partialSuccess', {
                        successCount,
                        failCount: failed.length,
                        defaultValue: 'Added {{successCount}} set(s). {{failCount}} set(s) could not be linked.'
                    }),
                    { variant: 'warning' }
                )
                setAttachDialogOpen(false)
                return
            }

            setAttachDialogError(
                t('sets.attachExisting.failedAll', {
                    defaultValue: 'Selected valueGroups could not be linked to this hub. Please review restrictions and try again.'
                })
            )
        } finally {
            setAttachingExisting(false)
        }
    }

    const handleCreateValueGroup = async (data: GenericFormValues) => {
        // Validation is handled by EntityFormDialog's validate/canSave props.
        const treeEntityIds = Array.isArray(data.treeEntityIds) ? data.treeEntityIds : []
        const isRequiredHub = Boolean(data.isRequiredHub)

        const nameVlc = data.nameVlc as VersionedLocalizedContent<string> | null | undefined
        const descriptionVlc = data.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
        const codenameValue = data.codename as VersionedLocalizedContent<string> | null | undefined
        const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
        const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)
        const codenamePrimaryLocale = codenameValue?._primary ?? namePrimaryLocale ?? 'en'
        const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
        const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
        const isSingleHub = Boolean(data.isSingleHub)
        const codenamePayload = ensureLocalizedContent(codenameValue, namePrimaryLocale ?? codenamePrimaryLocale, normalizedCodename || '')

        // Confirm dialog for detached set (async — throws DIALOG_SAVE_CANCEL if cancelled)
        if (isHubScoped && treeEntityId && !treeEntityIds.includes(treeEntityId)) {
            const confirmed = await confirm({
                title: t('sets.detachedConfirm.title', 'Create set without current hub?'),
                description: t(
                    'sets.detachedConfirm.description',
                    'This set is not linked to the current hub and will not appear in this hub after creation.'
                ),
                confirmButtonName: t('common:actions.create', 'Create'),
                cancelButtonName: t('common:actions.cancel', 'Cancel')
            })
            if (!confirmed) {
                throw DIALOG_SAVE_CANCEL
            }
        }

        // Fire-and-forget: optimistic card via onMutate, errors via onError snackbar,
        // cache invalidation via onSettled. Dialog closes immediately.
        const setPayload = {
            codename: codenamePayload,
            name: nameInput ?? {},
            description: descriptionInput,
            namePrimaryLocale: namePrimaryLocale ?? '',
            descriptionPrimaryLocale,
            treeEntityIds,
            isSingleHub,
            isRequiredHub
        }

        if (treeEntityIds.length > 0) {
            const primaryTreeEntityId = treeEntityIds[0]
            createValueGroupMutation.mutate({
                metahubId: metahubId!,
                treeEntityId: primaryTreeEntityId,
                kindKey,
                data: setPayload
            })
        } else {
            createValueGroupAtMetahubMutation.mutate({
                metahubId: metahubId!,
                kindKey,
                data: setPayload
            })
        }
    }

    const goToSet = (set: ValueGroupWithContainers) => {
        const nextPath = buildSetPath(set.id)
        if (nextPath) {
            navigate(nextPath)
        }
    }

    const handleChange = (_event: unknown, nextView: string | null) => {
        if (nextView === null) return
        setView(nextView as 'card' | 'table')
    }

    const handleHubTabChange = (
        _event: unknown,
        tabValue: 'treeEntities' | 'linkedCollections' | 'valueGroups' | 'optionLists' | 'settings'
    ) => {
        if (!metahubId || !treeEntityId) return
        if (tabValue === 'treeEntities') {
            const nextPath = buildHubPath('treeEntities')
            if (nextPath) {
                navigate(nextPath)
            }
            return
        }
        if (tabValue === 'settings') {
            const nextPath = buildHubPath('treeEntities')
            if (nextPath) {
                navigate(nextPath, { state: { openHubSettings: true } })
            }
            return
        }
        if (tabValue === 'linkedCollections') {
            const nextPath = buildHubPath('linkedCollections')
            if (nextPath) {
                navigate(nextPath)
            }
            return
        }
        if (tabValue === 'optionLists') {
            const nextPath = buildHubPath('optionLists')
            if (nextPath) {
                navigate(nextPath)
            }
            return
        }
        const nextPath = buildHubPath('valueGroups')
        if (nextPath) {
            navigate(nextPath)
        }
    }

    // Transform Set data for display - use hub-aware version for global mode
    const getSetCardData = (set: ValueGroupWithContainers): ValueGroupWithContainersDisplay =>
        toValueGroupWithContainersDisplay(set, i18n.language)
    const showAttachExistingAction = isHubScoped && allowAttachExistingEntities
    const hasAttachableExistingValueGroups = attachableExistingValueGroups.length > 0

    const handleSortableDragEnd = async (event: DragEndEvent) => {
        if (!metahubId) return
        const { active, over } = event
        if (!over || active.id === over.id) return

        const overSet = sortedValueGroups.find((set) => set.id === String(over.id))
        if (!overSet) return

        try {
            await reorderValueGroupMutation.mutateAsync({
                metahubId,
                treeEntityId,
                valueGroupId: String(active.id),
                kindKey,
                newSortOrder: overSet.sortOrder ?? 1
            })
            enqueueSnackbar(t('sets.reorderSuccess', 'Set order updated'), { variant: 'success' })
        } catch (error: unknown) {
            const message =
                typeof error === 'object' &&
                error !== null &&
                'message' in error &&
                typeof (error as { message?: unknown }).message === 'string'
                    ? (error as { message: string }).message
                    : t('sets.reorderError', 'Failed to reorder set')
            enqueueSnackbar(message, { variant: 'error' })
        }
    }

    const renderDragOverlay = (activeId: string | null) => {
        if (!activeId) return null
        const set = setMap.get(activeId)
        if (!set) return null
        const display = getSetCardData(set)
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
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{display.name || display.codename || set.id}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{display.codename || '—'}</Typography>
                </Stack>
            </Box>
        )
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
            <ExistingCodenamesProvider entities={existingSetCodenames}>
                {error ? (
                    <EmptyListState
                        image={APIEmptySVG}
                        imageAlt='Connection error'
                        title={t('errors.connectionFailed')}
                        description={!extractResponseStatus(error) ? t('errors.checkConnection') : t('errors.pleaseTryLater')}
                        action={{
                            label: t('actions.retry'),
                            onClick: () => paginationResult.actions.goToPage(1)
                        }}
                    />
                ) : (
                    <Stack flexDirection='column' sx={{ gap: 1 }}>
                        <ViewHeader
                            search={true}
                            searchPlaceholder={t('sets.searchPlaceholder')}
                            onSearchChange={handleSearchChange}
                            title={isHubScoped ? t('sets.title') : t('sets.allTitle')}
                        >
                            <ToolbarControls
                                viewToggleEnabled
                                viewMode={view as 'card' | 'list'}
                                onViewModeChange={(mode: string) => handleChange(null, mode)}
                                cardViewTitle={tc('cardView')}
                                listViewTitle={tc('listView')}
                                primaryAction={{
                                    label: tc('create'),
                                    onClick: handleAddNew,
                                    startIcon: <AddRoundedIcon />
                                }}
                                primaryActionMenuItems={
                                    showAttachExistingAction && hasAttachableExistingValueGroups
                                        ? [
                                              {
                                                  label: t('common:actions.add', 'Add'),
                                                  onClick: handleOpenAttachExistingDialog
                                              }
                                          ]
                                        : undefined
                                }
                            />
                        </ViewHeader>

                        {isHubScoped && (
                            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                <Tabs
                                    value='valueGroups'
                                    onChange={handleHubTabChange}
                                    aria-label={t('hubs.title', 'TreeEntities')}
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
                                    <Tab value='treeEntities' label={t('hubs.title')} />
                                    <Tab value='linkedCollections' label={t('catalogs.title')} />
                                    <Tab value='valueGroups' label={t('sets.title')} />
                                    <Tab value='optionLists' label={t('enumerations.title')} />
                                    <Tab value='settings' label={t('settings.title')} />
                                </Tabs>
                            </Box>
                        )}

                        <Box sx={{ mt: isHubScoped ? 2 : 0 }}>
                            {isLoading && sortedValueGroups.length === 0 ? (
                                view === 'card' ? (
                                    <SkeletonGrid insetMode='content' />
                                ) : (
                                    <Skeleton variant='rectangular' height={120} />
                                )
                            ) : !isLoading && sortedValueGroups.length === 0 ? (
                                <EmptyListState
                                    image={APIEmptySVG}
                                    imageAlt='No valueGroups'
                                    title={searchValue ? t('sets.noSearchResults') : t('sets.empty')}
                                    description={searchValue ? t('sets.noSearchResultsHint') : t('sets.emptyDescription')}
                                />
                            ) : (
                                <>
                                    {view === 'card' ? (
                                        <Box
                                            sx={{
                                                display: 'grid',
                                                gap: gridSpacing,
                                                gridTemplateColumns: {
                                                    xs: '1fr',
                                                    sm: 'repeat(auto-fill, minmax(240px, 1fr))',
                                                    lg: 'repeat(auto-fill, minmax(260px, 1fr))'
                                                },
                                                justifyContent: 'start',
                                                alignContent: 'start'
                                            }}
                                        >
                                            {sortedValueGroups.map((set: ValueGroupWithContainers) => {
                                                const descriptors = [...filteredValueGroupActions]
                                                const displayData = getSetCardData(set)

                                                return (
                                                    <ItemCard
                                                        key={set.id}
                                                        data={displayData}
                                                        images={images[set.id] || []}
                                                        onClick={() => goToSet(set)}
                                                        pending={isPendingEntity(set)}
                                                        pendingAction={getPendingAction(set)}
                                                        onPendingInteractionAttempt={() => handlePendingSetInteraction(set.id)}
                                                        footerEndContent={
                                                            <Stack direction='row' spacing={1} alignItems='center'>
                                                                {/* Show hub chip only in global mode */}
                                                                {!isHubScoped && displayData.hubName && (
                                                                    <>
                                                                        <Chip label={displayData.hubName} size='small' variant='outlined' />
                                                                        {displayData.containersCount > 1 && (
                                                                            <Typography variant='caption' color='text.secondary'>
                                                                                +{displayData.containersCount - 1}
                                                                            </Typography>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {typeof set.fixedValuesCount === 'number' && (
                                                                    <Typography variant='caption' color='text.secondary'>
                                                                        {t('sets.fixedValuesCount', { count: set.fixedValuesCount })}
                                                                    </Typography>
                                                                )}
                                                            </Stack>
                                                        }
                                                        headerAction={
                                                            descriptors.length > 0 ? (
                                                                <Box onClick={(e) => e.stopPropagation()}>
                                                                    <BaseEntityMenu<
                                                                        ValueGroupDisplayWithContainer,
                                                                        ValueGroupLocalizedPayload
                                                                    >
                                                                        entity={displayData}
                                                                        entityKind='set'
                                                                        descriptors={descriptors}
                                                                        namespace='metahubs'
                                                                        i18nInstance={i18n}
                                                                        createContext={createValueGroupContext}
                                                                    />
                                                                </Box>
                                                            ) : null
                                                        }
                                                    />
                                                )
                                            })}
                                        </Box>
                                    ) : (
                                        <Box>
                                            <FlowListTable
                                                data={sortedValueGroups.map(getSetCardData)}
                                                images={images}
                                                isLoading={isLoading}
                                                sortableRows
                                                sortableItemIds={sortedValueGroups.map((set) => set.id)}
                                                dragHandleAriaLabel={t('sets.dnd.dragHandle', 'Drag to reorder')}
                                                dragDisabled={reorderValueGroupMutation.isPending || isLoading}
                                                onSortableDragEnd={handleSortableDragEnd}
                                                renderDragOverlay={renderDragOverlay}
                                                getRowLink={(row: ValueGroupWithContainersDisplay) =>
                                                    row?.id ? buildSetPath(row.id) || undefined : undefined
                                                }
                                                onPendingInteractionAttempt={(row: ValueGroupWithContainersDisplay) =>
                                                    handlePendingSetInteraction(row.id)
                                                }
                                                customColumns={setColumns}
                                                i18nNamespace='flowList'
                                                renderActions={(row: ValueGroupWithContainersDisplay) => {
                                                    const originalSet = setMap.get(row.id)
                                                    if (!originalSet) return null

                                                    const descriptors = [...filteredValueGroupActions]
                                                    if (!descriptors.length) return null

                                                    return (
                                                        <BaseEntityMenu<ValueGroupDisplayWithContainer, ValueGroupLocalizedPayload>
                                                            entity={getSetCardData(originalSet)}
                                                            entityKind='set'
                                                            descriptors={descriptors}
                                                            namespace='metahubs'
                                                            menuButtonLabelKey='flowList:menu.button'
                                                            i18nInstance={i18n}
                                                            createContext={createValueGroupContext}
                                                        />
                                                    )
                                                }}
                                            />
                                        </Box>
                                    )}
                                </>
                            )}
                        </Box>

                        {/* Table Pagination at bottom */}
                        {!isLoading && sortedValueGroups.length > 0 && (
                            <Box sx={{ mt: 2 }}>
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
                    title={t('sets.createDialog.title', 'Create Set')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={tc('actions.create', 'Create')}
                    savingButtonText={tc('actions.creating', 'Creating...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onClose={handleDialogClose}
                    onSave={handleCreateValueGroup}
                    hideDefaultFields
                    initialExtraValues={localizedFormDefaults}
                    tabs={buildFormTabs}
                    validate={validateValueGroupForm}
                    canSave={canSaveValueGroupForm}
                />

                <EntityFormDialog
                    open={isAttachDialogOpen}
                    title={t('sets.attachExisting.dialogTitle', 'Add Existing ValueGroups')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={t('common:actions.add', 'Add')}
                    savingButtonText={t('common:actions.saving', 'Saving...')}
                    cancelButtonText={t('common:actions.cancel', 'Cancel')}
                    loading={isAttachingExisting}
                    error={attachDialogError || undefined}
                    onClose={handleCloseAttachExistingDialog}
                    onSave={handleAttachExistingValueGroups}
                    hideDefaultFields
                    initialExtraValues={{ selectedValueGroupIds: [] }}
                    tabs={({ values, setValue, isLoading, errors }) => {
                        const selectedValueGroupIds = Array.isArray(values.selectedValueGroupIds)
                            ? values.selectedValueGroupIds.filter((id): id is string => typeof id === 'string')
                            : []
                        return [
                            {
                                id: 'valueGroups',
                                label: t('sets.title', 'ValueGroups'),
                                content: (
                                    <EntitySelectionPanel<ValueGroupWithContainers>
                                        availableEntities={attachableExistingValueGroups}
                                        selectedIds={selectedValueGroupIds}
                                        onSelectionChange={(ids) => setValue('selectedValueGroupIds', ids)}
                                        getDisplayName={(set) =>
                                            getVLCString(set.name, preferredVlcLocale) ||
                                            getVLCString(set.name, 'en') ||
                                            set.codename ||
                                            '—'
                                        }
                                        getCodename={(set) => set.codename}
                                        labels={attachExistingSetSelectionLabels}
                                        disabled={isLoading}
                                        error={errors.selectedValueGroupIds}
                                    />
                                )
                            }
                        ]
                    }}
                    validate={(values) => {
                        const selectedValueGroupIds = Array.isArray(values.selectedValueGroupIds)
                            ? values.selectedValueGroupIds.filter((id): id is string => typeof id === 'string')
                            : []
                        if (selectedValueGroupIds.length > 0) return null
                        return {
                            selectedValueGroupIds: t('sets.attachExisting.requiredSelection', 'Select at least one set to add.')
                        }
                    }}
                    canSave={(values) => {
                        const selectedValueGroupIds = Array.isArray(values.selectedValueGroupIds)
                            ? values.selectedValueGroupIds.filter((id): id is string => typeof id === 'string')
                            : []
                        return !isAttachingExisting && selectedValueGroupIds.length > 0
                    }}
                />

                {/* Independent ConfirmDeleteDialog */}
                <ConfirmDeleteDialog
                    open={dialogs.delete.open}
                    title={t('sets.deleteDialog.title')}
                    description={t('sets.deleteDialog.message')}
                    confirmButtonText={tc('actions.delete', 'Delete')}
                    deletingButtonText={tc('actions.deleting', 'Deleting...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onCancel={() => close('delete')}
                    onConfirm={() => {
                        if (!dialogs.delete.item || !metahubId) return

                        const deletingValueGroupId = dialogs.delete.item.id
                        const targetTreeEntityId = isHubScoped ? treeEntityId! : dialogs.delete.item.treeEntities?.[0]?.id || ''
                        deleteValueGroupMutation.mutate(
                            {
                                metahubId,
                                treeEntityId: targetTreeEntityId,
                                valueGroupId: deletingValueGroupId,
                                kindKey,
                                force: !isHubScoped
                            },
                            {
                                onSuccess: () => {
                                    queryClient.removeQueries({
                                        queryKey: metahubsQueryKeys.blockingValueGroupReferences(metahubId, deletingValueGroupId, kindKey)
                                    })
                                },
                                onError: (err: unknown) => {
                                    const responseMessage = extractResponseMessage(err)
                                    const message =
                                        typeof responseMessage === 'string'
                                            ? responseMessage
                                            : err instanceof Error
                                            ? err.message
                                            : typeof err === 'string'
                                            ? err
                                            : t('sets.deleteError')
                                    enqueueSnackbar(message, { variant: 'error' })
                                }
                            }
                        )
                    }}
                />

                <ValueGroupDeleteDialog
                    open={blockingDeleteDialogState.open}
                    set={blockingDeleteDialogState.entity}
                    metahubId={metahubId}
                    onClose={closeBlockingDelete}
                    onConfirm={(set) => {
                        const targetTreeEntityId = isHubScoped ? treeEntityId : set.treeEntities?.[0]?.id
                        deleteValueGroupMutation.mutate(
                            {
                                metahubId,
                                treeEntityId: targetTreeEntityId,
                                valueGroupId: set.id,
                                kindKey,
                                force: !isHubScoped
                            },
                            {
                                onSuccess: () => {
                                    queryClient.removeQueries({
                                        queryKey: metahubsQueryKeys.blockingValueGroupReferences(metahubId, set.id, kindKey)
                                    })
                                },
                                onError: (err: unknown) => {
                                    const responseMessage = extractResponseMessage(err)
                                    const message =
                                        typeof responseMessage === 'string'
                                            ? responseMessage
                                            : err instanceof Error
                                            ? err.message
                                            : typeof err === 'string'
                                            ? err
                                            : t('sets.deleteError')
                                    enqueueSnackbar(message, { variant: 'error' })
                                }
                            }
                        )
                    }}
                    isDeleting={deleteValueGroupMutation.isPending}
                    uiLocale={i18n.language}
                />

                {/* Conflict Resolution Dialog for optimistic locking */}
                <ConflictResolutionDialog
                    open={dialogs.conflict.open}
                    conflict={(dialogs.conflict.data as { conflict?: ConflictInfo })?.conflict ?? null}
                    onOverwrite={async () => {
                        const conflictData = dialogs.conflict.data as {
                            conflict?: ConflictInfo
                            pendingData?: ValueGroupLocalizedPayload
                            valueGroupId?: string
                        } | null
                        if (!metahubId || !conflictData?.valueGroupId || !conflictData?.pendingData) return
                        try {
                            const set = setMap.get(conflictData.valueGroupId)
                            const targetTreeEntityId = isHubScoped ? treeEntityId! : set?.treeEntities?.[0]?.id
                            // Retry without expectedVersion to force overwrite
                            if (targetTreeEntityId) {
                                await updateValueGroupMutation.mutateAsync({
                                    metahubId,
                                    treeEntityId: targetTreeEntityId,
                                    valueGroupId: conflictData.valueGroupId,
                                    kindKey,
                                    data: conflictData.pendingData
                                })
                            } else {
                                await updateValueGroupAtMetahubMutation.mutateAsync({
                                    metahubId,
                                    valueGroupId: conflictData.valueGroupId,
                                    kindKey,
                                    data: conflictData.pendingData
                                })
                            }
                            close('conflict')
                            enqueueSnackbar(t('sets.updateSuccess', 'Set updated'), { variant: 'success' })
                        } catch (e) {
                            console.error('Failed to overwrite set', e)
                            enqueueSnackbar(t('sets.updateError', 'Failed to update set'), { variant: 'error' })
                        }
                    }}
                    onReload={async () => {
                        // Reload the list to get latest data
                        if (metahubId) {
                            if (isHubScoped && treeEntityId) {
                                await invalidateValueGroupsQueries.all(queryClient, metahubId, treeEntityId)
                            } else {
                                await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allValueGroupsScope(metahubId, kindKey) })
                            }
                        }
                        close('conflict')
                    }}
                    onCancel={() => {
                        close('conflict')
                    }}
                />
            </ExistingCodenamesProvider>
        </MainCard>
    )
}

const ValueGroupList = () => <ValueGroupListContent />

export default ValueGroupList
