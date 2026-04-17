import { Checkbox, FormControlLabel, Stack } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import type { ActionDescriptor, ActionContext } from '@universo/template-mui'
import { notifyError } from '@universo/template-mui'
import type { TabConfig } from '@universo/template-mui/components/dialogs'
import type { VersionedLocalizedContent } from '@universo/types'
import { normalizeOptionListCopyOptions } from '@universo/utils'
import type { OptionListEntity, OptionListDisplay, OptionListLocalizedPayload, TreeEntity } from '../../../../types'
import { getVLCString } from '../../../../types'
import { OptionListWithContainers } from '../api/optionLists'
import { normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../../utils/codename'
import type { CodenameConfig } from '../../../settings/hooks/useCodenameConfig'

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
} from '../../../../utils/localizedInput'
import { ContainerSelectionPanel } from '../../../../components'
import { createScriptsTab } from '../../../scripts/ui/EntityScriptsTab'
import GeneralTabFields from '../../../shared/ui/GeneralTabFields'

/**
 * Extended OptionListDisplay type that includes treeEntityId for AllOptionListsList context
 */
export interface OptionListDisplayWithContainer extends OptionListDisplay {
    treeEntityId?: string
}

export type OptionListFormValues = Record<string, unknown>
export type OptionListFormSetValue = (name: string, value: unknown) => void
export type OptionListActionContext = ActionContext<OptionListDisplayWithContainer, OptionListLocalizedPayload> & {
    treeEntities?: TreeEntity[]
    currentTreeEntityId?: string | null
    metahubId?: string | null
}
export type OptionListDialogTabArgs = {
    values: OptionListFormValues
    setValue: OptionListFormSetValue
    isLoading: boolean
    errors?: Record<string, string>
}

export const buildInitialValues = (ctx: ActionContext<OptionListDisplayWithContainer, OptionListLocalizedPayload>) => {
    const enumerationMap = ctx.enumerationMap as Map<string, OptionListEntity | OptionListWithContainers> | undefined
    const raw = enumerationMap?.get(ctx.entity.id)
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)
    const nameFallback = ctx.entity?.name || ctx.entity?.codename || ''
    const descriptionFallback = ctx.entity?.description || ''

    // Extract treeEntityIds from OptionListWithContainers or fallback to single treeEntityId
    let treeEntityIds: string[] = []
    let isSingleHub = false
    let isRequiredHub = false

    if (raw && 'treeEntities' in raw && Array.isArray((raw as OptionListWithContainers).treeEntities)) {
        const catalogWithTreeEntities = raw as OptionListWithContainers
        treeEntityIds = catalogWithTreeEntities.treeEntities.map((h) => h.id)
        isSingleHub = Boolean(catalogWithTreeEntities.isSingleHub)
        isRequiredHub = Boolean(catalogWithTreeEntities.isRequiredHub)
    } else if ((ctx.entity as OptionListDisplayWithContainer).treeEntityId) {
        treeEntityIds = [(ctx.entity as OptionListDisplayWithContainer).treeEntityId as string]
    }

    return {
        nameVlc: ensureLocalizedContent(raw?.name ?? ctx.entity?.name, uiLocale, nameFallback),
        descriptionVlc: ensureLocalizedContent(raw?.description ?? ctx.entity?.description, uiLocale, descriptionFallback),
        codename: ensureEntityCodenameContent(raw, uiLocale, raw?.codename ?? ctx.entity?.codename ?? ''),
        codenameTouched: true,
        treeEntityIds,
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

const buildCopyInitialValues = (ctx: ActionContext<OptionListDisplayWithContainer, OptionListLocalizedPayload>) => {
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
        ...normalizeOptionListCopyOptions()
    }
}

const getOptionListCopyOptions = (values: Record<string, unknown>) => {
    return normalizeOptionListCopyOptions({
        copyOptionValues: values.copyOptionValues as boolean | undefined
    })
}

export const validateOptionListForm = (
    ctx: ActionContext<OptionListDisplayWithContainer, OptionListLocalizedPayload>,
    values: OptionListFormValues
) => {
    const cc = _cc(values)
    const errors: Record<string, string> = {}

    // TreeEntity validation based on isRequiredHub flag
    const isRequiredHub = Boolean(values.isRequiredHub)
    if (isRequiredHub) {
        const treeEntityIds = Array.isArray(values.treeEntityIds) ? values.treeEntityIds : []
        if (treeEntityIds.length === 0) {
            errors.treeEntityIds = ctx.t('optionLists.validation.hubRequired', 'At least one hub is required')
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
        errors.codename = ctx.t('optionLists.validation.codenameRequired', 'Codename is required')
    } else if (!isValidCodenameForStyle(normalizedCodename, cc.style, cc.alphabet, cc.allowMixed)) {
        errors.codename = ctx.t('optionLists.validation.codenameInvalid', 'Codename contains invalid characters')
    }
    return Object.keys(errors).length > 0 ? errors : null
}

export const canSaveOptionListForm = (values: OptionListFormValues) => {
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
    // TreeEntity requirement based on isRequiredHub flag in values
    const isRequiredHub = Boolean(values.isRequiredHub)
    if (isRequiredHub) {
        const treeEntityIds = Array.isArray(values.treeEntityIds) ? values.treeEntityIds : []
        return baseValid && treeEntityIds.length > 0
    }
    return baseValid
}

export const toPayload = (
    values: OptionListFormValues
): OptionListLocalizedPayload & { treeEntityIds?: string[]; isSingleHub?: boolean; isRequiredHub?: boolean } => {
    const cc = _cc(values)
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const descriptionVlc = values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
    const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
    const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
    const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)
    const treeEntityIds = Array.isArray(values.treeEntityIds) ? values.treeEntityIds : undefined
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
        treeEntityIds,
        isSingleHub,
        isRequiredHub
    }
}

const OptionListCopyOptionsTab = ({
    values,
    setValue,
    isLoading,
    t
}: {
    values: OptionListFormValues
    setValue: OptionListFormSetValue
    isLoading: boolean
    t: ActionContext<OptionListDisplayWithContainer, OptionListLocalizedPayload>['t']
}) => {
    const options = getOptionListCopyOptions(values)

    return (
        <Stack spacing={1}>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={options.copyOptionValues}
                        onChange={(event) => setValue('copyOptionValues', event.target.checked)}
                        disabled={isLoading}
                    />
                }
                label={t('optionLists.copy.options.copyOptionValues', 'Copy option values')}
            />
        </Stack>
    )
}

/**
 * Build tabs configuration for edit dialog (N:M relationship)
 * Tab 1: General (name, description, codename)
 * Tab 2: TreeEntities (tree-entity selection panel with isSingleHub toggle)
 */
export const buildFormTabs = (
    ctx: ActionContext<OptionListDisplayWithContainer, OptionListLocalizedPayload>,
    treeEntities: TreeEntity[],
    editingEntityId?: string | null
) => {
    return ({
        values,
        setValue,
        isLoading: isFormLoading,
        errors
    }: {
        values: OptionListFormValues
        setValue: OptionListFormSetValue
        isLoading: boolean
        errors: Record<string, string>
    }): TabConfig[] => {
        const metahubId = (ctx as OptionListActionContext).metahubId ?? null
        const tabs: TabConfig[] = [
            {
                id: 'general',
                label: ctx.t('optionLists.tabs.general', 'Основное'),
                content: (
                    <GeneralTabFields
                        values={values}
                        setValue={setValue}
                        isLoading={isFormLoading}
                        errors={errors}
                        uiLocale={ctx.uiLocale as string}
                        nameLabel={ctx.t('common:fields.name', 'Name')}
                        descriptionLabel={ctx.t('common:fields.description', 'Description')}
                        codenameLabel={ctx.t('optionLists.codename', 'Codename')}
                        codenameHelper={ctx.t('optionLists.codenameHelper', 'Unique identifier')}
                        editingEntityId={editingEntityId}
                    />
                )
            }
        ]

        // Always show TreeEntities tab in edit mode (same as create mode)
        {
            const treeEntityIds = Array.isArray(values.treeEntityIds) ? values.treeEntityIds : []
            const isSingleHub = Boolean(values.isSingleHub)
            const isRequiredHub = Boolean(values.isRequiredHub)
            const currentTreeEntityId = (ctx as OptionListActionContext).currentTreeEntityId ?? null

            tabs.push({
                id: 'treeEntities',
                label: ctx.t('optionLists.tabs.treeEntities', 'Древовидные сущности'),
                content: (
                    <ContainerSelectionPanel
                        availableContainers={treeEntities}
                        selectedContainerIds={treeEntityIds}
                        onSelectionChange={(newTreeEntityIds) => setValue('treeEntityIds', newTreeEntityIds)}
                        isContainerRequired={isRequiredHub}
                        onRequiredContainerChange={(value) => setValue('isRequiredHub', value)}
                        isSingleContainer={isSingleHub}
                        onSingleContainerChange={(value) => setValue('isSingleHub', value)}
                        disabled={isFormLoading}
                        error={errors.treeEntityIds}
                        uiLocale={ctx.uiLocale as string}
                        currentContainerId={currentTreeEntityId}
                    />
                )
            })
        }

        if (editingEntityId && metahubId) {
            tabs.push(
                createScriptsTab({
                    t: ctx.t,
                    metahubId,
                    attachedToKind: 'enumeration',
                    attachedToId: editingEntityId
                })
            )
        }

        return tabs
    }
}

const optionListActions: readonly ActionDescriptor<OptionListDisplayWithContainer, OptionListLocalizedPayload>[] = [
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
                const treeEntities = (ctx as OptionListActionContext).treeEntities ?? []

                return {
                    open: true,
                    mode: 'edit' as const,
                    title: ctx.t('optionLists.editTitle', 'Edit OptionListEntity'),
                    nameLabel: ctx.t('common:fields.name'),
                    descriptionLabel: ctx.t('common:fields.description'),
                    saveButtonText: ctx.t('common:actions.save'),
                    savingButtonText: ctx.t('common:actions.saving'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    hideDefaultFields: true,
                    initialExtraValues: initial,
                    tabs: buildFormTabs(ctx, treeEntities, ctx.entity.id),
                    validate: (values: OptionListFormValues) => validateOptionListForm(ctx, values),
                    canSave: (values: OptionListFormValues) => canSaveOptionListForm(values),
                    showDeleteButton: true,
                    deleteButtonText: ctx.t('common:actions.delete'),
                    onDelete: () => {
                        ctx.helpers?.openDeleteDialog?.(ctx.entity)
                    },
                    onClose: () => {
                        // BaseEntityMenu handles dialog closing
                    },
                    onSave: async (data: OptionListFormValues) => {
                        try {
                            const payload = toPayload(data)
                            const currentTreeEntityId = (ctx as OptionListActionContext).currentTreeEntityId
                            const detachedFromCurrentHub =
                                typeof currentTreeEntityId === 'string' &&
                                currentTreeEntityId.length > 0 &&
                                Array.isArray(payload.treeEntityIds) &&
                                !payload.treeEntityIds.includes(currentTreeEntityId)
                            if (detachedFromCurrentHub && ctx.helpers?.confirm) {
                                const confirmed = await ctx.helpers.confirm({
                                    title: ctx.t('optionLists.detachedConfirm.editTitle', 'Save enumeration without current tree entity?'),
                                    description: ctx.t(
                                        'optionLists.detachedConfirm.description',
                                        'This enumeration is not linked to the current tree entity and will not appear in this hub after saving.'
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
                const treeEntities = (ctx as OptionListActionContext).treeEntities ?? []

                return {
                    open: true,
                    mode: 'create' as const,
                    title: ctx.t('optionLists.copyTitle', 'Copying OptionListEntity'),
                    nameLabel: ctx.t('common:fields.name'),
                    descriptionLabel: ctx.t('common:fields.description'),
                    saveButtonText: ctx.t('optionLists.copy.action', 'Copy'),
                    savingButtonText: ctx.t('optionLists.copy.actionLoading', 'Copying...'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    hideDefaultFields: true,
                    initialExtraValues: initial,
                    tabs: (args: OptionListDialogTabArgs) => [
                        ...buildFormTabs(
                            ctx,
                            treeEntities,
                            null
                        )({
                            values: args.values,
                            setValue: args.setValue,
                            isLoading: args.isLoading,
                            errors: args.errors ?? {}
                        }),
                        {
                            id: 'options',
                            label: ctx.t('optionLists.tabs.options', 'Options'),
                            content: (
                                <OptionListCopyOptionsTab
                                    values={args.values}
                                    setValue={args.setValue}
                                    isLoading={args.isLoading}
                                    t={ctx.t}
                                />
                            )
                        }
                    ],
                    validate: (values: OptionListFormValues) => validateOptionListForm(ctx, values),
                    canSave: (values: OptionListFormValues) => canSaveOptionListForm(values),
                    onClose: () => {
                        // BaseEntityMenu handles dialog closing
                    },
                    onSave: async (data: OptionListFormValues) => {
                        try {
                            const payload = toPayload(data)
                            const {
                                treeEntityIds: _hubIds,
                                isSingleHub: _isSingleHub,
                                isRequiredHub: _isRequiredHub,
                                ...copyPayload
                            } = payload
                            const copyOptions = getOptionListCopyOptions(data)
                            const currentTreeEntityId = (ctx as OptionListActionContext).currentTreeEntityId
                            const detachedFromCurrentHub =
                                typeof currentTreeEntityId === 'string' &&
                                currentTreeEntityId.length > 0 &&
                                Array.isArray(payload.treeEntityIds) &&
                                !payload.treeEntityIds.includes(currentTreeEntityId)
                            if (detachedFromCurrentHub && ctx.helpers?.confirm) {
                                const confirmed = await ctx.helpers.confirm({
                                    title: ctx.t(
                                        'optionLists.detachedConfirm.copyTitle',
                                        'Create enumeration copy without current tree entity?'
                                    ),
                                    description: ctx.t(
                                        'optionLists.detachedConfirm.description',
                                        'This enumeration is not linked to the current tree entity and will not appear in this hub after saving.'
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
                title: ctx.t('optionLists.deleteDialog.title', 'Delete OptionListEntity'),
                description: ctx.t('optionLists.deleteDialog.message'),
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

export default optionListActions
