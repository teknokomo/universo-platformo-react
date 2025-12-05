import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import type { ActionDescriptor, ActionContext } from '../components/menu'

/**
 * Configuration for standard CRUD entity actions (edit, delete)
 */
export interface EntityActionsConfig<TEntity, TFormData> {
    /**
     * i18n namespace prefix for translation keys
     * @example 'metaverses' → uses 'metaverses.editTitle', 'metaverses.confirmDelete'
     */
    i18nPrefix: string

    /**
     * Custom translation keys (overrides default pattern)
     */
    i18nKeys?: {
        editTitle?: string
        confirmDelete?: string
        confirmDeleteDescription?: string
    }

    /**
     * Whether to show delete button in edit dialog
     * @default true
     */
    showDeleteInEdit?: boolean

    /**
     * Whether the delete button in edit dialog should be disabled
     * @default false
     */
    deleteButtonDisabledInEdit?: boolean

    /**
     * Extract entity name for delete confirmation
     * @default (entity) => entity.name
     */
    getEntityName?: (entity: TEntity) => string

    /**
     * Extract initial form data for edit dialog
     */
    getInitialFormData: (entity: TEntity) => Partial<TFormData> & {
        initialName?: string
        initialDescription?: string
    }

    /**
     * Custom form field labels (overrides common: namespace)
     */
    formLabels?: {
        name?: string
        description?: string
        [key: string]: string | undefined
    }
}

/**
 * Standardized error notification helper
 * Extracted from duplicated code in MetaverseActions/EntityActions/SectionActions
 *
 * @param t - Translation function for error messages
 * @param enqueueSnackbar - Notistack's enqueueSnackbar function
 *                          Using 'any' type to support both notistack v2 (function signature)
 *                          and v3 (object signature) API without complex conditional types.
 *                          This is an acceptable trade-off for library compatibility.
 * @param error - Error object to extract message from (supports Axios errors, Error instances, strings)
 */
export function notifyError(
    t: (key: string, defaultValue?: string) => string,
    enqueueSnackbar: any, // Compatibility layer for notistack v2/v3 API differences
    error: unknown
): void {
    if (!enqueueSnackbar) return

    const fallback = t('common:error', 'Operation failed')
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
 * Factory function to create standard edit/delete actions for an entity type
 *
 * @example Basic usage (Metaverse)
 * const metaverseActions = createEntityActions<Metaverse, MetaverseData>({
 *   i18nPrefix: 'metaverses',
 *   getInitialFormData: (entity) => ({ initialName: entity.name, initialDescription: entity.description })
 * })
 *
 * @example Custom entity name (Section)
 * const sectionActions = createEntityActions<Section, SectionData>({
 *   i18nPrefix: 'sections',
 *   getEntityName: (section) => section.title || section.name,
 *   getInitialFormData: (entity) => ({ initialName: entity.name, initialDescription: entity.description })
 * })
 */
export function createEntityActions<TEntity extends { id: string; name: string }, TFormData>(
    config: EntityActionsConfig<TEntity, TFormData>
): readonly ActionDescriptor<TEntity, TFormData>[] {
    const {
        i18nPrefix,
        i18nKeys = {},
        showDeleteInEdit = true,
        deleteButtonDisabledInEdit = false,
        getEntityName = (entity) => entity.name,
        getInitialFormData,
        formLabels = {}
    } = config

    // Default i18n key patterns
    // Keys should be relative to the namespace (no prefix)
    // When namespace='clusters', t('editTitle') resolves to 'clusters:editTitle'
    const editTitleKey = i18nKeys.editTitle || `editTitle`
    const confirmDeleteKey = i18nKeys.confirmDelete || `confirmDelete`
    const confirmDeleteDescKey = i18nKeys.confirmDeleteDescription || `confirmDeleteDescription`

    type ExtendedActionContext = ActionContext<TEntity, TFormData> & {
        helpers?: ActionContext<TEntity, TFormData>['helpers'] & {
            openDeleteDialog?: (entity: TEntity) => void
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
                    return { default: module.EntityFormDialog }
                },
                buildProps: (ctx: ExtendedActionContext) => ({
                    open: true,
                    mode: 'edit' as const,
                    title: ctx.t(editTitleKey),
                    nameLabel: formLabels.name || ctx.t('common:fields.name'),
                    descriptionLabel: formLabels.description || ctx.t('common:fields.description'),
                    saveButtonText: ctx.t('common:actions.save'),
                    savingButtonText: ctx.t('common:actions.saving'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    ...getInitialFormData(ctx.entity),
                    showDeleteButton: showDeleteInEdit,
                    deleteButtonDisabled: deleteButtonDisabledInEdit,
                    deleteButtonText: ctx.t('common:actions.delete'),
                    onClose: () => {
                        // BaseEntityMenu handles dialog closing
                    },
                    onSuccess: async () => {
                        try {
                            await ctx.helpers?.refreshList?.()
                        } catch (e) {
                            // eslint-disable-next-line no-console
                            console.error(`Failed to refresh ${i18nPrefix} list after edit`, e)
                        }
                    },
                    onDelete: () => {
                        ctx.helpers?.openDeleteDialog?.(ctx.entity)
                    },
                    onSave: async (data: TFormData) => {
                        try {
                            await ctx.api?.updateEntity?.(ctx.entity.id, data)
                            await ctx.helpers?.refreshList?.()
                        } catch (error: unknown) {
                            notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
                            throw error
                        }
                    }
                })
            }
        },
        {
            id: 'delete',
            labelKey: 'common:actions.delete',
            icon: <DeleteIcon />,
            order: 100,
            group: 'danger',
            dialog: {
                loader: async () => {
                    const module = await import('../components/dialogs')
                    return { default: module.ConfirmDeleteDialog }
                },
                buildProps: (ctx: ExtendedActionContext) => ({
                    open: true,
                    title: ctx.t(confirmDeleteKey),
                    description: ctx.t(confirmDeleteDescKey, { name: getEntityName(ctx.entity) }),
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
                            notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
                            throw error
                        }
                    }
                })
            }
        }
    ] as const
}
