import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { Checkbox, FormControlLabel } from '@mui/material'
import type { ActionDescriptor, ActionContext } from '@universo/template-mui'
import { LocalizedInlineField, notifyError } from '@universo/template-mui'
import type { VersionedLocalizedContent } from '@universo/types'
import type { Application, ApplicationDisplay, ApplicationLocalizedPayload } from '../types'
import { extractLocalizedInput, ensureLocalizedContent, hasPrimaryContent, normalizeLocale } from '../utils/localizedInput'

const buildInitialValues = (ctx: ActionContext<ApplicationDisplay, ApplicationLocalizedPayload>) => {
    const applicationMap = ctx.applicationMap as Map<string, Application> | undefined
    const raw = applicationMap?.get(ctx.entity.id)
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)
    const nameFallback = ctx.entity?.name || ''
    const descriptionFallback = ctx.entity?.description || ''

    return {
        nameVlc: ensureLocalizedContent(raw?.name ?? ctx.entity?.name, uiLocale, nameFallback),
        descriptionVlc: ensureLocalizedContent(raw?.description ?? ctx.entity?.description, uiLocale, descriptionFallback)
    }
}

const appendLocalizedCopySuffix = (
    value: VersionedLocalizedContent<string> | null | undefined,
    uiLocale: string,
    fallback?: string
): VersionedLocalizedContent<string> | null => {
    if (!value) {
        const locale = normalizeLocale(uiLocale)
        const suffix = locale === 'ru' ? ' (копия)' : ' (copy)'
        const content = (fallback || '').trim()
        const nextContent = content ? `${content}${suffix}` : locale === 'ru' ? `Копия${suffix}` : `Copy${suffix}`
        return {
            _schema: 'v1',
            _primary: locale,
            locales: {
                [locale]: { content: nextContent }
            }
        }
    }

    const nextLocales = { ...(value.locales || {}) } as Record<string, { content?: string }>
    const localeEntries = Object.entries(nextLocales)
    for (const [locale, localeValue] of localeEntries) {
        const normalizedLocale = normalizeLocale(locale)
        const suffix = normalizedLocale === 'ru' ? ' (копия)' : ' (copy)'
        const content = typeof localeValue?.content === 'string' ? localeValue.content.trim() : ''
        if (content.length > 0) {
            nextLocales[locale] = { ...localeValue, content: `${content}${suffix}` }
        }
    }

    const hasAnyContent = Object.values(nextLocales).some((entry) => typeof entry?.content === 'string' && entry.content.trim().length > 0)
    if (!hasAnyContent) {
        const locale = normalizeLocale(uiLocale)
        const suffix = locale === 'ru' ? ' (копия)' : ' (copy)'
        const content = (fallback || '').trim()
        nextLocales[locale] = { content: content ? `${content}${suffix}` : locale === 'ru' ? `Копия${suffix}` : `Copy${suffix}` }
    }

    return {
        ...value,
        locales: nextLocales
    }
}

const buildCopyInitialValues = (ctx: ActionContext<ApplicationDisplay, ApplicationLocalizedPayload>) => {
    const initial = buildInitialValues(ctx)
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)

    return {
        ...initial,
        nameVlc: appendLocalizedCopySuffix(
            initial.nameVlc as VersionedLocalizedContent<string> | null | undefined,
            uiLocale,
            ctx.entity?.name || ''
        ),
        copyAccess: false
    }
}

const validateApplicationForm = (ctx: ActionContext<ApplicationDisplay, ApplicationLocalizedPayload>, values: Record<string, any>) => {
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    if (!hasPrimaryContent(nameVlc)) {
        return { nameVlc: ctx.t('common:crud.nameRequired', 'Name is required') }
    }
    return null
}

const canSaveApplicationForm = (values: Record<string, any>) => {
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    return hasPrimaryContent(nameVlc)
}

const toPayload = (values: Record<string, any>): ApplicationLocalizedPayload => {
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

const applicationActions: readonly ActionDescriptor<ApplicationDisplay, ApplicationLocalizedPayload>[] = [
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
                        return (
                            <>
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
                            </>
                        )
                    },
                    validate: (values: Record<string, any>) => validateApplicationForm(ctx, values),
                    canSave: canSaveApplicationForm,
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
                            console.error('Failed to refresh applications list after edit', e)
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
        id: 'copy',
        labelKey: 'common:actions.copy',
        icon: <ContentCopyIcon />,
        order: 20,
        dialog: {
            loader: async () => {
                const module = await import('@universo/template-mui/components/dialogs')
                return { default: module.EntityFormDialog }
            },
            buildProps: (ctx) => {
                const initial = buildCopyInitialValues(ctx)
                return {
                    open: true,
                    mode: 'create' as const,
                    title: ctx.t('copyTitle', 'Copying Application'),
                    nameLabel: ctx.t('common:fields.name'),
                    descriptionLabel: ctx.t('common:fields.description'),
                    saveButtonText: ctx.t('copy.action', 'Copy'),
                    savingButtonText: ctx.t('copy.actionLoading', 'Copying...'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    hideDefaultFields: true,
                    initialExtraValues: initial,
                    extraFields: ({ values, setValue, isLoading, errors }: any) => {
                        const fieldErrors = errors ?? {}
                        return (
                            <>
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
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={Boolean(values.copyAccess ?? false)}
                                            onChange={(event) => setValue('copyAccess', event.target.checked)}
                                            disabled={isLoading}
                                        />
                                    }
                                    label={ctx.t('copy.copyAccess', 'Copy access permissions')}
                                />
                            </>
                        )
                    },
                    validate: (values: Record<string, any>) => validateApplicationForm(ctx, values),
                    canSave: canSaveApplicationForm,
                    onClose: () => {
                        // BaseEntityMenu handles dialog closing
                    },
                    onSuccess: async () => {
                        try {
                            await ctx.helpers?.refreshList?.()
                        } catch (e) {
                            // eslint-disable-next-line no-console
                            console.error('Failed to refresh applications list after copy', e)
                        }
                    },
                    onSave: async (data: Record<string, any>) => {
                        try {
                            const payload = toPayload(data)
                            await ctx.api?.copyEntity?.(ctx.entity.id, {
                                ...payload,
                                copyAccess: Boolean(data.copyAccess ?? false)
                            })
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
        tone: 'danger',
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

export default applicationActions
