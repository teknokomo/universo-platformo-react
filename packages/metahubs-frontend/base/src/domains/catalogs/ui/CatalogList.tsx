import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
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
    useConfirm,
    LocalizedInlineField,
    useCodenameAutoFillVlc,
    EntitySelectionPanel,
    revealPendingEntityFeedback,
    useListDialogs
} from '@universo/template-mui'
import type { DragEndEvent } from '@universo/template-mui'
import type { EntitySelectionLabels } from '@universo/template-mui'
import { EntityFormDialog, ConfirmDeleteDialog, ConflictResolutionDialog } from '@universo/template-mui/components/dialogs'
import type { TabConfig } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'

import {
    useCreateCatalog,
    useCreateCatalogAtMetahub,
    useUpdateCatalog,
    useUpdateCatalogAtMetahub,
    useDeleteCatalog,
    useCopyCatalog,
    useReorderCatalog
} from '../hooks/mutations'
import { useCatalogListData } from '../hooks/useCatalogListData'
import { useViewPreference } from '../../../hooks/useViewPreference'
import { STORAGE_KEYS } from '../../../constants/storage'
import * as catalogsApi from '../api'
import type { CatalogWithHubs } from '../api'
import { invalidateCatalogsQueries, metahubsQueryKeys } from '../../shared'
import { type VersionedLocalizedContent } from '@universo/types'
import { isOptimisticLockConflict, extractConflictInfo, isPendingEntity, getPendingAction, type ConflictInfo } from '@universo/utils'
import { CatalogLocalizedPayload, getVLCString } from '../../../types'
import { sanitizeCodenameForStyle, normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../utils/codename'
import { ensureLocalizedContent, extractLocalizedInput, hasPrimaryContent } from '../../../utils/localizedInput'
import { useCodenameConfig } from '../../settings/hooks/useCodenameConfig'
import { useMetahubPrimaryLocale } from '../../settings/hooks/useMetahubPrimaryLocale'
import { CatalogDeleteDialog, CodenameField, HubSelectionPanel, ExistingCodenamesProvider } from '../../../components'
import catalogActions, { CatalogDisplayWithHub, CatalogLayoutTabFields } from './CatalogActions'
import {
    type CatalogFormValues,
    type CatalogMenuBaseContext,
    type ConfirmSpec,
    DIALOG_SAVE_CANCEL,
    extractResponseStatus,
    extractResponseMessage,
    toCatalogWithHubsDisplay
} from './catalogListUtils'

type GenericFormValues = Record<string, unknown>

type GeneralTabFieldsProps = {
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

/**
 * General tab content component with name, description, codename fields
 */
const GeneralTabFields = ({
    values,
    setValue,
    isLoading,
    errors,
    uiLocale,
    nameLabel,
    descriptionLabel,
    codenameLabel,
    codenameHelper
}: GeneralTabFieldsProps) => {
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
                onChange={(next: VersionedLocalizedContent<string> | null) => setValue('nameVlc', next)}
                error={errors.nameVlc || null}
                helperText={errors.nameVlc}
                uiLocale={uiLocale}
            />

            <LocalizedInlineField
                mode='localized'
                label={descriptionLabel}
                disabled={isLoading}
                value={descriptionVlc}
                onChange={(next: VersionedLocalizedContent<string> | null) => setValue('descriptionVlc', next)}
                uiLocale={uiLocale}
                multiline
                rows={2}
            />

            <Divider />

            <CodenameField
                value={codename}
                onChange={(value) => setValue('codename', value)}
                touched={codenameTouched}
                onTouchedChange={(touched: boolean) => setValue('codenameTouched', touched)}
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

const CatalogListContent = () => {
    const navigate = useNavigate()
    const codenameConfig = useCodenameConfig()
    const preferredVlcLocale = useMetahubPrimaryLocale()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()

    const {
        metahubId,
        hubId,
        isHubScoped,
        hubs,
        isLoading,
        error,
        paginationResult,
        searchValue,
        handleSearchChange,
        sortedCatalogs,
        images,
        catalogMap,
        allCatalogsById,
        existingCatalogCodenames,
        attachableExistingCatalogs,
        allowCopy,
        allowDelete,
        allowAttachExistingEntities
    } = useCatalogListData()

    const { dialogs, openCreate, openDelete, openConflict, close } = useListDialogs<CatalogWithHubs>()
    const [view, setView] = useViewPreference(isHubScoped ? STORAGE_KEYS.CATALOG_DISPLAY_STYLE : STORAGE_KEYS.ALL_CATALOGS_DISPLAY_STYLE)

    // State for blocking-entities delete flow (actual catalog deletion)
    const [blockingDeleteDialogState, setBlockingDeleteDialogState] = useState<{
        open: boolean
        catalog: CatalogWithHubs | null
    }>({ open: false, catalog: null })
    const [isAttachDialogOpen, setAttachDialogOpen] = useState(false)
    const [isAttachingExisting, setAttachingExisting] = useState(false)
    const [attachDialogError, setAttachDialogError] = useState<string | null>(null)
    const [pendingCatalogNavigation, setPendingCatalogNavigation] = useState<{ pendingId: string; codename: string } | null>(null)
    const pendingInteractionMessage = tc('pendingCreateBlocked', 'This item is still being created. Please wait a moment and try again.')

    const { confirm } = useConfirm()

    const filteredCatalogActions = useMemo(
        () =>
            catalogActions.filter((a) => {
                if (a.id === 'copy' && !allowCopy) return false
                if (a.id === 'delete' && !allowDelete) return false
                return true
            }),
        [allowCopy, allowDelete]
    )

    const createCatalogMutation = useCreateCatalog()
    const createCatalogAtMetahubMutation = useCreateCatalogAtMetahub()
    const updateCatalogMutation = useUpdateCatalog()
    const deleteCatalogMutation = useDeleteCatalog()
    const updateCatalogAtMetahubMutation = useUpdateCatalogAtMetahub()
    const copyCatalogMutation = useCopyCatalog()
    const reorderCatalogMutation = useReorderCatalog()

    useEffect(() => {
        if (!pendingCatalogNavigation || !metahubId) return

        if (sortedCatalogs.some((catalog) => catalog.id === pendingCatalogNavigation.pendingId)) {
            return
        }

        const resolvedCatalog = sortedCatalogs.find(
            (catalog) => !isPendingEntity(catalog) && catalog.codename === pendingCatalogNavigation.codename
        )

        if (!resolvedCatalog) return

        setPendingCatalogNavigation(null)
        navigate(
            isHubScoped && hubId
                ? `/metahub/${metahubId}/hub/${hubId}/catalog/${resolvedCatalog.id}/attributes`
                : `/metahub/${metahubId}/catalog/${resolvedCatalog.id}/attributes`
        )
    }, [hubId, isHubScoped, metahubId, navigate, pendingCatalogNavigation, sortedCatalogs])

    const handlePendingCatalogInteraction = useCallback(
        (pendingCatalogId: string) => {
            if (!metahubId) return
            const pendingCatalog = catalogMap.get(pendingCatalogId)
            if (pendingCatalog?.codename) {
                setPendingCatalogNavigation({ pendingId: pendingCatalog.id, codename: pendingCatalog.codename })
            }
            revealPendingEntityFeedback({
                queryClient,
                queryKeyPrefix:
                    isHubScoped && hubId ? metahubsQueryKeys.catalogs(metahubId, hubId) : metahubsQueryKeys.allCatalogs(metahubId),
                entityId: pendingCatalogId,
                extraQueryKeys: [
                    isHubScoped && hubId
                        ? metahubsQueryKeys.catalogDetailInHub(metahubId, hubId, pendingCatalogId)
                        : metahubsQueryKeys.catalogDetail(metahubId, pendingCatalogId)
                ]
            })
            enqueueSnackbar(pendingInteractionMessage, { variant: 'info' })
        },
        [catalogMap, enqueueSnackbar, hubId, isHubScoped, metahubId, pendingInteractionMessage, queryClient]
    )

    const attachExistingCatalogSelectionLabels = useMemo<EntitySelectionLabels>(
        () => ({
            title: t('catalogs.attachExisting.selectionTitle', 'Catalogs'),
            addButton: t('common:actions.add', 'Add'),
            dialogTitle: t('catalogs.attachExisting.selectDialogTitle', 'Select catalogs'),
            emptyMessage: t('catalogs.attachExisting.emptySelection', 'No catalogs selected'),
            noAvailableMessage: t('catalogs.attachExisting.noAvailable', 'No catalogs available to add'),
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
    const localizedFormDefaults = useMemo<CatalogFormValues>(
        () => ({
            nameVlc: null,
            descriptionVlc: null,
            codename: null,
            codenameTouched: false,
            hubIds: hubId ? [hubId] : [], // Auto-select current hub
            isSingleHub: false,
            isRequiredHub: false // Default: catalog can exist without hubs
        }),
        [hubId]
    )

    const validateCatalogForm = useCallback(
        (values: GenericFormValues) => {
            const errors: Record<string, string> = {}
            const hubIds = Array.isArray(values.hubIds) ? values.hubIds : []
            const isRequiredHub = Boolean(values.isRequiredHub)
            // Hub validation only if isRequiredHub is true
            if (isRequiredHub && hubIds.length === 0) {
                errors.hubIds = t('catalogs.validation.hubRequired', 'At least one hub is required')
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
            return Object.keys(errors).length > 0 ? errors : null
        },
        [codenameConfig.allowMixed, codenameConfig.alphabet, codenameConfig.style, t, tc]
    )

    const canSaveCatalogForm = useCallback(
        (values: GenericFormValues) => {
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
            const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? 'en'
            const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
            const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
            const hubIds = Array.isArray(values.hubIds) ? values.hubIds : []
            const isRequiredHub = Boolean(values.isRequiredHub)
            // Hub requirement only if isRequiredHub is true
            const hubsValid = !isRequiredHub || hubIds.length > 0
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
     * Tab 2: Hubs (hub selection panel with isSingleHub toggle, current hub pre-selected)
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
            const hubIds = Array.isArray(values.hubIds) ? values.hubIds : []

            const isSingleHub = Boolean(values.isSingleHub)
            const isRequiredHub = Boolean(values.isRequiredHub)

            return [
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
                },
                {
                    id: 'hubs',
                    label: t('catalogs.tabs.hubs', 'Хабы'),
                    content: (
                        <HubSelectionPanel
                            availableHubs={hubs}
                            selectedHubIds={hubIds}
                            onSelectionChange={(newHubIds) => setValue('hubIds', newHubIds)}
                            isRequiredHub={isRequiredHub}
                            onRequiredHubChange={(value) => setValue('isRequiredHub', value)}
                            isSingleHub={isSingleHub}
                            onSingleHubChange={(value) => setValue('isSingleHub', value)}
                            disabled={isFormLoading}
                            error={errors.hubIds}
                            uiLocale={preferredVlcLocale}
                            currentHubId={hubId ?? null}
                        />
                    )
                },
                {
                    id: 'layout',
                    label: t('catalogs.tabs.layout', 'Layout'),
                    content: (
                        <CatalogLayoutTabFields values={values} setValue={setValue} isLoading={isFormLoading} t={t} metahubId={metahubId} />
                    )
                }
            ]
        },
        [hubs, metahubId, preferredVlcLocale, t, tc, hubId]
    )

    const catalogColumns = useMemo(() => {
        // Base columns for both modes
        const baseColumns = [
            {
                id: 'sortOrder',
                label: t('attributes.table.order', '#'),
                width: '4%',
                align: 'center' as const,
                sortable: true,
                sortAccessor: (row: CatalogWithHubsDisplay) => row.sortOrder ?? 0,
                render: (row: CatalogWithHubsDisplay) => (
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
                sortAccessor: (row: CatalogWithHubsDisplay) => row.name?.toLowerCase() ?? '',
                render: (row: CatalogWithHubsDisplay) => {
                    const href = isHubScoped
                        ? `/metahub/${metahubId}/hub/${hubId}/catalog/${row.id}/attributes`
                        : `/metahub/${metahubId}/catalog/${row.id}/attributes`
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
                sortAccessor: (row: CatalogWithHubsDisplay) => row.description?.toLowerCase() ?? '',
                render: (row: CatalogWithHubsDisplay) => (
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
                sortAccessor: (row: CatalogWithHubsDisplay) => row.codename?.toLowerCase() ?? '',
                render: (row: CatalogWithHubsDisplay) => (
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

        // Hub column only for global mode
        const hubColumn = {
            id: 'hub',
            label: t('hubs.title', 'Hub'),
            width: '15%',
            align: 'left' as const,
            render: (row: CatalogWithHubsDisplay) => (
                <Stack direction='column' spacing={0.5}>
                    {row.allHubs.map((hub) =>
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
                                to={`/metahub/${metahubId}/hub/${hub.id}/catalogs`}
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
                    {row.allHubs.length === 0 && (
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
                id: 'attributesCount',
                label: t('catalogs.attributesHeader', 'Attributes'),
                width: '10%',
                align: 'center' as const,
                render: (row: CatalogWithHubsDisplay) =>
                    typeof row.attributesCount === 'number' ? (
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
                                    {row.attributesCount}
                                </Typography>
                            </ButtonBase>
                        ) : (
                            <Link
                                to={
                                    isHubScoped
                                        ? `/metahub/${metahubId}/hub/${hubId}/catalog/${row.id}/attributes`
                                        : `/metahub/${metahubId}/catalog/${row.id}/attributes`
                                }
                                style={{ textDecoration: 'none', color: 'inherit' }}
                            >
                                <Typography
                                    sx={{
                                        fontSize: 14,
                                        '&:hover': {
                                            textDecoration: 'underline',
                                            color: 'primary.main'
                                        }
                                    }}
                                >
                                    {row.attributesCount}
                                </Typography>
                            </Link>
                        )
                    ) : (
                        '—'
                    )
            },
            {
                id: 'elementsCount',
                label: t('catalogs.elementsHeader', 'Elements'),
                width: '10%',
                align: 'center' as const,
                render: (row: CatalogWithHubsDisplay) => (typeof row.elementsCount === 'number' ? row.elementsCount : '—')
            }
        ]

        // Combine columns based on mode
        if (isHubScoped) {
            return [...baseColumns, ...countColumns]
        } else {
            return [...baseColumns, hubColumn, ...countColumns]
        }
    }, [handlePendingCatalogInteraction, hubId, isHubScoped, metahubId, t, tc])

    const createCatalogContext = useCallback(
        (baseContext: CatalogMenuBaseContext) => ({
            ...baseContext,
            catalogMap,
            metahubId,
            uiLocale: preferredVlcLocale,
            hubs, // Pass hubs for hub selector in edit dialog (N:M)
            currentHubId: isHubScoped ? hubId ?? null : null,
            api: {
                updateEntity: (id: string, patch: CatalogLocalizedPayload & { expectedVersion?: number }) => {
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

                    // In hub-scoped mode, use hubId from URL; in global mode, check if catalog has hubs
                    const targetHubId = isHubScoped ? hubId! : catalog?.hubs?.[0]?.id
                    const mutationOptions = {
                        onError: (error: unknown) => {
                            if (!isOptimisticLockConflict(error)) return
                            const conflict = extractConflictInfo(error)
                            if (!conflict) return
                            openConflict({
                                conflict,
                                pendingData: { ...patch, codename: codenamePayload },
                                catalogId: id
                            })
                        }
                    }

                    if (targetHubId) {
                        updateCatalogMutation.mutate(
                            {
                                metahubId,
                                hubId: targetHubId,
                                catalogId: id,
                                data: dataWithVersion
                            },
                            { onError: mutationOptions.onError }
                        )
                    } else {
                        updateCatalogAtMetahubMutation.mutate(
                            {
                                metahubId,
                                catalogId: id,
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

                    if (isHubScoped && hubId) {
                        // Hub-scoped mode: use hubId from URL
                        return deleteCatalogMutation.mutateAsync({
                            metahubId,
                            hubId,
                            catalogId: id,
                            force: false
                        })
                    } else {
                        // Global mode: check if catalog has hubs
                        const targetHubId = catalog?.hubs?.[0]?.id
                        return deleteCatalogMutation.mutateAsync({
                            metahubId,
                            hubId: targetHubId, // undefined for catalogs without hubs
                            catalogId: id,
                            force: Boolean(targetHubId) // force=true if has multiple hubs
                        })
                    }
                },
                copyEntity: (id: string, payload: CatalogLocalizedPayload & Record<string, unknown>) => {
                    if (!metahubId) return Promise.resolve()
                    copyCatalogMutation.mutate({
                        metahubId,
                        catalogId: id,
                        data: payload
                    })

                    return Promise.resolve()
                }
            },
            helpers: {
                refreshList: () => {
                    if (metahubId) {
                        if (isHubScoped && hubId) {
                            void invalidateCatalogsQueries.all(queryClient, metahubId, hubId)
                        } else {
                            // In global mode, invalidate all catalogs cache
                            void queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(metahubId) })
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
                openDeleteDialog: (entity: CatalogDisplayWithHub | CatalogDisplay) => {
                    const catalog = catalogMap.get(entity.id)
                    if (!catalog) return
                    const hubsCount = Array.isArray(catalog.hubs) ? catalog.hubs.length : 0
                    const willDeleteCatalog = !isHubScoped || (!catalog.isRequiredHub && hubsCount === 1)

                    if (willDeleteCatalog) {
                        setBlockingDeleteDialogState({ open: true, catalog })
                        return
                    }

                    openDelete(catalog)
                }
            }
        }),
        [
            confirm,
            copyCatalogMutation,
            codenameConfig.alphabet,
            codenameConfig.style,
            deleteCatalogMutation,
            enqueueSnackbar,
            catalogMap,
            hubs,
            hubId,
            isHubScoped,
            metahubId,
            preferredVlcLocale,
            queryClient,
            t,
            updateCatalogMutation,
            updateCatalogAtMetahubMutation
        ]
    )

    // Validate metahubId from URL AFTER all hooks
    // In hub-scoped mode, also validate hubId
    if (!metahubId || (isHubScoped && !hubId)) {
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

    const handleAttachExistingCatalogs = async (data: GenericFormValues) => {
        if (!metahubId || !hubId) return

        const selectedCatalogIds = Array.isArray(data.selectedCatalogIds)
            ? data.selectedCatalogIds.filter((id): id is string => typeof id === 'string')
            : []
        if (selectedCatalogIds.length === 0) {
            return
        }

        setAttachDialogError(null)
        setAttachingExisting(true)
        try {
            const selectedCatalogs = selectedCatalogIds
                .map((catalogId) => allCatalogsById.get(catalogId))
                .filter((catalog): catalog is CatalogWithHubs => Boolean(catalog))
            const failed: string[] = []

            for (const catalog of selectedCatalogs) {
                try {
                    const currentHubIds = Array.isArray(catalog.hubs) ? catalog.hubs.map((hub) => hub.id) : []
                    const nextHubIds = Array.from(new Set([...currentHubIds, hubId]))
                    await catalogsApi.updateCatalogAtMetahub(metahubId, catalog.id, {
                        hubIds: nextHubIds,
                        expectedVersion: catalog.version
                    })
                } catch (error) {
                    failed.push(getVLCString(catalog.name, preferredVlcLocale) || getVLCString(catalog.name, 'en') || catalog.codename)
                    // eslint-disable-next-line no-console
                    console.error('Failed to attach existing catalog to current hub', error)
                }
            }

            await Promise.all([
                invalidateCatalogsQueries.all(queryClient, metahubId, hubId),
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(metahubId) })
            ])

            if (failed.length === 0) {
                enqueueSnackbar(
                    t('catalogs.attachExisting.success', { count: selectedCatalogs.length, defaultValue: 'Added {{count}} catalog(s).' }),
                    { variant: 'success' }
                )
                setAttachDialogOpen(false)
                return
            }

            const successCount = selectedCatalogs.length - failed.length
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
                    defaultValue: 'Selected catalogs could not be linked to this hub. Please review restrictions and try again.'
                })
            )
        } finally {
            setAttachingExisting(false)
        }
    }

    const handleCreateCatalog = async (data: GenericFormValues) => {
        // Validation is handled by EntityFormDialog's validate/canSave props.
        const hubIds = Array.isArray(data.hubIds) ? data.hubIds : []
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
        if (isHubScoped && hubId && !hubIds.includes(hubId)) {
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
            hubIds,
            isSingleHub,
            isRequiredHub
        }

        if (hubIds.length > 0) {
            const primaryHubId = hubIds[0]
            createCatalogMutation.mutate({
                metahubId: metahubId!,
                hubId: primaryHubId,
                data: catalogPayload
            })
        } else {
            createCatalogAtMetahubMutation.mutate({
                metahubId: metahubId!,
                data: catalogPayload
            })
        }
    }

    const goToCatalog = (catalog: CatalogWithHubs) => {
        // Navigate based on mode: hub-scoped or catalog-centric
        if (isHubScoped) {
            navigate(`/metahub/${metahubId}/hub/${hubId}/catalog/${catalog.id}/attributes`)
        } else {
            navigate(`/metahub/${metahubId}/catalog/${catalog.id}/attributes`)
        }
    }

    const handleChange = (_event: unknown, nextView: string | null) => {
        if (nextView === null) return
        setView(nextView as 'card' | 'table')
    }

    const handleHubTabChange = (_event: unknown, tabValue: 'hubs' | 'catalogs' | 'sets' | 'enumerations' | 'settings') => {
        if (!metahubId || !hubId) return
        if (tabValue === 'hubs') {
            navigate(`/metahub/${metahubId}/hub/${hubId}/hubs`)
            return
        }
        if (tabValue === 'settings') {
            navigate(`/metahub/${metahubId}/hub/${hubId}/hubs`, { state: { openHubSettings: true } })
            return
        }
        if (tabValue === 'sets') {
            navigate(`/metahub/${metahubId}/hub/${hubId}/sets`)
            return
        }
        if (tabValue === 'enumerations') {
            navigate(`/metahub/${metahubId}/hub/${hubId}/enumerations`)
            return
        }
        navigate(`/metahub/${metahubId}/hub/${hubId}/catalogs`)
    }

    // Transform Catalog data for display - use hub-aware version for global mode
    const getCatalogCardData = (catalog: CatalogWithHubs): CatalogWithHubsDisplay => toCatalogWithHubsDisplay(catalog, i18n.language)
    const showAttachExistingAction = isHubScoped && allowAttachExistingEntities
    const hasAttachableExistingCatalogs = attachableExistingCatalogs.length > 0

    const handleSortableDragEnd = async (event: DragEndEvent) => {
        if (!metahubId) return
        const { active, over } = event
        if (!over || active.id === over.id) return

        const overCatalog = sortedCatalogs.find((catalog) => catalog.id === String(over.id))
        if (!overCatalog) return

        try {
            await reorderCatalogMutation.mutateAsync({
                metahubId,
                hubId,
                catalogId: String(active.id),
                newSortOrder: overCatalog.sortOrder ?? 1
            })
            enqueueSnackbar(t('catalogs.reorderSuccess', 'Catalog order updated'), { variant: 'success' })
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
                                primaryAction={{
                                    label: tc('create'),
                                    onClick: handleAddNew,
                                    startIcon: <AddRoundedIcon />
                                }}
                                primaryActionMenuItems={
                                    showAttachExistingAction && hasAttachableExistingCatalogs
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
                                    value='catalogs'
                                    onChange={handleHubTabChange}
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
                                    <Tab value='hubs' label={t('hubs.title')} />
                                    <Tab value='catalogs' label={t('catalogs.title')} />
                                    <Tab value='sets' label={t('sets.title')} />
                                    <Tab value='enumerations' label={t('enumerations.title')} />
                                    <Tab value='settings' label={t('settings.title')} />
                                </Tabs>
                            </Box>
                        )}

                        <Box sx={{ mt: isHubScoped ? 2 : 0 }}>
                            {isLoading && sortedCatalogs.length === 0 ? (
                                view === 'card' ? (
                                    <SkeletonGrid />
                                ) : (
                                    <Skeleton variant='rectangular' height={120} />
                                )
                            ) : !isLoading && sortedCatalogs.length === 0 ? (
                                <EmptyListState
                                    image={APIEmptySVG}
                                    imageAlt='No catalogs'
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
                                                mx: { xs: -1.5, md: -2 },
                                                gridTemplateColumns: {
                                                    xs: '1fr',
                                                    sm: 'repeat(auto-fill, minmax(240px, 1fr))',
                                                    lg: 'repeat(auto-fill, minmax(260px, 1fr))'
                                                },
                                                justifyContent: 'start',
                                                alignContent: 'start'
                                            }}
                                        >
                                            {sortedCatalogs.map((catalog: CatalogWithHubs) => {
                                                const descriptors = [...filteredCatalogActions]
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
                                                                        {displayData.hubsCount > 1 && (
                                                                            <Typography variant='caption' color='text.secondary'>
                                                                                +{displayData.hubsCount - 1}
                                                                            </Typography>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {typeof catalog.attributesCount === 'number' && (
                                                                    <Typography variant='caption' color='text.secondary'>
                                                                        {t('catalogs.attributesCount', { count: catalog.attributesCount })}
                                                                    </Typography>
                                                                )}
                                                            </Stack>
                                                        }
                                                        headerAction={
                                                            descriptors.length > 0 ? (
                                                                <Box onClick={(e) => e.stopPropagation()}>
                                                                    <BaseEntityMenu<CatalogDisplayWithHub, CatalogLocalizedPayload>
                                                                        entity={displayData}
                                                                        entityKind='catalog'
                                                                        descriptors={descriptors}
                                                                        namespace='metahubs'
                                                                        i18nInstance={i18n}
                                                                        createContext={createCatalogContext}
                                                                    />
                                                                </Box>
                                                            ) : null
                                                        }
                                                    />
                                                )
                                            })}
                                        </Box>
                                    ) : (
                                        <Box sx={{ mx: { xs: -1.5, md: -2 } }}>
                                            <FlowListTable
                                                data={sortedCatalogs.map(getCatalogCardData)}
                                                images={images}
                                                isLoading={isLoading}
                                                sortableRows
                                                sortableItemIds={sortedCatalogs.map((catalog) => catalog.id)}
                                                dragHandleAriaLabel={t('catalogs.dnd.dragHandle', 'Drag to reorder')}
                                                dragDisabled={reorderCatalogMutation.isPending || isLoading}
                                                onSortableDragEnd={handleSortableDragEnd}
                                                renderDragOverlay={renderDragOverlay}
                                                getRowLink={(row: CatalogWithHubsDisplay) =>
                                                    row?.id
                                                        ? isHubScoped
                                                            ? `/metahub/${metahubId}/hub/${hubId}/catalog/${row.id}/attributes`
                                                            : `/metahub/${metahubId}/catalog/${row.id}/attributes`
                                                        : undefined
                                                }
                                                onPendingInteractionAttempt={(row: CatalogWithHubsDisplay) =>
                                                    handlePendingCatalogInteraction(row.id)
                                                }
                                                customColumns={catalogColumns}
                                                i18nNamespace='flowList'
                                                renderActions={(row: CatalogWithHubsDisplay) => {
                                                    const originalCatalog = catalogMap.get(row.id)
                                                    if (!originalCatalog) return null

                                                    const descriptors = [...filteredCatalogActions]
                                                    if (!descriptors.length) return null

                                                    return (
                                                        <BaseEntityMenu<CatalogDisplayWithHub, CatalogLocalizedPayload>
                                                            entity={getCatalogCardData(originalCatalog)}
                                                            entityKind='catalog'
                                                            descriptors={descriptors}
                                                            namespace='metahubs'
                                                            menuButtonLabelKey='flowList:menu.button'
                                                            i18nInstance={i18n}
                                                            createContext={createCatalogContext}
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
                        {!isLoading && sortedCatalogs.length > 0 && (
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
                    title={t('catalogs.createDialog.title', 'Create Catalog')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={tc('actions.create', 'Create')}
                    savingButtonText={tc('actions.creating', 'Creating...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onClose={handleDialogClose}
                    onSave={handleCreateCatalog}
                    hideDefaultFields
                    initialExtraValues={localizedFormDefaults}
                    tabs={buildFormTabs}
                    validate={validateCatalogForm}
                    canSave={canSaveCatalogForm}
                />

                <EntityFormDialog
                    open={isAttachDialogOpen}
                    title={t('catalogs.attachExisting.dialogTitle', 'Add Existing Catalogs')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={t('common:actions.add', 'Add')}
                    savingButtonText={t('common:actions.saving', 'Saving...')}
                    cancelButtonText={t('common:actions.cancel', 'Cancel')}
                    loading={isAttachingExisting}
                    error={attachDialogError || undefined}
                    onClose={handleCloseAttachExistingDialog}
                    onSave={handleAttachExistingCatalogs}
                    hideDefaultFields
                    initialExtraValues={{ selectedCatalogIds: [] }}
                    tabs={({ values, setValue, isLoading, errors }) => {
                        const selectedCatalogIds = Array.isArray(values.selectedCatalogIds)
                            ? values.selectedCatalogIds.filter((id): id is string => typeof id === 'string')
                            : []
                        return [
                            {
                                id: 'catalogs',
                                label: t('catalogs.title', 'Catalogs'),
                                content: (
                                    <EntitySelectionPanel<CatalogWithHubs>
                                        availableEntities={attachableExistingCatalogs}
                                        selectedIds={selectedCatalogIds}
                                        onSelectionChange={(ids) => setValue('selectedCatalogIds', ids)}
                                        getDisplayName={(catalog) =>
                                            getVLCString(catalog.name, preferredVlcLocale) ||
                                            getVLCString(catalog.name, 'en') ||
                                            catalog.codename ||
                                            '—'
                                        }
                                        getCodename={(catalog) => catalog.codename}
                                        labels={attachExistingCatalogSelectionLabels}
                                        disabled={isLoading}
                                        error={errors.selectedCatalogIds}
                                    />
                                )
                            }
                        ]
                    }}
                    validate={(values) => {
                        const selectedCatalogIds = Array.isArray(values.selectedCatalogIds)
                            ? values.selectedCatalogIds.filter((id): id is string => typeof id === 'string')
                            : []
                        if (selectedCatalogIds.length > 0) return null
                        return {
                            selectedCatalogIds: t('catalogs.attachExisting.requiredSelection', 'Select at least one catalog to add.')
                        }
                    }}
                    canSave={(values) => {
                        const selectedCatalogIds = Array.isArray(values.selectedCatalogIds)
                            ? values.selectedCatalogIds.filter((id): id is string => typeof id === 'string')
                            : []
                        return !isAttachingExisting && selectedCatalogIds.length > 0
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

                        const deletingCatalogId = dialogs.delete.item.id
                        const targetHubId = isHubScoped ? hubId! : dialogs.delete.item.hubs?.[0]?.id || ''
                        deleteCatalogMutation.mutate(
                            {
                                metahubId,
                                hubId: targetHubId,
                                catalogId: deletingCatalogId,
                                force: !isHubScoped
                            },
                            {
                                onSuccess: () => {
                                    queryClient.removeQueries({
                                        queryKey: metahubsQueryKeys.blockingCatalogReferences(metahubId, deletingCatalogId)
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

                <CatalogDeleteDialog
                    open={blockingDeleteDialogState.open}
                    catalog={blockingDeleteDialogState.catalog}
                    metahubId={metahubId}
                    onClose={() => setBlockingDeleteDialogState({ open: false, catalog: null })}
                    onConfirm={(catalog) => {
                        const targetHubId = isHubScoped ? hubId : catalog.hubs?.[0]?.id
                        deleteCatalogMutation.mutate(
                            {
                                metahubId,
                                hubId: targetHubId,
                                catalogId: catalog.id,
                                force: !isHubScoped
                            },
                            {
                                onSuccess: () => {
                                    queryClient.removeQueries({
                                        queryKey: metahubsQueryKeys.blockingCatalogReferences(metahubId, catalog.id)
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
                    isDeleting={deleteCatalogMutation.isPending}
                    uiLocale={i18n.language}
                />

                {/* Conflict Resolution Dialog for optimistic locking */}
                <ConflictResolutionDialog
                    open={dialogs.conflict.open}
                    conflict={(dialogs.conflict.data as { conflict?: ConflictInfo })?.conflict ?? null}
                    onOverwrite={async () => {
                        const conflictData = dialogs.conflict.data as {
                            conflict?: ConflictInfo
                            pendingData?: CatalogLocalizedPayload
                            catalogId?: string
                        } | null
                        if (!metahubId || !conflictData?.catalogId || !conflictData?.pendingData) return
                        try {
                            const catalog = catalogMap.get(conflictData.catalogId)
                            const targetHubId = isHubScoped ? hubId! : catalog?.hubs?.[0]?.id
                            // Retry without expectedVersion to force overwrite
                            if (targetHubId) {
                                await updateCatalogMutation.mutateAsync({
                                    metahubId,
                                    hubId: targetHubId,
                                    catalogId: conflictData.catalogId,
                                    data: conflictData.pendingData
                                })
                            } else {
                                await updateCatalogAtMetahubMutation.mutateAsync({
                                    metahubId,
                                    catalogId: conflictData.catalogId,
                                    data: conflictData.pendingData
                                })
                            }
                            close('conflict')
                            enqueueSnackbar(t('catalogs.updateSuccess', 'Catalog updated'), { variant: 'success' })
                        } catch (e) {
                            console.error('Failed to overwrite catalog', e)
                            enqueueSnackbar(t('catalogs.updateError', 'Failed to update catalog'), { variant: 'error' })
                        }
                    }}
                    onReload={async () => {
                        // Reload the list to get latest data
                        if (metahubId) {
                            if (isHubScoped && hubId) {
                                await invalidateCatalogsQueries.all(queryClient, metahubId, hubId)
                            } else {
                                await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(metahubId) })
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

const CatalogList = () => <CatalogListContent />

export default CatalogList
