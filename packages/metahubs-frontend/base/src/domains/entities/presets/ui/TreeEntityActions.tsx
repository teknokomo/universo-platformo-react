import { useEffect } from 'react'
import { Alert, Checkbox, Divider, FormControlLabel, Stack } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import type { ActionDescriptor, ActionContext } from '@universo/template-mui'
import { LocalizedInlineField, useCodenameAutoFillVlc, notifyError } from '@universo/template-mui'
import type { TabConfig } from '@universo/template-mui/components/dialogs'
import { TREE_ENTITY_COPY_OPTION_KEYS, type TreeEntityCopyOptionKey, type VersionedLocalizedContent } from '@universo/types'
import { normalizeTreeEntityCopyOptions } from '@universo/utils'
import type { TreeEntity, TreeEntityDisplay, TreeEntityLocalizedPayload } from '../../../../types'
import { getVLCString } from '../../../../types'
import { sanitizeCodenameForStyle, normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../../utils/codename'
import { useCodenameConfig } from '../../../settings/hooks/useCodenameConfig'
import type { CodenameConfig } from '../../../settings/hooks/useCodenameConfig'

const DEFAULT_CC: CodenameConfig = {
    style: 'pascal-case',
    alphabet: 'en-ru',
    allowMixed: false,
    autoConvertMixedAlphabets: true,
    autoReformat: true,
    requireReformat: true
}
const _cc = (values?: Record<string, unknown> | null): CodenameConfig =>
    (values?._codenameConfig as CodenameConfig | undefined) || DEFAULT_CC
const DIALOG_SAVE_CANCEL = { __dialogCancelled: true } as const

import {
    extractLocalizedInput,
    ensureLocalizedContent,
    ensureEntityCodenameContent,
    hasPrimaryContent,
    normalizeLocale
} from '../../../../utils/localizedInput'
import { CodenameField, ContainerParentSelectionPanel } from '../../../../components'
import { createScriptsTab } from '../../../scripts/ui/EntityScriptsTab'

export type TreeEntityFormValues = Record<string, unknown>
const ensureFormValues = (values?: TreeEntityFormValues | null): TreeEntityFormValues => values ?? {}
export type TreeEntityFormSetValue = (name: string, value: unknown) => void
export type TreeEntityDialogTabArgs = {
    values: TreeEntityFormValues
    setValue: TreeEntityFormSetValue
    isLoading: boolean
    errors?: Record<string, string>
}

export type TreeEntityActionContext = ActionContext<TreeEntityDisplay, TreeEntityLocalizedPayload> & {
    treeEntities?: TreeEntity[]
    currentTreeEntityId?: string | null
    allowHubNesting?: boolean
    metahubId?: string | null
}

export const buildInitialValues = (ctx: ActionContext<TreeEntityDisplay, TreeEntityLocalizedPayload>) => {
    const hubMap = ctx.hubMap as Map<string, TreeEntity> | undefined
    const raw = hubMap?.get(ctx.entity.id)
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)
    const nameFallback = ctx.entity?.name || ctx.entity?.codename || ''
    const descriptionFallback = ctx.entity?.description || ''

    return {
        nameVlc: ensureLocalizedContent(raw?.name ?? ctx.entity?.name, uiLocale, nameFallback),
        descriptionVlc: ensureLocalizedContent(raw?.description ?? ctx.entity?.description, uiLocale, descriptionFallback),
        codename: ensureEntityCodenameContent(raw, uiLocale, raw?.codename ?? ctx.entity?.codename ?? ''),
        codenameTouched: true,
        parentTreeEntityId: raw?.parentTreeEntityId ?? null
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

const buildCopyInitialValues = (ctx: ActionContext<TreeEntityDisplay, TreeEntityLocalizedPayload>) => {
    const initial = buildInitialValues(ctx)
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)
    const allowHubNesting = (ctx as TreeEntityActionContext).allowHubNesting !== false

    return {
        ...initial,
        nameVlc: appendLocalizedCopySuffix(
            initial.nameVlc as VersionedLocalizedContent<string> | null | undefined,
            uiLocale,
            ctx.entity?.name || ctx.entity?.codename || ''
        ),
        codename: null,
        codenameTouched: false,
        parentTreeEntityId: allowHubNesting ? initial.parentTreeEntityId ?? null : null,
        ...normalizeTreeEntityCopyOptions()
    }
}

const getTreeEntityCopyOptions = (rawValues?: Record<string, unknown> | null) => {
    const values = ensureFormValues(rawValues)
    return normalizeTreeEntityCopyOptions({
        copyAllRelations: values.copyAllRelations as boolean | undefined,
        copyObjectCollectionRelations: values.copyObjectCollectionRelations as boolean | undefined,
        copyValueGroupRelations: values.copyValueGroupRelations as boolean | undefined,
        copyOptionListRelations: values.copyOptionListRelations as boolean | undefined
    })
}

const setAllTreeEntityCopyChildren = (setValue: (name: string, value: unknown) => void, checked: boolean): void => {
    for (const key of TREE_ENTITY_COPY_OPTION_KEYS) {
        setValue(key, checked)
    }
    setValue('copyAllRelations', checked)
}

const toggleTreeEntityCopyChild = (
    setValue: (name: string, value: unknown) => void,
    key: TreeEntityCopyOptionKey,
    checked: boolean,
    values: Record<string, unknown>
): void => {
    setValue(key, checked)
    const nextOptions = getTreeEntityCopyOptions({
        ...values,
        [key]: checked,
        copyAllRelations: false
    })
    setValue('copyAllRelations', nextOptions.copyAllRelations)
}

export const validateTreeEntityForm = (
    ctx: ActionContext<TreeEntityDisplay, TreeEntityLocalizedPayload>,
    rawValues?: TreeEntityFormValues | null
) => {
    const values = ensureFormValues(rawValues)
    const cc = _cc(values)
    const errors: Record<string, string> = {}
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    if (!hasPrimaryContent(nameVlc)) {
        errors.nameVlc = ctx.t('common:crud.nameRequired', 'Name is required')
    }
    const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
    const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? 'en'
    const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
    const normalizedCodename = normalizeCodenameForStyle(rawCodename, cc.style, cc.alphabet)
    if (!normalizedCodename) {
        errors.codename = ctx.t('hubs.validation.codenameRequired', 'Codename is required')
    } else if (!isValidCodenameForStyle(normalizedCodename, cc.style, cc.alphabet, cc.allowMixed)) {
        errors.codename = ctx.t('hubs.validation.codenameInvalid', 'Codename contains invalid characters')
    }
    return Object.keys(errors).length > 0 ? errors : null
}

export const canSaveTreeEntityForm = (rawValues?: TreeEntityFormValues | null) => {
    const values = ensureFormValues(rawValues)
    const cc = _cc(values)
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
    const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? 'en'
    const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
    const normalizedCodename = normalizeCodenameForStyle(rawCodename, cc.style, cc.alphabet)
    return (
        !values._hasCodenameDuplicate &&
        hasPrimaryContent(nameVlc) &&
        Boolean(normalizedCodename) &&
        isValidCodenameForStyle(normalizedCodename, cc.style, cc.alphabet, cc.allowMixed)
    )
}

export const toPayload = (rawValues?: TreeEntityFormValues | null): TreeEntityLocalizedPayload => {
    const values = ensureFormValues(rawValues)
    const cc = _cc(values)
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const descriptionVlc = values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
    const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
    const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
    const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)
    const parentTreeEntityId = typeof values.parentTreeEntityId === 'string' ? values.parentTreeEntityId : null
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
        parentTreeEntityId
    }
}

const collectDescendantTreeEntityIds = (treeEntities: TreeEntity[], rootTreeEntityId: string): Set<string> => {
    const childrenByParent = new Map<string, string[]>()
    for (const hub of treeEntities) {
        const parentId = typeof hub.parentTreeEntityId === 'string' ? hub.parentTreeEntityId : null
        if (!parentId) continue
        const siblings = childrenByParent.get(parentId) ?? []
        siblings.push(hub.id)
        childrenByParent.set(parentId, siblings)
    }

    const visited = new Set<string>()
    const stack = [...(childrenByParent.get(rootTreeEntityId) ?? [])]
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
    values: TreeEntityFormValues
    setValue: TreeEntityFormSetValue
    isLoading: boolean
    errors?: Record<string, string>
    t: ActionContext<TreeEntityDisplay, TreeEntityLocalizedPayload>['t']
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
    const codename = (values.codename as VersionedLocalizedContent<string> | null | undefined) ?? null
    const codenameTouched = Boolean(values.codenameTouched)
    useCodenameAutoFillVlc({
        codename,
        codenameTouched,
        nameVlc,
        deriveCodename: (nameContent) =>
            sanitizeCodenameForStyle(
                nameContent,
                codenameConfig.style,
                codenameConfig.alphabet,
                codenameConfig.allowMixed,
                codenameConfig.autoConvertMixedAlphabets
            ),
        setValue: setValue as (field: 'codename' | 'codenameTouched', value: VersionedLocalizedContent<string> | null | boolean) => void
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

const TreeEntityCopyOptionsTab = ({
    values,
    setValue,
    isLoading,
    t
}: {
    values: TreeEntityFormValues
    setValue: TreeEntityFormSetValue
    isLoading: boolean
    t: ActionContext<TreeEntityDisplay, TreeEntityLocalizedPayload>['t']
}) => {
    const options = getTreeEntityCopyOptions(values)
    const allChildrenChecked = TREE_ENTITY_COPY_OPTION_KEYS.every((key) => options[key])
    const hasCheckedChildren = TREE_ENTITY_COPY_OPTION_KEYS.some((key) => options[key])

    return (
        <Stack spacing={1}>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={allChildrenChecked}
                        indeterminate={!allChildrenChecked && hasCheckedChildren}
                        onChange={(event) => setAllTreeEntityCopyChildren(setValue, event.target.checked)}
                        disabled={isLoading}
                    />
                }
                label={t('hubs.copy.options.copyAllRelations', 'Copy all relations')}
            />
            <FormControlLabel
                control={
                    <Checkbox
                        checked={options.copyObjectCollectionRelations}
                        onChange={(event) =>
                            toggleTreeEntityCopyChild(setValue, 'copyObjectCollectionRelations', event.target.checked, values)
                        }
                        disabled={isLoading}
                    />
                }
                label={t('hubs.copy.options.copyObjectCollectionRelations', 'Object relations')}
            />
            <FormControlLabel
                control={
                    <Checkbox
                        checked={options.copyValueGroupRelations}
                        onChange={(event) => toggleTreeEntityCopyChild(setValue, 'copyValueGroupRelations', event.target.checked, values)}
                        disabled={isLoading}
                    />
                }
                label={t('hubs.copy.options.copyValueGroupRelations', 'Set relations')}
            />
            <FormControlLabel
                control={
                    <Checkbox
                        checked={options.copyOptionListRelations}
                        onChange={(event) => toggleTreeEntityCopyChild(setValue, 'copyOptionListRelations', event.target.checked, values)}
                        disabled={isLoading}
                    />
                }
                label={t('hubs.copy.options.copyOptionListRelations', 'Enumeration relations')}
            />
            <Alert severity='info' sx={{ py: 0.5 }}>
                {t('hubs.copy.options.singleHubNotice', 'Relations to entities with the "Single hub" restriction will not be copied.')}
            </Alert>
        </Stack>
    )
}

export const buildFormTabs = (
    ctx: ActionContext<TreeEntityDisplay, TreeEntityLocalizedPayload>,
    treeEntities: TreeEntity[],
    options?: {
        editingEntityId?: string | null
        allowHubNesting?: boolean
        mode?: 'create' | 'edit' | 'copy'
    }
) => {
    return ({ values, setValue, isLoading, errors }: TreeEntityDialogTabArgs): TabConfig[] => {
        const editingEntityId = options?.editingEntityId
        const allowHubNesting = options?.allowHubNesting !== false
        const mode = options?.mode ?? 'edit'
        const metahubId = (ctx as TreeEntityActionContext).metahubId ?? null
        const parentTreeEntityId = typeof values.parentTreeEntityId === 'string' ? values.parentTreeEntityId : null
        const currentParentHub = parentTreeEntityId ? treeEntities.find((hub) => hub.id === parentTreeEntityId) : undefined
        const excludedParentTreeEntityIds = (() => {
            if (!allowHubNesting || !editingEntityId) return new Set<string>()
            const descendants = collectDescendantTreeEntityIds(treeEntities, editingEntityId)
            descendants.add(editingEntityId)
            return descendants
        })()
        const availableParentTreeEntities = allowHubNesting
            ? treeEntities.filter((hub) => !excludedParentTreeEntityIds.has(hub.id))
            : currentParentHub
            ? [currentParentHub]
            : []
        const currentTreeEntityId = (ctx as TreeEntityActionContext).currentTreeEntityId ?? null
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

        const canShowTreeEntitiesTab = allowHubNesting || (mode === 'edit' && parentTreeEntityId !== null)
        if (!canShowTreeEntitiesTab) {
            return baseTabs
        }

        baseTabs.push({
            id: 'treeEntities',
            label: ctx.t('hubs.tabs.treeEntities', 'TreeEntities'),
            content: (
                <ContainerParentSelectionPanel
                    availableContainers={availableParentTreeEntities}
                    parentContainerId={parentTreeEntityId}
                    onParentContainerChange={(nextParentTreeEntityId) => setValue('parentTreeEntityId', nextParentTreeEntityId)}
                    disabled={isLoading}
                    error={errors?.parentTreeEntityId}
                    uiLocale={ctx.uiLocale as string}
                    currentContainerId={allowHubNesting ? currentTreeEntityId : null}
                    excludedContainerIds={excludedParentTreeEntityIds}
                />
            )
        })

        if (editingEntityId && metahubId) {
            baseTabs.push(
                createScriptsTab({
                    t: ctx.t,
                    metahubId,
                    attachedToKind: 'hub',
                    attachedToId: editingEntityId
                })
            )
        }

        return baseTabs
    }
}

const treeEntityActions: readonly ActionDescriptor<TreeEntityDisplay, TreeEntityLocalizedPayload>[] = [
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
                const treeEntities = (ctx as TreeEntityActionContext).treeEntities ?? []
                const allowHubNesting = (ctx as TreeEntityActionContext).allowHubNesting !== false
                return {
                    open: true,
                    mode: 'edit' as const,
                    title: ctx.t('hubs.editTitle', 'Edit TreeEntity'),
                    nameLabel: ctx.t('common:fields.name'),
                    descriptionLabel: ctx.t('common:fields.description'),
                    saveButtonText: ctx.t('common:actions.save'),
                    savingButtonText: ctx.t('common:actions.saving'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    hideDefaultFields: true,
                    initialExtraValues: initial,
                    tabs: buildFormTabs(ctx, treeEntities, { editingEntityId: ctx.entity.id, allowHubNesting, mode: 'edit' }),
                    validate: (values: TreeEntityFormValues) => validateTreeEntityForm(ctx, values),
                    canSave: canSaveTreeEntityForm,
                    showDeleteButton: true,
                    deleteButtonText: ctx.t('common:actions.delete'),
                    onDelete: () => {
                        ctx.helpers?.openDeleteDialog?.(ctx.entity)
                    },
                    onClose: () => {
                        // BaseEntityMenu handles dialog closing
                    },
                    onSave: async (data: TreeEntityFormValues) => {
                        try {
                            const payload = toPayload(data)
                            const currentTreeEntityId = (ctx as TreeEntityActionContext).currentTreeEntityId
                            const detachedFromCurrentHub =
                                typeof currentTreeEntityId === 'string' &&
                                currentTreeEntityId.length > 0 &&
                                payload.parentTreeEntityId !== currentTreeEntityId
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
                const treeEntities = (ctx as TreeEntityActionContext).treeEntities ?? []
                const allowHubNesting = (ctx as TreeEntityActionContext).allowHubNesting !== false
                return {
                    open: true,
                    mode: 'create' as const,
                    title: ctx.t('hubs.copyTitle', 'Copying TreeEntity'),
                    nameLabel: ctx.t('common:fields.name'),
                    descriptionLabel: ctx.t('common:fields.description'),
                    saveButtonText: ctx.t('hubs.copy.action', 'Copy'),
                    savingButtonText: ctx.t('hubs.copy.actionLoading', 'Copying...'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    hideDefaultFields: true,
                    initialExtraValues: initial,
                    tabs: ({ values, setValue, isLoading, errors }: TreeEntityDialogTabArgs) => [
                        ...buildFormTabs(ctx, treeEntities, { editingEntityId: null, allowHubNesting, mode: 'copy' })({
                            values,
                            setValue,
                            isLoading,
                            errors
                        }),
                        {
                            id: 'options',
                            label: ctx.t('hubs.tabs.options', 'Options'),
                            content: <TreeEntityCopyOptionsTab values={values} setValue={setValue} isLoading={isLoading} t={ctx.t} />
                        }
                    ],
                    validate: (values: TreeEntityFormValues) => validateTreeEntityForm(ctx, values),
                    canSave: canSaveTreeEntityForm,
                    onClose: () => {
                        // BaseEntityMenu handles dialog closing
                    },
                    onSave: async (data: TreeEntityFormValues) => {
                        try {
                            const payload = toPayload(data)
                            const copyOptions = getTreeEntityCopyOptions(data)
                            const currentTreeEntityId = (ctx as TreeEntityActionContext).currentTreeEntityId
                            const detachedFromCurrentHub =
                                typeof currentTreeEntityId === 'string' &&
                                currentTreeEntityId.length > 0 &&
                                payload.parentTreeEntityId !== currentTreeEntityId
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
        // Use custom onSelect to open TreeDeleteDialog with blocking objectCollections check.
        onSelect: async (ctx) => {
            // Open the TreeDeleteDialog via helper defined in TreeEntityList.tsx.
            ctx.helpers?.openDeleteDialog?.(ctx.entity)
        }
    }
]

export default treeEntityActions
