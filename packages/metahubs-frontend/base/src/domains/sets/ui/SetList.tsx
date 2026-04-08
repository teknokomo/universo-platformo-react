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
import type { DragEndEvent, EntitySelectionLabels } from '@universo/template-mui'
import { EntityFormDialog, ConfirmDeleteDialog, ConflictResolutionDialog } from '@universo/template-mui/components/dialogs'
import type { TabConfig } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'

import {
    useCreateSet,
    useCreateSetAtMetahub,
    useUpdateSet,
    useUpdateSetAtMetahub,
    useDeleteSet,
    useCopySet,
    useReorderSet
} from '../hooks/mutations'
import { useSetListData } from '../hooks/useSetListData'
import { useViewPreference } from '../../../hooks/useViewPreference'
import { STORAGE_KEYS } from '../../../constants/storage'
import * as setsApi from '../api'
import type { SetWithHubs } from '../api'
import { invalidateSetsQueries, metahubsQueryKeys } from '../../shared'
import type { VersionedLocalizedContent } from '@universo/types'
import { isOptimisticLockConflict, extractConflictInfo, isPendingEntity, getPendingAction, type ConflictInfo } from '@universo/utils'
import { SetLocalizedPayload, getVLCString } from '../../../types'
import { sanitizeCodenameForStyle, normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../utils/codename'
import { ensureLocalizedContent, extractLocalizedInput, hasPrimaryContent } from '../../../utils/localizedInput'
import { useCodenameConfig } from '../../settings/hooks/useCodenameConfig'
import { useMetahubPrimaryLocale } from '../../settings/hooks/useMetahubPrimaryLocale'
import { SetDeleteDialog, CodenameField, HubSelectionPanel, ExistingCodenamesProvider } from '../../../components'
import setActions, { SetDisplayWithHub } from './SetActions'
import {
    DIALOG_SAVE_CANCEL,
    extractResponseStatus,
    extractResponseMessage,
    toSetWithHubsDisplay,
    type SetWithHubsDisplay,
    type SetFormValues,
    type SetMenuBaseContext,
    type ConfirmSpec
} from './setListUtils'

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

const SetListContent = () => {
    const navigate = useNavigate()
    const codenameConfig = useCodenameConfig()
    const preferredVlcLocale = useMetahubPrimaryLocale()
    const { t, i18n } = useTranslation('metahubs')
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
        sortedSets,
        images,
        setMap,
        allSetsById,
        existingSetCodenames,
        attachableExistingSets,
        allowCopy,
        allowDelete,
        allowAttachExistingEntities
    } = useSetListData()

    const { dialogs, openCreate, openDelete, openConflict, close } = useListDialogs<SetWithHubs>()
    const [view, setView] = useViewPreference(isHubScoped ? STORAGE_KEYS.SET_DISPLAY_STYLE : STORAGE_KEYS.ALL_SETS_DISPLAY_STYLE)

    // State for blocking-entities delete flow (actual set deletion)
    const [blockingDeleteDialogState, setBlockingDeleteDialogState] = useState<{
        open: boolean
        set: SetWithHubs | null
    }>({ open: false, set: null })

    const [isAttachDialogOpen, setAttachDialogOpen] = useState(false)
    const [isAttachingExisting, setAttachingExisting] = useState(false)
    const [attachDialogError, setAttachDialogError] = useState<string | null>(null)
    const [pendingSetNavigation, setPendingSetNavigation] = useState<{ pendingId: string; codename: string } | null>(null)
    const pendingInteractionMessage = tc('pendingCreateBlocked', 'This item is still being created. Please wait a moment and try again.')

    const { confirm } = useConfirm()

    // Filter entity actions based on settings (allowCopy / allowDelete)
    const filteredSetActions = useMemo(
        () =>
            setActions.filter((a) => {
                if (a.id === 'copy' && !allowCopy) return false
                if (a.id === 'delete' && !allowDelete) return false
                return true
            }),
        [allowCopy, allowDelete]
    )

    const createSetMutation = useCreateSet()
    const createSetAtMetahubMutation = useCreateSetAtMetahub()
    const updateSetMutation = useUpdateSet()
    const deleteSetMutation = useDeleteSet()
    const updateSetAtMetahubMutation = useUpdateSetAtMetahub()
    const copySetMutation = useCopySet()
    const reorderSetMutation = useReorderSet()

    useEffect(() => {
        if (!pendingSetNavigation || !metahubId) return

        if (sortedSets.some((set) => set.id === pendingSetNavigation.pendingId)) {
            return
        }

        const resolvedSet = sortedSets.find((set) => !isPendingEntity(set) && set.codename === pendingSetNavigation.codename)

        if (!resolvedSet) return

        setPendingSetNavigation(null)
        navigate(
            isHubScoped && hubId
                ? `/metahub/${metahubId}/hub/${hubId}/set/${resolvedSet.id}/constants`
                : `/metahub/${metahubId}/set/${resolvedSet.id}/constants`
        )
    }, [hubId, isHubScoped, metahubId, navigate, pendingSetNavigation, sortedSets])

    const handlePendingSetInteraction = useCallback(
        (pendingSetId: string) => {
            if (!metahubId) return
            const pendingSet = setMap.get(pendingSetId)
            if (pendingSet?.codename) {
                setPendingSetNavigation({ pendingId: pendingSet.id, codename: pendingSet.codename })
            }
            revealPendingEntityFeedback({
                queryClient,
                queryKeyPrefix: isHubScoped && hubId ? metahubsQueryKeys.sets(metahubId, hubId) : metahubsQueryKeys.allSets(metahubId),
                entityId: pendingSetId,
                extraQueryKeys: [
                    isHubScoped && hubId
                        ? metahubsQueryKeys.setDetailInHub(metahubId, hubId, pendingSetId)
                        : metahubsQueryKeys.setDetail(metahubId, pendingSetId)
                ]
            })
            enqueueSnackbar(pendingInteractionMessage, { variant: 'info' })
        },
        [enqueueSnackbar, hubId, isHubScoped, metahubId, pendingInteractionMessage, queryClient, setMap]
    )

    const attachExistingSetSelectionLabels = useMemo<EntitySelectionLabels>(
        () => ({
            title: t('sets.attachExisting.selectionTitle', 'Sets'),
            addButton: t('common:actions.add', 'Add'),
            dialogTitle: t('sets.attachExisting.selectDialogTitle', 'Select sets'),
            emptyMessage: t('sets.attachExisting.emptySelection', 'No sets selected'),
            noAvailableMessage: t('sets.attachExisting.noAvailable', 'No sets available to add'),
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
    const localizedFormDefaults = useMemo<SetFormValues>(
        () => ({
            nameVlc: null,
            descriptionVlc: null,
            codename: null,
            codenameTouched: false,
            hubIds: hubId ? [hubId] : [], // Auto-select current hub
            isSingleHub: false,
            isRequiredHub: false // Default: set can exist without hubs
        }),
        [hubId]
    )

    const validateSetForm = useCallback(
        (values: GenericFormValues) => {
            const errors: Record<string, string> = {}
            const hubIds = Array.isArray(values.hubIds) ? values.hubIds : []
            const isRequiredHub = Boolean(values.isRequiredHub)
            // Hub validation only if isRequiredHub is true
            if (isRequiredHub && hubIds.length === 0) {
                errors.hubIds = t('sets.validation.hubRequired', 'At least one hub is required')
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

    const canSaveSetForm = useCallback(
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
                    id: 'hubs',
                    label: t('sets.tabs.hubs', 'Хабы'),
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
                }
            ]
        },
        [hubs, preferredVlcLocale, t, tc, hubId]
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
                sortAccessor: (row: SetWithHubsDisplay) => row.sortOrder ?? 0,
                render: (row: SetWithHubsDisplay) => (
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
                sortAccessor: (row: SetWithHubsDisplay) => row.name?.toLowerCase() ?? '',
                render: (row: SetWithHubsDisplay) => {
                    const href = isHubScoped
                        ? `/metahub/${metahubId}/hub/${hubId}/set/${row.id}/constants`
                        : `/metahub/${metahubId}/set/${row.id}/constants`
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
                sortAccessor: (row: SetWithHubsDisplay) => row.description?.toLowerCase() ?? '',
                render: (row: SetWithHubsDisplay) => (
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
                sortAccessor: (row: SetWithHubsDisplay) => row.codename?.toLowerCase() ?? '',
                render: (row: SetWithHubsDisplay) => (
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
            render: (row: SetWithHubsDisplay) => (
                <Stack direction='column' spacing={0.5}>
                    {row.allHubs.map((hub) =>
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
                            <Link
                                key={hub.id}
                                to={`/metahub/${metahubId}/hub/${hub.id}/sets`}
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
                id: 'constantsCount',
                label: t('sets.constantsHeader', 'Constants'),
                width: '10%',
                align: 'center' as const,
                render: (row: SetWithHubsDisplay) =>
                    typeof row.constantsCount === 'number' ? (
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
                                    {row.constantsCount}
                                </Typography>
                            </ButtonBase>
                        ) : (
                            <Link
                                to={
                                    isHubScoped
                                        ? `/metahub/${metahubId}/hub/${hubId}/set/${row.id}/constants`
                                        : `/metahub/${metahubId}/set/${row.id}/constants`
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
                                    {row.constantsCount}
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
    }, [handlePendingSetInteraction, hubId, isHubScoped, metahubId, t, tc])

    const createSetContext = useCallback(
        (baseContext: SetMenuBaseContext) => ({
            ...baseContext,
            setMap,
            metahubId,
            uiLocale: preferredVlcLocale,
            hubs, // Pass hubs for hub selector in edit dialog (N:M)
            currentHubId: isHubScoped ? hubId ?? null : null,
            api: {
                updateEntity: (id: string, patch: SetLocalizedPayload & { expectedVersion?: number }) => {
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

                    const targetHubId = isHubScoped ? hubId! : set?.hubs?.[0]?.id
                    const mutationOptions = {
                        onError: (error: unknown) => {
                            if (!isOptimisticLockConflict(error)) return
                            const conflict = extractConflictInfo(error)
                            if (!conflict) return
                            openConflict({
                                conflict,
                                pendingData: { ...patch, codename: codenamePayload },
                                setId: id
                            })
                        }
                    }

                    if (targetHubId) {
                        updateSetMutation.mutate(
                            {
                                metahubId,
                                hubId: targetHubId,
                                setId: id,
                                data: dataWithVersion
                            },
                            { onError: mutationOptions.onError }
                        )
                    } else {
                        updateSetAtMetahubMutation.mutate(
                            {
                                metahubId,
                                setId: id,
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

                    if (isHubScoped && hubId) {
                        // Hub-scoped mode: use hubId from URL
                        return deleteSetMutation.mutateAsync({
                            metahubId,
                            hubId,
                            setId: id,
                            force: false
                        })
                    } else {
                        // Global mode: check if set has hubs
                        const targetHubId = set?.hubs?.[0]?.id
                        return deleteSetMutation.mutateAsync({
                            metahubId,
                            hubId: targetHubId, // undefined for sets without hubs
                            setId: id,
                            force: Boolean(targetHubId) // force=true if has multiple hubs
                        })
                    }
                },
                copyEntity: (id: string, payload: SetLocalizedPayload & Record<string, unknown>) => {
                    if (!metahubId) return Promise.resolve()
                    copySetMutation.mutate({
                        metahubId,
                        setId: id,
                        data: payload
                    })

                    return Promise.resolve()
                }
            },
            helpers: {
                refreshList: () => {
                    if (metahubId) {
                        if (isHubScoped && hubId) {
                            void invalidateSetsQueries.all(queryClient, metahubId, hubId)
                        } else {
                            // In global mode, invalidate all sets cache
                            void queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allSets(metahubId) })
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
                openDeleteDialog: (entity: SetDisplayWithHub | MetahubSetDisplay) => {
                    const set = setMap.get(entity.id)
                    if (!set) return
                    const hubsCount = Array.isArray(set.hubs) ? set.hubs.length : 0
                    const willDeleteSet = !isHubScoped || (!set.isRequiredHub && hubsCount === 1)

                    if (willDeleteSet) {
                        setBlockingDeleteDialogState({ open: true, set })
                        return
                    }

                    openDelete(set)
                }
            }
        }),
        [
            confirm,
            copySetMutation,
            codenameConfig.alphabet,
            codenameConfig.style,
            deleteSetMutation,
            enqueueSnackbar,
            setMap,
            hubs,
            hubId,
            isHubScoped,
            metahubId,
            preferredVlcLocale,
            queryClient,
            t,
            updateSetMutation,
            updateSetAtMetahubMutation
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

    const handleAttachExistingSets = async (data: GenericFormValues) => {
        if (!metahubId || !hubId) return

        const selectedSetIds = Array.isArray(data.selectedSetIds)
            ? data.selectedSetIds.filter((id): id is string => typeof id === 'string')
            : []
        if (selectedSetIds.length === 0) {
            return
        }

        setAttachDialogError(null)
        setAttachingExisting(true)
        try {
            const selectedSets = selectedSetIds.map((setId) => allSetsById.get(setId)).filter((set): set is SetWithHubs => Boolean(set))
            const failed: string[] = []

            for (const set of selectedSets) {
                try {
                    const currentHubIds = Array.isArray(set.hubs) ? set.hubs.map((hub) => hub.id) : []
                    const nextHubIds = Array.from(new Set([...currentHubIds, hubId]))
                    await setsApi.updateSetAtMetahub(metahubId, set.id, {
                        hubIds: nextHubIds,
                        expectedVersion: set.version
                    })
                } catch (error) {
                    failed.push(getVLCString(set.name, preferredVlcLocale) || getVLCString(set.name, 'en') || set.codename)
                    // eslint-disable-next-line no-console
                    console.error('Failed to attach existing set to current hub', error)
                }
            }

            await Promise.all([
                invalidateSetsQueries.all(queryClient, metahubId, hubId),
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allSets(metahubId) })
            ])

            if (failed.length === 0) {
                enqueueSnackbar(t('sets.attachExisting.success', { count: selectedSets.length, defaultValue: 'Added {{count}} set(s).' }), {
                    variant: 'success'
                })
                setAttachDialogOpen(false)
                return
            }

            const successCount = selectedSets.length - failed.length
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
                    defaultValue: 'Selected sets could not be linked to this hub. Please review restrictions and try again.'
                })
            )
        } finally {
            setAttachingExisting(false)
        }
    }

    const handleCreateSet = async (data: GenericFormValues) => {
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

        // Confirm dialog for detached set (async — throws DIALOG_SAVE_CANCEL if cancelled)
        if (isHubScoped && hubId && !hubIds.includes(hubId)) {
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
            hubIds,
            isSingleHub,
            isRequiredHub
        }

        if (hubIds.length > 0) {
            const primaryHubId = hubIds[0]
            createSetMutation.mutate({
                metahubId: metahubId!,
                hubId: primaryHubId,
                data: setPayload
            })
        } else {
            createSetAtMetahubMutation.mutate({
                metahubId: metahubId!,
                data: setPayload
            })
        }
    }

    const goToSet = (set: SetWithHubs) => {
        // Navigate based on mode: hub-scoped or set-centric
        if (isHubScoped) {
            navigate(`/metahub/${metahubId}/hub/${hubId}/set/${set.id}/constants`)
        } else {
            navigate(`/metahub/${metahubId}/set/${set.id}/constants`)
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
        if (tabValue === 'catalogs') {
            navigate(`/metahub/${metahubId}/hub/${hubId}/catalogs`)
            return
        }
        if (tabValue === 'enumerations') {
            navigate(`/metahub/${metahubId}/hub/${hubId}/enumerations`)
            return
        }
        navigate(`/metahub/${metahubId}/hub/${hubId}/sets`)
    }

    // Transform Set data for display - use hub-aware version for global mode
    const getSetCardData = (set: SetWithHubs): SetWithHubsDisplay => toSetWithHubsDisplay(set, i18n.language)
    const showAttachExistingAction = isHubScoped && allowAttachExistingEntities
    const hasAttachableExistingSets = attachableExistingSets.length > 0

    const handleSortableDragEnd = async (event: DragEndEvent) => {
        if (!metahubId) return
        const { active, over } = event
        if (!over || active.id === over.id) return

        const overSet = sortedSets.find((set) => set.id === String(over.id))
        if (!overSet) return

        try {
            await reorderSetMutation.mutateAsync({
                metahubId,
                hubId,
                setId: String(active.id),
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
                                    showAttachExistingAction && hasAttachableExistingSets
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
                                    value='sets'
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
                            {isLoading && sortedSets.length === 0 ? (
                                view === 'card' ? (
                                    <SkeletonGrid />
                                ) : (
                                    <Skeleton variant='rectangular' height={120} />
                                )
                            ) : !isLoading && sortedSets.length === 0 ? (
                                <EmptyListState
                                    image={APIEmptySVG}
                                    imageAlt='No sets'
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
                                            {sortedSets.map((set: SetWithHubs) => {
                                                const descriptors = [...filteredSetActions]
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
                                                                        {displayData.hubsCount > 1 && (
                                                                            <Typography variant='caption' color='text.secondary'>
                                                                                +{displayData.hubsCount - 1}
                                                                            </Typography>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {typeof set.constantsCount === 'number' && (
                                                                    <Typography variant='caption' color='text.secondary'>
                                                                        {t('sets.constantsCount', { count: set.constantsCount })}
                                                                    </Typography>
                                                                )}
                                                            </Stack>
                                                        }
                                                        headerAction={
                                                            descriptors.length > 0 ? (
                                                                <Box onClick={(e) => e.stopPropagation()}>
                                                                    <BaseEntityMenu<SetDisplayWithHub, SetLocalizedPayload>
                                                                        entity={displayData}
                                                                        entityKind='set'
                                                                        descriptors={descriptors}
                                                                        namespace='metahubs'
                                                                        i18nInstance={i18n}
                                                                        createContext={createSetContext}
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
                                                data={sortedSets.map(getSetCardData)}
                                                images={images}
                                                isLoading={isLoading}
                                                sortableRows
                                                sortableItemIds={sortedSets.map((set) => set.id)}
                                                dragHandleAriaLabel={t('sets.dnd.dragHandle', 'Drag to reorder')}
                                                dragDisabled={reorderSetMutation.isPending || isLoading}
                                                onSortableDragEnd={handleSortableDragEnd}
                                                renderDragOverlay={renderDragOverlay}
                                                getRowLink={(row: SetWithHubsDisplay) =>
                                                    row?.id
                                                        ? isHubScoped
                                                            ? `/metahub/${metahubId}/hub/${hubId}/set/${row.id}/constants`
                                                            : `/metahub/${metahubId}/set/${row.id}/constants`
                                                        : undefined
                                                }
                                                onPendingInteractionAttempt={(row: SetWithHubsDisplay) =>
                                                    handlePendingSetInteraction(row.id)
                                                }
                                                customColumns={setColumns}
                                                i18nNamespace='flowList'
                                                renderActions={(row: SetWithHubsDisplay) => {
                                                    const originalSet = setMap.get(row.id)
                                                    if (!originalSet) return null

                                                    const descriptors = [...filteredSetActions]
                                                    if (!descriptors.length) return null

                                                    return (
                                                        <BaseEntityMenu<SetDisplayWithHub, SetLocalizedPayload>
                                                            entity={getSetCardData(originalSet)}
                                                            entityKind='set'
                                                            descriptors={descriptors}
                                                            namespace='metahubs'
                                                            menuButtonLabelKey='flowList:menu.button'
                                                            i18nInstance={i18n}
                                                            createContext={createSetContext}
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
                        {!isLoading && sortedSets.length > 0 && (
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
                    title={t('sets.createDialog.title', 'Create Set')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={tc('actions.create', 'Create')}
                    savingButtonText={tc('actions.creating', 'Creating...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onClose={handleDialogClose}
                    onSave={handleCreateSet}
                    hideDefaultFields
                    initialExtraValues={localizedFormDefaults}
                    tabs={buildFormTabs}
                    validate={validateSetForm}
                    canSave={canSaveSetForm}
                />

                <EntityFormDialog
                    open={isAttachDialogOpen}
                    title={t('sets.attachExisting.dialogTitle', 'Add Existing Sets')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={t('common:actions.add', 'Add')}
                    savingButtonText={t('common:actions.saving', 'Saving...')}
                    cancelButtonText={t('common:actions.cancel', 'Cancel')}
                    loading={isAttachingExisting}
                    error={attachDialogError || undefined}
                    onClose={handleCloseAttachExistingDialog}
                    onSave={handleAttachExistingSets}
                    hideDefaultFields
                    initialExtraValues={{ selectedSetIds: [] }}
                    tabs={({ values, setValue, isLoading, errors }) => {
                        const selectedSetIds = Array.isArray(values.selectedSetIds)
                            ? values.selectedSetIds.filter((id): id is string => typeof id === 'string')
                            : []
                        return [
                            {
                                id: 'sets',
                                label: t('sets.title', 'Sets'),
                                content: (
                                    <EntitySelectionPanel<SetWithHubs>
                                        availableEntities={attachableExistingSets}
                                        selectedIds={selectedSetIds}
                                        onSelectionChange={(ids) => setValue('selectedSetIds', ids)}
                                        getDisplayName={(set) =>
                                            getVLCString(set.name, preferredVlcLocale) ||
                                            getVLCString(set.name, 'en') ||
                                            set.codename ||
                                            '—'
                                        }
                                        getCodename={(set) => set.codename}
                                        labels={attachExistingSetSelectionLabels}
                                        disabled={isLoading}
                                        error={errors.selectedSetIds}
                                    />
                                )
                            }
                        ]
                    }}
                    validate={(values) => {
                        const selectedSetIds = Array.isArray(values.selectedSetIds)
                            ? values.selectedSetIds.filter((id): id is string => typeof id === 'string')
                            : []
                        if (selectedSetIds.length > 0) return null
                        return {
                            selectedSetIds: t('sets.attachExisting.requiredSelection', 'Select at least one set to add.')
                        }
                    }}
                    canSave={(values) => {
                        const selectedSetIds = Array.isArray(values.selectedSetIds)
                            ? values.selectedSetIds.filter((id): id is string => typeof id === 'string')
                            : []
                        return !isAttachingExisting && selectedSetIds.length > 0
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

                        const deletingSetId = dialogs.delete.item.id
                        const targetHubId = isHubScoped ? hubId! : dialogs.delete.item.hubs?.[0]?.id || ''
                        deleteSetMutation.mutate(
                            {
                                metahubId,
                                hubId: targetHubId,
                                setId: deletingSetId,
                                force: !isHubScoped
                            },
                            {
                                onSuccess: () => {
                                    queryClient.removeQueries({
                                        queryKey: metahubsQueryKeys.blockingSetReferences(metahubId, deletingSetId)
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

                <SetDeleteDialog
                    open={blockingDeleteDialogState.open}
                    set={blockingDeleteDialogState.set}
                    metahubId={metahubId}
                    onClose={() => setBlockingDeleteDialogState({ open: false, set: null })}
                    onConfirm={(set) => {
                        const targetHubId = isHubScoped ? hubId : set.hubs?.[0]?.id
                        deleteSetMutation.mutate(
                            {
                                metahubId,
                                hubId: targetHubId,
                                setId: set.id,
                                force: !isHubScoped
                            },
                            {
                                onSuccess: () => {
                                    queryClient.removeQueries({ queryKey: metahubsQueryKeys.blockingSetReferences(metahubId, set.id) })
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
                    isDeleting={deleteSetMutation.isPending}
                    uiLocale={i18n.language}
                />

                {/* Conflict Resolution Dialog for optimistic locking */}
                <ConflictResolutionDialog
                    open={dialogs.conflict.open}
                    conflict={(dialogs.conflict.data as { conflict?: ConflictInfo })?.conflict ?? null}
                    onOverwrite={async () => {
                        const conflictData = dialogs.conflict.data as {
                            conflict?: ConflictInfo
                            pendingData?: SetLocalizedPayload
                            setId?: string
                        } | null
                        if (!metahubId || !conflictData?.setId || !conflictData?.pendingData) return
                        try {
                            const set = setMap.get(conflictData.setId)
                            const targetHubId = isHubScoped ? hubId! : set?.hubs?.[0]?.id
                            // Retry without expectedVersion to force overwrite
                            if (targetHubId) {
                                await updateSetMutation.mutateAsync({
                                    metahubId,
                                    hubId: targetHubId,
                                    setId: conflictData.setId,
                                    data: conflictData.pendingData
                                })
                            } else {
                                await updateSetAtMetahubMutation.mutateAsync({
                                    metahubId,
                                    setId: conflictData.setId,
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
                            if (isHubScoped && hubId) {
                                await invalidateSetsQueries.all(queryClient, metahubId, hubId)
                            } else {
                                await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allSets(metahubId) })
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

const SetList = () => <SetListContent />

export default SetList
