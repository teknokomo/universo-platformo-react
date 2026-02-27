import type { MouseEvent } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSnackbar } from 'notistack'
import { useQueryClient } from '@tanstack/react-query'
import {
    Box,
    Checkbox,
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
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
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
    LocalizedInlineField,
    notifyError
} from '@universo/template-mui'
import { ConfirmDeleteDialog, EntityFormDialog } from '@universo/template-mui/components/dialogs'

import { STORAGE_KEYS } from '../../../constants/storage'
import { useViewPreference } from '../../../hooks/useViewPreference'
import { ensureLocalizedContent, extractLocalizedInput, hasPrimaryContent, normalizeLocale } from '../../../utils/localizedInput'
import { metahubsQueryKeys, invalidateLayoutsQueries } from '../../shared'
import * as layoutsApi from '../api'
import { useCopyLayout, useCreateLayout, useDeleteLayout, useUpdateLayout } from '../hooks/mutations'
import type { MetahubLayout, MetahubLayoutDisplay, MetahubLayoutLocalizedPayload } from '../../../types'
import { getVLCString, toMetahubLayoutDisplay } from '../../../types'
import type { VersionedLocalizedContent } from '@universo/types'
import { normalizeLayoutCopyOptions } from '@universo/utils'

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
    showColumnsContainer: boolean
    showProductTree: boolean
    showUsersByCountryChart: boolean
    showRightSideMenu: boolean
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
    showColumnsContainer: false,
    showProductTree: true,
    showUsersByCountryChart: true,
    showRightSideMenu: true,
    showFooter: true
}

type LayoutFormValues = {
    templateKey: 'dashboard'
    nameVlc: VersionedLocalizedContent<string> | null
    descriptionVlc: VersionedLocalizedContent<string> | null
    isActive: boolean
    isDefault: boolean
    copyWidgets?: boolean
    deactivateAllWidgets?: boolean
}

type LayoutDialogValues = Partial<LayoutFormValues> & Record<string, unknown>
type LayoutFormSetValue = (name: string, value: unknown) => void
type LayoutDialogArgs = {
    values: LayoutDialogValues
    setValue: LayoutFormSetValue
    isLoading: boolean
    errors?: Record<string, string>
}
type LayoutRowLike = { id?: string }

type LayoutMenuState = {
    anchorEl: HTMLElement | null
    layout: MetahubLayout | null
}

const appendLocalizedCopySuffix = (
    value: VersionedLocalizedContent<string> | null | undefined,
    uiLocale: string,
    fallback?: string
): VersionedLocalizedContent<string> => {
    if (!value) {
        const normalizedLocale = normalizeLocale(uiLocale)
        const suffix = normalizedLocale === 'ru' ? ' (копия)' : ' (copy)'
        const baseText = (fallback || '').trim()
        const content = baseText ? `${baseText}${suffix}` : normalizedLocale === 'ru' ? `Копия${suffix}` : `Copy${suffix}`
        return {
            _schema: 'v1',
            _primary: normalizedLocale,
            locales: {
                [normalizedLocale]: { content }
            }
        }
    }

    const nextLocales = { ...(value.locales || {}) } as Record<string, { content?: string }>
    for (const [locale, localeValue] of Object.entries(nextLocales)) {
        const normalizedLocale = normalizeLocale(locale)
        const suffix = normalizedLocale === 'ru' ? ' (копия)' : ' (copy)'
        const content = typeof localeValue?.content === 'string' ? localeValue.content.trim() : ''
        if (content.length > 0) {
            nextLocales[locale] = { ...localeValue, content: `${content}${suffix}` }
        }
    }

    const hasContent = Object.values(nextLocales).some((entry) => typeof entry?.content === 'string' && entry.content.trim().length > 0)
    if (!hasContent) {
        const normalizedLocale = normalizeLocale(uiLocale)
        const suffix = normalizedLocale === 'ru' ? ' (копия)' : ' (copy)'
        const baseText = (fallback || '').trim()
        nextLocales[normalizedLocale] = {
            content: baseText ? `${baseText}${suffix}` : normalizedLocale === 'ru' ? `Копия${suffix}` : `Copy${suffix}`
        }
    }

    return {
        ...value,
        locales: nextLocales
    }
}

const hasHttpResponseStatus = (error: unknown): boolean => {
    if (!error || typeof error !== 'object' || !('response' in error)) {
        return false
    }
    const response = (error as { response?: unknown }).response
    return Boolean(response && typeof response === 'object' && 'status' in (response as Record<string, unknown>))
}

const LayoutList = () => {
    const navigate = useNavigate()
    const { metahubId } = useParams<{ metahubId: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()

    const [view, setView] = useViewPreference(STORAGE_KEYS.LAYOUT_DISPLAY_STYLE)

    const [isCreateDialogOpen, setCreateDialogOpen] = useState(false)
    const [isEditDialogOpen, setEditDialogOpen] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)
    const [copyDialogError, setCopyDialogError] = useState<string | null>(null)
    const [editingLayout, setEditingLayout] = useState<MetahubLayout | null>(null)
    const [copyingLayout, setCopyingLayout] = useState<MetahubLayout | null>(null)
    const [isCopyDialogOpen, setCopyDialogOpen] = useState(false)
    const [deleteDialogState, setDeleteDialogState] = useState<{ open: boolean; layout: MetahubLayout | null }>({
        open: false,
        layout: null
    })

    const [menuState, setMenuState] = useState<LayoutMenuState>({ anchorEl: null, layout: null })

    const createLayoutMutation = useCreateLayout()
    const updateLayoutMutation = useUpdateLayout()
    const deleteLayoutMutation = useDeleteLayout()
    const copyLayoutMutation = useCopyLayout()

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
        const imagesMap: Record<string, unknown[]> = {}
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

    const handleCopy = (layout: MetahubLayout) => {
        setCopyDialogError(null)
        setCopyingLayout(layout)
        setCopyDialogOpen(true)
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

    const copyInitialValues: LayoutFormValues = useMemo(() => {
        if (!copyingLayout) {
            return {
                ...localizedDefaults,
                copyWidgets: true,
                deactivateAllWidgets: false
            }
        }

        const uiLocale = normalizeLocale(i18n.language)
        const sourceName = getVLCString(copyingLayout.name, uiLocale) || getVLCString(copyingLayout.name, 'en') || ''
        const sourceDescription = getVLCString(copyingLayout.description, uiLocale) || getVLCString(copyingLayout.description, 'en') || ''

        return {
            templateKey: 'dashboard',
            nameVlc: appendLocalizedCopySuffix(ensureLocalizedContent(copyingLayout.name, uiLocale, sourceName), uiLocale, sourceName),
            descriptionVlc: ensureLocalizedContent(copyingLayout.description ?? null, uiLocale, sourceDescription),
            isActive: Boolean(copyingLayout.isActive),
            isDefault: false,
            copyWidgets: true,
            deactivateAllWidgets: false
        }
    }, [copyingLayout, i18n.language, localizedDefaults])

    const validateLayoutForm = useCallback(
        (_values: LayoutDialogValues) => {
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

    const canSaveLayoutForm = useCallback((_values: LayoutDialogValues) => {
        return hasPrimaryContent(_values.nameVlc) && (!_values.isDefault || Boolean(_values.isActive))
    }, [])

    const toPayload = useCallback(
        (
            values: LayoutDialogValues,
            options?: { expectedVersion?: number; includeConfig?: boolean; existingLayout?: MetahubLayout | null }
        ): MetahubLayoutLocalizedPayload => {
            const uiLocale = normalizeLocale(i18n.language)
            const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(values.nameVlc)
            const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(values.descriptionVlc)
            const existingName = options?.existingLayout
                ? extractLocalizedInput(options.existingLayout.name)
                : { input: undefined, primaryLocale: undefined }
            const existingDescription = options?.existingLayout
                ? extractLocalizedInput(options.existingLayout.description ?? null)
                : { input: undefined, primaryLocale: undefined }
            const mergedNameInput = {
                ...(existingName.input ?? {}),
                ...(nameInput ?? {})
            }
            const mergedDescriptionInput = {
                ...(existingDescription.input ?? {}),
                ...(descriptionInput ?? {})
            }
            const payload: MetahubLayoutLocalizedPayload = {
                templateKey: 'dashboard',
                name: Object.keys(mergedNameInput).length > 0 ? mergedNameInput : { [uiLocale]: '' },
                description: Object.keys(mergedDescriptionInput).length > 0 ? mergedDescriptionInput : undefined,
                namePrimaryLocale: namePrimaryLocale ?? existingName.primaryLocale,
                descriptionPrimaryLocale: descriptionPrimaryLocale ?? existingDescription.primaryLocale,
                isActive: Boolean(values.isActive),
                isDefault: Boolean(values.isDefault),
                expectedVersion: options?.expectedVersion
            }
            if (options?.includeConfig) {
                payload.config = DEFAULT_DASHBOARD_CONFIG as unknown as Record<string, unknown>
            }
            return payload
        },
        [i18n.language]
    )

    const toCopyPayload = useCallback(
        (values: LayoutDialogValues) => {
            const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(values.nameVlc)
            if (!nameInput || !namePrimaryLocale) {
                throw new Error(t('common:crud.nameRequired', 'Name is required'))
            }

            const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(values.descriptionVlc)
            const copyOptions = normalizeLayoutCopyOptions({
                copyWidgets: Boolean(values.copyWidgets ?? true),
                deactivateAllWidgets: Boolean(values.deactivateAllWidgets ?? false)
            })

            return {
                name: nameInput,
                description: descriptionInput,
                namePrimaryLocale,
                descriptionPrimaryLocale,
                copyWidgets: copyOptions.copyWidgets,
                deactivateAllWidgets: copyOptions.deactivateAllWidgets
            }
        },
        [t]
    )

    const handleCreate = async (values: LayoutDialogValues) => {
        if (!metahubId) return
        try {
            setDialogError(null)
            const payload = toPayload(values, { includeConfig: true })
            await createLayoutMutation.mutateAsync({ metahubId, data: payload })
            await invalidateLayoutsQueries.all(queryClient, metahubId)
            setCreateDialogOpen(false)
        } catch (e: unknown) {
            setDialogError(e instanceof Error ? e.message : String(e))
            notifyError(t, enqueueSnackbar, e)
        }
    }

    const handleUpdate = async (values: LayoutDialogValues) => {
        if (!metahubId || !editingLayout) return
        try {
            setDialogError(null)
            const payload = toPayload(values, {
                expectedVersion: editingLayout.version,
                includeConfig: false,
                existingLayout: editingLayout
            })
            await updateLayoutMutation.mutateAsync({ metahubId, layoutId: editingLayout.id, data: payload })
            await invalidateLayoutsQueries.all(queryClient, metahubId)
            setEditDialogOpen(false)
            setEditingLayout(null)
        } catch (e: unknown) {
            setDialogError(e instanceof Error ? e.message : String(e))
            notifyError(t, enqueueSnackbar, e)
        }
    }

    const handleCopyLayout = async (values: LayoutDialogValues) => {
        if (!metahubId || !copyingLayout) return
        try {
            setCopyDialogError(null)
            const payload = toCopyPayload(values)
            await copyLayoutMutation.mutateAsync({
                metahubId,
                layoutId: copyingLayout.id,
                data: payload
            })
            await invalidateLayoutsQueries.all(queryClient, metahubId)
            setCopyDialogOpen(false)
            setCopyingLayout(null)
        } catch (e: unknown) {
            setCopyDialogError(e instanceof Error ? e.message : String(e))
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

    const handleDelete = (layout: MetahubLayout) => {
        setDeleteDialogState({ open: true, layout })
    }

    const handleDeleteConfirm = async () => {
        if (!metahubId || !deleteDialogState.layout) return
        try {
            await deleteLayoutMutation.mutateAsync({ metahubId, layoutId: deleteDialogState.layout.id })
            setDeleteDialogState({ open: false, layout: null })
        } catch (e: unknown) {
            notifyError(t, enqueueSnackbar, e)
            setDeleteDialogState({ open: false, layout: null })
        }
    }

    const renderFormFields = useCallback(
        ({ values, setValue, isLoading, errors }: LayoutDialogArgs) => {
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
                            control={<Switch checked={Boolean(values.isActive)} onChange={(_, checked) => setValue('isActive', checked)} />}
                            label={t('layouts.fields.isActive', 'Active')}
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={Boolean(values.isDefault)}
                                    onChange={(_, checked) => setValue('isDefault', checked)}
                                    disabled={!values.isActive}
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

    const renderCopyGeneralFields = useCallback(
        ({ values, setValue, isLoading, errors }: LayoutDialogArgs) => {
            const fieldErrors = errors ?? {}
            return (
                <Stack spacing={2}>
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
                </Stack>
            )
        },
        [i18n.language, tc]
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
    const disableSetDefault = !menuLayout?.isActive || Boolean(menuLayout?.isDefault)

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
                    imageAlt={t('errors.connectionFailed', 'Connection error')}
                    title={t('errors.connectionFailed')}
                    description={!hasHttpResponseStatus(error) ? t('errors.checkConnection') : t('errors.pleaseTryLater')}
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
                            onViewModeChange={(mode: string) => setView(mode === 'list' ? 'list' : 'card')}
                            cardViewTitle={tc('cardView')}
                            listViewTitle={tc('listView')}
                            primaryAction={{
                                label: tc('create'),
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
                            imageAlt={t('layouts.empty', 'No layouts')}
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
                                        getRowLink={(row: LayoutRowLike) =>
                                            row?.id ? `/metahub/${metahubId}/layouts/${row.id}` : undefined
                                        }
                                        customColumns={layoutColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: LayoutRowLike) => {
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
                <MenuItem
                    onClick={() => {
                        if (menuLayout) handleCopy(menuLayout)
                        closeMenu()
                    }}
                >
                    <ContentCopyRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                    {tc('actions.copy', 'Copy')}
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
                    {menuLayout?.isActive ? t('layouts.actions.deactivate', 'Deactivate') : t('layouts.actions.activate', 'Activate')}
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
                saveButtonText={tc('actions.create', 'Create')}
                savingButtonText={tc('actions.creating', 'Creating...')}
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
                mode='edit'
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
                showDeleteButton
                deleteButtonText={tc('actions.delete', 'Delete')}
                deleteButtonDisabled={Boolean(editingLayout?.isDefault)}
                onDelete={() => {
                    if (editingLayout) {
                        setDeleteDialogState({ open: true, layout: editingLayout })
                        setEditDialogOpen(false)
                    }
                }}
            />

            <EntityFormDialog
                open={isCopyDialogOpen}
                title={t('layouts.copyTitle', 'Copying layout')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={t('layouts.copy.action', 'Copy')}
                savingButtonText={t('layouts.copy.actionLoading', 'Copying...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={copyLayoutMutation.isPending}
                error={copyDialogError || undefined}
                onClose={() => {
                    setCopyDialogOpen(false)
                    setCopyingLayout(null)
                }}
                onSave={handleCopyLayout}
                hideDefaultFields
                initialExtraValues={copyInitialValues}
                tabs={({ values, setValue, isLoading, errors }: LayoutDialogArgs) => [
                    {
                        id: 'general',
                        label: t('layouts.tabs.general', 'General'),
                        content: renderCopyGeneralFields({ values, setValue, isLoading, errors })
                    },
                    {
                        id: 'options',
                        label: t('layouts.tabs.options', 'Options'),
                        content: (
                            <Stack spacing={1}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={Boolean(values.copyWidgets ?? true)}
                                            onChange={(event) => {
                                                const checked = event.target.checked
                                                setValue('copyWidgets', checked)
                                                if (!checked) {
                                                    setValue('deactivateAllWidgets', false)
                                                }
                                            }}
                                            disabled={isLoading}
                                        />
                                    }
                                    label={t('layouts.copy.options.copyWidgets', 'Copy widgets')}
                                />
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={Boolean(values.deactivateAllWidgets ?? false)}
                                            onChange={(event) => setValue('deactivateAllWidgets', event.target.checked)}
                                            disabled={isLoading || !(values.copyWidgets ?? true)}
                                        />
                                    }
                                    label={t('layouts.copy.options.deactivateAllWidgets', 'Deactivate all widgets')}
                                />
                            </Stack>
                        )
                    }
                ]}
                validate={validateLayoutForm}
                canSave={canSaveLayoutForm}
            />

            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('layouts.deleteDialog.title', 'Delete layout?')}
                description={t('layouts.deleteDialog.description', 'This action cannot be undone.')}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={deleteLayoutMutation.isPending}
                onCancel={() => setDeleteDialogState({ open: false, layout: null })}
                onConfirm={handleDeleteConfirm}
            />
        </MainCard>
    )
}

export default LayoutList
