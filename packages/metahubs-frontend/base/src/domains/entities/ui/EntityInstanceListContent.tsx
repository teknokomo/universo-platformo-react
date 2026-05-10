import { useCallback, useMemo, useState } from 'react'
import { Alert, Box, Checkbox, Chip, FormControlLabel, Skeleton, Stack, Tab, Tabs, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useCommonTranslations } from '@universo/i18n'
import type { EntitySelectionLabels } from '@universo/template-mui'
import {
    APIEmptySVG,
    BaseEntityMenu,
    EmptyListState,
    FlowListTable,
    ItemCard,
    PaginationControls,
    SkeletonGrid,
    TemplateMainCard as MainCard,
    ToolbarControls,
    ViewHeaderMUI as ViewHeader,
    createCopyActionIcon,
    createDeleteActionIcon,
    createDeleteForeverActionIcon,
    createEditActionIcon,
    createRestoreActionIcon,
    gridSpacing,
    useDebouncedSearch,
    useListDialogs,
    usePaginated
} from '@universo/template-mui'
import type { ActionDescriptor } from '@universo/template-mui'
import { ConfirmDeleteDialog, ConflictResolutionDialog, EntityFormDialog, type TabConfig } from '@universo/template-mui/components/dialogs'
import {
    DEFAULT_CATALOG_RECORD_BEHAVIOR,
    DEFAULT_LEDGER_CONFIG,
    isEnabledComponentConfig,
    normalizeCatalogRecordBehavior,
    normalizeCatalogRecordBehaviorFromConfig,
    normalizeLedgerConfig,
    normalizeLedgerConfigFromConfig,
    resolveEntityResourceSurfaceTitle,
    supportsLedgerSchema,
    supportsRecordBehavior,
    validateLedgerConfigReferences,
    type BuiltinEntityKind,
    type CatalogRecordBehavior,
    type LedgerConfig,
    type VersionedLocalizedContent
} from '@universo/types'
import { extractConflictInfo, isOptimisticLockConflict, type ConflictInfo } from '@universo/utils'

import { ExistingCodenamesProvider, ContainerSelectionPanel } from '../../../components'
import { STORAGE_KEYS } from '../../../view-preferences/storage'
import { useViewPreference } from '../../../hooks/useViewPreference'
import { getVLCString, type FieldDefinition, type Metahub } from '../../../types'
import { ensureLocalizedContent, extractLocalizedInput, getLocalizedContentText, hasPrimaryContent } from '../../../utils/localizedInput'
import { isValidCodenameForStyle, normalizeCodenameForStyle } from '../../../utils/codename'
import { FieldDefinitionListContent } from '../metadata/fieldDefinition/ui/FieldDefinitionList'
import * as fieldDefinitionsApi from '../metadata/fieldDefinition/api'
import { useTreeEntities } from '../../entities/presets/hooks/useTreeEntities'
import LayoutList from '../../layouts/ui/LayoutList'
import { useMetahubDetails } from '../../metahubs/hooks'
import { useCodenameConfig } from '../../settings/hooks/useCodenameConfig'
import { useEntityPermissions } from '../../settings/hooks/useEntityPermissions'
import { useMetahubPrimaryLocale } from '../../settings/hooks/useMetahubPrimaryLocale'
import { invalidateEntitiesQueries, metahubsQueryKeys } from '../../shared'
import GeneralTabFields from '../../shared/ui/GeneralTabFields'
import { createScriptsTab } from '../../scripts/ui/EntityScriptsTab'
import { scriptsApi } from '../../scripts/api/scriptsApi'
import { createEntityActionsTab, createEntityEventsTab } from './EntityAutomationTab'
import { LinkedCollectionDeleteDialog } from '../../../components'
import type { MetahubEntityInstance, UpdateEntityInstancePayload } from '../api'
import * as entitiesApi from '../api'
import {
    useCopyEntityInstance,
    useCreateEntityInstance,
    useDeleteEntityInstance,
    useEntityInstanceQuery,
    useEntityInstancesQuery,
    useEntityTypesQuery,
    usePermanentDeleteEntityInstance,
    useRestoreEntityInstance,
    useUpdateEntityInstance
} from '../hooks'
import RecordBehaviorFields from './RecordBehaviorFields'
import type { RecordBehaviorOption } from './RecordBehaviorFields'
import LedgerSchemaFields from './LedgerSchemaFields'
import type { EntityInstanceDisplayRow, EntityInstanceFormValues, UiTranslate } from './entityInstanceListHelpers'
import {
    DIALOG_SAVE_CANCEL,
    buildCopyInitialValues,
    buildEntityInstanceLayoutBasePath,
    buildInitialFormValues,
    buildInstanceDisplayRow,
    buildLinkedCollectionDeleteDialogEntity,
    decodeKindKey,
    getEntityConfig,
    getLinkedCollectionCopyOptions,
    isRecord,
    resolveEntityMetadataKind,
    resolveEntityInstanceDialogTitle,
    resolveEntityTypeName,
    toStrictLocalizedRecord
} from './entityInstanceListHelpers'

const GENERIC_STANDARD_ENTITY_KINDS = new Set<BuiltinEntityKind>(['page', 'ledger'])
const STANDARD_COLLECTION_I18N_PREFIX_BY_KIND: Partial<Record<BuiltinEntityKind, string>> = {
    page: 'pages',
    ledger: 'ledgers'
}
const PAGE_CONTENT_ROUTE_SEGMENT = 'content'
const FALLBACK_DATA_SCHEMA_ROUTE_SEGMENT = 'field-definitions'

const isRecordValue = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value))

const getRecordBehaviorFormValue = (value: unknown): CatalogRecordBehavior => normalizeCatalogRecordBehavior(value)
const getLedgerConfigFormValue = (value: unknown): LedgerConfig => normalizeLedgerConfig(value)
const hasLedgerConfig = (config: unknown): boolean => isRecordValue(config) && isRecordValue(config.ledger)

const toRecordBehaviorOption = (entity: MetahubEntityInstance, uiLocale: string): RecordBehaviorOption => {
    const codename = getLocalizedContentText(entity.codename, uiLocale, entity.id) || entity.id
    const label = getLocalizedContentText(entity.name, uiLocale, codename) || codename
    return { codename, label }
}

const fieldDefinitionToRecordBehaviorOption = (field: FieldDefinition, uiLocale: string): RecordBehaviorOption => {
    const codename = resolveFieldDefinitionCodename(field, uiLocale)
    const label = getLocalizedContentText(field.name, uiLocale, codename) || codename
    return { codename, label }
}

const resolveFieldDefinitionCodename = (field: FieldDefinition, uiLocale: string): string => {
    const codename = field.codename as unknown
    if (typeof codename === 'string') {
        return codename || field.id
    }
    return getLocalizedContentText(field.codename, uiLocale, getVLCString(field.codename, 'en') || field.id) || field.id
}

const scriptToRecordBehaviorOption = (
    script: Awaited<ReturnType<typeof scriptsApi.list>>[number],
    uiLocale: string
): RecordBehaviorOption => {
    const codename = getLocalizedContentText(script.codename, uiLocale, script.id) || script.id
    const label = getLocalizedContentText(script.presentation?.name, uiLocale, codename) || codename
    return { codename, label }
}

const entityTypeToOption = (kindKey: string, label: string): RecordBehaviorOption => ({ codename: kindKey, label })

const validateRecordBehaviorValue = (
    behavior: CatalogRecordBehavior,
    t: (key: string, options?: Record<string, unknown> | string) => string
): Record<string, string> => {
    const errors: Record<string, string> = {}

    if (
        (behavior.mode === 'transactional' || behavior.mode === 'hybrid') &&
        behavior.posting.mode !== 'disabled' &&
        behavior.posting.targetLedgers.length === 0
    ) {
        errors.recordBehaviorPosting = t(
            'entities.recordBehavior.validation.targetLedgerRequired',
            'Select at least one target Ledger for enabled posting.'
        )
    }

    if (behavior.posting.mode !== 'disabled' && behavior.lifecycle.enabled && !behavior.lifecycle.states.some((state) => state.isInitial)) {
        errors.recordBehaviorLifecycle = t(
            'entities.recordBehavior.validation.initialStateRequired',
            'Lifecycle-enabled posting requires one initial state.'
        )
    }

    if (
        behavior.numbering.enabled &&
        behavior.numbering.minLength !== undefined &&
        (!Number.isInteger(behavior.numbering.minLength) || behavior.numbering.minLength < 1 || behavior.numbering.minLength > 32)
    ) {
        errors.recordBehaviorMinLength = t(
            'entities.recordBehavior.validation.minLength',
            'Minimum length must be an integer from 1 to 32.'
        )
    }

    const stateCodenames = behavior.lifecycle.states.map((state) => state.codename.trim()).filter(Boolean)
    if (new Set(stateCodenames).size !== stateCodenames.length) {
        errors.recordBehaviorLifecycle = t(
            'entities.recordBehavior.validation.stateCodenamesUnique',
            'Lifecycle state codenames must be unique.'
        )
    }

    return errors
}

const validateLedgerConfigValue = (
    config: LedgerConfig,
    fields: Array<{ codename: string; dataType: FieldDefinition['dataType'] }> | null,
    t: (key: string, options?: Record<string, unknown> | string) => string
): Record<string, string> => {
    const errors: Record<string, string> = {}
    const referenceErrors = fields ? validateLedgerConfigReferences({ config, fields }) : []
    const hasReferenceError = (code: (typeof referenceErrors)[number]['code']) => referenceErrors.some((error) => error.code === code)
    const fieldRoleKeys = config.fieldRoles.map((role) => role.fieldCodename.trim().toLowerCase()).filter(Boolean)
    const projectionKeys = config.projections.map((projection) => projection.codename.trim().toLowerCase()).filter(Boolean)

    if (hasReferenceError('DUPLICATE_FIELD_ROLE') || new Set(fieldRoleKeys).size !== fieldRoleKeys.length) {
        errors.ledgerFieldRoles = t('entities.ledgerSchema.validation.fieldRolesUnique', 'Field roles must be unique.')
    }
    if (hasReferenceError('DUPLICATE_PROJECTION_CODENAME') || new Set(projectionKeys).size !== projectionKeys.length) {
        errors.ledgerConfig = t('entities.ledgerSchema.validation.projectionsUnique', 'Projection codenames must be unique.')
    }
    if (referenceErrors.some((error) => error.code === 'FIELD_NOT_FOUND' || error.code === 'RESOURCE_REQUIRES_NUMBER')) {
        errors.ledgerFieldRoles =
            errors.ledgerFieldRoles ||
            t(
                'entities.ledgerSchema.validation.fieldRolesInvalid',
                'Field roles must reference existing fields, and aggregated resources must use numeric fields.'
            )
    }
    if (
        referenceErrors.some(
            (error) =>
                error.code === 'PROJECTION_FIELD_NOT_FOUND' ||
                error.code === 'PROJECTION_RESOURCE_NOT_CONFIGURED' ||
                error.code === 'PROJECTION_DIMENSION_NOT_CONFIGURED'
        )
    ) {
        errors.ledgerConfig =
            errors.ledgerConfig ||
            t(
                'entities.ledgerSchema.validation.projectionsInvalid',
                'Projections must reference existing fields configured as dimensions or resources.'
            )
    }
    if (hasReferenceError('IDEMPOTENCY_FIELD_NOT_FOUND')) {
        errors.ledgerIdempotency = t(
            'entities.ledgerSchema.validation.idempotencyInvalid',
            'Idempotency fields must reference existing fields.'
        )
    }
    if (hasReferenceError('EFFECTIVE_DATE_FIELD_NOT_FOUND')) {
        errors.ledgerConfig =
            errors.ledgerConfig ||
            t('entities.ledgerSchema.validation.effectiveDateInvalid', 'Effective date field must reference an existing field.')
    }

    return errors
}

const LinkedCollectionCopyOptionsTab = ({
    values,
    setValue,
    isLoading,
    t
}: {
    values: EntityInstanceFormValues
    setValue: (name: string, value: unknown) => void
    isLoading: boolean
    t: (key: string, options?: Record<string, unknown> | string) => string
}) => {
    const options = getLinkedCollectionCopyOptions(values)

    return (
        <Stack spacing={1}>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={options.copyFieldDefinitions}
                        onChange={(event) => {
                            setValue('copyFieldDefinitions', event.target.checked)
                            if (!event.target.checked) {
                                setValue('copyRecords', false)
                            }
                        }}
                        disabled={isLoading}
                    />
                }
                label={t('entities.copy.options.copyFieldDefinitions', 'Copy field definitions')}
            />
            <FormControlLabel
                control={
                    <Checkbox
                        checked={options.copyRecords}
                        onChange={(event) => setValue('copyRecords', event.target.checked)}
                        disabled={isLoading || !options.copyFieldDefinitions}
                    />
                }
                label={t('entities.copy.options.copyRecords', 'Copy records')}
            />
        </Stack>
    )
}

const EntityInstanceListContent = () => {
    const {
        metahubId,
        kindKey: routeKindKey,
        treeEntityId
    } = useParams<{
        metahubId: string
        kindKey: string
        treeEntityId?: string
    }>()
    const resolvedKindKey = useMemo(() => decodeKindKey(routeKindKey), [routeKindKey])
    const navigate = useNavigate()
    const preferredVlcLocale = useMetahubPrimaryLocale()
    const codenameConfig = useCodenameConfig()
    const { t } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()
    const translateResourceSurfaceTitle = useCallback((key: string, fallback?: string) => t(key, { defaultValue: fallback }), [t])
    const translate = useCallback<UiTranslate>(
        (key, options) => {
            if (typeof options === 'string') {
                return t(key, { defaultValue: options })
            }

            return t(key, options)
        },
        [t]
    )
    const queryClient = useQueryClient()
    const isHubScoped = Boolean(treeEntityId)
    const metahubDetailsQuery = useMetahubDetails(metahubId ?? '', { enabled: Boolean(metahubId) })
    const cachedMetahub = metahubId ? queryClient.getQueryData<Metahub>(metahubsQueryKeys.detail(metahubId)) : undefined
    const resolvedPermissions = metahubDetailsQuery.data?.permissions ?? cachedMetahub?.permissions
    const { allowCopy: allowLinkedCollectionCopy, allowDelete: allowLinkedCollectionDelete } = useEntityPermissions('linkedCollection')
    const { allowCopy: allowPageCopy, allowDelete: allowPageDelete } = useEntityPermissions('page')

    const showDeleted = false
    const [storedView, setStoredView] = useViewPreference(STORAGE_KEYS.ENTITY_INSTANCE_DISPLAY_STYLE, 'list')
    const view = (storedView === 'table' ? 'list' : storedView) as 'card' | 'list'
    const treeEntities = useTreeEntities(metahubId)

    const { dialogs, openCreate, openCopy, openDelete, openEdit, close } = useListDialogs<MetahubEntityInstance>()
    const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<MetahubEntityInstance | null>(null)
    const [blockingDeleteTarget, setBlockingDeleteTarget] = useState<MetahubEntityInstance | null>(null)
    const [conflictState, setConflictState] = useState<{
        open: boolean
        conflict: ConflictInfo | null
        entity: MetahubEntityInstance | null
        patch: UpdateEntityInstancePayload | null
    }>({ open: false, conflict: null, entity: null, patch: null })

    const entityTypesQuery = useEntityTypesQuery(metahubId, {
        limit: 1000,
        offset: 0,
        sortBy: 'codename',
        sortOrder: 'asc'
    })

    const entityType = useMemo(
        () => (entityTypesQuery.data?.items ?? []).find((item) => item.kindKey === resolvedKindKey) ?? null,
        [entityTypesQuery.data?.items, resolvedKindKey]
    )
    const hubScopedTabs = useMemo(() => {
        const entityTypes = entityTypesQuery.data?.items ?? []
        const tabs = entityTypes
            .filter((type) => type.kindKey === 'hub' || isEnabledComponentConfig(type.components?.treeAssignment))
            .sort((a, b) => {
                if (a.kindKey === 'hub') return -1
                if (b.kindKey === 'hub') return 1
                const byOrder = (a.ui?.sidebarOrder ?? 1000) - (b.ui?.sidebarOrder ?? 1000)
                return byOrder !== 0 ? byOrder : a.kindKey.localeCompare(b.kindKey)
            })
            .map((type) => ({
                kindKey: type.kindKey,
                label: resolveEntityTypeName(type, preferredVlcLocale, translate, type.kindKey)
            }))

        return [
            ...tabs,
            {
                kindKey: 'settings',
                label: t('settings.title')
            }
        ]
    }, [entityTypesQuery.data?.items, preferredVlcLocale, t, translate])
    const activeHubScopedTab = useMemo(() => {
        if (hubScopedTabs.some((tab) => tab.kindKey === resolvedKindKey)) {
            return resolvedKindKey
        }

        return hubScopedTabs[0]?.kindKey ?? resolvedKindKey
    }, [hubScopedTabs, resolvedKindKey])
    const handleHubScopedTabChange = useCallback(
        (_event: unknown, tabValue: string) => {
            if (!metahubId || !treeEntityId) return
            if (tabValue === 'settings') {
                navigate(`/metahub/${metahubId}/entities/hub/instance/${treeEntityId}/instances`, {
                    state: { openHubSettings: true }
                })
                return
            }

            navigate(`/metahub/${metahubId}/entities/${encodeURIComponent(tabValue)}/instance/${treeEntityId}/instances`)
        },
        [metahubId, navigate, treeEntityId]
    )

    const resolvedEntityTypeName = useMemo(
        () => resolveEntityTypeName(entityType, preferredVlcLocale, translate, resolvedKindKey),
        [entityType, preferredVlcLocale, resolvedKindKey, translate]
    )
    const entityMetadataKind = useMemo(() => resolveEntityMetadataKind(entityType, resolvedKindKey), [entityType, resolvedKindKey])
    const isEntityMetadataSurface = entityMetadataKind !== null
    const usesLinkedCollectionAuthoring = entityMetadataKind === 'catalog'
    const usesPageAuthoring = entityMetadataKind === 'page'
    const usesGenericEntityAuthoring =
        isHubScoped || !isEntityMetadataSurface || (entityMetadataKind ? GENERIC_STANDARD_ENTITY_KINDS.has(entityMetadataKind) : false)
    const canEditLinkedCollectionInstances = resolvedPermissions?.editContent === true
    const canDeleteLinkedCollectionInstances = resolvedPermissions?.deleteContent === true
    const canManageEntityInstances = usesLinkedCollectionAuthoring
        ? canEditLinkedCollectionInstances
        : resolvedPermissions?.manageMetahub === true
    const canCreateEntityInstances = canManageEntityInstances
    const canEditEntityInstances = canManageEntityInstances
    const canCopyEntityInstances = usesLinkedCollectionAuthoring
        ? canEditLinkedCollectionInstances && allowLinkedCollectionCopy
        : canManageEntityInstances && (!usesPageAuthoring || allowPageCopy)
    const canDeleteEntityInstances = usesLinkedCollectionAuthoring
        ? canDeleteLinkedCollectionInstances && allowLinkedCollectionDelete
        : canManageEntityInstances && (!usesPageAuthoring || allowPageDelete)
    const canRestoreEntityInstances = usesLinkedCollectionAuthoring ? canEditLinkedCollectionInstances : canManageEntityInstances
    const showManageEntityInstancesNotice = Boolean(resolvedPermissions) && !canCreateEntityInstances
    const isStandardEntityCollection = isEntityMetadataSurface
    const collectionTitle = isStandardEntityCollection
        ? resolvedEntityTypeName
        : t('entities.instances.title', {
              name: resolvedEntityTypeName,
              defaultValue: '{{name}} instances'
          })
    const collectionDescription = isStandardEntityCollection
        ? undefined
        : t('entities.instances.description', {
              name: resolvedEntityTypeName,
              kindKey: resolvedKindKey,
              defaultValue: 'Manage {{name}} instances on the unified entity-owned route for kind {{kindKey}}.'
          })

    const requestedTabs = useMemo(() => new Set(entityType?.ui.tabs ?? []), [entityType?.ui.tabs])
    const treeAssignmentTabId = requestedTabs.has('hubs') ? 'hubs' : 'treeEntities'
    const showHubsTab = Boolean(
        entityType &&
            isEnabledComponentConfig(entityType.components?.treeAssignment) &&
            (requestedTabs.has('treeEntities') || requestedTabs.has('hubs'))
    )
    const showAttributesTab = Boolean(entityType && isEnabledComponentConfig(entityType.components?.dataSchema))
    const showLayoutTab = Boolean(
        entityType && isEnabledComponentConfig(entityType.components?.layoutConfig) && requestedTabs.has('layout')
    )
    const hasRecordBehaviorConfig = Boolean(isRecordValue(entityType?.config) && isRecordValue(entityType.config.recordBehavior))
    const showBehaviorTab = Boolean(
        entityType && supportsRecordBehavior(entityType.components) && (requestedTabs.has('behavior') || hasRecordBehaviorConfig)
    )
    const showLedgerSchemaTab = Boolean(
        entityType && supportsLedgerSchema(entityType.components) && (requestedTabs.has('ledgerSchema') || hasLedgerConfig(entityType.config))
    )
    const showScriptsTab = Boolean(entityType && isEnabledComponentConfig(entityType.components?.scripting) && requestedTabs.has('scripts'))
    const showActionsTab = Boolean(entityType && isEnabledComponentConfig(entityType.components?.actions))
    const showEventsTab = Boolean(entityType && isEnabledComponentConfig(entityType.components?.events))
    const showPageBlocksTab = Boolean(entityType && isEnabledComponentConfig(entityType.components?.blockContent))
    const dataSchemaSurface = entityType?.ui.resourceSurfaces?.find((surface) => surface.capability === 'dataSchema') ?? null
    const contentRouteBase =
        metahubId && resolvedKindKey ? `/metahub/${metahubId}/entities/${encodeURIComponent(resolvedKindKey)}/instance` : ''
    const standardCollectionI18nPrefix = entityMetadataKind ? STANDARD_COLLECTION_I18N_PREFIX_BY_KIND[entityMetadataKind] ?? null : null
    const standardCollectionRouteSegment =
        entityMetadataKind === 'page' || (!entityMetadataKind && showPageBlocksTab)
            ? PAGE_CONTENT_ROUTE_SEGMENT
            : entityMetadataKind === 'ledger'
            ? dataSchemaSurface?.routeSegment || FALLBACK_DATA_SCHEMA_ROUTE_SEGMENT
            : null
    const canOpenStandardCollectionRow = Boolean(standardCollectionRouteSegment)
    const fieldDefinitionsTabLabel = dataSchemaSurface
        ? resolveEntityResourceSurfaceTitle(dataSchemaSurface, {
              locale: preferredVlcLocale,
              translate: translateResourceSurfaceTitle
          })
        : t('entities.instances.tabs.fieldDefinitions', 'Attributes')
    const defaultFieldDefinitionsEmptyTitle = t('entities.instances.fieldDefinitions.emptyTitle', 'No field definitions')
    const defaultFieldDefinitionsEmptyDescription = t(
        'entities.instances.fieldDefinitions.emptyDescription',
        'Create the first attribute to define the schema for this entity kind.'
    )
    const fieldDefinitionsEmptyTitle = standardCollectionI18nPrefix
        ? t(`${standardCollectionI18nPrefix}.fieldDefinitions.emptyTitle`, defaultFieldDefinitionsEmptyTitle)
        : defaultFieldDefinitionsEmptyTitle
    const fieldDefinitionsEmptyDescription = standardCollectionI18nPrefix
        ? t(`${standardCollectionI18nPrefix}.fieldDefinitions.emptyDescription`, defaultFieldDefinitionsEmptyDescription)
        : defaultFieldDefinitionsEmptyDescription

    const paginationResult = usePaginated<MetahubEntityInstance, 'updated' | 'sortOrder'>({
        queryKeyFn: (params) =>
            metahubId && resolvedKindKey
                ? metahubsQueryKeys.entitiesList(metahubId, {
                      ...params,
                      kind: resolvedKindKey,
                      locale: preferredVlcLocale,
                      includeDeleted: showDeleted,
                      treeEntityId
                  })
                : ['metahubs', 'entities', 'empty', resolvedKindKey, treeEntityId, showDeleted],
        queryFn: (params) =>
            entitiesApi.listEntityInstances(metahubId!, {
                ...params,
                kind: resolvedKindKey,
                locale: preferredVlcLocale,
                includeDeleted: showDeleted,
                treeEntityId
            }),
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc',
        enabled: Boolean(metahubId && resolvedKindKey && entityType && usesGenericEntityAuthoring),
        keepPreviousDataOnQueryKeyChange: false
    })

    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    const existingCodenameQuery = useEntityInstancesQuery(
        metahubId,
        !usesGenericEntityAuthoring
            ? undefined
            : {
                  kind: resolvedKindKey,
                  locale: preferredVlcLocale,
                  includeDeleted: true,
                  limit: 1000,
                  offset: 0,
                  sortBy: 'updated',
                  sortOrder: 'desc'
              }
    )

    const editEntityDetailQuery = useEntityInstanceQuery(metahubId, dialogs.edit.open ? dialogs.edit.item?.id : undefined)
    const copyEntityDetailQuery = useEntityInstanceQuery(metahubId, dialogs.copy.open ? dialogs.copy.item?.id : undefined)

    const createEntityMutation = useCreateEntityInstance()
    const updateEntityMutation = useUpdateEntityInstance()
    const copyEntityMutation = useCopyEntityInstance()
    const deleteEntityMutation = useDeleteEntityInstance()
    const restoreEntityMutation = useRestoreEntityInstance()
    const permanentDeleteEntityMutation = usePermanentDeleteEntityInstance()

    const hubNameById = useMemo(
        () =>
            new Map(
                treeEntities.map((hub) => [
                    hub.id,
                    getLocalizedContentText(
                        hub.name,
                        preferredVlcLocale,
                        getVLCString(hub.name, 'en') || getLocalizedContentText(hub.codename, preferredVlcLocale, hub.id)
                    )
                ])
            ),
        [treeEntities, preferredVlcLocale]
    )

    const instanceById = useMemo(
        () => new Map(paginationResult.data.map((entity) => [entity.id, entity] as const)),
        [paginationResult.data]
    )

    const instanceRows = useMemo(
        () => paginationResult.data.map((entity) => buildInstanceDisplayRow(entity, preferredVlcLocale, translate)),
        [paginationResult.data, preferredVlcLocale, translate]
    )

    const codenameEntities = useMemo(() => {
        if (isEntityMetadataSurface) {
            return []
        }

        return (existingCodenameQuery.data?.items ?? paginationResult.data).filter((entity) => entity.kind === resolvedKindKey)
    }, [existingCodenameQuery.data?.items, isEntityMetadataSurface, paginationResult.data, resolvedKindKey])

    const editDialogEntity = editEntityDetailQuery.data ?? dialogs.edit.item
    const copyDialogEntity = copyEntityDetailQuery.data ?? dialogs.copy.item
    const behaviorDialogOpen = dialogs.create.open || dialogs.edit.open || dialogs.copy.open
    const behaviorDialogEntityId = editDialogEntity?.id ?? copyDialogEntity?.id ?? null
    const behaviorAttachedToKind = resolvedKindKey
    const ledgerCapableKindKeys = useMemo(
        () =>
            (entityTypesQuery.data?.items ?? [])
                .filter((type) => supportsLedgerSchema(type.components))
                .map((type) => type.kindKey)
                .sort((left, right) => left.localeCompare(right)),
        [entityTypesQuery.data?.items]
    )
    const behaviorLedgerQueries = useQueries({
        queries: ledgerCapableKindKeys.map((kindKey) => ({
            queryKey:
                metahubId && showBehaviorTab && behaviorDialogOpen
                    ? metahubsQueryKeys.entitiesList(metahubId, {
                          kind: kindKey,
                          limit: 1000,
                          offset: 0,
                          sortBy: 'codename',
                          sortOrder: 'asc',
                          locale: preferredVlcLocale
                      })
                    : ['metahubs', 'recordBehavior', 'ledgerCandidates', 'empty', kindKey],
            queryFn: () =>
                entitiesApi.listEntityInstances(metahubId!, {
                    kind: kindKey,
                    limit: 1000,
                    offset: 0,
                    sortBy: 'codename',
                    sortOrder: 'asc',
                    locale: preferredVlcLocale
                }),
            enabled: Boolean(metahubId && showBehaviorTab && behaviorDialogOpen),
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
    const behaviorFieldDefinitionsQuery = useQuery({
        queryKey:
            metahubId && behaviorDialogEntityId && resolvedKindKey
                ? ['metahubs', metahubId, 'recordBehavior', resolvedKindKey, behaviorDialogEntityId, 'fieldDefinitions']
                : ['metahubs', 'recordBehavior', 'fieldDefinitions', 'empty'],
        queryFn: () =>
            fieldDefinitionsApi.listFieldDefinitionsDirect(metahubId!, behaviorDialogEntityId!, {
                kindKey: resolvedKindKey,
                limit: 1000,
                offset: 0,
                sortBy: 'sortOrder',
                sortOrder: 'asc',
                locale: preferredVlcLocale,
                scope: 'business'
            }),
        enabled: Boolean((showBehaviorTab || showLedgerSchemaTab) && metahubId && behaviorDialogEntityId && resolvedKindKey),
        staleTime: 30 * 1000
    })
    const behaviorScriptsQuery = useQuery({
        queryKey:
            metahubId && behaviorDialogEntityId
                ? ['metahubs', metahubId, 'recordBehavior', behaviorAttachedToKind, behaviorDialogEntityId, 'scripts']
                : ['metahubs', 'recordBehavior', 'scripts', 'empty'],
        queryFn: () =>
            scriptsApi.list(metahubId!, {
                attachedToKind: behaviorAttachedToKind,
                attachedToId: behaviorDialogEntityId
            }),
        enabled: Boolean(showBehaviorTab && metahubId && behaviorDialogEntityId && behaviorAttachedToKind),
        staleTime: 30 * 1000
    })
    const behaviorFieldOptions = useMemo(
        () =>
            (behaviorFieldDefinitionsQuery.data?.items ?? []).map((field) =>
                fieldDefinitionToRecordBehaviorOption(field, preferredVlcLocale)
            ),
        [behaviorFieldDefinitionsQuery.data?.items, preferredVlcLocale]
    )
    const ledgerReferenceFields = useMemo(
        () =>
            behaviorFieldDefinitionsQuery.isSuccess
                ? (behaviorFieldDefinitionsQuery.data?.items ?? []).map((field) => ({
                      codename: resolveFieldDefinitionCodename(field, preferredVlcLocale),
                      dataType: field.dataType
                  }))
                : null,
        [behaviorFieldDefinitionsQuery.data?.items, behaviorFieldDefinitionsQuery.isSuccess, preferredVlcLocale]
    )
    const behaviorScriptOptions = useMemo(
        () => (behaviorScriptsQuery.data ?? []).map((script) => scriptToRecordBehaviorOption(script, preferredVlcLocale)),
        [behaviorScriptsQuery.data, preferredVlcLocale]
    )
    const ledgerEntityKindOptions = useMemo(
        () =>
            (entityTypesQuery.data?.items ?? []).map((type) =>
                entityTypeToOption(type.kindKey, resolveEntityTypeName(type, preferredVlcLocale, translate, type.kindKey))
            ),
        [entityTypesQuery.data?.items, preferredVlcLocale, translate]
    )

    const createInitialValues = useMemo(() => {
        const initial = {
            ...buildInitialFormValues(preferredVlcLocale, null),
            recordBehavior:
                showBehaviorTab && entityType?.config
                    ? normalizeCatalogRecordBehaviorFromConfig(entityType.config)
                    : DEFAULT_CATALOG_RECORD_BEHAVIOR,
            ledgerSchemaEnabled: showLedgerSchemaTab && hasLedgerConfig(entityType?.config),
            ledgerConfig:
                showLedgerSchemaTab && entityType?.config ? normalizeLedgerConfigFromConfig(entityType.config) : DEFAULT_LEDGER_CONFIG
        }
        return treeEntityId && showHubsTab
            ? {
                  ...initial,
                  treeEntityIds: [treeEntityId]
              }
            : initial
    }, [entityType?.config, preferredVlcLocale, showBehaviorTab, showHubsTab, showLedgerSchemaTab, treeEntityId])
    const editInitialValues = useMemo(
        () => buildInitialFormValues(preferredVlcLocale, editDialogEntity),
        [editDialogEntity, preferredVlcLocale]
    )
    const copyInitialValues = useMemo(
        () => buildCopyInitialValues(preferredVlcLocale, copyDialogEntity, usesLinkedCollectionAuthoring),
        [copyDialogEntity, usesLinkedCollectionAuthoring, preferredVlcLocale]
    )
    const blockingDeleteCatalog = useMemo(
        () =>
            blockingDeleteTarget && metahubId
                ? buildLinkedCollectionDeleteDialogEntity({
                      entity: blockingDeleteTarget,
                      metahubId,
                      uiLocale: preferredVlcLocale,
                      treeEntities
                  })
                : null,
        [blockingDeleteTarget, treeEntities, metahubId, preferredVlcLocale]
    )

    const containerSelectionLabels = useMemo<Partial<EntitySelectionLabels>>(
        () => ({
            title: t('entities.instances.tabs.containers', 'Containers'),
            addButton: t('entities.instances.containers.addButton', 'Add'),
            dialogTitle: t('entities.instances.containers.dialogTitle', 'Select containers'),
            emptyMessage: t('entities.instances.containers.empty', 'No containers selected'),
            requiredWarningMessage: t('entities.instances.validation.containerRequired', 'At least one container is required'),
            noAvailableMessage: t('entities.instances.containers.noAvailable', 'No containers available'),
            confirmButton: t('common:actions.add', 'Add'),
            removeTitle: t('common:actions.remove', 'Remove'),
            requiredLabel: t('entities.instances.containers.requiredLabel', 'Container required'),
            requiredEnabledHelp: t(
                'entities.instances.containers.requiredEnabledHelp',
                'The entity must be linked to at least one container'
            ),
            requiredDisabledHelp: t('entities.instances.containers.requiredDisabledHelp', 'The entity can exist without linked containers'),
            singleLabel: t('entities.instances.containers.singleLabel', 'Single container only'),
            singleEnabledHelp: t('entities.instances.containers.singleEnabledHelp', 'The entity can only be linked to one container'),
            singleDisabledHelp: t('entities.instances.containers.singleDisabledHelp', 'The entity can be linked to multiple containers'),
            singleWarning: t(
                'entities.instances.validation.singleContainerInvalid',
                'Single-container entities cannot be linked to multiple containers'
            )
        }),
        [t]
    )

    const validateEntityForm = useCallback(
        (values: EntityInstanceFormValues) => {
            const errors: Record<string, string> = {}
            const nameVlc = (values.nameVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
            const codenameValue = (values.codename as VersionedLocalizedContent<string> | null | undefined) ?? null
            const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? preferredVlcLocale
            const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
            const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)

            if (!hasPrimaryContent(nameVlc)) {
                errors.nameVlc = tc('crud.nameRequired', 'Name is required')
            }

            if (!normalizedCodename) {
                errors.codename = t('entities.validation.codenameRequired', 'Codename is required')
            } else if (
                !isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            ) {
                errors.codename = t('entities.validation.codenameInvalid', 'Codename contains invalid characters')
            }

            if (showHubsTab) {
                const treeEntityIds = Array.isArray(values.treeEntityIds)
                    ? values.treeEntityIds.filter((value): value is string => typeof value === 'string')
                    : []
                const isRequiredHub = Boolean(values.isRequiredHub)
                const isSingleHub = Boolean(values.isSingleHub)

                if (isRequiredHub && treeEntityIds.length === 0) {
                    errors.treeEntityIds = t('entities.instances.validation.containerRequired', 'At least one container is required')
                } else if (isSingleHub && treeEntityIds.length > 1) {
                    errors.treeEntityIds = t(
                        'entities.instances.validation.singleContainerInvalid',
                        'Single-container entities cannot be linked to multiple containers'
                    )
                }
            }

            if (showBehaviorTab) {
                Object.assign(errors, validateRecordBehaviorValue(getRecordBehaviorFormValue(values.recordBehavior), t))
            }

            if (showLedgerSchemaTab && values.ledgerSchemaEnabled === true) {
                Object.assign(errors, validateLedgerConfigValue(getLedgerConfigFormValue(values.ledgerConfig), ledgerReferenceFields, t))
            }

            return Object.keys(errors).length > 0 ? errors : null
        },
        [
            codenameConfig.allowMixed,
            codenameConfig.alphabet,
            codenameConfig.style,
            preferredVlcLocale,
            showBehaviorTab,
            showHubsTab,
            showLedgerSchemaTab,
            ledgerReferenceFields,
            t,
            tc
        ]
    )

    const canSaveEntityForm = useCallback(
        (values: EntityInstanceFormValues) => {
            const nameVlc = (values.nameVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
            const codenameValue = (values.codename as VersionedLocalizedContent<string> | null | undefined) ?? null
            const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? preferredVlcLocale
            const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
            const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
            const treeEntityIds = Array.isArray(values.treeEntityIds)
                ? values.treeEntityIds.filter((value): value is string => typeof value === 'string')
                : []
            const isRequiredHub = Boolean(values.isRequiredHub)
            const isSingleHub = Boolean(values.isSingleHub)
            const hubsValid = !showHubsTab || ((!isRequiredHub || treeEntityIds.length > 0) && (!isSingleHub || treeEntityIds.length <= 1))
            const behaviorValid =
                !showBehaviorTab ||
                Object.keys(validateRecordBehaviorValue(getRecordBehaviorFormValue(values.recordBehavior), t)).length === 0
            const ledgerValid =
                !showLedgerSchemaTab ||
                values.ledgerSchemaEnabled !== true ||
                Object.keys(validateLedgerConfigValue(getLedgerConfigFormValue(values.ledgerConfig), ledgerReferenceFields, t)).length === 0
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
        [
            codenameConfig.allowMixed,
            codenameConfig.alphabet,
            codenameConfig.style,
            preferredVlcLocale,
            showBehaviorTab,
            showHubsTab,
            showLedgerSchemaTab,
            ledgerReferenceFields,
            t
        ]
    )

    const buildConfigPayload = useCallback(
        ({
            values,
            baseConfig,
            preserveBaseConfig
        }: {
            values: EntityInstanceFormValues
            baseConfig?: Record<string, unknown> | null
            preserveBaseConfig: boolean
        }) => {
            const nextConfig = isRecord(baseConfig) ? { ...baseConfig } : {}
            const hasBaseConfig = Object.keys(nextConfig).length > 0

            if (showHubsTab) {
                const treeEntityIds = Array.isArray(values.treeEntityIds)
                    ? values.treeEntityIds.filter((value): value is string => typeof value === 'string')
                    : []
                nextConfig.hubs = treeEntityIds
                delete nextConfig.treeEntities
                nextConfig.isSingleHub = Boolean(values.isSingleHub)
                nextConfig.isRequiredHub = Boolean(values.isRequiredHub)
            }

            if (showBehaviorTab) {
                nextConfig.recordBehavior = normalizeCatalogRecordBehavior(values.recordBehavior)
            }

            if (showLedgerSchemaTab) {
                if (values.ledgerSchemaEnabled === true) {
                    nextConfig.ledger = normalizeLedgerConfig(values.ledgerConfig)
                } else {
                    delete nextConfig.ledger
                }
            }

            if (Object.keys(nextConfig).length === 0) {
                return preserveBaseConfig && hasBaseConfig ? nextConfig : undefined
            }

            return nextConfig
        },
        [showBehaviorTab, showHubsTab, showLedgerSchemaTab]
    )

    const buildEntityPayload = useCallback(
        ({
            values,
            baseConfig,
            preserveBaseConfig
        }: {
            values: EntityInstanceFormValues
            baseConfig?: Record<string, unknown> | null
            preserveBaseConfig: boolean
        }) => {
            const nameVlc = (values.nameVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
            const descriptionVlc = (values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
            const codenameValue = (values.codename as VersionedLocalizedContent<string> | null | undefined) ?? null
            const { input: name, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
            const { input: description, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)
            const codenamePrimaryLocale = codenameValue?._primary ?? namePrimaryLocale ?? preferredVlcLocale
            const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
            const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
            const normalizedName = toStrictLocalizedRecord(name)
            const normalizedDescription = toStrictLocalizedRecord(description)

            return {
                codename: ensureLocalizedContent(codenameValue, codenamePrimaryLocale, normalizedCodename),
                name: normalizedName,
                namePrimaryLocale: namePrimaryLocale ?? preferredVlcLocale,
                description: normalizedDescription,
                descriptionPrimaryLocale: normalizedDescription
                    ? descriptionPrimaryLocale ?? namePrimaryLocale ?? preferredVlcLocale
                    : undefined,
                config: buildConfigPayload({ values, baseConfig, preserveBaseConfig })
            }
        },
        [buildConfigPayload, codenameConfig.alphabet, codenameConfig.style, preferredVlcLocale]
    )

    const handleCreateEntity = useCallback(
        async (values: EntityInstanceFormValues) => {
            if (!metahubId || !resolvedKindKey || !canCreateEntityInstances) return

            const created = await createEntityMutation.mutateAsync({
                metahubId,
                data: {
                    kind: resolvedKindKey,
                    ...buildEntityPayload({ values, preserveBaseConfig: false })
                }
            })

            if (standardCollectionRouteSegment && created?.id) {
                navigate(`${contentRouteBase}/${created.id}/${standardCollectionRouteSegment}`)
            }
        },
        [
            buildEntityPayload,
            canCreateEntityInstances,
            contentRouteBase,
            createEntityMutation,
            metahubId,
            navigate,
            resolvedKindKey,
            standardCollectionRouteSegment
        ]
    )

    const handleUpdateEntity = useCallback(
        async (values: EntityInstanceFormValues) => {
            if (!metahubId || !editDialogEntity || !canEditEntityInstances) return

            const patch: UpdateEntityInstancePayload = {
                ...buildEntityPayload({
                    values,
                    baseConfig: getEntityConfig(editDialogEntity),
                    preserveBaseConfig: false
                }),
                expectedVersion: editDialogEntity.version
            }

            try {
                await updateEntityMutation.mutateAsync({
                    metahubId,
                    entityId: editDialogEntity.id,
                    data: patch
                })
            } catch (error) {
                if (isOptimisticLockConflict(error)) {
                    setConflictState({
                        open: true,
                        conflict: extractConflictInfo(error),
                        entity: editDialogEntity,
                        patch
                    })
                    throw DIALOG_SAVE_CANCEL
                }

                throw error
            }
        },
        [buildEntityPayload, canEditEntityInstances, editDialogEntity, metahubId, updateEntityMutation]
    )

    const handleCopyEntity = useCallback(
        async (values: EntityInstanceFormValues) => {
            if (!metahubId || !copyDialogEntity || !canCopyEntityInstances) return

            await copyEntityMutation.mutateAsync({
                metahubId,
                entityId: copyDialogEntity.id,
                kind: resolvedKindKey,
                data: {
                    ...buildEntityPayload({
                        values,
                        baseConfig: getEntityConfig(copyDialogEntity),
                        preserveBaseConfig: true
                    }),
                    ...(usesLinkedCollectionAuthoring ? getLinkedCollectionCopyOptions(values) : {})
                }
            })
        },
        [
            buildEntityPayload,
            canCopyEntityInstances,
            copyDialogEntity,
            copyEntityMutation,
            usesLinkedCollectionAuthoring,
            metahubId,
            resolvedKindKey
        ]
    )

    const handleDeleteEntity = useCallback(async () => {
        if (!metahubId || !dialogs.delete.item || !canDeleteEntityInstances) return

        await deleteEntityMutation.mutateAsync({
            metahubId,
            entityId: dialogs.delete.item.id,
            kind: resolvedKindKey
        })
        close('delete')
    }, [canDeleteEntityInstances, close, deleteEntityMutation, dialogs.delete.item, metahubId, resolvedKindKey])

    const handleRestoreEntity = useCallback(
        async (entity: MetahubEntityInstance) => {
            if (!metahubId || !canRestoreEntityInstances) return

            await restoreEntityMutation.mutateAsync({
                metahubId,
                entityId: entity.id,
                kind: resolvedKindKey
            })
        },
        [canRestoreEntityInstances, metahubId, resolvedKindKey, restoreEntityMutation]
    )

    const handlePermanentDeleteEntity = useCallback(async () => {
        if (!metahubId || !permanentDeleteTarget || !canDeleteEntityInstances) return

        await permanentDeleteEntityMutation.mutateAsync({
            metahubId,
            entityId: permanentDeleteTarget.id,
            kind: resolvedKindKey
        })
        setPermanentDeleteTarget(null)
    }, [canDeleteEntityInstances, metahubId, permanentDeleteEntityMutation, permanentDeleteTarget, resolvedKindKey])

    const handleCloseConflict = useCallback(() => {
        setConflictState({ open: false, conflict: null, entity: null, patch: null })
    }, [])

    const handleReloadAfterConflict = useCallback(() => {
        if (metahubId && resolvedKindKey) {
            invalidateEntitiesQueries.all(queryClient, metahubId, resolvedKindKey)
        }
        handleCloseConflict()
    }, [handleCloseConflict, metahubId, queryClient, resolvedKindKey])

    const handleOverwriteConflict = useCallback(async () => {
        if (!metahubId || !conflictState.entity || !conflictState.patch || !canEditEntityInstances) return

        const { expectedVersion: _ignoredVersion, ...patchWithoutVersion } = conflictState.patch
        await updateEntityMutation.mutateAsync({
            metahubId,
            entityId: conflictState.entity.id,
            data: patchWithoutVersion
        })

        handleCloseConflict()
        close('edit')
    }, [canEditEntityInstances, close, conflictState.entity, conflictState.patch, handleCloseConflict, metahubId, updateEntityMutation])

    const handleOpenCreate = useCallback(() => {
        if (!canCreateEntityInstances) return
        openCreate()
    }, [canCreateEntityInstances, openCreate])

    const handleOpenEdit = useCallback(
        (entity: MetahubEntityInstance) => {
            if (!canEditEntityInstances) return
            openEdit(entity)
        },
        [canEditEntityInstances, openEdit]
    )

    const handleOpenCopy = useCallback(
        (entity: MetahubEntityInstance) => {
            if (!canCopyEntityInstances) return
            openCopy(entity)
        },
        [canCopyEntityInstances, openCopy]
    )

    const handleOpenDelete = useCallback(
        (entity: MetahubEntityInstance) => {
            if (!canDeleteEntityInstances) return

            if (usesLinkedCollectionAuthoring) {
                setBlockingDeleteTarget(entity)
                return
            }

            openDelete(entity)
        },
        [canDeleteEntityInstances, usesLinkedCollectionAuthoring, openDelete]
    )

    const handleSelectPermanentDeleteTarget = useCallback(
        (entity: MetahubEntityInstance) => {
            if (!canDeleteEntityInstances) return
            setPermanentDeleteTarget(entity)
        },
        [canDeleteEntityInstances]
    )

    const resolveDisplayEntity = useCallback(
        (row: Pick<EntityInstanceDisplayRow, 'id' | 'raw'>): MetahubEntityInstance | null => instanceById.get(row.id) ?? row.raw ?? null,
        [instanceById]
    )

    const handleOpenEditRow = useCallback(
        (row: Pick<EntityInstanceDisplayRow, 'id' | 'raw'>) => {
            const entity = resolveDisplayEntity(row)
            if (!entity) return
            handleOpenEdit(entity)
        },
        [handleOpenEdit, resolveDisplayEntity]
    )

    const handleOpenContentRow = useCallback(
        (row: Pick<EntityInstanceDisplayRow, 'id' | 'raw'>) => {
            const entity = resolveDisplayEntity(row)
            if (!entity || !contentRouteBase || !standardCollectionRouteSegment) return
            navigate(`${contentRouteBase}/${entity.id}/${standardCollectionRouteSegment}`)
        },
        [contentRouteBase, navigate, resolveDisplayEntity, standardCollectionRouteSegment]
    )

    const handleOpenCopyRow = useCallback(
        (row: Pick<EntityInstanceDisplayRow, 'id' | 'raw'>) => {
            const entity = resolveDisplayEntity(row)
            if (!entity) return
            handleOpenCopy(entity)
        },
        [handleOpenCopy, resolveDisplayEntity]
    )

    const handleOpenDeleteRow = useCallback(
        (row: Pick<EntityInstanceDisplayRow, 'id' | 'raw'>) => {
            const entity = resolveDisplayEntity(row)
            if (!entity) return
            handleOpenDelete(entity)
        },
        [handleOpenDelete, resolveDisplayEntity]
    )

    const handleRestoreEntityRow = useCallback(
        (row: Pick<EntityInstanceDisplayRow, 'id' | 'raw'>) => {
            const entity = resolveDisplayEntity(row)
            if (!entity) return
            void handleRestoreEntity(entity)
        },
        [handleRestoreEntity, resolveDisplayEntity]
    )

    const handleSelectPermanentDeleteTargetRow = useCallback(
        (row: Pick<EntityInstanceDisplayRow, 'id' | 'raw'>) => {
            const entity = resolveDisplayEntity(row)
            if (!entity) return
            handleSelectPermanentDeleteTarget(entity)
        },
        [handleSelectPermanentDeleteTarget, resolveDisplayEntity]
    )

    const buildFormTabs = useCallback(
        (
            {
                values,
                setValue,
                isLoading,
                errors
            }: {
                values: EntityInstanceFormValues
                setValue: (name: string, value: unknown) => void
                isLoading: boolean
                errors: Record<string, string>
            },
            options: { mode: 'create' | 'edit' | 'copy'; entityId?: string | null }
        ): TabConfig[] => {
            const tabs: TabConfig[] = [
                {
                    id: 'general',
                    label: t('entities.tabs.general', 'General'),
                    content: (
                        <GeneralTabFields
                            values={values}
                            setValue={setValue}
                            isLoading={isLoading}
                            errors={errors}
                            uiLocale={preferredVlcLocale}
                            nameLabel={tc('fields.name', 'Name')}
                            descriptionLabel={tc('fields.description', 'Description')}
                            codenameLabel={tc('fields.codename', 'Codename')}
                            codenameHelper={
                                usesLinkedCollectionAuthoring
                                    ? t(
                                          'catalogs.codenameHelper',
                                          'Unique identifier for URLs (lowercase Latin letters, numbers, hyphens). Auto-generated from the name with transliteration. You can edit it manually.'
                                      )
                                    : t(
                                          'entities.instances.fields.codenameHelper',
                                          'Stable codename used by generic entity instances and references'
                                      )
                            }
                            editingEntityId={options.mode === 'edit' ? options.entityId ?? null : null}
                        />
                    )
                }
            ]

            if (showBehaviorTab && entityType) {
                tabs.push({
                    id: 'behavior',
                    label: t('entities.instances.tabs.behavior', 'Behavior'),
                    content: (
                        <RecordBehaviorFields
                            value={getRecordBehaviorFormValue(values.recordBehavior)}
                            onChange={(nextValue) => setValue('recordBehavior', nextValue)}
                            disabled={isLoading}
                            components={entityType.components}
                            fieldOptions={options.mode === 'create' ? [] : behaviorFieldOptions}
                            ledgerOptions={behaviorLedgerOptions}
                            scriptOptions={options.mode === 'create' ? [] : behaviorScriptOptions}
                            errors={errors}
                        />
                    )
                })
            }

            if (showLedgerSchemaTab && entityType) {
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
                                        disabled={isLoading}
                                    />
                                }
                                label={t('entities.ledgerSchema.enabled', 'Use this entity as a ledger')}
                            />
                            {values.ledgerSchemaEnabled === true ? (
                                <LedgerSchemaFields
                                    value={getLedgerConfigFormValue(values.ledgerConfig)}
                                    onChange={(nextValue) => setValue('ledgerConfig', nextValue)}
                                    disabled={isLoading}
                                    components={entityType.components}
                                    fieldOptions={options.mode === 'create' ? [] : behaviorFieldOptions}
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

            if (showHubsTab) {
                const treeEntityIds = Array.isArray(values.treeEntityIds)
                    ? values.treeEntityIds.filter((value): value is string => typeof value === 'string')
                    : []

                tabs.push({
                    id: treeAssignmentTabId,
                    label: treeAssignmentTabId === 'hubs' ? t('hubs.title', 'Hubs') : t('entities.instances.tabs.containers', 'Containers'),
                    content: (
                        <ContainerSelectionPanel
                            availableContainers={treeEntities}
                            selectedContainerIds={treeEntityIds}
                            onSelectionChange={(nextTreeEntityIds) => setValue('treeEntityIds', nextTreeEntityIds)}
                            isContainerRequired={Boolean(values.isRequiredHub)}
                            onRequiredContainerChange={(nextValue) => setValue('isRequiredHub', nextValue)}
                            isSingleContainer={Boolean(values.isSingleHub)}
                            onSingleContainerChange={(nextValue) => setValue('isSingleHub', nextValue)}
                            disabled={isLoading}
                            error={errors.treeEntityIds}
                            uiLocale={preferredVlcLocale}
                            labelsOverride={containerSelectionLabels}
                        />
                    )
                })
            }

            if (options.mode === 'edit' && options.entityId && showAttributesTab) {
                tabs.push({
                    id: 'fieldDefinitions',
                    label: fieldDefinitionsTabLabel,
                    content: (
                        <FieldDefinitionListContent
                            metahubId={metahubId}
                            linkedCollectionId={options.entityId}
                            title={null}
                            emptyTitle={fieldDefinitionsEmptyTitle}
                            emptyDescription={fieldDefinitionsEmptyDescription}
                            renderPageShell={false}
                            showCatalogTabs={false}
                            showSettingsTab={false}
                            allowSystemTab={false}
                        />
                    )
                })
            }

            if (showLayoutTab && metahubId && ((options.mode === 'edit' && options.entityId) || showPageBlocksTab)) {
                tabs.push({
                    id: 'layout',
                    label: t('catalogs.tabs.layout', 'Layouts'),
                    content:
                        options.mode === 'edit' && options.entityId ? (
                            <LayoutList
                                metahubId={metahubId}
                                linkedCollectionId={options.entityId}
                                detailBasePath={buildEntityInstanceLayoutBasePath(metahubId, resolvedKindKey, options.entityId)}
                                title={null}
                                emptyTitle={
                                    usesLinkedCollectionAuthoring
                                        ? t('catalogs.layoutTab.emptyTitle', 'No catalog layouts')
                                        : t('entities.instances.layouts.emptyTitle', 'No layouts')
                                }
                                emptyDescription={
                                    usesLinkedCollectionAuthoring
                                        ? t(
                                              'catalogs.layoutTab.emptyDescription',
                                              'This catalog currently uses the active global layout. Create the first catalog layout to override widgets and catalog runtime behavior.'
                                          )
                                        : t(
                                              'entities.instances.layouts.emptyDescription',
                                              'Create the first layout to override the default runtime arrangement for this custom entity kind.'
                                          )
                                }
                                embedded
                            />
                        ) : (
                            <Alert severity='info'>
                                {t(
                                    'entities.instances.layouts.createHint',
                                    'Individual layouts can be configured after this entity is created.'
                                )}
                            </Alert>
                        )
                })
            }

            if (options.mode === 'edit' && options.entityId && showScriptsTab && metahubId) {
                tabs.push(
                    createScriptsTab({
                        t: translate,
                        metahubId,
                        attachedToKind: resolvedKindKey,
                        attachedToId: options.entityId
                    })
                )
            }

            if (options.mode === 'edit' && options.entityId && showActionsTab) {
                tabs.push(
                    createEntityActionsTab({
                        t: translate,
                        metahubId,
                        entityId: options.entityId,
                        attachedToKind: resolvedKindKey
                    })
                )
            }

            if (options.mode === 'edit' && options.entityId && showEventsTab) {
                tabs.push(
                    createEntityEventsTab({
                        t: translate,
                        metahubId,
                        entityId: options.entityId,
                        attachedToKind: resolvedKindKey
                    })
                )
            }

            if (options.mode === 'copy' && usesLinkedCollectionAuthoring) {
                tabs.push({
                    id: 'options',
                    label: t('catalogs.tabs.options', 'Options'),
                    content: <LinkedCollectionCopyOptionsTab values={values} setValue={setValue} isLoading={isLoading} t={translate} />
                })
            }

            return tabs
        },
        [
            containerSelectionLabels,
            behaviorFieldOptions,
            behaviorLedgerOptions,
            behaviorScriptOptions,
            ledgerEntityKindOptions,
            fieldDefinitionsEmptyDescription,
            fieldDefinitionsEmptyTitle,
            fieldDefinitionsTabLabel,
            entityType,
            treeEntities,
            usesLinkedCollectionAuthoring,
            metahubId,
            preferredVlcLocale,
            resolvedKindKey,
            showAttributesTab,
            showActionsTab,
            showBehaviorTab,
            showEventsTab,
            showHubsTab,
            showLayoutTab,
            showLedgerSchemaTab,
            showPageBlocksTab,
            showScriptsTab,
            t,
            treeAssignmentTabId,
            translate,
            tc
        ]
    )

    const renderHubSummary = useCallback(
        (row: EntityInstanceDisplayRow) => {
            if (row.treeEntityIds.length === 0) {
                return (
                    <Typography variant='body2' color='text.secondary'>
                        -
                    </Typography>
                )
            }

            return (
                <Stack direction='row' spacing={0.5} useFlexGap flexWrap='wrap'>
                    {row.treeEntityIds.slice(0, 2).map((treeEntityId) => (
                        <Chip key={treeEntityId} size='small' variant='outlined' label={hubNameById.get(treeEntityId) ?? treeEntityId} />
                    ))}
                    {row.treeEntityIds.length > 2 ? (
                        <Chip size='small' variant='outlined' label={`+${row.treeEntityIds.length - 2}`} />
                    ) : null}
                </Stack>
            )
        },
        [hubNameById]
    )

    const columns = useMemo(() => {
        const baseColumns = [
            {
                id: 'sortOrder',
                label: t('entities.instances.columns.sortOrder', '#'),
                width: '8%',
                sortable: true,
                sortAccessor: (row: EntityInstanceDisplayRow) => row.sortOrder ?? 0,
                render: (row: EntityInstanceDisplayRow) => (
                    <Typography variant='body2' sx={{ fontWeight: 600 }}>
                        {typeof row.sortOrder === 'number' ? row.sortOrder : '-'}
                    </Typography>
                )
            },
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '24%',
                sortable: true,
                sortAccessor: (row: EntityInstanceDisplayRow) => row.name.toLowerCase(),
                render: (row: EntityInstanceDisplayRow) => (
                    <Typography variant='body2' sx={{ fontWeight: 500 }}>
                        {row.name}
                    </Typography>
                )
            },
            {
                id: 'codename',
                label: tc('fields.codename', 'Codename'),
                width: '20%',
                sortable: true,
                sortAccessor: (row: EntityInstanceDisplayRow) => row.codename.toLowerCase(),
                render: (row: EntityInstanceDisplayRow) => (
                    <Typography variant='body2' sx={{ fontFamily: 'monospace' }}>
                        {row.codename || '-'}
                    </Typography>
                )
            },
            {
                id: 'treeEntities',
                label: treeAssignmentTabId === 'hubs' ? t('hubs.title', 'Hubs') : t('entities.instances.columns.containers', 'Containers'),
                width: '24%',
                sortable: true,
                sortAccessor: (row: EntityInstanceDisplayRow) => row.treeEntityIds.length,
                render: (row: EntityInstanceDisplayRow) => renderHubSummary(row)
            },
            {
                id: 'updatedAt',
                label: t('entities.columns.updatedAt', 'Updated'),
                width: showDeleted ? '14%' : '24%',
                sortable: true,
                sortAccessor: (row: EntityInstanceDisplayRow) => row.updatedAt ?? '',
                render: (row: EntityInstanceDisplayRow) => (
                    <Typography variant='body2'>{row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : '-'}</Typography>
                )
            }
        ]

        if (!showDeleted) {
            return baseColumns
        }

        return [
            ...baseColumns,
            {
                id: 'status',
                label: t('entities.instances.columns.status', 'Status'),
                width: '10%',
                sortable: true,
                sortAccessor: (row: EntityInstanceDisplayRow) => (row.isDeleted ? 1 : 0),
                render: (row: EntityInstanceDisplayRow) =>
                    row.isDeleted ? <Chip size='small' color='warning' label={t('entities.instances.badges.deleted', 'Deleted')} /> : null
            }
        ]
    }, [renderHubSummary, showDeleted, t, tc, treeAssignmentTabId])

    const renderEntityActionMenu = useCallback(
        (row: EntityInstanceDisplayRow) => {
            const canShowRestore = row.isDeleted && canRestoreEntityInstances
            const canShowPermanentDelete = row.isDeleted && canDeleteEntityInstances
            const canShowCopy = !row.isDeleted && canCopyEntityInstances
            const canShowEdit = !row.isDeleted && canEditEntityInstances
            const canShowDelete = !row.isDeleted && canDeleteEntityInstances

            if (!canShowRestore && !canShowPermanentDelete && !canShowCopy && !canShowEdit && !canShowDelete) {
                return null
            }

            const descriptors: ActionDescriptor<EntityInstanceDisplayRow>[] = []

            if (canShowRestore) {
                descriptors.push({
                    id: 'restore',
                    labelKey: 'common:actions.restore',
                    icon: createRestoreActionIcon(),
                    order: 10,
                    enabled: () => !restoreEntityMutation.isPending,
                    onSelect: ({ entity }) => handleRestoreEntityRow(entity)
                })
            }

            if (canShowPermanentDelete) {
                descriptors.push({
                    id: 'delete-permanently',
                    labelKey: 'common:actions.deletePermanently',
                    icon: createDeleteForeverActionIcon(),
                    tone: 'danger',
                    order: 20,
                    enabled: () => !permanentDeleteEntityMutation.isPending,
                    onSelect: ({ entity }) => handleSelectPermanentDeleteTargetRow(entity)
                })
            }

            if (canShowEdit) {
                descriptors.push({
                    id: 'edit',
                    labelKey: 'common:actions.edit',
                    icon: createEditActionIcon(),
                    order: 10,
                    onSelect: ({ entity }) => handleOpenEditRow(entity)
                })
            }

            if (canShowCopy) {
                descriptors.push({
                    id: 'copy',
                    labelKey: 'common:actions.copy',
                    icon: createCopyActionIcon(),
                    order: 20,
                    onSelect: ({ entity }) => handleOpenCopyRow(entity)
                })
            }

            if (canShowDelete) {
                descriptors.push({
                    id: 'delete',
                    labelKey: 'common:actions.delete',
                    icon: createDeleteActionIcon(),
                    tone: 'danger',
                    order: 100,
                    group: 'danger',
                    onSelect: ({ entity }) => handleOpenDeleteRow(entity)
                })
            }

            return (
                <Box onClick={(event) => event.stopPropagation()}>
                    <BaseEntityMenu<EntityInstanceDisplayRow>
                        entity={row}
                        entityKind={resolvedKindKey ?? 'entity'}
                        descriptors={descriptors}
                        namespace='metahubs'
                        menuButtonLabelKey='flowList:menu.button'
                        createContext={(base) => ({
                            entity: row,
                            entityKind: resolvedKindKey ?? 'entity',
                            t: base.t ?? ((key: string) => key)
                        })}
                    />
                </Box>
            )
        },
        [
            canCopyEntityInstances,
            canDeleteEntityInstances,
            canEditEntityInstances,
            canRestoreEntityInstances,
            handleOpenCopyRow,
            handleOpenDeleteRow,
            handleOpenEditRow,
            handleRestoreEntityRow,
            handleSelectPermanentDeleteTargetRow,
            permanentDeleteEntityMutation.isPending,
            restoreEntityMutation.isPending,
            resolvedKindKey
        ]
    )

    const entityTypeLoadError = useMemo(() => {
        if (!entityTypesQuery.error) return null
        return entityTypesQuery.error instanceof Error && entityTypesQuery.error.message
            ? entityTypesQuery.error.message
            : t('entities.instances.typeLoadError', 'Failed to load the custom entity type definition')
    }, [entityTypesQuery.error, t])

    const instancesLoadError = useMemo(() => {
        if (!paginationResult.error) return null
        return paginationResult.error.message || t('entities.instances.loadError', 'Failed to load entity instances')
    }, [paginationResult.error, t])

    const isMissingEntityType = Boolean(!entityTypesQuery.isLoading && !entityType && resolvedKindKey)
    const isEntityTypeInitialLoading = entityTypesQuery.isLoading && !entityType
    const isInstancesInitialLoading = Boolean(entityType && usesGenericEntityAuthoring && paginationResult.isLoading)
    const dialogTitles = useMemo(
        () => ({
            create: usesLinkedCollectionAuthoring
                ? t('catalogs.createDialog.title', 'Create LinkedCollectionEntity')
                : resolveEntityInstanceDialogTitle(entityType, 'create', preferredVlcLocale, translate, resolvedKindKey),
            edit: usesLinkedCollectionAuthoring
                ? t('catalogs.editDialog.title', 'Edit LinkedCollectionEntity')
                : resolveEntityInstanceDialogTitle(entityType, 'edit', preferredVlcLocale, translate, resolvedKindKey),
            copy: usesLinkedCollectionAuthoring
                ? t('catalogs.copyTitle', 'Copying LinkedCollectionEntity')
                : resolveEntityInstanceDialogTitle(entityType, 'copy', preferredVlcLocale, translate, resolvedKindKey),
            delete: usesLinkedCollectionAuthoring
                ? t('catalogs.deleteDialog.title', 'Delete LinkedCollectionEntity')
                : resolveEntityInstanceDialogTitle(entityType, 'delete', preferredVlcLocale, translate, resolvedKindKey),
            deletePermanent: usesLinkedCollectionAuthoring
                ? t('entities.instances.linkedCollectionDeletePermanentDialog.title', 'Delete Catalog Permanently')
                : resolveEntityInstanceDialogTitle(entityType, 'deletePermanent', preferredVlcLocale, translate, resolvedKindKey)
        }),
        [entityType, preferredVlcLocale, resolvedKindKey, t, translate, usesLinkedCollectionAuthoring]
    )

    return (
        <ExistingCodenamesProvider entities={codenameEntities}>
            <MainCard
                sx={{ maxWidth: '100%', width: '100%' }}
                contentSX={{ px: 0, py: 0 }}
                disableContentPadding
                disableHeader
                border={false}
                shadow={false}
            >
                <Stack flexDirection='column' sx={{ gap: 1 }}>
                    <ViewHeader
                        title={collectionTitle}
                        description={collectionDescription}
                        search
                        searchValue={searchValue}
                        onSearchChange={handleSearchChange}
                        searchPlaceholder={
                            standardCollectionI18nPrefix
                                ? t(`${standardCollectionI18nPrefix}.searchPlaceholder`, 'Search...')
                                : t('entities.instances.searchPlaceholder', 'Search entity instances...')
                        }
                    >
                        <ToolbarControls
                            viewToggleEnabled
                            viewMode={view}
                            onViewModeChange={(nextView) => setStoredView(nextView)}
                            cardViewTitle={tc('cardView')}
                            listViewTitle={tc('listView')}
                            primaryAction={
                                canManageEntityInstances
                                    ? {
                                          label: isStandardEntityCollection
                                              ? tc('actions.create', 'Create')
                                              : usesLinkedCollectionAuthoring
                                              ? t('catalogs.create', 'Create LinkedCollectionEntity')
                                              : t('entities.instances.actions.create', 'Create entity'),
                                          onClick: handleOpenCreate,
                                          startIcon: <AddRoundedIcon />,
                                          disabled: !entityType
                                      }
                                    : undefined
                            }
                        />
                    </ViewHeader>

                    {isHubScoped ? (
                        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                            <Tabs
                                value={activeHubScopedTab}
                                onChange={handleHubScopedTabChange}
                                aria-label={t('hubs.title', 'Hubs')}
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
                    ) : null}

                    {!isStandardEntityCollection ? (
                        <Alert severity='info'>
                            {t('entities.instances.banner', {
                                name: resolvedEntityTypeName,
                                defaultValue:
                                    'This page authors design-time instances for the selected entity kind on the unified entity-owned route surface.'
                            })}
                        </Alert>
                    ) : null}

                    {showManageEntityInstancesNotice ? (
                        <Alert severity='info'>
                            {t(
                                'entities.instances.noManagePermission',
                                'You do not have permission to manage entity instances for this metahub.'
                            )}
                        </Alert>
                    ) : null}

                    {entityTypeLoadError ? <Alert severity='error'>{entityTypeLoadError}</Alert> : null}
                    {instancesLoadError ? <Alert severity='error'>{instancesLoadError}</Alert> : null}

                    {isEntityTypeInitialLoading || isInstancesInitialLoading ? (
                        view === 'card' ? (
                            <SkeletonGrid insetMode='content' />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : isMissingEntityType ? (
                        <EmptyListState
                            image={APIEmptySVG}
                            imageAlt='Missing entity type'
                            title={t('entities.instances.customOnly', 'Custom entity type not found')}
                            description={t(
                                'entities.instances.customOnlyDescription',
                                'Generic entity instance authoring is available only for custom entity kinds that still exist in the current metahub.'
                            )}
                        />
                    ) : instanceRows.length === 0 ? (
                        <EmptyListState
                            image={APIEmptySVG}
                            imageAlt='No entity instances'
                            title={
                                searchValue
                                    ? standardCollectionI18nPrefix
                                        ? t(`${standardCollectionI18nPrefix}.noSearchResults`, 'No results found')
                                        : t('entities.instances.noSearchResults', 'No entity instances found')
                                    : standardCollectionI18nPrefix
                                    ? t(`${standardCollectionI18nPrefix}.empty`, 'No items yet')
                                    : t('entities.instances.empty', 'No entity instances yet')
                            }
                            description={
                                searchValue
                                    ? standardCollectionI18nPrefix
                                        ? t(`${standardCollectionI18nPrefix}.noSearchResultsHint`, 'Try a different search query.')
                                        : t(
                                              'entities.instances.noSearchResultsDescription',
                                              'Try a different search query or clear the filter.'
                                          )
                                    : standardCollectionI18nPrefix
                                    ? t(
                                          `${standardCollectionI18nPrefix}.emptyDescription`,
                                          'Create the first item to start authoring content.'
                                      )
                                    : t(
                                          'entities.instances.emptyDescription',
                                          'Create the first instance to start authoring this custom entity kind.'
                                      )
                            }
                        />
                    ) : view === 'card' ? (
                        <Box
                            sx={{
                                display: 'grid',
                                gap: gridSpacing,
                                gridTemplateColumns: {
                                    xs: '1fr',
                                    sm: 'repeat(auto-fill, minmax(240px, 1fr))',
                                    lg: 'repeat(auto-fill, minmax(280px, 1fr))'
                                }
                            }}
                        >
                            {instanceRows.map((row) => (
                                <ItemCard
                                    key={row.id}
                                    data={{ name: row.name, description: row.description }}
                                    onClick={!row.isDeleted && canOpenStandardCollectionRow ? () => handleOpenContentRow(row) : undefined}
                                    headerAction={renderEntityActionMenu(row)}
                                    footerStartContent={
                                        <Stack direction='row' spacing={0.5} useFlexGap flexWrap='wrap'>
                                            <Chip size='small' variant='outlined' label={row.codename || row.id} />
                                            {row.isDeleted ? (
                                                <Chip
                                                    size='small'
                                                    color='warning'
                                                    label={t('entities.instances.badges.deleted', 'Deleted')}
                                                />
                                            ) : null}
                                        </Stack>
                                    }
                                    footerEndContent={
                                        <Typography variant='caption' color='text.secondary'>
                                            {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : '-'}
                                        </Typography>
                                    }
                                />
                            ))}
                        </Box>
                    ) : (
                        <Box>
                            <FlowListTable<EntityInstanceDisplayRow>
                                data={instanceRows}
                                isLoading={paginationResult.isLoading}
                                customColumns={columns}
                                i18nNamespace='flowList'
                                renderActions={renderEntityActionMenu}
                                onRowClick={canOpenStandardCollectionRow ? (row) => handleOpenContentRow(row) : undefined}
                                initialOrder='desc'
                                initialOrderBy='updatedAt'
                                getRowSx={(row) => (row.isDeleted ? { backgroundColor: (theme) => theme.palette.action.hover } : undefined)}
                            />
                        </Box>
                    )}

                    {instanceRows.length > 0 ? (
                        <Box
                            data-testid='entity-instances-pagination'
                            sx={{
                                mt: 2,
                                width: '100%',
                                '& > div': {
                                    width: '100%'
                                }
                            }}
                        >
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

                <EntityFormDialog
                    open={dialogs.create.open && canCreateEntityInstances}
                    mode='create'
                    title={dialogTitles.create}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={usesLinkedCollectionAuthoring ? t('common:actions.create', 'Create') : tc('actions.create', 'Create')}
                    savingButtonText={
                        usesLinkedCollectionAuthoring ? t('common:actions.creating', 'Creating...') : tc('actions.creating', 'Creating...')
                    }
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onClose={() => close('create')}
                    onSave={handleCreateEntity}
                    hideDefaultFields
                    initialExtraValues={createInitialValues}
                    tabs={(helpers) => buildFormTabs(helpers, { mode: 'create' })}
                    validate={validateEntityForm}
                    canSave={canSaveEntityForm}
                    loading={createEntityMutation.isPending}
                />

                <EntityFormDialog
                    open={dialogs.edit.open && canEditEntityInstances}
                    mode='edit'
                    title={dialogTitles.edit}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={tc('actions.save', 'Save')}
                    savingButtonText={tc('actions.saving', 'Saving...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onClose={() => close('edit')}
                    onSave={handleUpdateEntity}
                    hideDefaultFields
                    initialExtraValues={editInitialValues}
                    tabs={(helpers) => buildFormTabs(helpers, { mode: 'edit', entityId: dialogs.edit.item?.id ?? null })}
                    validate={validateEntityForm}
                    canSave={canSaveEntityForm}
                    loading={updateEntityMutation.isPending || editEntityDetailQuery.isLoading}
                />

                <EntityFormDialog
                    open={dialogs.copy.open && canCopyEntityInstances}
                    mode='copy'
                    title={dialogTitles.copy}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={usesLinkedCollectionAuthoring ? t('catalogs.copy.action', 'Copy') : tc('actions.copy', 'Copy')}
                    savingButtonText={
                        usesLinkedCollectionAuthoring
                            ? t('catalogs.copy.actionLoading', 'Copying...')
                            : t('entities.instances.copyDialog.copying', 'Copying...')
                    }
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onClose={() => close('copy')}
                    onSave={handleCopyEntity}
                    hideDefaultFields
                    initialExtraValues={copyInitialValues}
                    tabs={(helpers) => buildFormTabs(helpers, { mode: 'copy' })}
                    validate={validateEntityForm}
                    canSave={canSaveEntityForm}
                    loading={copyEntityMutation.isPending || copyEntityDetailQuery.isLoading}
                />

                <ConfirmDeleteDialog
                    open={dialogs.delete.open && !usesLinkedCollectionAuthoring && canDeleteEntityInstances}
                    title={dialogTitles.delete}
                    description={
                        usesLinkedCollectionAuthoring
                            ? t('entities.instances.linkedCollectionDeleteDialog.description', {
                                  name: dialogs.delete.item
                                      ? buildInstanceDisplayRow(dialogs.delete.item, preferredVlcLocale, translate).name
                                      : resolvedEntityTypeName,
                                  defaultValue: 'Delete catalog "{{name}}"? You can restore it later while deleted items are visible.'
                              })
                            : t('entities.instances.deleteDialog.description', {
                                  name: dialogs.delete.item
                                      ? buildInstanceDisplayRow(dialogs.delete.item, preferredVlcLocale, translate).name
                                      : resolvedEntityTypeName,
                                  defaultValue: 'Delete entity "{{name}}"? You can restore it later while deleted items are visible.'
                              })
                    }
                    confirmButtonText={tc('actions.delete', 'Delete')}
                    deletingButtonText={tc('actions.deleting', 'Deleting...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onCancel={() => close('delete')}
                    onConfirm={handleDeleteEntity}
                    loading={deleteEntityMutation.isPending}
                />

                <LinkedCollectionDeleteDialog
                    open={Boolean(blockingDeleteTarget) && canDeleteEntityInstances && usesLinkedCollectionAuthoring}
                    catalog={blockingDeleteCatalog}
                    metahubId={metahubId ?? ''}
                    onClose={() => setBlockingDeleteTarget(null)}
                    onConfirm={() => {
                        if (!metahubId || !blockingDeleteTarget) return

                        deleteEntityMutation.mutate(
                            {
                                metahubId,
                                entityId: blockingDeleteTarget.id,
                                kind: resolvedKindKey
                            },
                            {
                                onSuccess: () => {
                                    setBlockingDeleteTarget(null)
                                }
                            }
                        )
                    }}
                    isDeleting={deleteEntityMutation.isPending}
                    uiLocale={preferredVlcLocale}
                />

                <ConfirmDeleteDialog
                    open={Boolean(permanentDeleteTarget) && canDeleteEntityInstances}
                    title={dialogTitles.deletePermanent}
                    description={
                        usesLinkedCollectionAuthoring
                            ? t('entities.instances.linkedCollectionDeletePermanentDialog.description', {
                                  name: permanentDeleteTarget
                                      ? buildInstanceDisplayRow(permanentDeleteTarget, preferredVlcLocale, translate).name
                                      : '',
                                  defaultValue: 'Permanently delete catalog "{{name}}"? This action cannot be undone.'
                              })
                            : t('entities.instances.deletePermanentDialog.description', {
                                  name: permanentDeleteTarget
                                      ? buildInstanceDisplayRow(permanentDeleteTarget, preferredVlcLocale, translate).name
                                      : '',
                                  defaultValue: 'Permanently delete entity "{{name}}"? This action cannot be undone.'
                              })
                    }
                    confirmButtonText={t('common:actions.deletePermanently', 'Delete permanently')}
                    deletingButtonText={
                        usesLinkedCollectionAuthoring
                            ? t('entities.instances.linkedCollectionDeletePermanentDialog.deleting', 'Deleting permanently...')
                            : t('entities.instances.deletePermanentDialog.deleting', 'Deleting permanently...')
                    }
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onCancel={() => setPermanentDeleteTarget(null)}
                    onConfirm={handlePermanentDeleteEntity}
                    loading={permanentDeleteEntityMutation.isPending}
                />

                <ConflictResolutionDialog
                    open={conflictState.open && canEditEntityInstances}
                    conflict={conflictState.conflict}
                    onCancel={handleCloseConflict}
                    onReload={handleReloadAfterConflict}
                    onOverwrite={handleOverwriteConflict}
                    isLoading={updateEntityMutation.isPending}
                />
            </MainCard>
        </ExistingCodenamesProvider>
    )
}

export default EntityInstanceListContent
