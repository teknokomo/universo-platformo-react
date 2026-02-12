import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Box,
    Button,
    Chip,
    Typography,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Stack,
    Paper,
    IconButton,
    Tooltip,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormHelperText,
    TextField
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import EditIcon from '@mui/icons-material/Edit'
import { CheckCircle as ActiveIcon } from '@mui/icons-material'
import { CompactListTable, LocalizedInlineField } from '@universo/template-mui'
import type { TableColumn, FlowListTableData } from '@universo/template-mui'
import { useSnackbar } from 'notistack'
import { apiClient } from '../../shared'
import type { VersionedLocalizedContent } from '@universo/types'
import { getVLCString } from '../../../types'
import { extractLocalizedInput } from '../../../utils/localizedInput'
import { listBranchOptions } from '../../branches/api/branches'
import { metahubsQueryKeys } from '../../shared'

// Types
interface PublicationVersion {
    id: string
    versionNumber: number
    name: VersionedLocalizedContent<string>
    description: VersionedLocalizedContent<string> | null
    isActive: boolean
    createdAt: string
    createdBy: string
    branchId?: string | null
}

interface VersionTableRow extends FlowListTableData {
    id: string
    name: string
    versionNumber: number
    description: string | null
    isActive: boolean
    createdAt: string
}

interface CreateVersionPayload {
    name: Record<string, string>
    description?: Record<string, string>
    namePrimaryLocale: string
    descriptionPrimaryLocale?: string
    branchId?: string
}

export const VersionsPanel: React.FC<{ metahubId: string; publicationId: string }> = ({ metahubId, publicationId }) => {
    const { t, i18n } = useTranslation('metahubs')
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [activateDialogOpen, setActivateDialogOpen] = useState<string | null>(null)
    const [editDialogOpen, setEditDialogOpen] = useState<PublicationVersion | null>(null)

    // Localized form state for create
    const [nameVlc, setNameVlc] = useState<VersionedLocalizedContent<string> | null>(null)
    const [descriptionVlc, setDescriptionVlc] = useState<VersionedLocalizedContent<string> | null>(null)
    const [createBranchId, setCreateBranchId] = useState<string>('')

    // Localized form state for edit
    const [editNameVlc, setEditNameVlc] = useState<VersionedLocalizedContent<string> | null>(null)
    const [editDescriptionVlc, setEditDescriptionVlc] = useState<VersionedLocalizedContent<string> | null>(null)

    const { data: branchesResponse } = useQuery({
        queryKey: ['metahub-branches', 'options', 'publication-versions', metahubId],
        queryFn: () => listBranchOptions(metahubId, { sortBy: 'name', sortOrder: 'asc' }),
        enabled: Boolean(metahubId)
    })

    const branches = branchesResponse?.items ?? []
    const defaultBranchId = branchesResponse?.meta?.defaultBranchId ?? branches[0]?.id ?? null

    const getBranchLabel = (branchId?: string | null) => {
        if (!branchId) return ''
        const branch = branches.find((item) => item.id === branchId)
        if (!branch) {
            return `${t('publications.versions.branchMissing', 'Удалённая ветка')} (${branchId})`
        }
        const name = getVLCString(branch.name, i18n.language) || getVLCString(branch.name, 'en') || branch.codename
        return `${name} (${branch.codename})`
    }

    useEffect(() => {
        if (createDialogOpen) {
            setCreateBranchId(defaultBranchId ?? '')
        }
    }, [createDialogOpen, defaultBranchId])

    // Fetch versions
    const { data: rawVersions = [], isLoading } = useQuery<PublicationVersion[]>({
        queryKey: ['publication-versions', publicationId],
        queryFn: async () => {
            const url = `/metahub/${metahubId}/publication/${publicationId}/versions`
            const res = await apiClient.get<{ items: PublicationVersion[] }>(url)
            return res.data?.items || []
        }
    })

    // Transform for CompactListTable compatibility
    const versions: VersionTableRow[] = rawVersions.map((v) => ({
        id: v.id,
        name: getVLCString(v.name, i18n.language) || `Version ${v.versionNumber}`,
        versionNumber: v.versionNumber,
        description: getVLCString(v.description, i18n.language) || null,
        isActive: v.isActive,
        createdAt: v.createdAt
    }))

    // Create version mutation
    const createMutation = useMutation({
        mutationFn: async (payload: CreateVersionPayload) => {
            const response = await apiClient.post<{ isDuplicate?: boolean }>(
                `/metahub/${metahubId}/publication/${publicationId}/versions`,
                payload
            )
            return response.data
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['publication-versions', publicationId] })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(metahubId) })
            enqueueSnackbar(t('publications.versions.createSuccess', 'Версия создана'), { variant: 'success' })
            if (data?.isDuplicate) {
                enqueueSnackbar(t('publications.versions.duplicateWarning', 'Версия совпадает с предыдущей'), {
                    variant: 'warning'
                })
            }
            handleCloseCreateDialog()
        },
        onError: () => {
            enqueueSnackbar(t('publications.versions.createError', 'Ошибка создания версии'), { variant: 'error' })
        }
    })

    // Activate version mutation
    const activateMutation = useMutation({
        mutationFn: async (versionId: string) => {
            await apiClient.post(`/metahub/${metahubId}/publication/${publicationId}/versions/${versionId}/activate`)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['publication-versions', publicationId] })
            queryClient.invalidateQueries({ queryKey: ['publication', publicationId] })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(metahubId) })
            enqueueSnackbar(t('publications.versions.activateSuccess', 'Version activated'), { variant: 'success' })
            setActivateDialogOpen(null)
        }
    })

    // Update version mutation
    const updateMutation = useMutation({
        mutationFn: async ({ versionId, payload }: { versionId: string; payload: CreateVersionPayload }) => {
            await apiClient.patch(`/metahub/${metahubId}/publication/${publicationId}/versions/${versionId}`, payload)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['publication-versions', publicationId] })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(metahubId) })
            enqueueSnackbar(t('publications.versions.updateSuccess', 'Version updated'), { variant: 'success' })
            handleCloseEditDialog()
        },
        onError: () => {
            enqueueSnackbar(t('publications.versions.updateError', 'Failed to update version'), { variant: 'error' })
        }
    })

    const handleCloseCreateDialog = () => {
        setCreateDialogOpen(false)
        setNameVlc(null)
        setDescriptionVlc(null)
    }

    const handleOpenEditDialog = (version: PublicationVersion) => {
        setEditDialogOpen(version)
        setEditNameVlc(version.name)
        setEditDescriptionVlc(version.description)
    }

    const handleCloseEditDialog = () => {
        setEditDialogOpen(null)
        setEditNameVlc(null)
        setEditDescriptionVlc(null)
    }

    const handleCreate = () => {
        const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
        if (!nameInput || !namePrimaryLocale) return

        const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)

        const payload: CreateVersionPayload = {
            name: nameInput,
            namePrimaryLocale,
            description: descriptionInput,
            descriptionPrimaryLocale
        }
        const effectiveBranchId = createBranchId || defaultBranchId || undefined
        if (effectiveBranchId) {
            payload.branchId = effectiveBranchId
        }

        createMutation.mutate(payload)
    }

    const handleActivate = () => {
        if (activateDialogOpen) {
            activateMutation.mutate(activateDialogOpen)
        }
    }

    const handleUpdate = () => {
        if (!editDialogOpen) return

        const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(editNameVlc)
        if (!nameInput || !namePrimaryLocale) return

        const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(editDescriptionVlc)

        const payload: CreateVersionPayload = {
            name: nameInput,
            namePrimaryLocale,
            description: descriptionInput,
            descriptionPrimaryLocale
        }

        updateMutation.mutate({ versionId: editDialogOpen.id, payload })
    }

    // Check if name has content
    const hasName = nameVlc && nameVlc._primary && nameVlc.locales?.[nameVlc._primary]?.content
    const hasEditName = editNameVlc && editNameVlc._primary && editNameVlc.locales?.[editNameVlc._primary]?.content

    // Table columns
    const columns: TableColumn<VersionTableRow>[] = [
        {
            id: 'version',
            label: t('publications.versions.list.version', 'Версия'),
            width: '20%',
            render: (row) => (
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
            id: 'name',
            label: t('publications.table.name', 'Название'),
            width: '40%',
            render: (row) => row.name
        },
        {
            id: 'createdAt',
            label: t('publications.versions.list.date', 'Дата'),
            width: '20%',
            render: (row) => new Date(row.createdAt).toLocaleDateString()
        }
    ]

    return (
        <Box>
            {/* Header with Add button - same pattern as EntitySelectionPanel */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant='subtitle1' fontWeight={500}>
                    {t('publications.versions.title', 'Версии')}
                </Typography>
                <Button size='small' startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
                    {t('publications.versions.addButton', 'Добавить')}
                </Button>
            </Box>

            {/* Versions table or empty state */}
            {!isLoading && versions.length === 0 ? (
                <Paper variant='outlined' sx={{ p: 3, textAlign: 'center', mb: 2, bgcolor: 'action.hover' }}>
                    <Typography color='text.secondary'>{t('publications.versions.empty', 'Версий нет')}</Typography>
                </Paper>
            ) : (
                <Box sx={{ mb: 2 }}>
                    <CompactListTable<VersionTableRow>
                        data={versions}
                        columns={columns}
                        renderRowAction={(row) => {
                            const rawVersion = rawVersions.find((v) => v.id === row.id)
                            return (
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                    <Tooltip title={t('common:actions.edit', 'Edit')}>
                                        <IconButton size='small' onClick={() => rawVersion && handleOpenEditDialog(rawVersion)}>
                                            <EditIcon fontSize='small' />
                                        </IconButton>
                                    </Tooltip>
                                    {!row.isActive && (
                                        <Tooltip title={t('publications.versions.activate', 'Activate')}>
                                            <IconButton size='small' onClick={() => setActivateDialogOpen(row.id)} color='primary'>
                                                <PlayArrowIcon fontSize='small' />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                </Box>
                            )
                        }}
                        maxHeight={200}
                    />
                </Box>
            )}

            {/* Create Dialog with Localized Fields */}
            <Dialog open={createDialogOpen} onClose={handleCloseCreateDialog} maxWidth='sm' fullWidth>
                <DialogTitle>{t('publications.versions.create', 'Create version')}</DialogTitle>
                <DialogContent sx={{ overflow: 'visible' }}>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <LocalizedInlineField
                            mode='localized'
                            label={t('publications.table.name', 'Название')}
                            value={nameVlc}
                            onChange={setNameVlc}
                            uiLocale={i18n.language}
                            required
                        />
                        <LocalizedInlineField
                            mode='localized'
                            label={t('publications.table.description', 'Описание')}
                            value={descriptionVlc}
                            onChange={setDescriptionVlc}
                            uiLocale={i18n.language}
                            multiline
                            rows={3}
                        />
                        <FormControl fullWidth>
                            <InputLabel id='publication-version-branch-create'>
                                {t('publications.versions.branchLabel', 'Ветка для версии')}
                            </InputLabel>
                            <Select
                                labelId='publication-version-branch-create'
                                value={createBranchId || defaultBranchId || ''}
                                label={t('publications.versions.branchLabel', 'Ветка для версии')}
                                onChange={(event) => setCreateBranchId(event.target.value)}
                            >
                                {branches.map((branch) => (
                                    <MenuItem key={branch.id} value={branch.id}>
                                        {getBranchLabel(branch.id)}
                                    </MenuItem>
                                ))}
                            </Select>
                            <FormHelperText>
                                {t('publications.versions.branchHelper', 'Снапшот версии будет создан на основе выбранной ветки.')}
                            </FormHelperText>
                        </FormControl>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 3, pt: 2, justifyContent: 'flex-end', gap: 1 }}>
                    <Button onClick={handleCloseCreateDialog}>{t('common.cancel', 'Отмена')}</Button>
                    <Button onClick={handleCreate} variant='contained' disabled={!hasName || createMutation.isPending}>
                        {t('common.create', 'Создать')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Activate Confirm Dialog */}
            <Dialog open={!!activateDialogOpen} onClose={() => setActivateDialogOpen(null)}>
                <DialogTitle>{t('publications.versions.activate', 'Activate version')}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {t('publications.versions.activateConfirm', 'Are you sure you want to activate this version?')}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setActivateDialogOpen(null)}>{t('common.cancel', 'Cancel')}</Button>
                    <Button onClick={handleActivate} variant='contained' color='primary'>
                        {t('publications.versions.activate', 'Activate')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Edit Dialog with Localized Fields */}
            <Dialog open={!!editDialogOpen} onClose={handleCloseEditDialog} maxWidth='sm' fullWidth>
                <DialogTitle>{t('publications.versions.edit', 'Edit version')}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <LocalizedInlineField
                            mode='localized'
                            label={t('publications.table.name', 'Name')}
                            value={editNameVlc}
                            onChange={setEditNameVlc}
                            uiLocale={i18n.language}
                            required
                        />
                        <LocalizedInlineField
                            mode='localized'
                            label={t('publications.table.description', 'Description')}
                            value={editDescriptionVlc}
                            onChange={setEditDescriptionVlc}
                            uiLocale={i18n.language}
                            multiline
                            rows={3}
                        />
                        <TextField
                            label={t('publications.versions.branchLabel', 'Ветка для версии')}
                            value={getBranchLabel(editDialogOpen?.branchId)}
                            fullWidth
                            disabled
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 3, pt: 2, justifyContent: 'flex-end', gap: 1 }}>
                    <Button onClick={handleCloseEditDialog}>{t('common.cancel', 'Cancel')}</Button>
                    <Button onClick={handleUpdate} variant='contained' disabled={!hasEditName || updateMutation.isPending}>
                        {t('common:actions.save', 'Save')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}
