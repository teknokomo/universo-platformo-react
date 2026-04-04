import { useEffect } from 'react'
import { Checkbox, Divider, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import type { ActionDescriptor, ActionContext } from '@universo/template-mui'
import { LocalizedInlineField, useCodenameAutoFillVlc, notifyError } from '@universo/template-mui'
import type { TabConfig } from '@universo/template-mui/components/dialogs'
import type { CatalogRuntimeViewConfig, VersionedLocalizedContent } from '@universo/types'
import { normalizeCatalogCopyOptions, normalizeCatalogRuntimeViewConfig, sanitizeCatalogRuntimeViewConfig } from '@universo/utils'
import type { Catalog, CatalogDisplay, CatalogLocalizedPayload, Hub } from '../../../types'
import { getVLCString } from '../../../types'
import { CatalogWithHubs } from '../api'
import { sanitizeCodenameForStyle, normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../utils/codename'
import { useCodenameConfig } from '../../settings/hooks/useCodenameConfig'
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
import { CodenameField, HubSelectionPanel } from '../../../components'

/**
 * Extended CatalogDisplay type that includes hubId for AllCatalogsList context
 */
export interface CatalogDisplayWithHub extends CatalogDisplay {
    hubId?: string
}

export type CatalogFormValues = Record<string, unknown>
export type CatalogFormSetValue = (name: string, value: unknown) => void
export type CatalogActionContext = ActionContext<CatalogDisplayWithHub, CatalogLocalizedPayload> & {
    hubs?: Hub[]
    currentHubId?: string | null
}
export type CatalogDialogTabArgs = {
    values: CatalogFormValues
    setValue: CatalogFormSetValue
    isLoading: boolean
    errors?: Record<string, string>
}

const getCatalogRuntimeFormValue = (values: CatalogFormValues): CatalogRuntimeViewConfig =>
    normalizeCatalogRuntimeViewConfig(values.runtimeConfig as Record<string, unknown> | undefined)

const getCatalogRuntimeRawValue = (values: CatalogFormValues): CatalogRuntimeViewConfig =>
    (values.runtimeConfig as CatalogRuntimeViewConfig | undefined) ?? {}

export const CatalogLayoutTabFields = ({
    values,
    setValue,
    isLoading,
    t
}: {
    values: CatalogFormValues
    setValue: CatalogFormSetValue
    isLoading: boolean
    t: ActionContext<CatalogDisplayWithHub, CatalogLocalizedPayload>['t']
}) => {
    const runtimeConfig = getCatalogRuntimeFormValue(values)
    const rawRuntimeConfig = getCatalogRuntimeRawValue(values)
    const updateRuntimeConfig = (patch: Partial<CatalogRuntimeViewConfig>) => {
        setValue('runtimeConfig', sanitizeCatalogRuntimeViewConfig({ ...rawRuntimeConfig, ...patch }) ?? {})
    }
    const layoutOverridesEnabled = Boolean(runtimeConfig.useLayoutOverrides)

    return (
        <Stack spacing={2}>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={runtimeConfig.showCreateButton}
                        onChange={(_, checked) => updateRuntimeConfig({ showCreateButton: checked })}
                        disabled={isLoading}
                    />
                }
                label={t('catalogs.runtime.showCreateButton', 'Show create button')}
            />
            <FormControl fullWidth size='small' disabled={isLoading}>
                <InputLabel>{t('catalogs.runtime.createSurface', 'Create form type')}</InputLabel>
                <Select
                    value={runtimeConfig.createSurface}
                    label={t('catalogs.runtime.createSurface', 'Create form type')}
                    onChange={(event) =>
                        updateRuntimeConfig({ createSurface: event.target.value as CatalogRuntimeViewConfig['createSurface'] })
                    }
                >
                    <MenuItem value='dialog'>{t('catalogs.runtime.surfaceDialog', 'Dialog')}</MenuItem>
                    <MenuItem value='page'>{t('catalogs.runtime.surfacePage', 'Page')}</MenuItem>
                </Select>
            </FormControl>
            <FormControl fullWidth size='small' disabled={isLoading}>
                <InputLabel>{t('catalogs.runtime.editSurface', 'Edit form type')}</InputLabel>
                <Select
                    value={runtimeConfig.editSurface}
                    label={t('catalogs.runtime.editSurface', 'Edit form type')}
                    onChange={(event) =>
                        updateRuntimeConfig({ editSurface: event.target.value as CatalogRuntimeViewConfig['editSurface'] })
                    }
                >
                    <MenuItem value='dialog'>{t('catalogs.runtime.surfaceDialog', 'Dialog')}</MenuItem>
                    <MenuItem value='page'>{t('catalogs.runtime.surfacePage', 'Page')}</MenuItem>
                </Select>
            </FormControl>
            <FormControl fullWidth size='small' disabled={isLoading}>
                <InputLabel>{t('catalogs.runtime.copySurface', 'Copy form type')}</InputLabel>
                <Select
                    value={runtimeConfig.copySurface}
                    label={t('catalogs.runtime.copySurface', 'Copy form type')}
                    onChange={(event) =>
                        updateRuntimeConfig({ copySurface: event.target.value as CatalogRuntimeViewConfig['copySurface'] })
                    }
                >
                    <MenuItem value='dialog'>{t('catalogs.runtime.surfaceDialog', 'Dialog')}</MenuItem>
                    <MenuItem value='page'>{t('catalogs.runtime.surfacePage', 'Page')}</MenuItem>
                </Select>
            </FormControl>

            <Divider />

            <FormControlLabel
                control={
                    <Checkbox
                        checked={layoutOverridesEnabled}
                        onChange={(_, checked) => updateRuntimeConfig({ useLayoutOverrides: checked })}
                        disabled={isLoading}
                    />
                }
                label={t('catalogs.runtime.useLayoutOverrides', 'Override application layout settings')}
            />
            <Typography variant='body2' color='text.secondary'>
                {t(
                    'catalogs.runtime.useLayoutOverridesHelper',
                    'When disabled, this catalog inherits search, view, card, and row layout settings from the application layout.'
                )}
            </Typography>

            <Stack spacing={2} sx={{ opacity: layoutOverridesEnabled ? 1 : 0.6 }}>
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={runtimeConfig.showSearch}
                            onChange={(_, checked) => updateRuntimeConfig({ showSearch: checked })}
                            disabled={isLoading || !layoutOverridesEnabled}
                        />
                    }
                    label={t('catalogs.runtime.showSearch', 'Search/filter bar')}
                />
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={runtimeConfig.showViewToggle}
                            onChange={(_, checked) => updateRuntimeConfig({ showViewToggle: checked })}
                            disabled={isLoading || !layoutOverridesEnabled}
                        />
                    }
                    label={t('catalogs.runtime.showViewToggle', 'Card/table view toggle')}
                />
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={runtimeConfig.enableRowReordering}
                            onChange={(_, checked) => updateRuntimeConfig({ enableRowReordering: checked })}
                            disabled={isLoading || !layoutOverridesEnabled}
                        />
                    }
                    label={t('catalogs.runtime.enableRowReordering', 'Enable row reordering')}
                />
                <TextField
                    fullWidth
                    size='small'
                    disabled={isLoading || !layoutOverridesEnabled || !runtimeConfig.enableRowReordering}
                    label={t('catalogs.runtime.reorderPersistenceField', 'Reorder persistence field')}
                    helperText={t(
                        'catalogs.runtime.reorderPersistenceFieldHelper',
                        'Enter the numeric field codename or column key that stores the persisted row order, for example sort_order.'
                    )}
                    value={runtimeConfig.reorderPersistenceField ?? ''}
                    onChange={(event) =>
                        updateRuntimeConfig({
                            reorderPersistenceField: event.target.value.trim().length > 0 ? event.target.value.trim() : null
                        })
                    }
                />
                <FormControl fullWidth size='small' disabled={isLoading || !layoutOverridesEnabled}>
                    <InputLabel>{t('catalogs.runtime.defaultViewMode', 'Default view mode')}</InputLabel>
                    <Select
                        value={runtimeConfig.defaultViewMode}
                        label={t('catalogs.runtime.defaultViewMode', 'Default view mode')}
                        onChange={(event) =>
                            updateRuntimeConfig({ defaultViewMode: event.target.value as CatalogRuntimeViewConfig['defaultViewMode'] })
                        }
                    >
                        <MenuItem value='table'>{t('catalogs.runtime.viewModeTable', 'Table')}</MenuItem>
                        <MenuItem value='card'>{t('catalogs.runtime.viewModeCard', 'Card')}</MenuItem>
                    </Select>
                </FormControl>
                <FormControl fullWidth size='small' disabled={isLoading || !layoutOverridesEnabled}>
                    <InputLabel>{t('catalogs.runtime.cardColumns', 'Card columns')}</InputLabel>
                    <Select
                        value={String(runtimeConfig.cardColumns)}
                        label={t('catalogs.runtime.cardColumns', 'Card columns')}
                        onChange={(event) => updateRuntimeConfig({ cardColumns: Number(event.target.value) })}
                    >
                        <MenuItem value='2'>2</MenuItem>
                        <MenuItem value='3'>3</MenuItem>
                        <MenuItem value='4'>4</MenuItem>
                    </Select>
                </FormControl>
                <FormControl fullWidth size='small' disabled={isLoading || !layoutOverridesEnabled}>
                    <InputLabel>{t('catalogs.runtime.rowHeight', 'Row height')}</InputLabel>
                    <Select
                        value={runtimeConfig.rowHeight}
                        label={t('catalogs.runtime.rowHeight', 'Row height')}
                        onChange={(event) =>
                            updateRuntimeConfig({ rowHeight: event.target.value as CatalogRuntimeViewConfig['rowHeight'] })
                        }
                    >
                        <MenuItem value='compact'>{t('catalogs.runtime.rowHeightCompact', 'Compact (default)')}</MenuItem>
                        <MenuItem value='normal'>{t('catalogs.runtime.rowHeightNormal', 'Normal (52px)')}</MenuItem>
                        <MenuItem value='auto'>{t('catalogs.runtime.rowHeightAuto', 'Auto (multi-line)')}</MenuItem>
                    </Select>
                </FormControl>
            </Stack>
        </Stack>
    )
}

export const buildInitialValues = (ctx: ActionContext<CatalogDisplayWithHub, CatalogLocalizedPayload>) => {
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
        codename: ensureEntityCodenameContent(raw, uiLocale, raw?.codename ?? ctx.entity?.codename ?? ''),
        codenameTouched: true,
        runtimeConfig: (raw?.runtimeConfig as Record<string, unknown> | undefined) ?? {},
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

const buildCopyInitialValues = (ctx: ActionContext<CatalogDisplayWithHub, CatalogLocalizedPayload>) => {
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
        ...normalizeCatalogCopyOptions()
    }
}

const getCatalogCopyOptions = (values: Record<string, unknown>) => {
    return normalizeCatalogCopyOptions({
        copyAttributes: values.copyAttributes as boolean | undefined,
        copyElements: values.copyElements as boolean | undefined
    })
}

export const validateCatalogForm = (ctx: ActionContext<CatalogDisplayWithHub, CatalogLocalizedPayload>, values: CatalogFormValues) => {
    const cc = _cc(values)
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
    const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
    const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? 'en'
    const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
    const normalizedCodename = normalizeCodenameForStyle(rawCodename, cc.style, cc.alphabet)
    if (!normalizedCodename) {
        errors.codename = ctx.t('catalogs.validation.codenameRequired', 'Codename is required')
    } else if (!isValidCodenameForStyle(normalizedCodename, cc.style, cc.alphabet, cc.allowMixed)) {
        errors.codename = ctx.t('catalogs.validation.codenameInvalid', 'Codename contains invalid characters')
    }
    return Object.keys(errors).length > 0 ? errors : null
}

export const canSaveCatalogForm = (values: CatalogFormValues) => {
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
    values: CatalogFormValues
): CatalogLocalizedPayload & { hubIds?: string[]; isSingleHub?: boolean; isRequiredHub?: boolean } => {
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
        isRequiredHub,
        runtimeConfig: sanitizeCatalogRuntimeViewConfig(values.runtimeConfig as Record<string, unknown> | undefined)
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
    uiLocale,
    editingEntityId
}: {
    values: CatalogFormValues
    setValue: CatalogFormSetValue
    isLoading: boolean
    errors?: Record<string, string>
    t: ActionContext<CatalogDisplayWithHub, CatalogLocalizedPayload>['t']
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
                onChange={(value) => setValue('codename', value)}
                touched={codenameTouched}
                onTouchedChange={(touched: boolean) => setValue('codenameTouched', touched)}
                onDuplicateStatusChange={(dup) => setValue('_hasCodenameDuplicate', dup)}
                uiLocale={uiLocale as string}
                label={t('catalogs.codename', 'Codename')}
                helperText={t('catalogs.codenameHelper', 'Unique identifier')}
                error={fieldErrors.codename}
                disabled={isLoading}
                required
                editingEntityId={editingEntityId}
            />
        </Stack>
    )
}

const CatalogCopyOptionsTab = ({
    values,
    setValue,
    isLoading,
    t
}: {
    values: CatalogFormValues
    setValue: CatalogFormSetValue
    isLoading: boolean
    t: ActionContext<CatalogDisplayWithHub, CatalogLocalizedPayload>['t']
}) => {
    const options = getCatalogCopyOptions(values)

    return (
        <Stack spacing={1}>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={options.copyAttributes}
                        onChange={(event) => {
                            setValue('copyAttributes', event.target.checked)
                            if (!event.target.checked) {
                                setValue('copyElements', false)
                            }
                        }}
                        disabled={isLoading}
                    />
                }
                label={t('catalogs.copy.options.copyAttributes', 'Copy attributes')}
            />
            <FormControlLabel
                control={
                    <Checkbox
                        checked={options.copyElements}
                        onChange={(event) => setValue('copyElements', event.target.checked)}
                        disabled={isLoading || !options.copyAttributes}
                    />
                }
                label={t('catalogs.copy.options.copyElements', 'Copy elements')}
            />
        </Stack>
    )
}

/**
 * Build tabs configuration for edit dialog (N:M relationship)
 * Tab 1: General (name, description, codename)
 * Tab 2: Hubs (hub selection panel with isSingleHub toggle)
 */
export const buildFormTabs = (
    ctx: ActionContext<CatalogDisplayWithHub, CatalogLocalizedPayload>,
    hubs: Hub[],
    editingEntityId?: string | null
) => {
    return ({
        values,
        setValue,
        isLoading: isFormLoading,
        errors
    }: {
        values: CatalogFormValues
        setValue: CatalogFormSetValue
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
            const currentHubId = (ctx as CatalogActionContext).currentHubId ?? null

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
                        currentHubId={currentHubId}
                    />
                )
            })

            tabs.push({
                id: 'layout',
                label: ctx.t('catalogs.tabs.layout', 'Layout'),
                content: <CatalogLayoutTabFields values={values} setValue={setValue} isLoading={isFormLoading} t={ctx.t} />
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
                const hubs = (ctx as CatalogActionContext).hubs ?? []

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
                    tabs: buildFormTabs(ctx, hubs, ctx.entity.id),
                    validate: (values: CatalogFormValues) => validateCatalogForm(ctx, values),
                    canSave: (values: CatalogFormValues) => canSaveCatalogForm(values),
                    showDeleteButton: true,
                    deleteButtonText: ctx.t('common:actions.delete'),
                    onDelete: () => {
                        ctx.helpers?.openDeleteDialog?.(ctx.entity)
                    },
                    onClose: () => {
                        // BaseEntityMenu handles dialog closing
                    },
                    onSave: async (data: CatalogFormValues) => {
                        try {
                            const payload = toPayload(data)
                            const currentHubId = (ctx as CatalogActionContext).currentHubId
                            const detachedFromCurrentHub =
                                typeof currentHubId === 'string' &&
                                currentHubId.length > 0 &&
                                Array.isArray(payload.hubIds) &&
                                !payload.hubIds.includes(currentHubId)
                            if (detachedFromCurrentHub && ctx.helpers?.confirm) {
                                const confirmed = await ctx.helpers.confirm({
                                    title: ctx.t('catalogs.detachedConfirm.editTitle', 'Save catalog without current hub?'),
                                    description: ctx.t(
                                        'catalogs.detachedConfirm.description',
                                        'This catalog is not linked to the current hub and will not appear in this hub after saving.'
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
                const hubs = (ctx as CatalogActionContext).hubs ?? []

                return {
                    open: true,
                    mode: 'create' as const,
                    title: ctx.t('catalogs.copyTitle', 'Copying Catalog'),
                    nameLabel: ctx.t('common:fields.name'),
                    descriptionLabel: ctx.t('common:fields.description'),
                    saveButtonText: ctx.t('catalogs.copy.action', 'Copy'),
                    savingButtonText: ctx.t('catalogs.copy.actionLoading', 'Copying...'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    hideDefaultFields: true,
                    initialExtraValues: initial,
                    tabs: (args: CatalogDialogTabArgs) => [
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
                            label: ctx.t('catalogs.tabs.options', 'Options'),
                            content: (
                                <CatalogCopyOptionsTab values={args.values} setValue={args.setValue} isLoading={args.isLoading} t={ctx.t} />
                            )
                        }
                    ],
                    validate: (values: CatalogFormValues) => validateCatalogForm(ctx, values),
                    canSave: (values: CatalogFormValues) => canSaveCatalogForm(values),
                    onClose: () => {
                        // BaseEntityMenu handles dialog closing
                    },
                    onSave: async (data: CatalogFormValues) => {
                        try {
                            const payload = toPayload(data)
                            const { hubIds: _hubIds, isSingleHub: _isSingleHub, isRequiredHub: _isRequiredHub, ...copyPayload } = payload
                            const copyOptions = getCatalogCopyOptions(data)
                            const currentHubId = (ctx as CatalogActionContext).currentHubId
                            const detachedFromCurrentHub =
                                typeof currentHubId === 'string' &&
                                currentHubId.length > 0 &&
                                Array.isArray(payload.hubIds) &&
                                !payload.hubIds.includes(currentHubId)
                            if (detachedFromCurrentHub && ctx.helpers?.confirm) {
                                const confirmed = await ctx.helpers.confirm({
                                    title: ctx.t('catalogs.detachedConfirm.copyTitle', 'Create catalog copy without current hub?'),
                                    description: ctx.t(
                                        'catalogs.detachedConfirm.description',
                                        'This catalog is not linked to the current hub and will not appear in this hub after saving.'
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
                title: ctx.t('catalogs.deleteDialog.title', 'Delete Catalog'),
                description: ctx.t('catalogs.deleteDialog.message'),
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

export default catalogActions
