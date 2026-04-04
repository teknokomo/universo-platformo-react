import { useCallback, useEffect, useMemo, useRef } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Checkbox from '@mui/material/Checkbox'
import AddIcon from '@mui/icons-material/Add'
import { useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
    AppsDashboard,
    useCrudDashboard,
    CrudDialogs,
    RowActionsMenu,
    type CellRendererOverrides,
    type DashboardDetailsSlot
} from '@universo/apps-template-mui'
import { createRuntimeAdapter } from '../api/runtimeAdapter'
import {
    buildPendingRuntimeCellMap,
    getRuntimeCellPendingKey,
    usePendingRuntimeCellMutations,
    useUpdateRuntimeCell
} from '../api/mutations'

const DEFAULT_PAGE_SIZE = 50

const ApplicationRuntime = () => {
    const { applicationId } = useParams<{ applicationId: string }>()
    const [searchParams, setSearchParams] = useSearchParams()
    const { t, i18n } = useTranslation('applications')

    const adapter = useMemo(() => (applicationId ? createRuntimeAdapter(applicationId) : null), [applicationId])

    // Inline cell mutation for BOOLEAN checkboxes (catalogId passed dynamically)
    const updateCellMutation = useUpdateRuntimeCell({ applicationId })
    const pendingRuntimeCellMutations = usePendingRuntimeCellMutations({ applicationId })

    // Stabilize cellRenderers — use refs to avoid DataGrid column re-creation on mutation state changes
    const cellMutateRef = useRef(updateCellMutation.mutate)
    cellMutateRef.current = updateCellMutation.mutate
    const pendingCellValues = useMemo(() => buildPendingRuntimeCellMap(pendingRuntimeCellMutations), [pendingRuntimeCellMutations])
    const pendingCellValuesRef = useRef(pendingCellValues)
    pendingCellValuesRef.current = pendingCellValues
    const catalogIdRef = useRef<string | undefined>(undefined)
    const pendingInteractionRef = useRef<(rowId: string) => boolean>(() => false)

    // Cell renderer overrides: interactive BOOLEAN checkboxes with per-cell optimistic state
    const cellRenderers = useMemo<CellRendererOverrides>(
        () => ({
            BOOLEAN: (params) => {
                // "via UI" optimistic: if THIS cell has a pending mutation, show the latest pending value for that exact cell
                const pendingKey = getRuntimeCellPendingKey(params.rowId, params.field)
                const hasPendingValue = pendingCellValuesRef.current.has(pendingKey)
                const pendingValue = pendingCellValuesRef.current.get(pendingKey)
                const displayValue = hasPendingValue ? pendingValue : params.value

                return (
                    <Checkbox
                        disableRipple
                        checked={Boolean(displayValue)}
                        indeterminate={false}
                        disabled={false}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(_, checked) => {
                            if (pendingInteractionRef.current(params.rowId)) {
                                return
                            }

                            cellMutateRef.current({
                                rowId: params.rowId,
                                field: params.field,
                                value: checked,
                                catalogId: catalogIdRef.current
                            })
                        }}
                    />
                )
            }
        }),
        []
    )

    const state = useCrudDashboard({
        adapter,
        locale: i18n.language,
        i18nNamespace: 'applications',
        defaultPageSize: DEFAULT_PAGE_SIZE,
        pageSizeOptions: [10, 25, 50, 100],
        staleTime: 30_000,
        cellRenderers
    })

    const activeCatalogRuntimeConfig = state.appData?.catalog?.runtimeConfig
    const showCreateButton = activeCatalogRuntimeConfig?.showCreateButton !== false
    const resolveFormSurface = useCallback(
        (mode: 'create' | 'edit' | 'copy') => {
            if (mode === 'create') return activeCatalogRuntimeConfig?.createSurface ?? 'dialog'
            if (mode === 'copy') return activeCatalogRuntimeConfig?.copySurface ?? 'dialog'
            return activeCatalogRuntimeConfig?.editSurface ?? 'dialog'
        },
        [activeCatalogRuntimeConfig?.copySurface, activeCatalogRuntimeConfig?.createSurface, activeCatalogRuntimeConfig?.editSurface]
    )

    const clearRuntimeFormParams = useCallback(() => {
        const next = new URLSearchParams(searchParams)
        next.delete('surface')
        next.delete('mode')
        next.delete('rowId')
        setSearchParams(next, { replace: true })
    }, [searchParams, setSearchParams])

    const handleOpenCreateSurface = useCallback(() => {
        if (!showCreateButton) {
            clearRuntimeFormParams()
            return
        }

        if (resolveFormSurface('create') === 'page') {
            const next = new URLSearchParams(searchParams)
            next.set('surface', 'page')
            next.set('mode', 'create')
            next.delete('rowId')
            setSearchParams(next)
            return
        }
        state.handleOpenCreate()
    }, [clearRuntimeFormParams, resolveFormSurface, searchParams, setSearchParams, showCreateButton, state])

    const handleOpenEditSurface = useCallback(
        (rowId: string) => {
            if (resolveFormSurface('edit') === 'page') {
                const next = new URLSearchParams(searchParams)
                next.set('surface', 'page')
                next.set('mode', 'edit')
                next.set('rowId', rowId)
                setSearchParams(next)
                return
            }
            state.handleOpenEdit(rowId)
        },
        [resolveFormSurface, searchParams, setSearchParams, state]
    )

    const handleOpenCopySurface = useCallback(
        (rowId: string) => {
            if (resolveFormSurface('copy') === 'page') {
                const next = new URLSearchParams(searchParams)
                next.set('surface', 'page')
                next.set('mode', 'copy')
                next.set('rowId', rowId)
                setSearchParams(next)
                return
            }
            state.handleOpenCopy(rowId)
        },
        [resolveFormSurface, searchParams, setSearchParams, state]
    )

    const handleCloseFormSurface = useCallback(() => {
        clearRuntimeFormParams()
        state.handleCloseForm()
    }, [clearRuntimeFormParams, state])

    useEffect(() => {
        if (searchParams.get('surface') !== 'page') return

        const mode = searchParams.get('mode')
        const rowId = searchParams.get('rowId')

        if (mode === 'create') {
            if (!showCreateButton) {
                if (state.formOpen) {
                    state.handleCloseForm()
                }
                clearRuntimeFormParams()
                return
            }

            if (!state.formOpen) {
                state.handleOpenCreate()
            }
            return
        }

        if ((mode === 'edit' || mode === 'copy') && !rowId) {
            clearRuntimeFormParams()
            return
        }

        if (mode === 'edit' && rowId && (!state.formOpen || state.editRowId !== rowId)) {
            state.handleOpenEdit(rowId)
            return
        }

        if (mode === 'copy' && rowId && (!state.formOpen || state.copyRowId !== rowId)) {
            state.handleOpenCopy(rowId)
        }
    }, [clearRuntimeFormParams, searchParams, showCreateButton, state])

    const previousFormOpenRef = useRef(false)
    useEffect(() => {
        if (previousFormOpenRef.current && !state.formOpen && searchParams.get('surface') === 'page') {
            clearRuntimeFormParams()
        }
        previousFormOpenRef.current = state.formOpen
    }, [clearRuntimeFormParams, searchParams, state.formOpen])

    const runtimeState = useMemo(
        () => ({
            ...state,
            handleOpenCreate: handleOpenCreateSurface,
            handleOpenEdit: handleOpenEditSurface,
            handleOpenCopy: handleOpenCopySurface,
            handleCloseForm: handleCloseFormSurface
        }),
        [handleCloseFormSurface, handleOpenCopySurface, handleOpenCreateSurface, handleOpenEditSurface, state]
    )

    const activeFormSurface =
        searchParams.get('surface') === 'page' && !(searchParams.get('mode') === 'create' && !showCreateButton) ? 'page' : 'dialog'

    // Keep catalogId ref in sync with current catalog from hook state
    catalogIdRef.current = state.selectedCatalogId ?? state.activeCatalogId
    pendingInteractionRef.current = runtimeState.handlePendingInteractionAttempt

    const detailsTitle = state.appData?.catalog?.name ?? 'Details'

    const createActions = useMemo(
        () =>
            showCreateButton ? (
                <Button
                    data-testid='application-runtime-create-row'
                    variant='contained'
                    startIcon={<AddIcon />}
                    onClick={runtimeState.handleOpenCreate}
                    disabled={state.appData?.workspaceLimit?.canCreate === false}
                    sx={{ height: 40, minHeight: 40, borderRadius: 1, flexShrink: 0 }}
                >
                    {t('app.createRow', 'Create')}
                </Button>
            ) : null,
        [runtimeState.handleOpenCreate, showCreateButton, state.appData?.workspaceLimit?.canCreate, t]
    )

    const workspaceLimitBanner = useMemo(
        () =>
            state.appData?.workspaceLimit?.canCreate === false ? (
                <Alert severity='info' data-testid='application-runtime-workspace-limit-banner'>
                    {t('app.workspaceLimitReached', {
                        defaultValue: 'The workspace limit for this catalog has been reached ({{current}} / {{max}}).',
                        current: state.appData.workspaceLimit.currentRows,
                        max: state.appData.workspaceLimit.maxRows ?? '∞'
                    })}
                </Alert>
            ) : null,
        [state.appData?.workspaceLimit, t]
    )

    const details = useMemo<DashboardDetailsSlot>(
        () => ({
            title: detailsTitle,
            banner: workspaceLimitBanner,
            rows: state.rows,
            columns: state.columns,
            loading: state.isFetching,
            rowCount: state.rowCount,
            paginationModel: state.paginationModel,
            onPaginationModelChange: state.setPaginationModel,
            pageSizeOptions: state.pageSizeOptions,
            localeText: state.localeText,
            actions: createActions,
            searchMode: activeCatalogRuntimeConfig?.searchMode ?? 'page-local',
            rowReorder: state.canPersistRowReorder
                ? {
                      onReorder: state.handlePersistRowReorder,
                      isPending: state.isReordering
                  }
                : undefined
        }),
        [
            activeCatalogRuntimeConfig?.searchMode,
            detailsTitle,
            state.rows,
            state.columns,
            state.isFetching,
            state.canPersistRowReorder,
            state.handlePersistRowReorder,
            state.isReordering,
            state.rowCount,
            state.paginationModel,
            state.setPaginationModel,
            state.pageSizeOptions,
            state.localeText,
            createActions,
            workspaceLimitBanner
        ]
    )

    if (!applicationId) {
        return <Alert severity='error'>{t('app.errors.missingApplicationId', 'Application ID is missing in URL')}</Alert>
    }

    if (state.isLoading && !state.appData) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
                <CircularProgress />
            </Box>
        )
    }

    if (state.isError || !state.appData) {
        return <Alert severity='error'>{t('app.errors.loadFailed', 'Failed to load runtime data')}</Alert>
    }

    return (
        <>
            <AppsDashboard
                layoutConfig={state.layoutConfig}
                zoneWidgets={state.appData.zoneWidgets}
                menus={Object.keys(state.menusMap).length > 0 ? state.menusMap : undefined}
                menu={state.menuSlot}
                details={details}
            />

            <CrudDialogs
                state={runtimeState}
                locale={i18n.language}
                apiBaseUrl='/api/v1'
                applicationId={applicationId}
                catalogId={state.selectedCatalogId ?? state.activeCatalogId}
                surface={activeFormSurface}
                labels={{
                    editTitle: t('app.editRow', 'Edit element'),
                    createTitle: t('app.createRecordTitle', 'Create element'),
                    saveText: t('app.save', 'Save'),
                    createText: t('app.create', 'Create'),
                    savingText: t('app.saving', 'Saving...'),
                    creatingText: t('app.creating', 'Creating...'),
                    cancelText: t('app.cancel', 'Cancel'),
                    noFieldsText: t('app.noFields', 'No fields configured for this catalog.'),
                    deleteTitle: t('app.deleteConfirmTitle', 'Delete element?'),
                    deleteDescription: t(
                        'app.deleteConfirmDescription',
                        'This element will be permanently deleted. This action cannot be undone.'
                    ),
                    deleteText: t('app.delete', 'Delete'),
                    deletingText: t('app.deleting', 'Deleting...'),
                    copyTitle: t('app.copyTitle', 'Copy element'),
                    copyText: t('app.copy', 'Copy'),
                    copyingText: t('app.copying', 'Copying...')
                }}
            />

            <RowActionsMenu
                state={runtimeState}
                labels={{
                    editText: t('app.edit', 'Edit'),
                    copyText: t('app.copy', 'Copy'),
                    deleteText: t('app.delete', 'Delete')
                }}
            />
        </>
    )
}

export default ApplicationRuntime
