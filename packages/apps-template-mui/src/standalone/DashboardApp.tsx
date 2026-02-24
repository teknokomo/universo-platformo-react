import { useMemo } from 'react'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import { useTranslation } from 'react-i18next'
import Dashboard from '../dashboard/Dashboard'
import type { DashboardDetailsSlot } from '../dashboard/Dashboard'
import AppMainLayout from '../layouts/AppMainLayout'
import { createStandaloneAdapter } from '../api/adapters'
import { useCrudDashboard } from '../hooks/useCrudDashboard'
import { CrudDialogs } from '../components/CrudDialogs'
import { RowActionsMenu } from '../components/RowActionsMenu'

export interface DashboardAppProps {
    applicationId: string
    locale: string
    apiBaseUrl: string
}

export default function DashboardApp(props: DashboardAppProps) {
    const { t } = useTranslation('apps')

    const adapter = useMemo(
        () => createStandaloneAdapter({ apiBaseUrl: props.apiBaseUrl, applicationId: props.applicationId }),
        [props.apiBaseUrl, props.applicationId]
    )

    const state = useCrudDashboard({ adapter, locale: props.locale })

    const detailsTitle = state.appData?.catalog.name ?? 'Details'

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
            loading: state.isLoading,
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
            state.isLoading,
            state.rowCount,
            state.paginationModel,
            state.setPaginationModel,
            state.pageSizeOptions,
            state.localeText,
            createActions
        ]
    )

    if (!props.applicationId) {
        return (
            <Box sx={{ p: 3 }}>
                <Typography variant='body2'>Missing applicationId</Typography>
            </Box>
        )
    }

    return (
        <AppMainLayout>
            <Dashboard layoutConfig={state.layoutConfig} zoneWidgets={state.appData?.zoneWidgets} menu={state.menuSlot} details={details} />

            <CrudDialogs
                state={state}
                locale={props.locale}
                apiBaseUrl={props.apiBaseUrl}
                applicationId={props.applicationId}
                catalogId={state.selectedCatalogId ?? state.activeCatalogId}
                labels={{
                    editTitle: t('app.editRow', 'Edit record'),
                    createTitle: t('app.createRecordTitle', 'Create record'),
                    saveText: t('app.save', 'Save'),
                    createText: t('app.create', 'Create'),
                    savingText: t('app.saving', 'Saving...'),
                    creatingText: t('app.creating', 'Creating...'),
                    cancelText: t('app.cancel', 'Cancel'),
                    noFieldsText: t('app.noFields', 'No fields configured for this catalog.'),
                    deleteTitle: t('app.deleteConfirmTitle', 'Delete record?'),
                    deleteDescription: t(
                        'app.deleteConfirmDescription',
                        'This record will be permanently deleted. This action cannot be undone.'
                    ),
                    deleteText: t('app.delete', 'Delete'),
                    deletingText: t('app.deleting', 'Deleting...')
                }}
            />

            <RowActionsMenu
                state={state}
                labels={{
                    editText: t('app.edit', 'Edit'),
                    deleteText: t('app.delete', 'Delete')
                }}
            />
        </AppMainLayout>
    )
}
