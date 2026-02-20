import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { Stack, Divider, Box, RadioGroup, FormControlLabel, Radio, Typography, Checkbox } from '@mui/material'
import type { ActionDescriptor, ActionContext } from '@universo/template-mui'
import { LocalizedInlineField, useCodenameAutoFill, notifyError } from '@universo/template-mui'
import type { VersionedLocalizedContent } from '@universo/types'
import type { Metahub, MetahubDisplay, MetahubLocalizedPayload } from '../../../types'
import { getVLCString } from '../../../types'
import { sanitizeCodename, isValidCodename } from '../../../utils/codename'
import { extractLocalizedInput, ensureLocalizedContent, hasPrimaryContent, normalizeLocale } from '../../../utils/localizedInput'
import { CodenameField } from '../../../components'
import { TemplateSelector } from '../../templates/ui/TemplateSelector'

const buildInitialValues = (ctx: ActionContext<MetahubDisplay, MetahubLocalizedPayload>) => {
    const metahubMap = ctx.metahubMap as Map<string, Metahub> | undefined
    const raw = metahubMap?.get(ctx.entity.id)
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)
    const nameFallback = ctx.entity?.name || ''
    const descriptionFallback = ctx.entity?.description || ''

    return {
        nameVlc: ensureLocalizedContent(raw?.name ?? ctx.entity?.name, uiLocale, nameFallback),
        descriptionVlc: ensureLocalizedContent(raw?.description ?? ctx.entity?.description, uiLocale, descriptionFallback),
        codename: raw?.codename ?? ctx.entity?.codename ?? '',
        codenameTouched: true,
        storageMode: 'main_db',
        templateId: raw?.templateId ?? undefined
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

const buildCopyInitialValues = (ctx: ActionContext<MetahubDisplay, MetahubLocalizedPayload>) => {
    const initial = buildInitialValues(ctx)
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)

    return {
        ...initial,
        nameVlc: appendLocalizedCopySuffix(
            initial.nameVlc as VersionedLocalizedContent<string> | null | undefined,
            uiLocale,
            ctx.entity?.name || ''
        ),
        codenameTouched: false,
        copyDefaultBranchOnly: true,
        copyAccess: false
    }
}

const validateMetahubForm = (ctx: ActionContext<MetahubDisplay, MetahubLocalizedPayload>, values: Record<string, any>) => {
    const errors: Record<string, string> = {}
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    if (!hasPrimaryContent(nameVlc)) {
        errors.nameVlc = ctx.t('common:crud.nameRequired', 'Name is required')
    }
    const rawCodename = typeof values.codename === 'string' ? values.codename : ''
    const normalizedCodename = sanitizeCodename(rawCodename)
    if (!normalizedCodename) {
        errors.codename = ctx.t('validation.codenameRequired', 'Codename is required')
    } else if (!isValidCodename(normalizedCodename)) {
        errors.codename = ctx.t('validation.codenameInvalid', 'Codename contains invalid characters')
    }
    return Object.keys(errors).length > 0 ? errors : null
}

const canSaveMetahubForm = (values: Record<string, any>) => {
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const rawCodename = typeof values.codename === 'string' ? values.codename : ''
    const normalizedCodename = sanitizeCodename(rawCodename)
    return hasPrimaryContent(nameVlc) && Boolean(normalizedCodename) && isValidCodename(normalizedCodename)
}

const toPayload = (values: Record<string, any>): MetahubLocalizedPayload => {
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const descriptionVlc = values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
    const codename = sanitizeCodename(String(values.codename || ''))

    const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
    const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)

    return {
        codename,
        name: nameInput ?? {},
        description: descriptionInput,
        namePrimaryLocale,
        descriptionPrimaryLocale
    }
}

const MetahubEditFields = ({
    values,
    setValue,
    isLoading,
    errors,
    t,
    uiLocale
}: {
    values: Record<string, any>
    setValue: (name: string, value: any) => void
    isLoading: boolean
    errors?: Record<string, string>
    t: ActionContext<MetahubDisplay, MetahubLocalizedPayload>['t']
    uiLocale?: string
}) => {
    const fieldErrors = errors ?? {}
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const descriptionVlc = values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
    const codename = typeof values.codename === 'string' ? values.codename : ''
    const codenameTouched = Boolean(values.codenameTouched)
    const primaryLocale = nameVlc?._primary ?? normalizeLocale(uiLocale)
    const nameValue = getVLCString(nameVlc || undefined, primaryLocale)
    const nextCodename = sanitizeCodename(nameValue)

    useCodenameAutoFill({
        codename,
        codenameTouched,
        nextCodename,
        nameValue,
        setValue: setValue as (field: 'codename' | 'codenameTouched', value: string | boolean) => void
    })

    return (
        <Stack spacing={2}>
            <LocalizedInlineField
                mode='localized'
                label={t('common:fields.name')}
                required
                disabled={isLoading}
                value={values.nameVlc ?? null}
                onChange={(next) => setValue('nameVlc', next)}
                error={fieldErrors.nameVlc || null}
                helperText={fieldErrors.nameVlc}
                uiLocale={uiLocale as string}
            />
            <LocalizedInlineField
                mode='localized'
                label={t('common:fields.description')}
                disabled={isLoading}
                value={descriptionVlc}
                onChange={(next) => setValue('descriptionVlc', next)}
                uiLocale={uiLocale as string}
                multiline
                rows={2}
            />
            <TemplateSelector
                value={values.templateId}
                onChange={() => {}} // Read-only in edit mode
                disabled
            />
            <Divider />
            <CodenameField
                value={codename}
                onChange={(value) => setValue('codename', value)}
                touched={codenameTouched}
                onTouchedChange={(touched) => setValue('codenameTouched', touched)}
                label={t('codename', 'Codename')}
                helperText={t('codenameHelper', 'Unique identifier')}
                error={fieldErrors.codename}
                disabled={isLoading}
                required
            />
        </Stack>
    )
}

const buildEditTabs = (
    ctx: ActionContext<MetahubDisplay, MetahubLocalizedPayload>,
    {
        values,
        setValue,
        isLoading,
        errors
    }: {
        values: Record<string, any>
        setValue: (name: string, value: any) => void
        isLoading: boolean
        errors?: Record<string, string>
    },
    options?: { includeCopyOptions?: boolean }
) => {
    const storageMode = values.storageMode ?? 'main_db'

    const tabs = [
        {
            id: 'general',
            label: ctx.t('tabs.general'),
            content: (
                <MetahubEditFields
                    values={values}
                    setValue={setValue}
                    isLoading={isLoading}
                    errors={errors}
                    t={ctx.t}
                    uiLocale={ctx.uiLocale as string}
                />
            )
        },
        {
            id: 'storage',
            label: ctx.t('tabs.storage'),
            content: (
                <Box sx={{ mt: 2 }}>
                    <RadioGroup value={storageMode} onChange={(e) => setValue('storageMode', e.target.value)}>
                        <FormControlLabel value='main_db' control={<Radio />} label={ctx.t('storage.mainDb')} disabled={isLoading} />
                        <FormControlLabel
                            value='external_db'
                            control={<Radio />}
                            label={
                                <Box>
                                    <Typography variant='body1'>{ctx.t('storage.externalDb')}</Typography>
                                    <Typography variant='caption' color='text.secondary'>
                                        {ctx.t('storage.externalDbDisabled')}
                                    </Typography>
                                </Box>
                            }
                            disabled={true}
                        />
                    </RadioGroup>
                </Box>
            )
        }
    ]

    if (options?.includeCopyOptions) {
        tabs.push({
            id: 'copy-options',
            label: ctx.t('copy.optionsTab', 'Copy options'),
            content: (
                <Stack sx={{ mt: 1 }}>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={Boolean(values.copyDefaultBranchOnly ?? true)}
                                onChange={(event) => setValue('copyDefaultBranchOnly', event.target.checked)}
                                disabled={isLoading}
                            />
                        }
                        label={ctx.t('copy.copyDefaultBranchOnly', 'Copy only default branch')}
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
                </Stack>
            )
        })
    }

    return tabs
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
                    tabs: (args: {
                        values: Record<string, any>
                        setValue: (name: string, value: any) => void
                        isLoading: boolean
                        errors?: Record<string, string>
                    }) => buildEditTabs(ctx, args),
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
                    title: ctx.t('copyTitle', 'Copying Metahub'),
                    nameLabel: ctx.t('common:fields.name'),
                    descriptionLabel: ctx.t('common:fields.description'),
                    saveButtonText: ctx.t('copy.action', 'Copy'),
                    savingButtonText: ctx.t('copy.actionLoading', 'Copying...'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    hideDefaultFields: true,
                    initialExtraValues: initial,
                    tabs: (args: {
                        values: Record<string, any>
                        setValue: (name: string, value: any) => void
                        isLoading: boolean
                        errors?: Record<string, string>
                    }) => buildEditTabs(ctx, args, { includeCopyOptions: true }),
                    validate: (values: Record<string, any>) => validateMetahubForm(ctx, values),
                    canSave: canSaveMetahubForm,
                    onClose: () => {
                        // BaseEntityMenu handles dialog closing
                    },
                    onSuccess: async () => {
                        try {
                            await ctx.helpers?.refreshList?.()
                        } catch (e) {
                            // eslint-disable-next-line no-console
                            console.error('Failed to refresh metahubs list after copy', e)
                        }
                    },
                    onSave: async (data: Record<string, any>) => {
                        try {
                            const payload = toPayload(data)
                            await ctx.api?.copyEntity?.(ctx.entity.id, {
                                ...payload,
                                copyDefaultBranchOnly: Boolean(data.copyDefaultBranchOnly ?? true),
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

export default metahubActions
