import { Stack } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import type { ActionDescriptor, ActionContext, TabConfig } from '@universo/template-mui'
import { LocalizedInlineField, notifyError } from '@universo/template-mui'
import type { VersionedLocalizedContent } from '@universo/types'
import type { Connector, ConnectorDisplay, ConnectorLocalizedPayload } from '../types'
import { extractLocalizedInput, ensureLocalizedContent, hasPrimaryContent, normalizeLocale } from '../utils/localizedInput'
import { ConnectorPublicationInfoWrapper } from '../components'

const buildInitialValues = (ctx: ActionContext<ConnectorDisplay, ConnectorLocalizedPayload>) => {
    const connectorMap = ctx.connectorMap as Map<string, Connector> | undefined
    const raw = connectorMap?.get(ctx.entity.id)
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)
    const nameFallback = ctx.entity?.name || ''
    const descriptionFallback = ctx.entity?.description || ''

    return {
        nameVlc: ensureLocalizedContent(raw?.name ?? ctx.entity?.name, uiLocale, nameFallback),
        descriptionVlc: ensureLocalizedContent(raw?.description ?? ctx.entity?.description, uiLocale, descriptionFallback)
    }
}

const validateConnectorForm = (ctx: ActionContext<ConnectorDisplay, ConnectorLocalizedPayload>, values: Record<string, any>) => {
    const errors: Record<string, string> = {}
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    if (!hasPrimaryContent(nameVlc)) {
        errors.nameVlc = ctx.t('common:crud.nameRequired', 'Name is required')
    }
    return Object.keys(errors).length > 0 ? errors : null
}

const canSaveConnectorForm = (values: Record<string, any>) => {
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    return hasPrimaryContent(nameVlc)
}

const toPayload = (values: Record<string, any>): ConnectorLocalizedPayload => {
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

const ConnectorEditFields = ({
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
    t: ActionContext<ConnectorDisplay, ConnectorLocalizedPayload>['t']
    uiLocale?: string
}) => {
    const fieldErrors = errors ?? {}
    const descriptionVlc = values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined

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
        </Stack>
    )
}

/**
 * Build tabs configuration for edit dialog
 * Tab 1: General (name, description)
 * Tab 2: Publications (read-only display of linked publications with locked constraints)
 */
const buildFormTabs = (ctx: ActionContext<ConnectorDisplay, ConnectorLocalizedPayload>, applicationId: string, connectorId: string) => {
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
                label: ctx.t('connectors.tabs.general', 'General'),
                content: (
                    <ConnectorEditFields
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
                label: ctx.t('connectors.tabs.metahubs', 'Metahubs'),
                content: (
                    <ConnectorPublicationInfoWrapper
                        applicationId={applicationId}
                        connectorId={connectorId}
                        uiLocale={ctx.uiLocale as string}
                    />
                )
            }
        ]
        return tabs
    }
}

const connectorActions: readonly ActionDescriptor<ConnectorDisplay, ConnectorLocalizedPayload>[] = [
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
                const applicationId = (ctx as any).applicationId as string | undefined
                const connectorId = ctx.entity.id

                return {
                    open: true,
                    mode: 'edit' as const,
                    title: ctx.t('connectors.editTitle', 'Edit Connector'),
                    nameLabel: ctx.t('common:fields.name'),
                    descriptionLabel: ctx.t('common:fields.description'),
                    saveButtonText: ctx.t('common:actions.save'),
                    savingButtonText: ctx.t('common:actions.saving'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    hideDefaultFields: true,
                    initialExtraValues: initial,
                    tabs: applicationId ? buildFormTabs(ctx, applicationId, connectorId) : undefined,
                    // Fallback to extraFields if applicationId is not available
                    extraFields: applicationId
                        ? undefined
                        : ({ values, setValue, isLoading, errors }: any) => (
                              <ConnectorEditFields
                                  values={values}
                                  setValue={setValue}
                                  isLoading={isLoading}
                                  errors={errors}
                                  t={ctx.t}
                                  uiLocale={ctx.uiLocale as string}
                              />
                          ),
                    validate: (values: Record<string, any>) => validateConnectorForm(ctx, values),
                    canSave: canSaveConnectorForm,
                    showDeleteButton: true,
                    deleteButtonText: ctx.t('common:actions.delete'),
                    deleteButtonDisabled: true,
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
                            console.error('Failed to refresh connectors list after edit', e)
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
        tone: 'danger',
        order: 100,
        group: 'danger',
        // Deletion is disabled: connectors cannot be deleted individually, only with the whole application
        enabled: () => false,
        onSelect: (ctx) => {
            ctx.helpers?.openDeleteDialog?.(ctx.entity)
        }
    }
]

export default connectorActions
