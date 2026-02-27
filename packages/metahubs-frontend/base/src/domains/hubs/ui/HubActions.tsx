import { Alert, Checkbox, Divider, FormControlLabel, Stack } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import type { ActionDescriptor, ActionContext } from '@universo/template-mui'
import { LocalizedInlineField, useCodenameAutoFill, notifyError } from '@universo/template-mui'
import { HUB_COPY_OPTION_KEYS, type HubCopyOptionKey, type VersionedLocalizedContent } from '@universo/types'
import { normalizeHubCopyOptions } from '@universo/utils'
import type { Hub, HubDisplay, HubLocalizedPayload } from '../../../types'
import { getVLCString } from '../../../types'
import { sanitizeCodename, isValidCodename } from '../../../utils/codename'
import { extractLocalizedInput, ensureLocalizedContent, hasPrimaryContent, normalizeLocale } from '../../../utils/localizedInput'
import { CodenameField } from '../../../components'

type HubFormValues = Record<string, unknown>
type HubFormSetValue = (name: string, value: unknown) => void
type HubDialogTabArgs = {
    values: HubFormValues
    setValue: HubFormSetValue
    isLoading: boolean
    errors?: Record<string, string>
}

const buildInitialValues = (ctx: ActionContext<HubDisplay, HubLocalizedPayload>) => {
    const hubMap = ctx.hubMap as Map<string, Hub> | undefined
    const raw = hubMap?.get(ctx.entity.id)
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)
    const nameFallback = ctx.entity?.name || ctx.entity?.codename || ''
    const descriptionFallback = ctx.entity?.description || ''

    return {
        nameVlc: ensureLocalizedContent(raw?.name ?? ctx.entity?.name, uiLocale, nameFallback),
        descriptionVlc: ensureLocalizedContent(raw?.description ?? ctx.entity?.description, uiLocale, descriptionFallback),
        codename: raw?.codename ?? ctx.entity?.codename ?? '',
        codenameTouched: true
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

const buildCopyInitialValues = (ctx: ActionContext<HubDisplay, HubLocalizedPayload>) => {
    const initial = buildInitialValues(ctx)
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)

    return {
        ...initial,
        nameVlc: appendLocalizedCopySuffix(
            initial.nameVlc as VersionedLocalizedContent<string> | null | undefined,
            uiLocale,
            ctx.entity?.name || ctx.entity?.codename || ''
        ),
        codenameTouched: false,
        ...normalizeHubCopyOptions()
    }
}

const getHubCopyOptions = (values: Record<string, unknown>) => {
    return normalizeHubCopyOptions({
        copyAllRelations: values.copyAllRelations as boolean | undefined,
        copyCatalogRelations: values.copyCatalogRelations as boolean | undefined,
        copyEnumerationRelations: values.copyEnumerationRelations as boolean | undefined
    })
}

const setAllHubCopyChildren = (setValue: (name: string, value: unknown) => void, checked: boolean): void => {
    for (const key of HUB_COPY_OPTION_KEYS) {
        setValue(key, checked)
    }
    setValue('copyAllRelations', checked)
}

const toggleHubCopyChild = (
    setValue: (name: string, value: unknown) => void,
    key: HubCopyOptionKey,
    checked: boolean,
    values: Record<string, unknown>
): void => {
    setValue(key, checked)
    const nextOptions = getHubCopyOptions({
        ...values,
        [key]: checked,
        copyAllRelations: false
    })
    setValue('copyAllRelations', nextOptions.copyAllRelations)
}

const validateHubForm = (ctx: ActionContext<HubDisplay, HubLocalizedPayload>, values: HubFormValues) => {
    const errors: Record<string, string> = {}
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    if (!hasPrimaryContent(nameVlc)) {
        errors.nameVlc = ctx.t('common:crud.nameRequired', 'Name is required')
    }
    const rawCodename = typeof values.codename === 'string' ? values.codename : ''
    const normalizedCodename = sanitizeCodename(rawCodename)
    if (!normalizedCodename) {
        errors.codename = ctx.t('hubs.validation.codenameRequired', 'Codename is required')
    } else if (!isValidCodename(normalizedCodename)) {
        errors.codename = ctx.t('hubs.validation.codenameInvalid', 'Codename contains invalid characters')
    }
    return Object.keys(errors).length > 0 ? errors : null
}

const canSaveHubForm = (values: HubFormValues) => {
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const rawCodename = typeof values.codename === 'string' ? values.codename : ''
    const normalizedCodename = sanitizeCodename(rawCodename)
    return hasPrimaryContent(nameVlc) && Boolean(normalizedCodename) && isValidCodename(normalizedCodename)
}

const toPayload = (values: HubFormValues): HubLocalizedPayload => {
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const descriptionVlc = values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
    const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
    const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)
    const codename = sanitizeCodename(String(values.codename || ''))

    return {
        codename,
        name: nameInput ?? {},
        description: descriptionInput,
        namePrimaryLocale,
        descriptionPrimaryLocale
    }
}

const HubEditFields = ({
    values,
    setValue,
    isLoading,
    errors,
    t,
    uiLocale
}: {
    values: HubFormValues
    setValue: HubFormSetValue
    isLoading: boolean
    errors?: Record<string, string>
    t: ActionContext<HubDisplay, HubLocalizedPayload>['t']
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
                label={t('hubs.codename', 'Codename')}
                helperText={t('hubs.codenameHelper', 'Unique identifier')}
                error={fieldErrors.codename}
                disabled={isLoading}
                required
            />
        </Stack>
    )
}

const HubCopyOptionsTab = ({
    values,
    setValue,
    isLoading,
    t
}: {
    values: HubFormValues
    setValue: HubFormSetValue
    isLoading: boolean
    t: ActionContext<HubDisplay, HubLocalizedPayload>['t']
}) => {
    const options = getHubCopyOptions(values)
    const allChildrenChecked = HUB_COPY_OPTION_KEYS.every((key) => options[key])
    const hasCheckedChildren = HUB_COPY_OPTION_KEYS.some((key) => options[key])

    return (
        <Stack spacing={1}>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={allChildrenChecked}
                        indeterminate={!allChildrenChecked && hasCheckedChildren}
                        onChange={(event) => setAllHubCopyChildren(setValue, event.target.checked)}
                        disabled={isLoading}
                    />
                }
                label={t('hubs.copy.options.copyAllRelations', 'Copy all relations')}
            />
            <FormControlLabel
                control={
                    <Checkbox
                        checked={options.copyCatalogRelations}
                        onChange={(event) => toggleHubCopyChild(setValue, 'copyCatalogRelations', event.target.checked, values)}
                        disabled={isLoading}
                    />
                }
                label={t('hubs.copy.options.copyCatalogRelations', 'Catalog relations')}
            />
            <FormControlLabel
                control={
                    <Checkbox
                        checked={options.copyEnumerationRelations}
                        onChange={(event) => toggleHubCopyChild(setValue, 'copyEnumerationRelations', event.target.checked, values)}
                        disabled={isLoading}
                    />
                }
                label={t('hubs.copy.options.copyEnumerationRelations', 'Enumeration relations')}
            />
            <Alert severity='info' sx={{ py: 0.5 }}>
                {t('hubs.copy.options.singleHubNotice', 'Relations to entities with the "Single hub" restriction will not be copied.')}
            </Alert>
        </Stack>
    )
}

const hubActions: readonly ActionDescriptor<HubDisplay, HubLocalizedPayload>[] = [
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
                    title: ctx.t('hubs.editTitle', 'Edit Hub'),
                    nameLabel: ctx.t('common:fields.name'),
                    descriptionLabel: ctx.t('common:fields.description'),
                    saveButtonText: ctx.t('common:actions.save'),
                    savingButtonText: ctx.t('common:actions.saving'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    hideDefaultFields: true,
                    initialExtraValues: initial,
                    extraFields: ({ values, setValue, isLoading, errors }: HubDialogTabArgs) => (
                        <HubEditFields
                            values={values}
                            setValue={setValue}
                            isLoading={isLoading}
                            errors={errors}
                            t={ctx.t}
                            uiLocale={ctx.uiLocale as string}
                        />
                    ),
                    validate: (values: HubFormValues) => validateHubForm(ctx, values),
                    canSave: canSaveHubForm,
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
                            console.error('Failed to refresh hubs list after edit', e)
                        }
                    },
                    onSave: async (data: HubFormValues) => {
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
        order: 11,
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
                    title: ctx.t('hubs.copyTitle', 'Copying Hub'),
                    nameLabel: ctx.t('common:fields.name'),
                    descriptionLabel: ctx.t('common:fields.description'),
                    saveButtonText: ctx.t('hubs.copy.action', 'Copy'),
                    savingButtonText: ctx.t('hubs.copy.actionLoading', 'Copying...'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    hideDefaultFields: true,
                    initialExtraValues: initial,
                    tabs: ({ values, setValue, isLoading, errors }: HubDialogTabArgs) => [
                        {
                            id: 'general',
                            label: ctx.t('hubs.tabs.general', 'General'),
                            content: (
                                <HubEditFields
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
                            id: 'options',
                            label: ctx.t('hubs.tabs.options', 'Options'),
                            content: <HubCopyOptionsTab values={values} setValue={setValue} isLoading={isLoading} t={ctx.t} />
                        }
                    ],
                    validate: (values: HubFormValues) => validateHubForm(ctx, values),
                    canSave: canSaveHubForm,
                    onClose: () => {
                        // BaseEntityMenu handles dialog closing
                    },
                    onSuccess: async () => {
                        try {
                            await ctx.helpers?.refreshList?.()
                        } catch (e) {
                            // eslint-disable-next-line no-console
                            console.error('Failed to refresh hubs list after copy', e)
                        }
                    },
                    onSave: async (data: HubFormValues) => {
                        try {
                            const payload = toPayload(data)
                            const copyOptions = getHubCopyOptions(data)
                            await ctx.api?.copyEntity?.(ctx.entity.id, {
                                ...payload,
                                ...copyOptions
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
        // Use custom onSelect to open HubDeleteDialog with blocking catalogs check
        onSelect: async (ctx) => {
            // Open the HubDeleteDialog via helper (defined in HubList.tsx)
            ctx.helpers?.openDeleteDialog?.(ctx.entity)
        }
    }
]

export default hubActions
