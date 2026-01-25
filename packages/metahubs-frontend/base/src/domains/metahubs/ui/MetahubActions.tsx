import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { Stack, Divider, Box, RadioGroup, FormControlLabel, Radio, Typography } from '@mui/material'
import type { ActionDescriptor, ActionContext } from '@universo/template-mui'
import { LocalizedInlineField, useCodenameAutoFill, notifyError } from '@universo/template-mui'
import type { VersionedLocalizedContent } from '@universo/types'
import type { Metahub, MetahubDisplay, MetahubLocalizedPayload } from '../../../types'
import { getVLCString } from '../../../types'
import { sanitizeCodename, isValidCodename } from '../../../utils/codename'
import { extractLocalizedInput, ensureLocalizedContent, hasPrimaryContent, normalizeLocale } from '../../../utils/localizedInput'
import { CodenameField } from '../../../components'

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
        storageMode: 'main_db'
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
    }
) => {
    const storageMode = values.storageMode ?? 'main_db'

    return [
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
                        <FormControlLabel
                            value="main_db"
                            control={<Radio />}
                            label={ctx.t('storage.mainDb')}
                            disabled={isLoading}
                        />
                        <FormControlLabel
                            value="external_db"
                            control={<Radio />}
                            label={
                                <Box>
                                    <Typography variant="body1">{ctx.t('storage.externalDb')}</Typography>
                                    <Typography variant="caption" color="text.secondary">
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
                    tabs: (args: { values: Record<string, any>; setValue: (name: string, value: any) => void; isLoading: boolean; errors?: Record<string, string> }) =>
                        buildEditTabs(ctx, args),
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
