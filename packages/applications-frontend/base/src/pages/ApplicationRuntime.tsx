import { useMemo, useRef } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Checkbox from '@mui/material/Checkbox'
import AddIcon from '@mui/icons-material/Add'
import { useParams } from 'react-router-dom'
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
import { useUpdateRuntimeCell } from '../api/mutations'

const DEFAULT_PAGE_SIZE = 50

const ApplicationRuntime = () => {
    const { applicationId } = useParams<{ applicationId: string }>()
    const { t, i18n } = useTranslation('applications')

    const adapter = useMemo(() => (applicationId ? createRuntimeAdapter(applicationId) : null), [applicationId])

    // Inline cell mutation for BOOLEAN checkboxes (catalogId passed dynamically)
    const updateCellMutation = useUpdateRuntimeCell({ applicationId })

    // Stabilize cellRenderers — use refs to avoid DataGrid column re-creation on mutation state changes
    const cellMutateRef = useRef(updateCellMutation.mutate)
    cellMutateRef.current = updateCellMutation.mutate
    const isPendingRef = useRef(false)
    isPendingRef.current = updateCellMutation.isPending
    const catalogIdRef = useRef<string | undefined>(undefined)

    // Cell renderer overrides: interactive BOOLEAN checkboxes
    const cellRenderers = useMemo<CellRendererOverrides>(
        () => ({
            BOOLEAN: (params) => (
                <Checkbox
                    disableRipple
                    checked={Boolean(params.value)}
                    indeterminate={false}
                    disabled={isPendingRef.current}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(_, checked) => {
                        cellMutateRef.current({
                            rowId: params.rowId,
                            field: params.field,
                            value: checked,
                            catalogId: catalogIdRef.current
                        })
                    }}
                />
            )
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

    // Keep catalogId ref in sync with current catalog from hook state
    catalogIdRef.current = state.selectedCatalogId ?? state.activeCatalogId

    const detailsTitle = state.appData?.catalog?.name ?? 'Details'

    const createActions = useMemo(
        () => (
            <Button variant='contained' size='small' startIcon={<AddIcon />} onClick={state.handleOpenCreate}>
                {t('app.createRow', 'Create')}
            </Button>
        ),
        [state.handleOpenCreate, t]
    )

    const details = useMemo<DashboardDetailsSlot>(
        () => ({
            title: detailsTitle,
            rows: state.rows,
            columns: state.columns,
            loading: state.isFetching,
            rowCount: state.rowCount,
            paginationModel: state.paginationModel,
            onPaginationModelChange: state.setPaginationModel,
            pageSizeOptions: state.pageSizeOptions,
            localeText: state.localeText,
            actions: createActions
        }),
        [
            detailsTitle,
            state.rows,
            state.columns,
            state.isFetching,
            state.rowCount,
            state.paginationModel,
            state.setPaginationModel,
            state.pageSizeOptions,
            state.localeText,
            createActions
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
                state={state}
                locale={i18n.language}
                apiBaseUrl='/api/v1'
                applicationId={applicationId}
                catalogId={state.selectedCatalogId ?? state.activeCatalogId}
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
                state={state}
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
