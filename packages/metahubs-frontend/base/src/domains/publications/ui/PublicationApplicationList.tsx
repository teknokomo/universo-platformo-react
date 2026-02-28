import { useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    Box,
    Skeleton,
    Stack,
    Tabs,
    Tab,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormControlLabel,
    Switch,
    Alert,
    IconButton,
    Menu,
    MenuItem,
    Divider,
    ListItemIcon,
    ListItemText,
    Typography
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import DashboardIcon from '@mui/icons-material/Dashboard'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'

// project imports
import {
    TemplateMainCard as MainCard,
    ToolbarControls,
    EmptyListState,
    APIEmptySVG,
    FlowListTable,
    LocalizedInlineField,
    useDebouncedSearch,
    PaginationControls
} from '@universo/template-mui'
import type { FlowListTableData } from '@universo/template-mui'
import { ViewHeaderMUI as ViewHeader } from '@universo/template-mui'

import { usePublicationDetails } from '../hooks/usePublicationDetails'
import { usePublicationApplications } from '../hooks/usePublicationApplications'
import { useCreatePublicationApplication } from '../hooks/applicationMutations'
import type { VersionedLocalizedContent } from '@universo/types'
import { getVLCString } from '../../../types'
import { extractLocalizedInput } from '../../../utils/localizedInput'
import type { LinkedApplication } from '../api'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface ApplicationTableRow extends FlowListTableData {
    id: string
    name: string
    description: string | null
    slug: string
    createdAt: string
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export const PublicationApplicationList: React.FC = () => {
    const navigate = useNavigate()
    const { metahubId, publicationId } = useParams<{ metahubId: string; publicationId: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common'])
    const { t: tc } = useCommonTranslations()

    // ── Publication header context ──────────────────────────────────────
    const { data: publication } = usePublicationDetails(metahubId!, publicationId!)
    const publicationName = publication ? getVLCString(publication.name, i18n.language) || '' : ''

    // ── Tab navigation ─────────────────────────────────────────────────
    const handlePublicationTabChange = useCallback(
        (_event: unknown, nextTab: string) => {
            if (nextTab === 'versions' && metahubId && publicationId) {
                navigate(`/metahub/${metahubId}/publication/${publicationId}/versions`)
            }
        },
        [navigate, metahubId, publicationId]
    )

    // ── Data query ─────────────────────────────────────────────────────
    const { data: appsResponse, isLoading, error } = usePublicationApplications(metahubId!, publicationId!)
    const rawApps = useMemo<LinkedApplication[]>(() => appsResponse?.items ?? [], [appsResponse])

    // ── Mutations ──────────────────────────────────────────────────────
    const createMutation = useCreatePublicationApplication()

    // ── Dialog state ───────────────────────────────────────────────────
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [nameVlc, setNameVlc] = useState<VersionedLocalizedContent<string> | null>(null)
    const [descriptionVlc, setDescriptionVlc] = useState<VersionedLocalizedContent<string> | null>(null)
    const [createSchema, setCreateSchema] = useState(false)

    // ── Table data ─────────────────────────────────────────────────────
    const applications: ApplicationTableRow[] = useMemo(
        () =>
            rawApps.map((app) => ({
                id: app.id,
                name: getVLCString(app.name, i18n.language) || app.slug || app.id,
                description: app.description ? getVLCString(app.description, i18n.language) || null : null,
                slug: app.slug,
                createdAt: app.createdAt
            })),
        [rawApps, i18n.language]
    )

    // ── Search ─────────────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('')
    const { handleSearchChange } = useDebouncedSearch({ onSearchChange: setSearchQuery, delay: 0 })

    const filteredApplications = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        if (!query) return applications
        return applications.filter((app) => {
            const name = (app.name || '').toLowerCase()
            const slug = (app.slug || '').toLowerCase()
            return name.includes(query) || slug.includes(query)
        })
    }, [applications, searchQuery])

    // ── Row menu state ─────────────────────────────────────────────────
    const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
    const [menuRowId, setMenuRowId] = useState<string | null>(null)

    const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>, rowId: string) => {
        setMenuAnchorEl(event.currentTarget)
        setMenuRowId(rowId)
    }, [])

    const handleMenuClose = useCallback(() => {
        setMenuAnchorEl(null)
        setMenuRowId(null)
    }, [])

    const menuApp = useMemo(() => (menuRowId ? applications.find((a) => a.id === menuRowId) : null), [menuRowId, applications])

    // ── Columns ────────────────────────────────────────────────────────
    const appColumns = useMemo(
        () => [
            {
                id: 'name' as const,
                label: tc('table.name'),
                width: '30%',
                render: (row: ApplicationTableRow) => (
                    <Typography
                        component='a'
                        href={`/a/${row.id}`}
                        target='_blank'
                        rel='noopener noreferrer'
                        sx={{
                            fontSize: 14,
                            fontWeight: 500,
                            textDecoration: 'none',
                            color: 'inherit',
                            '&:hover': {
                                textDecoration: 'underline',
                                color: 'primary.main'
                            }
                        }}
                    >
                        {row.name || '—'}
                    </Typography>
                )
            },
            {
                id: 'description' as const,
                label: tc('table.description'),
                width: '30%',
                render: (row: ApplicationTableRow) => row.description || '—'
            },
            {
                id: 'slug' as const,
                label: t('metahubs:publications.applications.slug', 'Identifier'),
                width: '20%',
                render: (row: ApplicationTableRow) => row.slug || '—'
            },
            {
                id: 'createdAt' as const,
                label: t('metahubs:publications.applications.createdAt', 'Created'),
                width: '20%',
                render: (row: ApplicationTableRow) => new Date(row.createdAt).toLocaleDateString()
            }
        ],
        [t, tc]
    )

    // ── Pagination ───────────────────────────────────────────────────────
    const [page, setPage] = useState(0)
    const [pageSize, setPageSize] = useState(20)

    const paginatedApplications = useMemo(() => {
        const start = page * pageSize
        return filteredApplications.slice(start, start + pageSize)
    }, [filteredApplications, page, pageSize])

    const paginationState = useMemo(() => ({
        currentPage: page + 1,
        pageSize,
        totalItems: filteredApplications.length,
        totalPages: Math.ceil(filteredApplications.length / pageSize),
        hasNextPage: (page + 1) * pageSize < filteredApplications.length,
        hasPreviousPage: page > 0
    }), [page, pageSize, filteredApplications.length])

    const paginationActions = useMemo(() => ({
        goToPage: (p: number) => setPage(p - 1),
        nextPage: () => setPage((prev) => prev + 1),
        previousPage: () => setPage((prev) => Math.max(0, prev - 1)),
        setSearch: () => {},
        setSort: () => {},
        setPageSize: (size: number) => { setPageSize(size); setPage(0) }
    }), [])

    // ── Handlers ───────────────────────────────────────────────────────
    const handleCloseCreateDialog = useCallback(() => {
        setCreateDialogOpen(false)
        setNameVlc(null)
        setDescriptionVlc(null)
        setCreateSchema(false)
    }, [])

    const handleCreate = useCallback(() => {
        if (!metahubId || !publicationId) return
        const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
        const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)

        createMutation.mutate(
            {
                metahubId,
                publicationId,
                data: {
                    name: nameInput,
                    description: descriptionInput,
                    namePrimaryLocale,
                    descriptionPrimaryLocale,
                    createApplicationSchema: createSchema
                }
            },
            { onSuccess: () => handleCloseCreateDialog() }
        )
    }, [metahubId, publicationId, nameVlc, descriptionVlc, createSchema, createMutation, handleCloseCreateDialog])

    // Name validation
    const hasName = nameVlc && nameVlc._primary && nameVlc.locales?.[nameVlc._primary]?.content

    // ── Render ─────────────────────────────────────────────────────────
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
                    title={t('metahubs:errors.connectionFailed', 'Connection failed')}
                    description={t('metahubs:errors.pleaseTryLater', 'Please try again later')}
                />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 1 }}>
                    <ViewHeader
                        title={t('metahubs:publications.applications.title', 'Applications')}
                        search={true}
                        onSearchChange={handleSearchChange}
                        searchPlaceholder={t('metahubs:publications.applications.searchPlaceholder', 'Search applications...')}
                    >
                        <ToolbarControls
                            primaryAction={{
                                label: tc('create'),
                                onClick: () => setCreateDialogOpen(true),
                                startIcon: <AddRoundedIcon />
                            }}
                        />
                    </ViewHeader>

                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
                        <Tabs
                            value='applications'
                            onChange={handlePublicationTabChange}
                            textColor='primary'
                            indicatorColor='primary'
                            sx={{
                                minHeight: 40,
                                '& .MuiTab-root': { minHeight: 40, textTransform: 'none' }
                            }}
                        >
                            <Tab value='versions' label={t('metahubs:publications.versions.title', 'Versions')} />
                            <Tab value='applications' label={t('metahubs:publications.applications.title', 'Applications')} />
                        </Tabs>
                    </Box>

                    {isLoading ? (
                        <Box sx={{ px: 2 }}>
                            <Skeleton variant='rectangular' height={200} />
                        </Box>
                    ) : applications.length === 0 ? (
                        <EmptyListState
                            image={APIEmptySVG}
                            imageAlt={t('metahubs:publications.applications.empty', 'No applications')}
                            title={t('metahubs:publications.applications.empty', 'No applications linked yet')}
                            description={t(
                                'metahubs:publications.applications.emptyDescription',
                                'Create an application to start using published data'
                            )}
                            action={{
                                label: tc('create'),
                                onClick: () => setCreateDialogOpen(true)
                            }}
                        />
                    ) : (
                        <>
                            <Box sx={{ mx: { xs: -1.5, md: -2 } }}>
                                <FlowListTable
                                    data={paginatedApplications}
                                    customColumns={appColumns}
                                    isLoading={isLoading}
                                    renderActions={(row: any) => (
                                        <IconButton
                                            size='small'
                                            sx={{ width: 28, height: 28, p: 0.5 }}
                                            onClick={(e: React.MouseEvent<HTMLElement>) => handleMenuOpen(e, row.id)}
                                        >
                                            <MoreVertIcon fontSize='small' />
                                        </IconButton>
                                    )}
                                />
                            </Box>
                            {filteredApplications.length > 0 && (
                                <Box sx={{ mx: { xs: -1.5, md: -2 }, mt: 2 }}>
                                    <PaginationControls
                                        pagination={paginationState}
                                        actions={paginationActions}
                                        isLoading={isLoading}
                                        rowsPerPageOptions={[10, 20, 50, 100]}
                                        namespace='common'
                                    />
                                </Box>
                            )}
                        </>
                    )}
                </Stack>
            )}

            {/* ── Create Application Dialog ─────────────────────────────── */}
            <Dialog open={createDialogOpen} onClose={handleCloseCreateDialog} maxWidth='sm' fullWidth>
                <DialogTitle>{t('metahubs:publications.applications.createTitle', 'Create Application')}</DialogTitle>
                <DialogContent sx={{ overflow: 'visible' }}>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <LocalizedInlineField
                            mode='localized'
                            label={tc('table.name')}
                            value={nameVlc}
                            onChange={setNameVlc}
                            uiLocale={i18n.language}
                            required
                        />
                        <LocalizedInlineField
                            mode='localized'
                            label={tc('table.description')}
                            value={descriptionVlc}
                            onChange={setDescriptionVlc}
                            uiLocale={i18n.language}
                            multiline
                            rows={3}
                        />
                        <FormControlLabel
                            control={<Switch checked={createSchema} onChange={(e) => setCreateSchema(e.target.checked)} />}
                            label={t('metahubs:publications.create.createApplicationSchema', 'Create application schema')}
                        />
                        {createSchema && (
                            <Alert severity='info'>
                                {t(
                                    'metahubs:publications.create.applicationWillBeCreated',
                                    'An application with the same name and a connector linked to the Metahub will be created.'
                                )}
                            </Alert>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 3, pt: 2, justifyContent: 'flex-end', gap: 1 }}>
                    <Button onClick={handleCloseCreateDialog}>{tc('cancel')}</Button>
                    <Button onClick={handleCreate} variant='contained' disabled={!hasName || createMutation.isPending}>
                        {tc('create')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ── Row Actions Menu ──────────────────────────────────────── */}
            <Menu
                anchorEl={menuAnchorEl}
                open={Boolean(menuAnchorEl)}
                onClose={handleMenuClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <MenuItem
                    onClick={() => {
                        if (menuApp) window.open(`/a/${menuApp.id}`, '_blank')
                        handleMenuClose()
                    }}
                >
                    <ListItemIcon><OpenInNewIcon fontSize='small' /></ListItemIcon>
                    <ListItemText>{t('metahubs:publications.applications.openApp', 'Open application')}</ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        if (menuApp) window.open(`/a/${menuApp.id}/admin`, '_blank')
                        handleMenuClose()
                    }}
                >
                    <ListItemIcon><DashboardIcon fontSize='small' /></ListItemIcon>
                    <ListItemText>{t('metahubs:publications.applications.appDashboard', 'Application dashboard')}</ListItemText>
                </MenuItem>
            </Menu>
        </MainCard>
    )
}
