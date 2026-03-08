import { useEffect } from 'react'
import { Alert, Checkbox, Divider, FormControlLabel, Stack } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import type { ActionDescriptor, ActionContext } from '@universo/template-mui'
import { LocalizedInlineField, useCodenameAutoFill, useCodenameVlcSync, notifyError } from '@universo/template-mui'
import type { TabConfig } from '@universo/template-mui/components/dialogs'
import { HUB_COPY_OPTION_KEYS, type HubCopyOptionKey, type VersionedLocalizedContent } from '@universo/types'
import { normalizeHubCopyOptions } from '@universo/utils'
import type { Hub, HubDisplay, HubLocalizedPayload } from '../../../types'
import { getVLCString } from '../../../types'
import { sanitizeCodenameForStyle, normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../utils/codename'
import { useCodenameConfig } from '../../settings/hooks/useCodenameConfig'
import type { CodenameConfig } from '../../settings/hooks/useCodenameConfig'

const DEFAULT_CC: CodenameConfig = {
    style: 'pascal-case',
    alphabet: 'en-ru',
    allowMixed: false,
    autoConvertMixedAlphabets: true,
    autoReformat: true,
    requireReformat: true,
    localizedEnabled: false
}
const _cc = (values: Record<string, unknown>): CodenameConfig => (values._codenameConfig as CodenameConfig) || DEFAULT_CC
const DIALOG_SAVE_CANCEL = { __dialogCancelled: true } as const

import { extractLocalizedInput, ensureLocalizedContent, hasPrimaryContent, normalizeLocale } from '../../../utils/localizedInput'
import { CodenameField, HubParentSelectionPanel } from '../../../components'

export type HubFormValues = Record<string, unknown>
export type HubFormSetValue = (name: string, value: unknown) => void
export type HubDialogTabArgs = {
    values: HubFormValues
    setValue: HubFormSetValue
    isLoading: boolean
    errors?: Record<string, string>
}

export type HubActionContext = ActionContext<HubDisplay, HubLocalizedPayload> & {
    hubs?: Hub[]
    currentHubId?: string | null
    allowHubNesting?: boolean
}

export const buildInitialValues = (ctx: ActionContext<HubDisplay, HubLocalizedPayload>) => {
    const hubMap = ctx.hubMap as Map<string, Hub> | undefined
    const raw = hubMap?.get(ctx.entity.id)
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)
    const nameFallback = ctx.entity?.name || ctx.entity?.codename || ''
    const descriptionFallback = ctx.entity?.description || ''

    return {
        nameVlc: ensureLocalizedContent(raw?.name ?? ctx.entity?.name, uiLocale, nameFallback),
        descriptionVlc: ensureLocalizedContent(raw?.description ?? ctx.entity?.description, uiLocale, descriptionFallback),
        codenameVlc: ensureLocalizedContent(raw?.codenameLocalized, uiLocale, raw?.codename ?? ctx.entity?.codename ?? ''),
        codename: raw?.codename ?? ctx.entity?.codename ?? '',
        codenameTouched: true,
        parentHubId: raw?.parentHubId ?? null
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
    const allowHubNesting = (ctx as HubActionContext).allowHubNesting !== false

    return {
        ...initial,
        nameVlc: appendLocalizedCopySuffix(
            initial.nameVlc as VersionedLocalizedContent<string> | null | undefined,
            uiLocale,
            ctx.entity?.name || ctx.entity?.codename || ''
        ),
        codenameTouched: false,
        parentHubId: allowHubNesting ? initial.parentHubId ?? null : null,
        ...normalizeHubCopyOptions()
    }
}

const getHubCopyOptions = (values: Record<string, unknown>) => {
    return normalizeHubCopyOptions({
        copyAllRelations: values.copyAllRelations as boolean | undefined,
        copyCatalogRelations: values.copyCatalogRelations as boolean | undefined,
        copySetRelations: values.copySetRelations as boolean | undefined,
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

export const validateHubForm = (ctx: ActionContext<HubDisplay, HubLocalizedPayload>, values: HubFormValues) => {
    const cc = _cc(values)
    const errors: Record<string, string> = {}
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    if (!hasPrimaryContent(nameVlc)) {
        errors.nameVlc = ctx.t('common:crud.nameRequired', 'Name is required')
    }
    const rawCodename = typeof values.codename === 'string' ? values.codename : ''
    const normalizedCodename = normalizeCodenameForStyle(rawCodename, cc.style, cc.alphabet)
    if (!normalizedCodename) {
        errors.codename = ctx.t('hubs.validation.codenameRequired', 'Codename is required')
    } else if (!isValidCodenameForStyle(normalizedCodename, cc.style, cc.alphabet, cc.allowMixed)) {
        errors.codename = ctx.t('hubs.validation.codenameInvalid', 'Codename contains invalid characters')
    }
    return Object.keys(errors).length > 0 ? errors : null
}

export const canSaveHubForm = (values: HubFormValues) => {
    const cc = _cc(values)
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const rawCodename = typeof values.codename === 'string' ? values.codename : ''
    const normalizedCodename = normalizeCodenameForStyle(rawCodename, cc.style, cc.alphabet)
    return (
        !values._hasCodenameDuplicate &&
        hasPrimaryContent(nameVlc) &&
        Boolean(normalizedCodename) &&
        isValidCodenameForStyle(normalizedCodename, cc.style, cc.alphabet, cc.allowMixed)
    )
}

export const toPayload = (values: HubFormValues): HubLocalizedPayload => {
    const cc = _cc(values)
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const descriptionVlc = values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
    const codenameVlc = values.codenameVlc as VersionedLocalizedContent<string> | null | undefined
    const { input: codenameInput, primaryLocale: codenamePrimaryLocale } = extractLocalizedInput(codenameVlc)
    const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
    const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)
    const codename = normalizeCodenameForStyle(String(values.codename || ''), cc.style, cc.alphabet)
    const parentHubId = typeof values.parentHubId === 'string' ? values.parentHubId : null

    return {
        codename,
        codenameInput,
        codenamePrimaryLocale,
        name: nameInput ?? {},
        description: descriptionInput,
        namePrimaryLocale,
        descriptionPrimaryLocale,
        parentHubId
    }
}

const collectDescendantHubIds = (hubs: Hub[], rootHubId: string): Set<string> => {
    const childrenByParent = new Map<string, string[]>()
    for (const hub of hubs) {
        const parentId = typeof hub.parentHubId === 'string' ? hub.parentHubId : null
        if (!parentId) continue
        const siblings = childrenByParent.get(parentId) ?? []
        siblings.push(hub.id)
        childrenByParent.set(parentId, siblings)
    }

    const visited = new Set<string>()
    const stack = [...(childrenByParent.get(rootHubId) ?? [])]
    while (stack.length > 0) {
        const nextId = stack.pop()
        if (!nextId || visited.has(nextId)) continue
        visited.add(nextId)
        const children = childrenByParent.get(nextId)
        if (children?.length) {
            stack.push(...children)
        }
    }

    return visited
}

const HubEditFields = ({
    values,
    setValue,
    isLoading,
    errors,
    t,
    uiLocale,
    editingEntityId
}: {
    values: HubFormValues
    setValue: HubFormSetValue
    isLoading: boolean
    errors?: Record<string, string>
    t: ActionContext<HubDisplay, HubLocalizedPayload>['t']
    uiLocale?: string
    editingEntityId?: string | null
}) => {
    const fieldErrors = errors ?? {}
    const codenameConfig = useCodenameConfig()
    useEffect(() => {
        setValue('_codenameConfig', codenameConfig)
    }, [codenameConfig, setValue])
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const descriptionVlc = values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
    const codenameVlc = values.codenameVlc as VersionedLocalizedContent<string> | null | undefined
    const codename = typeof values.codename === 'string' ? values.codename : ''
    const codenameTouched = Boolean(values.codenameTouched)
    const primaryLocale = nameVlc?._primary ?? normalizeLocale(uiLocale)
    const nameValue = getVLCString(nameVlc || undefined, primaryLocale)
    const nextCodename = sanitizeCodenameForStyle(
        nameValue,
        codenameConfig.style,
        codenameConfig.alphabet,
        codenameConfig.allowMixed,
        codenameConfig.autoConvertMixedAlphabets
    )

    useCodenameAutoFill({
        codename,
        codenameTouched,
        nextCodename,
        nameValue,
        setValue: setValue as (field: 'codename' | 'codenameTouched', value: string | boolean) => void
    })

    useCodenameVlcSync({
        localizedEnabled: codenameConfig.localizedEnabled,
        codename,
        codenameTouched,
        codenameVlc,
        nameVlc,
        deriveCodename: (nameContent) =>
            sanitizeCodenameForStyle(
                nameContent,
                codenameConfig.style,
                codenameConfig.alphabet,
                codenameConfig.allowMixed,
                codenameConfig.autoConvertMixedAlphabets
            ),
        setValue
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
                onDuplicateStatusChange={(dup) => setValue('_hasCodenameDuplicate', dup)}
                localizedEnabled={codenameConfig.localizedEnabled}
                localizedValue={codenameVlc ?? null}
                onLocalizedChange={(next) => setValue('codenameVlc', next)}
                uiLocale={uiLocale as string}
                label={t('hubs.codename', 'Codename')}
                helperText={t('hubs.codenameHelper', 'Unique identifier')}
                error={fieldErrors.codename}
                disabled={isLoading}
                required
                editingEntityId={editingEntityId}
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
                        checked={options.copySetRelations}
                        onChange={(event) => toggleHubCopyChild(setValue, 'copySetRelations', event.target.checked, values)}
                        disabled={isLoading}
                    />
                }
                label={t('hubs.copy.options.copySetRelations', 'Set relations')}
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

export const buildFormTabs = (
    ctx: ActionContext<HubDisplay, HubLocalizedPayload>,
    hubs: Hub[],
    options?: {
        editingEntityId?: string | null
        allowHubNesting?: boolean
        mode?: 'create' | 'edit' | 'copy'
    }
) => {
    return ({ values, setValue, isLoading, errors }: HubDialogTabArgs): TabConfig[] => {
        const editingEntityId = options?.editingEntityId
        const allowHubNesting = options?.allowHubNesting !== false
        const mode = options?.mode ?? 'edit'
        const parentHubId = typeof values.parentHubId === 'string' ? values.parentHubId : null
        const currentParentHub = parentHubId ? hubs.find((hub) => hub.id === parentHubId) : undefined
        const excludedParentHubIds = (() => {
            if (!allowHubNesting || !editingEntityId) return new Set<string>()
            const descendants = collectDescendantHubIds(hubs, editingEntityId)
            descendants.add(editingEntityId)
            return descendants
        })()
        const availableParentHubs = allowHubNesting
            ? hubs.filter((hub) => !excludedParentHubIds.has(hub.id))
            : currentParentHub
            ? [currentParentHub]
            : []
        const currentHubId = (ctx as HubActionContext).currentHubId ?? null
        const baseTabs: TabConfig[] = [
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
                        editingEntityId={editingEntityId}
                    />
                )
            }
        ]

        const canShowHubsTab = allowHubNesting || (mode === 'edit' && parentHubId !== null)
        if (!canShowHubsTab) {
            return baseTabs
        }

        baseTabs.push({
            id: 'hubs',
            label: ctx.t('hubs.tabs.hubs', 'Hubs'),
            content: (
                <HubParentSelectionPanel
                    availableHubs={availableParentHubs}
                    parentHubId={parentHubId}
                    onParentHubChange={(nextParentHubId) => setValue('parentHubId', nextParentHubId)}
                    disabled={isLoading}
                    error={errors?.parentHubId}
                    uiLocale={ctx.uiLocale as string}
                    currentHubId={allowHubNesting ? currentHubId : null}
                    excludedHubIds={excludedParentHubIds}
                />
            )
        })

        return baseTabs
    }
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
                const hubs = (ctx as HubActionContext).hubs ?? []
                const allowHubNesting = (ctx as HubActionContext).allowHubNesting !== false
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
                    tabs: buildFormTabs(ctx, hubs, { editingEntityId: ctx.entity.id, allowHubNesting, mode: 'edit' }),
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
                    onSave: async (data: HubFormValues) => {
                        try {
                            const payload = toPayload(data)
                            const currentHubId = (ctx as HubActionContext).currentHubId
                            const detachedFromCurrentHub =
                                typeof currentHubId === 'string' && currentHubId.length > 0 && payload.parentHubId !== currentHubId
                            if (detachedFromCurrentHub && ctx.helpers?.confirm) {
                                const confirmed = await ctx.helpers.confirm({
                                    title: ctx.t('hubs.detachedConfirm.editTitle', 'Save hub outside current hub?'),
                                    description: ctx.t(
                                        'hubs.detachedConfirm.description',
                                        'This hub is not linked as a child of the current hub and will not appear in this hub after saving.'
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
                const hubs = (ctx as HubActionContext).hubs ?? []
                const allowHubNesting = (ctx as HubActionContext).allowHubNesting !== false
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
                        ...buildFormTabs(ctx, hubs, { editingEntityId: null, allowHubNesting, mode: 'copy' })({
                            values,
                            setValue,
                            isLoading,
                            errors
                        }),
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
                    onSave: async (data: HubFormValues) => {
                        try {
                            const payload = toPayload(data)
                            const copyOptions = getHubCopyOptions(data)
                            const currentHubId = (ctx as HubActionContext).currentHubId
                            const detachedFromCurrentHub =
                                typeof currentHubId === 'string' && currentHubId.length > 0 && payload.parentHubId !== currentHubId
                            if (detachedFromCurrentHub && ctx.helpers?.confirm) {
                                const confirmed = await ctx.helpers.confirm({
                                    title: ctx.t('hubs.detachedConfirm.copyTitle', 'Create hub copy outside current hub?'),
                                    description: ctx.t(
                                        'hubs.detachedConfirm.description',
                                        'This hub is not linked as a child of the current hub and will not appear in this hub after saving.'
                                    ),
                                    confirmButtonName: ctx.t('common:actions.create', 'Create'),
                                    cancelButtonName: ctx.t('common:actions.cancel', 'Cancel')
                                })
                                if (!confirmed) {
                                    throw DIALOG_SAVE_CANCEL
                                }
                            }
                            void ctx.api?.copyEntity?.(ctx.entity.id, {
                                ...payload,
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
        // Use custom onSelect to open HubDeleteDialog with blocking catalogs check
        onSelect: async (ctx) => {
            // Open the HubDeleteDialog via helper (defined in HubList.tsx)
            ctx.helpers?.openDeleteDialog?.(ctx.entity)
        }
    }
]

export default hubActions
