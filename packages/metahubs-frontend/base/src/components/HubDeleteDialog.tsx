import { useMemo } from 'react'
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CompactListTable, type TableColumn } from '@universo/template-mui'
import type { Hub } from '../types'
import { getVLCString } from '../types'
import { getBlockingCatalogs, type BlockingHubObject } from '../domains/hubs'
import { metahubsQueryKeys } from '../domains/shared'

export interface HubDeleteDialogProps {
    /** Whether the dialog is open */
    open: boolean
    /** The hub to be deleted */
    hub: Hub | null
    /** Metahub ID for the API call */
    metahubId: string
    /** Callback when dialog is closed */
    onClose: () => void
    /** Callback when delete is confirmed */
    onConfirm: (hub: Hub) => void
    /** Whether delete operation is in progress */
    isDeleting?: boolean
    /** Current UI locale for catalog name display */
    uiLocale?: string
}

/** Internal type for table rows with resolved name */
interface BlockingHubObjectRow extends BlockingHubObject {
    displayName: string
}

/**
 * Dialog for confirming hub deletion.
 * Shows grouped blocking entities (catalogs + enumerations) and disables delete when blockers exist.
 */
export const HubDeleteDialog = ({
    open,
    hub,
    metahubId,
    onClose,
    onConfirm,
    isDeleting = false,
    uiLocale = 'en'
}: HubDeleteDialogProps) => {
    const { t } = useTranslation('metahubs')
    const hubId = hub?.id ?? ''
    const columns: TableColumn<BlockingHubObjectRow>[] = useMemo(
        () => [
            {
                id: 'index',
                label: '#',
                width: 48,
                align: 'center',
                render: (_row, index) => <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{index + 1}</Typography>
            },
            {
                id: 'name',
                label: t('table.name', 'Название'),
                render: (row) => <Typography sx={{ fontSize: 14, fontWeight: 500, wordBreak: 'break-word' }}>{row.displayName}</Typography>
            },
            {
                id: 'codename',
                label: t('hubs.codename', 'Codename'),
                width: 160,
                align: 'left',
                render: (row) => (
                    <Typography variant='body2' color='text.secondary' fontFamily='monospace' noWrap>
                        {row.codename}
                    </Typography>
                )
            }
        ],
        [t]
    )

    const blockingQuery = useQuery({
        queryKey: metahubsQueryKeys.blockingCatalogs(metahubId, hubId),
        queryFn: () => getBlockingCatalogs(metahubId, hubId),
        enabled: open && Boolean(hubId),
        retry: false,
        refetchOnWindowFocus: open ? 'always' : false
    })

    const blockingCatalogs: BlockingHubObjectRow[] = useMemo(() => {
        const source = blockingQuery.data?.blockingCatalogs ?? []
        return source.map((entity) => ({
            ...entity,
            displayName: getVLCString(entity.name, uiLocale) || getVLCString(entity.name, 'en') || entity.codename || '—'
        }))
    }, [blockingQuery.data?.blockingCatalogs, uiLocale])

    const blockingEnumerations: BlockingHubObjectRow[] = useMemo(() => {
        const source = blockingQuery.data?.blockingEnumerations ?? []
        return source.map((entity) => ({
            ...entity,
            displayName: getVLCString(entity.name, uiLocale) || getVLCString(entity.name, 'en') || entity.codename || '—'
        }))
    }, [blockingQuery.data?.blockingEnumerations, uiLocale])

    const totalBlocking = blockingCatalogs.length + blockingEnumerations.length
    const isLoading = blockingQuery.isLoading || blockingQuery.isFetching
    const error = blockingQuery.isError ? t('hubs.deleteDialog.fetchError', 'Failed to check for blocking entities') : null
    const canDelete = !isLoading && !error && totalBlocking === 0

    const handleConfirm = () => {
        if (hub && canDelete) {
            onConfirm(hub)
        }
    }

    const getCatalogLink = (catalog: BlockingHubObjectRow) => `/metahub/${metahubId}/catalog/${catalog.id}/attributes`
    const getEnumerationLink = (enumeration: BlockingHubObjectRow) => `/metahub/${metahubId}/enumeration/${enumeration.id}/values`

    if (!hub) return null

    return (
        <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
            <DialogTitle>{t('hubs.deleteDialog.title', 'Удалить хаб')}</DialogTitle>
            <DialogContent dividers>
                {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : error ? (
                    <Alert severity='error' sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                ) : totalBlocking > 0 ? (
                    <>
                        <Alert severity='warning' sx={{ mb: 2 }}>
                            {t(
                                'hubs.deleteDialog.hasBlockingObjects',
                                'Нельзя удалить хаб. Следующие объекты требуют хотя бы один хаб и привязаны только к этому:'
                            )}
                        </Alert>

                        {blockingCatalogs.length > 0 && (
                            <Box sx={{ mb: 2 }}>
                                <Typography variant='subtitle2' sx={{ mb: 1, fontWeight: 600 }}>
                                    {t('hubs.deleteDialog.sections.catalogs', 'Каталоги')}
                                </Typography>
                                <CompactListTable<BlockingHubObjectRow>
                                    data={blockingCatalogs}
                                    maxHeight={180}
                                    getRowLink={getCatalogLink}
                                    linkMode='all-cells'
                                    columns={columns}
                                />
                            </Box>
                        )}

                        {blockingEnumerations.length > 0 && (
                            <Box sx={{ mb: 2 }}>
                                <Typography variant='subtitle2' sx={{ mb: 1, fontWeight: 600 }}>
                                    {t('hubs.deleteDialog.sections.enumerations', 'Перечисления')}
                                </Typography>
                                <CompactListTable<BlockingHubObjectRow>
                                    data={blockingEnumerations}
                                    maxHeight={180}
                                    getRowLink={getEnumerationLink}
                                    linkMode='all-cells'
                                    columns={columns}
                                />
                            </Box>
                        )}

                        <Typography variant='body2' color='text.secondary'>
                            {t(
                                'hubs.deleteDialog.resolutionHint',
                                'Чтобы удалить этот хаб, сначала добавьте другой хаб к этим каталогам и перечислениям или отключите опцию "Должен быть хаб".'
                            )}
                        </Typography>
                    </>
                ) : (
                    <Typography>
                        {t('hubs.deleteDialog.confirmMessage', 'Вы уверены, что хотите удалить этот хаб? Это действие нельзя отменить.')}
                    </Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isDeleting}>
                    {t('common:actions.cancel', 'Отмена')}
                </Button>
                <Button onClick={handleConfirm} color='error' variant='contained' disabled={!canDelete || isDeleting}>
                    {isDeleting ? t('common:actions.deleting', 'Удаление...') : t('common:actions.delete', 'Удалить')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default HubDeleteDialog
