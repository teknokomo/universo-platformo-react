import { useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Box, Skeleton, Stack, Typography, RadioGroup, Radio, FormControlLabel, Divider } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useSnackbar } from 'notistack'
import { useQueryClient } from '@tanstack/react-query'
import type { VersionedLocalizedContent } from '@universo/types'
import type { ConflictInfo } from '@universo/utils'

// project imports
// Use the new template-mui ItemCard (JS component) for consistency with Uniks
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
    ConfirmDialog,
    useConfirm,
    RoleChip,
    useUserSettings,
    LocalizedInlineField,
    useCodenameAutoFill
} from '@universo/template-mui'
import { EntityFormDialog, ConfirmDeleteDialog, ConflictResolutionDialog } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'

import { useUpdateMetahub, useDeleteMetahub, useCopyMetahub } from '../hooks/mutations'
import { useViewPreference } from '../../../hooks/useViewPreference'
import { STORAGE_KEYS } from '../../../constants/storage'
import * as metahubsApi from '../api'
import { metahubsQueryKeys } from '../../shared'
import { Metahub, MetahubDisplay, MetahubLocalizedPayload, toMetahubDisplay, getVLCString } from '../../../types'
import metahubActions from './MetahubActions'
import { extractLocalizedInput, hasPrimaryContent, normalizeLocale } from '../../../utils/localizedInput'
import { sanitizeCodename, isValidCodename } from '../../../utils/codename'
import { CodenameField } from '../../../components'
import { TemplateSelector } from '../../templates/ui/TemplateSelector'

// Type for metahub update/create data
type MetahubFormValues = {
    nameVlc?: VersionedLocalizedContent<string> | null
    descriptionVlc?: VersionedLocalizedContent<string> | null
    codename?: string
    codenameTouched?: boolean
    storageMode?: 'main_db' | 'external_db'
}

type GeneralTabFieldsProps = {
    values: Record<string, any>
    setValue: (name: string, value: any) => void
    isLoading: boolean
    errors?: Record<string, string>
    uiLocale: string
    nameLabel: string
    descriptionLabel: string
    codenameLabel: string
    codenameHelper: string
    /** Show TemplateSelector between description and codename */
    showTemplateSelector?: boolean
}

const GeneralTabFields = ({
    values,
    setValue,
    isLoading,
    errors,
    uiLocale,
    nameLabel,
    descriptionLabel,
    codenameLabel,
    codenameHelper,
    showTemplateSelector
}: GeneralTabFieldsProps) => {
    const fieldErrors = errors ?? {}
    const nameVlc = (values.nameVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const descriptionVlc = (values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const codename = typeof values.codename === 'string' ? values.codename : ''
    const codenameTouched = Boolean(values.codenameTouched)
    const primaryLocale = nameVlc?._primary ?? normalizeLocale(uiLocale)
    const nameValue = getVLCString(nameVlc || undefined, primaryLocale)
    const nextCodename = sanitizeCodename(nameValue)

    useCodenameAutoFill({
        codename,
        codenameTouched,
        nextCodename,
        nameValue,
        setValue: setValue as (field: 'codename' | 'codenameTouched', value: string | boolean) => void
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
                error={fieldErrors.nameVlc || null}
                helperText={fieldErrors.nameVlc}
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
            {showTemplateSelector && (
                <TemplateSelector
                    value={values.templateId}
                    onChange={(id) => setValue('templateId', id)}
                    disabled={isLoading}
                    autoSelectDefault
                />
            )}
            <Divider />
            <CodenameField
                value={codename}
                onChange={(value: string) => setValue('codename', value)}
                touched={codenameTouched}
                onTouchedChange={(touched: boolean) => setValue('codenameTouched', touched)}
                label={codenameLabel}
                helperText={codenameHelper}
                error={fieldErrors.codename}
                disabled={isLoading}
                required
            />
        </Stack>
    )
}

const MetahubList = () => {
    // Use metahubs namespace for view-specific keys, roles and access for role/permission labels
    const { t, i18n } = useTranslation(['metahubs', 'roles', 'access', 'flowList'])
    // Use common namespace for table headers and common actions (with keyPrefix for cleaner usage)
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [view, setView] = useViewPreference(STORAGE_KEYS.METAHUB_DISPLAY_STYLE)

    // Get user settings for showAll preference
    const { settings } = useUserSettings()
    const showAll = settings.admin?.showAllItems ?? false

    // State management for dialog
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)

    // Create query function that includes showAll parameter
    const queryFnWithShowAll = useCallback((params: any) => metahubsApi.listMetahubs({ ...params, showAll }), [showAll])

    // Use paginated hook for metahubs list
    const paginationResult = usePaginated<Metahub, 'name' | 'codename' | 'created' | 'updated'>({
        queryKeyFn: (params) => [...metahubsQueryKeys.list(params), { showAll }],
        queryFn: queryFnWithShowAll,
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc'
    })

    const { data: metahubs, isLoading, error } = paginationResult

    // Instant search for better UX (backend has rate limiting protection)
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // State for independent ConfirmDeleteDialog (not managed by BaseEntityMenu)
    const [deleteDialogState, setDeleteDialogState] = useState<{
        open: boolean
        metahub: MetahubDisplay | null
    }>({ open: false, metahub: null })

    // State for conflict resolution dialog
    const [conflictState, setConflictState] = useState<{
        open: boolean
        conflict: ConflictInfo | null
        pendingUpdate: { id: string; patch: MetahubLocalizedPayload } | null
    }>({ open: false, conflict: null, pendingUpdate: null })

    const { confirm } = useConfirm()

    const updateMetahubMutation = useUpdateMetahub()
    const deleteMetahubMutation = useDeleteMetahub()
    const copyMetahubMutation = useCopyMetahub()

    // Convert metahubs to display format
    const metahubsDisplay = useMemo(() => {
        if (!Array.isArray(metahubs)) return []
        const currentLocale = i18n.language
        return metahubs.map((metahub) => toMetahubDisplay(metahub, currentLocale))
    }, [metahubs, i18n.language])

    const metahubMap = useMemo(() => {
        if (!Array.isArray(metahubs)) return new Map<string, Metahub>()
        return new Map(metahubs.map((metahub) => [metahub.id, metahub]))
    }, [metahubs])

    // Memoize images object to prevent unnecessary re-creation on every render
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(metahubsDisplay)) {
            metahubsDisplay.forEach((metahub) => {
                if (metahub?.id) {
                    imagesMap[metahub.id] = []
                }
            })
        }
        return imagesMap
    }, [metahubsDisplay])

    const localizedFormDefaults = useMemo<MetahubFormValues>(
        () => ({ nameVlc: null, descriptionVlc: null, codename: '', codenameTouched: false, storageMode: 'main_db' }),
        []
    )

    const buildFormTabs = useCallback(
        ({
            values,
            setValue,
            isLoading,
            errors
        }: {
            values: Record<string, any>
            setValue: (name: string, value: any) => void
            isLoading: boolean
            errors?: Record<string, string>
        }) => {
            const fieldErrors = errors ?? {}
            const storageMode = values.storageMode ?? 'main_db'

            return [
                {
                    id: 'general',
                    label: t('tabs.general'),
                    content: (
                        <GeneralTabFields
                            values={values}
                            setValue={setValue}
                            isLoading={isLoading}
                            errors={fieldErrors}
                            uiLocale={i18n.language}
                            nameLabel={tc('fields.name', 'Name')}
                            descriptionLabel={tc('fields.description', 'Description')}
                            codenameLabel={t('codename', 'Codename')}
                            codenameHelper={t('codenameHelper', 'Unique identifier')}
                            showTemplateSelector
                        />
                    )
                },
                {
                    id: 'storage',
                    label: t('tabs.storage'),
                    content: (
                        <Box sx={{ mt: 2 }}>
                            <RadioGroup value={storageMode} onChange={(e) => setValue('storageMode', e.target.value)}>
                                <FormControlLabel value='main_db' control={<Radio />} label={t('storage.mainDb')} disabled={isLoading} />
                                <FormControlLabel
                                    value='external_db'
                                    control={<Radio />}
                                    label={
                                        <Box>
                                            <Typography variant='body1'>{t('storage.externalDb')}</Typography>
                                            <Typography variant='caption' color='text.secondary'>
                                                {t('storage.externalDbDisabled')}
                                            </Typography>
                                        </Box>
                                    }
                                    disabled={true}
                                />
                            </RadioGroup>
                        </Box>
                    )
                }
            ]
        },
        [i18n.language, tc, t]
    )

    const validateMetahubForm = useCallback(
        (values: Record<string, any>) => {
            const errors: Record<string, string> = {}
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            if (!hasPrimaryContent(nameVlc)) {
                errors.nameVlc = tc('crud.nameRequired', 'Name is required')
            }
            const rawCodename = typeof values.codename === 'string' ? values.codename : ''
            const normalizedCodename = sanitizeCodename(rawCodename)
            if (!normalizedCodename) {
                errors.codename = t('validation.codenameRequired', 'Codename is required')
            } else if (!isValidCodename(normalizedCodename)) {
                errors.codename = t('validation.codenameInvalid', 'Codename contains invalid characters')
            }
            return Object.keys(errors).length > 0 ? errors : null
        },
        [t, tc]
    )

    const canSaveMetahubForm = useCallback((values: Record<string, any>) => {
        const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
        const rawCodename = typeof values.codename === 'string' ? values.codename : ''
        const normalizedCodename = sanitizeCodename(rawCodename)
        // Storage mode is always valid as it defaults to main_db and external is disabled
        return hasPrimaryContent(nameVlc) && Boolean(normalizedCodename) && isValidCodename(normalizedCodename)
    }, [])

    const handleAddNew = () => {
        setDialogError(null)
        setDialogOpen(true)
    }

    const handleDialogClose = () => {
        setDialogOpen(false)
    }

    const handleDialogSave = () => {
        setDialogOpen(false)
    }

    const handleCreateMetahub = async (data: Record<string, any>) => {
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
            const normalizedCodename = sanitizeCodename(String(data.codename || ''))
            if (!normalizedCodename) {
                setDialogError(t('validation.codenameRequired', 'Codename is required'))
                return
            }
            if (!isValidCodename(normalizedCodename)) {
                setDialogError(t('validation.codenameInvalid', 'Codename contains invalid characters'))
                return
            }
            const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)

            await metahubsApi.createMetahub({
                codename: normalizedCodename,
                name: nameInput,
                description: descriptionInput,
                namePrimaryLocale,
                descriptionPrimaryLocale,
                templateId: data.templateId || undefined
            })

            // Invalidate cache to refetch metahubs list
            await queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.lists()
            })

            handleDialogSave()
        } catch (e: unknown) {
            const responseMessage = e && typeof e === 'object' && 'response' in e ? (e as any)?.response?.data?.message : undefined
            const message =
                typeof responseMessage === 'string'
                    ? responseMessage
                    : e instanceof Error
                    ? e.message
                    : typeof e === 'string'
                    ? e
                    : t('errors.saveFailed')
            setDialogError(message)
            // eslint-disable-next-line no-console
            console.error('Failed to create metahub', e)
        } finally {
            setCreating(false)
        }
    }

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        setView(nextView as 'card' | 'table')
    }

    const metahubColumns = useMemo(
        () => [
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '20%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: MetahubDisplay) => row.name?.toLowerCase() ?? '',
                render: (row: MetahubDisplay) => (
                    <Link to={`/metahub/${row.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <Typography
                            sx={{
                                fontSize: 14,
                                fontWeight: 500,
                                wordBreak: 'break-word',
                                overflowWrap: 'break-word',
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
                width: '26%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: MetahubDisplay) => row.description?.toLowerCase() ?? '',
                render: (row: MetahubDisplay) => (
                    <Typography
                        sx={{
                            fontSize: 14,
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word'
                        }}
                    >
                        {row.description || '—'}
                    </Typography>
                )
            },
            {
                id: 'codename',
                label: t('codename', 'Codename'),
                width: '14%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: MetahubDisplay) => row.codename?.toLowerCase() ?? '',
                render: (row: MetahubDisplay) => (
                    <Typography
                        sx={{
                            fontSize: 14,
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            fontFamily: 'monospace'
                        }}
                    >
                        {row.codename || '—'}
                    </Typography>
                )
            },
            {
                id: 'role',
                label: tc('table.role', 'Role'),
                width: '10%',
                align: 'center' as const,
                render: (row: MetahubDisplay) => (row.role ? <RoleChip role={row.role} accessType={row.accessType} /> : '—')
            },
            {
                id: 'hubs',
                label: t('table.hubs'),
                width: '10%',
                align: 'center' as const,
                render: (row: MetahubDisplay) => (typeof row.hubsCount === 'number' ? row.hubsCount : '—')
            }
        ],
        [t, tc]
    )

    // Removed N+1 counts loading; counts are provided by backend list response

    const createMetahubContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            metahubMap,
            uiLocale: i18n.language,
            api: {
                updateEntity: async (id: string, patch: MetahubLocalizedPayload) => {
                    const metahub = metahubMap.get(id)
                    const expectedVersion = metahub?.version
                    try {
                        await updateMetahubMutation.mutateAsync({ id, data: patch, expectedVersion })
                    } catch (error: any) {
                        // Check for 409 Conflict (optimistic lock)
                        if (error?.response?.status === 409 && error?.response?.data?.code === 'OPTIMISTIC_LOCK_CONFLICT') {
                            const conflict = error.response.data.conflict as ConflictInfo
                            setConflictState({
                                open: true,
                                conflict,
                                pendingUpdate: { id, patch }
                            })
                            return // Don't re-throw, dialog will handle it
                        }
                        throw error
                    }
                },
                deleteEntity: async (id: string) => {
                    await deleteMetahubMutation.mutateAsync(id)
                },
                copyEntity: async (
                    id: string,
                    payload: {
                        name?: Record<string, string>
                        description?: Record<string, string>
                        namePrimaryLocale?: string
                        descriptionPrimaryLocale?: string
                        codename?: string
                        copyDefaultBranchOnly?: boolean
                        copyAccess?: boolean
                    }
                ) => {
                    await copyMetahubMutation.mutateAsync({ id, data: payload })
                }
            },
            helpers: {
                refreshList: async () => {
                    // Explicit cache invalidation
                    await queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.lists()
                    })
                },
                confirm: async (spec: any) => {
                    // Support both direct strings and translation keys
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
                // Helper to open ConfirmDeleteDialog independently from BaseEntityMenu
                openDeleteDialog: (metahub: MetahubDisplay) => {
                    setDeleteDialogState({ open: true, metahub })
                }
            }
        }),
        [
            confirm,
            copyMetahubMutation,
            deleteMetahubMutation,
            enqueueSnackbar,
            i18n.language,
            metahubMap,
            queryClient,
            updateMetahubMutation
        ]
    )

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
                        searchPlaceholder={t('searchPlaceholder')}
                        onSearchChange={handleSearchChange}
                        title={t('title')}
                    >
                        <ToolbarControls
                            viewToggleEnabled
                            settingsEnabled
                            viewMode={view as 'card' | 'list'}
                            onViewModeChange={(mode: string) => handleChange(null, mode)}
                            cardViewTitle={tc('cardView')}
                            listViewTitle={tc('listView')}
                            primaryAction={{
                                label: tc('create'),
                                onClick: handleAddNew,
                                startIcon: <AddRoundedIcon />
                            }}
                        />
                    </ViewHeader>

                    {isLoading && metahubsDisplay.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && metahubsDisplay.length === 0 ? (
                        <EmptyListState image={APIEmptySVG} imageAlt='No metahubs' title={t('noMetahubsFound')} />
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
                                    {metahubsDisplay.map((metahub: MetahubDisplay) => {
                                        // Filter actions based on permissions (same logic as table view)
                                        const descriptors = metahubActions.filter((descriptor) => {
                                            if (descriptor.id === 'edit' || descriptor.id === 'delete' || descriptor.id === 'copy') {
                                                return metahub.permissions?.manageMetahub
                                            }
                                            return true
                                        })

                                        return (
                                            <ItemCard
                                                key={metahub.id}
                                                data={metahub}
                                                images={images[metahub.id] || []}
                                                href={`/metahub/${metahub.id}`}
                                                footerEndContent={
                                                    metahub.role ? <RoleChip role={metahub.role} accessType={metahub.accessType} /> : null
                                                }
                                                headerAction={
                                                    descriptors.length > 0 ? (
                                                        <Box onClick={(e) => e.stopPropagation()}>
                                                            <BaseEntityMenu<MetahubDisplay, MetahubLocalizedPayload>
                                                                entity={metahub}
                                                                entityKind='metahub'
                                                                descriptors={descriptors}
                                                                namespace='metahubs'
                                                                i18nInstance={i18n}
                                                                createContext={createMetahubContext}
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
                                        data={metahubsDisplay}
                                        images={images}
                                        isLoading={isLoading}
                                        getRowLink={(row: MetahubDisplay) => (row?.id ? `/metahub/${row.id}` : undefined)}
                                        customColumns={metahubColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: MetahubDisplay) => {
                                            const descriptors = metahubActions.filter((descriptor) => {
                                                if (descriptor.id === 'edit' || descriptor.id === 'delete' || descriptor.id === 'copy') {
                                                    return row.permissions?.manageMetahub
                                                }
                                                return true
                                            })

                                            if (!descriptors.length) return null

                                            return (
                                                <BaseEntityMenu<MetahubDisplay, MetahubLocalizedPayload>
                                                    entity={row}
                                                    entityKind='metahub'
                                                    descriptors={descriptors}
                                                    // Use metahubs namespace for action item labels (edit/delete)
                                                    // but keep the button label from flowList via explicit namespaced key
                                                    namespace='metahubs'
                                                    menuButtonLabelKey='flowList:menu.button'
                                                    i18nInstance={i18n}
                                                    createContext={createMetahubContext}
                                                />
                                            )
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}

                    {/* Table Pagination at bottom - only show when there's data */}
                    {!isLoading && metahubsDisplay.length > 0 && (
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
                title={t('createMetahub', 'Create Metahub')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={tc('actions.create', 'Create')}
                savingButtonText={tc('actions.creating', 'Creating...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={isCreating}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreateMetahub}
                hideDefaultFields
                initialExtraValues={localizedFormDefaults}
                tabs={buildFormTabs}
                canSave={canSaveMetahubForm}
                validate={validateMetahubForm}
            />

            {/* Independent ConfirmDeleteDialog for Delete button in edit dialog */}
            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('confirmDelete')}
                description={t('confirmDeleteDescription', { name: deleteDialogState.metahub?.name || '' })}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setDeleteDialogState({ open: false, metahub: null })}
                onConfirm={async () => {
                    if (deleteDialogState.metahub) {
                        try {
                            await deleteMetahubMutation.mutateAsync(deleteDialogState.metahub.id)
                            setDeleteDialogState({ open: false, metahub: null })
                        } catch (err: unknown) {
                            const responseMessage =
                                err && typeof err === 'object' && 'response' in err ? (err as any)?.response?.data?.message : undefined
                            const message =
                                typeof responseMessage === 'string'
                                    ? responseMessage
                                    : err instanceof Error
                                    ? err.message
                                    : typeof err === 'string'
                                    ? err
                                    : t('deleteError')
                            enqueueSnackbar(message, { variant: 'error' })
                            setDeleteDialogState({ open: false, metahub: null })
                        }
                    }
                }}
            />

            {/* Conflict Resolution Dialog for optimistic locking */}
            <ConflictResolutionDialog
                open={conflictState.open}
                conflict={conflictState.conflict}
                onCancel={() => {
                    setConflictState({ open: false, conflict: null, pendingUpdate: null })
                    // Refresh list to get latest data
                    queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.lists() })
                }}
                onOverwrite={async () => {
                    // Force update without version check
                    if (conflictState.pendingUpdate) {
                        const { id, patch } = conflictState.pendingUpdate
                        try {
                            await updateMetahubMutation.mutateAsync({ id, data: patch })
                            setConflictState({ open: false, conflict: null, pendingUpdate: null })
                        } catch (err) {
                            enqueueSnackbar(t('updateError', 'Failed to update'), { variant: 'error' })
                        }
                    }
                }}
            />

            <ConfirmDialog />
        </MainCard>
    )
}

export default MetahubList
