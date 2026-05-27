import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    DialogContentText,
    IconButton,
    MenuItem,
    Select,
    Stack,
    Tooltip,
    Typography
} from '@mui/material'
import type { SelectChangeEvent } from '@mui/material/Select'
import { EmptyListState, FlowListTable, type FlowListTableData, type TableColumn } from '@universo-react/template-mui'
import { ConfirmDeleteDialog, StandardDialog } from '@universo-react/template-mui/components/dialogs'
import type { MetahubPackageCatalogItem, MetahubPackageRuntimeTarget, VersionedLocalizedContent } from '@universo-react/types'
import type { Metahub } from '../../../types'
import { getLocalizedContentText, normalizeLocale } from '../../../utils/localizedInput'
import { useMetahubDetails } from '../../metahubs/hooks'
import { metahubsQueryKeys } from '../../shared'
import { packagesApi } from '../api'

interface PackageTableRow extends FlowListTableData {
    packageName: string
    version: string
    description: string
    upstreamVersion: string
    runtimeTargets: readonly MetahubPackageRuntimeTarget[]
    attached: boolean
    attachmentId: string | null
    versions: string[]
}

const resolveText = (value: VersionedLocalizedContent<string> | string | null | undefined, locale: string, fallback: string) =>
    getLocalizedContentText(value, locale, fallback)

const sortVersions = (versions: string[]): string[] =>
    [...versions].sort((left, right) => right.localeCompare(left, undefined, { numeric: true, sensitivity: 'base' }))

const buildRows = (items: MetahubPackageCatalogItem[], locale: string): PackageTableRow[] => {
    const grouped = new Map<string, MetahubPackageCatalogItem[]>()

    for (const item of items) {
        grouped.set(item.packageName, [...(grouped.get(item.packageName) ?? []), item])
    }

    return [...grouped.entries()]
        .map(([packageName, packageVersions]) => {
            const versions = sortVersions(packageVersions.map((item) => item.version))
            const attached = packageVersions.find((item) => item.attached) ?? null
            const selected = attached ?? packageVersions.find((item) => item.version === versions[0]) ?? packageVersions[0]

            return {
                id: packageName,
                name: resolveText(selected.displayName, locale, packageName),
                packageName,
                version: attached?.attachedVersion ?? selected.version,
                description: resolveText(selected.description ?? null, locale, ''),
                upstreamVersion: selected.source.upstreamVersion,
                runtimeTargets: selected.source.runtimeTargets,
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

export function MetahubPackagesTab({ metahubId }: { metahubId?: string }) {
    const { t, i18n } = useTranslation(['metahubs', 'common'])
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const locale = normalizeLocale(i18n.language)
    const [versionDrafts, setVersionDrafts] = useState<Record<string, string>>({})
    const [pendingAttach, setPendingAttach] = useState<{ row: PackageTableRow; version: string } | null>(null)
    const [pendingVersionChange, setPendingVersionChange] = useState<{ row: PackageTableRow; version: string } | null>(null)
    const [pendingDetach, setPendingDetach] = useState<PackageTableRow | null>(null)
    const [mutationErrorVisible, setMutationErrorVisible] = useState(false)

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
        mutationFn: ({ attachmentId, version }: { attachmentId: string; packageName: string; version: string }) =>
            packagesApi.changeVersion(metahubId ?? '', attachmentId, { version }),
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

    const rows = useMemo(() => buildRows(catalogQuery.data ?? [], locale), [catalogQuery.data, locale])
    const connectedRows = rows.filter((row) => row.attached)
    const isMutating = attachMutation.isPending || changeVersionMutation.isPending || detachMutation.isPending
    const actionsDisabled = isMutating || permissionsLoading || !canManagePackages

    const resolveDraftVersion = (row: PackageTableRow) => versionDrafts[row.packageName] ?? row.version ?? row.versions[0]

    const handleVersionChange = (row: PackageTableRow) => (event: SelectChangeEvent<string>) => {
        const version = event.target.value
        setVersionDrafts((current) => ({ ...current, [row.packageName]: version }))

        if (row.attached && row.attachmentId && version !== row.version) {
            setPendingVersionChange({ row, version })
        }
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
            label: t('packages.columns.targets', 'Runtime'),
            width: 180,
            render: (row) => (
                <Stack direction='row' flexWrap='wrap' gap={0.5}>
                    {row.runtimeTargets.map((target) => (
                        <Chip key={target} size='small' label={t(`packages.runtimeTargets.${target}`, target)} />
                    ))}
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

    if (catalogQuery.isLoading) {
        return (
            <Stack direction='row' spacing={1} alignItems='center' sx={{ py: 3 }}>
                <CircularProgress size={18} />
                <Typography variant='body2' color='text.secondary'>
                    {t('packages.loading', 'Loading packages...')}
                </Typography>
            </Stack>
        )
    }

    if (catalogQuery.isError) {
        return <Alert severity='error'>{t('packages.loadError', 'Failed to load packages.')}</Alert>
    }

    if (rows.length === 0) {
        return (
            <EmptyListState
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
                onClose={() => {
                    setMutationErrorVisible(false)
                    setPendingVersionChange(null)
                }}
                maxWidth='sm'
                fullWidth
                title={t('packages.dialogs.changeVersion.title', 'Change package version')}
                disablePresentationControls
                actions={
                    <>
                        <Button
                            onClick={() => {
                                if (pendingVersionChange) {
                                    setVersionDrafts((current) => ({
                                        ...current,
                                        [pendingVersionChange.row.packageName]: pendingVersionChange.row.version
                                    }))
                                }
                                setMutationErrorVisible(false)
                                setPendingVersionChange(null)
                            }}
                            disabled={changeVersionMutation.isPending}
                        >
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
                                        version: pendingVersionChange.version
                                    },
                                    { onSuccess: () => setPendingVersionChange(null) }
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
                {mutationErrorVisible ? (
                    <Alert severity='error' sx={{ mt: 2 }}>
                        {mutationErrorMessage}
                    </Alert>
                ) : null}
            </StandardDialog>
            <ConfirmDeleteDialog
                open={Boolean(pendingDetach)}
                title={t('packages.dialogs.detach.title', 'Disconnect package')}
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
                onConfirm={() => {
                    if (!pendingDetach?.attachmentId) return
                    setMutationErrorVisible(false)
                    detachMutation.mutate({ attachmentId: pendingDetach.attachmentId }, { onSuccess: () => setPendingDetach(null) })
                }}
            />
        </Stack>
    )
}
