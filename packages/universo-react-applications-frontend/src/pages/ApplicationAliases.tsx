import { useMemo, useState } from 'react'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import { Alert, Box, Button, Chip, FormControlLabel, Stack, Switch, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo-react/i18n'
import { useHasGlobalAccess } from '@universo-react/store'
import type { AppAbility } from '@universo-react/types'
import {
    APIEmptySVG,
    BaseEntityMenu,
    EmptyListState,
    FlowListTable,
    PaginationControls,
    ToolbarControls,
    ViewHeaderMUI as ViewHeader,
    useConfirm,
    useDebouncedSearch,
    usePaginated,
    type ActionDescriptor
} from '@universo-react/template-mui'

import {
    createApplicationAlias,
    getApplicationAliasErrorCode,
    listAliasApplicationOptions,
    listApplicationAliases,
    releaseApplicationAlias,
    renameApplicationAlias,
    setPrimaryApplicationAlias,
    type ApplicationAliasItem,
    type ApplicationAliasListParams
} from '../api/applicationAliasesApi'
import { applicationAliasesQueryKeys, invalidateApplicationAliasQueries } from '../api/applicationAliasesQueryKeys'
import { buildApplicationAliasPickerOptions } from '../utils/applicationAliasOptions'
import { buildPublicApplicationAddress } from '../utils/publicApplicationAddress'
import ApplicationAliasDialog, { type ApplicationAliasOption } from '../components/ApplicationAliasDialog'
import { canUseApplicationAliasAbility, resolveApplicationAliasPageAccess } from '../utils/applicationAliasAbility'

const ApplicationAliases = () => {
    const { t, i18n } = useTranslation('applications')
    const { t: tc } = useCommonTranslations()
    const queryClient = useQueryClient()
    const { confirm } = useConfirm()
    const { ability, isSuperuser, loading } = useHasGlobalAccess() as ReturnType<typeof useHasGlobalAccess> & {
        ability?: AppAbility | null
    }
    const canRead = !loading && canUseApplicationAliasAbility(ability, isSuperuser, 'read')
    const canCreate = !loading && canUseApplicationAliasAbility(ability, isSuperuser, 'create')
    const canUpdate = !loading && canUseApplicationAliasAbility(ability, isSuperuser, 'update')
    const canDelete = !loading && canUseApplicationAliasAbility(ability, isSuperuser, 'delete')
    // Alias capabilities are independently assignable: the page must not turn
    // the `read` grant into a gate for create/update/delete holders, and the
    // registry table itself must not render without the list capability.
    const pageAccess = loading ? null : resolveApplicationAliasPageAccess({ canRead, canCreate, canUpdate, canDelete })
    const showsRegistry = pageAccess !== 'read-required'

    const [dialogState, setDialogState] = useState<{ mode: 'create' | 'edit'; alias?: ApplicationAliasItem } | null>(null)
    const [dialogError, setDialogError] = useState<string | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)
    const [applicationSearch, setApplicationSearch] = useState('')
    const [includeReleased, setIncludeReleased] = useState(false)

    const displayLocale: 'en' | 'ru' = i18n.language === 'ru' ? 'ru' : 'en'

    const paginationResult = usePaginated<ApplicationAliasItem, 'alias' | 'application' | 'created'>({
        queryKeyFn: (params) =>
            applicationAliasesQueryKeys.list({
                ...(params as ApplicationAliasListParams),
                locale: displayLocale,
                includeReleased
            }),
        queryFn: (params) =>
            listApplicationAliases({
                ...(params as ApplicationAliasListParams),
                locale: displayLocale,
                includeReleased
            }),
        initialLimit: 20,
        sortBy: 'alias',
        sortOrder: 'asc',
        enabled: canRead
    })
    const { handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 300
    })

    const applicationOptionsQuery = useQuery({
        queryKey: ['application-aliases', 'application-options', applicationSearch.trim(), displayLocale],
        queryFn: () =>
            listAliasApplicationOptions({
                limit: 50,
                offset: 0,
                search: applicationSearch.trim() || undefined,
                locale: displayLocale
            }),
        enabled: Boolean(dialogState?.mode === 'create' && canCreate),
        staleTime: 30_000
    })

    const applicationOptions = useMemo<ApplicationAliasOption[]>(
        () => buildApplicationAliasPickerOptions(applicationOptionsQuery.data?.items ?? [], i18n.language),
        [applicationOptionsQuery.data, i18n.language]
    )

    const invalidate = (applicationId?: string) => invalidateApplicationAliasQueries(queryClient, applicationId)
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
        onSuccess: async (alias) => {
            await invalidate(alias.applicationId)
            setDialogState(null)
            setDialogError(null)
        },
        onError: (error) => setDialogError(getErrorMessage(error))
    })
    const renameMutation = useMutation({
        mutationFn: ({ row, alias }: { row: ApplicationAliasItem; alias: string }) => renameApplicationAlias(row.id, { alias }),
        onSuccess: async (alias) => {
            await invalidate(alias.applicationId)
            setDialogState(null)
            setDialogError(null)
        },
        onError: (error) => setDialogError(getErrorMessage(error))
    })
    const primaryMutation = useMutation({
        mutationFn: (alias: ApplicationAliasItem) => setPrimaryApplicationAlias(alias.id),
        onSuccess: async (alias) => {
            await invalidate(alias.applicationId)
            setActionError(null)
        },
        onError: (error) => setActionError(getErrorMessage(error))
    })
    const releaseMutation = useMutation({
        mutationFn: async (alias: ApplicationAliasItem) => {
            await releaseApplicationAlias(alias.id)
            return alias
        },
        onSuccess: async (alias) => {
            await invalidate(alias.applicationId)
            setActionError(null)
        },
        onError: (error) => setActionError(getErrorMessage(error))
    })

    const handleSetPrimary = async (alias: ApplicationAliasItem) => {
        const accepted = await confirm({
            title: t('aliases.primary.confirmTitle'),
            description: t('aliases.primary.centralConfirmDescription', {
                address: buildPublicApplicationAddress(alias.alias),
                application: alias.applicationName || t('aliases.unknownApplication')
            })
        })
        if (accepted) {
            setActionError(null)
            primaryMutation.mutate(alias)
        }
    }

    const handleRelease = async (alias: ApplicationAliasItem) => {
        const accepted = await confirm({
            title: t('aliases.release.confirmTitle'),
            description: t('aliases.release.confirmDescription', { address: buildPublicApplicationAddress(alias.alias) })
        })
        if (accepted) {
            setActionError(null)
            releaseMutation.mutate(alias)
        }
    }

    const rowActions = (alias: ApplicationAliasItem): ActionDescriptor<ApplicationAliasItem, never>[] => {
        const actions: ActionDescriptor<ApplicationAliasItem, never>[] = []
        if (canUpdate && !alias.releasedAt) {
            actions.push({
                id: 'rename',
                labelKey: 'aliases.actions.rename',
                icon: <EditRoundedIcon />,
                order: 10,
                onSelect: () => {
                    setDialogError(null)
                    setDialogState({ mode: 'edit', alias })
                }
            })
            if (!alias.isPrimary) {
                actions.push({
                    id: 'primary',
                    labelKey: 'aliases.actions.setPrimary',
                    icon: <StarRoundedIcon />,
                    order: 20,
                    onSelect: () => void handleSetPrimary(alias)
                })
            }
        }
        if (canDelete && !alias.releasedAt) {
            actions.push({
                id: 'release',
                labelKey: 'aliases.actions.release',
                icon: <LinkOffRoundedIcon />,
                tone: 'danger',
                order: 30,
                onSelect: () => void handleRelease(alias)
            })
        }
        return actions
    }

    const columns = useMemo(
        () => [
            {
                id: 'alias',
                label: t('aliases.columns.address'),
                width: '32%',
                render: (alias: ApplicationAliasItem) => (
                    <Typography variant='body2' sx={{ overflowWrap: 'anywhere' }} title={buildPublicApplicationAddress(alias.alias)}>
                        {buildPublicApplicationAddress(alias.alias)}
                    </Typography>
                )
            },
            {
                id: 'application',
                label: t('aliases.columns.application'),
                width: '26%',
                render: (alias: ApplicationAliasItem) => (
                    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                        <Typography variant='body2'>{alias.applicationName || t('aliases.unknownApplication')}</Typography>
                        {alias.applicationContext ? (
                            <Typography variant='caption' sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>
                                {alias.applicationContext}
                            </Typography>
                        ) : null}
                    </Stack>
                )
            },
            {
                id: 'primary',
                label: t('aliases.columns.primary'),
                width: '12%',
                render: (alias: ApplicationAliasItem) =>
                    alias.isPrimary ? (
                        <Chip size='small' color='primary' label={t('aliases.states.primary')} />
                    ) : (
                        t('aliases.states.secondary')
                    )
            },
            {
                id: 'routing',
                label: t('aliases.columns.routing'),
                width: '18%',
                render: (alias: ApplicationAliasItem) =>
                    t(alias.routingMode === 'canonical' ? 'aliases.routing.canonicalShort' : 'aliases.routing.directShort')
            },
            {
                id: 'status',
                label: t('aliases.columns.status'),
                width: '12%',
                render: (alias: ApplicationAliasItem) => (
                    <Chip
                        size='small'
                        variant='outlined'
                        label={t(`aliases.states.${alias.releasedAt ? 'released' : alias.status === 'inactive' ? 'inactive' : 'active'}`)}
                    />
                )
            }
        ],
        [t]
    )

    if (pageAccess === 'denied') {
        return <Alert severity='warning'>{t('aliases.noPermission')}</Alert>
    }

    return (
        <Stack spacing={1} sx={{ minWidth: 0 }}>
            <Box sx={{ px: { xs: 0, md: 2 } }}>
                <ViewHeader
                    title={t('aliases.page.title')}
                    search={showsRegistry}
                    searchPlaceholder={t('aliases.page.searchPlaceholder')}
                    onSearchChange={handleSearchChange}
                >
                    <ToolbarControls
                        settingsEnabled={showsRegistry}
                        settingsTitle={t('aliases.settings.title')}
                        settingsContent={
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={includeReleased}
                                        onChange={(_event, checked) => {
                                            setIncludeReleased(checked)
                                            paginationResult.actions.goToPage(1)
                                        }}
                                    />
                                }
                                label={t('aliases.filters.showReleased')}
                            />
                        }
                        primaryAction={
                            // The create dialog resolves its application through
                            // the alias application-options endpoint, which
                            // itself requires the alias read capability. Without
                            // read the action cannot complete, so it stays hidden
                            // instead of offering a flow that always fails.
                            showsRegistry && canCreate
                                ? {
                                      label: tc('addNew'),
                                      onClick: () => {
                                          setDialogError(null)
                                          setApplicationSearch('')
                                          setDialogState({ mode: 'create' })
                                      },
                                      startIcon: <AddRoundedIcon />
                                  }
                                : undefined
                        }
                    />
                </ViewHeader>
            </Box>

            {!showsRegistry ? <Alert severity='info'>{t('aliases.readRequiredToView')}</Alert> : null}

            {showsRegistry ? (
                <>
                    {actionError ? <Alert severity='error'>{actionError}</Alert> : null}
                    {paginationResult.error ? (
                        <Alert
                            severity='error'
                            action={
                                <Button color='inherit' size='small' onClick={() => void invalidate()}>
                                    {t('aliases.errors.retry')}
                                </Button>
                            }
                        >
                            {t('aliases.errors.load')}
                        </Alert>
                    ) : null}
                    {!paginationResult.isLoading && paginationResult.data.length === 0 ? (
                        <EmptyListState image={APIEmptySVG} imageAlt={t('aliases.emptyImageAlt')} title={t('aliases.empty')} />
                    ) : (
                        <Box sx={{ maxWidth: '100%', overflowX: 'auto' }}>
                            <FlowListTable<ApplicationAliasItem>
                                data={paginationResult.data}
                                isLoading={paginationResult.isLoading}
                                customColumns={columns}
                                tableAriaLabel={t('aliases.tableAriaLabel')}
                                renderActions={(alias) => {
                                    const descriptors = rowActions(alias)
                                    if (!descriptors.length) return null
                                    return (
                                        <BaseEntityMenu<ApplicationAliasItem, never>
                                            entity={alias}
                                            entityKind='application-alias'
                                            descriptors={descriptors}
                                            namespace='applications'
                                            menuButtonLabelKey='aliases.actions.openMenu'
                                            i18nInstance={i18n}
                                            createContext={(base) => ({
                                                ...base,
                                                entity: alias,
                                                entityKind: 'application-alias',
                                                t: base.t!
                                            })}
                                        />
                                    )
                                }}
                            />
                        </Box>
                    )}

                    {!paginationResult.isLoading && paginationResult.data.length > 0 ? (
                        <Box sx={{ mt: 2 }}>
                            <PaginationControls
                                pagination={paginationResult.pagination}
                                actions={paginationResult.actions}
                                isLoading={paginationResult.isLoading}
                                rowsPerPageOptions={[10, 20, 50, 100]}
                                namespace='common'
                            />
                        </Box>
                    ) : null}
                </>
            ) : null}

            <ApplicationAliasDialog
                open={Boolean(dialogState)}
                mode={dialogState?.mode ?? 'create'}
                fixedApplicationId={dialogState?.mode === 'edit' ? dialogState.alias?.applicationId : undefined}
                initialAlias={dialogState?.alias?.alias ?? ''}
                canMakePrimary={canUpdate}
                applications={applicationOptions}
                applicationsLoading={applicationOptionsQuery.isLoading}
                applicationsError={applicationOptionsQuery.isError}
                onRetryApplications={() => void applicationOptionsQuery.refetch()}
                error={dialogError}
                isBusy={createMutation.isPending || renameMutation.isPending}
                onApplicationSearch={setApplicationSearch}
                onClose={() => {
                    setDialogState(null)
                    setDialogError(null)
                }}
                onSubmit={async (value) => {
                    if (dialogState?.mode === 'edit' && dialogState.alias) {
                        await renameMutation.mutateAsync({ row: dialogState.alias, alias: value.alias })
                    } else {
                        await createMutation.mutateAsync(value)
                    }
                }}
            />
        </Stack>
    )
}

export default ApplicationAliases
