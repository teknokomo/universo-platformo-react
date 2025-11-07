import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import type { ActionContext } from '@universo/template-mui'
import type { MetaverseMember } from '../types'

type MemberData = {
    email: string
    role: string
    comment?: string
}

type MemberActionContext = ActionContext<MetaverseMember, MemberData> & {
    helpers?: ActionContext<MetaverseMember, MemberData>['helpers'] & {
        openDeleteDialog?: (entity: MetaverseMember) => void
    }
}

const notifyError = (ctx: MemberActionContext, error: unknown) => {
    const enqueue = ctx.helpers?.enqueueSnackbar
    if (!enqueue) return

    const fallback = ctx.t('common.error') || 'Operation failed'
    const candidateMessage =
        error && typeof error === 'object' && 'response' in error && typeof (error as any)?.response?.data?.message === 'string'
            ? (error as any).response.data.message
            : error instanceof Error
            ? error.message
            : typeof error === 'string'
            ? error
            : fallback
    const message = candidateMessage && candidateMessage.length > 0 ? candidateMessage : fallback

    if (enqueue.length >= 2) {
        ;(enqueue as (message: string, options?: { variant?: string }) => void)(message, { variant: 'error' })
    } else {
        ;(enqueue as (payload: { message: string; options?: { variant?: string } }) => void)({
            message,
            options: { variant: 'error' }
        })
    }
}

const memberActions = [
    {
        id: 'edit',
        labelKey: 'common:actions.edit',
        icon: <EditIcon />,
        order: 10,
        dialog: {
            loader: async () => {
                const module = await import('@universo/template-mui/components/dialogs')
                return { default: module.MemberFormDialog }
            },
            buildProps: (ctx: MemberActionContext) => ({
                open: true,
                mode: 'edit',
                title: ctx.t('members.editTitle'),
                emailLabel: ctx.t('members.emailLabel'),
                roleLabel: ctx.t('members.roleLabel'),
                commentLabel: ctx.t('members.commentLabel'),
                commentPlaceholder: ctx.t('members.commentPlaceholder'),
                commentCharacterCountFormatter: (count: number, max: number) =>
                    ctx.t('members.validation.commentCharacterCount', { count, max }),
                saveButtonText: ctx.t('common:actions.save'),
                savingButtonText: ctx.t('common:actions.saving'),
                cancelButtonText: ctx.t('common:actions.cancel'),
                initialEmail: ctx.entity.email,
                initialRole: ctx.entity.role,
                initialComment: (ctx.entity as any).comment || '',
                onClose: () => {},
                onSuccess: async () => {
                    try {
                        await ctx.helpers?.refreshList?.()
                    } catch (e) {
                        console.error('Failed to refresh members list after edit', e)
                    }
                },
                onSave: async (data: MemberData) => {
                    try {
                        await ctx.api?.updateEntity?.(ctx.entity.id, data)
                        await ctx.helpers?.refreshList?.()
                    } catch (error: unknown) {
                        notifyError(ctx, error)
                        throw error
                    }
                }
            })
        }
    },
    {
        id: 'remove',
        labelKey: 'common:actions.delete',
        icon: <DeleteIcon />,
        order: 100,
        group: 'danger',
        dialog: {
            loader: async () => {
                const module = await import('@universo/template-mui/components/dialogs')
                return { default: module.ConfirmDeleteDialog }
            },
            buildProps: (ctx: MemberActionContext) => ({
                open: true,
                title: ctx.t('members.confirmRemove'),
                description: ctx.t('members.confirmRemoveDescription', { email: ctx.entity?.email || '' }),
                confirmButtonText: ctx.t('common:actions.delete'),
                cancelButtonText: ctx.t('common:actions.cancel'),
                onCancel: () => {},
                onConfirm: async () => {
                    try {
                        await ctx.api?.deleteEntity?.(ctx.entity.id)
                        await ctx.helpers?.refreshList?.()
                    } catch (error: unknown) {
                        notifyError(ctx, error)
                        throw error
                    }
                }
            })
        }
    }
] as const

export default memberActions
