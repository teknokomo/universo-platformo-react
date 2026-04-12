import { useCallback, useMemo, useState } from 'react'
import { Alert, Box, Checkbox, Chip, FormControlLabel, IconButton, Skeleton, Stack, Switch, Tooltip, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import RestoreRoundedIcon from '@mui/icons-material/RestoreRounded'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { useCommonTranslations } from '@universo/i18n'
import type { EntitySelectionLabels } from '@universo/template-mui'
import {
    APIEmptySVG,
    EmptyListState,
    FlowListTable,
    ItemCard,
    PaginationControls,
    SkeletonGrid,
    TemplateMainCard as MainCard,
    ToolbarControls,
    ViewHeaderMUI as ViewHeader,
    gridSpacing,
    useDebouncedSearch,
    useListDialogs,
    usePaginated
} from '@universo/template-mui'
import { ConfirmDeleteDialog, ConflictResolutionDialog, EntityFormDialog, type TabConfig } from '@universo/template-mui/components/dialogs'
import {
    getLegacyCompatibleObjectKind,
    getLegacyCompatibleObjectKindForKindKey,
    isEnabledComponentConfig,
    type LegacyCompatibleObjectKind,
    type VersionedLocalizedContent
} from '@universo/types'
import { extractConflictInfo, isOptimisticLockConflict, normalizeCatalogCopyOptions, type ConflictInfo } from '@universo/utils'

import { ExistingCodenamesProvider, HubSelectionPanel } from '../../../components'
import { STORAGE_KEYS } from '../../../constants/storage'
import { useViewPreference } from '../../../hooks/useViewPreference'
import { getVLCString, type Catalog, type Metahub } from '../../../types'
import { ensureLocalizedContent, extractLocalizedInput, getLocalizedContentText, hasPrimaryContent } from '../../../utils/localizedInput'
import { isValidCodenameForStyle, normalizeCodenameForStyle } from '../../../utils/codename'
import { AttributeListContent } from '../../attributes/ui/AttributeList'
import CatalogList from '../../catalogs/ui/CatalogList'
import { useMetahubHubs } from '../../hubs/hooks'
import HubList from '../../hubs/ui/HubList'
import LayoutList from '../../layouts/ui/LayoutList'
import { useMetahubDetails } from '../../metahubs/hooks'
import { useCodenameConfig } from '../../settings/hooks/useCodenameConfig'
import { useEntityPermissions } from '../../settings/hooks/useEntityPermissions'
import { useMetahubPrimaryLocale } from '../../settings/hooks/useMetahubPrimaryLocale'
import { invalidateEntitiesQueries, metahubsQueryKeys } from '../../shared'
import GeneralTabFields from '../../shared/ui/GeneralTabFields'
import { createScriptsTab } from '../../scripts/ui/EntityScriptsTab'
import EnumerationList from '../../enumerations/ui/EnumerationList'
import SetList from '../../sets/ui/SetList'
import { createEntityActionsTab, createEntityEventsTab } from './EntityAutomationTab'
import type { MetahubEntityInstance, MetahubEntityType, UpdateEntityInstancePayload } from '../api'
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
import { CatalogDeleteDialog } from '../../../components'

type EntityInstancesViewMode = 'card' | 'list'
type EntityInstanceFormValues = Record<string, unknown>

type EntityInstanceDisplayRow = {
    id: string
    name: string
    description: string
    codename: string
    hubIds: string[]
    sortOrder: number | null
    updatedAt: string | null
    isDeleted: boolean
    raw: MetahubEntityInstance
}

const DIALOG_SAVE_CANCEL = { __dialogCancelled: true } as const
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const decodeKindKey = (value?: string): string => {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return ''
    }

    try {
        return decodeURIComponent(value).trim()
    } catch {
        return value.trim()
    }
}

const buildEntityInstanceLayoutBasePath = (metahubId: string, kindKey: string, entityId: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(kindKey)}/instance/${entityId}/layout`

const resolveLegacyCompatibleKind = (entityType: MetahubEntityType | null, kindKey: string): LegacyCompatibleObjectKind | null =>
    getLegacyCompatibleObjectKind(entityType?.config) ?? getLegacyCompatibleObjectKindForKindKey(kindKey)

const appendLocalizedCopySuffix = (
    value: VersionedLocalizedContent<string> | null | undefined,
    uiLocale: string,
    fallback?: string
): VersionedLocalizedContent<string> => {
    const locale = uiLocale === 'ru' ? 'ru' : 'en'
    const suffix = locale === 'ru' ? ' (копия)' : ' (copy)'

    if (!value) {
        const baseText = (fallback || '').trim()
        return {
            _schema: 'v1',
            _primary: locale,
            locales: {
                [locale]: {
                    content: baseText ? `${baseText}${suffix}` : locale === 'ru' ? `Копия${suffix}` : `Copy${suffix}`
                }
            }
        }
    }

    const nextLocales = { ...(value.locales || {}) } as Record<string, { content?: string }>
    for (const [entryLocale, entryValue] of Object.entries(nextLocales)) {
        const normalizedLocale = entryLocale === 'ru' ? 'ru' : 'en'
        const content = typeof entryValue?.content === 'string' ? entryValue.content.trim() : ''
        if (content.length > 0) {
            nextLocales[entryLocale] = { ...entryValue, content: `${content}${normalizedLocale === 'ru' ? ' (копия)' : ' (copy)'}` }
        }
    }

    const hasContent = Object.values(nextLocales).some((entry) => typeof entry?.content === 'string' && entry.content.trim().length > 0)
    if (!hasContent) {
        const baseText = (fallback || '').trim()
        nextLocales[locale] = {
            content: baseText ? `${baseText}${suffix}` : locale === 'ru' ? `Копия${suffix}` : `Copy${suffix}`
        }
    }

    return {
        ...value,
        locales: nextLocales
    }
}

const resolveEntityTypeName = (
    entityType: MetahubEntityType | null,
    uiLocale: string,
    t: (key: string, options?: Record<string, unknown>) => string,
    fallbackKindKey: string
) => {
    if (!entityType) {
        return fallbackKindKey
    }

    const codename = getLocalizedContentText(entityType.codename, uiLocale, entityType.kindKey)
    if (entityType.source === 'builtin') {
        return t(entityType.ui.nameKey, { defaultValue: entityType.ui.nameKey }) || codename || entityType.kindKey
    }

    return entityType.ui.nameKey || codename || entityType.kindKey
}

const getEntityConfig = (entity?: MetahubEntityInstance | null): Record<string, unknown> => {
    if (!isRecord(entity?.config)) {
        return {}
    }
    return entity.config
}

const getConfigHubIds = (config: Record<string, unknown>): string[] =>
    Array.isArray(config.hubs) ? config.hubs.filter((value): value is string => typeof value === 'string' && value.trim().length > 0) : []

const getConfigBoolean = (config: Record<string, unknown>, key: 'isSingleHub' | 'isRequiredHub') => config[key] === true

const buildInitialFormValues = (uiLocale: string, entity?: MetahubEntityInstance | null): EntityInstanceFormValues => {
    const nameFallback = entity
        ? getLocalizedContentText(entity.name, uiLocale, getLocalizedContentText(entity.codename, uiLocale, entity.id))
        : ''
    const descriptionFallback = entity ? getLocalizedContentText(entity.description, uiLocale, '') : ''
    const config = getEntityConfig(entity)

    return {
        nameVlc: entity ? ensureLocalizedContent(entity.name ?? null, uiLocale, nameFallback || entity.id) : null,
        descriptionVlc: entity?.description ? ensureLocalizedContent(entity.description, uiLocale, descriptionFallback) : null,
        codename: entity ? ensureLocalizedContent(entity.codename ?? null, uiLocale, nameFallback || entity.id) : null,
        codenameTouched: Boolean(entity),
        hubIds: getConfigHubIds(config),
        isSingleHub: getConfigBoolean(config, 'isSingleHub'),
        isRequiredHub: getConfigBoolean(config, 'isRequiredHub')
    }
}

const getCatalogCopyOptions = (values: EntityInstanceFormValues) =>
    normalizeCatalogCopyOptions({
        copyAttributes: values.copyAttributes as boolean | undefined,
        copyElements: values.copyElements as boolean | undefined
    })

const CatalogCopyOptionsTab = ({
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
    const options = getCatalogCopyOptions(values)

    return (
        <Stack spacing={1}>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={options.copyAttributes}
                        onChange={(event) => {
                            setValue('copyAttributes', event.target.checked)
                            if (!event.target.checked) {
                                setValue('copyElements', false)
                            }
                        }}
                        disabled={isLoading}
                    />
                }
                label={t('catalogs.copy.options.copyAttributes', 'Copy attributes')}
            />
            <FormControlLabel
                control={
                    <Checkbox
                        checked={options.copyElements}
                        onChange={(event) => setValue('copyElements', event.target.checked)}
                        disabled={isLoading || !options.copyAttributes}
                    />
                }
                label={t('catalogs.copy.options.copyElements', 'Copy elements')}
            />
        </Stack>
    )
}

const buildCopyInitialValues = (
    uiLocale: string,
    entity?: MetahubEntityInstance | null,
    catalogCompatible = false
): EntityInstanceFormValues => {
    const initial = buildInitialFormValues(uiLocale, entity)
    const nameFallback = entity
        ? getLocalizedContentText(entity.name, uiLocale, getLocalizedContentText(entity.codename, uiLocale, entity.id))
        : ''

    return {
        ...initial,
        nameVlc: appendLocalizedCopySuffix(initial.nameVlc as VersionedLocalizedContent<string> | null | undefined, uiLocale, nameFallback),
        codename: null,
        codenameTouched: false,
        ...(catalogCompatible ? normalizeCatalogCopyOptions() : {})
    }
}

const buildInstanceDisplayRow = (
    entity: MetahubEntityInstance,
    uiLocale: string,
    t: (key: string, options?: Record<string, unknown>) => string
): EntityInstanceDisplayRow => {
    const config = getEntityConfig(entity)
    const codename = getLocalizedContentText(entity.codename, uiLocale, '')
    const name = getLocalizedContentText(entity.name, uiLocale, codename || entity.id) || codename || entity.id
    const description = getLocalizedContentText(entity.description, uiLocale, '') || t('entities.noDescription', 'No description')
    const updatedAt =
        typeof entity.updatedAt === 'string' ? entity.updatedAt : typeof entity.createdAt === 'string' ? entity.createdAt : null
    const sortOrder =
        typeof entity.sortOrder === 'number' ? entity.sortOrder : typeof config.sortOrder === 'number' ? config.sortOrder : null

    return {
        id: entity.id,
        name,
        description,
        codename,
        hubIds: getConfigHubIds(config),
        sortOrder,
        updatedAt,
        isDeleted: entity._mhb_deleted === true,
        raw: entity
    }
}

const buildCatalogDeleteDialogEntity = ({
    entity,
    metahubId,
    uiLocale,
    hubs
}: {
    entity: MetahubEntityInstance
    metahubId: string
    uiLocale: string
    hubs: Array<{ id: string; codename: string; name: unknown }>
}): Catalog => {
    const config = getEntityConfig(entity)
    const codenameFallback = getLocalizedContentText(entity.codename, uiLocale, entity.id) || entity.id
    const nameFallback = getLocalizedContentText(entity.name, uiLocale, codenameFallback) || codenameFallback
    const sortOrder = typeof entity.sortOrder === 'number' ? entity.sortOrder : typeof config.sortOrder === 'number' ? config.sortOrder : 0
    const hubIds = getConfigHubIds(config)

    return {
        id: entity.id,
        metahubId,
        codename: ensureLocalizedContent(entity.codename ?? null, uiLocale, codenameFallback) as Catalog['codename'],
        name: ensureLocalizedContent(entity.name ?? null, uiLocale, nameFallback) as Catalog['name'],
        description: entity.description
            ? (ensureLocalizedContent(
                  entity.description ?? null,
                  uiLocale,
                  getLocalizedContentText(entity.description, uiLocale, '')
              ) as Catalog['description'])
            : undefined,
        isSingleHub: getConfigBoolean(config, 'isSingleHub'),
        isRequiredHub: getConfigBoolean(config, 'isRequiredHub'),
        sortOrder,
        createdAt: typeof entity.createdAt === 'string' ? entity.createdAt : '',
        updatedAt: typeof entity.updatedAt === 'string' ? entity.updatedAt : typeof entity.createdAt === 'string' ? entity.createdAt : '',
        version: typeof entity.version === 'number' ? entity.version : undefined,
        hubs: hubs.filter((hub) => hubIds.includes(hub.id)).map((hub) => ({ id: hub.id, codename: hub.codename, name: hub.name }))
    }
}

const EntityInstanceList = () => {
    const { metahubId, kindKey: routeKindKey } = useParams<{ metahubId: string; kindKey: string }>()
    const resolvedKindKey = useMemo(() => decodeKindKey(routeKindKey), [routeKindKey])
    const preferredVlcLocale = useMetahubPrimaryLocale()
    const codenameConfig = useCodenameConfig()
    const { t } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()
    const queryClient = useQueryClient()
    const metahubDetailsQuery = useMetahubDetails(metahubId ?? '', { enabled: Boolean(metahubId) })
    const cachedMetahub = metahubId ? queryClient.getQueryData<Metahub>(metahubsQueryKeys.detail(metahubId)) : undefined
    const resolvedPermissions = metahubDetailsQuery.data?.permissions ?? cachedMetahub?.permissions
    const { allowCopy: allowCatalogCopy, allowDelete: allowCatalogDelete } = useEntityPermissions('catalogs')

    const [showDeleted, setShowDeleted] = useState(false)
    const [storedView, setStoredView] = useViewPreference(STORAGE_KEYS.ENTITY_INSTANCE_DISPLAY_STYLE, 'list')
    const view = (storedView === 'table' ? 'list' : storedView) as EntityInstancesViewMode
    const hubs = useMetahubHubs(metahubId)

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
        includeBuiltins: false,
        limit: 1000,
        offset: 0,
        sortBy: 'codename',
        sortOrder: 'asc'
    })

    const entityType = useMemo(
        () => (entityTypesQuery.data?.items ?? []).find((item) => item.kindKey === resolvedKindKey) ?? null,
        [entityTypesQuery.data?.items, resolvedKindKey]
    )

    const resolvedEntityTypeName = useMemo(
        () => resolveEntityTypeName(entityType, preferredVlcLocale, t, resolvedKindKey),
        [entityType, preferredVlcLocale, resolvedKindKey, t]
    )
    const legacyCompatibleKind = useMemo(() => resolveLegacyCompatibleKind(entityType, resolvedKindKey), [entityType, resolvedKindKey])
    const isLegacyCompatibleMode = legacyCompatibleKind !== null
    const isCatalogCompatibleMode = legacyCompatibleKind === 'catalog'
    const canEditCatalogCompatibleInstances = resolvedPermissions?.editContent === true
    const canDeleteCatalogCompatibleInstances = resolvedPermissions?.deleteContent === true
    const canManageEntityInstances = isCatalogCompatibleMode
        ? canEditCatalogCompatibleInstances
        : resolvedPermissions?.manageMetahub === true
    const canCreateEntityInstances = canManageEntityInstances
    const canEditEntityInstances = canManageEntityInstances
    const canCopyEntityInstances = isCatalogCompatibleMode
        ? canEditCatalogCompatibleInstances && allowCatalogCopy
        : canManageEntityInstances
    const canDeleteEntityInstances = isCatalogCompatibleMode
        ? canDeleteCatalogCompatibleInstances && allowCatalogDelete
        : canManageEntityInstances
    const canRestoreEntityInstances = isCatalogCompatibleMode ? canEditCatalogCompatibleInstances : canManageEntityInstances
    const showManageEntityInstancesNotice = Boolean(resolvedPermissions) && !canCreateEntityInstances

    const requestedTabs = useMemo(() => new Set(entityType?.ui.tabs ?? []), [entityType?.ui.tabs])
    const showHubsTab = Boolean(entityType && isEnabledComponentConfig(entityType.components.hubAssignment) && requestedTabs.has('hubs'))
    const showAttributesTab = Boolean(entityType && isEnabledComponentConfig(entityType.components.dataSchema))
    const showLayoutTab = Boolean(entityType && isEnabledComponentConfig(entityType.components.layoutConfig) && requestedTabs.has('layout'))
    const showScriptsTab = Boolean(entityType && isEnabledComponentConfig(entityType.components.scripting) && requestedTabs.has('scripts'))
    const showActionsTab = Boolean(entityType && isEnabledComponentConfig(entityType.components.actions))
    const showEventsTab = Boolean(entityType && isEnabledComponentConfig(entityType.components.events))

    const paginationResult = usePaginated<MetahubEntityInstance, 'updated' | 'sortOrder'>({
        queryKeyFn: (params) =>
            metahubId && resolvedKindKey
                ? metahubsQueryKeys.entitiesList(metahubId, {
                      ...params,
                      kind: resolvedKindKey,
                      locale: preferredVlcLocale,
                      includeDeleted: showDeleted
                  })
                : ['metahubs', 'entities', 'empty', resolvedKindKey, showDeleted],
        queryFn: (params) =>
            entitiesApi.listEntityInstances(metahubId!, {
                ...params,
                kind: resolvedKindKey,
                locale: preferredVlcLocale,
                includeDeleted: showDeleted
            }),
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc',
        enabled: Boolean(metahubId && resolvedKindKey && entityType && !isLegacyCompatibleMode),
        keepPreviousDataOnQueryKeyChange: false
    })

    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    const existingCodenameQuery = useEntityInstancesQuery(
        metahubId,
        isLegacyCompatibleMode
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
                hubs.map((hub) => [
                    hub.id,
                    getLocalizedContentText(hub.name, preferredVlcLocale, getVLCString(hub.name, 'en') || hub.codename)
                ])
            ),
        [hubs, preferredVlcLocale]
    )

    const instanceById = useMemo(
        () => new Map(paginationResult.data.map((entity) => [entity.id, entity] as const)),
        [paginationResult.data]
    )

    const instanceRows = useMemo(
        () => paginationResult.data.map((entity) => buildInstanceDisplayRow(entity, preferredVlcLocale, t)),
        [paginationResult.data, preferredVlcLocale, t]
    )

    const codenameEntities = useMemo(() => {
        if (isLegacyCompatibleMode) {
            return []
        }

        return (existingCodenameQuery.data?.items ?? paginationResult.data).filter((entity) => entity.kind === resolvedKindKey)
    }, [existingCodenameQuery.data?.items, isLegacyCompatibleMode, paginationResult.data, resolvedKindKey])

    const editDialogEntity = editEntityDetailQuery.data ?? dialogs.edit.item
    const copyDialogEntity = copyEntityDetailQuery.data ?? dialogs.copy.item

    const createInitialValues = useMemo(() => buildInitialFormValues(preferredVlcLocale, null), [preferredVlcLocale])
    const editInitialValues = useMemo(
        () => buildInitialFormValues(preferredVlcLocale, editDialogEntity),
        [editDialogEntity, preferredVlcLocale]
    )
    const copyInitialValues = useMemo(
        () => buildCopyInitialValues(preferredVlcLocale, copyDialogEntity, isCatalogCompatibleMode),
        [copyDialogEntity, isCatalogCompatibleMode, preferredVlcLocale]
    )
    const blockingDeleteCatalog = useMemo(
        () =>
            blockingDeleteTarget && metahubId
                ? buildCatalogDeleteDialogEntity({
                      entity: blockingDeleteTarget,
                      metahubId,
                      uiLocale: preferredVlcLocale,
                      hubs
                  })
                : null,
        [blockingDeleteTarget, hubs, metahubId, preferredVlcLocale]
    )

    const hubSelectionLabels = useMemo<Partial<EntitySelectionLabels>>(
        () => ({
            title: t('entities.instances.tabs.hubs', 'Hubs'),
            addButton: t('entities.instances.hubs.addButton', 'Add'),
            dialogTitle: t('entities.instances.hubs.dialogTitle', 'Select hubs'),
            emptyMessage: t('entities.instances.hubs.empty', 'No hubs selected'),
            requiredWarningMessage: t('entities.instances.validation.hubRequired', 'At least one hub is required'),
            noAvailableMessage: t('entities.instances.hubs.noAvailable', 'No hubs available'),
            confirmButton: t('common:actions.add', 'Add'),
            removeTitle: t('common:actions.remove', 'Remove'),
            requiredLabel: t('entities.instances.hubs.requiredLabel', 'Hub required'),
            requiredEnabledHelp: t('entities.instances.hubs.requiredEnabledHelp', 'The entity must be linked to at least one hub'),
            requiredDisabledHelp: t('entities.instances.hubs.requiredDisabledHelp', 'The entity can exist without hub links'),
            singleLabel: t('entities.instances.hubs.singleLabel', 'Single hub only'),
            singleEnabledHelp: t('entities.instances.hubs.singleEnabledHelp', 'The entity can only be linked to one hub'),
            singleDisabledHelp: t('entities.instances.hubs.singleDisabledHelp', 'The entity can be linked to multiple hubs'),
            singleWarning: t('entities.instances.validation.singleHubInvalid', 'Single hub entities cannot be linked to multiple hubs')
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
                const hubIds = Array.isArray(values.hubIds)
                    ? values.hubIds.filter((value): value is string => typeof value === 'string')
                    : []
                const isRequiredHub = Boolean(values.isRequiredHub)
                const isSingleHub = Boolean(values.isSingleHub)

                if (isRequiredHub && hubIds.length === 0) {
                    errors.hubIds = t('entities.instances.validation.hubRequired', 'At least one hub is required')
                } else if (isSingleHub && hubIds.length > 1) {
                    errors.hubIds = t(
                        'entities.instances.validation.singleHubInvalid',
                        'Single hub entities cannot be linked to multiple hubs'
                    )
                }
            }

            return Object.keys(errors).length > 0 ? errors : null
        },
        [codenameConfig.allowMixed, codenameConfig.alphabet, codenameConfig.style, preferredVlcLocale, showHubsTab, t, tc]
    )

    const canSaveEntityForm = useCallback(
        (values: EntityInstanceFormValues) => {
            const nameVlc = (values.nameVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
            const codenameValue = (values.codename as VersionedLocalizedContent<string> | null | undefined) ?? null
            const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? preferredVlcLocale
            const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
            const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
            const hubIds = Array.isArray(values.hubIds) ? values.hubIds.filter((value): value is string => typeof value === 'string') : []
            const isRequiredHub = Boolean(values.isRequiredHub)
            const isSingleHub = Boolean(values.isSingleHub)
            const hubsValid = !showHubsTab || ((!isRequiredHub || hubIds.length > 0) && (!isSingleHub || hubIds.length <= 1))

            return (
                !values._hasCodenameDuplicate &&
                hubsValid &&
                hasPrimaryContent(nameVlc) &&
                Boolean(normalizedCodename) &&
                isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            )
        },
        [codenameConfig.allowMixed, codenameConfig.alphabet, codenameConfig.style, preferredVlcLocale, showHubsTab]
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
                const hubIds = Array.isArray(values.hubIds)
                    ? values.hubIds.filter((value): value is string => typeof value === 'string')
                    : []
                nextConfig.hubs = hubIds
                nextConfig.isSingleHub = Boolean(values.isSingleHub)
                nextConfig.isRequiredHub = Boolean(values.isRequiredHub)
            }

            if (Object.keys(nextConfig).length === 0) {
                return preserveBaseConfig && hasBaseConfig ? nextConfig : undefined
            }

            return nextConfig
        },
        [showHubsTab]
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

            return {
                codename: ensureLocalizedContent(codenameValue, codenamePrimaryLocale, normalizedCodename),
                name,
                namePrimaryLocale: namePrimaryLocale ?? preferredVlcLocale,
                description: description ?? undefined,
                descriptionPrimaryLocale: description ? descriptionPrimaryLocale ?? namePrimaryLocale ?? preferredVlcLocale : undefined,
                config: buildConfigPayload({ values, baseConfig, preserveBaseConfig })
            }
        },
        [buildConfigPayload, codenameConfig.alphabet, codenameConfig.style, preferredVlcLocale]
    )

    const handleCreateEntity = useCallback(
        async (values: EntityInstanceFormValues) => {
            if (!metahubId || !resolvedKindKey || !canCreateEntityInstances) return

            await createEntityMutation.mutateAsync({
                metahubId,
                data: {
                    kind: resolvedKindKey,
                    ...buildEntityPayload({ values, preserveBaseConfig: false })
                }
            })
        },
        [buildEntityPayload, canCreateEntityInstances, createEntityMutation, metahubId, resolvedKindKey]
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
                    ...(isCatalogCompatibleMode ? getCatalogCopyOptions(values) : {})
                }
            })
        },
        [
            buildEntityPayload,
            canCopyEntityInstances,
            copyDialogEntity,
            copyEntityMutation,
            isCatalogCompatibleMode,
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

            if (isCatalogCompatibleMode) {
                setBlockingDeleteTarget(entity)
                return
            }

            openDelete(entity)
        },
        [canDeleteEntityInstances, isCatalogCompatibleMode, openDelete]
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
                                isCatalogCompatibleMode
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

            if (showHubsTab) {
                const hubIds = Array.isArray(values.hubIds)
                    ? values.hubIds.filter((value): value is string => typeof value === 'string')
                    : []

                tabs.push({
                    id: 'hubs',
                    label: t('entities.instances.tabs.hubs', 'Hubs'),
                    content: (
                        <HubSelectionPanel
                            availableHubs={hubs}
                            selectedHubIds={hubIds}
                            onSelectionChange={(nextHubIds) => setValue('hubIds', nextHubIds)}
                            isRequiredHub={Boolean(values.isRequiredHub)}
                            onRequiredHubChange={(nextValue) => setValue('isRequiredHub', nextValue)}
                            isSingleHub={Boolean(values.isSingleHub)}
                            onSingleHubChange={(nextValue) => setValue('isSingleHub', nextValue)}
                            disabled={isLoading}
                            error={errors.hubIds}
                            uiLocale={preferredVlcLocale}
                            labelsOverride={hubSelectionLabels}
                        />
                    )
                })
            }

            if (options.mode === 'edit' && options.entityId && showAttributesTab) {
                tabs.push({
                    id: 'attributes',
                    label: t('entities.instances.tabs.attributes', 'Attributes'),
                    content: (
                        <AttributeListContent
                            metahubId={metahubId}
                            catalogId={options.entityId}
                            title={null}
                            emptyTitle={t('entities.instances.attributes.emptyTitle', 'No attributes')}
                            emptyDescription={t(
                                'entities.instances.attributes.emptyDescription',
                                'Create the first attribute to define the schema for this custom entity kind.'
                            )}
                            renderPageShell={false}
                            showCatalogTabs={false}
                            showSettingsTab={false}
                            allowSystemTab={false}
                        />
                    )
                })
            }

            if (options.mode === 'edit' && options.entityId && showLayoutTab && metahubId) {
                tabs.push({
                    id: 'layout',
                    label: t('catalogs.tabs.layout', 'Layouts'),
                    content: (
                        <LayoutList
                            metahubId={metahubId}
                            catalogId={options.entityId}
                            detailBasePath={buildEntityInstanceLayoutBasePath(metahubId, resolvedKindKey, options.entityId)}
                            title={null}
                            emptyTitle={
                                isCatalogCompatibleMode
                                    ? t('catalogs.layoutTab.emptyTitle', 'No catalog layouts')
                                    : t('entities.instances.layouts.emptyTitle', 'No layouts')
                            }
                            emptyDescription={
                                isCatalogCompatibleMode
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
                    )
                })
            }

            if (options.mode === 'edit' && options.entityId && showScriptsTab && metahubId) {
                tabs.push(
                    createScriptsTab({
                        t,
                        metahubId,
                        attachedToKind: isCatalogCompatibleMode ? 'catalog' : resolvedKindKey,
                        attachedToId: options.entityId
                    })
                )
            }

            if (options.mode === 'edit' && options.entityId && showActionsTab) {
                tabs.push(
                    createEntityActionsTab({
                        t,
                        metahubId,
                        entityId: options.entityId,
                        attachedToKind: isCatalogCompatibleMode ? 'catalog' : resolvedKindKey
                    })
                )
            }

            if (options.mode === 'edit' && options.entityId && showEventsTab) {
                tabs.push(
                    createEntityEventsTab({
                        t,
                        metahubId,
                        entityId: options.entityId,
                        attachedToKind: isCatalogCompatibleMode ? 'catalog' : resolvedKindKey
                    })
                )
            }

            if (options.mode === 'copy' && isCatalogCompatibleMode) {
                tabs.push({
                    id: 'options',
                    label: t('catalogs.tabs.options', 'Options'),
                    content: <CatalogCopyOptionsTab values={values} setValue={setValue} isLoading={isLoading} t={t} />
                })
            }

            return tabs
        },
        [
            hubSelectionLabels,
            hubs,
            isCatalogCompatibleMode,
            metahubId,
            preferredVlcLocale,
            resolvedKindKey,
            showAttributesTab,
            showActionsTab,
            showEventsTab,
            showHubsTab,
            showLayoutTab,
            showScriptsTab,
            t,
            tc
        ]
    )

    const renderHubSummary = useCallback(
        (row: EntityInstanceDisplayRow) => {
            if (row.hubIds.length === 0) {
                return (
                    <Typography variant='body2' color='text.secondary'>
                        -
                    </Typography>
                )
            }

            return (
                <Stack direction='row' spacing={0.5} useFlexGap flexWrap='wrap'>
                    {row.hubIds.slice(0, 2).map((hubId) => (
                        <Chip key={hubId} size='small' variant='outlined' label={hubNameById.get(hubId) ?? hubId} />
                    ))}
                    {row.hubIds.length > 2 ? <Chip size='small' variant='outlined' label={`+${row.hubIds.length - 2}`} /> : null}
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
                id: 'hubs',
                label: t('entities.instances.columns.hubs', 'Hubs'),
                width: '24%',
                sortable: true,
                sortAccessor: (row: EntityInstanceDisplayRow) => row.hubIds.length,
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
    }, [renderHubSummary, showDeleted, t, tc])

    const renderRowActions = useCallback(
        (row: EntityInstanceDisplayRow) => {
            const canShowRestore = row.isDeleted && canRestoreEntityInstances
            const canShowPermanentDelete = row.isDeleted && canDeleteEntityInstances
            const canShowCopy = !row.isDeleted && canCopyEntityInstances
            const canShowEdit = !row.isDeleted && canEditEntityInstances
            const canShowDelete = !row.isDeleted && canDeleteEntityInstances

            if (!canShowRestore && !canShowPermanentDelete && !canShowCopy && !canShowEdit && !canShowDelete) {
                return null
            }

            return (
                <Stack direction='row' spacing={0.5} onClick={(event) => event.stopPropagation()}>
                    {row.isDeleted ? (
                        <>
                            {canShowRestore ? (
                                <Tooltip title={t('common:actions.restore', 'Restore')}>
                                    <IconButton
                                        size='small'
                                        color='primary'
                                        aria-label={t('common:actions.restore', 'Restore')}
                                        onClick={() => handleRestoreEntityRow(row)}
                                        disabled={restoreEntityMutation.isPending}
                                    >
                                        <RestoreRoundedIcon fontSize='small' />
                                    </IconButton>
                                </Tooltip>
                            ) : null}
                            {canShowPermanentDelete ? (
                                <Tooltip title={t('common:actions.deletePermanently', 'Delete permanently')}>
                                    <IconButton
                                        size='small'
                                        color='error'
                                        aria-label={t('common:actions.deletePermanently', 'Delete permanently')}
                                        onClick={() => handleSelectPermanentDeleteTargetRow(row)}
                                        disabled={permanentDeleteEntityMutation.isPending}
                                    >
                                        <DeleteForeverRoundedIcon fontSize='small' />
                                    </IconButton>
                                </Tooltip>
                            ) : null}
                        </>
                    ) : (
                        <>
                            {canShowCopy ? (
                                <Tooltip title={tc('actions.copy', 'Copy')}>
                                    <IconButton
                                        size='small'
                                        aria-label={tc('actions.copy', 'Copy')}
                                        onClick={() => handleOpenCopyRow(row)}
                                    >
                                        <ContentCopyRoundedIcon fontSize='small' />
                                    </IconButton>
                                </Tooltip>
                            ) : null}
                            {canShowEdit ? (
                                <Tooltip title={tc('actions.edit', 'Edit')}>
                                    <IconButton
                                        size='small'
                                        aria-label={tc('actions.edit', 'Edit')}
                                        onClick={() => handleOpenEditRow(row)}
                                    >
                                        <EditRoundedIcon fontSize='small' />
                                    </IconButton>
                                </Tooltip>
                            ) : null}
                            {canShowDelete ? (
                                <Tooltip title={tc('actions.delete', 'Delete')}>
                                    <IconButton
                                        size='small'
                                        color='error'
                                        aria-label={tc('actions.delete', 'Delete')}
                                        onClick={() => handleOpenDeleteRow(row)}
                                    >
                                        <DeleteOutlineRoundedIcon fontSize='small' />
                                    </IconButton>
                                </Tooltip>
                            ) : null}
                        </>
                    )}
                </Stack>
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
            t,
            tc
        ]
    )

    const renderCardAction = useCallback(
        (row: EntityInstanceDisplayRow) => {
            const canShowRestore = row.isDeleted && canRestoreEntityInstances
            const canShowPermanentDelete = row.isDeleted && canDeleteEntityInstances
            const canShowCopy = !row.isDeleted && canCopyEntityInstances
            const canShowEdit = !row.isDeleted && canEditEntityInstances
            const canShowDelete = !row.isDeleted && canDeleteEntityInstances

            if (!canShowRestore && !canShowPermanentDelete && !canShowCopy && !canShowEdit && !canShowDelete) {
                return null
            }

            return (
                <Stack direction='row' spacing={0.5} onClick={(event) => event.stopPropagation()}>
                    {row.isDeleted ? (
                        <>
                            {canShowRestore ? (
                                <Tooltip title={t('common:actions.restore', 'Restore')}>
                                    <IconButton
                                        size='small'
                                        color='primary'
                                        aria-label={t('common:actions.restore', 'Restore')}
                                        onClick={() => handleRestoreEntityRow(row)}
                                        disabled={restoreEntityMutation.isPending}
                                    >
                                        <RestoreRoundedIcon fontSize='small' />
                                    </IconButton>
                                </Tooltip>
                            ) : null}
                            {canShowPermanentDelete ? (
                                <Tooltip title={t('common:actions.deletePermanently', 'Delete permanently')}>
                                    <IconButton
                                        size='small'
                                        color='error'
                                        aria-label={t('common:actions.deletePermanently', 'Delete permanently')}
                                        onClick={() => handleSelectPermanentDeleteTargetRow(row)}
                                        disabled={permanentDeleteEntityMutation.isPending}
                                    >
                                        <DeleteForeverRoundedIcon fontSize='small' />
                                    </IconButton>
                                </Tooltip>
                            ) : null}
                        </>
                    ) : (
                        <>
                            {canShowCopy ? (
                                <Tooltip title={tc('actions.copy', 'Copy')}>
                                    <IconButton
                                        size='small'
                                        aria-label={tc('actions.copy', 'Copy')}
                                        onClick={() => handleOpenCopyRow(row)}
                                    >
                                        <ContentCopyRoundedIcon fontSize='small' />
                                    </IconButton>
                                </Tooltip>
                            ) : null}
                            {canShowEdit ? (
                                <Tooltip title={tc('actions.edit', 'Edit')}>
                                    <IconButton
                                        size='small'
                                        aria-label={tc('actions.edit', 'Edit')}
                                        onClick={() => handleOpenEditRow(row)}
                                    >
                                        <EditRoundedIcon fontSize='small' />
                                    </IconButton>
                                </Tooltip>
                            ) : null}
                            {canShowDelete ? (
                                <Tooltip title={tc('actions.delete', 'Delete')}>
                                    <IconButton
                                        size='small'
                                        color='error'
                                        aria-label={tc('actions.delete', 'Delete')}
                                        onClick={() => handleOpenDeleteRow(row)}
                                    >
                                        <DeleteOutlineRoundedIcon fontSize='small' />
                                    </IconButton>
                                </Tooltip>
                            ) : null}
                        </>
                    )}
                </Stack>
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
            t,
            tc
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

    if (legacyCompatibleKind === 'catalog') {
        return <CatalogList />
    }

    if (legacyCompatibleKind === 'hub') {
        return <HubList />
    }

    if (legacyCompatibleKind === 'set') {
        return <SetList />
    }

    if (legacyCompatibleKind === 'enumeration') {
        return <EnumerationList />
    }

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
                        title={t('entities.instances.title', {
                            name: resolvedEntityTypeName,
                            defaultValue: '{{name}} instances'
                        })}
                        description={t('entities.instances.description', {
                            name: resolvedEntityTypeName,
                            kindKey: resolvedKindKey,
                            defaultValue: isCatalogCompatibleMode
                                ? 'Manage {{name}} through the shared catalog-compatible authoring surface for custom kind {{kindKey}}.'
                                : 'Manage {{name}} instances for custom kind {{kindKey}}.'
                        })}
                        search
                        searchValue={searchValue}
                        onSearchChange={handleSearchChange}
                        searchPlaceholder={t('entities.instances.searchPlaceholder', 'Search entity instances...')}
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
                                          label: isCatalogCompatibleMode
                                              ? t('catalogs.create', 'Create Catalog')
                                              : t('entities.instances.actions.create', 'Create entity'),
                                          onClick: handleOpenCreate,
                                          startIcon: <AddRoundedIcon />,
                                          disabled: !entityType
                                      }
                                    : undefined
                            }
                        >
                            <FormControlLabel
                                control={
                                    <Switch size='small' checked={showDeleted} onChange={(event) => setShowDeleted(event.target.checked)} />
                                }
                                label={t('entities.instances.filters.showDeleted', 'Show deleted')}
                                sx={{ mx: 0.5 }}
                            />
                        </ToolbarControls>
                    </ViewHeader>

                    <Alert severity='info'>
                        {isCatalogCompatibleMode
                            ? t(
                                  'entities.instances.catalogCompatibleBanner',
                                  'This page reuses the Catalogs authoring contract for a catalog-compatible custom kind, including catalog copy options, layouts, and scripts.'
                              )
                            : t('entities.instances.banner', {
                                  name: resolvedEntityTypeName,
                                  defaultValue:
                                      'This page authors design-time instances for the selected custom entity kind without replacing the legacy catalog/set/enumeration management surfaces.'
                              })}
                    </Alert>

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

                    {entityTypesQuery.isLoading && !entityType ? (
                        view === 'card' ? (
                            <SkeletonGrid />
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
                                    ? t('entities.instances.noSearchResults', 'No entity instances found')
                                    : t('entities.instances.empty', 'No entity instances yet')
                            }
                            description={
                                searchValue
                                    ? t(
                                          'entities.instances.noSearchResultsDescription',
                                          'Try a different search query or clear the filter.'
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
                                mx: { xs: -1.5, md: -2 },
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
                                    onClick={!row.isDeleted && canEditEntityInstances ? () => handleOpenEditRow(row) : undefined}
                                    headerAction={renderCardAction(row)}
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
                        <Box sx={{ mx: { xs: -1.5, md: -2 } }}>
                            <FlowListTable<EntityInstanceDisplayRow>
                                data={instanceRows}
                                isLoading={paginationResult.isLoading}
                                customColumns={columns}
                                i18nNamespace='flowList'
                                renderActions={renderRowActions}
                                initialOrder='desc'
                                initialOrderBy='updatedAt'
                                getRowSx={(row) => (row.isDeleted ? { backgroundColor: (theme) => theme.palette.action.hover } : undefined)}
                            />
                        </Box>
                    )}

                    {instanceRows.length > 0 ? (
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: { xs: 0, md: 1 } }}>
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
                    title={
                        isCatalogCompatibleMode
                            ? t('catalogs.createDialog.title', 'Create Catalog')
                            : t('entities.instances.createDialog.title', 'Create Entity')
                    }
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={isCatalogCompatibleMode ? t('common:actions.create', 'Create') : tc('actions.create', 'Create')}
                    savingButtonText={
                        isCatalogCompatibleMode ? t('common:actions.creating', 'Creating...') : tc('actions.creating', 'Creating...')
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
                    title={
                        isCatalogCompatibleMode
                            ? t('catalogs.editDialog.title', 'Edit Catalog')
                            : t('entities.instances.editDialog.title', 'Edit Entity')
                    }
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
                    title={
                        isCatalogCompatibleMode
                            ? t('catalogs.copyTitle', 'Copying Catalog')
                            : t('entities.instances.copyDialog.title', 'Copy Entity')
                    }
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={isCatalogCompatibleMode ? t('catalogs.copy.action', 'Copy') : tc('actions.copy', 'Copy')}
                    savingButtonText={
                        isCatalogCompatibleMode
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
                    open={dialogs.delete.open && !isCatalogCompatibleMode && canDeleteEntityInstances}
                    title={
                        isCatalogCompatibleMode
                            ? t('catalogs.deleteDialog.title', 'Delete Catalog')
                            : t('entities.instances.deleteDialog.title', 'Delete Entity')
                    }
                    description={
                        isCatalogCompatibleMode
                            ? t('entities.instances.catalogCompatibleDeleteDialog.description', {
                                  name: dialogs.delete.item
                                      ? buildInstanceDisplayRow(dialogs.delete.item, preferredVlcLocale, t).name
                                      : resolvedEntityTypeName,
                                  defaultValue: 'Delete catalog "{{name}}"? You can restore it later while deleted items are visible.'
                              })
                            : t('entities.instances.deleteDialog.description', {
                                  name: dialogs.delete.item
                                      ? buildInstanceDisplayRow(dialogs.delete.item, preferredVlcLocale, t).name
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

                <CatalogDeleteDialog
                    open={Boolean(blockingDeleteTarget) && canDeleteEntityInstances && isCatalogCompatibleMode}
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
                    title={
                        isCatalogCompatibleMode
                            ? t('entities.instances.catalogCompatibleDeletePermanentDialog.title', 'Delete Catalog Permanently')
                            : t('entities.instances.deletePermanentDialog.title', 'Delete Entity Permanently')
                    }
                    description={
                        isCatalogCompatibleMode
                            ? t('entities.instances.catalogCompatibleDeletePermanentDialog.description', {
                                  name: permanentDeleteTarget
                                      ? buildInstanceDisplayRow(permanentDeleteTarget, preferredVlcLocale, t).name
                                      : '',
                                  defaultValue: 'Permanently delete catalog "{{name}}"? This action cannot be undone.'
                              })
                            : t('entities.instances.deletePermanentDialog.description', {
                                  name: permanentDeleteTarget
                                      ? buildInstanceDisplayRow(permanentDeleteTarget, preferredVlcLocale, t).name
                                      : '',
                                  defaultValue: 'Permanently delete entity "{{name}}"? This action cannot be undone.'
                              })
                    }
                    confirmButtonText={t('common:actions.deletePermanently', 'Delete permanently')}
                    deletingButtonText={
                        isCatalogCompatibleMode
                            ? t('entities.instances.catalogCompatibleDeletePermanentDialog.deleting', 'Deleting permanently...')
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

export default EntityInstanceList
