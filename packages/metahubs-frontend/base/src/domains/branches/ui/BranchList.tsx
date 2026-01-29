import { useState, useMemo, useCallback, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
    Box,
    Skeleton,
    Stack,
    Typography,
    IconButton,
    Divider,
    Chip,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormHelperText
} from '@mui/material'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useSnackbar } from 'notistack'
import { useQueryClient, useQuery } from '@tanstack/react-query'

import {
    TemplateMainCard as MainCard,
    ItemCard,
    ToolbarControls,
    EmptyListState,
    SkeletonGrid,
    APIEmptySVG,
    usePaginated,
    useDebouncedSearch,
    PaginationControls,
    FlowListTable,
    gridSpacing,
    LocalizedInlineField,
    useCodenameAutoFill
} from '@universo/template-mui'
import { EntityFormDialog, ConflictResolutionDialog } from '@universo/template-mui/components/dialogs'
import type { TabConfig } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'
import type { TriggerProps } from '@universo/template-mui'

import { useCreateBranch, useUpdateBranch, useDeleteBranch, useActivateBranch, useSetDefaultBranch } from '../hooks/mutations'
import { useViewPreference } from '../../../hooks/useViewPreference'
import { STORAGE_KEYS } from '../../../constants/storage'
import * as branchesApi from '../api'
import { metahubsQueryKeys, invalidateBranchesQueries } from '../../shared'
import type { VersionedLocalizedContent } from '@universo/types'
import {
    MetahubBranch,
    MetahubBranchDisplay,
    BranchLocalizedPayload,
    getVLCString,
    toBranchDisplay
} from '../../../types'
import { isOptimisticLockConflict, extractConflictInfo, type ConflictInfo } from '@universo/utils'
import { sanitizeCodename, isValidCodename } from '../../../utils/codename'
import { extractLocalizedInput, hasPrimaryContent, normalizeLocale } from '../../../utils/localizedInput'
import { CodenameField, BranchDeleteDialog } from '../../../components'
import branchActions from './BranchActions'

type BranchFormValues = {
    nameVlc: VersionedLocalizedContent<string> | null
    descriptionVlc: VersionedLocalizedContent<string> | null
    codename: string
    codenameTouched?: boolean
    sourceBranchId?: string | null
}

type BranchFormFieldsProps = {
    values: Record<string, any>
    setValue: (name: string, value: any) => void
    isLoading: boolean
    errors: Record<string, string>
    uiLocale: string
    nameLabel: string
    descriptionLabel: string
    codenameLabel: string
    codenameHelper: string
    sourceLabel: string
    sourceHelper: string
    sourceOptions: { id: string; label: string; isDefault?: boolean; isEmpty?: boolean }[]
    showSourceField: boolean
}

const BranchFormFields = ({
    values,
    setValue,
    isLoading,
    errors,
    uiLocale,
    nameLabel,
    descriptionLabel,
    codenameLabel,
    codenameHelper,
    sourceLabel,
    sourceHelper,
    sourceOptions,
    showSourceField
}: BranchFormFieldsProps) => {
    const nameVlc = (values.nameVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const descriptionVlc = (values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const codename = typeof values.codename === 'string' ? values.codename : ''
    const codenameTouched = Boolean(values.codenameTouched)
    const primaryLocale = nameVlc?._primary ?? normalizeLocale(uiLocale)
    const nameValue = getVLCString(nameVlc || undefined, primaryLocale)
    const nextCodename = sanitizeCodename(nameValue)
    const sourceBranchId = values.sourceBranchId as string | undefined
    const selectedSource = sourceOptions.find((option) => option.id === sourceBranchId)

    useEffect(() => {
        if (showSourceField && !sourceBranchId && sourceOptions.length > 0) {
            setValue('sourceBranchId', sourceOptions[0].id)
        }
    }, [showSourceField, sourceBranchId, sourceOptions, setValue])

    useCodenameAutoFill({
        codename,
        codenameTouched,
        nextCodename,
        nameValue,
        setValue: setValue as (field: 'codename' | 'codenameTouched', value: string | boolean) => void
    })

    const renderSourceValue = (selected: unknown) => {
        const id = typeof selected === 'string' ? selected : ''
        const option = sourceOptions.find((item) => item.id === id)
        return option?.label ?? ''
    }

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
                label={codenameLabel}
                helperText={codenameHelper}
                error={errors.codename}
                disabled={isLoading}
                required
            />
            {showSourceField ? (
                <FormControl fullWidth error={Boolean(errors.sourceBranchId)} disabled={isLoading}>
                    <InputLabel id='branch-source-label' shrink>
                        {sourceLabel}
                    </InputLabel>
                    <Select
                        labelId='branch-source-label'
                        label={sourceLabel}
                        value={values.sourceBranchId || ''}
                        onChange={(event) => setValue('sourceBranchId', event.target.value)}
                        displayEmpty
                        renderValue={renderSourceValue}
                    >
                        {sourceOptions.map((option) => (
                            <MenuItem key={option.id} value={option.id}>
                                {option.label}
                            </MenuItem>
                        ))}
                    </Select>
                    <FormHelperText>{errors.sourceBranchId || (selectedSource?.isDefault ? sourceHelper : '')}</FormHelperText>
                </FormControl>
            ) : null}
        </Stack>
    )
}

type BranchSourceFieldsProps = {
    values: Record<string, any>
    setValue: (name: string, value: any) => void
    isLoading: boolean
    errors: Record<string, string>
    sourceLabel: string
    emptyHelper: string
    defaultHelper: string
    sourceOptions: { id: string; label: string; isDefault?: boolean; isEmpty?: boolean }[]
}

const BranchSourceFields = ({
    values,
    setValue,
    isLoading,
    errors,
    sourceLabel,
    emptyHelper,
    defaultHelper,
    sourceOptions
}: BranchSourceFieldsProps) => {
    const sourceBranchId = values.sourceBranchId as string | undefined
    const selectedSource = sourceOptions.find((option) => option.id === sourceBranchId)
    const helperText =
        errors.sourceBranchId ||
        (selectedSource?.isEmpty
            ? emptyHelper
            : selectedSource?.isDefault
              ? defaultHelper
              : '')
    const renderSourceValue = (selected: unknown) => {
        const id = typeof selected === 'string' ? selected : ''
        const option = sourceOptions.find((item) => item.id === id)
        return option?.label ?? ''
    }

    return (
        <FormControl fullWidth error={Boolean(errors.sourceBranchId)} disabled={isLoading}>
            <InputLabel id='branch-source-label' shrink>
                {sourceLabel}
            </InputLabel>
            <Select
                labelId='branch-source-label'
                label={sourceLabel}
                value={values.sourceBranchId ?? ''}
                onChange={(event) => setValue('sourceBranchId', event.target.value)}
                displayEmpty
                renderValue={renderSourceValue}
            >
                {sourceOptions.map((option) => (
                    <MenuItem key={option.id || 'empty'} value={option.id}>
                        {option.label}
                    </MenuItem>
                ))}
            </Select>
            <FormHelperText>{helperText}</FormHelperText>
        </FormControl>
    )
}

const BranchList = () => {
    const { metahubId } = useParams<{ metahubId: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [view, setView] = useViewPreference(STORAGE_KEYS.BRANCH_DISPLAY_STYLE)

    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)

    const paginationResult = usePaginated<MetahubBranch, 'name' | 'codename' | 'created' | 'updated'>({
        queryKeyFn: metahubId ? (params) => metahubsQueryKeys.branchesList(metahubId, params) : () => ['empty'],
        queryFn: metahubId
            ? (params) => branchesApi.listBranches(metahubId, params)
            : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc',
        enabled: !!metahubId
    })

    const { data: branches, isLoading, error } = paginationResult

    const { handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    const [deleteDialogState, setDeleteDialogState] = useState<{
        open: boolean
        branch: MetahubBranch | null
    }>({ open: false, branch: null })

    const [conflictState, setConflictState] = useState<{
        open: boolean
        conflict: ConflictInfo | null
        pendingUpdate: { id: string; patch: BranchLocalizedPayload } | null
    }>({ open: false, conflict: null, pendingUpdate: null })

    const createBranchMutation = useCreateBranch()
    const updateBranchMutation = useUpdateBranch()
    const deleteBranchMutation = useDeleteBranch()
    const activateBranchMutation = useActivateBranch()
    const setDefaultBranchMutation = useSetDefaultBranch()

    const branchMap = useMemo(() => {
        if (!Array.isArray(branches)) return new Map<string, MetahubBranch>()
        return new Map(branches.map((branch) => [branch.id, branch]))
    }, [branches])

    const branchOptionsQuery = useQuery({
        queryKey: metahubId
            ? metahubsQueryKeys.branchesList(metahubId, { limit: 1000, offset: 0, sortBy: 'created', sortOrder: 'asc' })
            : ['empty'],
        queryFn: () =>
            metahubId
                ? branchesApi.listBranches(metahubId, { limit: 1000, offset: 0, sortBy: 'created', sortOrder: 'asc' })
                : Promise.resolve({ items: [], pagination: { limit: 0, offset: 0, count: 0, total: 0, hasMore: false } }),
        enabled: Boolean(metahubId)
    })

    const branchOptions = useMemo(() => {
        const items = branchOptionsQuery.data?.items ?? []
        return items.map((branch) => {
            const name = getVLCString(branch.name, i18n.language) || branch.codename || ''
            return {
                id: branch.id,
                label: name ? `${name} (${branch.codename})` : branch.codename,
                isDefault: branch.isDefault
            }
        })
    }, [branchOptionsQuery.data?.items, i18n.language])

    const sourceOptions = useMemo(() => {
        return [
            {
                id: '',
                label: t('metahubs:branches.sourceEmpty', 'Empty branch'),
                isEmpty: true
            },
            ...branchOptions
        ]
    }, [branchOptions, t])

    const preferredSourceBranchId = ''

    const localizedFormDefaults = useMemo<BranchFormValues>(
        () => ({
            nameVlc: null,
            descriptionVlc: null,
            codename: '',
            codenameTouched: false,
            sourceBranchId: preferredSourceBranchId
        }),
        [preferredSourceBranchId]
    )

    const buildCreateTabs = useCallback(
        ({
            values,
            setValue,
            isLoading: isFormLoading,
            errors
        }: {
            values: Record<string, any>
            setValue: (name: string, value: any) => void
            isLoading: boolean
            errors: Record<string, string>
        }): TabConfig[] => [
            {
                id: 'general',
                label: t('metahubs:branches.tabs.general', 'Основное'),
                content: (
                    <BranchFormFields
                        values={values}
                        setValue={setValue}
                        isLoading={isFormLoading}
                        errors={errors}
                        uiLocale={i18n.language}
                        nameLabel={tc('fields.name', 'Name')}
                        descriptionLabel={tc('fields.description', 'Description')}
                        codenameLabel={t('metahubs:branches.codename', 'Codename')}
                        codenameHelper={t(
                            'metahubs:branches.codenameHelper',
                            'Unique identifier for URLs (lowercase Latin letters, numbers, hyphens). Auto-generated from the name with transliteration. You can edit it manually.'
                        )}
                        sourceLabel=''
                        sourceHelper=''
                        sourceOptions={sourceOptions}
                        showSourceField={false}
                    />
                )
            },
            {
                id: 'source',
                label: t('metahubs:branches.tabs.source', 'Источник'),
                content: (
                    <BranchSourceFields
                        values={values}
                        setValue={setValue}
                        isLoading={isFormLoading}
                        errors={errors}
                        sourceLabel={t('metahubs:branches.sourceBranch', 'Source branch')}
                        emptyHelper={t('metahubs:branches.sourceEmptyHelper', 'Empty branch')}
                        defaultHelper={t('metahubs:branches.sourceBranchHelper', 'Default branch')}
                        sourceOptions={sourceOptions}
                    />
                )
            }
        ],
        [i18n.language, sourceOptions, t, tc]
    )

    const validateBranchForm = useCallback(
        (values: Record<string, any>) => {
            const errors: Record<string, string> = {}
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            if (!hasPrimaryContent(nameVlc)) {
                errors.nameVlc = tc('crud.nameRequired', 'Name is required')
            }
            const rawCodename = typeof values.codename === 'string' ? values.codename : ''
            const normalizedCodename = sanitizeCodename(rawCodename)
            if (!normalizedCodename) {
                errors.codename = t('metahubs:branches.validation.codenameRequired', 'Codename is required')
            } else if (!isValidCodename(normalizedCodename)) {
                errors.codename = t('metahubs:branches.validation.codenameInvalid', 'Codename contains invalid characters')
            }
            return Object.keys(errors).length > 0 ? errors : null
        },
        [t, tc]
    )

    const canSaveBranchForm = useCallback((values: Record<string, any>) => {
        const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
        const rawCodename = typeof values.codename === 'string' ? values.codename : ''
        const normalizedCodename = sanitizeCodename(rawCodename)
        return hasPrimaryContent(nameVlc) && Boolean(normalizedCodename) && isValidCodename(normalizedCodename)
    }, [])

    const getBranchDisplay = useCallback(
        (branch: MetahubBranch): MetahubBranchDisplay => {
            const display = toBranchDisplay(branch, i18n.language)
            return {
                ...display,
                name: display.name || branch.codename || '',
                description: display.description || ''
            }
        },
        [i18n.language]
    )

    const getStatusChips = (branch: MetahubBranch) => (
        <Stack direction='row' spacing={0.5} flexWrap='wrap'>
            {branch.isDefault ? (
                <Chip size='small' label={t('metahubs:branches.badge.default', 'Default')} variant='outlined' />
            ) : null}
            {branch.isActive ? (
                <Chip size='small' label={t('metahubs:branches.badge.active', 'Active')} color='success' variant='outlined' />
            ) : null}
        </Stack>
    )

    const branchColumns = useMemo(
        () => [
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '35%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: MetahubBranchDisplay) => row.name?.toLowerCase() ?? '',
                render: (row: MetahubBranchDisplay) => (
                    <Stack spacing={0.5}>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-word' }}>{row.name || '—'}</Typography>
                        <Stack direction='row' spacing={0.5} flexWrap='wrap'>
                            {row.isDefault ? (
                                <Chip size='small' label={t('metahubs:branches.badge.default', 'Default')} variant='outlined' />
                            ) : null}
                            {row.isActive ? (
                                <Chip size='small' label={t('metahubs:branches.badge.active', 'Active')} color='success' variant='outlined' />
                            ) : null}
                        </Stack>
                    </Stack>
                )
            },
            {
                id: 'description',
                label: tc('table.description', 'Description'),
                width: '30%',
                align: 'left' as const,
                render: (row: MetahubBranchDisplay) => (
                    <Typography sx={{ fontSize: 13, color: 'text.secondary', wordBreak: 'break-word' }}>
                        {row.description || '—'}
                    </Typography>
                )
            },
            {
                id: 'codename',
                label: t('metahubs:branches.codename', 'Codename'),
                width: '20%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: MetahubBranchDisplay) => row.codename?.toLowerCase() ?? '',
                render: (row: MetahubBranchDisplay) => (
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
        ],
        [t, tc]
    )

    const createBranchContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            branchMap,
            uiLocale: i18n.language,
            api: {
                updateEntity: async (id: string, patch: BranchLocalizedPayload) => {
                    if (!metahubId) return
                    const normalizedCodename = sanitizeCodename(patch.codename)
                    if (!normalizedCodename) {
                        throw new Error(t('metahubs:branches.validation.codenameRequired', 'Codename is required'))
                    }
                    const branch = branchMap.get(id)
                    const expectedVersion = branch?.version
                    try {
                        await updateBranchMutation.mutateAsync({
                            metahubId,
                            branchId: id,
                            data: { ...patch, codename: normalizedCodename, expectedVersion }
                        })
                    } catch (error: unknown) {
                        if (isOptimisticLockConflict(error)) {
                            const conflict = extractConflictInfo(error)
                            if (conflict) {
                                setConflictState({ open: true, conflict, pendingUpdate: { id, patch: { ...patch, codename: normalizedCodename } } })
                                return
                            }
                        }
                        throw error
                    }
                },
                deleteEntity: async (id: string) => {
                    if (!metahubId) return
                    await deleteBranchMutation.mutateAsync({ metahubId, branchId: id })
                }
            },
            runtime: {
                activateBranch: async (id: string) => {
                    if (!metahubId) return
                    await activateBranchMutation.mutateAsync({ metahubId, branchId: id })
                },
                setDefaultBranch: async (id: string) => {
                    if (!metahubId) return
                    await setDefaultBranchMutation.mutateAsync({ metahubId, branchId: id })
                }
            },
            helpers: {
                refreshList: async () => {
                    if (metahubId) {
                        await invalidateBranchesQueries.all(queryClient, metahubId)
                    }
                },
                enqueueSnackbar: (payload: {
                    message: string
                    options?: { variant?: 'default' | 'error' | 'success' | 'warning' | 'info' }
                }) => {
                    if (payload?.message) {
                        enqueueSnackbar(payload.message, payload.options)
                    }
                },
                openDeleteDialog: (branchOrDisplay: MetahubBranch | MetahubBranchDisplay) => {
                    const branch = 'metahubId' in branchOrDisplay ? branchOrDisplay : branchMap.get(branchOrDisplay.id)
                    if (branch) {
                        setDeleteDialogState({ open: true, branch })
                    }
                }
            }
        }),
        [
            activateBranchMutation,
            branchMap,
            deleteBranchMutation,
            enqueueSnackbar,
            i18n.language,
            metahubId,
            queryClient,
            setDefaultBranchMutation,
            t,
            updateBranchMutation
        ]
    )

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
        setDialogOpen(true)
    }

    const handleDialogClose = () => {
        setDialogOpen(false)
    }

    const handleCreateBranch = async (data: Record<string, any>) => {
        setDialogError(null)
        setCreating(true)
        try {
            const nameVlc = data.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const descriptionVlc = data.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
            const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
            if (!nameInput || !namePrimaryLocale) {
                setDialogError(tc('crud.nameRequired', 'Name is required'))
                return
            }
            const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)
            const normalizedCodename = sanitizeCodename(String(data.codename || ''))
            if (!normalizedCodename) {
                setDialogError(t('metahubs:branches.validation.codenameRequired', 'Codename is required'))
                return
            }
            const sourceBranchId = typeof data.sourceBranchId === 'string' && data.sourceBranchId.length > 0 ? data.sourceBranchId : undefined

            await createBranchMutation.mutateAsync({
                metahubId,
                data: {
                    codename: normalizedCodename,
                    name: nameInput,
                    description: descriptionInput,
                    namePrimaryLocale,
                    descriptionPrimaryLocale,
                    ...(sourceBranchId ? { sourceBranchId } : {})
                }
            })

            setDialogOpen(false)
        } catch (error: any) {
            const status = error?.response?.status
            if (status === 409) {
                setDialogError(t('metahubs:branches.createLocked', 'Branch creation is already in progress. Please try again.'))
            } else {
                setDialogError(error.message || t('metahubs:branches.createError', 'Failed to create branch'))
            }
        } finally {
            setCreating(false)
        }
    }

    const handleDeleteBranch = async (branch: MetahubBranch) => {
        if (!metahubId) return
        try {
            await deleteBranchMutation.mutateAsync({ metahubId, branchId: branch.id })
            setDeleteDialogState({ open: false, branch: null })
        } catch (error: any) {
            enqueueSnackbar(error.message || t('metahubs:branches.deleteError', 'Failed to delete branch'), { variant: 'error' })
        }
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
            {error ? (
                <EmptyListState
                    image={APIEmptySVG}
                    imageAlt='Connection error'
                    title={t('errors.connectionFailed')}
                    description={!(error as any)?.response?.status ? t('errors.checkConnection') : t('errors.pleaseTryLater')}
                    action={{
                        label: t('actions.retry'),
                        onClick: () => paginationResult.actions.goToPage(1)
                    }}
                />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 1 }}>
                    <ViewHeader
                        search={true}
                        searchPlaceholder={t('metahubs:branches.searchPlaceholder', 'Search branches...')}
                        onSearchChange={handleSearchChange}
                        title={t('metahubs:branches.title', 'Branches')}
                    >
                        <ToolbarControls
                            viewToggleEnabled
                            viewMode={view as 'card' | 'list'}
                            onViewModeChange={(mode) => setView(mode)}
                            cardViewTitle={tc('cardView')}
                            listViewTitle={tc('listView')}
                            primaryAction={{
                                label: tc('addNew'),
                                onClick: handleAddNew,
                                startIcon: <AddRoundedIcon />
                            }}
                        />
                    </ViewHeader>

                    {isLoading && branches.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && branches.length === 0 ? (
                        <EmptyListState
                            image={APIEmptySVG}
                            imageAlt='No branches'
                            title={t('metahubs:branches.empty', 'No branches yet')}
                            description={t('metahubs:branches.emptyDescription', 'Create your first branch to start iterating')}
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
                                    {branches.map((branch: MetahubBranch) => {
                                        const descriptors = [...branchActions]

                                        return (
                                            <ItemCard
                                                key={branch.id}
                                                data={getBranchDisplay(branch)}
                                                images={[]}
                                                footerStartContent={getStatusChips(branch)}
                                                headerAction={
                                                    descriptors.length > 0 ? (
                                                        <Box onClick={(e) => e.stopPropagation()}>
                                                            <BaseEntityMenu<MetahubBranchDisplay, BranchLocalizedPayload>
                                                                entity={getBranchDisplay(branch)}
                                                                entityKind='branch'
                                                                descriptors={descriptors}
                                                                namespace='metahubs'
                                                                i18nInstance={i18n}
                                                                createContext={createBranchContext}
                                                                renderTrigger={(props: TriggerProps) => (
                                                                    <IconButton
                                                                        size='small'
                                                                        sx={{ color: 'text.secondary', width: 28, height: 28, p: 0.25 }}
                                                                        {...props}
                                                                    >
                                                                        <MoreVertRoundedIcon fontSize='small' />
                                                                    </IconButton>
                                                                )}
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
                                        data={branches.map(getBranchDisplay)}
                                        images={{}}
                                        isLoading={isLoading}
                                        customColumns={branchColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: any) => {
                                            const originalBranch = branches.find((b) => b.id === row.id)
                                            if (!originalBranch) return null

                                            const descriptors = [...branchActions]
                                            if (!descriptors.length) return null

                                            return (
                                                <BaseEntityMenu<MetahubBranchDisplay, BranchLocalizedPayload>
                                                    entity={getBranchDisplay(originalBranch)}
                                                    entityKind='branch'
                                                    descriptors={descriptors}
                                                    namespace='metahubs'
                                                    menuButtonLabelKey='flowList:menu.button'
                                                    i18nInstance={i18n}
                                                    createContext={createBranchContext}
                                                />
                                            )
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}

                    {!isLoading && branches.length > 0 && (
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
                open={isDialogOpen}
                title={t('metahubs:branches.createDialog.title', 'Create Branch')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={isCreating}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreateBranch}
                hideDefaultFields
                initialExtraValues={localizedFormDefaults}
                tabs={buildCreateTabs}
                validate={validateBranchForm}
                canSave={canSaveBranchForm}
            />

            <BranchDeleteDialog
                open={deleteDialogState.open}
                branch={deleteDialogState.branch}
                metahubId={metahubId}
                onClose={() => setDeleteDialogState({ open: false, branch: null })}
                onConfirm={handleDeleteBranch}
                isDeleting={deleteBranchMutation.isPending}
            />

            <ConflictResolutionDialog
                open={conflictState.open}
                conflict={conflictState.conflict}
                onCancel={() => {
                    setConflictState({ open: false, conflict: null, pendingUpdate: null })
                    if (metahubId) {
                        invalidateBranchesQueries.all(queryClient, metahubId)
                    }
                }}
                onOverwrite={async () => {
                    if (conflictState.pendingUpdate && metahubId) {
                        const { id, patch } = conflictState.pendingUpdate
                        await updateBranchMutation.mutateAsync({
                            metahubId,
                            branchId: id,
                            data: patch
                        })
                        setConflictState({ open: false, conflict: null, pendingUpdate: null })
                    }
                }}
                isLoading={updateBranchMutation.isPending}
            />
        </MainCard>
    )
}

export default BranchList
