import { Divider, Stack } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import type { ActionDescriptor, ActionContext } from '@universo/template-mui'
import { LocalizedInlineField, useCodenameAutoFill, notifyError } from '@universo/template-mui'
import type { TabConfig } from '@universo/template-mui/components/dialogs'
import type { VersionedLocalizedContent } from '@universo/types'
import type { Catalog, CatalogDisplay, CatalogLocalizedPayload, Hub } from '../types'
import { getVLCString } from '../types'
import { CatalogWithHubs } from '../api/catalogs'
import { sanitizeCodename, isValidCodename } from '../utils/codename'
import { extractLocalizedInput, ensureLocalizedContent, hasPrimaryContent, normalizeLocale } from '../utils/localizedInput'
import { CodenameField, HubSelectionPanel } from '../components'

/**
 * Extended CatalogDisplay type that includes hubId for AllCatalogsList context
 */
export interface CatalogDisplayWithHub extends CatalogDisplay {
    hubId?: string
}

const buildInitialValues = (ctx: ActionContext<CatalogDisplayWithHub, CatalogLocalizedPayload>) => {
    const catalogMap = ctx.catalogMap as Map<string, Catalog | CatalogWithHubs> | undefined
    const raw = catalogMap?.get(ctx.entity.id)
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)
    const nameFallback = ctx.entity?.name || ctx.entity?.codename || ''
    const descriptionFallback = ctx.entity?.description || ''

    // Extract hubIds from CatalogWithHubs or fallback to single hubId
    let hubIds: string[] = []
    let isSingleHub = false
    let isRequiredHub = false

    if (raw && 'hubs' in raw && Array.isArray((raw as CatalogWithHubs).hubs)) {
        const catalogWithHubs = raw as CatalogWithHubs
        hubIds = catalogWithHubs.hubs.map((h) => h.id)
        isSingleHub = Boolean(catalogWithHubs.isSingleHub)
        isRequiredHub = Boolean(catalogWithHubs.isRequiredHub)
    } else if ((ctx.entity as CatalogDisplayWithHub).hubId) {
        hubIds = [(ctx.entity as CatalogDisplayWithHub).hubId as string]
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

const validateCatalogForm = (ctx: ActionContext<CatalogDisplayWithHub, CatalogLocalizedPayload>, values: Record<string, any>) => {
    const errors: Record<string, string> = {}

    // Hub validation based on isRequiredHub flag
    const isRequiredHub = Boolean(values.isRequiredHub)
    if (isRequiredHub) {
        const hubIds = Array.isArray(values.hubIds) ? values.hubIds : []
        if (hubIds.length === 0) {
            errors.hubIds = ctx.t('catalogs.validation.hubRequired', 'At least one hub is required')
        }
    }

    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    if (!hasPrimaryContent(nameVlc)) {
        errors.nameVlc = ctx.t('common:crud.nameRequired', 'Name is required')
    }
    const rawCodename = typeof values.codename === 'string' ? values.codename : ''
    const normalizedCodename = sanitizeCodename(rawCodename)
    if (!normalizedCodename) {
        errors.codename = ctx.t('catalogs.validation.codenameRequired', 'Codename is required')
    } else if (!isValidCodename(normalizedCodename)) {
        errors.codename = ctx.t('catalogs.validation.codenameInvalid', 'Codename contains invalid characters')
    }
    return Object.keys(errors).length > 0 ? errors : null
}

const canSaveCatalogForm = (values: Record<string, any>) => {
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
    values: Record<string, any>
): CatalogLocalizedPayload & { hubIds?: string[]; isSingleHub?: boolean; isRequiredHub?: boolean } => {
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
    values: Record<string, any>
    setValue: (name: string, value: any) => void
    isLoading: boolean
    errors?: Record<string, string>
    t: ActionContext<CatalogDisplayWithHub, CatalogLocalizedPayload>['t']
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
                label={t('catalogs.codename', 'Codename')}
                helperText={t('catalogs.codenameHelper', 'Unique identifier')}
                error={fieldErrors.codename}
                disabled={isLoading}
                required
            />
        </Stack>
    )
}

/**
 * Build tabs configuration for edit dialog (N:M relationship)
 * Tab 1: General (name, description, codename)
 * Tab 2: Hubs (hub selection panel with isSingleHub toggle)
 */
const buildFormTabs = (ctx: ActionContext<CatalogDisplayWithHub, CatalogLocalizedPayload>, hubs: Hub[], showHubsTab: boolean) => {
    return ({
        values,
        setValue,
        isLoading: isFormLoading,
        errors
    }: {
        values: Record<string, any>
        setValue: (name: string, value: any) => void
        isLoading: boolean
        errors: Record<string, string>
    }): TabConfig[] => {
        const tabs: TabConfig[] = [
            {
                id: 'general',
                label: ctx.t('catalogs.tabs.general', 'Основное'),
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

        // Add Hubs tab only when hubs are available (AllCatalogsList context)
        if (showHubsTab && hubs.length > 0) {
            const hubIds = Array.isArray(values.hubIds) ? values.hubIds : []
            const isSingleHub = Boolean(values.isSingleHub)
            const isRequiredHub = Boolean(values.isRequiredHub)

            tabs.push({
                id: 'hubs',
                label: ctx.t('catalogs.tabs.hubs', 'Хабы'),
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

const catalogActions: readonly ActionDescriptor<CatalogDisplayWithHub, CatalogLocalizedPayload>[] = [
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
                const hubs = ((ctx as any).hubs as Hub[] | undefined) ?? []
                const showHubsTab = hubs.length > 0

                return {
                    open: true,
                    mode: 'edit' as const,
                    title: ctx.t('catalogs.editTitle', 'Edit Catalog'),
                    nameLabel: ctx.t('common:fields.name'),
                    descriptionLabel: ctx.t('common:fields.description'),
                    saveButtonText: ctx.t('common:actions.save'),
                    savingButtonText: ctx.t('common:actions.saving'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    hideDefaultFields: true,
                    initialExtraValues: initial,
                    tabs: buildFormTabs(ctx, hubs, showHubsTab),
                    validate: (values: Record<string, any>) => validateCatalogForm(ctx, values),
                    canSave: (values: Record<string, any>) => canSaveCatalogForm(values),
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
                            console.error('Failed to refresh catalogs list after edit', e)
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
                title: ctx.t('catalogs.deleteDialog.title', 'Delete Catalog'),
                description: ctx.t('catalogs.deleteDialog.message'),
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

export default catalogActions
