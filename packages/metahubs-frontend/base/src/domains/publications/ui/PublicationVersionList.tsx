import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import FileUploadIcon from '@mui/icons-material/FileUpload'
import { CheckCircle as ActiveIcon } from '@mui/icons-material'
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
    PaginationControls,
    useListDialogs
} from '@universo/template-mui'
import { ViewHeaderMUI as ViewHeader } from '@universo/template-mui'
import { EntityFormDialog } from '@universo/template-mui/components/dialogs'

import { usePublicationVersionListData } from '../hooks/usePublicationVersionListData'
import type { VersionTableRow } from '../hooks/usePublicationVersionListData'
import { usePublicationDetails } from '../hooks/usePublicationDetails'
import { useUpdatePublication } from '../hooks/mutations'
import {
    useCreatePublicationVersion,
    useUpdatePublicationVersion,
    useActivatePublicationVersion,
    useDeletePublicationVersion,
    useImportSnapshotVersion
} from '../hooks/versionMutations'
import type { VersionedLocalizedContent } from '@universo/types'
import { getVLCString } from '../../../types'
import { extractLocalizedInput } from '../../../utils/localizedInput'
import type { PublicationVersion } from '../api'
import { exportPublicationVersion } from '../api'
import type { Publication } from '../api'
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
import { ImportSnapshotDialog } from './ImportSnapshotDialog'

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export const PublicationVersionList: React.FC = () => {
    const navigate = useNavigate()
    const { t, i18n } = useTranslation(['metahubs', 'common'])
    const { t: tc } = useCommonTranslations()
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const preferredVlcLocale = useMetahubPrimaryLocale()
    const updatePublicationMutation = useUpdatePublication()

    const {
        metahubId,
        publicationId,
        rawVersions,
        versions,
        isLoading,
        error,
        branches,
        defaultBranchId,
        getBranchLabel,
        searchValue,
        handleSearchChange,
        filteredVersions,
        paginatedVersions,
        paginationState,
        paginationActions
    } = usePublicationVersionListData()

    // ── Parent publication query for Settings dialog ───────────────
    const { data: publicationData } = usePublicationDetails(metahubId!, publicationId!)

    // ── Settings dialog state ──────────────────────────────────────────
    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)

    // ── Tab navigation ─────────────────────────────────────────────────
    const handlePublicationTabChange = useCallback(
        (_event: unknown, nextTab: string) => {
            if (nextTab === 'applications' && metahubId && publicationId) {
                navigate(`/metahub/${metahubId}/publication/${publicationId}/applications`)
            } else if (nextTab === 'settings') {
                setSettingsDialogOpen(true)
            }
        },
        [navigate, metahubId, publicationId]
    )

    // ── Mutations ──────────────────────────────────────────────────────
    const createMutation = useCreatePublicationVersion()
    const updateMutation = useUpdatePublicationVersion()
    const activateMutation = useActivatePublicationVersion()
    const deleteMutation = useDeletePublicationVersion()
    const importVersionMutation = useImportSnapshotVersion()

    // ── Dialog states ──────────────────────────────────────────────────
    const { dialogs, openCreate, openEdit, openDelete, close } = useListDialogs<PublicationVersion>()
    const [activateDialogOpen, setActivateDialogOpen] = useState<string | null>(null)
    const [importDialogOpen, setImportDialogOpen] = useState(false)
    const [exportingVersionId, setExportingVersionId] = useState<string | null>(null)

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
        if (dialogs.create.open && defaultBranchId) {
            setCreateBranchId(defaultBranchId)
        }
    }, [dialogs.create.open, defaultBranchId])

    // ── Handlers (declared before columns so they can be used in deps) ─
    const handleCloseCreateDialog = useCallback(() => {
        close('create')
        setNameVlc(null)
        setDescriptionVlc(null)
        setCreateBranchId('')
    }, [close])

    const handleOpenEditDialog = useCallback(
        (version: PublicationVersion) => {
            openEdit(version)
            setEditNameVlc(version.name)
            setEditDescriptionVlc(version.description)
        },
        [openEdit]
    )

    const handleCloseEditDialog = useCallback(() => {
        close('edit')
        setEditNameVlc(null)
        setEditDescriptionVlc(null)
    }, [close])

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
        if (!dialogs.edit.item || !metahubId || !publicationId) return
        const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(editNameVlc)
        if (!nameInput || !namePrimaryLocale) return

        const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(editDescriptionVlc)

        updateMutation.mutate(
            {
                metahubId,
                publicationId,
                versionId: dialogs.edit.item.id,
                data: {
                    name: nameInput,
                    namePrimaryLocale,
                    description: descriptionInput,
                    descriptionPrimaryLocale
                }
            },
            { onSuccess: () => handleCloseEditDialog() }
        )
    }, [dialogs.edit.item, metahubId, publicationId, editNameVlc, editDescriptionVlc, updateMutation, handleCloseEditDialog])

    const handleActivate = useCallback(() => {
        if (!activateDialogOpen || !metahubId || !publicationId) return
        activateMutation.mutate(
            { metahubId, publicationId, versionId: activateDialogOpen },
            { onSuccess: () => setActivateDialogOpen(null) }
        )
    }, [activateDialogOpen, metahubId, publicationId, activateMutation])

    const handleDelete = useCallback(() => {
        if (!dialogs.delete.item || !metahubId || !publicationId) return
        deleteMutation.mutate(
            { metahubId, publicationId, versionId: dialogs.delete.item.id },
            {
                onSuccess: () => close('delete')
            }
        )
    }, [dialogs.delete.item, metahubId, publicationId, deleteMutation, close])

    const handleExportVersion = useCallback(
        async (versionId: string) => {
            if (!metahubId || !publicationId) return
            setExportingVersionId(versionId)
            try {
                await exportPublicationVersion(metahubId, publicationId, versionId)
            } catch {
                enqueueSnackbar(t('metahubs:export.exportError'), { variant: 'error' })
            } finally {
                setExportingVersionId(null)
            }
        },
        [metahubId, publicationId, enqueueSnackbar, t]
    )

    const handleImportVersionConfirm = useCallback(
        async (file: File) => {
            if (!metahubId || !publicationId) return
            let json: unknown
            try {
                const text = await file.text()
                json = JSON.parse(text)
            } catch {
                enqueueSnackbar(t('metahubs:export.invalidJson'), { variant: 'error' })
                return
            }
            importVersionMutation.mutate(
                { metahubId, publicationId, envelopeJson: json },
                {
                    onSuccess: () => {
                        setImportDialogOpen(false)
                        enqueueSnackbar(t('metahubs:export.importVersionSuccess'), { variant: 'success' })
                    },
                    onError: () => {
                        enqueueSnackbar(t('metahubs:export.importError'), { variant: 'error' })
                    }
                }
            )
        },
        [metahubId, publicationId, importVersionMutation, enqueueSnackbar, t]
    )

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
                        searchValue={searchValue}
                        onSearchChange={handleSearchChange}
                        searchPlaceholder={t('metahubs:publications.versions.searchPlaceholder', 'Search versions...')}
                    >
                        <ToolbarControls
                            primaryAction={{
                                label: tc('create'),
                                onClick: openCreate,
                                startIcon: <AddRoundedIcon />
                            }}
                            primaryActionMenuItems={[
                                {
                                    label: t('metahubs:export.importVersion'),
                                    onClick: () => setImportDialogOpen(true),
                                    startIcon: <FileUploadIcon />
                                }
                            ]}
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
                            <Tab value='settings' label={t('settings.title')} />
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
                                onClick: openCreate
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
            <Dialog open={dialogs.create.open} onClose={handleCloseCreateDialog} maxWidth='sm' fullWidth>
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
            <Dialog open={dialogs.edit.open} onClose={handleCloseEditDialog} maxWidth='sm' fullWidth>
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
                            value={getBranchLabel(dialogs.edit.item?.branchId)}
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
                    <ListItemIcon>
                        <EditIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>{tc('actions.edit')}</ListItemText>
                </MenuItem>
                {menuRow && !menuRow.isActive && (
                    <MenuItem
                        onClick={() => {
                            if (menuRowId) setActivateDialogOpen(menuRowId)
                            handleMenuClose()
                        }}
                    >
                        <ListItemIcon>
                            <PlayArrowIcon fontSize='small' />
                        </ListItemIcon>
                        <ListItemText>{t('metahubs:publications.versions.activate', 'Activate')}</ListItemText>
                    </MenuItem>
                )}
                <MenuItem
                    disabled={exportingVersionId === menuRowId}
                    onClick={() => {
                        if (menuRowId) void handleExportVersion(menuRowId)
                        handleMenuClose()
                    }}
                >
                    <ListItemIcon>
                        <FileDownloadIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>{t('metahubs:export.exportVersion')}</ListItemText>
                </MenuItem>
                <Divider />
                <MenuItem
                    disabled={menuRow?.isActive}
                    onClick={() => {
                        if (menuRawVersion && !menuRow?.isActive) {
                            openDelete(menuRawVersion)
                        }
                        handleMenuClose()
                    }}
                    sx={{ color: menuRow?.isActive ? undefined : 'error.main' }}
                >
                    <ListItemIcon>
                        <DeleteIcon fontSize='small' sx={{ color: menuRow?.isActive ? undefined : 'error.main' }} />
                    </ListItemIcon>
                    <ListItemText>{tc('actions.delete')}</ListItemText>
                </MenuItem>
            </Menu>

            {/* ── Delete Confirm Dialog ─────────────────────────────────── */}
            <Dialog open={dialogs.delete.open} onClose={() => close('delete')}>
                <DialogTitle>{t('metahubs:publications.versions.delete', 'Delete version')}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {t(
                            'metahubs:publications.versions.deleteConfirm',
                            'Are you sure you want to delete this version? This action cannot be undone.'
                        )}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => close('delete')}>{tc('cancel')}</Button>
                    <Button onClick={handleDelete} variant='contained' color='error' disabled={deleteMutation.isPending}>
                        {tc('actions.delete')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ── Publication Settings edit dialog ────────────────────── */}
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
                            tabs={buildPubFormTabs(settingsCtx, metahubId!)}
                            validate={(values: Record<string, any>) => validatePublicationForm(settingsCtx, values)}
                            canSave={canSavePublicationForm}
                            onSave={(data: Record<string, any>) => {
                                const payload = pubToPayload(data)
                                void settingsCtx.api.updateEntity(publicationData.id, payload)
                            }}
                            onClose={() => setSettingsDialogOpen(false)}
                        />
                    )
                })()}

            <ImportSnapshotDialog
                open={importDialogOpen}
                onClose={() => setImportDialogOpen(false)}
                onConfirm={handleImportVersionConfirm}
                isLoading={importVersionMutation.isPending}
                error={importVersionMutation.error?.message}
                title={t('metahubs:export.importVersion')}
                confirmLabel={t('metahubs:export.importVersion')}
            />
        </MainCard>
    )
}
