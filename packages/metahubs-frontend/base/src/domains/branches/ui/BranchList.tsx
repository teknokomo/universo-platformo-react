import { useEffect, useMemo, useCallback } from 'react'
import {
    Box,
    Skeleton,
    Stack,
    Typography,
    Divider,
    Chip,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormHelperText,
    Checkbox,
    FormControlLabel
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useSnackbar } from 'notistack'
import { useQueryClient } from '@tanstack/react-query'

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
    useListDialogs
} from '@universo/template-mui'
import { EntityFormDialog, ConflictResolutionDialog } from '@universo/template-mui/components/dialogs'
import type { TabConfig } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'

import {
    useCreateBranch,
    useCopyBranch,
    useUpdateBranch,
    useDeleteBranch,
    useActivateBranch,
    useSetDefaultBranch
} from '../hooks/mutations'
import { useBranchListData } from '../hooks/useBranchListData'
import { useViewPreference } from '../../../hooks/useViewPreference'
import { STORAGE_KEYS } from '../../../view-preferences/storage'
import { invalidateBranchesQueries } from '../../shared'
import type { VersionedLocalizedContent } from '@universo/types'
import { BRANCH_COPY_OPTION_KEYS } from '@universo/types'
import type { MetahubBranch, MetahubBranchDisplay, BranchLocalizedPayload } from '../../../types'
import { getVLCString } from '../../../types'
import { isOptimisticLockConflict, extractConflictInfo, isPendingEntity, getPendingAction, type ConflictInfo } from '@universo/utils'
import { sanitizeCodenameForStyle, normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../utils/codename'
import { useCodenameConfig } from '../../settings/hooks/useCodenameConfig'
import { ensureLocalizedContent, extractLocalizedInput, hasPrimaryContent } from '../../../utils/localizedInput'
import { CodenameField, BranchDeleteDialog, ExistingCodenamesProvider } from '../../../components'
import { getBranchCopyOptions, setAllBranchCopyChildren, toggleBranchCopyChild } from '../utils/copyOptions'
import branchActions from './BranchActions'
import { useMetahubPrimaryLocale } from '../../settings/hooks/useMetahubPrimaryLocale'
import type { GenericFormValues, BranchMenuBaseContext } from './branchListUtils'
import { extractResponseStatus, extractResponseMessage } from './branchListUtils'

type BranchFormFieldsProps = {
    values: GenericFormValues
    setValue: (name: string, value: unknown) => void
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
    editingEntityId?: string | null
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
    showSourceField,
    editingEntityId
}: BranchFormFieldsProps) => {
    const codenameConfig = useCodenameConfig()
    const nameVlc = (values.nameVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const descriptionVlc = (values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const codename = (values.codename as VersionedLocalizedContent<string> | null | undefined) ?? null
    const codenameTouched = Boolean(values.codenameTouched)
    const sourceBranchId = values.sourceBranchId as string | undefined
    const selectedSource = sourceOptions.find((option) => option.id === sourceBranchId)

    useEffect(() => {
        if (showSourceField && !sourceBranchId && sourceOptions.length > 0) {
            setValue('sourceBranchId', sourceOptions[0].id)
        }
    }, [showSourceField, sourceBranchId, sourceOptions, setValue])

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
                onDuplicateStatusChange={(dup) => setValue('_hasCodenameDuplicate', dup)}
                uiLocale={uiLocale}
                label={codenameLabel}
                helperText={codenameHelper}
                error={errors.codename}
                disabled={isLoading}
                required
                editingEntityId={editingEntityId}
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
    values: GenericFormValues
    setValue: (name: string, value: unknown) => void
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
    const helperText = errors.sourceBranchId || (selectedSource?.isEmpty ? emptyHelper : selectedSource?.isDefault ? defaultHelper : '')
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

type BranchCopyOptionsFieldsProps = {
    values: GenericFormValues
    setValue: (name: string, value: unknown) => void
    isLoading: boolean
    t: (key: string, defaultValue?: string) => string
}

const BranchCopyOptionsFields = ({ values, setValue, isLoading, t }: BranchCopyOptionsFieldsProps) => {
    const options = getBranchCopyOptions(values)
    const allChildrenChecked = BRANCH_COPY_OPTION_KEYS.every((key) => options[key])
    const hasCheckedChildren = BRANCH_COPY_OPTION_KEYS.some((key) => options[key])
    const hasSourceBranch = typeof values.sourceBranchId === 'string' && values.sourceBranchId.length > 0
    const controlDisabled = isLoading || !hasSourceBranch

    return (
        <Stack spacing={1}>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={allChildrenChecked}
                        indeterminate={!allChildrenChecked && hasCheckedChildren}
                        onChange={(event) => setAllBranchCopyChildren(setValue, event.target.checked)}
                        disabled={controlDisabled}
                    />
                }
                label={t('metahubs:branches.copy.options.fullCopy', 'Full copy')}
            />
            <FormControlLabel
                control={
                    <Checkbox
                        checked={options.copyLayouts}
                        onChange={(event) => toggleBranchCopyChild(setValue, 'copyLayouts', event.target.checked, values)}
                        disabled={controlDisabled}
                    />
                }
                label={t('metahubs:branches.copy.options.copyLayouts', 'Layouts')}
            />
            <FormControlLabel
                control={
                    <Checkbox
                        checked={options.copyTreeEntities}
                        onChange={(event) => toggleBranchCopyChild(setValue, 'copyTreeEntities', event.target.checked, values)}
                        disabled={controlDisabled}
                    />
                }
                label={t('metahubs:branches.copy.options.copyTreeEntities', 'Hubs')}
            />
            <FormControlLabel
                control={
                    <Checkbox
                        checked={options.copyLinkedCollections}
                        onChange={(event) => toggleBranchCopyChild(setValue, 'copyLinkedCollections', event.target.checked, values)}
                        disabled={controlDisabled}
                    />
                }
                label={t('metahubs:branches.copy.options.copyLinkedCollections', 'Catalogs')}
            />
            <FormControlLabel
                control={
                    <Checkbox
                        checked={options.copyValueGroups}
                        onChange={(event) => toggleBranchCopyChild(setValue, 'copyValueGroups', event.target.checked, values)}
                        disabled={controlDisabled}
                    />
                }
                label={t('metahubs:branches.copy.options.copyValueGroups', 'Sets')}
            />
            <FormControlLabel
                control={
                    <Checkbox
                        checked={options.copyOptionLists}
                        onChange={(event) => toggleBranchCopyChild(setValue, 'copyOptionLists', event.target.checked, values)}
                        disabled={controlDisabled}
                    />
                }
                label={t('metahubs:branches.copy.options.copyOptionLists', 'Enumerations')}
            />
        </Stack>
    )
}

const BranchList = () => {
    const codenameConfig = useCodenameConfig()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()
    const preferredVlcLocale = useMetahubPrimaryLocale()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const { dialogs, openCreate, openDelete, openConflict, close } = useListDialogs<MetahubBranch>()
    const [view, setView] = useViewPreference(STORAGE_KEYS.BRANCH_DISPLAY_STYLE)

    const {
        metahubId,
        branches,
        isLoading,
        error,
        paginationResult,
        handleSearchChange,
        branchMap,
        handlePendingBranchInteraction,
        sourceOptions,
        localizedFormDefaults,
        getBranchDisplay
    } = useBranchListData()

    const createBranchMutation = useCreateBranch()
    const copyBranchMutation = useCopyBranch()
    const updateBranchMutation = useUpdateBranch()
    const deleteBranchMutation = useDeleteBranch()
    const activateBranchMutation = useActivateBranch()
    const setDefaultBranchMutation = useSetDefaultBranch()

    const buildCreateTabs = useCallback(
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
        }): TabConfig[] => [
            {
                id: 'general',
                label: t('metahubs:branches.tabs.general', 'General'),
                content: (
                    <BranchFormFields
                        values={values}
                        setValue={setValue}
                        isLoading={isFormLoading}
                        errors={errors}
                        uiLocale={preferredVlcLocale}
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
                label: t('metahubs:branches.tabs.source', 'Source'),
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
            },
            {
                id: 'options',
                label: t('metahubs:branches.tabs.options', 'Options'),
                content: <BranchCopyOptionsFields values={values} setValue={setValue} isLoading={isFormLoading} t={t} />
            }
        ],
        [preferredVlcLocale, sourceOptions, t, tc]
    )

    const validateBranchForm = useCallback(
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
                errors.codename = t('metahubs:branches.validation.codenameRequired', 'Codename is required')
            } else if (
                !isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            ) {
                errors.codename = t('metahubs:branches.validation.codenameInvalid', 'Codename contains invalid characters')
            }
            return Object.keys(errors).length > 0 ? errors : null
        },
        [codenameConfig.allowMixed, codenameConfig.alphabet, codenameConfig.style, t, tc]
    )

    const canSaveBranchForm = useCallback(
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

    const getStatusChips = (branch: MetahubBranch) => (
        <Stack direction='row' spacing={0.5} flexWrap='wrap'>
            {branch.isDefault ? <Chip size='small' label={t('metahubs:branches.badge.default', 'Default')} variant='outlined' /> : null}
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
                                <Chip
                                    size='small'
                                    label={t('metahubs:branches.badge.active', 'Active')}
                                    color='success'
                                    variant='outlined'
                                />
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
        (baseContext: BranchMenuBaseContext) => ({
            ...baseContext,
            branchMap,
            uiLocale: preferredVlcLocale,
            api: {
                updateEntity: (id: string, patch: BranchLocalizedPayload) => {
                    if (!metahubId) return Promise.resolve()
                    const rawCodename = getVLCString(patch.codename, patch.codename?._primary ?? 'en')
                    const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
                    if (!normalizedCodename) {
                        throw new Error(t('metahubs:branches.validation.codenameRequired', 'Codename is required'))
                    }
                    const codenamePayload = ensureLocalizedContent(patch.codename, patch.codename?._primary ?? 'en', normalizedCodename)
                    const branch = branchMap.get(id)
                    const expectedVersion = branch?.version
                    updateBranchMutation.mutate(
                        {
                            metahubId,
                            branchId: id,
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
                    return deleteBranchMutation.mutateAsync({ metahubId, branchId: id })
                },
                copyEntity: (
                    _id: string,
                    payload: BranchLocalizedPayload & {
                        sourceBranchId?: string
                        fullCopy?: boolean
                        copyLayouts?: boolean
                        copyTreeEntities?: boolean
                        copyLinkedCollections?: boolean
                        copyValueGroups?: boolean
                        copyOptionLists?: boolean
                    }
                ) => {
                    if (!metahubId) return Promise.resolve()
                    copyBranchMutation.mutate({ metahubId, data: payload })

                    return Promise.resolve()
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
                refreshList: () => {
                    if (metahubId) {
                        void invalidateBranchesQueries.all(queryClient, metahubId)
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
                        openDelete(branch)
                    }
                }
            }
        }),
        [
            activateBranchMutation,
            branchMap,
            codenameConfig.alphabet,
            codenameConfig.style,
            copyBranchMutation,
            deleteBranchMutation,
            enqueueSnackbar,
            metahubId,
            openConflict,
            openDelete,
            preferredVlcLocale,
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
        openCreate()
    }

    const handleDialogClose = () => {
        close('create')
    }

    const handleCreateBranch = (data: GenericFormValues) => {
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
        const sourceBranchId = typeof data.sourceBranchId === 'string' && data.sourceBranchId.length > 0 ? data.sourceBranchId : undefined
        const copyOptions = getBranchCopyOptions(data)

        // Fire-and-forget: optimistic card via onMutate, errors via onError snackbar,
        // cache invalidation via onSettled. Dialog closes immediately.
        createBranchMutation.mutate({
            metahubId,
            data: {
                codename: codenamePayload,
                name: nameInput ?? {},
                description: descriptionInput,
                namePrimaryLocale: namePrimaryLocale ?? '',
                descriptionPrimaryLocale,
                ...(sourceBranchId ? { sourceBranchId } : {}),
                ...copyOptions
            }
        })
    }

    const handleDeleteBranch = (branch: MetahubBranch) => {
        if (!metahubId) return
        deleteBranchMutation.mutate(
            { metahubId, branchId: branch.id },
            {
                onError: (error: unknown) => {
                    const responseMessage = extractResponseMessage(error)
                    const fallbackMessage = error instanceof Error ? error.message : undefined
                    enqueueSnackbar(responseMessage || fallbackMessage || t('metahubs:branches.deleteError', 'Failed to delete branch'), {
                        variant: 'error'
                    })
                }
            }
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
            <ExistingCodenamesProvider entities={branches ?? []}>
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
                                    label: tc('create'),
                                    onClick: handleAddNew,
                                    startIcon: <AddRoundedIcon />
                                }}
                            />
                        </ViewHeader>

                        {isLoading && branches.length === 0 ? (
                            view === 'card' ? (
                                <SkeletonGrid insetMode='content' />
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
                                                    pending={isPendingEntity(branch)}
                                                    pendingAction={getPendingAction(branch)}
                                                    onPendingInteractionAttempt={() => handlePendingBranchInteraction(branch.id)}
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
                                            data={branches.map(getBranchDisplay)}
                                            images={{}}
                                            isLoading={isLoading}
                                            onPendingInteractionAttempt={(row: MetahubBranchDisplay) =>
                                                handlePendingBranchInteraction(row.id)
                                            }
                                            customColumns={branchColumns}
                                            i18nNamespace='flowList'
                                            renderActions={(row: MetahubBranchDisplay) => {
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
                    title={t('metahubs:branches.createDialog.title', 'Create Branch')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={tc('actions.create', 'Create')}
                    savingButtonText={tc('actions.creating', 'Creating...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onClose={handleDialogClose}
                    onSave={handleCreateBranch}
                    hideDefaultFields
                    initialExtraValues={localizedFormDefaults}
                    tabs={buildCreateTabs}
                    validate={validateBranchForm}
                    canSave={canSaveBranchForm}
                />

                <BranchDeleteDialog
                    open={dialogs.delete.open}
                    branch={dialogs.delete.item}
                    metahubId={metahubId}
                    onClose={() => close('delete')}
                    onConfirm={handleDeleteBranch}
                    isDeleting={deleteBranchMutation.isPending}
                />

                <ConflictResolutionDialog
                    open={dialogs.conflict.open}
                    conflict={(dialogs.conflict.data as { conflict?: ConflictInfo })?.conflict ?? null}
                    onCancel={() => {
                        close('conflict')
                        if (metahubId) {
                            invalidateBranchesQueries.all(queryClient, metahubId)
                        }
                    }}
                    onOverwrite={async () => {
                        const pendingUpdate = (dialogs.conflict.data as { pendingUpdate?: { id: string; patch: BranchLocalizedPayload } })
                            ?.pendingUpdate
                        if (pendingUpdate && metahubId) {
                            const { id, patch } = pendingUpdate
                            await updateBranchMutation.mutateAsync({
                                metahubId,
                                branchId: id,
                                data: patch
                            })
                            close('conflict')
                        }
                    }}
                    isLoading={updateBranchMutation.isPending}
                />
            </ExistingCodenamesProvider>
        </MainCard>
    )
}

export default BranchList
