import { useState, useMemo, useCallback, useEffect } from 'react'
import { useLocation, useNavigate, Link, useParams } from 'react-router-dom'
import { Box, ButtonBase, Chip, Divider, Skeleton, Stack, Tab, Tabs, Typography } from '@mui/material'
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
    LocalizedInlineField,
    useCodenameAutoFillVlc,
    EntitySelectionPanel,
    revealPendingEntityFeedback
} from '@universo/template-mui'
import type { EntitySelectionLabels } from '@universo/template-mui'
import type { DragEndEvent } from '@universo/template-mui'
import { EntityFormDialog, ConflictResolutionDialog } from '@universo/template-mui/components/dialogs'
import type { TabConfig } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'
import { isEnabledComponentConfig, type VersionedLocalizedContent } from '@universo/types'

import {
    useCreateTreeEntity,
    useUpdateTreeEntity,
    useDeleteTreeEntity,
    useCopyTreeEntity,
    useReorderTreeEntity
} from '../hooks/treeEntityMutations'
import { useTreeEntityListData } from '../hooks/useTreeEntityListData'
import { useStandardEntityListState, createEntityCopyCallback } from '../hooks/useStandardEntityListState'
import { useEntityTypesQuery } from '../../hooks'
import type { MetahubEntityType } from '../../api'
import { STORAGE_KEYS } from '../../../../view-preferences/storage'
import * as hubsApi from '../api/trees'
import { invalidateTreeEntitiesQueries, metahubsQueryKeys } from '../../../shared'
import { TreeEntity, TreeEntityDisplay, TreeEntityLocalizedPayload, getVLCString, toTreeEntityDisplay } from '../../../../types'
import { isOptimisticLockConflict, extractConflictInfo, isPendingEntity, getPendingAction, type ConflictInfo } from '@universo/utils'
import { sanitizeCodenameForStyle, normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../../utils/codename'
import { useCodenameConfig } from '../../../settings/hooks/useCodenameConfig'
import { ensureLocalizedContent, extractLocalizedInput, hasPrimaryContent } from '../../../../utils/localizedInput'
import { CodenameField, TreeDeleteDialog, ExistingCodenamesProvider, ContainerParentSelectionPanel } from '../../../../components'
import treeEntityActions, {
    buildInitialValues as buildTreeEntityInitialValues,
    buildFormTabs as buildTreeEntityFormTabs,
    validateTreeEntityForm,
    canSaveTreeEntityForm,
    toPayload as toTreeEntityPayload
} from './TreeEntityActions'
import {
    type TreeEntityFormValues,
    type TreeEntityMenuBaseContext,
    type ConfirmSpec,
    DIALOG_SAVE_CANCEL,
    extractResponseStatus,
    extractResponseMessage
} from './treeEntityListUtils'
import { useMetahubPrimaryLocale } from '../../../settings/hooks/useMetahubPrimaryLocale'

type GenericFormValues = Record<string, unknown>
type HubScopedTab = {
    kindKey: string
    label: string
}

type TreeEntityFormFieldsProps = {
    values: GenericFormValues
    setValue: (name: string, value: unknown) => void
    isLoading: boolean
    errors: Record<string, string>
    uiLocale: string
    nameLabel: string
    descriptionLabel: string
    codenameLabel: string
    codenameHelper: string
}

const TreeEntityFormFields = ({
    values,
    setValue,
    isLoading,
    errors,
    uiLocale,
    nameLabel,
    descriptionLabel,
    codenameLabel,
    codenameHelper
}: TreeEntityFormFieldsProps) => {
    const codenameConfig = useCodenameConfig()
    const nameVlc = (values.nameVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const descriptionVlc = (values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const codename = (values.codename as VersionedLocalizedContent<string> | null | undefined) ?? null
    const codenameTouched = Boolean(values.codenameTouched)
    useCodenameAutoFillVlc({
        codename,
        codenameTouched,
        nameVlc,
        deriveCodename: (nameContent) =>
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
                label={nameLabel}
                required
                disabled={isLoading}
                value={nameVlc}
                onChange={(next) => setValue('nameVlc', next)}
                error={errors.nameVlc || null}
                helperText={errors.nameVlc}
                uiLocale={uiLocale}
            />
            <LocalizedInlineField
                mode='localized'
                label={descriptionLabel}
                disabled={isLoading}
                value={descriptionVlc}
                onChange={(next) => setValue('descriptionVlc', next)}
                uiLocale={uiLocale}
                multiline
                rows={2}
            />
            <Divider />
            <CodenameField
                value={codename}
                onChange={(value) => setValue('codename', value)}
                touched={codenameTouched}
                onTouchedChange={(touched) => setValue('codenameTouched', touched)}
                onDuplicateStatusChange={(dup) => setValue('_hasCodenameDuplicate', dup)}
                uiLocale={uiLocale}
                label={codenameLabel}
                helperText={codenameHelper}
                error={errors.codename}
                disabled={isLoading}
                required
            />
        </Stack>
    )
}

export const TreeEntityListContent = () => {
    const codenameConfig = useCodenameConfig()
    const navigate = useNavigate()
    const { kindKey } = useParams<{ kindKey?: string }>()
    const location = useLocation()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()
    const preferredVlcLocale = useMetahubPrimaryLocale()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const hubKindKey = kindKey?.trim() || 'hub'

    const {
        metahubId,
        treeEntityId,
        isHubScoped,
        treeEntities,
        isLoading,
        error,
        paginationResult,
        handleSearchChange,
        sortedTreeEntities,
        images,
        hubMap,
        allTreeEntities,
        allTreeEntitiesById,
        attachableExistingTreeEntities,
        allowCopy,
        allowDelete,
        allowAttachExistingEntities,
        allowHubNesting
    } = useTreeEntityListData()
    const entityTypesQuery = useEntityTypesQuery(metahubId, {
        limit: 1000,
        offset: 0,
        sortBy: 'codename',
        sortOrder: 'asc'
    })
    const buildHubPath = useCallback(
        (nextTreeEntityId: string, targetKindKey = hubKindKey) => {
            const normalizedMetahubId = metahubId?.trim()
            const normalizedTreeEntityId = nextTreeEntityId.trim()
            const normalizedKindKey = targetKindKey.trim() || hubKindKey
            if (!normalizedMetahubId || !normalizedTreeEntityId) {
                return ''
            }

            return `/metahub/${normalizedMetahubId}/entities/${encodeURIComponent(
                normalizedKindKey
            )}/instance/${normalizedTreeEntityId}/instances`
        },
        [hubKindKey, metahubId]
    )
    const resolveEntityTypeTabLabel = useCallback(
        (entityType: MetahubEntityType | undefined, fallbackKey: string, fallbackLabel: string) => {
            if (!entityType) {
                return t(fallbackKey, fallbackLabel)
            }

            const presentationName = entityType.presentation?.name
            const localizedName = getVLCString(presentationName, preferredVlcLocale) || getVLCString(presentationName, i18n.language) || ''
            if (localizedName) {
                return localizedName
            }

            if (entityType.ui?.nameKey) {
                return t(entityType.ui.nameKey, { defaultValue: fallbackLabel })
            }

            return (
                getVLCString(entityType.codename, preferredVlcLocale) || getVLCString(entityType.codename, i18n.language) || fallbackLabel
            )
        },
        [i18n.language, preferredVlcLocale, t]
    )
    const hubScopedTabs = useMemo<HubScopedTab[]>(() => {
        const entityTypes = entityTypesQuery.data?.items ?? []
        const hubType = entityTypes.find((entityType) => entityType.kindKey === hubKindKey)
        const relatedTabs = entityTypes
            .filter((entityType) => entityType.kindKey !== hubKindKey && isEnabledComponentConfig(entityType.components?.treeAssignment))
            .sort((a, b) => {
                const byOrder = (a.ui?.sidebarOrder ?? 1000) - (b.ui?.sidebarOrder ?? 1000)
                return byOrder !== 0 ? byOrder : a.kindKey.localeCompare(b.kindKey)
            })
            .map((entityType) => ({
                kindKey: entityType.kindKey,
                label: resolveEntityTypeTabLabel(entityType, entityType.ui?.nameKey ?? 'entities.title', entityType.kindKey)
            }))

        return [
            {
                kindKey: hubKindKey,
                label: resolveEntityTypeTabLabel(hubType, 'hubs.title', 'Hubs')
            },
            ...relatedTabs,
            {
                kindKey: 'settings',
                label: t('settings.title')
            }
        ]
    }, [entityTypesQuery.data?.items, hubKindKey, resolveEntityTypeTabLabel, t])
    const hubScopedActiveTab = useMemo(() => {
        const routeTab = hubScopedTabs.some((tab) => tab.kindKey === hubKindKey) ? hubKindKey : hubScopedTabs[0]?.kindKey
        return routeTab ?? hubKindKey
    }, [hubKindKey, hubScopedTabs])

    const { dialogs, openCreate, openDelete, openConflict, close, view, setView, confirm } = useStandardEntityListState<TreeEntity>(
        STORAGE_KEYS.TREE_ENTITY_DISPLAY_STYLE
    )
    const [editDialogOpen, setEditDialogOpen] = useState(false)

    const [isAttachDialogOpen, setAttachDialogOpen] = useState(false)
    const [isAttachingExisting, setAttachingExisting] = useState(false)
    const [attachDialogError, setAttachDialogError] = useState<string | null>(null)
    const [pendingHubNavigation, setPendingHubNavigation] = useState<{ pendingId: string; codename: string } | null>(null)
    const pendingInteractionMessage = tc('pendingCreateBlocked', 'This item is still being created. Please wait a moment and try again.')

    const handlePendingHubInteraction = useCallback(
        (pendingTreeEntityId: string) => {
            if (!metahubId) return
            const pendingHub = treeEntities.find((hub) => hub.id === pendingTreeEntityId)
            if (pendingHub?.codename) {
                setPendingHubNavigation({ pendingId: pendingHub.id, codename: pendingHub.codename })
            }
            revealPendingEntityFeedback({
                queryClient,
                queryKeyPrefix:
                    isHubScoped && treeEntityId
                        ? metahubsQueryKeys.childTreeEntities(metahubId, treeEntityId, kindKey)
                        : metahubsQueryKeys.treeEntitiesScope(metahubId, kindKey),
                entityId: pendingTreeEntityId,
                extraQueryKeys: [metahubsQueryKeys.treeEntityDetail(metahubId, pendingTreeEntityId, kindKey)]
            })
            enqueueSnackbar(pendingInteractionMessage, { variant: 'info' })
        },
        [enqueueSnackbar, treeEntityId, treeEntities, isHubScoped, kindKey, metahubId, pendingInteractionMessage, queryClient]
    )

    const filteredTreeEntityActions = useMemo(
        () =>
            treeEntityActions.filter((a) => {
                if (a.id === 'copy' && !allowCopy) return false
                if (a.id === 'delete' && !allowDelete) return false
                return true
            }),
        [allowCopy, allowDelete]
    )

    const createTreeEntityMutation = useCreateTreeEntity()
    const updateTreeEntityMutation = useUpdateTreeEntity()
    const deleteTreeEntityMutation = useDeleteTreeEntity()
    const copyTreeEntityMutation = useCopyTreeEntity()
    const reorderTreeEntityMutation = useReorderTreeEntity()

    useEffect(() => {
        if (!pendingHubNavigation || !metahubId) return

        if (sortedTreeEntities.some((hub) => hub.id === pendingHubNavigation.pendingId)) {
            return
        }

        const resolvedHub = sortedTreeEntities.find((hub) => !isPendingEntity(hub) && hub.codename === pendingHubNavigation.codename)

        if (!resolvedHub) return

        setPendingHubNavigation(null)
        const nextPath = buildHubPath(resolvedHub.id)
        if (nextPath) {
            navigate(nextPath)
        }
    }, [buildHubPath, metahubId, navigate, pendingHubNavigation, sortedTreeEntities])

    useEffect(() => {
        const state = location.state as { openHubSettings?: boolean } | null
        if (!isHubScoped || !state?.openHubSettings) return

        setEditDialogOpen(true)
        navigate(location.pathname, { replace: true, state: null })
    }, [isHubScoped, location.pathname, location.state, navigate])

    const attachExistingHubSelectionLabels = useMemo<EntitySelectionLabels>(
        () => ({
            title: t('hubs.attachExisting.selectionTitle', 'TreeEntities'),
            addButton: t('common:actions.add', 'Add'),
            dialogTitle: t('hubs.attachExisting.selectDialogTitle', 'Select treeEntities'),
            emptyMessage: t('hubs.attachExisting.emptySelection', 'No treeEntities selected'),
            noAvailableMessage: t('hubs.attachExisting.noAvailable', 'No treeEntities available to add'),
            searchPlaceholder: t('common:search', 'Search...'),
            cancelButton: t('common:actions.cancel', 'Cancel'),
            confirmButton: t('common:actions.add', 'Add'),
            removeTitle: t('common:actions.remove', 'Remove'),
            nameHeader: t('table.name', 'Name'),
            codenameHeader: t('common:fields.codename', 'Codename')
        }),
        [t]
    )

    const localizedFormDefaults = useMemo<TreeEntityFormValues>(
        () => ({
            nameVlc: null,
            descriptionVlc: null,
            codename: null,
            codenameTouched: false,
            parentTreeEntityId: allowHubNesting && isHubScoped ? treeEntityId ?? null : null
        }),
        [allowHubNesting, treeEntityId, isHubScoped]
    )

    const validateCreateTreeEntityForm = useCallback(
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
                errors.codename = t('hubs.validation.codenameRequired', 'Codename is required')
            } else if (
                !isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            ) {
                errors.codename = t('hubs.validation.codenameInvalid', 'Codename contains invalid characters')
            }
            return Object.keys(errors).length > 0 ? errors : null
        },
        [codenameConfig.allowMixed, codenameConfig.alphabet, codenameConfig.style, t, tc]
    )

    const canSaveCreateTreeEntityForm = useCallback(
        (values: GenericFormValues) => {
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
            const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? 'en'
            const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
            const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
            return (
                !values._hasCodenameDuplicate &&
                hasPrimaryContent(nameVlc) &&
                Boolean(normalizedCodename) &&
                isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            )
        },
        [codenameConfig.allowMixed, codenameConfig.alphabet, codenameConfig.style]
    )

    const buildFormTabs = useCallback(
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
            const parentTreeEntityId = typeof values.parentTreeEntityId === 'string' ? values.parentTreeEntityId : null

            const tabs: TabConfig[] = [
                {
                    id: 'general',
                    label: t('hubs.tabs.general', 'General'),
                    content: (
                        <TreeEntityFormFields
                            values={values}
                            setValue={setValue}
                            isLoading={isLoading}
                            errors={fieldErrors}
                            uiLocale={preferredVlcLocale}
                            nameLabel={tc('fields.name', 'Name')}
                            descriptionLabel={tc('fields.description', 'Description')}
                            codenameLabel={t('hubs.codename', 'Codename')}
                            codenameHelper={t('hubs.codenameHelper', 'Unique identifier')}
                        />
                    )
                }
            ]
            if (!allowHubNesting) {
                return tabs
            }

            tabs.push({
                id: 'treeEntities',
                label: t('hubs.tabs.treeEntities', 'TreeEntities'),
                content: (
                    <ContainerParentSelectionPanel
                        availableContainers={allTreeEntities}
                        parentContainerId={parentTreeEntityId}
                        onParentContainerChange={(nextParentTreeEntityId) => setValue('parentTreeEntityId', nextParentTreeEntityId)}
                        disabled={isLoading}
                        error={fieldErrors.parentTreeEntityId}
                        uiLocale={preferredVlcLocale}
                        currentContainerId={treeEntityId ?? null}
                    />
                )
            })

            return tabs
        },
        [allowHubNesting, preferredVlcLocale, t, tc, allTreeEntities, treeEntityId]
    )

    const getDirectParentHub = useCallback(
        (hubLike: TreeEntity | TreeEntityDisplay): { id: string; name: string; codename: string } | null => {
            const parentId = typeof hubLike.parentTreeEntityId === 'string' ? hubLike.parentTreeEntityId : null
            if (!parentId) return null
            const parent = allTreeEntitiesById.get(parentId)
            if (!parent) return null
            return {
                id: parent.id,
                name: getVLCString(parent.name, i18n.language) || getVLCString(parent.name, 'en') || parent.codename || '—',
                codename: parent.codename || ''
            }
        },
        [allTreeEntitiesById, i18n.language]
    )

    const hubColumns = useMemo(() => {
        const columns = [
            {
                id: 'sortOrder',
                label: t('fieldDefinitions.table.order', '#'),
                width: '4%',
                align: 'center' as const,
                sortable: true,
                sortAccessor: (row: TreeEntityDisplay) => row.sortOrder ?? 0,
                render: (row: TreeEntityDisplay) => (
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                        {typeof row.sortOrder === 'number' ? row.sortOrder : '—'}
                    </Typography>
                )
            },
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: isHubScoped ? '25%' : '22%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: TreeEntityDisplay) => row.name?.toLowerCase() ?? '',
                render: (row: TreeEntityDisplay) =>
                    isPendingEntity(row) ? (
                        <ButtonBase
                            onClick={() => handlePendingHubInteraction(row.id)}
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
                        <Link to={buildHubPath(row.id)} style={{ textDecoration: 'none', color: 'inherit' }}>
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
            },
            {
                id: 'description',
                label: tc('table.description', 'Description'),
                width: isHubScoped ? '30%' : '24%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: TreeEntityDisplay) => row.description?.toLowerCase() ?? '',
                render: (row: TreeEntityDisplay) => (
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
                label: t('hubs.codename', 'Codename'),
                width: isHubScoped ? '15%' : '14%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: TreeEntityDisplay) => row.codename?.toLowerCase() ?? '',
                render: (row: TreeEntityDisplay) => (
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

        if (!isHubScoped) {
            columns.push({
                id: 'treeEntities',
                label: t('hubs.title', 'TreeEntities'),
                width: '18%',
                align: 'left' as const,
                render: (row: TreeEntityDisplay) => {
                    const parentHub = getDirectParentHub(row)
                    if (!parentHub) {
                        return (
                            <Typography variant='body2' color='text.secondary'>
                                —
                            </Typography>
                        )
                    }

                    return isPendingEntity(row) ? (
                        <Chip
                            label={parentHub.name}
                            size='small'
                            variant='outlined'
                            clickable
                            onClick={() => handlePendingHubInteraction(row.id)}
                            sx={{
                                maxWidth: '100%',
                                '&:hover': {
                                    backgroundColor: 'action.hover'
                                }
                            }}
                        />
                    ) : (
                        <Link to={buildHubPath(parentHub.id)} style={{ textDecoration: 'none', color: 'inherit' }}>
                            <Chip
                                label={parentHub.name}
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
                }
            })
        }

        columns.push({
            id: 'itemsCount',
            label: t('hubs.itemsTitle', 'Items'),
            width: '10%',
            align: 'center' as const,
            render: (row: TreeEntityDisplay) => {
                const itemsCount = typeof row.itemsCount === 'number' ? row.itemsCount : row.linkedCollectionsCount
                return typeof itemsCount === 'number' ? itemsCount : '—'
            }
        })

        return columns
    }, [buildHubPath, getDirectParentHub, handlePendingHubInteraction, isHubScoped, t, tc])

    const createTreeEntityContext = useCallback(
        (baseContext: TreeEntityMenuBaseContext) => ({
            ...baseContext,
            hubMap,
            treeEntities: allTreeEntities,
            metahubId,
            currentTreeEntityId: isHubScoped ? treeEntityId ?? null : null,
            allowHubNesting,
            uiLocale: preferredVlcLocale,
            api: {
                updateEntity: (id: string, patch: TreeEntityLocalizedPayload) => {
                    if (!metahubId) return Promise.resolve()
                    const rawCodename = getVLCString(patch.codename, patch.codename?._primary ?? 'en')
                    const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
                    if (!normalizedCodename) {
                        throw new Error(t('hubs.validation.codenameRequired', 'Codename is required'))
                    }
                    const codenamePayload = ensureLocalizedContent(patch.codename, patch.codename?._primary ?? 'en', normalizedCodename)
                    const hub = hubMap.get(id)
                    const expectedVersion = hub?.version
                    updateTreeEntityMutation.mutate(
                        {
                            metahubId,
                            treeEntityId: id,
                            kindKey,
                            data: { ...patch, codename: codenamePayload, expectedVersion }
                        },
                        {
                            onError: (error: unknown) => {
                                if (isOptimisticLockConflict(error)) {
                                    const conflict = extractConflictInfo(error)
                                    if (conflict) {
                                        openConflict({
                                            conflict,
                                            pendingUpdate: { id, patch: { ...patch, codename: codenamePayload } }
                                        })
                                    }
                                }
                            }
                        }
                    )

                    return Promise.resolve()
                },
                deleteEntity: (id: string) => {
                    if (!metahubId) return
                    return deleteTreeEntityMutation.mutateAsync({ metahubId, treeEntityId: id, kindKey })
                },
                copyEntity: createEntityCopyCallback<TreeEntityLocalizedPayload & Record<string, unknown>>({
                    metahubId,
                    mutation: copyTreeEntityMutation,
                    entityIdKey: 'treeEntityId',
                    kindKey
                })
            },
            helpers: {
                refreshList: () => {
                    if (metahubId) {
                        void invalidateTreeEntitiesQueries.all(queryClient, metahubId)
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
                openDeleteDialog: (hubOrDisplay: TreeEntity | TreeEntityDisplay) => {
                    // Handle both TreeEntity and TreeEntityDisplay (from BaseEntityMenu context)
                    const hub = 'metahubId' in hubOrDisplay ? hubOrDisplay : hubMap.get(hubOrDisplay.id)
                    if (hub) {
                        openDelete(hub)
                    }
                }
            }
        }),
        [
            codenameConfig.alphabet,
            codenameConfig.style,
            confirm,
            copyTreeEntityMutation,
            deleteTreeEntityMutation,
            enqueueSnackbar,
            hubMap,
            treeEntityId,
            kindKey,
            metahubId,
            openConflict,
            openDelete,
            preferredVlcLocale,
            queryClient,
            allTreeEntities,
            allowHubNesting,
            isHubScoped,
            t,
            updateTreeEntityMutation
        ]
    )

    // Validate metahubId from URL AFTER all hooks
    if (!metahubId) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Invalid metahub'
                title={t('metahubs:errors.invalidMetahub')}
                description={t('metahubs:errors.pleaseSelectMetahub')}
            />
        )
    }

    const handleAddNew = () => {
        if (!canCreateInCurrentHub) return
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

    const handleAttachExistingTreeEntities = async (data: GenericFormValues) => {
        if (!metahubId || !treeEntityId) return

        const selectedTreeEntityIds = Array.isArray(data.selectedTreeEntityIds)
            ? data.selectedTreeEntityIds.filter((id): id is string => typeof id === 'string')
            : []
        if (selectedTreeEntityIds.length === 0) {
            return
        }

        setAttachDialogError(null)
        setAttachingExisting(true)
        try {
            const selectedTreeEntities = selectedTreeEntityIds
                .map((id) => allTreeEntitiesById.get(id))
                .filter((hub): hub is TreeEntity => Boolean(hub))
            const failed: string[] = []

            for (const targetHub of selectedTreeEntities) {
                try {
                    await hubsApi.updateTreeEntity(metahubId, targetHub.id, {
                        parentTreeEntityId: treeEntityId,
                        expectedVersion: targetHub.version
                    })
                } catch (error) {
                    failed.push(
                        getVLCString(targetHub.name, preferredVlcLocale) || getVLCString(targetHub.name, 'en') || targetHub.codename
                    )
                    // eslint-disable-next-line no-console
                    console.error('Failed to attach existing hub to current hub', error)
                }
            }

            await invalidateTreeEntitiesQueries.all(queryClient, metahubId)

            if (failed.length === 0) {
                enqueueSnackbar(
                    t('hubs.attachExisting.success', {
                        count: selectedTreeEntities.length,
                        defaultValue: 'Added {{count}} hub(s).'
                    }),
                    {
                        variant: 'success'
                    }
                )
                setAttachDialogOpen(false)
                return
            }

            const successCount = selectedTreeEntities.length - failed.length
            if (successCount > 0) {
                enqueueSnackbar(
                    t('hubs.attachExisting.partialSuccess', {
                        successCount,
                        failCount: failed.length,
                        defaultValue: 'Added {{successCount}} hub(s). {{failCount}} hub(s) could not be linked.'
                    }),
                    { variant: 'warning' }
                )
                setAttachDialogOpen(false)
                return
            }

            setAttachDialogError(
                t('hubs.attachExisting.failedAll', {
                    defaultValue:
                        'Selected treeEntities could not be linked to this hub. Please review parent/child constraints and try again.'
                })
            )
        } finally {
            setAttachingExisting(false)
        }
    }

    const handleCreateTreeEntity = async (data: GenericFormValues) => {
        // Validation is handled by EntityFormDialog's validate/canSave props.
        const nameVlc = data.nameVlc as VersionedLocalizedContent<string> | null | undefined
        const descriptionVlc = data.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
        const codenameValue = data.codename as VersionedLocalizedContent<string> | null | undefined
        const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
        const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)
        const codenamePrimaryLocale = codenameValue?._primary ?? namePrimaryLocale ?? 'en'
        const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
        const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
        const codenamePayload = ensureLocalizedContent(codenameValue, namePrimaryLocale ?? codenamePrimaryLocale, normalizedCodename || '')
        const parentTreeEntityId = typeof data.parentTreeEntityId === 'string' ? data.parentTreeEntityId : null

        // Confirm dialog for detached hub (async — throws DIALOG_SAVE_CANCEL if cancelled)
        if (isHubScoped && treeEntityId && parentTreeEntityId !== treeEntityId) {
            const confirmed = await confirm({
                title: t('hubs.detachedConfirm.title', 'Create hub outside current hub?'),
                description: t(
                    'hubs.detachedConfirm.description',
                    'This hub is not linked as a child of the current hub and will not appear in this hub after creation.'
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
        createTreeEntityMutation.mutate({
            metahubId,
            kindKey,
            data: {
                codename: codenamePayload,
                name: nameInput ?? {},
                description: descriptionInput,
                namePrimaryLocale: namePrimaryLocale ?? '',
                descriptionPrimaryLocale,
                parentTreeEntityId
            }
        })
    }

    const goToHub = (hub: TreeEntity) => {
        const nextPath = buildHubPath(hub.id)
        if (nextPath) {
            navigate(nextPath)
        }
    }

    const handleChange = (_event: unknown, nextView: string | null) => {
        if (nextView === null) return
        setView(nextView as 'card' | 'table')
    }

    const handleHubTabChange = (_event: unknown, tabValue: string) => {
        if (!metahubId || !treeEntityId) return
        if (tabValue === 'settings') {
            setEditDialogOpen(true)
            return
        }
        const nextPath = buildHubPath(treeEntityId, tabValue)
        if (nextPath) {
            navigate(nextPath)
        }
    }

    const handleSortableDragEnd = async (event: DragEndEvent) => {
        if (!metahubId) return
        const { active, over } = event
        if (!over || active.id === over.id) return

        const overHub = sortedTreeEntities.find((hub) => hub.id === String(over.id))
        if (!overHub) return

        try {
            await reorderTreeEntityMutation.mutateAsync({
                metahubId,
                treeEntityId: String(active.id),
                kindKey,
                newSortOrder: overHub.sortOrder ?? 1
            })
            enqueueSnackbar(t('hubs.reorderSuccess', 'TreeEntity order updated'), { variant: 'success' })
        } catch (error: unknown) {
            const message =
                typeof error === 'object' &&
                error !== null &&
                'message' in error &&
                typeof (error as { message?: unknown }).message === 'string'
                    ? (error as { message: string }).message
                    : t('hubs.reorderError', 'Failed to reorder hub')
            enqueueSnackbar(message, { variant: 'error' })
        }
    }

    const renderDragOverlay = (activeId: string | null) => {
        if (!activeId) return null
        const hub = hubMap.get(activeId)
        if (!hub) return null
        const display = toTreeEntityDisplay(hub, i18n.language)
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
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{display.name || display.codename || hub.id}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{display.codename || '—'}</Typography>
                </Stack>
            </Box>
        )
    }

    // Transform TreeEntity data for display (ItemCard and FlowListTable expect string name)
    const getHubCardData = (hub: TreeEntity): TreeEntityDisplay => toTreeEntityDisplay(hub, i18n.language)
    const canCreateInCurrentHub = !isHubScoped || allowHubNesting
    const showAttachExistingAction = isHubScoped && allowHubNesting && allowAttachExistingEntities
    const hasAttachableExistingTreeEntities = attachableExistingTreeEntities.length > 0

    return (
        <MainCard
            sx={{ maxWidth: '100%', width: '100%' }}
            contentSX={{ px: 0, py: 0 }}
            disableContentPadding
            disableHeader
            border={false}
            shadow={false}
        >
            <ExistingCodenamesProvider entities={allTreeEntities}>
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
                            searchPlaceholder={t('hubs.searchPlaceholder')}
                            onSearchChange={handleSearchChange}
                            title={t('hubs.title')}
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
                                    startIcon: <AddRoundedIcon />,
                                    disabled: !canCreateInCurrentHub
                                }}
                                primaryActionMenuItems={
                                    showAttachExistingAction && hasAttachableExistingTreeEntities
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
                            <>
                                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                    <Tabs
                                        value={hubScopedActiveTab}
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
                                        {hubScopedTabs.map((tab) => (
                                            <Tab key={tab.kindKey} value={tab.kindKey} label={tab.label} />
                                        ))}
                                    </Tabs>
                                </Box>
                                {!allowHubNesting && (
                                    <Box sx={{ px: 2, pt: 1 }}>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t(
                                                'hubs.nestingDisabledHint',
                                                'TreeEntity nesting is disabled in settings. You can still edit and unlink existing parent relations.'
                                            )}
                                        </Typography>
                                    </Box>
                                )}
                            </>
                        )}

                        <Box sx={{ mt: isHubScoped ? 2 : 0 }}>
                            {isLoading && sortedTreeEntities.length === 0 ? (
                                view === 'card' ? (
                                    <SkeletonGrid insetMode='content' />
                                ) : (
                                    <Skeleton variant='rectangular' height={120} />
                                )
                            ) : !isLoading && sortedTreeEntities.length === 0 ? (
                                <EmptyListState
                                    image={APIEmptySVG}
                                    imageAlt='No treeEntities'
                                    title={t('hubs.empty')}
                                    description={t('hubs.emptyDescription')}
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
                                            {sortedTreeEntities.map((hub: TreeEntity) => {
                                                const descriptors = [...filteredTreeEntityActions]
                                                const parentHub = getDirectParentHub(hub)
                                                const itemsCount =
                                                    typeof hub.itemsCount === 'number' ? hub.itemsCount : hub.linkedCollectionsCount ?? 0
                                                const showItemsCount =
                                                    typeof hub.itemsCount === 'number' || typeof hub.linkedCollectionsCount === 'number'
                                                const showParentHubInfo = !isHubScoped && Boolean(parentHub)

                                                return (
                                                    <ItemCard
                                                        key={hub.id}
                                                        data={getHubCardData(hub)}
                                                        images={images[hub.id] || []}
                                                        onClick={() => goToHub(hub)}
                                                        pending={isPendingEntity(hub)}
                                                        pendingAction={getPendingAction(hub)}
                                                        onPendingInteractionAttempt={() => handlePendingHubInteraction(hub.id)}
                                                        footerEndContent={
                                                            showParentHubInfo || showItemsCount ? (
                                                                <Stack direction='row' spacing={1} alignItems='center'>
                                                                    {showParentHubInfo && (
                                                                        <Chip label={parentHub?.name} size='small' variant='outlined' />
                                                                    )}
                                                                    {showItemsCount && (
                                                                        <Typography variant='caption' color='text.secondary'>
                                                                            {t('hubs.itemsCount', { count: itemsCount })}
                                                                        </Typography>
                                                                    )}
                                                                </Stack>
                                                            ) : null
                                                        }
                                                        headerAction={
                                                            descriptors.length > 0 ? (
                                                                <Box onClick={(e) => e.stopPropagation()}>
                                                                    <BaseEntityMenu<TreeEntityDisplay, TreeEntityLocalizedPayload>
                                                                        entity={toTreeEntityDisplay(hub, i18n.language)}
                                                                        entityKind='hub'
                                                                        descriptors={descriptors}
                                                                        namespace='metahubs'
                                                                        i18nInstance={i18n}
                                                                        createContext={createTreeEntityContext}
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
                                                data={sortedTreeEntities.map(getHubCardData)}
                                                images={images}
                                                isLoading={isLoading}
                                                sortableRows
                                                sortableItemIds={sortedTreeEntities.map((hub) => hub.id)}
                                                dragHandleAriaLabel={t('hubs.dnd.dragHandle', 'Drag to reorder')}
                                                dragDisabled={reorderTreeEntityMutation.isPending || isLoading}
                                                onSortableDragEnd={handleSortableDragEnd}
                                                renderDragOverlay={renderDragOverlay}
                                                getRowLink={(row: TreeEntityDisplay) =>
                                                    row?.id ? buildHubPath(row.id) || undefined : undefined
                                                }
                                                onPendingInteractionAttempt={(row: TreeEntityDisplay) =>
                                                    handlePendingHubInteraction(row.id)
                                                }
                                                customColumns={hubColumns}
                                                i18nNamespace='flowList'
                                                renderActions={(row: TreeEntityDisplay) => {
                                                    const originalHub = hubMap.get(row.id)
                                                    if (!originalHub) return null

                                                    const descriptors = [...filteredTreeEntityActions]
                                                    if (!descriptors.length) return null

                                                    return (
                                                        <BaseEntityMenu<TreeEntityDisplay, TreeEntityLocalizedPayload>
                                                            entity={toTreeEntityDisplay(originalHub, i18n.language)}
                                                            entityKind='hub'
                                                            descriptors={descriptors}
                                                            namespace='metahubs'
                                                            menuButtonLabelKey='flowList:menu.button'
                                                            i18nInstance={i18n}
                                                            createContext={createTreeEntityContext}
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
                        {!isLoading && sortedTreeEntities.length > 0 && (
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
                    title={t('hubs.createDialog.title', 'Create TreeEntity')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={tc('actions.create', 'Create')}
                    savingButtonText={tc('actions.creating', 'Creating...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onClose={handleDialogClose}
                    onSave={handleCreateTreeEntity}
                    hideDefaultFields
                    initialExtraValues={localizedFormDefaults}
                    tabs={buildFormTabs}
                    validate={validateCreateTreeEntityForm}
                    canSave={canSaveCreateTreeEntityForm}
                />

                <EntityFormDialog
                    open={isAttachDialogOpen}
                    title={t('hubs.attachExisting.dialogTitle', 'Add Existing TreeEntities')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={t('common:actions.add', 'Add')}
                    savingButtonText={t('common:actions.saving', 'Saving...')}
                    cancelButtonText={t('common:actions.cancel', 'Cancel')}
                    loading={isAttachingExisting}
                    error={attachDialogError || undefined}
                    onClose={handleCloseAttachExistingDialog}
                    onSave={handleAttachExistingTreeEntities}
                    hideDefaultFields
                    initialExtraValues={{ selectedTreeEntityIds: [] }}
                    tabs={({ values, setValue, isLoading, errors }) => {
                        const selectedTreeEntityIds = Array.isArray(values.selectedTreeEntityIds)
                            ? values.selectedTreeEntityIds.filter((id): id is string => typeof id === 'string')
                            : []
                        return [
                            {
                                id: 'treeEntities',
                                label: t('hubs.tabs.treeEntities', 'TreeEntities'),
                                content: (
                                    <EntitySelectionPanel<TreeEntity>
                                        availableEntities={attachableExistingTreeEntities}
                                        selectedIds={selectedTreeEntityIds}
                                        onSelectionChange={(ids) => setValue('selectedTreeEntityIds', ids)}
                                        getDisplayName={(hub) =>
                                            getVLCString(hub.name, preferredVlcLocale) ||
                                            getVLCString(hub.name, 'en') ||
                                            hub.codename ||
                                            '—'
                                        }
                                        getCodename={(hub) => hub.codename}
                                        labels={attachExistingHubSelectionLabels}
                                        disabled={isLoading}
                                        error={errors.selectedTreeEntityIds}
                                    />
                                )
                            }
                        ]
                    }}
                    validate={(values) => {
                        const selectedTreeEntityIds = Array.isArray(values.selectedTreeEntityIds)
                            ? values.selectedTreeEntityIds.filter((id): id is string => typeof id === 'string')
                            : []
                        if (selectedTreeEntityIds.length > 0) return null
                        return {
                            selectedTreeEntityIds: t('hubs.attachExisting.requiredSelection', 'Select at least one hub to add.')
                        }
                    }}
                    canSave={(values) => {
                        const selectedTreeEntityIds = Array.isArray(values.selectedTreeEntityIds)
                            ? values.selectedTreeEntityIds.filter((id): id is string => typeof id === 'string')
                            : []
                        return !isAttachingExisting && selectedTreeEntityIds.length > 0
                    }}
                />

                {/* TreeEntity delete dialog with blocking linkedCollections check */}
                <TreeDeleteDialog
                    open={dialogs.delete.open}
                    hub={dialogs.delete.item}
                    metahubId={metahubId}
                    kindKey={kindKey}
                    onClose={() => close('delete')}
                    onConfirm={(hub) => {
                        deleteTreeEntityMutation.mutate(
                            {
                                metahubId,
                                treeEntityId: hub.id,
                                kindKey
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
                                            : t('hubs.deleteError')
                                    enqueueSnackbar(message, { variant: 'error' })
                                }
                            }
                        )
                    }}
                    isDeleting={deleteTreeEntityMutation.isPending}
                    uiLocale={i18n.language}
                />
                <ConflictResolutionDialog
                    open={dialogs.conflict.open}
                    conflict={(dialogs.conflict.data as { conflict?: ConflictInfo })?.conflict ?? null}
                    onCancel={() => {
                        close('conflict')
                        if (metahubId) {
                            invalidateTreeEntitiesQueries.all(queryClient, metahubId)
                        }
                    }}
                    onOverwrite={async () => {
                        const pendingUpdate = (
                            dialogs.conflict.data as { pendingUpdate?: { id: string; patch: TreeEntityLocalizedPayload } }
                        )?.pendingUpdate
                        if (pendingUpdate && metahubId) {
                            const { id, patch } = pendingUpdate
                            await updateTreeEntityMutation.mutateAsync({
                                metahubId,
                                treeEntityId: id,
                                kindKey,
                                data: patch
                            })
                            close('conflict')
                        }
                    }}
                    isLoading={updateTreeEntityMutation.isPending}
                />

                {/* Settings edit dialog overlay for hub-scoped view */}
                {isHubScoped &&
                    treeEntityId &&
                    (() => {
                        const currentHub = allTreeEntitiesById.get(treeEntityId)
                        if (!currentHub) return null
                        const currentHubDisplay = toTreeEntityDisplay(currentHub, i18n.language)
                        const settingsCtx = createTreeEntityContext({
                            entity: currentHubDisplay,
                            entityKind: 'hub',
                            t
                        })
                        return (
                            <EntityFormDialog
                                open={editDialogOpen}
                                mode='edit'
                                title={t('hubs.editTitle', 'Edit TreeEntity')}
                                nameLabel={tc('fields.name', 'Name')}
                                descriptionLabel={tc('fields.description', 'Description')}
                                saveButtonText={tc('actions.save', 'Save')}
                                savingButtonText={tc('actions.saving', 'Saving...')}
                                cancelButtonText={tc('actions.cancel', 'Cancel')}
                                hideDefaultFields
                                initialExtraValues={buildTreeEntityInitialValues(settingsCtx)}
                                tabs={buildTreeEntityFormTabs(settingsCtx, allTreeEntities, {
                                    editingEntityId: currentHub.id,
                                    allowHubNesting,
                                    mode: 'edit'
                                })}
                                validate={(values) => validateTreeEntityForm(settingsCtx, values)}
                                canSave={canSaveTreeEntityForm}
                                onSave={(data) => {
                                    const payload = toTreeEntityPayload(data)
                                    void settingsCtx.api!.updateEntity!(currentHub.id, payload)
                                    // Invalidate breadcrumb queries so page title refreshes immediately
                                    if (metahubId && treeEntityId) {
                                        void queryClient.invalidateQueries({
                                            queryKey: ['breadcrumb', 'hub', metahubId, treeEntityId]
                                        })
                                    }
                                }}
                                onClose={() => setEditDialogOpen(false)}
                            />
                        )
                    })()}
            </ExistingCodenamesProvider>
        </MainCard>
    )
}

const TreeEntityList = () => <TreeEntityListContent />

export default TreeEntityList
