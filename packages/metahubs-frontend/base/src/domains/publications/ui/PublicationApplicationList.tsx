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
    Checkbox,
    Radio,
    RadioGroup,
    IconButton,
    Menu,
    MenuItem,
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
import { useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'

// project imports
import {
    TemplateMainCard as MainCard,
    ToolbarControls,
    EmptyListState,
    APIEmptySVG,
    FlowListTable,
    LocalizedInlineField,
    useDebouncedSearch,
    PaginationControls,
    useListDialogs
} from '@universo/template-mui'
import type { FlowListTableData } from '@universo/template-mui'
import { ViewHeaderMUI as ViewHeader } from '@universo/template-mui'
import {
    EntityFormDialog,
    mergeDialogPaperProps,
    mergeDialogSx,
    resolveDialogMaxWidth,
    useDialogPresentation
} from '@universo/template-mui/components/dialogs'

import { usePublicationApplications } from '../hooks/usePublicationApplications'
import { useCreatePublicationApplication } from '../hooks/applicationMutations'
import { usePublicationDetails } from '../hooks/usePublicationDetails'
import { useUpdatePublication } from '../hooks/mutations'
import type { VersionedLocalizedContent } from '@universo/types'
import { getVLCString } from '../../../types'
import { extractLocalizedInput } from '../../../utils/localizedInput'
import type { LinkedApplication, Publication } from '../api'
import {
    buildInitialValues as buildPubInitialValues,
    buildFormTabs as buildPubFormTabs,
    validatePublicationForm,
    canSavePublicationForm,
    toPayload as pubToPayload
} from './PublicationActions'
import type { PublicationLocalizedPayload } from './PublicationActions'
import { useMetahubPrimaryLocale } from '../../settings/hooks/useMetahubPrimaryLocale'
import { invalidatePublicationSettingsQueries } from './publicationSettingsQueries'

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

const renderDialogTitle = (title: React.ReactNode, actions: React.ReactNode | null) =>
    actions ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, pr: 1 }}>
            <Box component='span' sx={{ minWidth: 0 }}>
                {title}
            </Box>
            {actions}
        </Box>
    ) : (
        title
    )

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export const PublicationApplicationList: React.FC = () => {
    const navigate = useNavigate()
    const { metahubId, publicationId } = useParams<{ metahubId: string; publicationId: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common'])
    const { t: tc } = useCommonTranslations()
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const preferredVlcLocale = useMetahubPrimaryLocale()
    const updatePublicationMutation = useUpdatePublication()

    const { data: publicationData } = usePublicationDetails(metahubId!, publicationId!)

    // ── Tab navigation ─────────────────────────────────────────────────
    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)

    const handlePublicationTabChange = useCallback(
        (_event: unknown, nextTab: string) => {
            if (nextTab === 'versions' && metahubId && publicationId) {
                navigate(`/metahub/${metahubId}/publication/${publicationId}/versions`)
                return
            }

            if (nextTab === 'settings') {
                setSettingsDialogOpen(true)
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
    const { dialogs, openCreate, close } = useListDialogs<{ id: string }>()
    const [nameVlc, setNameVlc] = useState<VersionedLocalizedContent<string> | null>(null)
    const [descriptionVlc, setDescriptionVlc] = useState<VersionedLocalizedContent<string> | null>(null)
    const [createSchema, setCreateSchema] = useState(false)
    const [isPublic, setIsPublic] = useState(false)
    const [workspacesEnabled, setWorkspacesEnabled] = useState(false)

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

    const paginationState = useMemo(
        () => ({
            currentPage: page + 1,
            pageSize,
            totalItems: filteredApplications.length,
            totalPages: Math.ceil(filteredApplications.length / pageSize),
            hasNextPage: (page + 1) * pageSize < filteredApplications.length,
            hasPreviousPage: page > 0
        }),
        [page, pageSize, filteredApplications.length]
    )

    const paginationActions = useMemo(
        () => ({
            goToPage: (p: number) => setPage(p - 1),
            nextPage: () => setPage((prev) => prev + 1),
            previousPage: () => setPage((prev) => Math.max(0, prev - 1)),
            setSearch: () => undefined,
            setSort: () => undefined,
            setPageSize: (size: number) => {
                setPageSize(size)
                setPage(0)
            }
        }),
        []
    )

    // ── Handlers ───────────────────────────────────────────────────────
    const handleCloseCreateDialog = useCallback(() => {
        close('create')
        setNameVlc(null)
        setDescriptionVlc(null)
        setCreateSchema(false)
        setIsPublic(false)
        setWorkspacesEnabled(false)
    }, [close])
    const createDialogPresentation = useDialogPresentation({
        open: dialogs.create.open,
        onClose: handleCloseCreateDialog,
        fallbackMaxWidth: 'sm',
        isBusy: createMutation.isPending
    })

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
                    createApplicationSchema: createSchema,
                    isPublic,
                    workspacesEnabled
                }
            },
            { onSuccess: () => handleCloseCreateDialog() }
        )
    }, [
        metahubId,
        publicationId,
        nameVlc,
        descriptionVlc,
        createSchema,
        isPublic,
        workspacesEnabled,
        createMutation,
        handleCloseCreateDialog
    ])

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
                                onClick: () => openCreate(),
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
                            <Tab value='settings' label={t('settings.title', 'Settings')} />
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
                                onClick: () => openCreate()
                            }}
                        />
                    ) : (
                        <>
                            <Box>
                                <FlowListTable
                                    data={paginatedApplications}
                                    customColumns={appColumns}
                                    isLoading={isLoading}
                                    renderActions={(row: ApplicationTableRow) => (
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
                                <Box sx={{ mt: 2 }}>
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
            <Dialog
                open={dialogs.create.open}
                onClose={createDialogPresentation.dialogProps.onClose}
                maxWidth={resolveDialogMaxWidth(createDialogPresentation.dialogProps.maxWidth, 'sm')}
                fullWidth={createDialogPresentation.dialogProps.fullWidth ?? true}
                disableEscapeKeyDown={createDialogPresentation.dialogProps.disableEscapeKeyDown}
                PaperProps={mergeDialogPaperProps(undefined, createDialogPresentation.dialogProps.PaperProps)}
            >
                <DialogTitle>
                    {renderDialogTitle(
                        t('metahubs:publications.applications.createTitle', 'Create Application'),
                        createDialogPresentation.titleActions
                    )}
                </DialogTitle>
                <DialogContent sx={mergeDialogSx({ overflow: 'visible' }, createDialogPresentation.contentSx)}>
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
                        <RadioGroup
                            value={isPublic ? 'public' : 'closed'}
                            onChange={(event) => {
                                const nextIsPublic = event.target.value === 'public'
                                setIsPublic(nextIsPublic)
                                if (nextIsPublic && !workspacesEnabled) {
                                    setWorkspacesEnabled(true)
                                }
                            }}
                        >
                            <FormControlLabel
                                value='closed'
                                control={<Radio />}
                                label={t('metahubs:publications.applicationParameters.visibility.closed', 'Closed')}
                            />
                            <FormControlLabel
                                value='public'
                                control={<Radio />}
                                label={t('metahubs:publications.applicationParameters.visibility.public', 'Public')}
                            />
                        </RadioGroup>
                        <Alert severity='info'>
                            {t(
                                'metahubs:publications.applicationParameters.visibilityHint',
                                'Application visibility cannot be changed after creation.'
                            )}
                        </Alert>
                        <FormControlLabel
                            control={
                                <Checkbox checked={workspacesEnabled} onChange={(event) => setWorkspacesEnabled(event.target.checked)} />
                            }
                            label={t('metahubs:publications.applicationParameters.workspacesEnabled', 'Add workspaces')}
                        />
                        <Alert severity='info'>
                            {t(
                                'metahubs:publications.applicationParameters.workspacesHint',
                                'Workspace mode cannot be disabled after the application is created.'
                            )}
                        </Alert>
                        {isPublic && !workspacesEnabled ? (
                            <Alert severity='warning'>
                                {t(
                                    'metahubs:publications.applicationParameters.publicWorkspacesRecommended',
                                    'Workspaces are recommended for public applications to isolate each participant data.'
                                )}
                            </Alert>
                        ) : null}
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
                {createDialogPresentation.resizeHandle}
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
                        if (menuApp) window.open(`/a/${menuApp.id}`, '_blank', 'noopener,noreferrer')
                        handleMenuClose()
                    }}
                >
                    <ListItemIcon>
                        <OpenInNewIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>{t('metahubs:publications.applications.openApp', 'Open application')}</ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        if (menuApp) window.open(`/a/${menuApp.id}/admin`, '_blank', 'noopener,noreferrer')
                        handleMenuClose()
                    }}
                >
                    <ListItemIcon>
                        <DashboardIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>{t('metahubs:publications.applications.appDashboard', 'Application dashboard')}</ListItemText>
                </MenuItem>
            </Menu>

            {publicationData &&
                metahubId &&
                publicationId &&
                (() => {
                    const pubDisplay = {
                        id: publicationData.id,
                        name: getVLCString(publicationData.name, preferredVlcLocale) || '',
                        description: getVLCString(publicationData.description, preferredVlcLocale) || '',
                        accessMode: publicationData.accessMode ?? ('full' as const)
                    }
                    const publicationMap = new Map<string, Publication>([[publicationData.id, publicationData]])
                    const settingsCtx = {
                        entity: pubDisplay,
                        entityKind: 'publication' as const,
                        t,
                        publicationMap,
                        uiLocale: preferredVlcLocale,
                        api: {
                            updateEntity: (id: string, patch: PublicationLocalizedPayload) => {
                                if (!metahubId) return Promise.resolve()
                                updatePublicationMutation.mutate({
                                    metahubId,
                                    publicationId: id,
                                    data: { ...patch, expectedVersion: publicationData.version }
                                })

                                return Promise.resolve()
                            }
                        },
                        helpers: {
                            refreshList: async () => {
                                if (metahubId && publicationId) {
                                    await invalidatePublicationSettingsQueries(queryClient, metahubId, publicationId)
                                }
                            },
                            enqueueSnackbar: (payload: {
                                message: string
                                options?: { variant?: 'default' | 'error' | 'success' | 'warning' | 'info' }
                            }) => {
                                if (payload?.message) enqueueSnackbar(payload.message, payload.options)
                            }
                        }
                    }

                    return (
                        <EntityFormDialog
                            open={settingsDialogOpen}
                            mode='edit'
                            title={t('publications.editTitle', 'Edit Publication')}
                            nameLabel={tc('fields.name', 'Name')}
                            descriptionLabel={tc('fields.description', 'Description')}
                            saveButtonText={tc('actions.save', 'Save')}
                            savingButtonText={tc('actions.saving', 'Saving...')}
                            cancelButtonText={tc('actions.cancel', 'Cancel')}
                            hideDefaultFields
                            initialExtraValues={buildPubInitialValues(settingsCtx)}
                            tabs={buildPubFormTabs(settingsCtx, metahubId)}
                            validate={(values: Record<string, unknown>) => validatePublicationForm(settingsCtx, values)}
                            canSave={canSavePublicationForm}
                            onSave={(data: Record<string, unknown>) => {
                                const payload = pubToPayload(data)
                                void settingsCtx.api.updateEntity(publicationData.id, payload)
                            }}
                            onClose={() => setSettingsDialogOpen(false)}
                        />
                    )
                })()}
        </MainCard>
    )
}
