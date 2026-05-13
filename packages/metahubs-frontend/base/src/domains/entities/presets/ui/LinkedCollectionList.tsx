import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Box, ButtonBase, Checkbox, Chip, FormControlLabel, Skeleton, Stack, Tab, Tabs, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useSnackbar } from 'notistack'
import { useQueries, useQueryClient } from '@tanstack/react-query'

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
    useCreateLinkedCollection,
    useCreateLinkedCollectionAtMetahub,
    useUpdateLinkedCollection,
    useUpdateLinkedCollectionAtMetahub,
    useDeleteLinkedCollection,
    useCopyLinkedCollection,
    useReorderLinkedCollection
} from '../hooks/linkedCollectionMutations'
import { useLinkedCollectionListData } from '../hooks/useLinkedCollectionListData'
import { useStandardEntityListState, createEntityCopyCallback } from '../hooks/useStandardEntityListState'
import { STORAGE_KEYS } from '../../../../view-preferences/storage'
import * as catalogsApi from '../api/linkedCollections'
import type { LinkedCollectionWithContainers } from '../api/linkedCollections'
import { invalidateLinkedCollectionsQueries, metahubsQueryKeys } from '../../../shared'
import {
    DEFAULT_CATALOG_RECORD_BEHAVIOR,
    DEFAULT_LEDGER_CONFIG,
    normalizeCatalogRecordBehavior,
    normalizeCatalogRecordBehaviorFromConfig,
    normalizeLedgerConfig,
    normalizeLedgerConfigFromConfig,
    supportsLedgerSchema,
    supportsRecordBehavior,
    type CatalogRecordBehavior,
    type LedgerConfig,
    type VersionedLocalizedContent
} from '@universo/types'
import { isOptimisticLockConflict, extractConflictInfo, isPendingEntity, getPendingAction, type ConflictInfo } from '@universo/utils'
import { LinkedCollectionLocalizedPayload, getVLCString } from '../../../../types'
import { normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../../utils/codename'
import { ensureLocalizedContent, extractLocalizedInput, hasPrimaryContent } from '../../../../utils/localizedInput'
import { useCodenameConfig } from '../../../settings/hooks/useCodenameConfig'
import { useMetahubPrimaryLocale } from '../../../settings/hooks/useMetahubPrimaryLocale'
import { LinkedCollectionDeleteDialog, ContainerSelectionPanel, ExistingCodenamesProvider } from '../../../../components'
import linkedCollectionActions, { LinkedCollectionDisplayWithContainer, LinkedCollectionLayoutTabFields } from './LinkedCollectionActions'
import GeneralTabFields from '../../../shared/ui/GeneralTabFields'
import { useMetahubDetails } from '../../../metahubs/hooks'
import * as entitiesApi from '../../api'
import { useAllEntityTypesQuery } from '../../hooks'
import RecordBehaviorFields from '../../ui/RecordBehaviorFields'
import type { RecordBehaviorOption } from '../../ui/RecordBehaviorFields'
import LedgerSchemaFields from '../../ui/LedgerSchemaFields'
import {
    type LinkedCollectionFormValues,
    type LinkedCollectionMenuBaseContext,
    type ConfirmSpec,
    DIALOG_SAVE_CANCEL,
    extractResponseStatus,
    extractResponseMessage,
    toLinkedCollectionWithContainersDisplay
} from './linkedCollectionListUtils'
import { buildLinkedCollectionAuthoringPath } from './linkedCollectionRoutePaths'
import { buildTreeEntityAuthoringPath, resolveEntityChildKindKey } from '../../../shared/entityMetadataRoutePaths'

type GenericFormValues = Record<string, unknown>

const isRecordValue = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value))

const getRecordBehaviorFormValue = (value: unknown): CatalogRecordBehavior => normalizeCatalogRecordBehavior(value)
const getLedgerConfigFormValue = (value: unknown): LedgerConfig => normalizeLedgerConfig(value)
const hasLedgerConfig = (config: unknown): boolean =>
    Boolean(config && typeof config === 'object' && !Array.isArray(config) && 'ledger' in config)

const toRecordBehaviorOption = (entity: { id: string; codename?: unknown; name?: unknown }, uiLocale: string): RecordBehaviorOption => {
    const codename = getVLCString(entity.codename as VersionedLocalizedContent<string> | string | undefined, uiLocale) || entity.id
    const label = getVLCString(entity.name as VersionedLocalizedContent<string> | string | undefined, uiLocale) || codename
    return { codename, label }
}

const validateRecordBehaviorValue = (
    behavior: CatalogRecordBehavior,
    t: (key: string, fallback?: string | Record<string, unknown>) => string
): Record<string, string> => {
    const errors: Record<string, string> = {}
    if (
        (behavior.mode === 'transactional' || behavior.mode === 'hybrid') &&
        behavior.posting.mode !== 'disabled' &&
        behavior.posting.targetLedgers.length === 0
    ) {
        errors.recordBehaviorPosting = t(
            'entities.recordBehavior.validation.targetLedgerRequired',
            'Select at least one target Ledger for posting.'
        )
    }
    if (behavior.posting.mode !== 'disabled' && behavior.lifecycle.enabled && !behavior.lifecycle.states.some((state) => state.isInitial)) {
        errors.recordBehaviorLifecycle = t(
            'entities.recordBehavior.validation.initialStateRequired',
            'Select an initial lifecycle state before enabling posting.'
        )
    }
    return errors
}

export const LinkedCollectionListContent = () => {
    const navigate = useNavigate()
    const { kindKey } = useParams<{ kindKey?: string }>()
    const codenameConfig = useCodenameConfig()
    const preferredVlcLocale = useMetahubPrimaryLocale()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()

    const {
        metahubId,
        treeEntityId,
        entityKindKey,
        isHubScoped,
        treeEntities,
        isLoading,
        error,
        paginationResult,
        searchValue,
        handleSearchChange,
        sortedLinkedCollections,
        images,
        catalogMap,
        allLinkedCollectionsById,
        existingCatalogCodenames,
        attachableExistingLinkedCollections,
        allowCopy,
        allowDelete,
        allowAttachExistingEntities
    } = useLinkedCollectionListData()
    const buildCatalogPath = useCallback(
        (linkedCollectionId: string) =>
            buildLinkedCollectionAuthoringPath({
                metahubId,
                treeEntityId: isHubScoped ? treeEntityId : null,
                kindKey,
                linkedCollectionId,
                tab: 'fieldDefinitions'
            }),
        [treeEntityId, isHubScoped, kindKey, metahubId]
    )
    const buildHubPath = useCallback(
        (tab: 'treeEntities' | 'linkedCollections' | 'valueGroups' | 'optionLists') =>
            buildTreeEntityAuthoringPath({
                metahubId,
                treeEntityId,
                kindKey,
                tab
            }),
        [treeEntityId, kindKey, metahubId]
    )
    const buildAssociatedHubCatalogPath = useCallback(
        (nextTreeEntityId: string) =>
            buildTreeEntityAuthoringPath({
                metahubId,
                treeEntityId: nextTreeEntityId,
                kindKey: resolveEntityChildKindKey({ routeKindKey: kindKey, childObjectKind: 'hub' }),
                tab: 'linkedCollections'
            }),
        [kindKey, metahubId]
    )
    const metahubDetailsQuery = useMetahubDetails(metahubId ?? '', { enabled: Boolean(metahubId) })
    const canEditLinkedCollections = metahubDetailsQuery.data?.permissions?.editContent === true
    const canDeleteLinkedCollections = metahubDetailsQuery.data?.permissions?.deleteContent === true
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
    } = useStandardEntityListState<LinkedCollectionWithContainers>(
        isHubScoped ? STORAGE_KEYS.LINKED_COLLECTION_DISPLAY_STYLE : STORAGE_KEYS.ALL_LINKED_COLLECTIONS_DISPLAY_STYLE
    )
    const entityTypesQuery = useAllEntityTypesQuery(metahubId)
    const catalogEntityType = useMemo(
        () => (entityTypesQuery.data?.items ?? []).find((item) => item.kindKey === entityKindKey) ?? null,
        [entityKindKey, entityTypesQuery.data?.items]
    )
    const catalogRequestedTabs = useMemo(() => new Set(catalogEntityType?.ui.tabs ?? []), [catalogEntityType?.ui.tabs])
    const catalogHasRecordBehaviorConfig = Boolean(
        isRecordValue(catalogEntityType?.config) && isRecordValue(catalogEntityType.config.recordBehavior)
    )
    const showRecordBehaviorTab = Boolean(
        catalogEntityType &&
            supportsRecordBehavior(catalogEntityType.components) &&
            (catalogRequestedTabs.has('behavior') || catalogHasRecordBehaviorConfig)
    )
    const catalogHasLedgerConfig = Boolean(isRecordValue(catalogEntityType?.config) && isRecordValue(catalogEntityType.config.ledger))
    const showLedgerSchemaTab = Boolean(
        catalogEntityType &&
            supportsLedgerSchema(catalogEntityType.components) &&
            (catalogRequestedTabs.has('ledgerSchema') || catalogHasLedgerConfig)
    )
    const ledgerCandidateKindKeys = useMemo(
        () =>
            (entityTypesQuery.data?.items ?? [])
                .filter((type) => supportsLedgerSchema(type.components))
                .map((type) => type.kindKey)
                .sort((left, right) => left.localeCompare(right)),
        [entityTypesQuery.data?.items]
    )
    const behaviorLedgerQueries = useQueries({
        queries: ledgerCandidateKindKeys.map((kind) => ({
            queryKey:
                metahubId && showRecordBehaviorTab && dialogs.create.open
                    ? metahubsQueryKeys.entitiesList(metahubId, {
                          kind,
                          limit: 200,
                          offset: 0,
                          sortBy: 'codename',
                          sortOrder: 'asc'
                      })
                    : ['metahubs', 'catalogs', 'recordBehavior', 'ledgers', 'empty', kind],
            queryFn: () =>
                entitiesApi.listEntityInstances(metahubId!, {
                    kind,
                    limit: 200,
                    offset: 0,
                    sortBy: 'codename',
                    sortOrder: 'asc'
                }),
            enabled: Boolean(metahubId && showRecordBehaviorTab && dialogs.create.open),
            staleTime: 30 * 1000
        }))
    })
    const behaviorLedgerOptions = useMemo(
        () =>
            behaviorLedgerQueries
                .flatMap((query) => query.data?.items ?? [])
                .filter((entity) => hasLedgerConfig(entity.config))
                .map((entity) => toRecordBehaviorOption(entity, preferredVlcLocale)),
        [behaviorLedgerQueries, preferredVlcLocale]
    )
    const ledgerEntityKindOptions = useMemo(
        () =>
            (entityTypesQuery.data?.items ?? []).map((type) => ({
                codename: type.kindKey,
                label: getVLCString(type.name, preferredVlcLocale) || type.kindKey
            })),
        [entityTypesQuery.data?.items, preferredVlcLocale]
    )

    const [isAttachDialogOpen, setAttachDialogOpen] = useState(false)
    const [isAttachingExisting, setAttachingExisting] = useState(false)
    const [attachDialogError, setAttachDialogError] = useState<string | null>(null)
    const [pendingCatalogNavigation, setPendingCatalogNavigation] = useState<{ pendingId: string; codename: string } | null>(null)
    const pendingInteractionMessage = tc('pendingCreateBlocked', 'This item is still being created. Please wait a moment and try again.')

    const filteredLinkedCollectionActions = useMemo(
        () =>
            linkedCollectionActions.filter((a) => {
                if (a.id === 'edit' && !canEditLinkedCollections) return false
                if (a.id === 'copy' && (!canEditLinkedCollections || !allowCopy)) return false
                if (a.id === 'delete' && (!canDeleteLinkedCollections || !allowDelete)) return false
                return true
            }),
        [allowCopy, allowDelete, canDeleteLinkedCollections, canEditLinkedCollections]
    )

    const createLinkedCollectionMutation = useCreateLinkedCollection()
    const createLinkedCollectionAtMetahubMutation = useCreateLinkedCollectionAtMetahub()
    const updateLinkedCollectionMutation = useUpdateLinkedCollection()
    const deleteLinkedCollectionMutation = useDeleteLinkedCollection()
    const updateLinkedCollectionAtMetahubMutation = useUpdateLinkedCollectionAtMetahub()
    const copyLinkedCollectionMutation = useCopyLinkedCollection()
    const reorderLinkedCollectionMutation = useReorderLinkedCollection()

    useEffect(() => {
        if (!pendingCatalogNavigation || !metahubId) return

        if (sortedLinkedCollections.some((catalog) => catalog.id === pendingCatalogNavigation.pendingId)) {
            return
        }

        const resolvedCatalog = sortedLinkedCollections.find(
            (catalog) => !isPendingEntity(catalog) && catalog.codename === pendingCatalogNavigation.codename
        )

        if (!resolvedCatalog) return

        setPendingCatalogNavigation(null)
        const nextPath = buildCatalogPath(resolvedCatalog.id)
        if (nextPath) {
            navigate(nextPath)
        }
    }, [buildCatalogPath, metahubId, navigate, pendingCatalogNavigation, sortedLinkedCollections])

    const handlePendingCatalogInteraction = useCallback(
        (pendingLinkedCollectionId: string) => {
            if (!metahubId) return
            const pendingCatalog = catalogMap.get(pendingLinkedCollectionId)
            if (pendingCatalog?.codename) {
                setPendingCatalogNavigation({ pendingId: pendingCatalog.id, codename: pendingCatalog.codename })
            }
            revealPendingEntityFeedback({
                queryClient,
                queryKeyPrefix:
                    isHubScoped && treeEntityId
                        ? metahubsQueryKeys.linkedCollectionsScope(metahubId, treeEntityId, entityKindKey)
                        : metahubsQueryKeys.allLinkedCollectionsScope(metahubId, entityKindKey),
                entityId: pendingLinkedCollectionId,
                extraQueryKeys: [
                    isHubScoped && treeEntityId
                        ? metahubsQueryKeys.linkedCollectionDetailInTreeEntity(
                              metahubId,
                              treeEntityId,
                              pendingLinkedCollectionId,
                              entityKindKey
                          )
                        : metahubsQueryKeys.linkedCollectionDetail(metahubId, pendingLinkedCollectionId, entityKindKey)
                ]
            })
            enqueueSnackbar(pendingInteractionMessage, { variant: 'info' })
        },
        [catalogMap, enqueueSnackbar, treeEntityId, isHubScoped, metahubId, pendingInteractionMessage, queryClient, entityKindKey]
    )

    const attachExistingCatalogSelectionLabels = useMemo<EntitySelectionLabels>(
        () => ({
            title: t('catalogs.attachExisting.selectionTitle', 'LinkedCollections'),
            addButton: t('common:actions.add', 'Add'),
            dialogTitle: t('catalogs.attachExisting.selectDialogTitle', 'Select linkedCollections'),
            emptyMessage: t('catalogs.attachExisting.emptySelection', 'No linkedCollections selected'),
            noAvailableMessage: t('catalogs.attachExisting.noAvailable', 'No linkedCollections available to add'),
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
    const localizedFormDefaults = useMemo<LinkedCollectionFormValues>(
        () => ({
            nameVlc: null,
            descriptionVlc: null,
            codename: null,
            codenameTouched: false,
            treeEntityIds: treeEntityId ? [treeEntityId] : [], // Auto-select current hub
            isSingleHub: false,
            isRequiredHub: false, // Default: catalog can exist without treeEntities
            recordBehavior:
                showRecordBehaviorTab && catalogEntityType?.config
                    ? normalizeCatalogRecordBehaviorFromConfig(catalogEntityType.config)
                    : DEFAULT_CATALOG_RECORD_BEHAVIOR,
            ledgerSchemaEnabled: showLedgerSchemaTab && hasLedgerConfig(catalogEntityType?.config),
            ledgerConfig:
                showLedgerSchemaTab && catalogEntityType?.config
                    ? normalizeLedgerConfigFromConfig(catalogEntityType.config)
                    : DEFAULT_LEDGER_CONFIG
        }),
        [catalogEntityType?.config, showLedgerSchemaTab, showRecordBehaviorTab, treeEntityId]
    )

    const validateLinkedCollectionForm = useCallback(
        (values: GenericFormValues) => {
            const errors: Record<string, string> = {}
            const treeEntityIds = Array.isArray(values.treeEntityIds) ? values.treeEntityIds : []
            const isRequiredHub = Boolean(values.isRequiredHub)
            // TreeEntity validation only if isRequiredHub is true
            if (isRequiredHub && treeEntityIds.length === 0) {
                errors.treeEntityIds = t('catalogs.validation.hubRequired', 'At least one hub is required')
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
                errors.codename = t('catalogs.validation.codenameRequired', 'Codename is required')
            } else if (
                !isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            ) {
                errors.codename = t('catalogs.validation.codenameInvalid', 'Codename contains invalid characters')
            }
            if (showRecordBehaviorTab) {
                Object.assign(errors, validateRecordBehaviorValue(getRecordBehaviorFormValue(values.recordBehavior), t))
            }
            if (showLedgerSchemaTab && values.ledgerSchemaEnabled === true) {
                try {
                    normalizeLedgerConfig(values.ledgerConfig)
                } catch {
                    errors.ledgerConfig = t('entities.ledgerSchema.validation.invalid', 'Ledger schema settings are invalid.')
                }
            }
            return Object.keys(errors).length > 0 ? errors : null
        },
        [codenameConfig.allowMixed, codenameConfig.alphabet, codenameConfig.style, showLedgerSchemaTab, showRecordBehaviorTab, t, tc]
    )

    const canSaveLinkedCollectionForm = useCallback(
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
            const behaviorValid =
                !showRecordBehaviorTab ||
                Object.keys(validateRecordBehaviorValue(getRecordBehaviorFormValue(values.recordBehavior), t)).length === 0
            const ledgerValid =
                !showLedgerSchemaTab ||
                values.ledgerSchemaEnabled !== true ||
                (() => {
                    try {
                        normalizeLedgerConfig(values.ledgerConfig)
                        return true
                    } catch {
                        return false
                    }
                })()
            return (
                !values._hasCodenameDuplicate &&
                hubsValid &&
                behaviorValid &&
                ledgerValid &&
                hasPrimaryContent(nameVlc) &&
                Boolean(normalizedCodename) &&
                isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            )
        },
        [codenameConfig.allowMixed, codenameConfig.alphabet, codenameConfig.style, showLedgerSchemaTab, showRecordBehaviorTab, t]
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

            const tabs: TabConfig[] = [
                {
                    id: 'general',
                    label: t('catalogs.tabs.general', 'Основное'),
                    content: (
                        <GeneralTabFields
                            values={values}
                            setValue={setValue}
                            isLoading={isFormLoading}
                            errors={errors}
                            uiLocale={preferredVlcLocale}
                            nameLabel={tc('fields.name', 'Name')}
                            descriptionLabel={tc('fields.description', 'Description')}
                            codenameLabel={t('catalogs.codename', 'Codename')}
                            codenameHelper={t('catalogs.codenameHelper', 'Unique identifier')}
                        />
                    )
                }
            ]

            if (showRecordBehaviorTab && catalogEntityType) {
                tabs.push({
                    id: 'behavior',
                    label: t('entities.instances.tabs.behavior', 'Behavior'),
                    content: (
                        <RecordBehaviorFields
                            value={getRecordBehaviorFormValue(values.recordBehavior)}
                            onChange={(nextValue) => setValue('recordBehavior', nextValue)}
                            disabled={isFormLoading}
                            components={catalogEntityType.components}
                            fieldOptions={[]}
                            ledgerOptions={behaviorLedgerOptions}
                            scriptOptions={[]}
                            errors={errors}
                        />
                    )
                })
            }

            if (showLedgerSchemaTab && catalogEntityType) {
                tabs.push({
                    id: 'ledgerSchema',
                    label: t('entities.instances.tabs.ledgerSchema', 'Ledger schema'),
                    content: (
                        <Stack spacing={2}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={values.ledgerSchemaEnabled === true}
                                        onChange={(event) => setValue('ledgerSchemaEnabled', event.target.checked)}
                                        disabled={isFormLoading}
                                    />
                                }
                                label={t('entities.ledgerSchema.enabled', 'Use this entity as a ledger')}
                            />
                            {values.ledgerSchemaEnabled === true ? (
                                <LedgerSchemaFields
                                    value={getLedgerConfigFormValue(values.ledgerConfig)}
                                    onChange={(nextValue) => setValue('ledgerConfig', nextValue)}
                                    disabled={isFormLoading}
                                    components={catalogEntityType.components}
                                    fieldOptions={[]}
                                    entityKindOptions={ledgerEntityKindOptions}
                                    errors={errors}
                                />
                            ) : (
                                <Typography variant='body2' color='text.secondary'>
                                    {t(
                                        'entities.ledgerSchema.disabledDescription',
                                        'Enable ledger schema when this entity should store append-only facts, dimensions, resources, and projections.'
                                    )}
                                </Typography>
                            )}
                        </Stack>
                    )
                })
            }

            tabs.push(
                {
                    id: 'treeEntities',
                    label: t('catalogs.tabs.treeEntities', 'Хабы'),
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
                },
                {
                    id: 'layout',
                    label: t('catalogs.tabs.layout', 'Layout'),
                    content: (
                        <LinkedCollectionLayoutTabFields
                            values={values}
                            setValue={setValue}
                            isLoading={isFormLoading}
                            t={t}
                            metahubId={metahubId}
                        />
                    )
                }
            )

            return tabs
        },
        [
            behaviorLedgerOptions,
            catalogEntityType,
            ledgerEntityKindOptions,
            metahubId,
            preferredVlcLocale,
            showLedgerSchemaTab,
            showRecordBehaviorTab,
            t,
            tc,
            treeEntities,
            treeEntityId
        ]
    )

    const catalogColumns = useMemo(() => {
        // Base columns for both modes
        const baseColumns = [
            {
                id: 'sortOrder',
                label: t('fieldDefinitions.table.order', '#'),
                width: '4%',
                align: 'center' as const,
                sortable: true,
                sortAccessor: (row: LinkedCollectionWithContainersDisplay) => row.sortOrder ?? 0,
                render: (row: LinkedCollectionWithContainersDisplay) => (
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
                sortAccessor: (row: LinkedCollectionWithContainersDisplay) => row.name?.toLowerCase() ?? '',
                render: (row: LinkedCollectionWithContainersDisplay) => {
                    const href = buildCatalogPath(row.id)
                    return isPendingEntity(row) ? (
                        <ButtonBase
                            onClick={() => handlePendingCatalogInteraction(row.id)}
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
                sortAccessor: (row: LinkedCollectionWithContainersDisplay) => row.description?.toLowerCase() ?? '',
                render: (row: LinkedCollectionWithContainersDisplay) => (
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
                label: t('catalogs.codename', 'Codename'),
                width: '15%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: LinkedCollectionWithContainersDisplay) => row.codename?.toLowerCase() ?? '',
                render: (row: LinkedCollectionWithContainersDisplay) => (
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
            render: (row: LinkedCollectionWithContainersDisplay) => (
                <Stack direction='column' spacing={0.5}>
                    {row.allTreeEntities.map((hub) =>
                        isPendingEntity(row) ? (
                            <Chip
                                key={hub.id}
                                label={hub.name}
                                size='small'
                                variant='outlined'
                                clickable
                                onClick={() => handlePendingCatalogInteraction(row.id)}
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
                                to={buildAssociatedHubCatalogPath(hub.id)}
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
                id: 'fieldDefinitionsCount',
                label: t('catalogs.attributesHeader', 'FieldDefinitions'),
                width: '10%',
                align: 'center' as const,
                render: (row: LinkedCollectionWithContainersDisplay) =>
                    typeof row.fieldDefinitionsCount === 'number' ? (
                        isPendingEntity(row) ? (
                            <ButtonBase onClick={() => handlePendingCatalogInteraction(row.id)}>
                                <Typography
                                    sx={{
                                        fontSize: 14,
                                        '&:hover': {
                                            textDecoration: 'underline',
                                            color: 'primary.main'
                                        }
                                    }}
                                >
                                    {row.fieldDefinitionsCount}
                                </Typography>
                            </ButtonBase>
                        ) : (
                            <Link to={buildCatalogPath(row.id)} style={{ textDecoration: 'none', color: 'inherit' }}>
                                <Typography
                                    sx={{
                                        fontSize: 14,
                                        '&:hover': {
                                            textDecoration: 'underline',
                                            color: 'primary.main'
                                        }
                                    }}
                                >
                                    {row.fieldDefinitionsCount}
                                </Typography>
                            </Link>
                        )
                    ) : (
                        '—'
                    )
            },
            {
                id: 'recordsCount',
                label: t('catalogs.elementsHeader', 'Records'),
                width: '10%',
                align: 'center' as const,
                render: (row: LinkedCollectionWithContainersDisplay) => (typeof row.recordsCount === 'number' ? row.recordsCount : '—')
            }
        ]

        // Combine columns based on mode
        if (isHubScoped) {
            return [...baseColumns, ...countColumns]
        } else {
            return [...baseColumns, hubColumn, ...countColumns]
        }
    }, [buildAssociatedHubCatalogPath, buildCatalogPath, handlePendingCatalogInteraction, isHubScoped, t, tc])

    const createLinkedCollectionContext = useCallback(
        (baseContext: LinkedCollectionMenuBaseContext) => ({
            ...baseContext,
            catalogMap,
            metahubId,
            uiLocale: preferredVlcLocale,
            treeEntities, // Pass treeEntities for hub selector in edit dialog (N:M)
            currentTreeEntityId: isHubScoped ? treeEntityId ?? null : null,
            routeKindKey: kindKey ?? null,
            recordBehaviorEnabled: showRecordBehaviorTab,
            recordBehaviorComponents: catalogEntityType?.components ?? null,
            recordBehaviorDefaultConfig: catalogEntityType?.config ?? null,
            ledgerSchemaEnabled: showLedgerSchemaTab,
            ledgerSchemaComponents: catalogEntityType?.components ?? null,
            ledgerSchemaDefaultConfig: catalogEntityType?.config ?? null,
            ledgerCandidateKindKeys,
            ledgerEntityKindOptions,
            api: {
                updateEntity: (id: string, patch: LinkedCollectionLocalizedPayload & { expectedVersion?: number }) => {
                    if (!metahubId) return Promise.resolve()
                    const catalog = catalogMap.get(id)
                    const rawCodename = getVLCString(patch.codename, patch.codename?._primary ?? 'en')
                    const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
                    if (!normalizedCodename) {
                        throw new Error(t('catalogs.validation.codenameRequired', 'Codename is required'))
                    }
                    const codenamePayload = ensureLocalizedContent(patch.codename, patch.codename?._primary ?? 'en', normalizedCodename)
                    // Include expectedVersion for optimistic locking if catalog has version
                    const expectedVersion = catalog?.version
                    const dataWithVersion = { ...patch, codename: codenamePayload, expectedVersion }

                    // In hub-scoped mode, use treeEntityId from URL; in global mode, check if catalog has treeEntities
                    const targetTreeEntityId = isHubScoped ? treeEntityId! : catalog?.treeEntities?.[0]?.id
                    const mutationOptions = {
                        onError: (error: unknown) => {
                            if (!isOptimisticLockConflict(error)) return
                            const conflict = extractConflictInfo(error)
                            if (!conflict) return
                            openConflict({
                                conflict,
                                pendingData: { ...patch, codename: codenamePayload },
                                linkedCollectionId: id
                            })
                        }
                    }

                    if (targetTreeEntityId) {
                        updateLinkedCollectionMutation.mutate(
                            {
                                metahubId,
                                treeEntityId: targetTreeEntityId,
                                linkedCollectionId: id,
                                kindKey: entityKindKey,
                                data: dataWithVersion
                            },
                            { onError: mutationOptions.onError }
                        )
                    } else {
                        updateLinkedCollectionAtMetahubMutation.mutate(
                            {
                                metahubId,
                                linkedCollectionId: id,
                                kindKey: entityKindKey,
                                data: dataWithVersion
                            },
                            { onError: mutationOptions.onError }
                        )
                    }

                    return Promise.resolve()
                },
                deleteEntity: (id: string) => {
                    if (!metahubId) return
                    const catalog = catalogMap.get(id)

                    if (isHubScoped && treeEntityId) {
                        // TreeEntity-scoped mode: use treeEntityId from URL
                        return deleteLinkedCollectionMutation.mutateAsync({
                            metahubId,
                            treeEntityId,
                            linkedCollectionId: id,
                            force: false,
                            kindKey: entityKindKey
                        })
                    } else {
                        // Global mode: check if catalog has treeEntities
                        const targetTreeEntityId = catalog?.treeEntities?.[0]?.id
                        return deleteLinkedCollectionMutation.mutateAsync({
                            metahubId,
                            treeEntityId: targetTreeEntityId, // undefined for linkedCollections without treeEntities
                            linkedCollectionId: id,
                            force: Boolean(targetTreeEntityId), // force=true if has multiple treeEntities
                            kindKey: entityKindKey
                        })
                    }
                },
                copyEntity: createEntityCopyCallback<LinkedCollectionLocalizedPayload & Record<string, unknown>>({
                    metahubId,
                    mutation: copyLinkedCollectionMutation,
                    entityIdKey: 'linkedCollectionId',
                    kindKey: entityKindKey
                })
            },
            helpers: {
                refreshList: () => {
                    if (metahubId) {
                        if (isHubScoped && treeEntityId) {
                            void invalidateLinkedCollectionsQueries.all(queryClient, metahubId, treeEntityId, entityKindKey)
                        } else {
                            // In global mode, invalidate all linkedCollections cache
                            void queryClient.invalidateQueries({
                                queryKey: metahubsQueryKeys.allLinkedCollectionsScope(metahubId, entityKindKey)
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
                openDeleteDialog: (entity: LinkedCollectionDisplayWithContainer | LinkedCollectionDisplay) => {
                    const catalog = catalogMap.get(entity.id)
                    if (!catalog) return
                    const containersCount = Array.isArray(catalog.treeEntities) ? catalog.treeEntities.length : 0
                    const willDeleteCatalog = !isHubScoped || (!catalog.isRequiredHub && containersCount === 1)

                    if (willDeleteCatalog) {
                        openBlockingDelete(catalog)
                        return
                    }

                    openDelete(catalog)
                }
            }
        }),
        [
            confirm,
            copyLinkedCollectionMutation,
            codenameConfig.alphabet,
            codenameConfig.style,
            deleteLinkedCollectionMutation,
            enqueueSnackbar,
            catalogMap,
            catalogEntityType?.components,
            catalogEntityType?.config,
            ledgerCandidateKindKeys,
            ledgerEntityKindOptions,
            treeEntities,
            treeEntityId,
            isHubScoped,
            kindKey,
            metahubId,
            openBlockingDelete,
            openConflict,
            openDelete,
            preferredVlcLocale,
            queryClient,
            showLedgerSchemaTab,
            showRecordBehaviorTab,
            t,
            entityKindKey,
            updateLinkedCollectionMutation,
            updateLinkedCollectionAtMetahubMutation
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

    const handleAttachExistingLinkedCollections = async (data: GenericFormValues) => {
        if (!metahubId || !treeEntityId) return

        const selectedLinkedCollectionIds = Array.isArray(data.selectedLinkedCollectionIds)
            ? data.selectedLinkedCollectionIds.filter((id): id is string => typeof id === 'string')
            : []
        if (selectedLinkedCollectionIds.length === 0) {
            return
        }

        setAttachDialogError(null)
        setAttachingExisting(true)
        try {
            const selectedLinkedCollections = selectedLinkedCollectionIds
                .map((linkedCollectionId) => allLinkedCollectionsById.get(linkedCollectionId))
                .filter((catalog): catalog is LinkedCollectionWithContainers => Boolean(catalog))
            const failed: string[] = []

            for (const catalog of selectedLinkedCollections) {
                try {
                    const currentTreeEntityIds = Array.isArray(catalog.treeEntities) ? catalog.treeEntities.map((hub) => hub.id) : []
                    const nextTreeEntityIds = Array.from(new Set([...currentTreeEntityIds, treeEntityId]))
                    await catalogsApi.updateLinkedCollectionAtMetahub(metahubId, catalog.id, {
                        treeEntityIds: nextTreeEntityIds,
                        expectedVersion: catalog.version,
                        kindKey: entityKindKey
                    })
                } catch (error) {
                    failed.push(getVLCString(catalog.name, preferredVlcLocale) || getVLCString(catalog.name, 'en') || catalog.codename)
                    // eslint-disable-next-line no-console
                    console.error('Failed to attach existing catalog to current hub', error)
                }
            }

            await Promise.all([
                invalidateLinkedCollectionsQueries.all(queryClient, metahubId, treeEntityId, entityKindKey),
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allLinkedCollectionsScope(metahubId, entityKindKey) })
            ])

            if (failed.length === 0) {
                enqueueSnackbar(
                    t('catalogs.attachExisting.success', {
                        count: selectedLinkedCollections.length,
                        defaultValue: 'Added {{count}} catalog(s).'
                    }),
                    { variant: 'success' }
                )
                setAttachDialogOpen(false)
                return
            }

            const successCount = selectedLinkedCollections.length - failed.length
            if (successCount > 0) {
                enqueueSnackbar(
                    t('catalogs.attachExisting.partialSuccess', {
                        successCount,
                        failCount: failed.length,
                        defaultValue: 'Added {{successCount}} catalog(s). {{failCount}} catalog(s) could not be linked.'
                    }),
                    { variant: 'warning' }
                )
                setAttachDialogOpen(false)
                return
            }

            setAttachDialogError(
                t('catalogs.attachExisting.failedAll', {
                    defaultValue: 'Selected linkedCollections could not be linked to this hub. Please review restrictions and try again.'
                })
            )
        } finally {
            setAttachingExisting(false)
        }
    }

    const handleCreateLinkedCollection = async (data: GenericFormValues) => {
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

        // Confirm dialog for detached catalog (async — throws DIALOG_SAVE_CANCEL if cancelled)
        if (isHubScoped && treeEntityId && !treeEntityIds.includes(treeEntityId)) {
            const confirmed = await confirm({
                title: t('catalogs.detachedConfirm.title', 'Create catalog without current hub?'),
                description: t(
                    'catalogs.detachedConfirm.description',
                    'This catalog is not linked to the current hub and will not appear in this hub after creation.'
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
        const catalogPayload = {
            codename: codenamePayload,
            name: nameInput ?? {},
            description: descriptionInput,
            namePrimaryLocale: namePrimaryLocale ?? '',
            descriptionPrimaryLocale,
            treeEntityIds,
            isSingleHub,
            isRequiredHub,
            ...(showRecordBehaviorTab ? { recordBehavior: normalizeCatalogRecordBehavior(data.recordBehavior) } : {}),
            ...(showLedgerSchemaTab
                ? { ledgerConfig: data.ledgerSchemaEnabled === true ? normalizeLedgerConfig(data.ledgerConfig) : null }
                : {})
        }

        if (treeEntityIds.length > 0) {
            const primaryTreeEntityId = treeEntityIds[0]
            createLinkedCollectionMutation.mutate({
                metahubId: metahubId!,
                treeEntityId: primaryTreeEntityId,
                kindKey: entityKindKey,
                data: catalogPayload
            })
        } else {
            createLinkedCollectionAtMetahubMutation.mutate({
                metahubId: metahubId!,
                kindKey: entityKindKey,
                data: catalogPayload
            })
        }
    }

    const goToCatalog = (catalog: LinkedCollectionWithContainers) => {
        const nextPath = buildCatalogPath(catalog.id)
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
        if (tabValue === 'valueGroups') {
            const nextPath = buildHubPath('valueGroups')
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
        const nextPath = buildHubPath('linkedCollections')
        if (nextPath) {
            navigate(nextPath)
        }
    }

    // Transform LinkedCollectionEntity data for display - use hub-aware version for global mode
    const getCatalogCardData = (catalog: LinkedCollectionWithContainers): LinkedCollectionWithContainersDisplay =>
        toLinkedCollectionWithContainersDisplay(catalog, i18n.language)
    const showAttachExistingAction = isHubScoped && allowAttachExistingEntities
    const hasAttachableExistingLinkedCollections = attachableExistingLinkedCollections.length > 0

    const handleSortableDragEnd = async (event: DragEndEvent) => {
        if (!metahubId) return
        const { active, over } = event
        if (!over || active.id === over.id) return

        const overCatalog = sortedLinkedCollections.find((catalog) => catalog.id === String(over.id))
        if (!overCatalog) return

        try {
            await reorderLinkedCollectionMutation.mutateAsync({
                metahubId,
                treeEntityId,
                linkedCollectionId: String(active.id),
                newSortOrder: overCatalog.sortOrder ?? 1,
                kindKey: entityKindKey
            })
            enqueueSnackbar(t('catalogs.reorderSuccess', 'LinkedCollectionEntity order updated'), { variant: 'success' })
        } catch (error: unknown) {
            const message =
                typeof error === 'object' &&
                error !== null &&
                'message' in error &&
                typeof (error as { message?: unknown }).message === 'string'
                    ? (error as { message: string }).message
                    : t('catalogs.reorderError', 'Failed to reorder catalog')
            enqueueSnackbar(message, { variant: 'error' })
        }
    }

    const renderDragOverlay = (activeId: string | null) => {
        if (!activeId) return null
        const catalog = catalogMap.get(activeId)
        if (!catalog) return null
        const display = getCatalogCardData(catalog)
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
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{display.name || display.codename || catalog.id}</Typography>
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
            <ExistingCodenamesProvider entities={existingCatalogCodenames}>
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
                            searchPlaceholder={t('catalogs.searchPlaceholder')}
                            onSearchChange={handleSearchChange}
                            title={isHubScoped ? t('catalogs.title') : t('catalogs.allTitle')}
                        >
                            <ToolbarControls
                                viewToggleEnabled
                                viewMode={view as 'card' | 'list'}
                                onViewModeChange={(mode: string) => handleChange(null, mode)}
                                cardViewTitle={tc('cardView')}
                                listViewTitle={tc('listView')}
                                primaryAction={
                                    canEditLinkedCollections
                                        ? {
                                              label: tc('create'),
                                              onClick: handleAddNew,
                                              startIcon: <AddRoundedIcon />
                                          }
                                        : undefined
                                }
                                primaryActionMenuItems={
                                    canEditLinkedCollections && showAttachExistingAction && hasAttachableExistingLinkedCollections
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
                                    value='linkedCollections'
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
                            {isLoading && sortedLinkedCollections.length === 0 ? (
                                view === 'card' ? (
                                    <SkeletonGrid insetMode='content' />
                                ) : (
                                    <Skeleton variant='rectangular' height={120} />
                                )
                            ) : !isLoading && sortedLinkedCollections.length === 0 ? (
                                <EmptyListState
                                    image={APIEmptySVG}
                                    imageAlt='No linkedCollections'
                                    title={searchValue ? t('catalogs.noSearchResults') : t('catalogs.empty')}
                                    description={searchValue ? t('catalogs.noSearchResultsHint') : t('catalogs.emptyDescription')}
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
                                            {sortedLinkedCollections.map((catalog: LinkedCollectionWithContainers) => {
                                                const descriptors = [...filteredLinkedCollectionActions]
                                                const displayData = getCatalogCardData(catalog)

                                                return (
                                                    <ItemCard
                                                        key={catalog.id}
                                                        data={displayData}
                                                        images={images[catalog.id] || []}
                                                        onClick={() => goToCatalog(catalog)}
                                                        pending={isPendingEntity(catalog)}
                                                        pendingAction={getPendingAction(catalog)}
                                                        onPendingInteractionAttempt={() => handlePendingCatalogInteraction(catalog.id)}
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
                                                                {typeof catalog.fieldDefinitionsCount === 'number' && (
                                                                    <Typography variant='caption' color='text.secondary'>
                                                                        {t('catalogs.attributesCount', {
                                                                            count: catalog.fieldDefinitionsCount
                                                                        })}
                                                                    </Typography>
                                                                )}
                                                            </Stack>
                                                        }
                                                        headerAction={
                                                            descriptors.length > 0 ? (
                                                                <Box onClick={(e) => e.stopPropagation()}>
                                                                    <BaseEntityMenu<
                                                                        LinkedCollectionDisplayWithContainer,
                                                                        LinkedCollectionLocalizedPayload
                                                                    >
                                                                        entity={displayData}
                                                                        entityKind='catalog'
                                                                        descriptors={descriptors}
                                                                        namespace='metahubs'
                                                                        i18nInstance={i18n}
                                                                        createContext={createLinkedCollectionContext}
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
                                                data={sortedLinkedCollections.map(getCatalogCardData)}
                                                images={images}
                                                isLoading={isLoading}
                                                sortableRows
                                                sortableItemIds={sortedLinkedCollections.map((catalog) => catalog.id)}
                                                dragHandleAriaLabel={t('catalogs.dnd.dragHandle', 'Drag to reorder')}
                                                dragDisabled={reorderLinkedCollectionMutation.isPending || isLoading}
                                                onSortableDragEnd={handleSortableDragEnd}
                                                renderDragOverlay={renderDragOverlay}
                                                getRowLink={(row: LinkedCollectionWithContainersDisplay) =>
                                                    row?.id ? buildCatalogPath(row.id) || undefined : undefined
                                                }
                                                onPendingInteractionAttempt={(row: LinkedCollectionWithContainersDisplay) =>
                                                    handlePendingCatalogInteraction(row.id)
                                                }
                                                customColumns={catalogColumns}
                                                i18nNamespace='flowList'
                                                renderActions={(row: LinkedCollectionWithContainersDisplay) => {
                                                    const originalCatalog = catalogMap.get(row.id)
                                                    if (!originalCatalog) return null

                                                    const descriptors = [...filteredLinkedCollectionActions]
                                                    if (!descriptors.length) return null

                                                    return (
                                                        <BaseEntityMenu<
                                                            LinkedCollectionDisplayWithContainer,
                                                            LinkedCollectionLocalizedPayload
                                                        >
                                                            entity={getCatalogCardData(originalCatalog)}
                                                            entityKind='catalog'
                                                            descriptors={descriptors}
                                                            namespace='metahubs'
                                                            menuButtonLabelKey='flowList:menu.button'
                                                            i18nInstance={i18n}
                                                            createContext={createLinkedCollectionContext}
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
                        {!isLoading && sortedLinkedCollections.length > 0 && (
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
                    title={t('catalogs.createDialog.title', 'Create LinkedCollectionEntity')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={tc('actions.create', 'Create')}
                    savingButtonText={tc('actions.creating', 'Creating...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onClose={handleDialogClose}
                    onSave={handleCreateLinkedCollection}
                    hideDefaultFields
                    initialExtraValues={localizedFormDefaults}
                    tabs={buildFormTabs}
                    validate={validateLinkedCollectionForm}
                    canSave={canSaveLinkedCollectionForm}
                />

                <EntityFormDialog
                    open={isAttachDialogOpen}
                    title={t('catalogs.attachExisting.dialogTitle', 'Add Existing LinkedCollections')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={t('common:actions.add', 'Add')}
                    savingButtonText={t('common:actions.saving', 'Saving...')}
                    cancelButtonText={t('common:actions.cancel', 'Cancel')}
                    loading={isAttachingExisting}
                    error={attachDialogError || undefined}
                    onClose={handleCloseAttachExistingDialog}
                    onSave={handleAttachExistingLinkedCollections}
                    hideDefaultFields
                    initialExtraValues={{ selectedLinkedCollectionIds: [] }}
                    tabs={({ values, setValue, isLoading, errors }) => {
                        const selectedLinkedCollectionIds = Array.isArray(values.selectedLinkedCollectionIds)
                            ? values.selectedLinkedCollectionIds.filter((id): id is string => typeof id === 'string')
                            : []
                        return [
                            {
                                id: 'linkedCollections',
                                label: t('catalogs.title', 'LinkedCollections'),
                                content: (
                                    <EntitySelectionPanel<LinkedCollectionWithContainers>
                                        availableEntities={attachableExistingLinkedCollections}
                                        selectedIds={selectedLinkedCollectionIds}
                                        onSelectionChange={(ids) => setValue('selectedLinkedCollectionIds', ids)}
                                        getDisplayName={(catalog) =>
                                            getVLCString(catalog.name, preferredVlcLocale) ||
                                            getVLCString(catalog.name, 'en') ||
                                            catalog.codename ||
                                            '—'
                                        }
                                        getCodename={(catalog) => catalog.codename}
                                        labels={attachExistingCatalogSelectionLabels}
                                        disabled={isLoading}
                                        error={errors.selectedLinkedCollectionIds}
                                    />
                                )
                            }
                        ]
                    }}
                    validate={(values) => {
                        const selectedLinkedCollectionIds = Array.isArray(values.selectedLinkedCollectionIds)
                            ? values.selectedLinkedCollectionIds.filter((id): id is string => typeof id === 'string')
                            : []
                        if (selectedLinkedCollectionIds.length > 0) return null
                        return {
                            selectedLinkedCollectionIds: t(
                                'catalogs.attachExisting.requiredSelection',
                                'Select at least one catalog to add.'
                            )
                        }
                    }}
                    canSave={(values) => {
                        const selectedLinkedCollectionIds = Array.isArray(values.selectedLinkedCollectionIds)
                            ? values.selectedLinkedCollectionIds.filter((id): id is string => typeof id === 'string')
                            : []
                        return !isAttachingExisting && selectedLinkedCollectionIds.length > 0
                    }}
                />

                {/* Independent ConfirmDeleteDialog */}
                <ConfirmDeleteDialog
                    open={dialogs.delete.open}
                    title={t('catalogs.deleteDialog.title')}
                    description={t('catalogs.deleteDialog.message')}
                    confirmButtonText={tc('actions.delete', 'Delete')}
                    deletingButtonText={tc('actions.deleting', 'Deleting...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onCancel={() => close('delete')}
                    onConfirm={() => {
                        if (!dialogs.delete.item || !metahubId) return

                        const deletingLinkedCollectionId = dialogs.delete.item.id
                        const targetTreeEntityId = isHubScoped ? treeEntityId! : dialogs.delete.item.treeEntities?.[0]?.id || ''
                        deleteLinkedCollectionMutation.mutate(
                            {
                                metahubId,
                                treeEntityId: targetTreeEntityId,
                                linkedCollectionId: deletingLinkedCollectionId,
                                force: !isHubScoped,
                                kindKey: entityKindKey
                            },
                            {
                                onSuccess: () => {
                                    queryClient.removeQueries({
                                        queryKey: metahubsQueryKeys.blockingLinkedCollectionReferences(
                                            metahubId,
                                            deletingLinkedCollectionId,
                                            entityKindKey
                                        )
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
                                            : t('catalogs.deleteError')
                                    enqueueSnackbar(message, { variant: 'error' })
                                }
                            }
                        )
                    }}
                />

                <LinkedCollectionDeleteDialog
                    open={blockingDeleteDialogState.open}
                    catalog={blockingDeleteDialogState.entity}
                    metahubId={metahubId}
                    onClose={closeBlockingDelete}
                    onConfirm={(catalog) => {
                        const targetTreeEntityId = isHubScoped ? treeEntityId : catalog.treeEntities?.[0]?.id
                        deleteLinkedCollectionMutation.mutate(
                            {
                                metahubId,
                                treeEntityId: targetTreeEntityId,
                                linkedCollectionId: catalog.id,
                                force: !isHubScoped,
                                kindKey: entityKindKey
                            },
                            {
                                onSuccess: () => {
                                    queryClient.removeQueries({
                                        queryKey: metahubsQueryKeys.blockingLinkedCollectionReferences(metahubId, catalog.id, entityKindKey)
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
                                            : t('catalogs.deleteError')
                                    enqueueSnackbar(message, { variant: 'error' })
                                }
                            }
                        )
                    }}
                    isDeleting={deleteLinkedCollectionMutation.isPending}
                    uiLocale={i18n.language}
                />

                {/* Conflict Resolution Dialog for optimistic locking */}
                <ConflictResolutionDialog
                    open={dialogs.conflict.open}
                    conflict={(dialogs.conflict.data as { conflict?: ConflictInfo })?.conflict ?? null}
                    onOverwrite={async () => {
                        const conflictData = dialogs.conflict.data as {
                            conflict?: ConflictInfo
                            pendingData?: LinkedCollectionLocalizedPayload
                            linkedCollectionId?: string
                        } | null
                        if (!metahubId || !conflictData?.linkedCollectionId || !conflictData?.pendingData) return
                        try {
                            const catalog = catalogMap.get(conflictData.linkedCollectionId)
                            const targetTreeEntityId = isHubScoped ? treeEntityId! : catalog?.treeEntities?.[0]?.id
                            // Retry without expectedVersion to force overwrite
                            if (targetTreeEntityId) {
                                await updateLinkedCollectionMutation.mutateAsync({
                                    metahubId,
                                    treeEntityId: targetTreeEntityId,
                                    linkedCollectionId: conflictData.linkedCollectionId,
                                    kindKey: entityKindKey,
                                    data: conflictData.pendingData
                                })
                            } else {
                                await updateLinkedCollectionAtMetahubMutation.mutateAsync({
                                    metahubId,
                                    linkedCollectionId: conflictData.linkedCollectionId,
                                    kindKey: entityKindKey,
                                    data: conflictData.pendingData
                                })
                            }
                            close('conflict')
                            enqueueSnackbar(t('catalogs.updateSuccess', 'LinkedCollectionEntity updated'), { variant: 'success' })
                        } catch (e) {
                            console.error('Failed to overwrite catalog', e)
                            enqueueSnackbar(t('catalogs.updateError', 'Failed to update catalog'), { variant: 'error' })
                        }
                    }}
                    onReload={async () => {
                        // Reload the list to get latest data
                        if (metahubId) {
                            if (isHubScoped && treeEntityId) {
                                await invalidateLinkedCollectionsQueries.all(queryClient, metahubId, treeEntityId, entityKindKey)
                            } else {
                                await queryClient.invalidateQueries({
                                    queryKey: metahubsQueryKeys.allLinkedCollectionsScope(metahubId, entityKindKey)
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

const LinkedCollectionList = () => <LinkedCollectionListContent />

export default LinkedCollectionList
