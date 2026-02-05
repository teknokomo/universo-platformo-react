import type { MouseEvent } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSnackbar } from 'notistack'
import { useQueryClient } from '@tanstack/react-query'
import {
    Box,
    Chip,
    Divider,
    FormControlLabel,
    IconButton,
    Menu,
    MenuItem,
    Skeleton,
    Stack,
    Switch,
    TextField,
    Typography
} from '@mui/material'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import ToggleOnRoundedIcon from '@mui/icons-material/ToggleOnRounded'
import ToggleOffRoundedIcon from '@mui/icons-material/ToggleOffRounded'

import { useCommonTranslations } from '@universo/i18n'
import {
    TemplateMainCard as MainCard,
    ItemCard,
    ToolbarControls,
    ViewHeaderMUI as ViewHeader,
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
    LocalizedInlineField,
    notifyError
} from '@universo/template-mui'
import { EntityFormDialog } from '@universo/template-mui/components/dialogs'

import { STORAGE_KEYS } from '../../../constants/storage'
import { useViewPreference } from '../../../hooks/useViewPreference'
import { ensureLocalizedContent, extractLocalizedInput, hasPrimaryContent, normalizeLocale } from '../../../utils/localizedInput'
import { metahubsQueryKeys, invalidateLayoutsQueries } from '../../shared'
import * as layoutsApi from '../api'
import { useCreateLayout, useDeleteLayout, useUpdateLayout } from '../hooks/mutations'
import type { MetahubLayout, MetahubLayoutDisplay, MetahubLayoutLocalizedPayload } from '../../../types'
import { getVLCString, toMetahubLayoutDisplay } from '../../../types'

type DashboardLayoutConfig = {
    showSideMenu: boolean
    showAppNavbar: boolean
    showHeader: boolean
    showBreadcrumbs: boolean
    showSearch: boolean
    showDatePicker: boolean
    showOptionsMenu: boolean
    showOverviewTitle: boolean
    showOverviewCards: boolean
    showSessionsChart: boolean
    showPageViewsChart: boolean
    showDetailsTitle: boolean
    showDetailsTable: boolean
    showDetailsSidePanel: boolean
    showFooter: boolean
}

const DEFAULT_DASHBOARD_CONFIG: DashboardLayoutConfig = {
    showSideMenu: true,
    showAppNavbar: true,
    showHeader: true,
    showBreadcrumbs: true,
    showSearch: true,
    showDatePicker: true,
    showOptionsMenu: true,
    showOverviewTitle: true,
    showOverviewCards: true,
    showSessionsChart: true,
    showPageViewsChart: true,
    showDetailsTitle: true,
    showDetailsTable: true,
    showDetailsSidePanel: true,
    showFooter: true
}

type LayoutFormValues = {
    templateKey: 'dashboard'
    nameVlc: any | null
    descriptionVlc: any | null
    isActive: boolean
    isDefault: boolean
}

type LayoutMenuState = {
    anchorEl: HTMLElement | null
    layout: MetahubLayout | null
}

const LayoutList = () => {
    const navigate = useNavigate()
    const { metahubId } = useParams<{ metahubId: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const { confirm } = useConfirm()

    const [view, setView] = useViewPreference(STORAGE_KEYS.LAYOUT_DISPLAY_STYLE)

    const [isCreateDialogOpen, setCreateDialogOpen] = useState(false)
    const [isEditDialogOpen, setEditDialogOpen] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)
    const [editingLayout, setEditingLayout] = useState<MetahubLayout | null>(null)

    const [menuState, setMenuState] = useState<LayoutMenuState>({ anchorEl: null, layout: null })

    const createLayoutMutation = useCreateLayout()
    const updateLayoutMutation = useUpdateLayout()
    const deleteLayoutMutation = useDeleteLayout()

    const paginationResult = usePaginated<MetahubLayout, 'name' | 'created' | 'updated'>({
        queryKeyFn: metahubId ? (params) => metahubsQueryKeys.layoutsList(metahubId, params) : () => ['empty'],
        queryFn: metahubId
            ? (params) => layoutsApi.listLayouts(metahubId, params)
            : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc',
        enabled: !!metahubId
    })

    const { data: layouts, isLoading, error } = paginationResult

    const { handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    const layoutsById = useMemo(() => new Map(layouts.map((l) => [l.id, l])), [layouts])

    const activeCount = useMemo(() => layouts.filter((l) => l.isActive).length, [layouts])

    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        layouts.forEach((layout) => {
            imagesMap[layout.id] = []
        })
        return imagesMap
    }, [layouts])

    const openMenu = (event: MouseEvent<HTMLElement>, layout: MetahubLayout) => {
        event.stopPropagation()
        setMenuState({ anchorEl: event.currentTarget, layout })
    }

    const closeMenu = () => setMenuState({ anchorEl: null, layout: null })

    const goToLayout = (layout: MetahubLayout) => {
        navigate(`/metahub/${metahubId}/layouts/${layout.id}`)
    }

    const handleAddNew = () => {
        setDialogError(null)
        setEditingLayout(null)
        setCreateDialogOpen(true)
    }

    const handleEdit = (layout: MetahubLayout) => {
        setDialogError(null)
        setEditingLayout(layout)
        setEditDialogOpen(true)
    }

    const getCardData = (layout: MetahubLayout): MetahubLayoutDisplay => toMetahubLayoutDisplay(layout, i18n.language)

    const localizedDefaults: LayoutFormValues = useMemo(() => {
        const uiLocale = normalizeLocale(i18n.language)
        return {
            templateKey: 'dashboard',
            nameVlc: ensureLocalizedContent(null, uiLocale, ''),
            descriptionVlc: ensureLocalizedContent(null, uiLocale, ''),
            isActive: true,
            isDefault: false
        }
    }, [i18n.language])

    const validateLayoutForm = useCallback(
        (_values: Record<string, any>) => {
            const errors: Record<string, string> = {}
            const nameVlc = _values.nameVlc
            if (!hasPrimaryContent(nameVlc)) {
                errors.nameVlc = t('common:crud.nameRequired', 'Name is required')
            }
            const isActive = Boolean(_values.isActive)
            const isDefault = Boolean(_values.isDefault)
            if (isDefault && !isActive) {
                errors.isDefault = t('layouts.validation.defaultMustBeActive', 'Default layout must be active')
            }
            return Object.keys(errors).length > 0 ? errors : null
        },
        [t]
    )

    const canSaveLayoutForm = useCallback(
        (_values: Record<string, any>) => {
            return hasPrimaryContent(_values.nameVlc) && (!Boolean(_values.isDefault) || Boolean(_values.isActive))
        },
        []
    )

    const toPayload = useCallback(
        (values: Record<string, any>, expectedVersion?: number): MetahubLayoutLocalizedPayload => {
            const uiLocale = normalizeLocale(i18n.language)
            const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(values.nameVlc)
            const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(values.descriptionVlc)
            return {
                templateKey: 'dashboard',
                name: nameInput ?? { [uiLocale]: '' },
                description: descriptionInput,
                namePrimaryLocale,
                descriptionPrimaryLocale,
                isActive: Boolean(values.isActive),
                isDefault: Boolean(values.isDefault),
                config: DEFAULT_DASHBOARD_CONFIG as unknown as Record<string, unknown>,
                expectedVersion
            }
        },
        [i18n.language]
    )

    const handleCreate = async (values: Record<string, any>) => {
        if (!metahubId) return
        try {
            setDialogError(null)
            const payload = toPayload(values)
            await createLayoutMutation.mutateAsync({ metahubId, data: payload })
            await invalidateLayoutsQueries.all(queryClient, metahubId)
            setCreateDialogOpen(false)
        } catch (e: unknown) {
            setDialogError(e instanceof Error ? e.message : String(e))
            notifyError(t, enqueueSnackbar, e)
        }
    }

    const handleUpdate = async (values: Record<string, any>) => {
        if (!metahubId || !editingLayout) return
        try {
            setDialogError(null)
            const payload = toPayload(values, editingLayout.version)
            await updateLayoutMutation.mutateAsync({ metahubId, layoutId: editingLayout.id, data: payload })
            await invalidateLayoutsQueries.all(queryClient, metahubId)
            setEditDialogOpen(false)
            setEditingLayout(null)
        } catch (e: unknown) {
            setDialogError(e instanceof Error ? e.message : String(e))
            notifyError(t, enqueueSnackbar, e)
        }
    }

    const handleSetDefault = async (layout: MetahubLayout) => {
        if (!metahubId) return
        try {
            await updateLayoutMutation.mutateAsync({
                metahubId,
                layoutId: layout.id,
                data: { isDefault: true, expectedVersion: layout.version }
            })
        } catch (e: unknown) {
            notifyError(t, enqueueSnackbar, e)
        }
    }

    const handleToggleActive = async (layout: MetahubLayout) => {
        if (!metahubId) return
        try {
            await updateLayoutMutation.mutateAsync({
                metahubId,
                layoutId: layout.id,
                data: { isActive: !layout.isActive, expectedVersion: layout.version }
            })
        } catch (e: unknown) {
            notifyError(t, enqueueSnackbar, e)
        }
    }

    const handleDelete = async (layout: MetahubLayout) => {
        if (!metahubId) return
        const ok = await confirm({
            title: t('layouts.deleteDialog.title', 'Delete layout?'),
            description: t('layouts.deleteDialog.description', 'This action cannot be undone.'),
            confirmText: tc('actions.delete', 'Delete'),
            cancelText: tc('actions.cancel', 'Cancel')
        })
        if (!ok) return
        try {
            await deleteLayoutMutation.mutateAsync({ metahubId, layoutId: layout.id })
        } catch (e: unknown) {
            notifyError(t, enqueueSnackbar, e)
        }
    }

    const renderFormFields = useCallback(
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
            return (
                <>
                    <LocalizedInlineField
                        mode='localized'
                        label={tc('fields.name', 'Name')}
                        required
                        disabled={isLoading}
                        value={values.nameVlc ?? null}
                        onChange={(next) => setValue('nameVlc', next)}
                        error={fieldErrors.nameVlc || null}
                        helperText={fieldErrors.nameVlc}
                        uiLocale={i18n.language}
                    />
                    <LocalizedInlineField
                        mode='localized'
                        label={tc('fields.description', 'Description')}
                        disabled={isLoading}
                        value={values.descriptionVlc ?? null}
                        onChange={(next) => setValue('descriptionVlc', next)}
                        uiLocale={i18n.language}
                        multiline
                        rows={2}
                    />
                    <Divider />
                    <TextField
                        select
                        fullWidth
                        disabled
                        label={t('layouts.fields.uiTemplate', 'User interface template')}
                        value={values.templateKey || 'dashboard'}
                        onChange={(e) => setValue('templateKey', e.target.value)}
                        InputLabelProps={{ shrink: true }}
                    >
                        <MenuItem value='dashboard'>{t('layouts.templates.dashboard', 'Dashboard')}</MenuItem>
                    </TextField>
                    <Divider />
                    <Stack spacing={1}>
                        <FormControlLabel
                            control={
                                <Switch checked={Boolean(values.isActive)} onChange={(_, checked) => setValue('isActive', checked)} />
                            }
                            label={t('layouts.fields.isActive', 'Active')}
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={Boolean(values.isDefault)}
                                    onChange={(_, checked) => setValue('isDefault', checked)}
                                    disabled={!Boolean(values.isActive)}
                                />
                            }
                            label={t('layouts.fields.isDefault', 'Default')}
                        />
                        {fieldErrors.isDefault ? (
                            <Typography variant='caption' color='error'>
                                {fieldErrors.isDefault}
                            </Typography>
                        ) : null}
                    </Stack>
                </>
            )
        },
        [i18n.language, t, tc]
    )

    const layoutColumns = useMemo(
        () => [
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '25%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: MetahubLayoutDisplay) => row.name?.toLowerCase() ?? '',
                render: (row: MetahubLayoutDisplay) => (
                    <Link to={`/metahub/${metahubId}/layouts/${row.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <Typography
                            sx={{
                                fontSize: 14,
                                fontWeight: 500,
                                wordBreak: 'break-word',
                                '&:hover': { textDecoration: 'underline', color: 'primary.main' }
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
                width: '35%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: MetahubLayoutDisplay) => row.description?.toLowerCase() ?? '',
                render: (row: MetahubLayoutDisplay) => (
                    <Typography sx={{ fontSize: 14, wordBreak: 'break-word' }}>{row.description || '—'}</Typography>
                )
            },
            {
                id: 'templateKey',
                label: t('layouts.fields.template', 'Template'),
                width: '15%',
                align: 'left' as const,
                render: (row: MetahubLayoutDisplay) => (
                    <Typography sx={{ fontSize: 14, fontFamily: 'monospace' }}>{row.templateKey}</Typography>
                )
            },
            {
                id: 'flags',
                label: t('layouts.fields.status', 'Status'),
                width: '25%',
                align: 'left' as const,
                render: (row: MetahubLayoutDisplay) => (
                    <Stack direction='row' spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <Chip
                            size='small'
                            label={row.isActive ? t('layouts.status.active', 'Active') : t('layouts.status.inactive', 'Inactive')}
                            color={row.isActive ? 'success' : 'default'}
                            variant='outlined'
                        />
                        {row.isDefault ? (
                            <Chip
                                size='small'
                                label={t('layouts.status.default', 'Default')}
                                color='primary'
                                variant='outlined'
                                icon={<StarRoundedIcon fontSize='small' />}
                            />
                        ) : null}
                    </Stack>
                )
            }
        ],
        [metahubId, t, tc]
    )

    // Keep edit dialog state in sync if list updates (e.g., optimistic lock changes).
    useEffect(() => {
        if (!editingLayout) return
        const fresh = layoutsById.get(editingLayout.id)
        if (fresh) setEditingLayout(fresh)
    }, [editingLayout, layoutsById])

    const editInitialValues = useMemo(() => {
        if (!editingLayout) return localizedDefaults
        const uiLocale = normalizeLocale(i18n.language)
        const nameFallback = getVLCString(editingLayout.name, uiLocale) || ''
        const descriptionFallback = getVLCString(editingLayout.description, uiLocale) || ''
        return {
            templateKey: editingLayout.templateKey,
            nameVlc: ensureLocalizedContent(editingLayout.name, uiLocale, nameFallback),
            descriptionVlc: ensureLocalizedContent(editingLayout.description ?? null, uiLocale, descriptionFallback),
            isActive: Boolean(editingLayout.isActive),
            isDefault: Boolean(editingLayout.isDefault)
        } satisfies LayoutFormValues
    }, [editingLayout, i18n.language, localizedDefaults])

    const menuLayout = menuState.layout
    const disableDeactivate = Boolean(menuLayout?.isDefault) || (Boolean(menuLayout?.isActive) && activeCount <= 1)
    const disableDelete = Boolean(menuLayout?.isDefault)
    const disableSetDefault = !Boolean(menuLayout?.isActive) || Boolean(menuLayout?.isDefault)

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
                    action={{ label: t('actions.retry'), onClick: () => paginationResult.actions.goToPage(1) }}
                />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 1 }}>
                    <ViewHeader
                        search
                        searchPlaceholder={t('layouts.searchPlaceholder', 'Search layouts...')}
                        onSearchChange={handleSearchChange}
                        title={t('layouts.title', 'Layouts')}
                    >
                        <ToolbarControls
                            viewToggleEnabled
                            viewMode={view as 'card' | 'list'}
                            onViewModeChange={(mode: string) => setView(mode as any)}
                            cardViewTitle={tc('cardView')}
                            listViewTitle={tc('listView')}
                            primaryAction={{
                                label: tc('addNew'),
                                onClick: handleAddNew,
                                startIcon: <AddRoundedIcon />
                            }}
                        />
                    </ViewHeader>

                    {isLoading && layouts.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && layouts.length === 0 ? (
                        <EmptyListState
                            image={APIEmptySVG}
                            imageAlt='No layouts'
                            title={t('layouts.empty', 'No layouts')}
                            description={t('layouts.emptyDescription', 'Create a layout to configure published applications UI')}
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
                                        }
                                    }}
                                >
                                    {layouts.map((layout) => (
                                        <ItemCard
                                            key={layout.id}
                                            data={getCardData(layout)}
                                            images={images[layout.id] || []}
                                            onClick={() => goToLayout(layout)}
                                            footerEndContent={
                                                <Stack direction='row' spacing={1} sx={{ alignItems: 'center' }}>
                                                    <Chip
                                                        size='small'
                                                        label={
                                                            layout.isActive
                                                                ? t('layouts.status.active', 'Active')
                                                                : t('layouts.status.inactive', 'Inactive')
                                                        }
                                                        color={layout.isActive ? 'success' : 'default'}
                                                        variant='outlined'
                                                    />
                                                    {layout.isDefault ? (
                                                        <Chip
                                                            size='small'
                                                            label={t('layouts.status.default', 'Default')}
                                                            color='primary'
                                                            variant='outlined'
                                                        />
                                                    ) : null}
                                                </Stack>
                                            }
                                            headerAction={
                                                <Box onClick={(e) => e.stopPropagation()}>
                                                    <IconButton
                                                        size='small'
                                                        sx={{ color: 'text.secondary', width: 28, height: 28, p: 0.25 }}
                                                        onClick={(e) => openMenu(e, layout)}
                                                    >
                                                        <MoreVertRoundedIcon fontSize='small' />
                                                    </IconButton>
                                                </Box>
                                            }
                                        />
                                    ))}
                                </Box>
                            ) : (
                                <Box sx={{ mx: { xs: -1.5, md: -2 } }}>
                                    <FlowListTable
                                        data={layouts.map(getCardData)}
                                        images={images}
                                        isLoading={isLoading}
                                        getRowLink={(row: any) => (row?.id ? `/metahub/${metahubId}/layouts/${row.id}` : undefined)}
                                        customColumns={layoutColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: any) => {
                                            const original = layoutsById.get(row.id)
                                            if (!original) return null
                                            return (
                                                <IconButton size='small' onClick={(e) => openMenu(e, original)}>
                                                    <MoreVertRoundedIcon fontSize='small' />
                                                </IconButton>
                                            )
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}

                    {!isLoading && layouts.length > 0 && (
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

            <Menu
                open={Boolean(menuState.anchorEl)}
                anchorEl={menuState.anchorEl}
                onClose={closeMenu}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <MenuItem
                    onClick={() => {
                        if (menuLayout) goToLayout(menuLayout)
                        closeMenu()
                    }}
                >
                    <SettingsRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                    {t('layouts.actions.configure', 'Configure')}
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        if (menuLayout) handleEdit(menuLayout)
                        closeMenu()
                    }}
                >
                    <EditRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                    {tc('actions.edit', 'Edit')}
                </MenuItem>
                <Divider />
                <MenuItem
                    disabled={disableSetDefault}
                    onClick={() => {
                        if (menuLayout) void handleSetDefault(menuLayout)
                        closeMenu()
                    }}
                >
                    <StarRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                    {t('layouts.actions.setDefault', 'Set as default')}
                </MenuItem>
                <MenuItem
                    disabled={disableDeactivate}
                    onClick={() => {
                        if (menuLayout) void handleToggleActive(menuLayout)
                        closeMenu()
                    }}
                >
                    {menuLayout?.isActive ? (
                        <ToggleOffRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                    ) : (
                        <ToggleOnRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                    )}
                    {menuLayout?.isActive
                        ? t('layouts.actions.deactivate', 'Deactivate')
                        : t('layouts.actions.activate', 'Activate')}
                </MenuItem>
                <Divider />
                <MenuItem
                    disabled={disableDelete}
                    onClick={() => {
                        if (menuLayout) void handleDelete(menuLayout)
                        closeMenu()
                    }}
                    sx={{ color: 'error.main' }}
                >
                    <DeleteRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                    {tc('actions.delete', 'Delete')}
                </MenuItem>
            </Menu>

            <EntityFormDialog
                open={isCreateDialogOpen}
                title={t('layouts.createDialog.title', 'Create layout')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={createLayoutMutation.isPending}
                error={dialogError || undefined}
                onClose={() => setCreateDialogOpen(false)}
                onSave={handleCreate}
                hideDefaultFields
                initialExtraValues={localizedDefaults}
                extraFields={renderFormFields}
                validate={validateLayoutForm}
                canSave={canSaveLayoutForm}
            />

            <EntityFormDialog
                open={isEditDialogOpen}
                title={t('layouts.editDialog.title', 'Edit layout')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={updateLayoutMutation.isPending}
                error={dialogError || undefined}
                onClose={() => {
                    setEditDialogOpen(false)
                    setEditingLayout(null)
                }}
                onSave={handleUpdate}
                hideDefaultFields
                initialExtraValues={editInitialValues}
                extraFields={renderFormFields}
                validate={validateLayoutForm}
                canSave={canSaveLayoutForm}
            />

            <ConfirmDialog />
        </MainCard>
    )
}

export default LayoutList
