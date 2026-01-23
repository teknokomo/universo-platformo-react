import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import type { ActionDescriptor, ActionContext } from '@universo/template-mui'
import { LocalizedInlineField, notifyError } from '@universo/template-mui'
import type { VersionedLocalizedContent } from '@universo/types'
import type { Metahub, MetahubDisplay, MetahubLocalizedPayload } from '../../../types'
import { extractLocalizedInput, ensureLocalizedContent, hasPrimaryContent, normalizeLocale } from '../../../utils/localizedInput'

const buildInitialValues = (ctx: ActionContext<MetahubDisplay, MetahubLocalizedPayload>) => {
    const metahubMap = ctx.metahubMap as Map<string, Metahub> | undefined
    const raw = metahubMap?.get(ctx.entity.id)
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)
    const nameFallback = ctx.entity?.name || ''
    const descriptionFallback = ctx.entity?.description || ''

    return {
        nameVlc: ensureLocalizedContent(raw?.name ?? ctx.entity?.name, uiLocale, nameFallback),
        descriptionVlc: ensureLocalizedContent(raw?.description ?? ctx.entity?.description, uiLocale, descriptionFallback)
    }
}

const validateMetahubForm = (ctx: ActionContext<MetahubDisplay, MetahubLocalizedPayload>, values: Record<string, any>) => {
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    if (!hasPrimaryContent(nameVlc)) {
        return { nameVlc: ctx.t('common:crud.nameRequired', 'Name is required') }
    }
    return null
}

const canSaveMetahubForm = (values: Record<string, any>) => {
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    return hasPrimaryContent(nameVlc)
}

const toPayload = (values: Record<string, any>): MetahubLocalizedPayload => {
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const descriptionVlc = values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined

    const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
    const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)

    return {
        name: nameInput ?? {},
        description: descriptionInput,
        namePrimaryLocale,
        descriptionPrimaryLocale
    }
}

const metahubActions: readonly ActionDescriptor<MetahubDisplay, MetahubLocalizedPayload>[] = [
    {
        id: 'edit',
        labelKey: 'common:actions.edit',
        icon: <EditIcon />,
        order: 10,
        dialog: {
            loader: async () => {
                const module = await import('@universo/template-mui/components/dialogs')
                return { default: module.EntityFormDialog }
            },
            buildProps: (ctx) => {
                const initial = buildInitialValues(ctx)
                return {
                    open: true,
                    mode: 'edit' as const,
                    title: ctx.t('editTitle'),
                    nameLabel: ctx.t('common:fields.name'),
                    descriptionLabel: ctx.t('common:fields.description'),
                    saveButtonText: ctx.t('common:actions.save'),
                    savingButtonText: ctx.t('common:actions.saving'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    hideDefaultFields: true,
                    initialExtraValues: initial,
                    extraFields: ({ values, setValue, isLoading, errors }: any) => {
                        const fieldErrors = errors ?? {}
                        const Stack = require('@mui/material').Stack
                        return (
                            <Stack spacing={2}>
                                <LocalizedInlineField
                                    mode='localized'
                                    label={ctx.t('common:fields.name')}
                                    required
                                    disabled={isLoading}
                                    value={values.nameVlc ?? null}
                                    onChange={(next) => setValue('nameVlc', next)}
                                    error={fieldErrors.nameVlc || null}
                                    helperText={fieldErrors.nameVlc}
                                    uiLocale={ctx.uiLocale as string}
                                />
                                <LocalizedInlineField
                                    mode='localized'
                                    label={ctx.t('common:fields.description')}
                                    disabled={isLoading}
                                    value={values.descriptionVlc ?? null}
                                    onChange={(next) => setValue('descriptionVlc', next)}
                                    uiLocale={ctx.uiLocale as string}
                                    multiline
                                    rows={2}
                                />
                            </Stack>
                        )
                    },
                    validate: (values: Record<string, any>) => validateMetahubForm(ctx, values),
                    canSave: canSaveMetahubForm,
                    showDeleteButton: true,
                    deleteButtonText: ctx.t('common:actions.delete'),
                    onDelete: () => {
                        ctx.helpers?.openDeleteDialog?.(ctx.entity)
                    },
                    onClose: () => {
                        // BaseEntityMenu handles dialog closing
                    },
                    onSuccess: async () => {
                        try {
                            await ctx.helpers?.refreshList?.()
                        } catch (e) {
                            // eslint-disable-next-line no-console
                            console.error('Failed to refresh metahubs list after edit', e)
                        }
                    },
                    onSave: async (data: Record<string, any>) => {
                        try {
                            const payload = toPayload(data)
                            await ctx.api?.updateEntity?.(ctx.entity.id, payload)
                            await ctx.helpers?.refreshList?.()
                        } catch (error: unknown) {
                            notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
                            throw error
                        }
                    }
                }
            }
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
                const module = await import('@universo/template-mui/components/dialogs')
                return { default: module.ConfirmDeleteDialog }
            },
            buildProps: (ctx) => ({
                open: true,
                title: ctx.t('confirmDelete'),
                description: ctx.t('confirmDeleteDescription', { name: ctx.entity.name }),
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
]

export default metahubActions
