import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    DialogContentText,
    FormControl,
    FormControlLabel,
    IconButton,
    InputLabel,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Select,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography
} from '@mui/material'
import type { SelectChangeEvent } from '@mui/material/Select'
import { APIEmptySVG, EmptyListState, FlowListTable, type FlowListTableData, type TableColumn } from '@universo-react/template-mui'
import { ConfirmDeleteDialog, StandardDialog } from '@universo-react/template-mui/components/dialogs'
import type {
    MetahubPackageAttachment,
    MetahubPackageCatalogItem,
    MetahubPackageRuntimeTarget,
    PackageAttachmentConfig,
    PackageAuthoringSurfaceDescriptor,
    PackageDisplayMode,
    PlayCanvasProjectSummary,
    VersionedLocalizedContent
} from '@universo-react/types'
import { createLocalizedContent } from '@universo-react/utils'
import type { Metahub } from '../../../types'
import { getLocalizedContentText, normalizeLocale } from '../../../utils/localizedInput'
import { useMetahubDetails } from '../../metahubs/hooks'
import { metahubsQueryKeys } from '../../shared'
import { packagesApi, playcanvasProjectsApi } from '../api'

interface PackageTableRow extends FlowListTableData {
    packageName: string
    version: string
    description: string
    upstreamVersion: string
    runtimeTargets: readonly MetahubPackageRuntimeTarget[]
    authoringSurface: PackageAuthoringSurfaceDescriptor
    config: PackageAttachmentConfig
    attached: boolean
    attachmentId: string | null
    versions: string[]
}

interface PackageSettingsDraft {
    row: PackageTableRow
    mode: PackageDisplayMode
    developmentUrl: string
    defaultProjectId: string
    showArtifactOnlyNotice: boolean
    allowedDisplayModes: readonly PackageDisplayMode[]
}

const emptyPackageConfig: PackageAttachmentConfig = {
    schemaVersion: '1',
    kind: 'none'
}

const resolveText = (value: VersionedLocalizedContent<string> | string | null | undefined, locale: string, fallback: string) =>
    getLocalizedContentText(value, locale, fallback)

const sortVersions = (versions: string[]): string[] =>
    [...versions].sort((left, right) => right.localeCompare(left, undefined, { numeric: true, sensitivity: 'base' }))

const resolveDisplayConfig = (config: PackageAttachmentConfig): Extract<PackageAttachmentConfig, { kind: 'display' }> | null =>
    config.kind === 'display' ? config : null

const PLAYCANVAS_EDITOR_PACKAGE_NAME = '@universo-react/playcanvas-editor-frontend'

const formatPackageNameFallback = (packageName: string): string => {
    const unscoped = packageName.split('/').pop() ?? packageName
    return unscoped
        .replace(/^universo-react-?/, '')
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

const buildRows = (items: MetahubPackageCatalogItem[], attachedItems: MetahubPackageAttachment[], locale: string): PackageTableRow[] => {
    const grouped = new Map<string, MetahubPackageCatalogItem[]>()
    const attachmentByPackageName = new Map(attachedItems.map((item) => [item.packageName, item]))

    for (const item of items) {
        grouped.set(item.packageName, [...(grouped.get(item.packageName) ?? []), item])
    }

    return [...grouped.entries()]
        .map(([packageName, packageVersions]) => {
            const versions = sortVersions(packageVersions.map((item) => item.version))
            const attached = packageVersions.find((item) => item.attached) ?? null
            const selected = attached ?? packageVersions.find((item) => item.version === versions[0]) ?? packageVersions[0]
            const attachment = attachmentByPackageName.get(packageName)

            return {
                id: packageName,
                name: resolveText(selected.displayName, locale, formatPackageNameFallback(packageName)),
                packageName,
                version: attached?.attachedVersion ?? selected.version,
                description: resolveText(selected.description ?? null, locale, ''),
                upstreamVersion: selected.source.upstreamVersion,
                runtimeTargets: selected.source.runtimeTargets,
                authoringSurface: selected.authoringSurface,
                config: attachment?.config ?? selected.authoringSurface.defaultConfig ?? emptyPackageConfig,
                attached: Boolean(attached),
                attachmentId: attached?.attachmentId ?? null,
                versions
            }
        })
        .sort((left, right) => left.packageName.localeCompare(right.packageName))
}

const notifyPackageMutationError = (t: TFunction, enqueueSnackbar: ReturnType<typeof useSnackbar>['enqueueSnackbar']) => {
    enqueueSnackbar(t('packages.notifications.mutationFailed', 'Package operation failed. Please refresh and try again.'), {
        variant: 'error'
    })
}

function PlayCanvasProjectsPanel({
    metahubId,
    row,
    canManage,
    locale,
    invalidatePackages
}: {
    metahubId: string
    row: PackageTableRow
    canManage: boolean
    locale: string
    invalidatePackages: () => Promise<void>
}) {
    const { t } = useTranslation(['metahubs', 'common'])
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [createOpen, setCreateOpen] = useState(false)
    const [nameDraft, setNameDraft] = useState('')
    const [createSubmitted, setCreateSubmitted] = useState(false)
    const [pendingDelete, setPendingDelete] = useState<PlayCanvasProjectSummary | null>(null)

    const projectsQuery = useQuery({
        queryKey: metahubsQueryKeys.playcanvasProjects(metahubId),
        queryFn: () => playcanvasProjectsApi.list(metahubId),
        enabled: Boolean(metahubId && row.attached && canManage)
    })

    const invalidateProjects = async () => {
        await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.playcanvasProjects(metahubId) })
    }
    const displayConfig = row.config.kind === 'display' ? row.config : null

    const createMutation = useMutation({
        mutationFn: () =>
            playcanvasProjectsApi.create(metahubId, {
                displayName: createLocalizedContent(locale, nameDraft.trim()),
                description: null,
                packageVersion: row.version
            }),
        onSuccess: async (project) => {
            enqueueSnackbar(t('packages.projects.notifications.created', 'PlayCanvas project created'), { variant: 'success' })
            setCreateOpen(false)
            setNameDraft('')
            setCreateSubmitted(false)
            await invalidateProjects()
            if (row.attachmentId && displayConfig && !displayConfig.playcanvasProject?.defaultProjectId) {
                await packagesApi.updateConfig(metahubId, row.attachmentId, {
                    config: {
                        ...displayConfig,
                        playcanvasProject: { defaultProjectId: project.id }
                    }
                })
                await invalidatePackages()
            }
        },
        onError: () => {
            enqueueSnackbar(t('packages.projects.notifications.createFailed', 'Failed to create PlayCanvas project'), { variant: 'error' })
        }
    })

    const setDefaultMutation = useMutation({
        mutationFn: (projectId: string | null) => {
            if (!row.attachmentId) {
                throw new Error('Package attachment is required')
            }
            if (!displayConfig) {
                throw new Error('Package display settings are required')
            }
            return packagesApi.updateConfig(metahubId, row.attachmentId, {
                config: {
                    ...displayConfig,
                    playcanvasProject: { defaultProjectId: projectId }
                }
            })
        },
        onSuccess: async () => {
            enqueueSnackbar(t('packages.projects.notifications.defaultSaved', 'Default PlayCanvas project saved'), { variant: 'success' })
            await invalidatePackages()
        },
        onError: () => {
            enqueueSnackbar(t('packages.projects.notifications.defaultFailed', 'Failed to save default PlayCanvas project'), {
                variant: 'error'
            })
        }
    })

    const deleteMutation = useMutation({
        mutationFn: (project: PlayCanvasProjectSummary) => playcanvasProjectsApi.remove(metahubId, project.id, project.version),
        onSuccess: async () => {
            enqueueSnackbar(t('packages.projects.notifications.deleted', 'PlayCanvas project deleted'), { variant: 'success' })
            setPendingDelete(null)
            await Promise.all([invalidateProjects(), invalidatePackages()])
        },
        onError: () => {
            enqueueSnackbar(t('packages.projects.notifications.deleteFailed', 'Failed to delete PlayCanvas project'), { variant: 'error' })
        }
    })

    const projects = projectsQuery.data ?? []
    const defaultProjectId = displayConfig?.playcanvasProject?.defaultProjectId ?? ''
    const selectedDefaultExists = defaultProjectId ? projects.some((project) => project.id === defaultProjectId) : true
    const nameError = createSubmitted && nameDraft.trim().length === 0
    const canSubmitCreate = nameDraft.trim().length > 0
    const closeCreateDialog = () => {
        setCreateOpen(false)
        setNameDraft('')
        setCreateSubmitted(false)
    }
    const submitCreate = () => {
        setCreateSubmitted(true)
        if (!canSubmitCreate || createMutation.isPending) return
        createMutation.mutate()
    }

    const statusLabel = (project: PlayCanvasProjectSummary) => {
        if (project.compatibilityStatus !== 'compatible') {
            return t(`packages.projects.compatibility.${project.compatibilityStatus}`, 'Compatibility issue')
        }
        return project.publishable
            ? t('packages.projects.status.ready', 'Ready')
            : t(`packages.projects.status.${project.status}`, 'Needs attention')
    }

    const statusColor = (project: PlayCanvasProjectSummary) => {
        if (project.compatibilityStatus === 'blocked' || project.compatibilityStatus === 'unsupported') {
            return 'error' as const
        }
        if (project.compatibilityStatus === 'needsMigration') {
            return 'warning' as const
        }
        return project.publishable ? ('success' as const) : ('warning' as const)
    }

    return (
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
            <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent='space-between' gap={1}>
                    <Stack spacing={0.5}>
                        <Typography variant='subtitle2'>{t('packages.projects.title', 'PlayCanvas projects')}</Typography>
                        <Typography variant='body2' color='text.secondary'>
                            {t('packages.projects.description', 'Project storage used by the connected PlayCanvas Editor package.')}
                        </Typography>
                    </Stack>
                    {canManage ? (
                        <Button
                            startIcon={<AddRoundedIcon />}
                            variant='outlined'
                            size='small'
                            disabled={createMutation.isPending}
                            onClick={() => {
                                setCreateSubmitted(false)
                                setCreateOpen(true)
                            }}
                        >
                            {t('packages.projects.actions.create', 'Create project')}
                        </Button>
                    ) : null}
                </Stack>

                {!canManage ? (
                    <Alert severity='info'>
                        {t(
                            'packages.projects.readOnly',
                            'Project storage is available to metahub managers. You can view connected packages, but cannot change PlayCanvas projects.'
                        )}
                    </Alert>
                ) : projectsQuery.isLoading ? (
                    <Stack direction='row' spacing={1} alignItems='center'>
                        <CircularProgress size={18} />
                        <Typography variant='body2' color='text.secondary'>
                            {t('packages.projects.loading', 'Loading PlayCanvas projects...')}
                        </Typography>
                    </Stack>
                ) : projectsQuery.isError ? (
                    <Alert severity='error'>{t('packages.projects.loadError', 'Failed to load PlayCanvas projects.')}</Alert>
                ) : projects.length === 0 ? (
                    <EmptyListState
                        image={APIEmptySVG}
                        imageAlt={t('packages.projects.empty.imageAlt', 'No PlayCanvas projects')}
                        title={t('packages.projects.empty.title', 'No PlayCanvas projects yet')}
                        description={t('packages.projects.empty.description', 'Create a project before connecting the Editor bridge.')}
                    />
                ) : (
                    <Stack spacing={1.25}>
                        <FormControl fullWidth>
                            <InputLabel id='playcanvas-default-project-label'>
                                {t('packages.projects.defaultProject', 'Default project')}
                            </InputLabel>
                            <Select
                                labelId='playcanvas-default-project-label'
                                label={t('packages.projects.defaultProject', 'Default project')}
                                value={defaultProjectId}
                                displayEmpty
                                disabled={!canManage || setDefaultMutation.isPending}
                                onChange={(event) => setDefaultMutation.mutate(event.target.value || null)}
                            >
                                <MenuItem value=''>{t('packages.projects.defaultNone', 'No default project')}</MenuItem>
                                {projects.map((project) => (
                                    <MenuItem key={project.id} value={project.id}>
                                        {resolveText(project.displayName, locale, t('packages.projects.unnamed', 'Unnamed project'))}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        {!selectedDefaultExists ? (
                            <Alert severity='warning'>
                                {t('packages.projects.defaultMissing', 'The saved default project is no longer available.')}
                            </Alert>
                        ) : null}
                        {projects.map((project) => (
                            <Box key={project.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                                <Stack
                                    direction={{ xs: 'column', sm: 'row' }}
                                    alignItems={{ sm: 'center' }}
                                    justifyContent='space-between'
                                    gap={1}
                                >
                                    <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                                        <Stack direction='row' spacing={1} flexWrap='wrap' alignItems='center'>
                                            <Typography variant='subtitle2' sx={{ overflowWrap: 'anywhere' }}>
                                                {resolveText(
                                                    project.displayName,
                                                    locale,
                                                    t('packages.projects.unnamed', 'Unnamed project')
                                                )}
                                            </Typography>
                                            {project.id === defaultProjectId ? (
                                                <Chip size='small' color='primary' label={t('packages.projects.defaultChip', 'Default')} />
                                            ) : null}
                                            <Chip size='small' color={statusColor(project)} label={statusLabel(project)} />
                                        </Stack>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t(
                                                'packages.projects.counts',
                                                '{{scenes}} scenes, {{assets}} assets, {{scripts}} scripts, {{artifacts}} generated artifacts',
                                                {
                                                    scenes: project.sceneCount,
                                                    assets: project.assetCount,
                                                    scripts: project.scriptCount,
                                                    artifacts: project.generatedArtifactCount
                                                }
                                            )}
                                        </Typography>
                                    </Stack>
                                    <Tooltip title={t('packages.projects.actions.delete', 'Delete project')}>
                                        <span>
                                            <IconButton
                                                size='small'
                                                disabled={!canManage || deleteMutation.isPending}
                                                aria-label={t('packages.projects.actions.deleteNamed', 'Delete {{projectName}}', {
                                                    projectName: resolveText(
                                                        project.displayName,
                                                        locale,
                                                        t('packages.projects.unnamed', 'Unnamed project')
                                                    )
                                                })}
                                                onClick={() => setPendingDelete(project)}
                                            >
                                                <DeleteOutlineRoundedIcon fontSize='small' />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </Stack>
                            </Box>
                        ))}
                    </Stack>
                )}
            </Stack>

            <StandardDialog
                open={createOpen}
                onClose={closeCreateDialog}
                maxWidth='sm'
                fullWidth
                title={t('packages.projects.dialogs.create.title', 'Create PlayCanvas project')}
                disablePresentationControls
                dialogContentProps={{ sx: { pt: '16px !important' } }}
                actions={
                    <>
                        <Button onClick={closeCreateDialog} disabled={createMutation.isPending}>
                            {t('packages.dialogs.cancel', 'Cancel')}
                        </Button>
                        <Button variant='contained' disabled={createMutation.isPending} type='submit' form='playcanvas-project-create-form'>
                            {t('common:actions.create', 'Create')}
                        </Button>
                    </>
                }
            >
                <Stack
                    id='playcanvas-project-create-form'
                    component='form'
                    noValidate
                    spacing={2}
                    onSubmit={(event) => {
                        event.preventDefault()
                        submitCreate()
                    }}
                    sx={{ pt: 0.5 }}
                >
                    <TextField
                        label={t('packages.projects.fields.name', 'Project name')}
                        value={nameDraft}
                        onChange={(event) => setNameDraft(event.target.value)}
                        fullWidth
                        required
                        error={nameError}
                        helperText={
                            nameError
                                ? t('packages.projects.validation.nameRequired', 'Enter a project name.')
                                : t('packages.projects.fields.nameHelper', 'This name is shown in the metahub package settings.')
                        }
                    />
                </Stack>
            </StandardDialog>
            <ConfirmDeleteDialog
                open={Boolean(pendingDelete)}
                title={t('packages.projects.dialogs.delete.title', 'Delete PlayCanvas project')}
                description={
                    pendingDelete
                        ? t(
                              'packages.projects.dialogs.delete.description',
                              'Delete {{projectName}} and its PlayCanvas project files. Disconnecting the package does not delete projects.',
                              {
                                  projectName: resolveText(
                                      pendingDelete.displayName,
                                      locale,
                                      t('packages.projects.unnamed', 'Unnamed project')
                                  )
                              }
                          )
                        : ''
                }
                confirmButtonText={t('common:actions.delete', 'Delete')}
                deletingButtonText={t('packages.projects.dialogs.delete.deleting', 'Deleting...')}
                cancelButtonText={t('packages.dialogs.cancel', 'Cancel')}
                loading={deleteMutation.isPending}
                onCancel={() => setPendingDelete(null)}
                onConfirm={async () => {
                    if (!pendingDelete) return
                    await deleteMutation.mutateAsync(pendingDelete)
                }}
            />
        </Box>
    )
}

export function MetahubPackagesTab({ metahubId }: { metahubId?: string }) {
    const { t, i18n } = useTranslation(['metahubs', 'common'])
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const locale = normalizeLocale(i18n.language)
    const [versionDrafts, setVersionDrafts] = useState<Record<string, string>>({})
    const [pendingAttach, setPendingAttach] = useState<{ row: PackageTableRow; version: string } | null>(null)
    const [pendingVersionChange, setPendingVersionChange] = useState<{ row: PackageTableRow; version: string } | null>(null)
    const [pendingDetach, setPendingDetach] = useState<PackageTableRow | null>(null)
    const [settingsDraft, setSettingsDraft] = useState<PackageSettingsDraft | null>(null)
    const [actionMenu, setActionMenu] = useState<{ row: PackageTableRow; anchor: HTMLElement } | null>(null)
    const [mutationErrorVisible, setMutationErrorVisible] = useState(false)
    const [versionChangeResetConfig, setVersionChangeResetConfig] = useState(false)

    const metahubDetailsQuery = useMetahubDetails(metahubId ?? '', { enabled: Boolean(metahubId) })
    const cachedMetahub = metahubId ? queryClient.getQueryData<Metahub>(metahubsQueryKeys.detail(metahubId)) : undefined
    const resolvedPermissions = metahubDetailsQuery.data?.permissions ?? cachedMetahub?.permissions
    const permissionsLoading = Boolean(metahubId) && !resolvedPermissions && metahubDetailsQuery.isLoading
    const canManagePackages = resolvedPermissions?.manageMetahub === true

    const catalogQuery = useQuery({
        queryKey: metahubId ? metahubsQueryKeys.packagesCatalog(metahubId) : metahubsQueryKeys.packagesCatalog(''),
        queryFn: () => packagesApi.listCatalog(metahubId ?? ''),
        enabled: Boolean(metahubId)
    })

    const attachedQuery = useQuery({
        queryKey: metahubId ? metahubsQueryKeys.packagesAttached(metahubId) : metahubsQueryKeys.packagesAttached(''),
        queryFn: () => packagesApi.listAttached(metahubId ?? ''),
        enabled: Boolean(metahubId)
    })

    const settingsProjectsQuery = useQuery({
        queryKey: metahubId ? metahubsQueryKeys.playcanvasProjects(metahubId) : metahubsQueryKeys.playcanvasProjects(''),
        queryFn: () => playcanvasProjectsApi.list(metahubId ?? ''),
        enabled: Boolean(
            metahubId && canManagePackages && settingsDraft?.row.attached && settingsDraft.row.authoringSurface.kind === 'playcanvasEditor'
        )
    })

    const invalidatePackages = async () => {
        if (!metahubId) return
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.packagesCatalog(metahubId) }),
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.packagesAttached(metahubId) }),
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(metahubId) })
        ])
    }

    const attachMutation = useMutation({
        mutationFn: ({ packageName, version }: { packageName: string; version: string }) =>
            packagesApi.attach(metahubId ?? '', { packageName, version }),
        onSuccess: async () => {
            setMutationErrorVisible(false)
            enqueueSnackbar(t('packages.notifications.attached', 'Package connected'), { variant: 'success' })
            await invalidatePackages()
        },
        onError: () => {
            setMutationErrorVisible(true)
            notifyPackageMutationError(t, enqueueSnackbar)
        }
    })

    const changeVersionMutation = useMutation({
        mutationFn: ({
            attachmentId,
            version,
            resetConfig
        }: {
            attachmentId: string
            packageName: string
            version: string
            resetConfig?: boolean
        }) => packagesApi.changeVersion(metahubId ?? '', attachmentId, { version, ...(resetConfig ? { resetConfig } : {}) }),
        onSuccess: async () => {
            setMutationErrorVisible(false)
            enqueueSnackbar(t('packages.notifications.versionChanged', 'Package version updated'), { variant: 'success' })
            await invalidatePackages()
        },
        onError: () => {
            setMutationErrorVisible(true)
            notifyPackageMutationError(t, enqueueSnackbar)
        }
    })

    const detachMutation = useMutation({
        mutationFn: ({ attachmentId }: { attachmentId: string }) => packagesApi.detach(metahubId ?? '', attachmentId),
        onSuccess: async () => {
            setMutationErrorVisible(false)
            enqueueSnackbar(t('packages.notifications.detached', 'Package disconnected'), { variant: 'success' })
            await invalidatePackages()
        },
        onError: () => {
            setMutationErrorVisible(true)
            notifyPackageMutationError(t, enqueueSnackbar)
        }
    })

    const updateConfigMutation = useMutation({
        mutationFn: ({ attachmentId, config }: { attachmentId: string; config: PackageAttachmentConfig }) =>
            packagesApi.updateConfig(metahubId ?? '', attachmentId, { config }),
        onSuccess: async () => {
            setMutationErrorVisible(false)
            enqueueSnackbar(t('packages.notifications.settingsSaved', 'Package settings saved'), { variant: 'success' })
            await invalidatePackages()
        },
        onError: () => {
            setMutationErrorVisible(true)
            notifyPackageMutationError(t, enqueueSnackbar)
        }
    })

    const rows = useMemo(
        () => buildRows(catalogQuery.data ?? [], attachedQuery.data ?? [], locale),
        [attachedQuery.data, catalogQuery.data, locale]
    )
    const connectedRows = rows.filter((row) => row.attached)
    const isMutating =
        attachMutation.isPending || changeVersionMutation.isPending || detachMutation.isPending || updateConfigMutation.isPending
    const actionsDisabled = isMutating || permissionsLoading || !canManagePackages

    const resolveDraftVersion = (row: PackageTableRow) => versionDrafts[row.packageName] ?? row.version ?? row.versions[0]

    const handleVersionChange = (row: PackageTableRow) => (event: SelectChangeEvent<string>) => {
        const version = event.target.value
        setVersionDrafts((current) => ({ ...current, [row.packageName]: version }))

        if (row.attached && row.attachmentId && version !== row.version) {
            setVersionChangeResetConfig(false)
            setPendingVersionChange({ row, version })
        }
    }

    const closePendingVersionChange = () => {
        if (pendingVersionChange) {
            setVersionDrafts((current) => ({
                ...current,
                [pendingVersionChange.row.packageName]: pendingVersionChange.row.version
            }))
        }
        setMutationErrorVisible(false)
        setVersionChangeResetConfig(false)
        setPendingVersionChange(null)
    }

    const openPackageSettings = async (row: PackageTableRow) => {
        let config = row.config
        if (row.authoringSurface.kind === 'playcanvasEditor' && metahubId) {
            try {
                const host = await packagesApi.getAuthoringHost(metahubId, row.authoringSurface.packageSlug)
                config = host.attachmentConfig
                const displayConfig = resolveDisplayConfig(config) ?? resolveDisplayConfig(row.authoringSurface.defaultConfig)
                setMutationErrorVisible(false)
                setSettingsDraft({
                    row: { ...row, config },
                    mode: displayConfig?.display.mode ?? 'disabled',
                    developmentUrl: displayConfig?.display.developmentUrl ?? '',
                    defaultProjectId: displayConfig?.playcanvasProject?.defaultProjectId ?? '',
                    showArtifactOnlyNotice: displayConfig?.display.showArtifactOnlyNotice ?? true,
                    allowedDisplayModes: host.allowedDisplayModes
                })
                return
            } catch {
                notifyPackageMutationError(t, enqueueSnackbar)
                return
            }
        }

        const displayConfig = resolveDisplayConfig(config) ?? resolveDisplayConfig(row.authoringSurface.defaultConfig)
        setMutationErrorVisible(false)
        setSettingsDraft({
            row,
            mode: displayConfig?.display.mode ?? 'disabled',
            developmentUrl: displayConfig?.display.developmentUrl ?? '',
            defaultProjectId: displayConfig?.playcanvasProject?.defaultProjectId ?? '',
            showArtifactOnlyNotice: displayConfig?.display.showArtifactOnlyNotice ?? true,
            allowedDisplayModes: row.authoringSurface.supportedDisplayModes
        })
    }

    const resetSettingsDraftToDefaults = () => {
        setSettingsDraft((current) => {
            if (!current) return current
            const displayConfig = resolveDisplayConfig(current.row.authoringSurface.defaultConfig)
            return {
                ...current,
                mode: displayConfig?.display.mode ?? 'disabled',
                developmentUrl: displayConfig?.display.developmentUrl ?? '',
                defaultProjectId: displayConfig?.playcanvasProject?.defaultProjectId ?? '',
                showArtifactOnlyNotice: displayConfig?.display.showArtifactOnlyNotice ?? true
            }
        })
        setMutationErrorVisible(false)
    }

    const buildSettingsConfig = (draft: PackageSettingsDraft): PackageAttachmentConfig => {
        const displayConfig = resolveDisplayConfig(draft.row.config)
        return {
            schemaVersion: '1',
            kind: 'display',
            display: {
                mode: draft.mode,
                developmentUrl: draft.mode === 'developmentUrl' ? draft.developmentUrl.trim() || null : null,
                showArtifactOnlyNotice: draft.showArtifactOnlyNotice
            },
            playcanvasProject:
                draft.row.authoringSurface.kind === 'playcanvasEditor'
                    ? { defaultProjectId: draft.defaultProjectId || null }
                    : displayConfig?.playcanvasProject
        }
    }

    const resolveSettingsValidationError = (draft: PackageSettingsDraft | null): string | null => {
        if (!draft || draft.mode !== 'developmentUrl') {
            return null
        }

        const value = draft.developmentUrl.trim()
        if (!value) {
            return t('packages.settings.validation.developmentUrlRequired', 'Enter a development URL.')
        }

        try {
            const parsed = new URL(value)
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                return t('packages.settings.validation.developmentUrlInvalid', 'Enter a valid http or https URL.')
            }
        } catch {
            return t('packages.settings.validation.developmentUrlInvalid', 'Enter a valid http or https URL.')
        }

        return null
    }

    const openEditor = (row: PackageTableRow) => {
        if (row.authoringSurface.kind !== 'playcanvasEditor' || !metahubId) {
            return
        }
        const displayConfig = resolveDisplayConfig(row.config)
        const view = displayConfig?.display.mode === 'openSeparately' ? '?view=sandboxed-frame' : ''
        window.open(
            `/metahub/${metahubId}/resources/packages/${row.authoringSurface.packageSlug}/editor${view}`,
            '_blank',
            'noopener,noreferrer'
        )
    }

    const getRowActionLabel = (key: string, fallback: string, row: PackageTableRow) => t(key, fallback, { packageName: row.name })

    const packageColumns: TableColumn<PackageTableRow>[] = [
        {
            id: 'position',
            label: '#',
            width: 64,
            align: 'center',
            render: (_row, index) => (
                <Typography variant='body2' color='text.secondary'>
                    {index + 1}
                </Typography>
            )
        },
        {
            id: 'name',
            label: t('packages.columns.package', 'Package'),
            render: (row) => (
                <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                    <Typography variant='subtitle2' sx={{ overflowWrap: 'anywhere' }}>
                        {row.name}
                    </Typography>
                    {row.description ? (
                        <Typography variant='body2' color='text.secondary' sx={{ whiteSpace: 'normal' }}>
                            {row.description}
                        </Typography>
                    ) : null}
                </Stack>
            )
        },
        {
            id: 'version',
            label: t('packages.columns.version', 'Version'),
            width: 180,
            render: (row) => (
                <Select
                    size='small'
                    value={resolveDraftVersion(row)}
                    onChange={handleVersionChange(row)}
                    disabled={actionsDisabled || row.versions.length <= 1}
                    aria-label={t('packages.versionSelectLabel', 'Package version for {{packageName}}', { packageName: row.name })}
                    fullWidth
                >
                    {row.versions.map((version) => (
                        <MenuItem key={version} value={version}>
                            {version}
                        </MenuItem>
                    ))}
                </Select>
            )
        },
        {
            id: 'upstream',
            label: t('packages.columns.upstream', 'Dependency'),
            width: 220,
            render: (row) => (
                <Stack spacing={0.5}>
                    <Typography variant='body2'>{t('packages.upstream.pinnedVersion', 'Pinned upstream version')}</Typography>
                    <Typography variant='caption' color='text.secondary'>
                        {row.upstreamVersion}
                    </Typography>
                </Stack>
            )
        },
        {
            id: 'targets',
            label: t('packages.columns.surface', 'Surface'),
            width: 180,
            render: (row) => (
                <Stack direction='row' flexWrap='wrap' gap={0.5}>
                    {row.runtimeTargets.length > 0
                        ? row.runtimeTargets.map((target) => (
                              <Chip key={target} size='small' label={t(`packages.runtimeTargets.${target}`, target)} />
                          ))
                        : null}
                    {row.authoringSurface.kind === 'playcanvasEditor' ? (
                        <Chip size='small' color='info' label={t('packages.authoringSurfaces.playcanvasEditor', 'Editor')} />
                    ) : null}
                </Stack>
            )
        },
        {
            id: 'status',
            label: t('packages.columns.status', 'Status'),
            width: 140,
            render: (row) => (
                <Chip
                    size='small'
                    color={row.attached ? 'success' : 'default'}
                    label={row.attached ? t('packages.status.connected', 'Connected') : t('packages.status.available', 'Available')}
                />
            )
        }
    ]

    if (catalogQuery.isLoading || attachedQuery.isLoading) {
        return (
            <Stack direction='row' spacing={1} alignItems='center' sx={{ py: 3 }}>
                <CircularProgress size={18} />
                <Typography variant='body2' color='text.secondary'>
                    {t('packages.loading', 'Loading packages...')}
                </Typography>
            </Stack>
        )
    }

    if (catalogQuery.isError || attachedQuery.isError) {
        return <Alert severity='error'>{t('packages.loadError', 'Failed to load packages.')}</Alert>
    }

    if (rows.length === 0) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt={t('packages.empty.imageAlt', 'No packages available')}
                title={t('packages.empty.title', 'No packages available')}
                description={t('packages.empty.description', 'Package registry will appear here after platform bootstrap.')}
            />
        )
    }

    const attachDescription = pendingAttach
        ? t('packages.dialogs.attach.description', 'Connect {{packageName}} version {{version}} to this metahub.', {
              packageName: pendingAttach.row.name,
              version: pendingAttach.version
          })
        : ''
    const versionChangeDescription = pendingVersionChange
        ? t('packages.dialogs.changeVersion.description', 'Switch {{packageName}} from version {{currentVersion}} to {{nextVersion}}.', {
              packageName: pendingVersionChange.row.name,
              currentVersion: pendingVersionChange.row.version,
              nextVersion: pendingVersionChange.version
          })
        : ''
    const mutationErrorMessage = t('packages.notifications.mutationFailed', 'Package operation failed. Please refresh and try again.')
    const settingsValidationError = resolveSettingsValidationError(settingsDraft)
    const isDevelopmentUrlPolicyDisabled =
        Array.from(settingsDraft?.row.authoringSurface.supportedDisplayModes ?? []).includes('developmentUrl') &&
        !settingsDraft?.allowedDisplayModes.includes('developmentUrl')

    return (
        <Stack spacing={2} data-testid='metahub-packages-tab'>
            {!canManagePackages && !permissionsLoading ? (
                <Alert severity='info'>{t('packages.readOnly', 'You can view connected packages, but cannot change them.')}</Alert>
            ) : null}
            <Typography variant='body2' color='text.secondary'>
                {t('packages.connectedCount', '{{count}} connected', { count: connectedRows.length })}
            </Typography>
            <Box>
                <FlowListTable<PackageTableRow>
                    data={rows}
                    customColumns={packageColumns}
                    tableAriaLabel={t('packages.tableLabel', 'Packages')}
                    renderActions={(row) => {
                        const draftVersion = resolveDraftVersion(row)

                        if (row.attached && row.attachmentId) {
                            if (row.authoringSurface.kind === 'playcanvasEditor') {
                                return (
                                    <Tooltip title={getRowActionLabel('packages.actions.moreNamed', 'Actions for {{packageName}}', row)}>
                                        <span>
                                            <IconButton
                                                size='small'
                                                aria-label={getRowActionLabel(
                                                    'packages.actions.moreNamed',
                                                    'Actions for {{packageName}}',
                                                    row
                                                )}
                                                disabled={actionsDisabled}
                                                onClick={(event) => setActionMenu({ row, anchor: event.currentTarget })}
                                            >
                                                <MoreVertRoundedIcon fontSize='small' />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                )
                            }

                            return (
                                <Tooltip title={getRowActionLabel('packages.actions.detachNamed', 'Disconnect {{packageName}}', row)}>
                                    <span>
                                        <IconButton
                                            size='small'
                                            aria-label={getRowActionLabel(
                                                'packages.actions.detachNamed',
                                                'Disconnect {{packageName}}',
                                                row
                                            )}
                                            disabled={actionsDisabled}
                                            onClick={() => {
                                                setMutationErrorVisible(false)
                                                setPendingDetach(row)
                                            }}
                                        >
                                            <DeleteOutlineRoundedIcon fontSize='small' />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            )
                        }

                        return (
                            <Tooltip title={getRowActionLabel('packages.actions.attachNamed', 'Connect {{packageName}}', row)}>
                                <span>
                                    <IconButton
                                        size='small'
                                        aria-label={getRowActionLabel('packages.actions.attachNamed', 'Connect {{packageName}}', row)}
                                        disabled={actionsDisabled || !draftVersion}
                                        onClick={() => {
                                            setMutationErrorVisible(false)
                                            setPendingAttach({ row, version: draftVersion })
                                        }}
                                    >
                                        <AddRoundedIcon fontSize='small' />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        )
                    }}
                />
                {rows
                    .filter(
                        (row) =>
                            row.attached &&
                            row.authoringSurface.kind === 'playcanvasEditor' &&
                            row.packageName === PLAYCANVAS_EDITOR_PACKAGE_NAME
                    )
                    .map((row) =>
                        metahubId ? (
                            <Box key={`${row.packageName}-projects`} sx={{ mt: 2 }}>
                                <PlayCanvasProjectsPanel
                                    metahubId={metahubId}
                                    row={row}
                                    canManage={canManagePackages}
                                    locale={locale}
                                    invalidatePackages={invalidatePackages}
                                />
                            </Box>
                        ) : null
                    )}
                <Menu
                    anchorEl={actionMenu?.anchor ?? null}
                    open={Boolean(actionMenu)}
                    onClose={() => setActionMenu(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    <MenuItem
                        disabled={!actionMenu?.row || actionsDisabled}
                        onClick={() => {
                            if (actionMenu?.row) {
                                openEditor(actionMenu.row)
                            }
                            setActionMenu(null)
                        }}
                    >
                        <ListItemIcon>
                            <OpenInNewRoundedIcon fontSize='small' />
                        </ListItemIcon>
                        <ListItemText>{t('packages.actions.openEditor', 'Open editor')}</ListItemText>
                    </MenuItem>
                    <MenuItem
                        disabled={!actionMenu?.row || actionsDisabled}
                        onClick={() => {
                            if (actionMenu?.row) {
                                void openPackageSettings(actionMenu.row)
                            }
                            setActionMenu(null)
                        }}
                    >
                        <ListItemIcon>
                            <SettingsRoundedIcon fontSize='small' />
                        </ListItemIcon>
                        <ListItemText>{t('packages.actions.settings', 'Settings')}</ListItemText>
                    </MenuItem>
                    <MenuItem
                        disabled={!actionMenu?.row || actionsDisabled}
                        onClick={() => {
                            if (actionMenu?.row) {
                                setMutationErrorVisible(false)
                                setPendingDetach(actionMenu.row)
                            }
                            setActionMenu(null)
                        }}
                    >
                        <ListItemIcon>
                            <DeleteOutlineRoundedIcon fontSize='small' />
                        </ListItemIcon>
                        <ListItemText>{t('packages.actions.detach', 'Disconnect package')}</ListItemText>
                    </MenuItem>
                </Menu>
            </Box>
            <StandardDialog
                open={Boolean(pendingAttach)}
                onClose={() => {
                    setMutationErrorVisible(false)
                    setPendingAttach(null)
                }}
                maxWidth='sm'
                fullWidth
                title={t('packages.dialogs.attach.title', 'Connect package')}
                disablePresentationControls
                actions={
                    <>
                        <Button
                            onClick={() => {
                                setMutationErrorVisible(false)
                                setPendingAttach(null)
                            }}
                            disabled={attachMutation.isPending}
                        >
                            {t('packages.dialogs.cancel', 'Cancel')}
                        </Button>
                        <Button
                            variant='contained'
                            onClick={() => {
                                if (!pendingAttach) return
                                setMutationErrorVisible(false)
                                attachMutation.mutate(
                                    { packageName: pendingAttach.row.packageName, version: pendingAttach.version },
                                    { onSuccess: () => setPendingAttach(null) }
                                )
                            }}
                            disabled={attachMutation.isPending}
                        >
                            {t('packages.actions.attach', 'Connect package')}
                        </Button>
                    </>
                }
            >
                <DialogContentText>{attachDescription}</DialogContentText>
                {mutationErrorVisible ? (
                    <Alert severity='error' sx={{ mt: 2 }}>
                        {mutationErrorMessage}
                    </Alert>
                ) : null}
            </StandardDialog>
            <StandardDialog
                open={Boolean(pendingVersionChange)}
                onClose={closePendingVersionChange}
                maxWidth='sm'
                fullWidth
                title={t('packages.dialogs.changeVersion.title', 'Change package version')}
                disablePresentationControls
                actions={
                    <>
                        <Button onClick={closePendingVersionChange} disabled={changeVersionMutation.isPending}>
                            {t('packages.dialogs.cancel', 'Cancel')}
                        </Button>
                        <Button
                            variant='contained'
                            onClick={() => {
                                if (!pendingVersionChange?.row.attachmentId) return
                                setMutationErrorVisible(false)
                                changeVersionMutation.mutate(
                                    {
                                        attachmentId: pendingVersionChange.row.attachmentId,
                                        packageName: pendingVersionChange.row.packageName,
                                        version: pendingVersionChange.version,
                                        resetConfig: versionChangeResetConfig
                                    },
                                    {
                                        onSuccess: () => {
                                            setVersionChangeResetConfig(false)
                                            setPendingVersionChange(null)
                                        }
                                    }
                                )
                            }}
                            disabled={changeVersionMutation.isPending}
                        >
                            {t('packages.dialogs.changeVersion.confirm', 'Change version')}
                        </Button>
                    </>
                }
            >
                <DialogContentText>{versionChangeDescription}</DialogContentText>
                <FormControlLabel
                    sx={{ mt: 2, alignItems: 'flex-start' }}
                    control={
                        <Checkbox
                            checked={versionChangeResetConfig}
                            onChange={(event) => setVersionChangeResetConfig(event.target.checked)}
                            disabled={changeVersionMutation.isPending}
                        />
                    }
                    label={
                        <Stack spacing={0.5}>
                            <Typography variant='body2'>
                                {t('packages.dialogs.changeVersion.resetConfig', 'Reset package display settings to defaults')}
                            </Typography>
                            <Typography variant='caption' color='text.secondary'>
                                {t(
                                    'packages.dialogs.changeVersion.resetConfigHelper',
                                    'Use this when the current display settings are not compatible with the selected version.'
                                )}
                            </Typography>
                        </Stack>
                    }
                />
                {mutationErrorVisible ? (
                    <Alert severity='error' sx={{ mt: 2 }}>
                        {mutationErrorMessage}
                    </Alert>
                ) : null}
            </StandardDialog>
            <StandardDialog
                open={Boolean(settingsDraft)}
                onClose={() => {
                    setMutationErrorVisible(false)
                    setSettingsDraft(null)
                }}
                maxWidth='sm'
                fullWidth
                title={t('packages.dialogs.settings.title', 'Package display settings')}
                disablePresentationControls
                actions={
                    <>
                        <Button onClick={resetSettingsDraftToDefaults} disabled={updateConfigMutation.isPending || !settingsDraft}>
                            {t('packages.dialogs.settings.reset', 'Reset to defaults')}
                        </Button>
                        <Button
                            onClick={() => {
                                setMutationErrorVisible(false)
                                setSettingsDraft(null)
                            }}
                            disabled={updateConfigMutation.isPending}
                        >
                            {t('packages.dialogs.cancel', 'Cancel')}
                        </Button>
                        <Button
                            variant='contained'
                            onClick={() => {
                                if (!settingsDraft?.row.attachmentId) return
                                if (settingsValidationError) return
                                setMutationErrorVisible(false)
                                updateConfigMutation.mutate(
                                    {
                                        attachmentId: settingsDraft.row.attachmentId,
                                        config: buildSettingsConfig(settingsDraft)
                                    },
                                    { onSuccess: () => setSettingsDraft(null) }
                                )
                            }}
                            disabled={updateConfigMutation.isPending || Boolean(settingsValidationError)}
                        >
                            {t('packages.dialogs.settings.save', 'Save')}
                        </Button>
                    </>
                }
            >
                {settingsDraft ? (
                    <Stack spacing={2}>
                        <DialogContentText>
                            {t('packages.dialogs.settings.description', 'Choose how {{packageName}} opens for this metahub.', {
                                packageName: settingsDraft.row.name
                            })}
                        </DialogContentText>
                        <FormControl fullWidth size='small'>
                            <InputLabel id='package-display-mode-label'>{t('packages.settings.displayMode', 'Display mode')}</InputLabel>
                            <Select
                                labelId='package-display-mode-label'
                                value={settingsDraft.mode}
                                label={t('packages.settings.displayMode', 'Display mode')}
                                onChange={(event) =>
                                    setSettingsDraft((current) =>
                                        current ? { ...current, mode: event.target.value as PackageDisplayMode } : current
                                    )
                                }
                            >
                                {settingsDraft.allowedDisplayModes.includes('disabled') ? (
                                    <MenuItem value='disabled'>{t('packages.displayModes.disabled', 'Disabled')}</MenuItem>
                                ) : null}
                                {settingsDraft.allowedDisplayModes.includes('embeddedIframe') ? (
                                    <MenuItem value='embeddedIframe'>{t('packages.displayModes.embeddedIframe', 'Embedded')}</MenuItem>
                                ) : null}
                                {settingsDraft.allowedDisplayModes.includes('openSeparately') ? (
                                    <MenuItem value='openSeparately'>
                                        {t('packages.displayModes.openSeparately', 'Open separately')}
                                    </MenuItem>
                                ) : null}
                                {settingsDraft.allowedDisplayModes.includes('developmentUrl') ? (
                                    <MenuItem value='developmentUrl'>
                                        {t('packages.displayModes.developmentUrl', 'Development URL')}
                                    </MenuItem>
                                ) : null}
                            </Select>
                        </FormControl>
                        {isDevelopmentUrlPolicyDisabled ? (
                            <Alert severity='info'>
                                {t('packages.settings.developmentUrlDisabled', 'Development URL mode is disabled on this server.')}
                            </Alert>
                        ) : null}
                        {settingsDraft.mode === 'developmentUrl' ? (
                            <TextField
                                fullWidth
                                type='url'
                                label={t('packages.settings.developmentUrl', 'Development URL')}
                                value={settingsDraft.developmentUrl}
                                onChange={(event) =>
                                    setSettingsDraft((current) => (current ? { ...current, developmentUrl: event.target.value } : current))
                                }
                                error={Boolean(settingsValidationError)}
                                helperText={
                                    settingsValidationError ??
                                    t('packages.settings.developmentUrlHelper', 'Allowed origins are enforced by the server.')
                                }
                            />
                        ) : null}
                        {settingsDraft.row.authoringSurface.kind === 'playcanvasEditor' ? (
                            settingsProjectsQuery.isLoading ? (
                                <Stack direction='row' spacing={1} alignItems='center'>
                                    <CircularProgress size={18} />
                                    <Typography variant='body2' color='text.secondary'>
                                        {t('packages.projects.loading', 'Loading PlayCanvas projects...')}
                                    </Typography>
                                </Stack>
                            ) : settingsProjectsQuery.isError ? (
                                <Alert severity='error'>{t('packages.projects.loadError', 'Failed to load PlayCanvas projects.')}</Alert>
                            ) : (
                                <FormControl fullWidth>
                                    <InputLabel id='package-default-playcanvas-project-label'>
                                        {t('packages.projects.defaultProject', 'Default project')}
                                    </InputLabel>
                                    <Select
                                        labelId='package-default-playcanvas-project-label'
                                        value={settingsDraft.defaultProjectId}
                                        label={t('packages.projects.defaultProject', 'Default project')}
                                        onChange={(event) =>
                                            setSettingsDraft((current) =>
                                                current ? { ...current, defaultProjectId: event.target.value } : current
                                            )
                                        }
                                    >
                                        <MenuItem value=''>{t('packages.projects.defaultNone', 'No default project')}</MenuItem>
                                        {(settingsProjectsQuery.data ?? []).map((project) => (
                                            <MenuItem key={project.id} value={project.id}>
                                                {resolveText(
                                                    project.displayName,
                                                    locale,
                                                    t('packages.projects.unnamed', 'Unnamed project')
                                                )}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            )
                        ) : null}
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={settingsDraft.showArtifactOnlyNotice}
                                    onChange={(event) =>
                                        setSettingsDraft((current) =>
                                            current ? { ...current, showArtifactOnlyNotice: event.target.checked } : current
                                        )
                                    }
                                />
                            }
                            label={t('packages.settings.showArtifactOnlyNotice', 'Show artifact status notice')}
                        />
                        {mutationErrorVisible ? <Alert severity='error'>{mutationErrorMessage}</Alert> : null}
                    </Stack>
                ) : null}
            </StandardDialog>
            <ConfirmDeleteDialog
                open={Boolean(pendingDetach)}
                title={t('packages.dialogs.detach.title', 'Disconnect package')}
                error={mutationErrorVisible ? mutationErrorMessage : undefined}
                description={
                    pendingDetach
                        ? t(
                              'packages.dialogs.detach.description',
                              'Disconnect {{packageName}} from this metahub. Modules that expect it will no longer receive this package version during runtime sync.',
                              { packageName: pendingDetach.name }
                          )
                        : ''
                }
                confirmButtonText={t('packages.actions.detach', 'Disconnect package')}
                deletingButtonText={t('packages.dialogs.detach.deleting', 'Disconnecting...')}
                cancelButtonText={t('packages.dialogs.cancel', 'Cancel')}
                loading={detachMutation.isPending}
                onCancel={() => {
                    setMutationErrorVisible(false)
                    setPendingDetach(null)
                }}
                onConfirm={async () => {
                    if (!pendingDetach?.attachmentId) return
                    setMutationErrorVisible(false)
                    await detachMutation.mutateAsync({ attachmentId: pendingDetach.attachmentId })
                }}
            />
        </Stack>
    )
}
