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
    useCreateObjectCollection,
    useCreateObjectCollectionAtMetahub,
    useUpdateObjectCollection,
    useUpdateObjectCollectionAtMetahub,
    useDeleteObjectCollection,
    useCopyObjectCollection,
    useReorderObjectCollection
} from '../hooks/objectCollectionMutations'
import { useObjectCollectionListData } from '../hooks/useObjectCollectionListData'
import { useStandardEntityListState, createEntityCopyCallback } from '../hooks/useStandardEntityListState'
import { STORAGE_KEYS } from '../../../../view-preferences/storage'
import * as objectsApi from '../api/objectCollections'
import type { ObjectCollectionWithContainers } from '../api/objectCollections'
import { invalidateObjectCollectionsQueries, metahubsQueryKeys } from '../../../shared'
import {
    DEFAULT_OBJECT_RECORD_BEHAVIOR,
    DEFAULT_LEDGER_CONFIG,
    normalizeObjectRecordBehavior,
    normalizeObjectRecordBehaviorFromConfig,
    normalizeLedgerConfig,
    normalizeLedgerConfigFromConfig,
    supportsLedgerSchema,
    supportsRecordBehavior,
    type ObjectRecordBehavior,
    type LedgerConfig,
    type VersionedLocalizedContent
} from '@universo/types'
import { isOptimisticLockConflict, extractConflictInfo, isPendingEntity, getPendingAction, type ConflictInfo } from '@universo/utils'
import { ObjectCollectionLocalizedPayload, getVLCString } from '../../../../types'
import { normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../../utils/codename'
import { ensureLocalizedContent, extractLocalizedInput, hasPrimaryContent } from '../../../../utils/localizedInput'
import { useCodenameConfig } from '../../../settings/hooks/useCodenameConfig'
import { useMetahubPrimaryLocale } from '../../../settings/hooks/useMetahubPrimaryLocale'
import { ObjectCollectionDeleteDialog, ContainerSelectionPanel, ExistingCodenamesProvider } from '../../../../components'
import objectCollectionActions, { ObjectCollectionDisplayWithContainer, ObjectCollectionLayoutTabFields } from './ObjectCollectionActions'
import GeneralTabFields from '../../../shared/ui/GeneralTabFields'
import { useMetahubDetails } from '../../../metahubs/hooks'
import * as entitiesApi from '../../api'
import { useAllEntityTypesQuery } from '../../hooks'
import RecordBehaviorFields from '../../ui/RecordBehaviorFields'
import type { RecordBehaviorOption } from '../../ui/RecordBehaviorFields'
import LedgerSchemaFields from '../../ui/LedgerSchemaFields'
import {
    type ObjectCollectionFormValues,
    type ObjectCollectionMenuBaseContext,
    type ConfirmSpec,
    DIALOG_SAVE_CANCEL,
    extractResponseStatus,
    extractResponseMessage,
    toObjectCollectionWithContainersDisplay
} from './objectCollectionListUtils'
import { buildObjectCollectionAuthoringPath } from './objectCollectionRoutePaths'
import { buildTreeEntityAuthoringPath, resolveEntityChildKindKey } from '../../../shared/entityMetadataRoutePaths'

type GenericFormValues = Record<string, unknown>

const isRecordValue = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value))

const getRecordBehaviorFormValue = (value: unknown): ObjectRecordBehavior => normalizeObjectRecordBehavior(value)
const getLedgerConfigFormValue = (value: unknown): LedgerConfig => normalizeLedgerConfig(value)
const hasLedgerConfig = (config: unknown): boolean =>
    Boolean(config && typeof config === 'object' && !Array.isArray(config) && 'ledger' in config)

const toRecordBehaviorOption = (entity: { id: string; codename?: unknown; name?: unknown }, uiLocale: string): RecordBehaviorOption => {
    const codename = getVLCString(entity.codename as VersionedLocalizedContent<string> | string | undefined, uiLocale) || entity.id
    const label = getVLCString(entity.name as VersionedLocalizedContent<string> | string | undefined, uiLocale) || codename
    return { codename, label }
}

const validateRecordBehaviorValue = (
    behavior: ObjectRecordBehavior,
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

export const ObjectCollectionListContent = () => {
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
        sortedObjectCollections,
        images,
        objectMap,
        allObjectCollectionsById,
        existingObjectCodenames,
        attachableExistingObjectCollections,
        allowCopy,
        allowDelete,
        allowAttachExistingEntities
    } = useObjectCollectionListData()
    const buildObjectPath = useCallback(
        (objectCollectionId: string) =>
            buildObjectCollectionAuthoringPath({
                metahubId,
                treeEntityId: isHubScoped ? treeEntityId : null,
                kindKey,
                objectCollectionId,
                tab: 'components'
            }),
        [treeEntityId, isHubScoped, kindKey, metahubId]
    )
    const buildHubPath = useCallback(
        (tab: 'treeEntities' | 'objectCollections' | 'valueGroups' | 'optionLists') =>
            buildTreeEntityAuthoringPath({
                metahubId,
                treeEntityId,
                kindKey,
                tab
            }),
        [treeEntityId, kindKey, metahubId]
    )
    const buildAssociatedHubObjectPath = useCallback(
        (nextTreeEntityId: string) =>
            buildTreeEntityAuthoringPath({
                metahubId,
                treeEntityId: nextTreeEntityId,
                kindKey: resolveEntityChildKindKey({ routeKindKey: kindKey, childObjectKind: 'hub' }),
                tab: 'objectCollections'
            }),
        [kindKey, metahubId]
    )
    const metahubDetailsQuery = useMetahubDetails(metahubId ?? '', { enabled: Boolean(metahubId) })
    const canEditObjectCollections = metahubDetailsQuery.data?.permissions?.editContent === true
    const canDeleteObjectCollections = metahubDetailsQuery.data?.permissions?.deleteContent === true
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
    } = useStandardEntityListState<ObjectCollectionWithContainers>(
        isHubScoped ? STORAGE_KEYS.OBJECT_COLLECTION_DISPLAY_STYLE : STORAGE_KEYS.ALL_OBJECT_COLLECTIONS_DISPLAY_STYLE
    )
    const entityTypesQuery = useAllEntityTypesQuery(metahubId)
    const objectEntityType = useMemo(
        () => (entityTypesQuery.data?.items ?? []).find((item) => item.kindKey === entityKindKey) ?? null,
        [entityKindKey, entityTypesQuery.data?.items]
    )
    const objectRequestedTabs = useMemo(() => new Set(objectEntityType?.ui.tabs ?? []), [objectEntityType?.ui.tabs])
    const objectHasRecordBehaviorConfig = Boolean(
        isRecordValue(objectEntityType?.config) && isRecordValue(objectEntityType.config.recordBehavior)
    )
    const showRecordBehaviorTab = Boolean(
        objectEntityType &&
            supportsRecordBehavior(objectEntityType.capabilities) &&
            (objectRequestedTabs.has('behavior') || objectHasRecordBehaviorConfig)
    )
    const objectHasLedgerConfig = Boolean(isRecordValue(objectEntityType?.config) && isRecordValue(objectEntityType.config.ledger))
    const showLedgerSchemaTab = Boolean(
        objectEntityType &&
            supportsLedgerSchema(objectEntityType.capabilities) &&
            (objectRequestedTabs.has('ledgerSchema') || objectHasLedgerConfig)
    )
    const ledgerCandidateKindKeys = useMemo(
        () =>
            (entityTypesQuery.data?.items ?? [])
                .filter((type) => supportsLedgerSchema(type.capabilities))
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
                    : ['metahubs', 'objects', 'recordBehavior', 'ledgers', 'empty', kind],
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
    const [pendingObjectNavigation, setPendingObjectNavigation] = useState<{ pendingId: string; codename: string } | null>(null)
    const pendingInteractionMessage = tc('pendingCreateBlocked', 'This item is still being created. Please wait a moment and try again.')

    const filteredObjectCollectionActions = useMemo(
        () =>
            objectCollectionActions.filter((a) => {
                if (a.id === 'edit' && !canEditObjectCollections) return false
                if (a.id === 'copy' && (!canEditObjectCollections || !allowCopy)) return false
                if (a.id === 'delete' && (!canDeleteObjectCollections || !allowDelete)) return false
                return true
            }),
        [allowCopy, allowDelete, canDeleteObjectCollections, canEditObjectCollections]
    )

    const createObjectCollectionMutation = useCreateObjectCollection()
    const createObjectCollectionAtMetahubMutation = useCreateObjectCollectionAtMetahub()
    const updateObjectCollectionMutation = useUpdateObjectCollection()
    const deleteObjectCollectionMutation = useDeleteObjectCollection()
    const updateObjectCollectionAtMetahubMutation = useUpdateObjectCollectionAtMetahub()
    const copyObjectCollectionMutation = useCopyObjectCollection()
    const reorderObjectCollectionMutation = useReorderObjectCollection()

    useEffect(() => {
        if (!pendingObjectNavigation || !metahubId) return

        if (sortedObjectCollections.some((object) => object.id === pendingObjectNavigation.pendingId)) {
            return
        }

        const resolvedObject = sortedObjectCollections.find(
            (object) => !isPendingEntity(object) && object.codename === pendingObjectNavigation.codename
        )

        if (!resolvedObject) return

        setPendingObjectNavigation(null)
        const nextPath = buildObjectPath(resolvedObject.id)
        if (nextPath) {
            navigate(nextPath)
        }
    }, [buildObjectPath, metahubId, navigate, pendingObjectNavigation, sortedObjectCollections])

    const handlePendingObjectInteraction = useCallback(
        (pendingObjectCollectionId: string) => {
            if (!metahubId) return
            const pendingObject = objectMap.get(pendingObjectCollectionId)
            if (pendingObject?.codename) {
                setPendingObjectNavigation({ pendingId: pendingObject.id, codename: pendingObject.codename })
            }
            revealPendingEntityFeedback({
                queryClient,
                queryKeyPrefix:
                    isHubScoped && treeEntityId
                        ? metahubsQueryKeys.objectCollectionsScope(metahubId, treeEntityId, entityKindKey)
                        : metahubsQueryKeys.allObjectCollectionsScope(metahubId, entityKindKey),
                entityId: pendingObjectCollectionId,
                extraQueryKeys: [
                    isHubScoped && treeEntityId
                        ? metahubsQueryKeys.objectCollectionDetailInTreeEntity(
                              metahubId,
                              treeEntityId,
                              pendingObjectCollectionId,
                              entityKindKey
                          )
                        : metahubsQueryKeys.objectCollectionDetail(metahubId, pendingObjectCollectionId, entityKindKey)
                ]
            })
            enqueueSnackbar(pendingInteractionMessage, { variant: 'info' })
        },
        [objectMap, enqueueSnackbar, treeEntityId, isHubScoped, metahubId, pendingInteractionMessage, queryClient, entityKindKey]
    )

    const attachExistingObjectSelectionLabels = useMemo<EntitySelectionLabels>(
        () => ({
            title: t('objects.attachExisting.selectionTitle', 'ObjectCollections'),
            addButton: t('common:actions.add', 'Add'),
            dialogTitle: t('objects.attachExisting.selectDialogTitle', 'Select objectCollections'),
            emptyMessage: t('objects.attachExisting.emptySelection', 'No objectCollections selected'),
            noAvailableMessage: t('objects.attachExisting.noAvailable', 'No objectCollections available to add'),
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
    const localizedFormDefaults = useMemo<ObjectCollectionFormValues>(
        () => ({
            nameVlc: null,
            descriptionVlc: null,
            codename: null,
            codenameTouched: false,
            treeEntityIds: treeEntityId ? [treeEntityId] : [], // Auto-select current hub
            isSingleHub: false,
            isRequiredHub: false, // Default: object can exist without treeEntities
            recordBehavior:
                showRecordBehaviorTab && objectEntityType?.config
                    ? normalizeObjectRecordBehaviorFromConfig(objectEntityType.config)
                    : DEFAULT_OBJECT_RECORD_BEHAVIOR,
            ledgerSchemaEnabled: showLedgerSchemaTab && hasLedgerConfig(objectEntityType?.config),
            ledgerConfig:
                showLedgerSchemaTab && objectEntityType?.config
                    ? normalizeLedgerConfigFromConfig(objectEntityType.config)
                    : DEFAULT_LEDGER_CONFIG
        }),
        [objectEntityType?.config, showLedgerSchemaTab, showRecordBehaviorTab, treeEntityId]
    )

    const validateObjectCollectionForm = useCallback(
        (values: GenericFormValues) => {
            const errors: Record<string, string> = {}
            const treeEntityIds = Array.isArray(values.treeEntityIds) ? values.treeEntityIds : []
            const isRequiredHub = Boolean(values.isRequiredHub)
            // TreeEntity validation only if isRequiredHub is true
            if (isRequiredHub && treeEntityIds.length === 0) {
                errors.treeEntityIds = t('objects.validation.hubRequired', 'At least one hub is required')
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
                errors.codename = t('objects.validation.codenameRequired', 'Codename is required')
            } else if (
                !isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            ) {
                errors.codename = t('objects.validation.codenameInvalid', 'Codename contains invalid characters')
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

    const canSaveObjectCollectionForm = useCallback(
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
                    label: t('objects.tabs.general', 'Основное'),
                    content: (
                        <GeneralTabFields
                            values={values}
                            setValue={setValue}
                            isLoading={isFormLoading}
                            errors={errors}
                            uiLocale={preferredVlcLocale}
                            nameLabel={tc('fields.name', 'Name')}
                            descriptionLabel={tc('fields.description', 'Description')}
                            codenameLabel={t('objects.codename', 'Codename')}
                            codenameHelper={t('objects.codenameHelper', 'Unique identifier')}
                        />
                    )
                }
            ]

            if (showRecordBehaviorTab && objectEntityType) {
                tabs.push({
                    id: 'behavior',
                    label: t('entities.instances.tabs.behavior', 'Behavior'),
                    content: (
                        <RecordBehaviorFields
                            value={getRecordBehaviorFormValue(values.recordBehavior)}
                            onChange={(nextValue) => setValue('recordBehavior', nextValue)}
                            disabled={isFormLoading}
                            capabilities={objectEntityType.capabilities}
                            fieldOptions={[]}
                            ledgerOptions={behaviorLedgerOptions}
                            scriptOptions={[]}
                            errors={errors}
                        />
                    )
                })
            }

            if (showLedgerSchemaTab && objectEntityType) {
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
                                    capabilities={objectEntityType.capabilities}
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
                    label: t('objects.tabs.treeEntities', 'Хабы'),
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
                    label: t('objects.tabs.layout', 'Layout'),
                    content: (
                        <ObjectCollectionLayoutTabFields
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
            objectEntityType,
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

    const objectColumns = useMemo(() => {
        // Base columns for both modes
        const baseColumns = [
            {
                id: 'sortOrder',
                label: t('components.table.order', '#'),
                width: '4%',
                align: 'center' as const,
                sortable: true,
                sortAccessor: (row: ObjectCollectionWithContainersDisplay) => row.sortOrder ?? 0,
                render: (row: ObjectCollectionWithContainersDisplay) => (
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
                sortAccessor: (row: ObjectCollectionWithContainersDisplay) => row.name?.toLowerCase() ?? '',
                render: (row: ObjectCollectionWithContainersDisplay) => {
                    const href = buildObjectPath(row.id)
                    return isPendingEntity(row) ? (
                        <ButtonBase
                            onClick={() => handlePendingObjectInteraction(row.id)}
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
                sortAccessor: (row: ObjectCollectionWithContainersDisplay) => row.description?.toLowerCase() ?? '',
                render: (row: ObjectCollectionWithContainersDisplay) => (
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
                label: t('objects.codename', 'Codename'),
                width: '15%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: ObjectCollectionWithContainersDisplay) => row.codename?.toLowerCase() ?? '',
                render: (row: ObjectCollectionWithContainersDisplay) => (
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
            render: (row: ObjectCollectionWithContainersDisplay) => (
                <Stack direction='column' spacing={0.5}>
                    {row.allTreeEntities.map((hub) =>
                        isPendingEntity(row) ? (
                            <Chip
                                key={hub.id}
                                label={hub.name}
                                size='small'
                                variant='outlined'
                                clickable
                                onClick={() => handlePendingObjectInteraction(row.id)}
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
                                to={buildAssociatedHubObjectPath(hub.id)}
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
                id: 'componentsCount',
                label: t('objects.componentsHeader', 'Components'),
                width: '10%',
                align: 'center' as const,
                render: (row: ObjectCollectionWithContainersDisplay) =>
                    typeof row.componentsCount === 'number' ? (
                        isPendingEntity(row) ? (
                            <ButtonBase onClick={() => handlePendingObjectInteraction(row.id)}>
                                <Typography
                                    sx={{
                                        fontSize: 14,
                                        '&:hover': {
                                            textDecoration: 'underline',
                                            color: 'primary.main'
                                        }
                                    }}
                                >
                                    {row.componentsCount}
                                </Typography>
                            </ButtonBase>
                        ) : (
                            <Link to={buildObjectPath(row.id)} style={{ textDecoration: 'none', color: 'inherit' }}>
                                <Typography
                                    sx={{
                                        fontSize: 14,
                                        '&:hover': {
                                            textDecoration: 'underline',
                                            color: 'primary.main'
                                        }
                                    }}
                                >
                                    {row.componentsCount}
                                </Typography>
                            </Link>
                        )
                    ) : (
                        '—'
                    )
            },
            {
                id: 'recordsCount',
                label: t('objects.elementsHeader', 'Records'),
                width: '10%',
                align: 'center' as const,
                render: (row: ObjectCollectionWithContainersDisplay) => (typeof row.recordsCount === 'number' ? row.recordsCount : '—')
            }
        ]

        // Combine columns based on mode
        if (isHubScoped) {
            return [...baseColumns, ...countColumns]
        } else {
            return [...baseColumns, hubColumn, ...countColumns]
        }
    }, [buildAssociatedHubObjectPath, buildObjectPath, handlePendingObjectInteraction, isHubScoped, t, tc])

    const createObjectCollectionContext = useCallback(
        (baseContext: ObjectCollectionMenuBaseContext) => ({
            ...baseContext,
            objectMap,
            metahubId,
            uiLocale: preferredVlcLocale,
            treeEntities, // Pass treeEntities for hub selector in edit dialog (N:M)
            currentTreeEntityId: isHubScoped ? treeEntityId ?? null : null,
            routeKindKey: kindKey ?? null,
            recordBehaviorEnabled: showRecordBehaviorTab,
            recordBehaviorComponents: objectEntityType?.capabilities ?? null,
            recordBehaviorDefaultConfig: objectEntityType?.config ?? null,
            ledgerSchemaEnabled: showLedgerSchemaTab,
            ledgerSchemaComponents: objectEntityType?.capabilities ?? null,
            ledgerSchemaDefaultConfig: objectEntityType?.config ?? null,
            ledgerCandidateKindKeys,
            ledgerEntityKindOptions,
            api: {
                updateEntity: (id: string, patch: ObjectCollectionLocalizedPayload & { expectedVersion?: number }) => {
                    if (!metahubId) return Promise.resolve()
                    const object = objectMap.get(id)
                    const rawCodename = getVLCString(patch.codename, patch.codename?._primary ?? 'en')
                    const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
                    if (!normalizedCodename) {
                        throw new Error(t('objects.validation.codenameRequired', 'Codename is required'))
                    }
                    const codenamePayload = ensureLocalizedContent(patch.codename, patch.codename?._primary ?? 'en', normalizedCodename)
                    // Include expectedVersion for optimistic locking if object has version
                    const expectedVersion = object?.version
                    const dataWithVersion = { ...patch, codename: codenamePayload, expectedVersion }

                    // In hub-scoped mode, use treeEntityId from URL; in global mode, check if object has treeEntities
                    const targetTreeEntityId = isHubScoped ? treeEntityId! : object?.treeEntities?.[0]?.id
                    const mutationOptions = {
                        onError: (error: unknown) => {
                            if (!isOptimisticLockConflict(error)) return
                            const conflict = extractConflictInfo(error)
                            if (!conflict) return
                            openConflict({
                                conflict,
                                pendingData: { ...patch, codename: codenamePayload },
                                objectCollectionId: id
                            })
                        }
                    }

                    if (targetTreeEntityId) {
                        updateObjectCollectionMutation.mutate(
                            {
                                metahubId,
                                treeEntityId: targetTreeEntityId,
                                objectCollectionId: id,
                                kindKey: entityKindKey,
                                data: dataWithVersion
                            },
                            { onError: mutationOptions.onError }
                        )
                    } else {
                        updateObjectCollectionAtMetahubMutation.mutate(
                            {
                                metahubId,
                                objectCollectionId: id,
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
                    const object = objectMap.get(id)

                    if (isHubScoped && treeEntityId) {
                        // TreeEntity-scoped mode: use treeEntityId from URL
                        return deleteObjectCollectionMutation.mutateAsync({
                            metahubId,
                            treeEntityId,
                            objectCollectionId: id,
                            force: false,
                            kindKey: entityKindKey
                        })
                    } else {
                        // Global mode: check if object has treeEntities
                        const targetTreeEntityId = object?.treeEntities?.[0]?.id
                        return deleteObjectCollectionMutation.mutateAsync({
                            metahubId,
                            treeEntityId: targetTreeEntityId, // undefined for objectCollections without treeEntities
                            objectCollectionId: id,
                            force: Boolean(targetTreeEntityId), // force=true if has multiple treeEntities
                            kindKey: entityKindKey
                        })
                    }
                },
                copyEntity: createEntityCopyCallback<ObjectCollectionLocalizedPayload & Record<string, unknown>>({
                    metahubId,
                    mutation: copyObjectCollectionMutation,
                    entityIdKey: 'objectCollectionId',
                    kindKey: entityKindKey
                })
            },
            helpers: {
                refreshList: () => {
                    if (metahubId) {
                        if (isHubScoped && treeEntityId) {
                            void invalidateObjectCollectionsQueries.all(queryClient, metahubId, treeEntityId, entityKindKey)
                        } else {
                            // In global mode, invalidate all objectCollections cache
                            void queryClient.invalidateQueries({
                                queryKey: metahubsQueryKeys.allObjectCollectionsScope(metahubId, entityKindKey)
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
                openDeleteDialog: (entity: ObjectCollectionDisplayWithContainer | ObjectCollectionDisplay) => {
                    const object = objectMap.get(entity.id)
                    if (!object) return
                    const containersCount = Array.isArray(object.treeEntities) ? object.treeEntities.length : 0
                    const willDeleteObject = !isHubScoped || (!object.isRequiredHub && containersCount === 1)

                    if (willDeleteObject) {
                        openBlockingDelete(object)
                        return
                    }

                    openDelete(object)
                }
            }
        }),
        [
            confirm,
            copyObjectCollectionMutation,
            codenameConfig.alphabet,
            codenameConfig.style,
            deleteObjectCollectionMutation,
            enqueueSnackbar,
            objectMap,
            objectEntityType?.capabilities,
            objectEntityType?.config,
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
            updateObjectCollectionMutation,
            updateObjectCollectionAtMetahubMutation
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

    const handleAttachExistingObjectCollections = async (data: GenericFormValues) => {
        if (!metahubId || !treeEntityId) return

        const selectedObjectCollectionIds = Array.isArray(data.selectedObjectCollectionIds)
            ? data.selectedObjectCollectionIds.filter((id): id is string => typeof id === 'string')
            : []
        if (selectedObjectCollectionIds.length === 0) {
            return
        }

        setAttachDialogError(null)
        setAttachingExisting(true)
        try {
            const selectedObjectCollections = selectedObjectCollectionIds
                .map((objectCollectionId) => allObjectCollectionsById.get(objectCollectionId))
                .filter((object): object is ObjectCollectionWithContainers => Boolean(object))
            const failed: string[] = []

            for (const object of selectedObjectCollections) {
                try {
                    const currentTreeEntityIds = Array.isArray(object.treeEntities) ? object.treeEntities.map((hub) => hub.id) : []
                    const nextTreeEntityIds = Array.from(new Set([...currentTreeEntityIds, treeEntityId]))
                    await objectsApi.updateObjectCollectionAtMetahub(metahubId, object.id, {
                        treeEntityIds: nextTreeEntityIds,
                        expectedVersion: object.version,
                        kindKey: entityKindKey
                    })
                } catch (error) {
                    failed.push(getVLCString(object.name, preferredVlcLocale) || getVLCString(object.name, 'en') || object.codename)
                    // eslint-disable-next-line no-console
                    console.error('Failed to attach existing object to current hub', error)
                }
            }

            await Promise.all([
                invalidateObjectCollectionsQueries.all(queryClient, metahubId, treeEntityId, entityKindKey),
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allObjectCollectionsScope(metahubId, entityKindKey) })
            ])

            if (failed.length === 0) {
                enqueueSnackbar(
                    t('objects.attachExisting.success', {
                        count: selectedObjectCollections.length,
                        defaultValue: 'Added {{count}} object(s).'
                    }),
                    { variant: 'success' }
                )
                setAttachDialogOpen(false)
                return
            }

            const successCount = selectedObjectCollections.length - failed.length
            if (successCount > 0) {
                enqueueSnackbar(
                    t('objects.attachExisting.partialSuccess', {
                        successCount,
                        failCount: failed.length,
                        defaultValue: 'Added {{successCount}} object(s). {{failCount}} object(s) could not be linked.'
                    }),
                    { variant: 'warning' }
                )
                setAttachDialogOpen(false)
                return
            }

            setAttachDialogError(
                t('objects.attachExisting.failedAll', {
                    defaultValue: 'Selected objectCollections could not be linked to this hub. Please review restrictions and try again.'
                })
            )
        } finally {
            setAttachingExisting(false)
        }
    }

    const handleCreateObjectCollection = async (data: GenericFormValues) => {
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

        // Confirm dialog for detached object (async — throws DIALOG_SAVE_CANCEL if cancelled)
        if (isHubScoped && treeEntityId && !treeEntityIds.includes(treeEntityId)) {
            const confirmed = await confirm({
                title: t('objects.detachedConfirm.title', 'Create object without current hub?'),
                description: t(
                    'objects.detachedConfirm.description',
                    'This object is not linked to the current hub and will not appear in this hub after creation.'
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
        const objectPayload = {
            codename: codenamePayload,
            name: nameInput ?? {},
            description: descriptionInput,
            namePrimaryLocale: namePrimaryLocale ?? '',
            descriptionPrimaryLocale,
            treeEntityIds,
            isSingleHub,
            isRequiredHub,
            ...(showRecordBehaviorTab ? { recordBehavior: normalizeObjectRecordBehavior(data.recordBehavior) } : {}),
            ...(showLedgerSchemaTab
                ? { ledgerConfig: data.ledgerSchemaEnabled === true ? normalizeLedgerConfig(data.ledgerConfig) : null }
                : {})
        }

        if (treeEntityIds.length > 0) {
            const primaryTreeEntityId = treeEntityIds[0]
            createObjectCollectionMutation.mutate({
                metahubId: metahubId!,
                treeEntityId: primaryTreeEntityId,
                kindKey: entityKindKey,
                data: objectPayload
            })
        } else {
            createObjectCollectionAtMetahubMutation.mutate({
                metahubId: metahubId!,
                kindKey: entityKindKey,
                data: objectPayload
            })
        }
    }

    const goToObject = (object: ObjectCollectionWithContainers) => {
        const nextPath = buildObjectPath(object.id)
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
        const nextPath = buildHubPath('objectCollections')
        if (nextPath) {
            navigate(nextPath)
        }
    }

    // Transform Object data for display - use hub-aware version for global mode
    const getObjectCardData = (object: ObjectCollectionWithContainers): ObjectCollectionWithContainersDisplay =>
        toObjectCollectionWithContainersDisplay(object, i18n.language)
    const showAttachExistingAction = isHubScoped && allowAttachExistingEntities
    const hasAttachableExistingObjectCollections = attachableExistingObjectCollections.length > 0

    const handleSortableDragEnd = async (event: DragEndEvent) => {
        if (!metahubId) return
        const { active, over } = event
        if (!over || active.id === over.id) return

        const overObject = sortedObjectCollections.find((object) => object.id === String(over.id))
        if (!overObject) return

        try {
            await reorderObjectCollectionMutation.mutateAsync({
                metahubId,
                treeEntityId,
                objectCollectionId: String(active.id),
                newSortOrder: overObject.sortOrder ?? 1,
                kindKey: entityKindKey
            })
            enqueueSnackbar(t('objects.reorderSuccess', 'Object order updated'), { variant: 'success' })
        } catch (error: unknown) {
            const message =
                typeof error === 'object' &&
                error !== null &&
                'message' in error &&
                typeof (error as { message?: unknown }).message === 'string'
                    ? (error as { message: string }).message
                    : t('objects.reorderError', 'Failed to reorder object')
            enqueueSnackbar(message, { variant: 'error' })
        }
    }

    const renderDragOverlay = (activeId: string | null) => {
        if (!activeId) return null
        const object = objectMap.get(activeId)
        if (!object) return null
        const display = getObjectCardData(object)
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
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{display.name || display.codename || object.id}</Typography>
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
            <ExistingCodenamesProvider entities={existingObjectCodenames}>
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
                            searchPlaceholder={t('objects.searchPlaceholder')}
                            onSearchChange={handleSearchChange}
                            title={isHubScoped ? t('objects.title') : t('objects.allTitle')}
                        >
                            <ToolbarControls
                                viewToggleEnabled
                                viewMode={view as 'card' | 'list'}
                                onViewModeChange={(mode: string) => handleChange(null, mode)}
                                cardViewTitle={tc('cardView')}
                                listViewTitle={tc('listView')}
                                primaryAction={
                                    canEditObjectCollections
                                        ? {
                                              label: tc('create'),
                                              onClick: handleAddNew,
                                              startIcon: <AddRoundedIcon />
                                          }
                                        : undefined
                                }
                                primaryActionMenuItems={
                                    canEditObjectCollections && showAttachExistingAction && hasAttachableExistingObjectCollections
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
                                    value='objectCollections'
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
                            {isLoading && sortedObjectCollections.length === 0 ? (
                                view === 'card' ? (
                                    <SkeletonGrid insetMode='content' />
                                ) : (
                                    <Skeleton variant='rectangular' height={120} />
                                )
                            ) : !isLoading && sortedObjectCollections.length === 0 ? (
                                <EmptyListState
                                    image={APIEmptySVG}
                                    imageAlt='No objectCollections'
                                    title={searchValue ? t('objects.noSearchResults') : t('objects.empty')}
                                    description={searchValue ? t('objects.noSearchResultsHint') : t('objects.emptyDescription')}
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
                                            {sortedObjectCollections.map((object: ObjectCollectionWithContainers) => {
                                                const descriptors = [...filteredObjectCollectionActions]
                                                const displayData = getObjectCardData(object)

                                                return (
                                                    <ItemCard
                                                        key={object.id}
                                                        data={displayData}
                                                        images={images[object.id] || []}
                                                        onClick={() => goToObject(object)}
                                                        pending={isPendingEntity(object)}
                                                        pendingAction={getPendingAction(object)}
                                                        onPendingInteractionAttempt={() => handlePendingObjectInteraction(object.id)}
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
                                                                {typeof object.componentsCount === 'number' && (
                                                                    <Typography variant='caption' color='text.secondary'>
                                                                        {t('objects.componentsCount', {
                                                                            count: object.componentsCount
                                                                        })}
                                                                    </Typography>
                                                                )}
                                                            </Stack>
                                                        }
                                                        headerAction={
                                                            descriptors.length > 0 ? (
                                                                <Box onClick={(e) => e.stopPropagation()}>
                                                                    <BaseEntityMenu<
                                                                        ObjectCollectionDisplayWithContainer,
                                                                        ObjectCollectionLocalizedPayload
                                                                    >
                                                                        entity={displayData}
                                                                        entityKind='object'
                                                                        descriptors={descriptors}
                                                                        namespace='metahubs'
                                                                        i18nInstance={i18n}
                                                                        createContext={createObjectCollectionContext}
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
                                                data={sortedObjectCollections.map(getObjectCardData)}
                                                images={images}
                                                isLoading={isLoading}
                                                sortableRows
                                                sortableItemIds={sortedObjectCollections.map((object) => object.id)}
                                                dragHandleAriaLabel={t('objects.dnd.dragHandle', 'Drag to reorder')}
                                                dragDisabled={reorderObjectCollectionMutation.isPending || isLoading}
                                                onSortableDragEnd={handleSortableDragEnd}
                                                renderDragOverlay={renderDragOverlay}
                                                getRowLink={(row: ObjectCollectionWithContainersDisplay) =>
                                                    row?.id ? buildObjectPath(row.id) || undefined : undefined
                                                }
                                                onPendingInteractionAttempt={(row: ObjectCollectionWithContainersDisplay) =>
                                                    handlePendingObjectInteraction(row.id)
                                                }
                                                customColumns={objectColumns}
                                                i18nNamespace='flowList'
                                                renderActions={(row: ObjectCollectionWithContainersDisplay) => {
                                                    const originalObject = objectMap.get(row.id)
                                                    if (!originalObject) return null

                                                    const descriptors = [...filteredObjectCollectionActions]
                                                    if (!descriptors.length) return null

                                                    return (
                                                        <BaseEntityMenu<
                                                            ObjectCollectionDisplayWithContainer,
                                                            ObjectCollectionLocalizedPayload
                                                        >
                                                            entity={getObjectCardData(originalObject)}
                                                            entityKind='object'
                                                            descriptors={descriptors}
                                                            namespace='metahubs'
                                                            menuButtonLabelKey='flowList:menu.button'
                                                            i18nInstance={i18n}
                                                            createContext={createObjectCollectionContext}
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
                        {!isLoading && sortedObjectCollections.length > 0 && (
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
                    title={t('objects.createDialog.title', 'Create Object')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={tc('actions.create', 'Create')}
                    savingButtonText={tc('actions.creating', 'Creating...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onClose={handleDialogClose}
                    onSave={handleCreateObjectCollection}
                    hideDefaultFields
                    initialExtraValues={localizedFormDefaults}
                    tabs={buildFormTabs}
                    validate={validateObjectCollectionForm}
                    canSave={canSaveObjectCollectionForm}
                />

                <EntityFormDialog
                    open={isAttachDialogOpen}
                    title={t('objects.attachExisting.dialogTitle', 'Add Existing ObjectCollections')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={t('common:actions.add', 'Add')}
                    savingButtonText={t('common:actions.saving', 'Saving...')}
                    cancelButtonText={t('common:actions.cancel', 'Cancel')}
                    loading={isAttachingExisting}
                    error={attachDialogError || undefined}
                    onClose={handleCloseAttachExistingDialog}
                    onSave={handleAttachExistingObjectCollections}
                    hideDefaultFields
                    initialExtraValues={{ selectedObjectCollectionIds: [] }}
                    tabs={({ values, setValue, isLoading, errors }) => {
                        const selectedObjectCollectionIds = Array.isArray(values.selectedObjectCollectionIds)
                            ? values.selectedObjectCollectionIds.filter((id): id is string => typeof id === 'string')
                            : []
                        return [
                            {
                                id: 'objectCollections',
                                label: t('objects.title', 'ObjectCollections'),
                                content: (
                                    <EntitySelectionPanel<ObjectCollectionWithContainers>
                                        availableEntities={attachableExistingObjectCollections}
                                        selectedIds={selectedObjectCollectionIds}
                                        onSelectionChange={(ids) => setValue('selectedObjectCollectionIds', ids)}
                                        getDisplayName={(object) =>
                                            getVLCString(object.name, preferredVlcLocale) ||
                                            getVLCString(object.name, 'en') ||
                                            object.codename ||
                                            '—'
                                        }
                                        getCodename={(object) => object.codename}
                                        labels={attachExistingObjectSelectionLabels}
                                        disabled={isLoading}
                                        error={errors.selectedObjectCollectionIds}
                                    />
                                )
                            }
                        ]
                    }}
                    validate={(values) => {
                        const selectedObjectCollectionIds = Array.isArray(values.selectedObjectCollectionIds)
                            ? values.selectedObjectCollectionIds.filter((id): id is string => typeof id === 'string')
                            : []
                        if (selectedObjectCollectionIds.length > 0) return null
                        return {
                            selectedObjectCollectionIds: t('objects.attachExisting.requiredSelection', 'Select at least one object to add.')
                        }
                    }}
                    canSave={(values) => {
                        const selectedObjectCollectionIds = Array.isArray(values.selectedObjectCollectionIds)
                            ? values.selectedObjectCollectionIds.filter((id): id is string => typeof id === 'string')
                            : []
                        return !isAttachingExisting && selectedObjectCollectionIds.length > 0
                    }}
                />

                {/* Independent ConfirmDeleteDialog */}
                <ConfirmDeleteDialog
                    open={dialogs.delete.open}
                    title={t('objects.deleteDialog.title')}
                    description={t('objects.deleteDialog.message')}
                    confirmButtonText={tc('actions.delete', 'Delete')}
                    deletingButtonText={tc('actions.deleting', 'Deleting...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onCancel={() => close('delete')}
                    onConfirm={() => {
                        if (!dialogs.delete.item || !metahubId) return

                        const deletingObjectCollectionId = dialogs.delete.item.id
                        const targetTreeEntityId = isHubScoped ? treeEntityId! : dialogs.delete.item.treeEntities?.[0]?.id || ''
                        deleteObjectCollectionMutation.mutate(
                            {
                                metahubId,
                                treeEntityId: targetTreeEntityId,
                                objectCollectionId: deletingObjectCollectionId,
                                force: !isHubScoped,
                                kindKey: entityKindKey
                            },
                            {
                                onSuccess: () => {
                                    queryClient.removeQueries({
                                        queryKey: metahubsQueryKeys.blockingObjectCollectionReferences(
                                            metahubId,
                                            deletingObjectCollectionId,
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
                                            : t('objects.deleteError')
                                    enqueueSnackbar(message, { variant: 'error' })
                                }
                            }
                        )
                    }}
                />

                <ObjectCollectionDeleteDialog
                    open={blockingDeleteDialogState.open}
                    objectCollection={blockingDeleteDialogState.entity}
                    metahubId={metahubId}
                    onClose={closeBlockingDelete}
                    onConfirm={(object) => {
                        const targetTreeEntityId = isHubScoped ? treeEntityId : object.treeEntities?.[0]?.id
                        deleteObjectCollectionMutation.mutate(
                            {
                                metahubId,
                                treeEntityId: targetTreeEntityId,
                                objectCollectionId: object.id,
                                force: !isHubScoped,
                                kindKey: entityKindKey
                            },
                            {
                                onSuccess: () => {
                                    queryClient.removeQueries({
                                        queryKey: metahubsQueryKeys.blockingObjectCollectionReferences(metahubId, object.id, entityKindKey)
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
                                            : t('objects.deleteError')
                                    enqueueSnackbar(message, { variant: 'error' })
                                }
                            }
                        )
                    }}
                    isDeleting={deleteObjectCollectionMutation.isPending}
                    uiLocale={i18n.language}
                />

                {/* Conflict Resolution Dialog for optimistic locking */}
                <ConflictResolutionDialog
                    open={dialogs.conflict.open}
                    conflict={(dialogs.conflict.data as { conflict?: ConflictInfo })?.conflict ?? null}
                    onOverwrite={async () => {
                        const conflictData = dialogs.conflict.data as {
                            conflict?: ConflictInfo
                            pendingData?: ObjectCollectionLocalizedPayload
                            objectCollectionId?: string
                        } | null
                        if (!metahubId || !conflictData?.objectCollectionId || !conflictData?.pendingData) return
                        try {
                            const object = objectMap.get(conflictData.objectCollectionId)
                            const targetTreeEntityId = isHubScoped ? treeEntityId! : object?.treeEntities?.[0]?.id
                            // Retry without expectedVersion to force overwrite
                            if (targetTreeEntityId) {
                                await updateObjectCollectionMutation.mutateAsync({
                                    metahubId,
                                    treeEntityId: targetTreeEntityId,
                                    objectCollectionId: conflictData.objectCollectionId,
                                    kindKey: entityKindKey,
                                    data: conflictData.pendingData
                                })
                            } else {
                                await updateObjectCollectionAtMetahubMutation.mutateAsync({
                                    metahubId,
                                    objectCollectionId: conflictData.objectCollectionId,
                                    kindKey: entityKindKey,
                                    data: conflictData.pendingData
                                })
                            }
                            close('conflict')
                            enqueueSnackbar(t('objects.updateSuccess', 'Object updated'), { variant: 'success' })
                        } catch (e) {
                            console.error('Failed to overwrite object', e)
                            enqueueSnackbar(t('objects.updateError', 'Failed to update object'), { variant: 'error' })
                        }
                    }}
                    onReload={async () => {
                        // Reload the list to get latest data
                        if (metahubId) {
                            if (isHubScoped && treeEntityId) {
                                await invalidateObjectCollectionsQueries.all(queryClient, metahubId, treeEntityId, entityKindKey)
                            } else {
                                await queryClient.invalidateQueries({
                                    queryKey: metahubsQueryKeys.allObjectCollectionsScope(metahubId, entityKindKey)
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

const ObjectCollectionList = () => <ObjectCollectionListContent />

export default ObjectCollectionList
