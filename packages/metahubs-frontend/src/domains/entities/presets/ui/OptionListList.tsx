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
import type { DragEndEvent } from '@universo/template-mui'
import type { EntitySelectionLabels } from '@universo/template-mui'
import { EntityFormDialog, ConfirmDeleteDialog, ConflictResolutionDialog } from '@universo/template-mui/components/dialogs'
import type { TabConfig } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'

import {
    useCreateOptionList,
    useCreateOptionListAtMetahub,
    useUpdateOptionList,
    useUpdateOptionListAtMetahub,
    useDeleteOptionList,
    useCopyOptionList,
    useReorderOptionList
} from '../hooks/optionListMutations'
import { useOptionListData } from '../hooks/useOptionListData'
import { useStandardEntityListState, createEntityCopyCallback } from '../hooks/useStandardEntityListState'
import { STORAGE_KEYS } from '../../../../view-preferences/storage'
import type { OptionListWithContainers } from '../api/optionLists'
import { invalidateOptionListsQueries, metahubsQueryKeys } from '../../../shared'
import type { VersionedLocalizedContent } from '@universo/types'
import { isOptimisticLockConflict, extractConflictInfo, isPendingEntity, getPendingAction, type ConflictInfo } from '@universo/utils'
import { getVLCString } from '../../../../types'
import { normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../../utils/codename'
import { useCodenameConfig } from '../../../settings/hooks/useCodenameConfig'
import { ensureLocalizedContent, extractLocalizedInput, hasPrimaryContent } from '../../../../utils/localizedInput'
import { OptionListDeleteDialog, ContainerSelectionPanel, ExistingCodenamesProvider } from '../../../../components'
import optionListActions, { OptionListDisplayWithContainer } from './OptionListActions'
import { useMetahubPrimaryLocale } from '../../../settings/hooks/useMetahubPrimaryLocale'
import GeneralTabFields from '../../../shared/ui/GeneralTabFields'
import type { OptionListFormValues, OptionListMenuBaseContext, ConfirmSpec } from './optionListListUtils'
import { DIALOG_SAVE_CANCEL, extractResponseStatus, extractResponseMessage, toOptionListWithContainersDisplay } from './optionListListUtils'
import {
    buildOptionListAuthoringPath,
    buildTreeEntityAuthoringPath,
    resolveEntityChildKindKey
} from '../../../shared/entityMetadataRoutePaths'

type GenericFormValues = Record<string, unknown>

export const OptionListContent = () => {
    const codenameConfig = useCodenameConfig()
    const navigate = useNavigate()
    const { kindKey: routeKindKey } = useParams<{ kindKey?: string }>()
    const preferredVlcLocale = useMetahubPrimaryLocale()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
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
        sortedOptionLists,
        images,
        enumerationMap,
        allOptionListsById,
        existingEnumerationCodenames,
        attachableExistingOptionLists,
        entityKindKey,
        allowCopy,
        allowDelete,
        allowAttachExistingEntities
    } = useOptionListData()
    const kindKey = entityKindKey
    const buildEnumerationPath = useCallback(
        (optionListId: string) =>
            buildOptionListAuthoringPath({
                metahubId,
                optionListId,
                treeEntityId: isHubScoped ? treeEntityId : null,
                kindKey: routeKindKey
            }),
        [treeEntityId, isHubScoped, metahubId, routeKindKey]
    )
    const buildHubPath = useCallback(
        (tab: 'treeEntities' | 'objectCollections' | 'valueGroups' | 'optionLists') =>
            buildTreeEntityAuthoringPath({
                metahubId,
                treeEntityId,
                kindKey: routeKindKey,
                tab
            }),
        [treeEntityId, metahubId, routeKindKey]
    )
    const buildAssociatedHubEnumerationPath = useCallback(
        (nextTreeEntityId: string) =>
            buildTreeEntityAuthoringPath({
                metahubId,
                treeEntityId: nextTreeEntityId,
                kindKey: resolveEntityChildKindKey({ routeKindKey, childObjectKind: 'hub' }),
                tab: 'optionLists'
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
    } = useStandardEntityListState<OptionListWithContainers>(
        isHubScoped ? STORAGE_KEYS.OPTION_LIST_DISPLAY_STYLE : STORAGE_KEYS.ALL_OPTION_LISTS_DISPLAY_STYLE
    )
    const [isAttachDialogOpen, setAttachDialogOpen] = useState(false)
    const [isAttachingExisting, setAttachingExisting] = useState(false)
    const [attachDialogError, setAttachDialogError] = useState<string | null>(null)
    const [pendingEnumerationNavigation, setPendingEnumerationNavigation] = useState<{ pendingId: string; codename: string } | null>(null)
    const pendingInteractionMessage = tc('pendingCreateBlocked', 'This item is still being created. Please wait a moment and try again.')

    const filteredOptionListActions = useMemo(
        () =>
            optionListActions.filter((a) => {
                if (a.id === 'copy' && !allowCopy) return false
                if (a.id === 'delete' && !allowDelete) return false
                return true
            }),
        [allowCopy, allowDelete]
    )

    const createOptionListMutation = useCreateOptionList()
    const createOptionListAtMetahubMutation = useCreateOptionListAtMetahub()
    const updateOptionListMutation = useUpdateOptionList()
    const deleteOptionListMutation = useDeleteOptionList()
    const updateOptionListAtMetahubMutation = useUpdateOptionListAtMetahub()
    const copyOptionListMutation = useCopyOptionList()
    const reorderOptionListMutation = useReorderOptionList()

    useEffect(() => {
        if (!pendingEnumerationNavigation || !metahubId) return

        if (sortedOptionLists.some((enumeration) => enumeration.id === pendingEnumerationNavigation.pendingId)) {
            return
        }

        const resolvedEnumeration = sortedOptionLists.find(
            (enumeration) => !isPendingEntity(enumeration) && enumeration.codename === pendingEnumerationNavigation.codename
        )

        if (!resolvedEnumeration) return

        setPendingEnumerationNavigation(null)
        const nextPath = buildEnumerationPath(resolvedEnumeration.id)
        if (nextPath) {
            navigate(nextPath)
        }
    }, [buildEnumerationPath, metahubId, navigate, pendingEnumerationNavigation, sortedOptionLists])

    const handlePendingEnumerationInteraction = useCallback(
        (pendingOptionListId: string) => {
            if (!metahubId) return
            const pendingEnumeration = enumerationMap.get(pendingOptionListId)
            if (pendingEnumeration?.codename) {
                setPendingEnumerationNavigation({ pendingId: pendingEnumeration.id, codename: pendingEnumeration.codename })
            }
            revealPendingEntityFeedback({
                queryClient,
                queryKeyPrefix:
                    isHubScoped && treeEntityId
                        ? metahubsQueryKeys.optionListsScope(metahubId, treeEntityId, entityKindKey)
                        : metahubsQueryKeys.allOptionListsScope(metahubId, entityKindKey),
                entityId: pendingOptionListId,
                extraQueryKeys: [
                    isHubScoped && treeEntityId
                        ? metahubsQueryKeys.optionListDetailInTreeEntity(metahubId, treeEntityId, pendingOptionListId, entityKindKey)
                        : metahubsQueryKeys.optionListDetail(metahubId, pendingOptionListId, entityKindKey)
                ]
            })
            enqueueSnackbar(pendingInteractionMessage, { variant: 'info' })
        },
        [enqueueSnackbar, entityKindKey, enumerationMap, treeEntityId, isHubScoped, metahubId, pendingInteractionMessage, queryClient]
    )

    const attachExistingEnumerationSelectionLabels = useMemo<EntitySelectionLabels>(
        () => ({
            title: t('enumerations.attachExisting.selectionTitle', 'OptionLists'),
            addButton: t('common:actions.add', 'Add'),
            dialogTitle: t('enumerations.attachExisting.selectDialogTitle', 'Select optionLists'),
            emptyMessage: t('enumerations.attachExisting.emptySelection', 'No optionLists selected'),
            noAvailableMessage: t('enumerations.attachExisting.noAvailable', 'No optionLists available to add'),
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
    const localizedFormDefaults = useMemo<OptionListFormValues>(
        () => ({
            nameVlc: null,
            descriptionVlc: null,
            codename: null,
            codenameTouched: false,
            treeEntityIds: treeEntityId ? [treeEntityId] : [], // Auto-select current hub
            isSingleHub: false,
            isRequiredHub: false // Default: enumeration can exist without treeEntities
        }),
        [treeEntityId]
    )

    const validateOptionListForm = useCallback(
        (values: GenericFormValues) => {
            const errors: Record<string, string> = {}
            const treeEntityIds = Array.isArray(values.treeEntityIds) ? values.treeEntityIds : []
            const isRequiredHub = Boolean(values.isRequiredHub)
            // TreeEntity validation only if isRequiredHub is true
            if (isRequiredHub && treeEntityIds.length === 0) {
                errors.treeEntityIds = t('enumerations.validation.hubRequired', 'At least one hub is required')
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
                errors.codename = t('enumerations.validation.codenameRequired', 'Codename is required')
            } else if (
                !isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            ) {
                errors.codename = t('enumerations.validation.codenameInvalid', 'Codename contains invalid characters')
            }
            return Object.keys(errors).length > 0 ? errors : null
        },
        [codenameConfig.allowMixed, codenameConfig.alphabet, codenameConfig.style, t, tc]
    )

    const canSaveOptionListForm = useCallback(
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
                    label: t('enumerations.tabs.general', 'Основное'),
                    content: (
                        <GeneralTabFields
                            values={values}
                            setValue={setValue}
                            isLoading={isFormLoading}
                            errors={errors}
                            uiLocale={preferredVlcLocale}
                            nameLabel={tc('fields.name', 'Name')}
                            descriptionLabel={tc('fields.description', 'Description')}
                            codenameLabel={t('enumerations.codename', 'Codename')}
                            codenameHelper={t('enumerations.codenameHelper', 'Unique identifier')}
                        />
                    )
                },
                {
                    id: 'treeEntities',
                    label: t('enumerations.tabs.treeEntities', 'Хабы'),
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

    const enumerationColumns = useMemo(() => {
        // Base columns for both modes
        const baseColumns = [
            {
                id: 'sortOrder',
                label: t('components.table.order', '#'),
                width: '4%',
                align: 'center' as const,
                sortable: true,
                sortAccessor: (row: OptionListWithContainersDisplay) => row.sortOrder ?? 0,
                render: (row: OptionListWithContainersDisplay) => (
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
                sortAccessor: (row: OptionListWithContainersDisplay) => row.name?.toLowerCase() ?? '',
                render: (row: OptionListWithContainersDisplay) => {
                    const href = buildEnumerationPath(row.id)
                    return isPendingEntity(row) ? (
                        <ButtonBase
                            onClick={() => handlePendingEnumerationInteraction(row.id)}
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
                sortAccessor: (row: OptionListWithContainersDisplay) => row.description?.toLowerCase() ?? '',
                render: (row: OptionListWithContainersDisplay) => (
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
                label: t('enumerations.codename', 'Codename'),
                width: '15%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: OptionListWithContainersDisplay) => row.codename?.toLowerCase() ?? '',
                render: (row: OptionListWithContainersDisplay) => (
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
            render: (row: OptionListWithContainersDisplay) => (
                <Stack direction='column' spacing={0.5}>
                    {row.allTreeEntities.map((hub) =>
                        isPendingEntity(row) ? (
                            <Chip
                                key={hub.id}
                                label={hub.name}
                                size='small'
                                variant='outlined'
                                clickable
                                onClick={() => handlePendingEnumerationInteraction(row.id)}
                                sx={{
                                    maxWidth: '100%',
                                    '&:hover': {
                                        backgroundColor: 'action.hover'
                                    }
                                }}
                            />
                        ) : (
                            <Link
                                key={hub.id}
                                to={buildAssociatedHubEnumerationPath(hub.id)}
                                style={{ textDecoration: 'none', color: 'inherit' }}
                            >
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
                id: 'optionValuesCount',
                label: t('enumerations.valuesHeader', 'Values'),
                width: '15%',
                align: 'center' as const,
                render: (row: OptionListWithContainersDisplay) =>
                    typeof row.optionValuesCount === 'number' ? (
                        isPendingEntity(row) ? (
                            <ButtonBase onClick={() => handlePendingEnumerationInteraction(row.id)}>
                                <Typography
                                    sx={{
                                        fontSize: 14,
                                        '&:hover': {
                                            textDecoration: 'underline',
                                            color: 'primary.main'
                                        }
                                    }}
                                >
                                    {row.optionValuesCount}
                                </Typography>
                            </ButtonBase>
                        ) : (
                            <Link to={buildEnumerationPath(row.id)} style={{ textDecoration: 'none', color: 'inherit' }}>
                                <Typography
                                    sx={{
                                        fontSize: 14,
                                        '&:hover': {
                                            textDecoration: 'underline',
                                            color: 'primary.main'
                                        }
                                    }}
                                >
                                    {row.optionValuesCount}
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
    }, [buildEnumerationPath, buildAssociatedHubEnumerationPath, handlePendingEnumerationInteraction, isHubScoped, t, tc])

    const createOptionListContext = useCallback(
        (baseContext: OptionListMenuBaseContext) => ({
            ...baseContext,
            enumerationMap,
            metahubId,
            uiLocale: preferredVlcLocale,
            treeEntities, // Pass treeEntities for hub selector in edit dialog (N:M)
            currentTreeEntityId: isHubScoped ? treeEntityId ?? null : null,
            api: {
                updateEntity: (id: string, patch: OptionListLocalizedPayload & { expectedVersion?: number }) => {
                    if (!metahubId) return Promise.resolve()
                    const enumeration = enumerationMap.get(id)
                    const rawCodename = getVLCString(patch.codename, patch.codename?._primary ?? 'en')
                    const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
                    if (!normalizedCodename) {
                        throw new Error(t('enumerations.validation.codenameRequired', 'Codename is required'))
                    }
                    const codenamePayload = ensureLocalizedContent(patch.codename, patch.codename?._primary ?? 'en', normalizedCodename)
                    // Include expectedVersion for optimistic locking if enumeration has version
                    const expectedVersion = enumeration?.version
                    const dataWithVersion = { ...patch, codename: codenamePayload, expectedVersion }

                    const targetTreeEntityId = isHubScoped ? treeEntityId! : enumeration?.treeEntities?.[0]?.id
                    const mutationOptions = {
                        onError: (error: unknown) => {
                            if (!isOptimisticLockConflict(error)) return
                            const conflict = extractConflictInfo(error)
                            if (!conflict) return
                            openConflict({
                                conflict,
                                pendingData: { ...patch, codename: codenamePayload },
                                optionListId: id
                            })
                        }
                    }

                    if (targetTreeEntityId) {
                        updateOptionListMutation.mutate(
                            {
                                metahubId,
                                treeEntityId: targetTreeEntityId,
                                optionListId: id,
                                kindKey,
                                data: dataWithVersion
                            },
                            { onError: mutationOptions.onError }
                        )
                    } else {
                        updateOptionListAtMetahubMutation.mutate(
                            {
                                metahubId,
                                optionListId: id,
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
                    const enumeration = enumerationMap.get(id)

                    if (isHubScoped && treeEntityId) {
                        // TreeEntity-scoped mode: use treeEntityId from URL
                        return deleteOptionListMutation.mutateAsync({
                            metahubId,
                            treeEntityId,
                            optionListId: id,
                            kindKey,
                            force: false
                        })
                    } else {
                        // Global mode: check if enumeration has treeEntities
                        const targetTreeEntityId = enumeration?.treeEntities?.[0]?.id
                        return deleteOptionListMutation.mutateAsync({
                            metahubId,
                            treeEntityId: targetTreeEntityId, // undefined for optionLists without treeEntities
                            optionListId: id,
                            kindKey,
                            force: Boolean(targetTreeEntityId) // force=true if has multiple treeEntities
                        })
                    }
                },
                copyEntity: createEntityCopyCallback<OptionListLocalizedPayload & Record<string, unknown>>({
                    metahubId,
                    mutation: copyOptionListMutation,
                    entityIdKey: 'optionListId',
                    kindKey
                })
            },
            helpers: {
                refreshList: () => {
                    if (metahubId) {
                        if (isHubScoped && treeEntityId) {
                            void invalidateOptionListsQueries.all(queryClient, metahubId, treeEntityId)
                        } else {
                            // In global mode, invalidate all optionLists cache
                            void queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allOptionListsScope(metahubId, kindKey) })
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
                openDeleteDialog: (entity: OptionListDisplayWithContainer | OptionListDisplay) => {
                    const enumeration = enumerationMap.get(entity.id)
                    if (!enumeration) return
                    const containersCount = Array.isArray(enumeration.treeEntities) ? enumeration.treeEntities.length : 0
                    const willDeleteEnumeration = !isHubScoped || (!enumeration.isRequiredHub && containersCount === 1)

                    if (willDeleteEnumeration) {
                        openBlockingDelete(enumeration)
                        return
                    }

                    openDelete(enumeration)
                }
            }
        }),
        [
            codenameConfig.alphabet,
            codenameConfig.style,
            confirm,
            copyOptionListMutation,
            deleteOptionListMutation,
            enqueueSnackbar,
            enumerationMap,
            openBlockingDelete,
            openConflict,
            openDelete,
            treeEntities,
            treeEntityId,
            isHubScoped,
            kindKey,
            metahubId,
            preferredVlcLocale,
            queryClient,
            t,
            updateOptionListMutation,
            updateOptionListAtMetahubMutation
        ]
    )

    // Validate metahubId from URL AFTER all hooks
    // In hub-scoped mode, also validate treeEntityId
    if (!metahubId || (isHubScoped && !treeEntityId)) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt={isHubScoped ? 'Invalid hub' : 'Invalid metahub'}
                title={t('metahubs:errors.invalidMetahub')}
                description={t('metahubs:errors.pleaseSelectMetahub')}
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

    const handleAttachExistingOptionLists = async (data: GenericFormValues) => {
        if (!metahubId || !treeEntityId) return

        const selectedOptionListIds = Array.isArray(data.selectedOptionListIds)
            ? data.selectedOptionListIds.filter((id): id is string => typeof id === 'string')
            : []
        if (selectedOptionListIds.length === 0) {
            return
        }

        setAttachDialogError(null)
        setAttachingExisting(true)
        try {
            const selectedOptionLists = selectedOptionListIds
                .map((optionListId) => allOptionListsById.get(optionListId))
                .filter((enumeration): enumeration is OptionListWithContainers => Boolean(enumeration))
            const failed: string[] = []

            for (const enumeration of selectedOptionLists) {
                try {
                    const currentTreeEntityIds = Array.isArray(enumeration.treeEntities)
                        ? enumeration.treeEntities.map((hub) => hub.id)
                        : []
                    const nextTreeEntityIds = Array.from(new Set([...currentTreeEntityIds, treeEntityId]))
                    await enumerationsApi.updateOptionListAtMetahub(
                        metahubId,
                        enumeration.id,
                        {
                            treeEntityIds: nextTreeEntityIds,
                            expectedVersion: enumeration.version
                        },
                        kindKey
                    )
                } catch (error) {
                    failed.push(
                        getVLCString(enumeration.name, preferredVlcLocale) || getVLCString(enumeration.name, 'en') || enumeration.codename
                    )
                    // eslint-disable-next-line no-console
                    console.error('Failed to attach existing enumeration to current hub', error)
                }
            }

            await Promise.all([
                invalidateOptionListsQueries.all(queryClient, metahubId, treeEntityId),
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allOptionListsScope(metahubId, kindKey) })
            ])

            if (failed.length === 0) {
                enqueueSnackbar(
                    t('enumerations.attachExisting.success', {
                        count: selectedOptionLists.length,
                        defaultValue: 'Added {{count}} enumeration(s).'
                    }),
                    { variant: 'success' }
                )
                setAttachDialogOpen(false)
                return
            }

            const successCount = selectedOptionLists.length - failed.length
            if (successCount > 0) {
                enqueueSnackbar(
                    t('enumerations.attachExisting.partialSuccess', {
                        successCount,
                        failCount: failed.length,
                        defaultValue: 'Added {{successCount}} enumeration(s). {{failCount}} enumeration(s) could not be linked.'
                    }),
                    { variant: 'warning' }
                )
                setAttachDialogOpen(false)
                return
            }

            setAttachDialogError(
                t('enumerations.attachExisting.failedAll', {
                    defaultValue: 'Selected optionLists could not be linked to this hub. Please review restrictions and try again.'
                })
            )
        } finally {
            setAttachingExisting(false)
        }
    }

    const handleCreateOptionList = async (data: GenericFormValues) => {
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

        // Confirm dialog for detached enumeration (async — throws DIALOG_SAVE_CANCEL if cancelled)
        if (isHubScoped && treeEntityId && !treeEntityIds.includes(treeEntityId)) {
            const confirmed = await confirm({
                title: t('enumerations.detachedConfirm.title', 'Create enumeration without current hub?'),
                description: t(
                    'enumerations.detachedConfirm.description',
                    'This enumeration is not linked to the current hub and will not appear in this hub after creation.'
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
        const enumerationPayload = {
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
            createOptionListMutation.mutate({
                metahubId: metahubId!,
                treeEntityId: primaryTreeEntityId,
                kindKey,
                data: enumerationPayload
            })
        } else {
            createOptionListAtMetahubMutation.mutate({
                metahubId: metahubId!,
                kindKey,
                data: enumerationPayload
            })
        }
    }

    const goToEnumeration = (enumeration: OptionListWithContainers) => {
        const nextPath = buildEnumerationPath(enumeration.id)
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
        tabValue: 'treeEntities' | 'objectCollections' | 'valueGroups' | 'optionLists' | 'settings'
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
        if (tabValue === 'objectCollections') {
            const nextPath = buildHubPath('objectCollections')
            if (nextPath) {
                navigate(nextPath)
            }
            return
        }
        if (tabValue === 'valueGroups') {
            const nextPath = buildHubPath('valueGroups')
            if (nextPath) {
                navigate(nextPath)
            }
            return
        }
        const nextPath = buildHubPath('optionLists')
        if (nextPath) {
            navigate(nextPath)
        }
    }

    // Transform OptionListEntity data for display - use hub-aware version for global mode
    const getEnumerationCardData = (enumeration: OptionListWithContainers): OptionListWithContainersDisplay =>
        toOptionListWithContainersDisplay(enumeration, i18n.language)

    const handleSortableDragEnd = async (event: DragEndEvent) => {
        if (!metahubId) return
        const { active, over } = event
        if (!over || active.id === over.id) return

        const overEnumeration = sortedOptionLists.find((enumeration) => enumeration.id === String(over.id))
        if (!overEnumeration) return

        try {
            await reorderOptionListMutation.mutateAsync({
                metahubId,
                treeEntityId,
                optionListId: String(active.id),
                kindKey,
                newSortOrder: overEnumeration.sortOrder ?? 1
            })
            enqueueSnackbar(t('enumerations.reorderSuccess', 'OptionListEntity order updated'), { variant: 'success' })
        } catch (error: unknown) {
            const message =
                typeof error === 'object' &&
                error !== null &&
                'message' in error &&
                typeof (error as { message?: unknown }).message === 'string'
                    ? (error as { message: string }).message
                    : t('enumerations.reorderError', 'Failed to reorder enumeration')
            enqueueSnackbar(message, { variant: 'error' })
        }
    }

    const renderDragOverlay = (activeId: string | null) => {
        if (!activeId) return null
        const enumeration = enumerationMap.get(activeId)
        if (!enumeration) return null
        const display = getEnumerationCardData(enumeration)
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
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{display.name || display.codename || enumeration.id}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{display.codename || '—'}</Typography>
                </Stack>
            </Box>
        )
    }

    const showAttachExistingAction = isHubScoped && allowAttachExistingEntities
    const hasAttachableExistingOptionLists = attachableExistingOptionLists.length > 0

    return (
        <MainCard
            sx={{ maxWidth: '100%', width: '100%' }}
            contentSX={{ px: 0, py: 0 }}
            disableContentPadding
            disableHeader
            border={false}
            shadow={false}
        >
            <ExistingCodenamesProvider entities={existingEnumerationCodenames}>
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
                            searchPlaceholder={t('enumerations.searchPlaceholder')}
                            onSearchChange={handleSearchChange}
                            title={isHubScoped ? t('enumerations.title') : t('enumerations.allTitle')}
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
                                    showAttachExistingAction && hasAttachableExistingOptionLists
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
                                    value='optionLists'
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
                                    <Tab value='objectCollections' label={t('objects.title')} />
                                    <Tab value='valueGroups' label={t('sets.title')} />
                                    <Tab value='optionLists' label={t('enumerations.title')} />
                                    <Tab value='settings' label={t('settings.title')} />
                                </Tabs>
                            </Box>
                        )}

                        <Box sx={{ mt: isHubScoped ? 2 : 0 }}>
                            {isLoading && sortedOptionLists.length === 0 ? (
                                view === 'card' ? (
                                    <SkeletonGrid insetMode='content' />
                                ) : (
                                    <Skeleton variant='rectangular' height={120} />
                                )
                            ) : !isLoading && sortedOptionLists.length === 0 ? (
                                <EmptyListState
                                    image={APIEmptySVG}
                                    imageAlt='No optionLists'
                                    title={searchValue ? t('enumerations.noSearchResults') : t('enumerations.empty')}
                                    description={searchValue ? t('enumerations.noSearchResultsHint') : t('enumerations.emptyDescription')}
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
                                            {sortedOptionLists.map((enumeration: OptionListWithContainers) => {
                                                const descriptors = [...filteredOptionListActions]
                                                const displayData = getEnumerationCardData(enumeration)

                                                return (
                                                    <ItemCard
                                                        key={enumeration.id}
                                                        data={displayData}
                                                        images={images[enumeration.id] || []}
                                                        onClick={() => goToEnumeration(enumeration)}
                                                        pending={isPendingEntity(enumeration)}
                                                        pendingAction={getPendingAction(enumeration)}
                                                        onPendingInteractionAttempt={() =>
                                                            handlePendingEnumerationInteraction(enumeration.id)
                                                        }
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
                                                                {typeof enumeration.optionValuesCount === 'number' && (
                                                                    <Typography variant='caption' color='text.secondary'>
                                                                        {t('enumerations.valuesCount', {
                                                                            count: enumeration.optionValuesCount
                                                                        })}
                                                                    </Typography>
                                                                )}
                                                            </Stack>
                                                        }
                                                        headerAction={
                                                            descriptors.length > 0 ? (
                                                                <Box onClick={(e) => e.stopPropagation()}>
                                                                    <BaseEntityMenu<
                                                                        OptionListDisplayWithContainer,
                                                                        OptionListLocalizedPayload
                                                                    >
                                                                        entity={displayData}
                                                                        entityKind='enumeration'
                                                                        descriptors={descriptors}
                                                                        namespace='metahubs'
                                                                        i18nInstance={i18n}
                                                                        createContext={createOptionListContext}
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
                                                data={sortedOptionLists.map(getEnumerationCardData)}
                                                images={images}
                                                isLoading={isLoading}
                                                sortableRows
                                                sortableItemIds={sortedOptionLists.map((enumeration) => enumeration.id)}
                                                dragHandleAriaLabel={t('enumerations.dnd.dragHandle', 'Drag to reorder')}
                                                dragDisabled={reorderOptionListMutation.isPending || isLoading}
                                                onSortableDragEnd={handleSortableDragEnd}
                                                renderDragOverlay={renderDragOverlay}
                                                getRowLink={(row: OptionListWithContainersDisplay) =>
                                                    row?.id ? buildEnumerationPath(row.id) || undefined : undefined
                                                }
                                                onPendingInteractionAttempt={(row: OptionListWithContainersDisplay) =>
                                                    handlePendingEnumerationInteraction(row.id)
                                                }
                                                customColumns={enumerationColumns}
                                                i18nNamespace='flowList'
                                                renderActions={(row: OptionListWithContainersDisplay) => {
                                                    const originalEnumeration = enumerationMap.get(row.id)
                                                    if (!originalEnumeration) return null

                                                    const descriptors = [...filteredOptionListActions]
                                                    if (!descriptors.length) return null

                                                    return (
                                                        <BaseEntityMenu<OptionListDisplayWithContainer, OptionListLocalizedPayload>
                                                            entity={getEnumerationCardData(originalEnumeration)}
                                                            entityKind='enumeration'
                                                            descriptors={descriptors}
                                                            namespace='metahubs'
                                                            menuButtonLabelKey='flowList:menu.button'
                                                            i18nInstance={i18n}
                                                            createContext={createOptionListContext}
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
                        {!isLoading && sortedOptionLists.length > 0 && (
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
                    title={t('enumerations.createDialog.title', 'Create OptionListEntity')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={tc('actions.create', 'Create')}
                    savingButtonText={tc('actions.creating', 'Creating...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onClose={handleDialogClose}
                    onSave={handleCreateOptionList}
                    hideDefaultFields
                    initialExtraValues={localizedFormDefaults}
                    tabs={buildFormTabs}
                    validate={validateOptionListForm}
                    canSave={canSaveOptionListForm}
                />

                <EntityFormDialog
                    open={isAttachDialogOpen}
                    title={t('enumerations.attachExisting.dialogTitle', 'Add Existing OptionLists')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={t('common:actions.add', 'Add')}
                    savingButtonText={t('common:actions.saving', 'Saving...')}
                    cancelButtonText={t('common:actions.cancel', 'Cancel')}
                    loading={isAttachingExisting}
                    error={attachDialogError || undefined}
                    onClose={handleCloseAttachExistingDialog}
                    onSave={handleAttachExistingOptionLists}
                    hideDefaultFields
                    initialExtraValues={{ selectedOptionListIds: [] }}
                    tabs={({ values, setValue, isLoading, errors }) => {
                        const selectedOptionListIds = Array.isArray(values.selectedOptionListIds)
                            ? values.selectedOptionListIds.filter((id): id is string => typeof id === 'string')
                            : []
                        return [
                            {
                                id: 'optionLists',
                                label: t('enumerations.title', 'OptionLists'),
                                content: (
                                    <EntitySelectionPanel<OptionListWithContainers>
                                        availableEntities={attachableExistingOptionLists}
                                        selectedIds={selectedOptionListIds}
                                        onSelectionChange={(ids) => setValue('selectedOptionListIds', ids)}
                                        getDisplayName={(enumeration) =>
                                            getVLCString(enumeration.name, preferredVlcLocale) ||
                                            getVLCString(enumeration.name, 'en') ||
                                            enumeration.codename ||
                                            '—'
                                        }
                                        getCodename={(enumeration) => enumeration.codename}
                                        labels={attachExistingEnumerationSelectionLabels}
                                        disabled={isLoading}
                                        error={errors.selectedOptionListIds}
                                    />
                                )
                            }
                        ]
                    }}
                    validate={(values) => {
                        const selectedOptionListIds = Array.isArray(values.selectedOptionListIds)
                            ? values.selectedOptionListIds.filter((id): id is string => typeof id === 'string')
                            : []
                        if (selectedOptionListIds.length > 0) return null
                        return {
                            selectedOptionListIds: t(
                                'enumerations.attachExisting.requiredSelection',
                                'Select at least one enumeration to add.'
                            )
                        }
                    }}
                    canSave={(values) => {
                        const selectedOptionListIds = Array.isArray(values.selectedOptionListIds)
                            ? values.selectedOptionListIds.filter((id): id is string => typeof id === 'string')
                            : []
                        return !isAttachingExisting && selectedOptionListIds.length > 0
                    }}
                />

                {/* Independent ConfirmDeleteDialog */}
                <ConfirmDeleteDialog
                    open={dialogs.delete.open}
                    title={t('enumerations.deleteDialog.title')}
                    description={t('enumerations.deleteDialog.message')}
                    confirmButtonText={tc('actions.delete', 'Delete')}
                    deletingButtonText={tc('actions.deleting', 'Deleting...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onCancel={() => close('delete')}
                    onConfirm={() => {
                        if (!dialogs.delete.item || !metahubId) return

                        const deletingOptionListId = dialogs.delete.item.id
                        const targetTreeEntityId = isHubScoped ? treeEntityId! : dialogs.delete.item.treeEntities?.[0]?.id || ''
                        deleteOptionListMutation.mutate(
                            {
                                metahubId,
                                treeEntityId: targetTreeEntityId,
                                optionListId: deletingOptionListId,
                                kindKey,
                                force: !isHubScoped
                            },
                            {
                                onSuccess: () => {
                                    queryClient.removeQueries({
                                        queryKey: metahubsQueryKeys.blockingOptionListReferences(metahubId, deletingOptionListId, kindKey)
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
                                            : t('enumerations.deleteError')
                                    enqueueSnackbar(message, { variant: 'error' })
                                }
                            }
                        )
                    }}
                />

                <OptionListDeleteDialog
                    open={blockingDeleteDialogState.open}
                    enumeration={blockingDeleteDialogState.entity}
                    metahubId={metahubId}
                    onClose={closeBlockingDelete}
                    onConfirm={(enumeration) => {
                        const targetTreeEntityId = isHubScoped ? treeEntityId : enumeration.treeEntities?.[0]?.id
                        deleteOptionListMutation.mutate(
                            {
                                metahubId,
                                treeEntityId: targetTreeEntityId,
                                optionListId: enumeration.id,
                                kindKey,
                                force: !isHubScoped
                            },
                            {
                                onSuccess: () => {
                                    queryClient.removeQueries({
                                        queryKey: metahubsQueryKeys.blockingOptionListReferences(metahubId, enumeration.id, kindKey)
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
                                            : t('enumerations.deleteError')
                                    enqueueSnackbar(message, { variant: 'error' })
                                }
                            }
                        )
                    }}
                    isDeleting={deleteOptionListMutation.isPending}
                    uiLocale={i18n.language}
                />

                {/* Conflict Resolution Dialog for optimistic locking */}
                <ConflictResolutionDialog
                    open={dialogs.conflict.open}
                    conflict={(dialogs.conflict.data as { conflict?: ConflictInfo })?.conflict ?? null}
                    onOverwrite={async () => {
                        const conflictData = dialogs.conflict.data as {
                            conflict?: ConflictInfo
                            pendingData?: OptionListLocalizedPayload
                            optionListId?: string
                        } | null
                        if (!metahubId || !conflictData?.optionListId || !conflictData?.pendingData) return
                        try {
                            const enumeration = enumerationMap.get(conflictData.optionListId)
                            const targetTreeEntityId = isHubScoped ? treeEntityId! : enumeration?.treeEntities?.[0]?.id
                            // Retry without expectedVersion to force overwrite
                            if (targetTreeEntityId) {
                                await updateOptionListMutation.mutateAsync({
                                    metahubId,
                                    treeEntityId: targetTreeEntityId,
                                    optionListId: conflictData.optionListId,
                                    kindKey,
                                    data: conflictData.pendingData
                                })
                            } else {
                                await updateOptionListAtMetahubMutation.mutateAsync({
                                    metahubId,
                                    optionListId: conflictData.optionListId,
                                    kindKey,
                                    data: conflictData.pendingData
                                })
                            }
                            close('conflict')
                            enqueueSnackbar(t('enumerations.updateSuccess', 'OptionListEntity updated'), { variant: 'success' })
                        } catch (e) {
                            console.error('Failed to overwrite enumeration', e)
                            enqueueSnackbar(t('enumerations.updateError', 'Failed to update enumeration'), { variant: 'error' })
                        }
                    }}
                    onReload={async () => {
                        // Reload the list to get latest data
                        if (metahubId) {
                            if (isHubScoped && treeEntityId) {
                                await invalidateOptionListsQueries.all(queryClient, metahubId, treeEntityId)
                            } else {
                                await queryClient.invalidateQueries({
                                    queryKey: metahubsQueryKeys.allOptionListsScope(metahubId, kindKey)
                                })
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

const OptionListList = () => <OptionListContent />

export default OptionListList
