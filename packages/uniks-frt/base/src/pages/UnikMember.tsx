import { useState, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Skeleton, Stack, Typography, IconButton } from '@mui/material'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useSnackbar } from 'notistack'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@universo/auth-frt'
import { canManageRole } from '@universo/types'
import type { UnikRole } from '@universo/types'
import { extractAxiosError, isHttpStatus, isApiError } from '@universo/utils'

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
import type { TableColumn, TriggerProps, AssignableRole, ActionContext } from '@universo/template-mui'
import { MemberFormDialog, ConfirmDeleteDialog } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'

import { useMemberMutations } from '../hooks/mutations'
import * as uniksApi from '../api/uniks'
import { uniksQueryKeys } from '../api/queryKeys'
import { UnikMember } from '../types'
import memberActions from './MemberActions'
import type { MemberFormData } from '@universo/template-mui'

// Re-export MemberFormData as MemberData for backward compatibility
type MemberData = MemberFormData

/**
 * Type guard to check if data is MemberFormData
 */
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

/**
 * Confirm dialog specification with support for translation keys
 */
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

const UnikMembers = () => {
    const { unikId } = useParams<{ unikId: string }>()
    const { user } = useAuth()
    const { i18n } = useTranslation(['uniks', 'roles', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isInviteDialogOpen, setInviteDialogOpen] = useState(false)
    const [view, setView] = useState(localStorage.getItem('unikMembersDisplayStyle') || 'card')

    // State management for invite dialog error (special handling for 404/409)
    const [inviteDialogError, setInviteDialogError] = useState<string | null>(null)

    // Use paginated hook for members list
    const paginationResult = usePaginated<UnikMember, 'email' | 'role' | 'created'>({
        queryKeyFn: (params) => uniksQueryKeys.membersList(unikId!, params),
        queryFn: (params) => uniksApi.listUnikMembers(unikId!, params),
        initialLimit: 20,
        sortBy: 'created',
        sortOrder: 'desc',
        enabled: !!unikId
    })

    const { data: members, isLoading, error } = paginationResult

    // Diagnostics + safe fallback to avoid runtime crash if data is not an array unexpectedly
    const safeMembers = Array.isArray(members) ? members : []
    // eslint-disable-next-line no-console
    console.log('[uniks][UnikMember] members snapshot', {
        typeofMembers: typeof members,
        isArray: Array.isArray(members),
        length: safeMembers.length,
        sample: safeMembers.slice(0, 2)
    })

    // Instant search for better UX (backend has rate limiting protection)
    const { handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // State for independent ConfirmDeleteDialog
    const [removeDialogState, setRemoveDialogState] = useState<{
        open: boolean
        member: UnikMember | null
    }>({ open: false, member: null })

    const { confirm } = useConfirm()

    // Mutation hooks - unified API with unikId binding
    const memberMutations = useMemberMutations(unikId || '')

    // Memoize images object to prevent unnecessary re-creation on every render
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

    const handleAddNew = () => {
        setInviteDialogOpen(true)
    }

    const handleInviteDialogClose = () => {
        setInviteDialogOpen(false)
    }

    const handleInviteDialogSave = () => {
        setInviteDialogOpen(false)
    }

    const handleInviteMember = async (data: { email: string; role: AssignableRole; comment?: string }) => {
        if (!unikId) return

        setInviteDialogError(null)
        try {
            await memberMutations.inviteMember({
                email: data.email,
                role: data.role as import('../types').UnikAssignableRole,
                comment: data.comment
            })
            // Success: close dialog (notification handled by mutation hook)
            handleInviteDialogSave()
        } catch (error: unknown) {
            let message = tc('members.inviteError')

            // Use type-safe axios error utilities for special cases
            if (isHttpStatus(error, 404)) {
                message = tc('members.userNotFound', { email: data.email })
            } else if (isHttpStatus(error, 409) && isApiError(error, 'UNIK_MEMBER_EXISTS')) {
                message = tc('members.userAlreadyMember', { email: data.email })
            } else {
                // Extract generic error message
                const apiError = extractAxiosError(error)
                message = apiError.message || message
            }

            // Error: show error message but DON'T close dialog
            setInviteDialogError(message)
            // eslint-disable-next-line no-console
            console.error('Failed to invite member', error)
        }
    }

    const memberColumns = [
        {
            id: 'email',
            label: tc('members.table.email'),
            width: '25%',
            align: 'left',
            render: (row: UnikMember) => {
                if (!row.email) return null
                return <Typography variant='body2'>{row.email}</Typography>
            }
        },
        {
            id: 'nickname',
            label: tc('members.table.nickname'),
            width: '20%',
            align: 'left',
            render: (row: UnikMember) => {
                if (!row.nickname) return null
                return <Typography variant='body2'>{row.nickname}</Typography>
            }
        },
        {
            id: 'comment',
            label: tc('members.table.comment'),
            width: '25%',
            align: 'left',
            render: (row: UnikMember) => {
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
            render: (row: UnikMember) => {
                const roleKey = (row.role || 'member') as UnikRole
                return <RoleChip role={roleKey} />
            }
        },
        {
            id: 'added',
            label: tc('members.table.added'),
            width: '15%',
            align: 'left',
            render: (row: UnikMember) => {
                if (!row.createdAt) return null
                return <Typography variant='body2'>{new Date(row.createdAt).toLocaleDateString()}</Typography>
            }
        }
    ] satisfies TableColumn<UnikMember>[]

    const createMemberContext = useCallback(
        (baseContext: Partial<ActionContext<UnikMember, MemberData>>): ActionContext<UnikMember, MemberData> => ({
            ...baseContext,
            entity: baseContext.entity!,
            entityKind: 'member',
            t: baseContext.t!,
            api: {
                updateEntity: async (id: string, data: MemberData) => {
                    if (!unikId) return
                    // Validate data
                    if (!isMemberFormData(data)) {
                        throw new Error('Invalid member data format')
                    }
                    // Convert MemberFormData to API format (email is readonly, only role and comment are updatable)
                    await memberMutations.updateMemberRole(id, {
                        role: data.role as import('../types').UnikAssignableRole,
                        comment: data.comment
                    })
                },
                deleteEntity: async (id: string) => {
                    if (!unikId) return
                    await memberMutations.removeMember(id)
                }
            },
            helpers: {
                refreshList: async () => {
                    if (!unikId) return
                    // Explicit cache invalidation
                    await queryClient.invalidateQueries({
                        queryKey: uniksQueryKeys.members(unikId)
                    })
                },
                confirm: async (spec: ConfirmSpec) => {
                    // Support both direct strings and translation keys
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
                // Helper to open ConfirmDeleteDialog independently from BaseEntityMenu
                openDeleteDialog: (member: UnikMember) => {
                    setRemoveDialogState({ open: true, member })
                }
            }
        }),
        [confirm, enqueueSnackbar, unikId, queryClient, memberMutations]
    )

    if (!unikId) {
        return (
            <MainCard
                sx={{ maxWidth: '100%', width: '100%' }}
                contentSX={{ px: 0, py: 0 }}
                disableContentPadding
                disableHeader
                border={false}
                shadow={false}
            >
                <EmptyListState image={APIEmptySVG} imageAlt='Invalid unik' title={tc('errors.connectionFailed')} />
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
                            // Use direct setter to avoid TS event type complaints in diagnostics phase
                            onViewModeChange={(mode: string) => setView(mode)}
                            cardViewTitle={tc('cardView')}
                            listViewTitle={tc('listView')}
                            primaryAction={{
                                label: tc('members.inviteMember'),
                                onClick: handleAddNew,
                                startIcon: <AddRoundedIcon />
                            }}
                        />
                    </ViewHeader>

                    {isLoading && safeMembers.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && safeMembers.length === 0 ? (
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
                                    {safeMembers.map((member: UnikMember) => {
                                        // Filter actions based on permissions and owner protection
                                        const descriptors = memberActions.filter((_descriptor) => {
                                            // Owner role cannot be edited or removed
                                            if (member.role === 'owner') {
                                                return false
                                            }

                                            // Check if current user can manage this member's role
                                            const currentMember = safeMembers.find((m) => m.userId === user?.id)
                                            if (!currentMember) return false

                                            // Use canManageRole utility from @universo/types
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
                                                            <BaseEntityMenu<UnikMember, MemberFormData>
                                                                entity={member}
                                                                entityKind='member'
                                                                // Spread to convert readonly array to mutable expected type
                                                                descriptors={[...descriptors]}
                                                                namespace='uniks'
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
                                        renderActions={(row: UnikMember) => {
                                            // Owner role cannot be edited or removed
                                            if (row.role === 'owner') {
                                                return null
                                            }

                                            const currentMember = members.find((m) => m.userId === user?.id)
                                            if (!currentMember) return null

                                            // Use canManageRole utility from @universo/types
                                            if (!canManageRole(currentMember.role, row.role)) {
                                                return null
                                            }

                                            const descriptors = memberActions

                                            return (
                                                <BaseEntityMenu<UnikMember, MemberFormData>
                                                    entity={row}
                                                    entityKind='member'
                                                    descriptors={[...descriptors]}
                                                    namespace='uniks'
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

                    {/* Table Pagination at bottom - only show when there's data */}
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
                loading={memberMutations.isInviting}
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

            {/* Independent ConfirmDeleteDialog for Remove button in edit dialog */}
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
                    if (removeDialogState.member && unikId) {
                        try {
                            await removeMember.mutateAsync(removeDialogState.member.id)
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

export default UnikMembers
