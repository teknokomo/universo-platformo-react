import { useMemo } from 'react'
import type { GridColDef } from '@mui/x-data-grid'
import type { TFunction } from 'i18next'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import type { CustomizedDataGridRow } from '../../CustomizedDataGrid'
import CustomizedDataGrid from '../../CustomizedDataGrid'
import { getDataGridLocaleText } from '../../../../utils/getDataGridLocale'
import type { InterpretationNetworkFavoritesContextValue } from './InterpretationNetworkFavoritesContext'
import type { InterpretationNetworkFavoriteListItem } from './runtimeInterpretationNetworkFavoritesApi'

type FavoritesGridRow = CustomizedDataGridRow & {
    number: number
    favorite: InterpretationNetworkFavoriteListItem
    structure: string
    location: string
    available: boolean
}

export interface FavoritesWorkspacePanelProps {
    t: TFunction<'interpretationNetwork'>
    locale: string
    favorites: InterpretationNetworkFavoritesContextValue
    onNavigate: InterpretationNetworkFavoritesContextValue['onNavigateFavorite']
}

export function FavoritesWorkspacePanel({ t, locale, favorites, onNavigate }: FavoritesWorkspacePanelProps) {
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
    const isCompact = useMediaQuery(theme.breakpoints.down('xl'))
    const rows = useMemo<FavoritesGridRow[]>(
        () =>
            favorites.items.map((favorite, index) => {
                const path = favorite.cellPath
                    .map((item) => item.label)
                    .filter((label) => label.trim().length > 0)
                    .join(' › ')
                const available = favorite.availability === 'available'
                return {
                    id: favorite.favoriteId,
                    number: index + 1,
                    favorite,
                    structure:
                        (available ? favorite.structureName : null) || t('workspace.favorites.unnamedStructure', 'Unavailable structure'),
                    location: available && path ? path : t('workspace.favorites.unavailableLocation', 'Unavailable cell'),
                    available
                }
            }),
        [favorites.items, t]
    )

    const columns = useMemo<GridColDef[]>(() => {
        const getAvailabilityLabel = (row: FavoritesGridRow) =>
            row.available ? t('workspace.favorites.available', 'Available') : t('workspace.favorites.unavailable', 'Unavailable')
        const renderAvailability = (row: FavoritesGridRow) => {
            const statusLabel = getAvailabilityLabel(row)
            return (
                <Chip
                    size='small'
                    variant={row.available ? 'outlined' : 'filled'}
                    color={row.available ? 'success' : 'default'}
                    aria-label={`${t('workspace.favorites.columns.status', 'Status')}: ${statusLabel}`}
                    label={statusLabel}
                />
            )
        }
        const locationColumn: GridColDef = {
            field: 'location',
            headerName: t('workspace.favorites.columns.location', 'Cell location'),
            flex: 1,
            minWidth: isMobile ? 132 : isCompact ? 160 : 190,
            sortable: false,
            renderCell: (params) => {
                const row = params.row as FavoritesGridRow
                const fullLocation = isCompact && row.available ? `${row.structure} · ${row.location}` : row.location
                const location = isMobile && row.available ? row.location : fullLocation
                const locationContent = row.available ? (
                    <Button
                        type='button'
                        variant='text'
                        size='small'
                        tabIndex={params.hasFocus ? 0 : -1}
                        aria-label={t('workspace.favorites.openLocation', {
                            location: fullLocation,
                            defaultValue: 'Open {{location}}'
                        })}
                        title={isMobile ? fullLocation : undefined}
                        onClick={() =>
                            onNavigate(row.favorite as Extract<InterpretationNetworkFavoriteListItem, { availability: 'available' }>)
                        }
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'stretch',
                            width: '100%',
                            maxWidth: '100%',
                            minWidth: 0,
                            height: 'auto',
                            minHeight: 0,
                            justifyContent: 'flex-start',
                            textAlign: 'left',
                            textTransform: 'none',
                            whiteSpace: 'normal',
                            lineHeight: 1.4,
                            overflowWrap: 'anywhere'
                        }}
                    >
                        <Box
                            component='span'
                            sx={{
                                display: 'block',
                                width: '100%',
                                minWidth: 0,
                                whiteSpace: 'normal',
                                overflowWrap: 'anywhere'
                            }}
                        >
                            {location}
                        </Box>
                    </Button>
                ) : (
                    <Typography variant='body2' sx={{ color: 'text.secondary', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                        {row.location}
                    </Typography>
                )
                return isMobile ? (
                    <Stack spacing={0.5} sx={{ minWidth: 0, width: '100%', alignItems: 'stretch' }}>
                        {locationContent}
                        {renderAvailability(row)}
                    </Stack>
                ) : (
                    locationContent
                )
            }
        }
        const statusColumn: GridColDef = {
            field: 'available',
            headerName: t('workspace.favorites.columns.status', 'Status'),
            width: isCompact ? 96 : 112,
            sortable: false,
            renderCell: (params) => {
                const row = params.row as FavoritesGridRow
                return renderAvailability(row)
            }
        }
        const actionsColumn: GridColDef = {
            field: 'actions',
            headerName: t('workspace.favorites.columns.actions', 'Actions'),
            width: 96,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            renderCell: (params) => {
                const row = params.row as FavoritesGridRow
                const label = row.available
                    ? t('workspace.favorites.removeLocation', {
                          location: row.location,
                          defaultValue: 'Remove {{location}} from favorites'
                      })
                    : t('workspace.favorites.removeUnavailable', 'Remove unavailable favorite')
                return (
                    <IconButton
                        type='button'
                        size='small'
                        color='error'
                        tabIndex={params.hasFocus ? 0 : -1}
                        aria-label={label}
                        disabled={favorites.isMutationPending}
                        onClick={() => void favorites.removeFavorite(row.id)}
                    >
                        <DeleteOutlineRoundedIcon fontSize='small' />
                    </IconButton>
                )
            }
        }

        const numberColumn: GridColDef = {
            field: 'number',
            headerName: '#',
            width: isCompact ? 40 : 56,
            sortable: false,
            filterable: false
        }

        if (isMobile) return [locationColumn, actionsColumn]
        if (isCompact) return [locationColumn, statusColumn, actionsColumn]

        return [
            numberColumn,
            {
                field: 'structure',
                headerName: t('workspace.favorites.columns.structure', 'Structure'),
                flex: 0.8,
                minWidth: 130,
                sortable: false
            },
            locationColumn,
            statusColumn,
            actionsColumn
        ]
    }, [favorites, isCompact, isMobile, onNavigate, t])

    const localeText = useMemo(() => ({ ...getDataGridLocaleText(locale), ...favorites.localeText }), [favorites.localeText, locale])

    return (
        <Stack spacing={1.5} sx={{ minWidth: 0, width: '100%' }}>
            {favorites.isError ? <Alert severity='error'>{t('workspace.favorites.loadError', 'Could not load favorites.')}</Alert> : null}
            {favorites.items.length === 0 && favorites.isLoading ? (
                <Typography role='status' variant='body2' sx={{ color: 'text.secondary' }}>
                    {t('workspace.favorites.loading', 'Loading favorites...')}
                </Typography>
            ) : null}
            {favorites.items.length === 0 && !favorites.isLoading && !favorites.isError ? (
                <Alert severity='info'>{t('workspace.favorites.empty', 'No favorites yet.')}</Alert>
            ) : null}
            {favorites.items.length > 0 ? (
                <Box sx={{ minWidth: 0, width: '100%', height: { xs: 360, sm: 460 }, maxWidth: '100%' }}>
                    <CustomizedDataGrid
                        rows={rows}
                        columns={columns}
                        loading={favorites.isLoading}
                        localeText={localeText}
                        rowHeight='auto'
                        pageSizeOptions={[10, 20, 50]}
                        fillHeight
                    />
                </Box>
            ) : null}
            {favorites.hasNextPage ? (
                <Button
                    type='button'
                    size='small'
                    variant='outlined'
                    disabled={favorites.isFetchingNextPage}
                    onClick={favorites.loadMore}
                    sx={{ alignSelf: 'flex-start' }}
                >
                    {favorites.isFetchingNextPage
                        ? t('workspace.favorites.loadingMore', 'Loading more...')
                        : t('workspace.favorites.loadMore', 'Load more favorites')}
                </Button>
            ) : null}
        </Stack>
    )
}
