import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import type { BaseMemberEntity } from '@universo/types'
import type { ActionDescriptor, ActionContext } from '../components/menu'

/**
 * Form data structure for member dialogs
 */
export interface MemberFormData {
    email: string
    role: string
    comment?: string
}

/**
 * Configuration for member management actions (edit, remove)
 * Used across different modules: Metaverses, Uniks, Finances, Projects
 */
export interface MemberActionsConfig<TMember extends BaseMemberEntity> {
    /**
     * i18n namespace prefix for translation keys
     * @example 'metaverses' → uses 'metaverses.members.editTitle', 'metaverses.members.confirmRemove'
     */
    i18nPrefix: string

    /**
     * Entity type name for logging purposes
     * @example 'metaverse', 'unik', 'project'
     */
    entityType: string

    /**
     * Custom translation keys (overrides default pattern)
     */
    i18nKeys?: {
        editTitle?: string
        emailLabel?: string
        roleLabel?: string
        commentLabel?: string
        commentPlaceholder?: string
        commentCharacterCount?: string
        confirmRemove?: string
        confirmRemoveDescription?: string
    }

    /**
     * Extract member email for confirmation dialogs
     * @default (member) => member.email || ''
     */
    getMemberEmail?: (member: TMember) => string

    /**
     * Extract initial form data for edit dialog
     * @default (member) => ({ email: member.email || '', role: member.role, comment: member.comment || '' })
     */
    getInitialFormData?: (member: TMember) => {
        initialEmail: string
        initialRole: string
        initialComment: string
    }

    /**
     * Available roles to select from in the edit dialog
     * @default ['admin', 'editor', 'member']
     */
    availableRoles?: ReadonlyArray<import('@universo/types').AssignableRole>
}

/**
 * Standardized error notification helper for member actions
 * Extracted from MemberActions to ensure consistent error handling
 *
 * @param t - Translation function for error messages
 * @param enqueueSnackbar - Notistack's enqueueSnackbar function
 *                          Using 'any' type to support both notistack v2 (function signature)
 *                          and v3 (object signature) API without complex conditional types.
 * @param error - Error object to extract message from (supports Axios errors, Error instances, strings)
 */
export function notifyMemberError(t: (key: string, defaultValue?: string) => string, enqueueSnackbar: any, error: unknown): void {
    if (!enqueueSnackbar) return

    const fallback = t('common.error', 'Operation failed')
    const candidateMessage =
        error && typeof error === 'object' && 'response' in error && typeof (error as any)?.response?.data?.message === 'string'
            ? (error as any).response.data.message
            : error instanceof Error
            ? error.message
            : typeof error === 'string'
            ? error
            : fallback

    const message = candidateMessage && candidateMessage.length > 0 ? candidateMessage : fallback

    // Handle both notistack v2 and v3 API
    if (typeof enqueueSnackbar === 'function') {
        if (enqueueSnackbar.length >= 2) {
            enqueueSnackbar(message, { variant: 'error' })
        } else {
            enqueueSnackbar({
                message,
                options: { variant: 'error' }
            })
        }
    }
}

/**
 * Factory function to create standard member management actions (edit, remove)
 * Enables code reuse across modules with member management (Metaverses, Uniks, Finances, Projects)
 *
 * @example Basic usage (Metaverses)
 * ```typescript
 * import { createMemberActions } from '@universo/template-mui'
 * import type { MetaverseMember } from '../types'
 *
 * export default createMemberActions<MetaverseMember>({
 *   i18nPrefix: 'metaverses',
 *   entityType: 'metaverse'
 * })
 * ```
 *
 * @example Custom configuration (Uniks)
 * ```typescript
 * export default createMemberActions<UnikMember>({
 *   i18nPrefix: 'uniks',
 *   entityType: 'unik',
 *   getMemberEmail: (member) => member.userEmail || member.email || 'Unknown',
 *   i18nKeys: {
 *     editTitle: 'uniks.access.editMemberTitle'
 *   }
 * })
 * ```
 */
export function createMemberActions<TMember extends BaseMemberEntity>(
    config: MemberActionsConfig<TMember>
): readonly ActionDescriptor<TMember, MemberFormData>[] {
    const {
        i18nPrefix,
        entityType,
        i18nKeys = {},
        availableRoles,
        getMemberEmail = (member) => member.email || '',
        getInitialFormData = (member) => ({
            initialEmail: member.email || '',
            initialRole: member.role,
            initialComment: member.comment || ''
        })
    } = config

    // Default i18n key patterns
    // Note: ctx.t() is called with i18nPrefix as namespace, so keys should be relative to that namespace
    // Example: for i18nPrefix='metaverses', key 'members.editTitle' resolves to 'metaverses:members.editTitle'
    const editTitleKey = i18nKeys.editTitle || 'members.editTitle'
    const emailLabelKey = i18nKeys.emailLabel || 'members.emailLabel'
    const roleLabelKey = i18nKeys.roleLabel || 'members.roleLabel'
    const commentLabelKey = i18nKeys.commentLabel || 'members.commentLabel'
    const commentPlaceholderKey = i18nKeys.commentPlaceholder || 'members.commentPlaceholder'
    const commentCharacterCountKey = i18nKeys.commentCharacterCount || 'members.validation.commentCharacterCount'
    const confirmRemoveKey = i18nKeys.confirmRemove || 'members.confirmRemove'
    const confirmRemoveDescKey = i18nKeys.confirmRemoveDescription || 'members.confirmRemoveDescription'

    type MemberActionContext = ActionContext<TMember, MemberFormData> & {
        helpers?: ActionContext<TMember, MemberFormData>['helpers'] & {
            openDeleteDialog?: (entity: TMember) => void
        }
    }

    return [
        {
            id: 'edit',
            labelKey: 'common:actions.edit',
            icon: <EditIcon />,
            order: 10,
            dialog: {
                loader: async () => {
                    const module = await import('../components/dialogs')
                    return { default: module.MemberFormDialog }
                },
                buildProps: (ctx: MemberActionContext) => ({
                    open: true,
                    mode: 'edit' as const,
                    title: ctx.t(editTitleKey),
                    emailLabel: ctx.t(emailLabelKey),
                    roleLabel: ctx.t(roleLabelKey),
                    commentLabel: ctx.t(commentLabelKey),
                    commentPlaceholder: ctx.t(commentPlaceholderKey),
                    commentCharacterCountFormatter: (count: number, max: number) => ctx.t(commentCharacterCountKey, { count, max }),
                    saveButtonText: ctx.t('common:actions.save'),
                    savingButtonText: ctx.t('common:actions.saving'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    ...(availableRoles && { availableRoles }),
                    ...getInitialFormData(ctx.entity),
                    onClose: () => {
                        // BaseEntityMenu handles dialog closing
                    },
                    onSuccess: async () => {
                        try {
                            await ctx.helpers?.refreshList?.()
                        } catch (e) {
                            // eslint-disable-next-line no-console
                            console.error(`Failed to refresh ${entityType} members list after edit`, e)
                        }
                    },
                    onSave: async (data: MemberFormData) => {
                        try {
                            await ctx.api?.updateEntity?.(ctx.entity.id, data)
                            await ctx.helpers?.refreshList?.()
                        } catch (error: unknown) {
                            notifyMemberError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
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
                    const module = await import('../components/dialogs')
                    return { default: module.ConfirmDeleteDialog }
                },
                buildProps: (ctx: MemberActionContext) => ({
                    open: true,
                    title: ctx.t(confirmRemoveKey),
                    description: ctx.t(confirmRemoveDescKey, { email: getMemberEmail(ctx.entity) }),
                    confirmButtonText: ctx.t('common:actions.delete'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    onCancel: () => {
                        // BaseEntityMenu handles dialog closing
                    },
                    onConfirm: async () => {
                        try {
                            await ctx.api?.deleteEntity?.(ctx.entity.id)
                            await ctx.helpers?.refreshList?.()
                        } catch (error: unknown) {
                            notifyMemberError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
                            throw error
                        }
                    }
                })
            }
        }
    ] as const
}
