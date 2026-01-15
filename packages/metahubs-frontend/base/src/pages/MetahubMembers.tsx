import { useCallback, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Box, IconButton, Skeleton, Stack, Typography } from '@mui/material'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useSnackbar } from 'notistack'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@universo/auth-frontend'
import { canManageRole } from '@universo/types'
import type { MetahubRole } from '@universo/types'
import { extractAxiosError, isApiError, isHttpStatus } from '@universo/utils'

// project imports
import {
    TemplateMainCard as MainCard,
    ItemCard,
    ToolbarControls,
    EmptyListState,
    SkeletonGrid,
    APIEmptySVG,
    usePaginated,
    useDebouncedSearch,
    PaginationControls,
    FlowListTable,
    gridSpacing,
    ConfirmDialog,
    useConfirm,
    RoleChip
} from '@universo/template-mui'
import type { ActionContext, AssignableRole, TableColumn, TriggerProps } from '@universo/template-mui'
import { MemberFormDialog, ConfirmDeleteDialog } from '@universo/template-mui/components/dialogs'
import { BaseEntityMenu, ViewHeaderMUI as ViewHeader } from '@universo/template-mui'
import type { MemberFormData } from '@universo/template-mui'

import { useInviteMember, useRemoveMember, useUpdateMemberRole } from '../hooks/mutations'
import { useViewPreference } from '../hooks/useViewPreference'
import { STORAGE_KEYS } from '../constants/storage'
import * as metahubsApi from '../api/metahubs'
import { metahubsQueryKeys } from '../api/queryKeys'
import { MetahubMember } from '../types'
import metahubMemberActions from './MetahubMemberActions'

// Re-export MemberFormData as MemberData for backward compatibility
type MemberData = MemberFormData

function isMemberFormData(data: unknown): data is MemberData {
    if (!data || typeof data !== 'object') return false
    const d = data as Record<string, unknown>
    return (
        typeof d.email === 'string' &&
        typeof d.role === 'string' &&
        ['admin', 'editor', 'member'].includes(d.role) &&
        (d.comment === undefined || typeof d.comment === 'string')
    )
}

interface ConfirmSpec {
    title?: string
    titleKey?: string
    description?: string
    descriptionKey?: string
    confirmButtonName?: string
    confirmKey?: string
    cancelButtonName?: string
    cancelKey?: string
    interpolate?: Record<string, string | number>
}

export const MetahubMembers = () => {
    const { metahubId } = useParams<{ metahubId: string }>()
    const { user } = useAuth()
    const { i18n } = useTranslation(['metahubs', 'roles', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()

    const [isInviteDialogOpen, setInviteDialogOpen] = useState(false)
    const [view, setView] = useViewPreference(STORAGE_KEYS.MEMBERS_DISPLAY_STYLE)
    const [inviteDialogError, setInviteDialogError] = useState<string | null>(null)

    const paginationResult = usePaginated<MetahubMember, 'email' | 'role' | 'created'>({
        queryKeyFn: (params) => metahubsQueryKeys.membersList(metahubId!, params),
        queryFn: (params) => metahubsApi.listMetahubMembers(metahubId!, params),
        initialLimit: 20,
        sortBy: 'created',
        sortOrder: 'desc',
        enabled: !!metahubId
    })

    const { data: members, isLoading, error } = paginationResult

    const { handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    const [removeDialogState, setRemoveDialogState] = useState<{ open: boolean; member: MetahubMember | null }>({
        open: false,
        member: null
    })

    const { confirm } = useConfirm()

    const inviteMember = useInviteMember()
    const updateMemberRoleMutation = useUpdateMemberRole()
    const removeMemberMutation = useRemoveMember()

    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(members)) {
            members.forEach((member) => {
                if (member?.id) {
                    imagesMap[member.id] = []
                }
            })
        }
        return imagesMap
    }, [members])

    const handleInviteDialogClose = () => {
        setInviteDialogOpen(false)
    }

    const handleInviteDialogSave = () => {
        setInviteDialogOpen(false)
    }

    const handleInviteMember = async (data: { email: string; role: AssignableRole; comment?: string }) => {
        if (!metahubId) return

        setInviteDialogError(null)
        try {
            await inviteMember.mutateAsync({
                metahubId,
                data: {
                    email: data.email,
                    role: data.role,
                    comment: data.comment
                }
            })
            handleInviteDialogSave()
        } catch (error: unknown) {
            let message = tc('members.inviteError')

            if (isHttpStatus(error, 404)) {
                message = tc('members.userNotFound', { email: data.email })
            } else if (isHttpStatus(error, 409) && isApiError(error, 'METAHUB_MEMBER_EXISTS')) {
                message = tc('members.userAlreadyMember', { email: data.email })
            } else {
                const apiError = extractAxiosError(error)
                message = apiError.message || message
            }

            setInviteDialogError(message)
            // eslint-disable-next-line no-console
            console.error('Failed to invite member', error)
        }
    }

    const handleChange = (_event: React.MouseEvent<HTMLElement> | null, nextView: string | null) => {
        if (nextView === null) return
        setView(nextView as 'card' | 'table')
    }

    const memberColumns = [
        {
            id: 'email',
            label: tc('members.table.email'),
            width: '25%',
            align: 'left',
            sortable: true,
            sortAccessor: (row: MetahubMember) => row.email?.toLowerCase() ?? '',
            render: (row: MetahubMember) => {
                if (!row.email) return null
                return <Typography variant='body2'>{row.email}</Typography>
            }
        },
        {
            id: 'nickname',
            label: tc('members.table.nickname'),
            width: '20%',
            align: 'left',
            sortable: true,
            sortAccessor: (row: MetahubMember) => row.nickname?.toLowerCase() ?? '',
            render: (row: MetahubMember) => {
                if (!row.nickname) return null
                return <Typography variant='body2'>{row.nickname}</Typography>
            }
        },
        {
            id: 'comment',
            label: tc('members.table.comment'),
            width: '25%',
            align: 'left',
            render: (row: MetahubMember) => {
                if (!row.comment) return null
                return (
                    <Typography variant='body2' noWrap sx={{ maxWidth: 200 }}>
                        {row.comment}
                    </Typography>
                )
            }
        },
        {
            id: 'role',
            label: tc('members.table.role'),
            width: '15%',
            align: 'center',
            render: (row: MetahubMember) => {
                const roleKey = (row.role || 'member') as MetahubRole
                return <RoleChip role={roleKey} />
            }
        },
        {
            id: 'added',
            label: tc('members.table.added'),
            width: '15%',
            align: 'left',
            sortable: true,
            sortAccessor: (row: MetahubMember) => (row.createdAt ? new Date(row.createdAt).getTime() : 0),
            render: (row: MetahubMember) => {
                if (!row.createdAt) return null
                return <Typography variant='body2'>{new Date(row.createdAt).toLocaleDateString()}</Typography>
            }
        }
    ] satisfies TableColumn<MetahubMember>[]

    const createMemberContext = useCallback(
        (baseContext: Partial<ActionContext<MetahubMember, MemberData>>): ActionContext<MetahubMember, MemberData> => ({
            ...baseContext,
            entity: baseContext.entity!,
            entityKind: 'member',
            t: baseContext.t!,
            api: {
                updateEntity: async (id: string, data: MemberData) => {
                    if (!metahubId) return
                    if (!isMemberFormData(data)) {
                        throw new Error('Invalid member data format')
                    }
                    await updateMemberRoleMutation.mutateAsync({
                        metahubId,
                        memberId: id,
                        data: {
                            role: data.role as AssignableRole,
                            comment: data.comment
                        }
                    })
                },
                deleteEntity: async (id: string) => {
                    if (!metahubId) return
                    await removeMemberMutation.mutateAsync({ metahubId, memberId: id })
                }
            },
            helpers: {
                refreshList: async () => {
                    if (!metahubId) return
                    await queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.members(metahubId)
                    })
                },
                confirm: async (spec: ConfirmSpec) => {
                    const confirmed = await confirm({
                        title: spec.titleKey && baseContext.t ? baseContext.t(spec.titleKey, spec.interpolate) : spec.title || '',
                        description:
                            spec.descriptionKey && baseContext.t
                                ? baseContext.t(spec.descriptionKey, spec.interpolate)
                                : spec.description || '',
                        confirmButtonName:
                            spec.confirmKey && baseContext.t
                                ? baseContext.t(spec.confirmKey)
                                : spec.confirmButtonName || (baseContext.t ? baseContext.t('confirm.remove.confirm') : 'Confirm'),
                        cancelButtonName:
                            spec.cancelKey && baseContext.t
                                ? baseContext.t(spec.cancelKey)
                                : spec.cancelButtonName || (baseContext.t ? baseContext.t('confirm.remove.cancel') : 'Cancel')
                    })
                    return confirmed
                },
                enqueueSnackbar: (payload: {
                    message: string
                    options?: { variant?: 'default' | 'error' | 'success' | 'warning' | 'info' }
                }) => {
                    if (payload?.message) {
                        enqueueSnackbar(payload.message, payload.options)
                    }
                },
                openDeleteDialog: (member: MetahubMember) => {
                    setRemoveDialogState({ open: true, member })
                }
            }
        }),
        [confirm, enqueueSnackbar, metahubId, queryClient, removeMemberMutation, updateMemberRoleMutation]
    )

    if (!metahubId) {
        return (
            <MainCard
                sx={{ maxWidth: '100%', width: '100%' }}
                contentSX={{ px: 0, py: 0 }}
                disableContentPadding
                disableHeader
                border={false}
                shadow={false}
            >
                <EmptyListState image={APIEmptySVG} imageAlt='Invalid metahub' title={tc('errors.connectionFailed')} />
            </MainCard>
        )
    }

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
                    title={tc('errors.connectionFailed')}
                    description={!(error as any)?.response?.status ? tc('errors.checkConnection') : tc('errors.pleaseTryLater')}
                    action={{
                        label: tc('actions.retry'),
                        onClick: () => paginationResult.actions.goToPage(1)
                    }}
                />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 1 }}>
                    <ViewHeader
                        search={true}
                        searchPlaceholder={tc('members.searchPlaceholder')}
                        onSearchChange={handleSearchChange}
                        title={tc('members.title')}
                    >
                        <ToolbarControls
                            viewToggleEnabled
                            viewMode={view as 'card' | 'list'}
                            onViewModeChange={(mode: string) => handleChange(null, mode)}
                            cardViewTitle={tc('cardView')}
                            listViewTitle={tc('listView')}
                            primaryAction={{
                                label: tc('members.inviteMember'),
                                onClick: () => setInviteDialogOpen(true),
                                startIcon: <AddRoundedIcon />
                            }}
                        />
                    </ViewHeader>

                    {isLoading && members.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && members.length === 0 ? (
                        <EmptyListState image={APIEmptySVG} imageAlt='No members' title={tc('members.noMembersFound')} />
                    ) : (
                        <>
                            {view === 'card' ? (
                                <Box
                                    sx={{
                                        display: 'grid',
                                        gap: gridSpacing,
                                        mx: { xs: -1.5, md: -2 },
                                        gridTemplateColumns: {
                                            xs: '1fr',
                                            sm: 'repeat(auto-fill, minmax(240px, 1fr))',
                                            lg: 'repeat(auto-fill, minmax(260px, 1fr))'
                                        },
                                        justifyContent: 'start',
                                        alignContent: 'start'
                                    }}
                                >
                                    {members.map((member: MetahubMember) => {
                                        const descriptors = metahubMemberActions.filter((_descriptor) => {
                                            if (member.role === 'owner') {
                                                return false
                                            }

                                            const currentMember = members.find((m) => m.userId === user?.id)
                                            if (!currentMember) return false

                                            return canManageRole(currentMember.role, member.role)
                                        })

                                        return (
                                            <ItemCard
                                                key={member.id}
                                                data={{
                                                    ...member,
                                                    name: member.email || tc('noEmail'),
                                                    description: [member.nickname, member.comment].filter(Boolean).join('\n') || undefined
                                                }}
                                                images={images[member.id] || []}
                                                onClick={undefined}
                                                footerEndContent={<RoleChip role={member.role} size='small' />}
                                                headerAction={
                                                    descriptors.length > 0 ? (
                                                        <Box onClick={(e) => e.stopPropagation()}>
                                                            <BaseEntityMenu<MetahubMember, MemberFormData>
                                                                entity={member}
                                                                entityKind='member'
                                                                descriptors={descriptors}
                                                                namespace='metahubs'
                                                                i18nInstance={i18n}
                                                                createContext={createMemberContext}
                                                                renderTrigger={(props: TriggerProps) => (
                                                                    <IconButton
                                                                        size='small'
                                                                        sx={{ color: 'text.secondary', width: 28, height: 28, p: 0.25 }}
                                                                        {...props}
                                                                    >
                                                                        <MoreVertRoundedIcon fontSize='small' />
                                                                    </IconButton>
                                                                )}
                                                            />
                                                        </Box>
                                                    ) : null
                                                }
                                            />
                                        )
                                    })}
                                </Box>
                            ) : (
                                <Box sx={{ mx: { xs: -1.5, md: -2 } }}>
                                    <FlowListTable
                                        data={members}
                                        images={images}
                                        isLoading={isLoading}
                                        getRowLink={() => undefined}
                                        customColumns={memberColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: MetahubMember) => {
                                            if (row.role === 'owner') {
                                                return null
                                            }

                                            const currentMember = members.find((m) => m.userId === user?.id)
                                            if (!currentMember) return null

                                            if (!canManageRole(currentMember.role, row.role)) {
                                                return null
                                            }

                                            const descriptors = metahubMemberActions

                                            return (
                                                <BaseEntityMenu<MetahubMember, MemberFormData>
                                                    entity={row}
                                                    entityKind='member'
                                                    descriptors={descriptors}
                                                    namespace='metahubs'
                                                    menuButtonLabelKey='flowList:menu.button'
                                                    i18nInstance={i18n}
                                                    createContext={createMemberContext}
                                                />
                                            )
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}

                    {!isLoading && members.length > 0 && (
                        <Box sx={{ mx: { xs: -1.5, md: -2 }, mt: 2 }}>
                            <PaginationControls
                                pagination={paginationResult.pagination}
                                actions={paginationResult.actions}
                                isLoading={paginationResult.isLoading}
                                rowsPerPageOptions={[10, 20, 50, 100]}
                                namespace='common'
                            />
                        </Box>
                    )}
                </Stack>
            )}

            <MemberFormDialog
                open={isInviteDialogOpen}
                mode='create'
                title={tc('members.inviteMember')}
                emailLabel={tc('members.emailLabel')}
                roleLabel={tc('members.roleLabel')}
                commentLabel={tc('members.commentLabel')}
                commentPlaceholder={tc('members.commentPlaceholder')}
                commentCharacterCountFormatter={(count, max) => tc('members.validation.commentCharacterCount', { count, max })}
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={inviteMember.isPending}
                error={inviteDialogError || undefined}
                onClose={handleInviteDialogClose}
                onSave={handleInviteMember}
                autoCloseOnSuccess={false}
                availableRoles={['admin', 'editor', 'member']}
                roleLabels={{
                    admin: tc('members.roles.admin'),
                    editor: tc('members.roles.editor'),
                    member: tc('members.roles.member')
                }}
            />

            <ConfirmDeleteDialog
                open={removeDialogState.open}
                title={removeDialogState.member?.userId === user?.id ? tc('members.selfActionWarning') : tc('members.confirmRemove')}
                description={
                    removeDialogState.member?.userId === user?.id
                        ? tc('members.selfActionWarning')
                        : tc('members.confirmRemoveDescription', { email: removeDialogState.member?.email || '' })
                }
                confirmButtonText={tc('actions.remove', 'Remove')}
                deletingButtonText={tc('actions.deleting', 'Removing...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setRemoveDialogState({ open: false, member: null })}
                onConfirm={async () => {
                    if (removeDialogState.member && metahubId) {
                        try {
                            await removeMemberMutation.mutateAsync({ metahubId, memberId: removeDialogState.member.id })
                            setRemoveDialogState({ open: false, member: null })
                        } catch (err: unknown) {
                            const responseMessage =
                                err && typeof err === 'object' && 'response' in err ? (err as any)?.response?.data?.message : undefined
                            const message =
                                typeof responseMessage === 'string'
                                    ? responseMessage
                                    : err instanceof Error
                                    ? err.message
                                    : typeof err === 'string'
                                    ? err
                                    : tc('members.removeError')
                            enqueueSnackbar(message, { variant: 'error' })
                            setRemoveDialogState({ open: false, member: null })
                        }
                    }
                }}
            />

            <ConfirmDialog />
        </MainCard>
    )
}

export default MetahubMembers
