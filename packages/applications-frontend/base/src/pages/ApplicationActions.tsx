import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { Alert, Checkbox, FormControlLabel, Radio, RadioGroup, Stack, Typography } from '@mui/material'
import type { ActionDescriptor, ActionContext, TabConfig } from '@universo/template-mui'
import { LocalizedInlineField } from '@universo/template-mui'
import type { ApplicationCopyOptions, VersionedLocalizedContent } from '@universo/types'
import { createLocalizedContent, normalizeApplicationCopyOptions, updateLocalizedContentLocale } from '@universo/utils'
import type { Application, ApplicationDisplay, ApplicationLocalizedPayload } from '../types'
import type { ApplicationFormValues } from './ApplicationList'
import { extractLocalizedInput, ensureLocalizedContent, hasPrimaryContent, normalizeLocale } from '../utils/localizedInput'

type ApplicationDialogValues = ApplicationFormValues &
    Partial<ApplicationCopyOptions> & {
        isPublic?: boolean
        workspacesEnabled?: boolean
    }

type ApplicationDialogRenderProps = {
    values: ApplicationDialogValues
    setValue: (name: string, value: unknown) => void
    isLoading: boolean
    errors?: Record<string, string>
}

type ApplicationActionContext = ActionContext<ApplicationDisplay, ApplicationLocalizedPayload> & {
    applicationMap?: Map<string, Application>
    uiLocale?: string
    api?: ActionContext<ApplicationDisplay, ApplicationLocalizedPayload>['api'] & {
        copyEntity?: (id: string, data: ApplicationLocalizedPayload & Partial<ApplicationCopyOptions>) => Promise<void>
    }
}

const buildInitialValues = (ctx: ApplicationActionContext) => {
    const applicationMap = ctx.applicationMap as Map<string, Application> | undefined
    const raw = applicationMap?.get(ctx.entity.id)
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)
    const nameFallback = ctx.entity?.name || ''
    const descriptionFallback = ctx.entity?.description || ''

    return {
        nameVlc: ensureLocalizedContent(raw?.name ?? ctx.entity?.name, uiLocale, nameFallback),
        descriptionVlc: ensureLocalizedContent(raw?.description ?? ctx.entity?.description, uiLocale, descriptionFallback),
        isPublic: raw?.isPublic ?? ctx.entity?.isPublic ?? false,
        workspacesEnabled: raw?.workspacesEnabled ?? ctx.entity?.workspacesEnabled ?? false
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
        return createLocalizedContent(locale, nextContent)
    }

    let nextValue = value
    const localeEntries = Object.entries(value.locales || {})
    for (const [locale, localeValue] of localeEntries) {
        const normalizedLocale = normalizeLocale(locale)
        const suffix = normalizedLocale === 'ru' ? ' (копия)' : ' (copy)'
        const content = typeof localeValue?.content === 'string' ? localeValue.content.trim() : ''
        if (content.length > 0) {
            nextValue = updateLocalizedContentLocale(nextValue, locale, `${content}${suffix}`)
        }
    }

    const hasAnyContent = Object.values(nextValue.locales).some(
        (entry) => typeof entry?.content === 'string' && entry.content.trim().length > 0
    )
    if (!hasAnyContent) {
        const locale = normalizeLocale(uiLocale)
        const suffix = locale === 'ru' ? ' (копия)' : ' (copy)'
        const content = (fallback || '').trim()
        nextValue = updateLocalizedContentLocale(
            nextValue,
            locale,
            content ? `${content}${suffix}` : locale === 'ru' ? `Копия${suffix}` : `Copy${suffix}`
        )
    }

    return nextValue
}

const buildCopyInitialValues = (ctx: ApplicationActionContext) => {
    const initial = buildInitialValues(ctx)
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)

    return {
        ...initial,
        nameVlc: appendLocalizedCopySuffix(
            initial.nameVlc as VersionedLocalizedContent<string> | null | undefined,
            uiLocale,
            ctx.entity?.name || ''
        ),
        ...normalizeApplicationCopyOptions()
    }
}

const validateApplicationForm = (ctx: ApplicationActionContext, values: ApplicationDialogValues) => {
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    if (!hasPrimaryContent(nameVlc)) {
        return { nameVlc: ctx.t('common:crud.nameRequired', 'Name is required') }
    }
    return null
}

const canSaveApplicationForm = (values: ApplicationDialogValues) => {
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    return hasPrimaryContent(nameVlc)
}

const getApplicationCopyOptions = (values: ApplicationDialogValues): ApplicationCopyOptions => {
    return normalizeApplicationCopyOptions({
        copyConnector: values.copyConnector,
        createSchema: values.createSchema,
        copyAccess: values.copyAccess
    })
}

const renderParametersTab = (
    ctx: ApplicationActionContext,
    values: ApplicationDialogValues,
    setValue: ApplicationDialogRenderProps['setValue'],
    isLoading: boolean,
    mode: 'create' | 'edit' | 'copy'
) => {
    const isPublic = values.isPublic === true
    const workspacesEnabled = values.workspacesEnabled === true
    const parametersLocked = mode === 'edit'
    const handleVisibilityChange = (nextIsPublic: boolean) => {
        setValue('isPublic', nextIsPublic)
        if (nextIsPublic && !workspacesEnabled) {
            setValue('workspacesEnabled', true)
        }
    }

    return (
        <Stack spacing={2}>
            <RadioGroup
                value={isPublic ? 'public' : 'closed'}
                onChange={(event) => handleVisibilityChange(event.target.value === 'public')}
            >
                <FormControlLabel
                    value='closed'
                    control={<Radio />}
                    label={ctx.t('visibility.closed', 'Closed')}
                    disabled={isLoading || parametersLocked}
                />
                <FormControlLabel
                    value='public'
                    control={<Radio />}
                    label={ctx.t('visibility.public', 'Public')}
                    disabled={isLoading || parametersLocked}
                />
            </RadioGroup>
            <Alert severity='info'>
                {ctx.t(
                    parametersLocked ? 'parameters.visibilityLocked' : 'parameters.visibilityHint',
                    parametersLocked
                        ? 'Application visibility is fixed after creation and cannot be changed.'
                        : 'Application visibility cannot be changed after creation.'
                )}
            </Alert>

            <FormControlLabel
                control={
                    <Checkbox
                        checked={workspacesEnabled}
                        onChange={(event) => setValue('workspacesEnabled', event.target.checked)}
                        disabled={isLoading || parametersLocked}
                    />
                }
                label={ctx.t('parameters.workspacesEnabled', 'Add workspaces')}
            />
            <Alert severity='info'>
                {ctx.t(
                    parametersLocked ? 'parameters.workspacesLocked' : 'parameters.workspacesHint',
                    parametersLocked
                        ? 'Workspace mode is fixed after creation and cannot be changed.'
                        : 'Workspace mode cannot be disabled after the application is created.'
                )}
            </Alert>
            {isPublic && !workspacesEnabled ? (
                <Alert severity='warning'>
                    {ctx.t(
                        'parameters.publicWorkspacesRecommended',
                        'Workspaces are recommended for public applications to isolate each participant data.'
                    )}
                </Alert>
            ) : null}
        </Stack>
    )
}

const toPayload = (values: ApplicationDialogValues): ApplicationLocalizedPayload => {
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const descriptionVlc = values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined

    const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
    const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)

    return {
        name: nameInput ?? {},
        description: descriptionInput,
        namePrimaryLocale,
        descriptionPrimaryLocale,
        isPublic: values.isPublic === true,
        workspacesEnabled: values.workspacesEnabled === true
    }
}

const toUpdatePayload = (values: ApplicationDialogValues): ApplicationLocalizedPayload => {
    const { isPublic: _isPublic, workspacesEnabled: _workspacesEnabled, ...payload } = toPayload(values)
    return payload
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
                    tabs: ({ values, setValue, isLoading, errors }: ApplicationDialogRenderProps): TabConfig[] => {
                        const fieldErrors = errors ?? {}

                        return [
                            {
                                id: 'general',
                                label: ctx.t('copy.generalTab', 'General'),
                                content: (
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
                            {
                                id: 'parameters',
                                label: ctx.t('parameters.tab', 'Parameters'),
                                content: renderParametersTab(ctx, values, setValue, isLoading, 'edit')
                            }
                        ]
                    },
                    validate: (values: ApplicationDialogValues) => validateApplicationForm(ctx, values),
                    canSave: canSaveApplicationForm,
                    showDeleteButton: true,
                    deleteButtonText: ctx.t('common:actions.delete'),
                    onDelete: () => {
                        ctx.helpers?.openDeleteDialog?.(ctx.entity)
                    },
                    onClose: () => {
                        // BaseEntityMenu handles dialog closing
                    },
                    onSave: (data: ApplicationDialogValues) => {
                        const payload = toUpdatePayload(data)
                        return ctx.api?.updateEntity?.(ctx.entity.id, payload)
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
                    tabs: ({ values, setValue, isLoading, errors }: ApplicationDialogRenderProps): TabConfig[] => {
                        const fieldErrors = errors ?? {}
                        const copyOptions = getApplicationCopyOptions(values)

                        return [
                            {
                                id: 'general',
                                label: ctx.t('copy.generalTab', 'General'),
                                content: (
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
                            {
                                id: 'parameters',
                                label: ctx.t('parameters.tab', 'Parameters'),
                                content: (
                                    <Stack spacing={2}>
                                        {renderParametersTab(ctx, values, setValue, isLoading, 'copy')}
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={copyOptions.copyConnector}
                                                    onChange={(event) => {
                                                        const checked = event.target.checked
                                                        setValue('copyConnector', checked)
                                                        if (!checked) {
                                                            setValue('createSchema', false)
                                                        }
                                                    }}
                                                    disabled={isLoading}
                                                />
                                            }
                                            label={ctx.t('copy.copyConnector', 'Copy connector')}
                                        />
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={copyOptions.createSchema}
                                                    onChange={(event) => setValue('createSchema', event.target.checked)}
                                                    disabled={isLoading || !copyOptions.copyConnector}
                                                />
                                            }
                                            label={ctx.t('copy.createSchema', 'Create application schema')}
                                        />
                                        {!copyOptions.copyConnector ? (
                                            <Typography variant='caption' color='text.secondary' sx={{ ml: 4 }}>
                                                {ctx.t(
                                                    'copy.createSchemaDisabledHint',
                                                    'Enable "Copy connector" to make schema creation available.'
                                                )}
                                            </Typography>
                                        ) : null}
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={copyOptions.copyAccess}
                                                    onChange={(event) => setValue('copyAccess', event.target.checked)}
                                                    disabled={isLoading}
                                                />
                                            }
                                            label={ctx.t('copy.copyAccess', 'Copy access permissions')}
                                        />
                                    </Stack>
                                )
                            }
                        ]
                    },
                    validate: (values: ApplicationDialogValues) => validateApplicationForm(ctx, values),
                    canSave: canSaveApplicationForm,
                    onClose: () => {
                        // BaseEntityMenu handles dialog closing
                    },
                    onSave: (data: ApplicationDialogValues) => {
                        const payload = toPayload(data)
                        const copyOptions = getApplicationCopyOptions(data)
                        return ctx.api?.copyEntity?.(ctx.entity.id, {
                            ...payload,
                            ...copyOptions
                        })
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
                onConfirm: () => {
                    return ctx.api?.deleteEntity?.(ctx.entity.id)
                }
            })
        }
    }
]

export default applicationActions
