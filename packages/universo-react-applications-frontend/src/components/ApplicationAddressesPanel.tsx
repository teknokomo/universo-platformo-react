import { useState } from 'react'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    FormControl,
    FormControlLabel,
    IconButton,
    Radio,
    RadioGroup,
    Stack,
    Tooltip,
    Typography
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo-react/i18n'
import { useSnackbar } from 'notistack'
import { useHasGlobalAccess } from '@universo-react/store'
import type { AppAbility } from '@universo-react/types'
import { FlowListTable, useConfirm } from '@universo-react/template-mui'

import {
    createApplicationAlias,
    getApplicationAliasErrorCode,
    getApplicationAliasPolicy,
    listAliasesByApplication,
    releaseApplicationAlias,
    renameApplicationAlias,
    setApplicationAliasPolicy,
    setPrimaryApplicationAlias,
    type ApplicationAliasItem,
    type ApplicationAliasRoutingMode
} from '../api/applicationAliasesApi'
import { applicationAliasesQueryKeys, invalidateApplicationAliasQueries } from '../api/applicationAliasesQueryKeys'
import { canUseApplicationAliasAbility } from '../utils/applicationAliasAbility'
import ApplicationAliasDialog from './ApplicationAliasDialog'
import { buildPublicApplicationAddress } from '../utils/publicApplicationAddress'

export interface ApplicationAddressesPanelProps {
    applicationId: string
}

const useAliasCapabilities = () => {
    const { ability, isSuperuser, loading } = useHasGlobalAccess() as ReturnType<typeof useHasGlobalAccess> & {
        ability?: AppAbility | null
    }

    return {
        loading,
        canRead: !loading && canUseApplicationAliasAbility(ability, isSuperuser, 'read'),
        canCreate: !loading && canUseApplicationAliasAbility(ability, isSuperuser, 'create'),
        canUpdate: !loading && canUseApplicationAliasAbility(ability, isSuperuser, 'update'),
        canDelete: !loading && canUseApplicationAliasAbility(ability, isSuperuser, 'delete')
    }
}

export function ApplicationAddressesPanel({ applicationId }: ApplicationAddressesPanelProps) {
    const { t } = useTranslation('applications')
    const { t: tc } = useCommonTranslations()
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const { confirm } = useConfirm()
    const capabilities = useAliasCapabilities()
    const [dialogState, setDialogState] = useState<{ mode: 'create' | 'edit'; alias?: ApplicationAliasItem } | null>(null)
    const [dialogError, setDialogError] = useState<string | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)

    const aliasesQuery = useQuery({
        queryKey: applicationAliasesQueryKeys.byApplication(applicationId),
        queryFn: () => listAliasesByApplication(applicationId),
        enabled: capabilities.canRead
    })
    const policyQuery = useQuery({
        queryKey: applicationAliasesQueryKeys.policy(applicationId),
        queryFn: () => getApplicationAliasPolicy(applicationId),
        enabled: capabilities.canRead
    })

    const invalidate = () => invalidateApplicationAliasQueries(queryClient, applicationId)
    const getErrorMessage = (error: unknown) => {
        const code = getApplicationAliasErrorCode(error)
        switch (code) {
            case 'APPLICATION_ALIAS_CONFLICT':
                return t('aliases.errors.conflict')
            case 'APPLICATION_ALIAS_RESERVED':
                return t('aliases.errors.reserved')
            case 'APPLICATION_ALIAS_UUID':
                return t('aliases.errors.uuid')
            case 'APPLICATION_ALIAS_FORMAT':
            case 'VALIDATION_ERROR':
                return t('aliases.errors.format')
            default:
                return t('aliases.errors.save')
        }
    }

    const createMutation = useMutation({
        mutationFn: createApplicationAlias,
        onSuccess: async () => {
            await invalidate()
            setDialogState(null)
            setDialogError(null)
        },
        onError: (error) => setDialogError(getErrorMessage(error))
    })
    const renameMutation = useMutation({
        mutationFn: ({ id, alias }: { id: string; alias: string }) => renameApplicationAlias(id, { alias }),
        onSuccess: async () => {
            await invalidate()
            setDialogState(null)
            setDialogError(null)
        },
        onError: (error) => setDialogError(getErrorMessage(error))
    })
    const primaryMutation = useMutation({
        mutationFn: setPrimaryApplicationAlias,
        onSuccess: async () => {
            await invalidate()
            setActionError(null)
        },
        onError: (error) => setActionError(getErrorMessage(error))
    })
    const releaseMutation = useMutation({
        mutationFn: releaseApplicationAlias,
        onSuccess: async () => {
            await invalidate()
            setActionError(null)
        },
        onError: (error) => setActionError(getErrorMessage(error))
    })
    const policyMutation = useMutation({
        mutationFn: (routingMode: ApplicationAliasRoutingMode) => setApplicationAliasPolicy(applicationId, routingMode),
        onSuccess: async () => {
            await invalidate()
            setActionError(null)
        },
        onError: (error) => setActionError(getErrorMessage(error))
    })

    const handleCopy = async (
        value: string,
        messages: { success: string; error: string } = {
            success: t('aliases.dialog.copySuccess'),
            error: t('aliases.dialog.copyError')
        }
    ) => {
        try {
            if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
                throw new Error('Clipboard API is unavailable')
            }
            await navigator.clipboard.writeText(value)
            enqueueSnackbar(messages.success, { variant: 'success' })
        } catch {
            enqueueSnackbar(messages.error, { variant: 'error' })
        }
    }

    const handleSetPrimary = async (alias: ApplicationAliasItem) => {
        if (alias.isPrimary) return
        const currentPrimary = aliasesQuery.data?.find((item) => item.isPrimary)
        const accepted = await confirm({
            title: t('aliases.primary.confirmTitle'),
            description: t('aliases.primary.confirmDescription', {
                oldAddress: currentPrimary ? buildPublicApplicationAddress(currentPrimary.alias) : t('aliases.primary.none'),
                newAddress: buildPublicApplicationAddress(alias.alias)
            })
        })
        if (accepted) {
            setActionError(null)
            primaryMutation.mutate(alias.id)
        }
    }

    const handleRelease = async (alias: ApplicationAliasItem) => {
        const accepted = await confirm({
            title: t('aliases.release.confirmTitle'),
            description: t('aliases.release.confirmDescription', { address: buildPublicApplicationAddress(alias.alias) })
        })
        if (accepted) {
            setActionError(null)
            releaseMutation.mutate(alias.id)
        }
    }

    const columns = [
        {
            id: 'address',
            label: t('aliases.columns.address'),
            width: '48%',
            render: (alias: ApplicationAliasItem) => (
                <Stack direction='row' spacing={1} sx={{ minWidth: 0, alignItems: 'center' }}>
                    <Typography
                        variant='body2'
                        sx={{ overflowWrap: 'anywhere', minWidth: 0 }}
                        title={buildPublicApplicationAddress(alias.alias)}
                    >
                        {buildPublicApplicationAddress(alias.alias)}
                    </Typography>
                    <Tooltip title={t('aliases.actions.copy')}>
                        <IconButton
                            size='small'
                            aria-label={t('aliases.actions.copyAddress', { address: buildPublicApplicationAddress(alias.alias) })}
                            onClick={() => void handleCopy(buildPublicApplicationAddress(alias.alias))}
                        >
                            <ContentCopyRoundedIcon fontSize='inherit' />
                        </IconButton>
                    </Tooltip>
                </Stack>
            )
        },
        {
            id: 'primary',
            label: t('aliases.columns.primary'),
            width: '16%',
            render: (alias: ApplicationAliasItem) =>
                alias.isPrimary ? <Chip size='small' color='primary' label={t('aliases.states.primary')} /> : null
        },
        {
            id: 'status',
            label: t('aliases.columns.status'),
            width: '16%',
            render: (alias: ApplicationAliasItem) => (
                <Chip
                    size='small'
                    variant='outlined'
                    label={t(`aliases.states.${alias.releasedAt ? 'released' : alias.status === 'inactive' ? 'inactive' : 'active'}`)}
                />
            )
        },
        {
            id: 'actions',
            label: t('aliases.columns.actions'),
            width: '20%',
            align: 'right' as const,
            render: (alias: ApplicationAliasItem) => (
                <Stack direction='row' spacing={0.25} sx={{ justifyContent: 'flex-end' }}>
                    {capabilities.canUpdate && !alias.releasedAt ? (
                        <>
                            <Tooltip title={t('aliases.actions.rename')}>
                                <IconButton
                                    size='small'
                                    aria-label={t('aliases.actions.renameAddress', { address: buildPublicApplicationAddress(alias.alias) })}
                                    onClick={() => {
                                        setDialogError(null)
                                        setDialogState({ mode: 'edit', alias })
                                    }}
                                >
                                    <EditRoundedIcon fontSize='inherit' />
                                </IconButton>
                            </Tooltip>
                            {!alias.isPrimary ? (
                                <Tooltip title={t('aliases.actions.setPrimary')}>
                                    <IconButton
                                        size='small'
                                        aria-label={t('aliases.actions.setPrimaryAddress', {
                                            address: buildPublicApplicationAddress(alias.alias)
                                        })}
                                        onClick={() => void handleSetPrimary(alias)}
                                    >
                                        <StarRoundedIcon fontSize='inherit' />
                                    </IconButton>
                                </Tooltip>
                            ) : null}
                        </>
                    ) : null}
                    {capabilities.canDelete && !alias.releasedAt ? (
                        <Tooltip title={t('aliases.actions.release')}>
                            <IconButton
                                size='small'
                                color='error'
                                aria-label={t('aliases.actions.releaseAddress', { address: buildPublicApplicationAddress(alias.alias) })}
                                onClick={() => void handleRelease(alias)}
                            >
                                <LinkOffRoundedIcon fontSize='inherit' />
                            </IconButton>
                        </Tooltip>
                    ) : null}
                </Stack>
            )
        }
    ]

    if (!capabilities.loading && !capabilities.canRead) {
        return <Alert severity='warning'>{t('aliases.noPermission')}</Alert>
    }

    return (
        <Stack spacing={2} sx={{ minWidth: 0 }}>
            {actionError ? <Alert severity='error'>{actionError}</Alert> : null}

            <FormControl>
                <Typography variant='subtitle2'>{t('aliases.routing.title')}</Typography>
                {policyQuery.isLoading ? (
                    <CircularProgress size={24} aria-label={t('aliases.routing.loading')} />
                ) : policyQuery.isError ? (
                    <Alert
                        severity='error'
                        action={
                            <Button color='inherit' size='small' onClick={() => void policyQuery.refetch()}>
                                {t('aliases.routing.retry')}
                            </Button>
                        }
                    >
                        {t('aliases.routing.loadError')}
                    </Alert>
                ) : policyQuery.data ? (
                    <>
                        <RadioGroup
                            value={policyQuery.data.routingMode}
                            onChange={(event) => {
                                setActionError(null)
                                policyMutation.mutate(event.target.value as ApplicationAliasRoutingMode)
                            }}
                        >
                            <FormControlLabel
                                value='direct'
                                control={<Radio />}
                                disabled={!capabilities.canUpdate || policyMutation.isPending}
                                label={t('aliases.routing.direct')}
                            />
                            <FormControlLabel
                                value='canonical'
                                control={<Radio />}
                                disabled={!capabilities.canUpdate || policyMutation.isPending}
                                label={t('aliases.routing.canonical')}
                            />
                        </RadioGroup>
                        <Typography variant='caption' color='text.secondary'>
                            {t('aliases.routing.help')}
                        </Typography>
                    </>
                ) : null}
            </FormControl>

            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
            >
                <Typography variant='subtitle2'>{t('aliases.listTitle')}</Typography>
                {capabilities.canCreate ? (
                    <Button
                        startIcon={<AddRoundedIcon />}
                        variant='outlined'
                        onClick={() => {
                            setDialogError(null)
                            setDialogState({ mode: 'create' })
                        }}
                    >
                        {tc('addNew')}
                    </Button>
                ) : null}
            </Stack>

            {aliasesQuery.isError ? (
                <Alert
                    severity='error'
                    action={
                        <Button color='inherit' size='small' onClick={() => void aliasesQuery.refetch()}>
                            {t('aliases.errors.retry')}
                        </Button>
                    }
                >
                    {t('aliases.errors.load')}
                </Alert>
            ) : null}
            <Box sx={{ maxWidth: '100%', overflowX: 'auto' }}>
                <FlowListTable<ApplicationAliasItem>
                    data={aliasesQuery.data ?? []}
                    isLoading={aliasesQuery.isLoading}
                    customColumns={columns}
                    tableAriaLabel={t('aliases.tableAriaLabel')}
                    emptyStateMessage={t('aliases.empty')}
                    compact
                />
            </Box>

            <Box>
                <Typography variant='subtitle2' gutterBottom>
                    {t('aliases.technicalAddress')}
                </Typography>
                <Typography variant='caption' color='text.secondary' component='p'>
                    {t('aliases.technicalAddressHelp')}
                </Typography>
                <Stack direction='row' spacing={1} sx={{ alignItems: 'center', mt: 1, minWidth: 0 }}>
                    <Typography
                        variant='body2'
                        data-testid='application-technical-address'
                        sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere', minWidth: 0 }}
                    >
                        {buildPublicApplicationAddress(applicationId)}
                    </Typography>
                    <Tooltip title={t('aliases.actions.copyStableAddress')}>
                        <IconButton
                            size='small'
                            aria-label={t('aliases.actions.copyStableAddress')}
                            onClick={() =>
                                void handleCopy(buildPublicApplicationAddress(applicationId), {
                                    success: t('aliases.actions.copyStableSuccess'),
                                    error: t('aliases.actions.copyStableError')
                                })
                            }
                        >
                            <ContentCopyRoundedIcon fontSize='inherit' />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Box>

            <ApplicationAliasDialog
                open={Boolean(dialogState)}
                mode={dialogState?.mode ?? 'create'}
                fixedApplicationId={applicationId}
                initialAlias={dialogState?.alias?.alias ?? ''}
                canMakePrimary={capabilities.canUpdate}
                error={dialogError}
                isBusy={createMutation.isPending || renameMutation.isPending}
                onClose={() => {
                    setDialogState(null)
                    setDialogError(null)
                }}
                onSubmit={async (value) => {
                    if (dialogState?.mode === 'edit' && dialogState.alias) {
                        await renameMutation.mutateAsync({ id: dialogState.alias.id, alias: value.alias })
                    } else {
                        await createMutation.mutateAsync(value)
                    }
                }}
            />
        </Stack>
    )
}

export default ApplicationAddressesPanel
