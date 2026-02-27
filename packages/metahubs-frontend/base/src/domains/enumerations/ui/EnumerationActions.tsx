import { Checkbox, Divider, FormControlLabel, Stack } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import type { ActionDescriptor, ActionContext } from '@universo/template-mui'
import { LocalizedInlineField, useCodenameAutoFill, notifyError } from '@universo/template-mui'
import type { TabConfig } from '@universo/template-mui/components/dialogs'
import type { VersionedLocalizedContent } from '@universo/types'
import { normalizeEnumerationCopyOptions } from '@universo/utils'
import type { Enumeration, EnumerationDisplay, EnumerationLocalizedPayload, Hub } from '../../../types'
import { getVLCString } from '../../../types'
import { EnumerationWithHubs } from '../api'
import { sanitizeCodename, isValidCodename } from '../../../utils/codename'
import { extractLocalizedInput, ensureLocalizedContent, hasPrimaryContent, normalizeLocale } from '../../../utils/localizedInput'
import { CodenameField, HubSelectionPanel } from '../../../components'

/**
 * Extended EnumerationDisplay type that includes hubId for AllEnumerationsList context
 */
export interface EnumerationDisplayWithHub extends EnumerationDisplay {
    hubId?: string
}

type EnumerationFormValues = Record<string, unknown>
type EnumerationFormSetValue = (name: string, value: unknown) => void
type EnumerationActionContext = ActionContext<EnumerationDisplayWithHub, EnumerationLocalizedPayload> & { hubs?: Hub[] }
type EnumerationDialogTabArgs = {
    values: EnumerationFormValues
    setValue: EnumerationFormSetValue
    isLoading: boolean
    errors?: Record<string, string>
}

const buildInitialValues = (ctx: ActionContext<EnumerationDisplayWithHub, EnumerationLocalizedPayload>) => {
    const enumerationMap = ctx.enumerationMap as Map<string, Enumeration | EnumerationWithHubs> | undefined
    const raw = enumerationMap?.get(ctx.entity.id)
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)
    const nameFallback = ctx.entity?.name || ctx.entity?.codename || ''
    const descriptionFallback = ctx.entity?.description || ''

    // Extract hubIds from EnumerationWithHubs or fallback to single hubId
    let hubIds: string[] = []
    let isSingleHub = false
    let isRequiredHub = false

    if (raw && 'hubs' in raw && Array.isArray((raw as EnumerationWithHubs).hubs)) {
        const catalogWithHubs = raw as EnumerationWithHubs
        hubIds = catalogWithHubs.hubs.map((h) => h.id)
        isSingleHub = Boolean(catalogWithHubs.isSingleHub)
        isRequiredHub = Boolean(catalogWithHubs.isRequiredHub)
    } else if ((ctx.entity as EnumerationDisplayWithHub).hubId) {
        hubIds = [(ctx.entity as EnumerationDisplayWithHub).hubId as string]
    }

    return {
        nameVlc: ensureLocalizedContent(raw?.name ?? ctx.entity?.name, uiLocale, nameFallback),
        descriptionVlc: ensureLocalizedContent(raw?.description ?? ctx.entity?.description, uiLocale, descriptionFallback),
        codename: raw?.codename ?? ctx.entity?.codename ?? '',
        codenameTouched: true,
        hubIds,
        isSingleHub,
        isRequiredHub
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

const buildCopyInitialValues = (ctx: ActionContext<EnumerationDisplayWithHub, EnumerationLocalizedPayload>) => {
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
        ...normalizeEnumerationCopyOptions()
    }
}

const getEnumerationCopyOptions = (values: Record<string, unknown>) => {
    return normalizeEnumerationCopyOptions({
        copyValues: values.copyValues as boolean | undefined
    })
}

const validateCatalogForm = (ctx: ActionContext<EnumerationDisplayWithHub, EnumerationLocalizedPayload>, values: EnumerationFormValues) => {
    const errors: Record<string, string> = {}

    // Hub validation based on isRequiredHub flag
    const isRequiredHub = Boolean(values.isRequiredHub)
    if (isRequiredHub) {
        const hubIds = Array.isArray(values.hubIds) ? values.hubIds : []
        if (hubIds.length === 0) {
            errors.hubIds = ctx.t('enumerations.validation.hubRequired', 'At least one hub is required')
        }
    }

    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    if (!hasPrimaryContent(nameVlc)) {
        errors.nameVlc = ctx.t('common:crud.nameRequired', 'Name is required')
    }
    const rawCodename = typeof values.codename === 'string' ? values.codename : ''
    const normalizedCodename = sanitizeCodename(rawCodename)
    if (!normalizedCodename) {
        errors.codename = ctx.t('enumerations.validation.codenameRequired', 'Codename is required')
    } else if (!isValidCodename(normalizedCodename)) {
        errors.codename = ctx.t('enumerations.validation.codenameInvalid', 'Codename contains invalid characters')
    }
    return Object.keys(errors).length > 0 ? errors : null
}

const canSaveCatalogForm = (values: EnumerationFormValues) => {
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const rawCodename = typeof values.codename === 'string' ? values.codename : ''
    const normalizedCodename = sanitizeCodename(rawCodename)
    const baseValid = hasPrimaryContent(nameVlc) && Boolean(normalizedCodename) && isValidCodename(normalizedCodename)
    // Hub requirement based on isRequiredHub flag in values
    const isRequiredHub = Boolean(values.isRequiredHub)
    if (isRequiredHub) {
        const hubIds = Array.isArray(values.hubIds) ? values.hubIds : []
        return baseValid && hubIds.length > 0
    }
    return baseValid
}

const toPayload = (
    values: EnumerationFormValues
): EnumerationLocalizedPayload & { hubIds?: string[]; isSingleHub?: boolean; isRequiredHub?: boolean } => {
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const descriptionVlc = values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
    const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
    const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)
    const codename = sanitizeCodename(String(values.codename || ''))
    const hubIds = Array.isArray(values.hubIds) ? values.hubIds : undefined
    const isSingleHub = Boolean(values.isSingleHub)
    const isRequiredHub = Boolean(values.isRequiredHub)

    return {
        codename,
        name: nameInput ?? {},
        description: descriptionInput,
        namePrimaryLocale,
        descriptionPrimaryLocale,
        hubIds,
        isSingleHub,
        isRequiredHub
    }
}

/**
 * General tab content component for edit dialog
 */
const GeneralTabFields = ({
    values,
    setValue,
    isLoading,
    errors,
    t,
    uiLocale
}: {
    values: EnumerationFormValues
    setValue: EnumerationFormSetValue
    isLoading: boolean
    errors?: Record<string, string>
    t: ActionContext<EnumerationDisplayWithHub, EnumerationLocalizedPayload>['t']
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
                onChange={(next: VersionedLocalizedContent<string> | null) => setValue('nameVlc', next)}
                error={fieldErrors.nameVlc || null}
                helperText={fieldErrors.nameVlc}
                uiLocale={uiLocale as string}
            />
            <LocalizedInlineField
                mode='localized'
                label={t('common:fields.description')}
                disabled={isLoading}
                value={descriptionVlc ?? null}
                onChange={(next: VersionedLocalizedContent<string> | null) => setValue('descriptionVlc', next)}
                uiLocale={uiLocale as string}
                multiline
                rows={2}
            />
            <Divider />
            <CodenameField
                value={codename}
                onChange={(value: string) => setValue('codename', value)}
                touched={codenameTouched}
                onTouchedChange={(touched: boolean) => setValue('codenameTouched', touched)}
                label={t('enumerations.codename', 'Codename')}
                helperText={t('enumerations.codenameHelper', 'Unique identifier')}
                error={fieldErrors.codename}
                disabled={isLoading}
                required
            />
        </Stack>
    )
}

const EnumerationCopyOptionsTab = ({
    values,
    setValue,
    isLoading,
    t
}: {
    values: EnumerationFormValues
    setValue: EnumerationFormSetValue
    isLoading: boolean
    t: ActionContext<EnumerationDisplayWithHub, EnumerationLocalizedPayload>['t']
}) => {
    const options = getEnumerationCopyOptions(values)

    return (
        <Stack spacing={1}>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={options.copyValues}
                        onChange={(event) => setValue('copyValues', event.target.checked)}
                        disabled={isLoading}
                    />
                }
                label={t('enumerations.copy.options.copyValues', 'Copy values')}
            />
        </Stack>
    )
}

/**
 * Build tabs configuration for edit dialog (N:M relationship)
 * Tab 1: General (name, description, codename)
 * Tab 2: Hubs (hub selection panel with isSingleHub toggle)
 */
const buildFormTabs = (ctx: ActionContext<EnumerationDisplayWithHub, EnumerationLocalizedPayload>, hubs: Hub[]) => {
    return ({
        values,
        setValue,
        isLoading: isFormLoading,
        errors
    }: {
        values: EnumerationFormValues
        setValue: EnumerationFormSetValue
        isLoading: boolean
        errors: Record<string, string>
    }): TabConfig[] => {
        const tabs: TabConfig[] = [
            {
                id: 'general',
                label: ctx.t('enumerations.tabs.general', 'Основное'),
                content: (
                    <GeneralTabFields
                        values={values}
                        setValue={setValue}
                        isLoading={isFormLoading}
                        errors={errors}
                        t={ctx.t}
                        uiLocale={ctx.uiLocale as string}
                    />
                )
            }
        ]

        // Always show Hubs tab in edit mode (same as create mode)
        {
            const hubIds = Array.isArray(values.hubIds) ? values.hubIds : []
            const isSingleHub = Boolean(values.isSingleHub)
            const isRequiredHub = Boolean(values.isRequiredHub)

            tabs.push({
                id: 'hubs',
                label: ctx.t('enumerations.tabs.hubs', 'Хабы'),
                content: (
                    <HubSelectionPanel
                        availableHubs={hubs}
                        selectedHubIds={hubIds}
                        onSelectionChange={(newHubIds) => setValue('hubIds', newHubIds)}
                        isRequiredHub={isRequiredHub}
                        onRequiredHubChange={(value) => setValue('isRequiredHub', value)}
                        isSingleHub={isSingleHub}
                        onSingleHubChange={(value) => setValue('isSingleHub', value)}
                        disabled={isFormLoading}
                        error={errors.hubIds}
                        uiLocale={ctx.uiLocale as string}
                    />
                )
            })
        }

        return tabs
    }
}

const enumerationActions: readonly ActionDescriptor<EnumerationDisplayWithHub, EnumerationLocalizedPayload>[] = [
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
                const hubs = (ctx as EnumerationActionContext).hubs ?? []

                return {
                    open: true,
                    mode: 'edit' as const,
                    title: ctx.t('enumerations.editTitle', 'Edit Enumeration'),
                    nameLabel: ctx.t('common:fields.name'),
                    descriptionLabel: ctx.t('common:fields.description'),
                    saveButtonText: ctx.t('common:actions.save'),
                    savingButtonText: ctx.t('common:actions.saving'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    hideDefaultFields: true,
                    initialExtraValues: initial,
                    tabs: buildFormTabs(ctx, hubs),
                    validate: (values: EnumerationFormValues) => validateCatalogForm(ctx, values),
                    canSave: (values: EnumerationFormValues) => canSaveCatalogForm(values),
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
                            console.error('Failed to refresh enumerations list after edit', e)
                        }
                    },
                    onSave: async (data: EnumerationFormValues) => {
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
                    title: ctx.t('enumerations.copyTitle', 'Copying Enumeration'),
                    nameLabel: ctx.t('common:fields.name'),
                    descriptionLabel: ctx.t('common:fields.description'),
                    saveButtonText: ctx.t('enumerations.copy.action', 'Copy'),
                    savingButtonText: ctx.t('enumerations.copy.actionLoading', 'Copying...'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    hideDefaultFields: true,
                    initialExtraValues: initial,
                    tabs: ({ values, setValue, isLoading, errors }: EnumerationDialogTabArgs) => [
                        {
                            id: 'general',
                            label: ctx.t('enumerations.tabs.general', 'General'),
                            content: (
                                <GeneralTabFields
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
                            label: ctx.t('enumerations.tabs.options', 'Options'),
                            content: <EnumerationCopyOptionsTab values={values} setValue={setValue} isLoading={isLoading} t={ctx.t} />
                        }
                    ],
                    validate: (values: EnumerationFormValues) => validateCatalogForm(ctx, values),
                    canSave: (values: EnumerationFormValues) => canSaveCatalogForm(values),
                    onClose: () => {
                        // BaseEntityMenu handles dialog closing
                    },
                    onSuccess: async () => {
                        try {
                            await ctx.helpers?.refreshList?.()
                        } catch (e) {
                            // eslint-disable-next-line no-console
                            console.error('Failed to refresh enumerations list after copy', e)
                        }
                    },
                    onSave: async (data: EnumerationFormValues) => {
                        try {
                            const payload = toPayload(data)
                            const copyOptions = getEnumerationCopyOptions(data)
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
        onSelect: async (ctx) => {
            if (ctx.helpers?.openDeleteDialog) {
                ctx.helpers.openDeleteDialog(ctx.entity)
                return
            }

            const confirmed = await ctx.helpers?.confirm?.({
                title: ctx.t('enumerations.deleteDialog.title', 'Delete Enumeration'),
                description: ctx.t('enumerations.deleteDialog.message'),
                confirmButtonName: ctx.t('common:actions.delete'),
                cancelButtonName: ctx.t('common:actions.cancel')
            })
            if (!confirmed) return

            try {
                await ctx.api?.deleteEntity?.(ctx.entity.id)
                await ctx.helpers?.refreshList?.()
            } catch (error: unknown) {
                notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
                throw error
            }
        }
    }
]

export default enumerationActions
