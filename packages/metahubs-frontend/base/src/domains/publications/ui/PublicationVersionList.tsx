import { useState, useMemo, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    Box,
    Skeleton,
    Stack,
    Chip,
    Tabs,
    Tab,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormHelperText,
    TextField,
    Tooltip,
    IconButton,
    Menu,
    Divider,
    ListItemIcon,
    ListItemText
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { CheckCircle as ActiveIcon } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useQuery } from '@tanstack/react-query'

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

import { usePublicationVersions } from '../hooks/usePublicationVersions'
import { usePublicationDetails } from '../hooks/usePublicationDetails'
import { useCreatePublicationVersion, useUpdatePublicationVersion, useActivatePublicationVersion, useDeletePublicationVersion } from '../hooks/versionMutations'
import { listBranchOptions } from '../../branches/api/branches'
import type { VersionedLocalizedContent } from '@universo/types'
import { getVLCString } from '../../../types'
import { extractLocalizedInput } from '../../../utils/localizedInput'
import type { PublicationVersion } from '../api'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface VersionTableRow extends FlowListTableData {
    id: string
    name: string
    versionNumber: number
    description: string | null
    isActive: boolean
    createdAt: string
    branchLabel: string
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export const PublicationVersionList: React.FC = () => {
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
            if (nextTab === 'applications' && metahubId && publicationId) {
                navigate(`/metahub/${metahubId}/publication/${publicationId}/applications`)
            }
        },
        [navigate, metahubId, publicationId]
    )

    // ── Data queries ───────────────────────────────────────────────────
    const { data: versionsResponse, isLoading, error } = usePublicationVersions(metahubId!, publicationId!)
    const rawVersions = useMemo<PublicationVersion[]>(() => versionsResponse?.items ?? [], [versionsResponse])

    // Branches for labels and create dialog
    const { data: branchesResponse } = useQuery({
        queryKey: ['metahub-branches', 'options', 'publication-versions-page', metahubId],
        queryFn: () => listBranchOptions(metahubId!, { sortBy: 'name', sortOrder: 'asc' }),
        enabled: Boolean(metahubId)
    })
    const branches = useMemo(() => branchesResponse?.items ?? [], [branchesResponse])
    const defaultBranchId = branchesResponse?.meta?.defaultBranchId ?? branches[0]?.id ?? null

    const getBranchLabel = useCallback(
        (branchId?: string | null) => {
            if (!branchId) return ''
            const branch = branches.find((b) => b.id === branchId)
            if (!branch) return t('metahubs:publications.versions.branchMissing', 'Deleted branch')
            const name = getVLCString(branch.name, i18n.language) || getVLCString(branch.name, 'en') || branch.codename
            return `${name} (${branch.codename})`
        },
        [branches, i18n.language, t]
    )

    // ── Mutations ──────────────────────────────────────────────────────
    const createMutation = useCreatePublicationVersion()
    const updateMutation = useUpdatePublicationVersion()
    const activateMutation = useActivatePublicationVersion()
    const deleteMutation = useDeletePublicationVersion()

    // ── Dialog states ──────────────────────────────────────────────────
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [activateDialogOpen, setActivateDialogOpen] = useState<string | null>(null)
    const [editDialogOpen, setEditDialogOpen] = useState<PublicationVersion | null>(null)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null)

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

    // Create form state
    const [nameVlc, setNameVlc] = useState<VersionedLocalizedContent<string> | null>(null)
    const [descriptionVlc, setDescriptionVlc] = useState<VersionedLocalizedContent<string> | null>(null)
    const [createBranchId, setCreateBranchId] = useState<string>('')

    // Edit form state
    const [editNameVlc, setEditNameVlc] = useState<VersionedLocalizedContent<string> | null>(null)
    const [editDescriptionVlc, setEditDescriptionVlc] = useState<VersionedLocalizedContent<string> | null>(null)

    // Auto-select default branch when create dialog opens
    useEffect(() => {
        if (createDialogOpen && defaultBranchId) {
            setCreateBranchId(defaultBranchId)
        }
    }, [createDialogOpen, defaultBranchId])

    // ── Handlers (declared before columns so they can be used in deps) ─
    const handleCloseCreateDialog = useCallback(() => {
        setCreateDialogOpen(false)
        setNameVlc(null)
        setDescriptionVlc(null)
        setCreateBranchId('')
    }, [])

    const handleOpenEditDialog = useCallback((version: PublicationVersion) => {
        setEditDialogOpen(version)
        setEditNameVlc(version.name)
        setEditDescriptionVlc(version.description)
    }, [])

    const handleCloseEditDialog = useCallback(() => {
        setEditDialogOpen(null)
        setEditNameVlc(null)
        setEditDescriptionVlc(null)
    }, [])

    // ── Table data ─────────────────────────────────────────────────────
    const versions: VersionTableRow[] = useMemo(
        () =>
            rawVersions.map((v) => ({
                id: v.id,
                name: getVLCString(v.name, i18n.language) || `Version ${v.versionNumber}`,
                versionNumber: v.versionNumber,
                description: getVLCString(v.description, i18n.language) || null,
                isActive: v.isActive,
                createdAt: v.createdAt,
                branchLabel: getBranchLabel(v.branchId)
            })),
        [rawVersions, i18n.language, getBranchLabel]
    )

    // ── Search ─────────────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('')
    const { handleSearchChange } = useDebouncedSearch({ onSearchChange: setSearchQuery, delay: 0 })

    const filteredVersions = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        if (!query) return versions
        return versions.filter((v) => {
            const name = (v.name || '').toLowerCase()
            return name.includes(query) || `v${v.versionNumber}`.includes(query)
        })
    }, [versions, searchQuery])

    // ── Columns ────────────────────────────────────────────────────────
    const versionColumns = useMemo(
        () => [
            {
                id: 'version' as const,
                label: t('metahubs:publications.versions.list.version', 'Version'),
                width: '15%',
                render: (row: VersionTableRow) => (
                    <Chip
                        label={`v${row.versionNumber}`}
                        size='small'
                        color={row.isActive ? 'primary' : 'default'}
                        variant={row.isActive ? 'filled' : 'outlined'}
                        icon={row.isActive ? <ActiveIcon /> : undefined}
                    />
                )
            },
            {
                id: 'name' as const,
                label: tc('table.name'),
                width: '35%',
                render: (row: VersionTableRow) => row.name || '—'
            },
            {
                id: 'createdAt' as const,
                label: t('metahubs:publications.versions.list.date', 'Date'),
                width: '20%',
                render: (row: VersionTableRow) => new Date(row.createdAt).toLocaleDateString()
            },
            {
                id: 'status' as const,
                label: t('metahubs:publications.versions.list.status', 'Status'),
                width: '20%',
                render: (row: VersionTableRow) =>
                    row.isActive ? <Chip label={t('metahubs:publications.versions.active', 'Active')} size='small' color='success' /> : null
            }
        ],
        [t, tc]
    )

    // ── Pagination ─────────────────────────────────────────────────────────────
    const [page, setPage] = useState(0)
    const [pageSize, setPageSize] = useState(20)

    const paginatedVersions = useMemo(() => {
        const start = page * pageSize
        return filteredVersions.slice(start, start + pageSize)
    }, [filteredVersions, page, pageSize])

    const paginationState = useMemo(() => ({
        currentPage: page + 1,
        pageSize,
        totalItems: filteredVersions.length,
        totalPages: Math.ceil(filteredVersions.length / pageSize),
        hasNextPage: (page + 1) * pageSize < filteredVersions.length,
        hasPreviousPage: page > 0
    }), [page, pageSize, filteredVersions.length])

    const paginationActions = useMemo(() => ({
        goToPage: (p: number) => setPage(p - 1),
        nextPage: () => setPage((prev) => prev + 1),
        previousPage: () => setPage((prev) => Math.max(0, prev - 1)),
        setSearch: () => {},
        setSort: () => {},
        setPageSize: (size: number) => { setPageSize(size); setPage(0) }
    }), [])

    const handleCreate = useCallback(() => {
        if (!metahubId || !publicationId) return
        const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
        if (!nameInput || !namePrimaryLocale) return

        const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)

        const branchId = createBranchId || defaultBranchId || undefined

        createMutation.mutate(
            {
                metahubId,
                publicationId,
                data: {
                    name: nameInput,
                    namePrimaryLocale,
                    description: descriptionInput,
                    descriptionPrimaryLocale,
                    branchId
                }
            },
            { onSuccess: () => handleCloseCreateDialog() }
        )
    }, [metahubId, publicationId, nameVlc, descriptionVlc, createBranchId, defaultBranchId, createMutation, handleCloseCreateDialog])

    const handleUpdate = useCallback(() => {
        if (!editDialogOpen || !metahubId || !publicationId) return
        const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(editNameVlc)
        if (!nameInput || !namePrimaryLocale) return

        const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(editDescriptionVlc)

        updateMutation.mutate(
            {
                metahubId,
                publicationId,
                versionId: editDialogOpen.id,
                data: {
                    name: nameInput,
                    namePrimaryLocale,
                    description: descriptionInput,
                    descriptionPrimaryLocale
                }
            },
            { onSuccess: () => handleCloseEditDialog() }
        )
    }, [editDialogOpen, metahubId, publicationId, editNameVlc, editDescriptionVlc, updateMutation, handleCloseEditDialog])

    const handleActivate = useCallback(() => {
        if (!activateDialogOpen || !metahubId || !publicationId) return
        activateMutation.mutate(
            { metahubId, publicationId, versionId: activateDialogOpen },
            { onSuccess: () => setActivateDialogOpen(null) }
        )
    }, [activateDialogOpen, metahubId, publicationId, activateMutation])

    const handleDelete = useCallback(() => {
        if (!deleteDialogOpen || !metahubId || !publicationId) return
        deleteMutation.mutate(
            { metahubId, publicationId, versionId: deleteDialogOpen },
            { onSuccess: () => setDeleteDialogOpen(null) }
        )
    }, [deleteDialogOpen, metahubId, publicationId, deleteMutation])

    // Helpers for the row menu
    const menuRow = useMemo(() => (menuRowId ? versions.find((v) => v.id === menuRowId) : null), [menuRowId, versions])
    const menuRawVersion = useMemo(() => (menuRowId ? rawVersions.find((v) => v.id === menuRowId) : null), [menuRowId, rawVersions])

    // Name validation
    const hasName = nameVlc && nameVlc._primary && nameVlc.locales?.[nameVlc._primary]?.content
    const hasEditName = editNameVlc && editNameVlc._primary && editNameVlc.locales?.[editNameVlc._primary]?.content

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
                        title={t('metahubs:publications.versions.title', 'Versions')}
                        search={true}
                        onSearchChange={handleSearchChange}
                        searchPlaceholder={t('metahubs:publications.versions.searchPlaceholder', 'Search versions...')}
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
                            value='versions'
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
                    ) : versions.length === 0 ? (
                        <EmptyListState
                            image={APIEmptySVG}
                            imageAlt={t('metahubs:publications.versions.empty', 'No versions')}
                            title={t('metahubs:publications.versions.empty', 'No versions')}
                            description={t('metahubs:publications.versions.emptyDescription', 'Create a version to get started')}
                            action={{
                                label: tc('create'),
                                onClick: () => setCreateDialogOpen(true)
                            }}
                        />
                    ) : (
                        <>
                            <Box sx={{ mx: { xs: -1.5, md: -2 } }}>
                                <FlowListTable
                                    data={paginatedVersions}
                                    customColumns={versionColumns}
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
                            {filteredVersions.length > 0 && (
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

            {/* ── Create Version Dialog ─────────────────────────────────── */}
            <Dialog open={createDialogOpen} onClose={handleCloseCreateDialog} maxWidth='sm' fullWidth>
                <DialogTitle>{t('metahubs:publications.versions.create', 'Create version')}</DialogTitle>
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
                        <FormControl fullWidth>
                            <InputLabel id='version-branch-create-label'>{t('metahubs:publications.versions.branch', 'Branch')}</InputLabel>
                            <Select
                                labelId='version-branch-create-label'
                                value={createBranchId || defaultBranchId || ''}
                                label={t('metahubs:publications.versions.branch', 'Branch')}
                                onChange={(e) => setCreateBranchId(e.target.value)}
                            >
                                {branches.map((branch) => (
                                    <MenuItem key={branch.id} value={branch.id}>
                                        {getBranchLabel(branch.id)}
                                    </MenuItem>
                                ))}
                            </Select>
                            <FormHelperText>
                                {t('metahubs:publications.versions.branchHelper', 'Snapshot will be created from the selected branch.')}
                            </FormHelperText>
                        </FormControl>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 3, pt: 2, justifyContent: 'flex-end', gap: 1 }}>
                    <Button onClick={handleCloseCreateDialog}>{tc('cancel')}</Button>
                    <Button onClick={handleCreate} variant='contained' disabled={!hasName || createMutation.isPending}>
                        {tc('create')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ── Activate Confirm Dialog ───────────────────────────────── */}
            <Dialog open={!!activateDialogOpen} onClose={() => setActivateDialogOpen(null)}>
                <DialogTitle>{t('metahubs:publications.versions.activate', 'Activate version')}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {t('metahubs:publications.versions.activateConfirm', 'Are you sure you want to activate this version?')}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setActivateDialogOpen(null)}>{tc('cancel')}</Button>
                    <Button onClick={handleActivate} variant='contained' color='primary' disabled={activateMutation.isPending}>
                        {t('metahubs:publications.versions.activate', 'Activate')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ── Edit Version Dialog ───────────────────────────────────── */}
            <Dialog open={!!editDialogOpen} onClose={handleCloseEditDialog} maxWidth='sm' fullWidth>
                <DialogTitle>{t('metahubs:publications.versions.edit', 'Edit version')}</DialogTitle>
                <DialogContent sx={{ overflow: 'visible' }}>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <LocalizedInlineField
                            mode='localized'
                            label={tc('table.name')}
                            value={editNameVlc}
                            onChange={setEditNameVlc}
                            uiLocale={i18n.language}
                            required
                        />
                        <LocalizedInlineField
                            mode='localized'
                            label={tc('table.description')}
                            value={editDescriptionVlc}
                            onChange={setEditDescriptionVlc}
                            uiLocale={i18n.language}
                            multiline
                            rows={3}
                        />
                        <TextField
                            label={t('metahubs:publications.versions.branch', 'Branch')}
                            value={getBranchLabel(editDialogOpen?.branchId)}
                            fullWidth
                            disabled
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 3, pt: 2, justifyContent: 'flex-end', gap: 1 }}>
                    <Button onClick={handleCloseEditDialog}>{tc('cancel')}</Button>
                    <Button onClick={handleUpdate} variant='contained' disabled={!hasEditName || updateMutation.isPending}>
                        {tc('actions.save')}
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
                        if (menuRawVersion) handleOpenEditDialog(menuRawVersion)
                        handleMenuClose()
                    }}
                >
                    <ListItemIcon><EditIcon fontSize='small' /></ListItemIcon>
                    <ListItemText>{tc('actions.edit')}</ListItemText>
                </MenuItem>
                {menuRow && !menuRow.isActive && (
                    <MenuItem
                        onClick={() => {
                            if (menuRowId) setActivateDialogOpen(menuRowId)
                            handleMenuClose()
                        }}
                    >
                        <ListItemIcon><PlayArrowIcon fontSize='small' /></ListItemIcon>
                        <ListItemText>{t('metahubs:publications.versions.activate', 'Activate')}</ListItemText>
                    </MenuItem>
                )}
                <Divider />
                <MenuItem
                    disabled={menuRow?.isActive}
                    onClick={() => {
                        if (menuRowId && !menuRow?.isActive) {
                            setDeleteDialogOpen(menuRowId)
                        }
                        handleMenuClose()
                    }}
                    sx={{ color: menuRow?.isActive ? undefined : 'error.main' }}
                >
                    <ListItemIcon><DeleteIcon fontSize='small' sx={{ color: menuRow?.isActive ? undefined : 'error.main' }} /></ListItemIcon>
                    <ListItemText>{tc('actions.delete')}</ListItemText>
                </MenuItem>
            </Menu>

            {/* ── Delete Confirm Dialog ─────────────────────────────────── */}
            <Dialog open={!!deleteDialogOpen} onClose={() => setDeleteDialogOpen(null)}>
                <DialogTitle>{t('metahubs:publications.versions.delete', 'Delete version')}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {t('metahubs:publications.versions.deleteConfirm', 'Are you sure you want to delete this version? This action cannot be undone.')}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(null)}>{tc('cancel')}</Button>
                    <Button onClick={handleDelete} variant='contained' color='error' disabled={deleteMutation.isPending}>
                        {tc('actions.delete')}
                    </Button>
                </DialogActions>
            </Dialog>
        </MainCard>
    )
}
