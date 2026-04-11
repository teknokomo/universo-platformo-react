import { Checkbox, FormControlLabel, Stack } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import type { ActionDescriptor, ActionContext } from '@universo/template-mui'
import { notifyError } from '@universo/template-mui'
import type { TabConfig } from '@universo/template-mui/components/dialogs'
import type { VersionedLocalizedContent } from '@universo/types'
import { normalizeSetCopyOptions } from '@universo/utils'
import type { MetahubSet, MetahubSetDisplay, SetLocalizedPayload, Hub } from '../../../types'
import { getVLCString } from '../../../types'
import { SetWithHubs } from '../api'
import { normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../utils/codename'
import type { CodenameConfig } from '../../settings/hooks/useCodenameConfig'

const DEFAULT_CC: CodenameConfig = {
    style: 'pascal-case',
    alphabet: 'en-ru',
    allowMixed: false,
    autoConvertMixedAlphabets: true,
    autoReformat: true,
    requireReformat: true
}
const _cc = (values: Record<string, unknown>): CodenameConfig => (values._codenameConfig as CodenameConfig) || DEFAULT_CC
const DIALOG_SAVE_CANCEL = { __dialogCancelled: true } as const

import {
    extractLocalizedInput,
    ensureLocalizedContent,
    ensureEntityCodenameContent,
    hasPrimaryContent,
    normalizeLocale
} from '../../../utils/localizedInput'
import { HubSelectionPanel } from '../../../components'
import { createScriptsTab } from '../../scripts/ui/EntityScriptsTab'
import GeneralTabFields from '../../shared/ui/GeneralTabFields'

/**
 * Extended SetDisplay type that includes hubId for AllSetsList context
 */
export interface SetDisplayWithHub extends MetahubSetDisplay {
    hubId?: string
}

export type SetFormValues = Record<string, unknown>
export type SetFormSetValue = (name: string, value: unknown) => void
export type SetActionContext = ActionContext<SetDisplayWithHub, SetLocalizedPayload> & {
    hubs?: Hub[]
    currentHubId?: string | null
    metahubId?: string | null
}
export type SetDialogTabArgs = {
    values: SetFormValues
    setValue: SetFormSetValue
    isLoading: boolean
    errors?: Record<string, string>
}

export const buildInitialValues = (ctx: ActionContext<SetDisplayWithHub, SetLocalizedPayload>) => {
    const setMap = ctx.setMap as Map<string, MetahubSet | SetWithHubs> | undefined
    const raw = setMap?.get(ctx.entity.id)
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)
    const nameFallback = ctx.entity?.name || ctx.entity?.codename || ''
    const descriptionFallback = ctx.entity?.description || ''

    // Extract hubIds from SetWithHubs or fallback to single hubId
    let hubIds: string[] = []
    let isSingleHub = false
    let isRequiredHub = false

    if (raw && 'hubs' in raw && Array.isArray((raw as SetWithHubs).hubs)) {
        const setWithHubs = raw as SetWithHubs
        hubIds = setWithHubs.hubs.map((h) => h.id)
        isSingleHub = Boolean(setWithHubs.isSingleHub)
        isRequiredHub = Boolean(setWithHubs.isRequiredHub)
    } else if ((ctx.entity as SetDisplayWithHub).hubId) {
        hubIds = [(ctx.entity as SetDisplayWithHub).hubId as string]
    }

    return {
        nameVlc: ensureLocalizedContent(raw?.name ?? ctx.entity?.name, uiLocale, nameFallback),
        descriptionVlc: ensureLocalizedContent(raw?.description ?? ctx.entity?.description, uiLocale, descriptionFallback),
        codename: ensureEntityCodenameContent(raw, uiLocale, raw?.codename ?? ctx.entity?.codename ?? ''),
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

const buildCopyInitialValues = (ctx: ActionContext<SetDisplayWithHub, SetLocalizedPayload>) => {
    const initial = buildInitialValues(ctx)
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)

    return {
        ...initial,
        nameVlc: appendLocalizedCopySuffix(
            initial.nameVlc as VersionedLocalizedContent<string> | null | undefined,
            uiLocale,
            ctx.entity?.name || ctx.entity?.codename || ''
        ),
        codename: null,
        codenameTouched: false,
        ...normalizeSetCopyOptions()
    }
}

const getSetCopyOptions = (values: Record<string, unknown>) =>
    normalizeSetCopyOptions({
        copyConstants: values.copyConstants as boolean | undefined
    })

export const validateSetForm = (ctx: ActionContext<SetDisplayWithHub, SetLocalizedPayload>, values: SetFormValues) => {
    const cc = _cc(values)
    const errors: Record<string, string> = {}

    // Hub validation based on isRequiredHub flag
    const isRequiredHub = Boolean(values.isRequiredHub)
    if (isRequiredHub) {
        const hubIds = Array.isArray(values.hubIds) ? values.hubIds : []
        if (hubIds.length === 0) {
            errors.hubIds = ctx.t('sets.validation.hubRequired', 'At least one hub is required')
        }
    }

    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    if (!hasPrimaryContent(nameVlc)) {
        errors.nameVlc = ctx.t('common:crud.nameRequired', 'Name is required')
    }
    const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
    const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? 'en'
    const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
    const normalizedCodename = normalizeCodenameForStyle(rawCodename, cc.style, cc.alphabet)
    if (!normalizedCodename) {
        errors.codename = ctx.t('sets.validation.codenameRequired', 'Codename is required')
    } else if (!isValidCodenameForStyle(normalizedCodename, cc.style, cc.alphabet, cc.allowMixed)) {
        errors.codename = ctx.t('sets.validation.codenameInvalid', 'Codename contains invalid characters')
    }
    return Object.keys(errors).length > 0 ? errors : null
}

export const canSaveSetForm = (values: SetFormValues) => {
    const cc = _cc(values)
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
    const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? 'en'
    const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
    const normalizedCodename = normalizeCodenameForStyle(rawCodename, cc.style, cc.alphabet)
    const baseValid =
        !values._hasCodenameDuplicate &&
        hasPrimaryContent(nameVlc) &&
        Boolean(normalizedCodename) &&
        isValidCodenameForStyle(normalizedCodename, cc.style, cc.alphabet, cc.allowMixed)
    // Hub requirement based on isRequiredHub flag in values
    const isRequiredHub = Boolean(values.isRequiredHub)
    if (isRequiredHub) {
        const hubIds = Array.isArray(values.hubIds) ? values.hubIds : []
        return baseValid && hubIds.length > 0
    }
    return baseValid
}

export const toPayload = (
    values: SetFormValues
): SetLocalizedPayload & { hubIds?: string[]; isSingleHub?: boolean; isRequiredHub?: boolean } => {
    const cc = _cc(values)
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const descriptionVlc = values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
    const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
    const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
    const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)
    const hubIds = Array.isArray(values.hubIds) ? values.hubIds : undefined
    const isSingleHub = Boolean(values.isSingleHub)
    const isRequiredHub = Boolean(values.isRequiredHub)
    const codenamePrimaryLocale = codenameValue?._primary ?? namePrimaryLocale ?? 'en'
    const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
    const codename = normalizeCodenameForStyle(rawCodename, cc.style, cc.alphabet)
    const codenamePayload = ensureLocalizedContent(codenameValue, namePrimaryLocale ?? codenamePrimaryLocale, codename)

    return {
        codename: codenamePayload,
        name: nameInput ?? {},
        description: descriptionInput,
        namePrimaryLocale,
        descriptionPrimaryLocale,
        hubIds,
        isSingleHub,
        isRequiredHub
    }
}

const SetCopyOptionsTab = ({
    values,
    setValue,
    isLoading,
    t
}: {
    values: SetFormValues
    setValue: SetFormSetValue
    isLoading: boolean
    t: ActionContext<SetDisplayWithHub, SetLocalizedPayload>['t']
}) => {
    const options = getSetCopyOptions(values)

    return (
        <Stack spacing={1}>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={options.copyConstants}
                        onChange={(event) => setValue('copyConstants', event.target.checked)}
                        disabled={isLoading}
                    />
                }
                label={t('sets.copy.options.copyConstants', 'Copy constants')}
            />
        </Stack>
    )
}

/**
 * Build tabs configuration for edit dialog (N:M relationship)
 * Tab 1: General (name, description, codename)
 * Tab 2: Hubs (hub selection panel with isSingleHub toggle)
 */
export const buildFormTabs = (ctx: ActionContext<SetDisplayWithHub, SetLocalizedPayload>, hubs: Hub[], editingEntityId?: string | null) => {
    return ({
        values,
        setValue,
        isLoading: isFormLoading,
        errors
    }: {
        values: SetFormValues
        setValue: SetFormSetValue
        isLoading: boolean
        errors: Record<string, string>
    }): TabConfig[] => {
        const metahubId = (ctx as SetActionContext).metahubId ?? null
        const tabs: TabConfig[] = [
            {
                id: 'general',
                label: ctx.t('sets.tabs.general', 'Основное'),
                content: (
                    <GeneralTabFields
                        values={values}
                        setValue={setValue}
                        isLoading={isFormLoading}
                        errors={errors}
                        uiLocale={ctx.uiLocale as string}
                        nameLabel={ctx.t('common:fields.name', 'Name')}
                        descriptionLabel={ctx.t('common:fields.description', 'Description')}
                        codenameLabel={ctx.t('sets.codename', 'Codename')}
                        codenameHelper={ctx.t('sets.codenameHelper', 'Unique identifier')}
                        editingEntityId={editingEntityId}
                    />
                )
            }
        ]

        // Always show Hubs tab in edit mode (same as create mode)
        {
            const hubIds = Array.isArray(values.hubIds) ? values.hubIds : []
            const isSingleHub = Boolean(values.isSingleHub)
            const isRequiredHub = Boolean(values.isRequiredHub)
            const currentHubId = (ctx as SetActionContext).currentHubId ?? null

            tabs.push({
                id: 'hubs',
                label: ctx.t('sets.tabs.hubs', 'Хабы'),
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
                        currentHubId={currentHubId}
                    />
                )
            })
        }

        if (editingEntityId && metahubId) {
            tabs.push(
                createScriptsTab({
                    t: ctx.t,
                    metahubId,
                    attachedToKind: 'set',
                    attachedToId: editingEntityId
                })
            )
        }

        return tabs
    }
}

const setActions: readonly ActionDescriptor<SetDisplayWithHub, SetLocalizedPayload>[] = [
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
                const hubs = (ctx as SetActionContext).hubs ?? []

                return {
                    open: true,
                    mode: 'edit' as const,
                    title: ctx.t('sets.editTitle', 'Edit Set'),
                    nameLabel: ctx.t('common:fields.name'),
                    descriptionLabel: ctx.t('common:fields.description'),
                    saveButtonText: ctx.t('common:actions.save'),
                    savingButtonText: ctx.t('common:actions.saving'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    hideDefaultFields: true,
                    initialExtraValues: initial,
                    tabs: buildFormTabs(ctx, hubs, ctx.entity.id),
                    validate: (values: SetFormValues) => validateSetForm(ctx, values),
                    canSave: (values: SetFormValues) => canSaveSetForm(values),
                    showDeleteButton: true,
                    deleteButtonText: ctx.t('common:actions.delete'),
                    onDelete: () => {
                        ctx.helpers?.openDeleteDialog?.(ctx.entity)
                    },
                    onClose: () => {
                        // BaseEntityMenu handles dialog closing
                    },
                    onSave: async (data: SetFormValues) => {
                        try {
                            const payload = toPayload(data)
                            const currentHubId = (ctx as SetActionContext).currentHubId
                            const detachedFromCurrentHub =
                                typeof currentHubId === 'string' &&
                                currentHubId.length > 0 &&
                                Array.isArray(payload.hubIds) &&
                                !payload.hubIds.includes(currentHubId)
                            if (detachedFromCurrentHub && ctx.helpers?.confirm) {
                                const confirmed = await ctx.helpers.confirm({
                                    title: ctx.t('sets.detachedConfirm.editTitle', 'Save set without current hub?'),
                                    description: ctx.t(
                                        'sets.detachedConfirm.description',
                                        'This set is not linked to the current hub and will not appear in this hub after saving.'
                                    ),
                                    confirmButtonName: ctx.t('common:actions.save', 'Save'),
                                    cancelButtonName: ctx.t('common:actions.cancel', 'Cancel')
                                })
                                if (!confirmed) {
                                    throw DIALOG_SAVE_CANCEL
                                }
                            }
                            void ctx.api?.updateEntity?.(ctx.entity.id, payload)
                        } catch (error: unknown) {
                            if (
                                error &&
                                typeof error === 'object' &&
                                '__dialogCancelled' in error &&
                                (error as { __dialogCancelled?: unknown }).__dialogCancelled === true
                            ) {
                                throw error
                            }
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
                const hubs = (ctx as SetActionContext).hubs ?? []

                return {
                    open: true,
                    mode: 'create' as const,
                    title: ctx.t('sets.copyTitle', 'Copying Set'),
                    nameLabel: ctx.t('common:fields.name'),
                    descriptionLabel: ctx.t('common:fields.description'),
                    saveButtonText: ctx.t('sets.copy.action', 'Copy'),
                    savingButtonText: ctx.t('sets.copy.actionLoading', 'Copying...'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    hideDefaultFields: true,
                    initialExtraValues: initial,
                    tabs: (args: SetDialogTabArgs) => [
                        ...buildFormTabs(
                            ctx,
                            hubs,
                            null
                        )({
                            values: args.values,
                            setValue: args.setValue,
                            isLoading: args.isLoading,
                            errors: args.errors ?? {}
                        }),
                        {
                            id: 'options',
                            label: ctx.t('sets.tabs.options', 'Options'),
                            content: (
                                <SetCopyOptionsTab values={args.values} setValue={args.setValue} isLoading={args.isLoading} t={ctx.t} />
                            )
                        }
                    ],
                    validate: (values: SetFormValues) => validateSetForm(ctx, values),
                    canSave: (values: SetFormValues) => canSaveSetForm(values),
                    onClose: () => {
                        // BaseEntityMenu handles dialog closing
                    },
                    onSave: async (data: SetFormValues) => {
                        try {
                            const payload = toPayload(data)
                            const { hubIds: _hubIds, isSingleHub: _isSingleHub, isRequiredHub: _isRequiredHub, ...copyPayload } = payload
                            const copyOptions = getSetCopyOptions(data)
                            const currentHubId = (ctx as SetActionContext).currentHubId
                            const detachedFromCurrentHub =
                                typeof currentHubId === 'string' &&
                                currentHubId.length > 0 &&
                                Array.isArray(payload.hubIds) &&
                                !payload.hubIds.includes(currentHubId)
                            if (detachedFromCurrentHub && ctx.helpers?.confirm) {
                                const confirmed = await ctx.helpers.confirm({
                                    title: ctx.t('sets.detachedConfirm.copyTitle', 'Create set copy without current hub?'),
                                    description: ctx.t(
                                        'sets.detachedConfirm.description',
                                        'This set is not linked to the current hub and will not appear in this hub after saving.'
                                    ),
                                    confirmButtonName: ctx.t('common:actions.create', 'Create'),
                                    cancelButtonName: ctx.t('common:actions.cancel', 'Cancel')
                                })
                                if (!confirmed) {
                                    throw DIALOG_SAVE_CANCEL
                                }
                            }
                            void ctx.api?.copyEntity?.(ctx.entity.id, {
                                ...copyPayload,
                                ...copyOptions
                            })
                        } catch (error: unknown) {
                            if (
                                error &&
                                typeof error === 'object' &&
                                '__dialogCancelled' in error &&
                                (error as { __dialogCancelled?: unknown }).__dialogCancelled === true
                            ) {
                                throw error
                            }
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
                title: ctx.t('sets.deleteDialog.title', 'Delete Set'),
                description: ctx.t('sets.deleteDialog.message'),
                confirmButtonName: ctx.t('common:actions.delete'),
                cancelButtonName: ctx.t('common:actions.cancel')
            })
            if (!confirmed) return

            try {
                await ctx.api?.deleteEntity?.(ctx.entity.id)
            } catch (error: unknown) {
                notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
                throw error
            }
        }
    }
]

export default setActions
