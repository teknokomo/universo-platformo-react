import { Stack } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import SyncIcon from '@mui/icons-material/Sync'
import DeleteIcon from '@mui/icons-material/Delete'
import type { ActionDescriptor, ActionContext, TabConfig } from '@universo/template-mui'
import { LocalizedInlineField, notifyError } from '@universo/template-mui'
import type { VersionedLocalizedContent } from '@universo/types'
import type { Publication } from '../api'
import type { PublicationDisplay, Metahub } from '../../../types'
import { extractLocalizedInput, ensureLocalizedContent, hasPrimaryContent, normalizeLocale } from '../../../utils/localizedInput'
import { MetahubInfoPanel } from '../../../components'

/**
 * Payload for updating publication via API
 */
interface PublicationLocalizedPayload {
    name?: { [locale: string]: string }
    description?: { [locale: string]: string }
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
}

/**
 * Build initial values for edit form from raw Publication data
 */
const buildInitialValues = (ctx: ActionContext<PublicationDisplay, PublicationLocalizedPayload>) => {
    const publicationMap = ctx.publicationMap as Map<string, Publication> | undefined
    const raw = publicationMap?.get(ctx.entity.id)
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)
    const nameFallback = ctx.entity?.name || ''
    const descriptionFallback = ctx.entity?.description || ''

    return {
        nameVlc: ensureLocalizedContent(raw?.name ?? ctx.entity?.name, uiLocale, nameFallback),
        descriptionVlc: ensureLocalizedContent(raw?.description ?? ctx.entity?.description, uiLocale, descriptionFallback)
    }
}

/**
 * Validate publication edit form
 */
const validatePublicationForm = (ctx: ActionContext<PublicationDisplay, PublicationLocalizedPayload>, values: Record<string, any>) => {
    const errors: Record<string, string> = {}
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    if (!hasPrimaryContent(nameVlc)) {
        errors.nameVlc = ctx.t('common:crud.nameRequired', 'Name is required')
    }
    return Object.keys(errors).length > 0 ? errors : null
}

/**
 * Check if form can be saved
 */
const canSavePublicationForm = (values: Record<string, any>) => {
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    return hasPrimaryContent(nameVlc)
}

/**
 * Convert form values to API payload
 */
const toPayload = (values: Record<string, any>): PublicationLocalizedPayload => {
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

/**
 * Edit fields component for publication edit dialog
 */
const PublicationEditFields = ({
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
    t: ActionContext<PublicationDisplay, PublicationLocalizedPayload>['t']
    uiLocale?: string
}) => {
    const fieldErrors = errors ?? {}

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
                value={values.descriptionVlc ?? null}
                onChange={(next) => setValue('descriptionVlc', next)}
                uiLocale={uiLocale as string}
                multiline
                rows={2}
            />
        </Stack>
    )
}

/**
 * Build tabs configuration for edit dialog
 * Tab 1: General (name, description)
 * Tab 2: Metahubs (read-only metahub info with locked constraints)
 */
const buildFormTabs = (
    ctx: ActionContext<PublicationDisplay, PublicationLocalizedPayload>,
    metahub: Metahub | null,
    isMetahubLoading: boolean
) => {
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
                label: ctx.t('publications.tabs.general', 'Основное'),
                content: (
                    <PublicationEditFields
                        values={values}
                        setValue={setValue}
                        isLoading={isFormLoading}
                        errors={errors}
                        t={ctx.t}
                        uiLocale={ctx.uiLocale as string}
                    />
                )
            },
            {
                id: 'metahubs',
                label: ctx.t('publications.tabs.metahubs', 'Метахабы'),
                content: (
                    <MetahubInfoPanel
                        metahub={metahub}
                        isLoading={isMetahubLoading}
                        isSingleMetahub={true}
                        isRequiredMetahub={true}
                        uiLocale={ctx.uiLocale as string}
                    />
                )
            }
        ]
        return tabs
    }
}

/**
 * Action descriptors for Publication entities
 */
const publicationActions: ActionDescriptor<PublicationDisplay, PublicationLocalizedPayload>[] = [
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
                // Get metahub from context for Metahubs tab
                const metahub = (ctx as any).metahub as Metahub | null | undefined
                const isMetahubLoading = Boolean((ctx as any).isMetahubLoading)

                return {
                    open: true,
                    mode: 'edit' as const,
                    title: ctx.t('publications.editTitle', 'Edit Publication'),
                    nameLabel: ctx.t('common:fields.name'),
                    descriptionLabel: ctx.t('common:fields.description'),
                    saveButtonText: ctx.t('common:actions.save'),
                    savingButtonText: ctx.t('common:actions.saving'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    hideDefaultFields: true,
                    initialExtraValues: initial,
                    tabs: buildFormTabs(ctx, metahub ?? null, isMetahubLoading),
                    validate: (values: Record<string, any>) => validatePublicationForm(ctx, values),
                    canSave: canSavePublicationForm,
                    onClose: () => {
                        // BaseEntityMenu handles dialog closing
                    },
                    onSuccess: async () => {
                        try {
                            await ctx.helpers?.refreshList?.()
                        } catch (e) {
                            // eslint-disable-next-line no-console
                            console.error('Failed to refresh publications list after edit', e)
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
        id: 'view',
        labelKey: 'publications.actions.view',
        icon: <OpenInNewIcon />,
        order: 20,
        visible: () => true,
        onSelect: async (ctx: ActionContext<PublicationDisplay, PublicationLocalizedPayload>) => {
            const metahubId = (ctx as any).metahubId as string | undefined
            const navigate = (ctx.helpers as any)?.navigate as ((path: string) => void) | undefined

            if (navigate && metahubId) {
                navigate(`/metahub/${metahubId}/publication/${ctx.entity.id}`)
            }
        }
    },
    {
        id: 'sync',
        labelKey: 'publications.actions.sync',
        icon: <SyncIcon />,
        order: 30,
        visible: () => true,
        onSelect: async (ctx: ActionContext<PublicationDisplay, PublicationLocalizedPayload>) => {
            const syncEntity = (ctx.api as any)?.syncEntity as ((id: string, confirmDestructive?: boolean) => Promise<void>) | undefined

            const enqueue = ctx.helpers?.enqueueSnackbar as
                | ((payload: { message: string; options?: { variant?: 'default' | 'error' | 'success' | 'warning' | 'info' } }) => void)
                | undefined

            try {
                await syncEntity?.(ctx.entity.id)
                enqueue?.({
                    message: ctx.t('publications.messages.syncSuccess', 'Schema synchronized successfully'),
                    options: { variant: 'success' }
                })
                await ctx.helpers?.refreshList?.()
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : ctx.t('publications.messages.syncError', 'Schema synchronization failed')
                enqueue?.({
                    message,
                    options: { variant: 'error' }
                })
            }
        }
    },
    {
        id: 'delete',
        labelKey: 'publications.actions.delete',
        icon: <DeleteIcon />,
        order: 100,
        group: 'danger',
        // Use custom onSelect to open ConfirmDeleteDialog via helper (defined in PublicationList.tsx)
        onSelect: async (ctx: ActionContext<PublicationDisplay, PublicationLocalizedPayload>) => {
            // Open the ConfirmDeleteDialog via helper
            ctx.helpers?.openDeleteDialog?.(ctx.entity)
        }
    }
]

export default publicationActions
