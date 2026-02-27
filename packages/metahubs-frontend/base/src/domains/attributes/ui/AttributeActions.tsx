import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import StarOutlineIcon from '@mui/icons-material/StarOutline'
import { Checkbox, FormControlLabel, Stack } from '@mui/material'
import type { ActionDescriptor, ActionContext, TabConfig } from '@universo/template-mui'
import { notifyError } from '@universo/template-mui'
import type { VersionedLocalizedContent, MetaEntityKind } from '@universo/types'
import type { Attribute, AttributeDisplay, AttributeLocalizedPayload, AttributeValidationRules } from '../../../types'
import { sanitizeCodename, isValidCodename } from '../../../utils/codename'
import { extractLocalizedInput, ensureLocalizedContent, hasPrimaryContent, normalizeLocale } from '../../../utils/localizedInput'
import AttributeFormFields, { PresentationTabFields } from './AttributeFormFields'

const ATTRIBUTE_DATA_TYPES = new Set<Attribute['dataType']>(['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'JSON', 'TABLE'])

const buildInitialValues = (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
    const attributeMap = ctx.attributeMap as Map<string, Attribute> | undefined
    const raw = attributeMap?.get(ctx.entity.id)
    const isSingleAttribute = (attributeMap?.size ?? 0) <= 1
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)
    const nameFallback = ctx.entity?.name || ctx.entity?.codename || ''

    return {
        nameVlc: ensureLocalizedContent(raw?.name ?? ctx.entity?.name, uiLocale, nameFallback),
        codename: raw?.codename ?? ctx.entity?.codename ?? '',
        codenameTouched: true,
        dataType: raw?.dataType ?? ctx.entity?.dataType ?? 'STRING',
        isRequired: isSingleAttribute ? true : raw?.isRequired ?? ctx.entity?.isRequired ?? false,
        isDisplayAttribute: isSingleAttribute ? true : raw?.isDisplayAttribute ?? (ctx.entity as any)?.isDisplayAttribute ?? false,
        validationRules: raw?.validationRules ?? ctx.entity?.validationRules ?? {},
        targetEntityId: raw?.targetEntityId ?? ctx.entity?.targetEntityId ?? null,
        targetEntityKind: raw?.targetEntityKind ?? ctx.entity?.targetEntityKind ?? null,
        uiConfig: raw?.uiConfig ?? ctx.entity?.uiConfig ?? {}
    }
}

const validateAttributeForm = (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>, values: Record<string, any>) => {
    const errors: Record<string, string> = {}
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    if (!hasPrimaryContent(nameVlc)) {
        errors.nameVlc = ctx.t('common:crud.nameRequired', 'Name is required')
    }
    const rawCodename = typeof values.codename === 'string' ? values.codename : ''
    const normalizedCodename = sanitizeCodename(rawCodename)
    if (!normalizedCodename) {
        errors.codename = ctx.t('attributes.validation.codenameRequired', 'Codename is required')
    } else if (!isValidCodename(normalizedCodename)) {
        errors.codename = ctx.t('attributes.validation.codenameInvalid', 'Codename contains invalid characters')
    }
    if (values.dataType === 'REF') {
        if (!values.targetEntityKind) {
            errors.targetEntityKind = ctx.t(
                'attributes.validation.targetEntityKindRequired',
                'Target entity type is required for Reference type'
            )
        }
        if (!values.targetEntityId) {
            errors.targetEntityId = ctx.t('attributes.validation.targetEntityIdRequired', 'Target entity is required for Reference type')
        }
    }
    return Object.keys(errors).length > 0 ? errors : null
}

const canSaveAttributeForm = (values: Record<string, any>) => {
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const rawCodename = typeof values.codename === 'string' ? values.codename : ''
    const normalizedCodename = sanitizeCodename(rawCodename)
    const hasBasicInfo = hasPrimaryContent(nameVlc) && Boolean(normalizedCodename) && isValidCodename(normalizedCodename)
    if (values.dataType === 'REF') {
        return hasBasicInfo && Boolean(values.targetEntityKind) && Boolean(values.targetEntityId)
    }
    return hasBasicInfo
}

const sanitizeAttributeUiConfig = (
    dataType: AttributeLocalizedPayload['dataType'],
    targetEntityKind: MetaEntityKind | null | undefined,
    sourceUiConfig: Record<string, unknown>,
    isRequired: boolean
): Record<string, unknown> => {
    const nextUiConfig = { ...sourceUiConfig }
    const isEnumerationRef = dataType === 'REF' && targetEntityKind === 'enumeration'

    if (!isEnumerationRef) {
        delete nextUiConfig.enumPresentationMode
        delete nextUiConfig.defaultEnumValueId
        delete nextUiConfig.enumAllowEmpty
        delete nextUiConfig.enumLabelEmptyDisplay
        return nextUiConfig
    }

    if (
        nextUiConfig.enumPresentationMode !== 'select' &&
        nextUiConfig.enumPresentationMode !== 'radio' &&
        nextUiConfig.enumPresentationMode !== 'label'
    ) {
        nextUiConfig.enumPresentationMode = 'select'
    }

    if (
        'defaultEnumValueId' in nextUiConfig &&
        nextUiConfig.defaultEnumValueId !== null &&
        typeof nextUiConfig.defaultEnumValueId !== 'string'
    ) {
        delete nextUiConfig.defaultEnumValueId
    }

    if (typeof nextUiConfig.enumAllowEmpty !== 'boolean') {
        nextUiConfig.enumAllowEmpty = true
    }

    if (nextUiConfig.enumLabelEmptyDisplay !== 'empty' && nextUiConfig.enumLabelEmptyDisplay !== 'dash') {
        nextUiConfig.enumLabelEmptyDisplay = 'dash'
    }

    const hasDefaultEnumValueId = typeof nextUiConfig.defaultEnumValueId === 'string' && nextUiConfig.defaultEnumValueId.length > 0
    if (hasDefaultEnumValueId || isRequired) {
        nextUiConfig.enumAllowEmpty = false
    } else if (nextUiConfig.enumAllowEmpty === true) {
        nextUiConfig.defaultEnumValueId = null
    }

    return nextUiConfig
}

const toPayload = (values: Record<string, any>): AttributeLocalizedPayload => {
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
    const codename = sanitizeCodename(String(values.codename || ''))
    const dataType = (values.dataType as AttributeLocalizedPayload['dataType']) ?? 'STRING'
    const isRequired = Boolean(values.isRequired)
    const isDisplayAttribute = Boolean(values.isDisplayAttribute)
    const validationRules = values.validationRules as AttributeValidationRules | undefined
    const targetEntityId = (values.targetEntityId as string | null | undefined) ?? undefined
    const targetEntityKind = (values.targetEntityKind as MetaEntityKind | null | undefined) ?? undefined
    const sourceUiConfig = (values.uiConfig as Record<string, unknown> | undefined) ?? {}
    const uiConfig = sanitizeAttributeUiConfig(dataType, targetEntityKind, sourceUiConfig, isRequired)

    return {
        codename,
        dataType,
        isRequired,
        isDisplayAttribute,
        name: nameInput ?? {},
        namePrimaryLocale,
        validationRules,
        targetEntityId,
        targetEntityKind,
        uiConfig: Object.keys(uiConfig).length > 0 ? uiConfig : undefined
    }
}

const resolveSortOrder = (attribute?: { sortOrder?: number }) => {
    if (!attribute) return null
    const value = attribute.sortOrder
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const appendCopySuffix = (value: VersionedLocalizedContent<string> | null | undefined, uiLocale: string, fallback: string) => {
    const normalizedLocale = normalizeLocale(uiLocale)
    const suffix = normalizedLocale === 'ru' ? ' (копия)' : ' (copy)'
    const source = ensureLocalizedContent(value, normalizedLocale, fallback)
    const nextLocales = { ...(source.locales ?? {}) } as Record<string, { content?: string }>
    for (const [locale, localeValue] of Object.entries(nextLocales)) {
        const localeSuffix = normalizeLocale(locale) === 'ru' ? ' (копия)' : ' (copy)'
        const content = typeof localeValue?.content === 'string' ? localeValue.content.trim() : ''
        if (content.length > 0) {
            nextLocales[locale] = { ...localeValue, content: `${content}${localeSuffix}` }
        }
    }
    const hasAny = Object.values(nextLocales).some((entry) => typeof entry?.content === 'string' && entry.content.trim().length > 0)
    if (!hasAny) {
        nextLocales[normalizedLocale] = { content: `${fallback || 'Copy'}${suffix}` }
    }
    return {
        ...source,
        locales: nextLocales
    }
}

const getSortBounds = (attributeMap?: Map<string, Attribute>) => {
    if (!attributeMap || attributeMap.size === 0) return { min: null, max: null }
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    attributeMap.forEach((attr) => {
        const value = resolveSortOrder(attr)
        if (value == null) return
        min = Math.min(min, value)
        max = Math.max(max, value)
    })
    if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: null, max: null }
    return { min, max }
}

const getCurrentSortOrder = (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>, attributeMap?: Map<string, Attribute>) => {
    const fromMap = attributeMap?.get(ctx.entity.id)
    return resolveSortOrder(fromMap) ?? resolveSortOrder(ctx.entity)
}

const isDisplayAttributeEntity = (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
    const attributeMap = ctx.attributeMap as Map<string, Attribute> | undefined
    const raw = attributeMap?.get(ctx.entity.id)
    return Boolean(raw?.isDisplayAttribute ?? (ctx.entity as any)?.isDisplayAttribute ?? false)
}

const attributeActions: readonly ActionDescriptor<AttributeDisplay, AttributeLocalizedPayload>[] = [
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
                    title: ctx.t('attributes.editDialog.title', 'Edit Attribute'),
                    nameLabel: ctx.t('common:fields.name'),
                    descriptionLabel: ctx.t('common:fields.description'),
                    saveButtonText: ctx.t('common:actions.save'),
                    savingButtonText: ctx.t('common:actions.saving'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    hideDefaultFields: true,
                    initialExtraValues: initial,
                    tabs: ({
                        values,
                        setValue,
                        isLoading,
                        errors
                    }: {
                        values: Record<string, any>
                        setValue: (name: string, value: any) => void
                        isLoading: boolean
                        errors: Record<string, string>
                    }): TabConfig[] => {
                        const attributeMap = ctx.attributeMap as Map<string, Attribute> | undefined
                        const displayAttributeLocked = (attributeMap?.size ?? 0) <= 1
                        return [
                            {
                                id: 'general',
                                label: ctx.t('attributes.tabs.general', 'General'),
                                content: (
                                    <AttributeFormFields
                                        values={values}
                                        setValue={setValue}
                                        isLoading={isLoading}
                                        errors={errors}
                                        uiLocale={ctx.uiLocale as string}
                                        nameLabel={ctx.t('common:fields.name')}
                                        codenameLabel={ctx.t('attributes.codename', 'Codename')}
                                        codenameHelper={ctx.t('attributes.codenameHelper', 'Unique identifier')}
                                        dataTypeLabel={ctx.t('attributes.dataType', 'Data Type')}
                                        requiredLabel={ctx.t('attributes.isRequiredLabel', 'Required')}
                                        displayAttributeLabel={ctx.t('attributes.isDisplayAttributeLabel', 'Display attribute')}
                                        displayAttributeHelper={ctx.t(
                                            'attributes.isDisplayAttributeHelper',
                                            'Use as representation when referencing elements of this catalog'
                                        )}
                                        displayAttributeLocked={displayAttributeLocked}
                                        dataTypeOptions={[
                                            { value: 'STRING', label: ctx.t('attributes.dataTypeOptions.string', 'String') },
                                            { value: 'NUMBER', label: ctx.t('attributes.dataTypeOptions.number', 'Number') },
                                            { value: 'BOOLEAN', label: ctx.t('attributes.dataTypeOptions.boolean', 'Boolean') },
                                            { value: 'DATE', label: ctx.t('attributes.dataTypeOptions.date', 'Date') },
                                            { value: 'REF', label: ctx.t('attributes.dataTypeOptions.ref', 'Reference') },
                                            { value: 'JSON', label: ctx.t('attributes.dataTypeOptions.json', 'JSON') },
                                            { value: 'TABLE', label: ctx.t('attributes.dataTypeOptions.table', 'Table') }
                                        ]}
                                        typeSettingsLabel={ctx.t('attributes.typeSettings.title', 'Type Settings')}
                                        stringMaxLengthLabel={ctx.t('attributes.typeSettings.string.maxLength', 'Max Length')}
                                        stringMinLengthLabel={ctx.t('attributes.typeSettings.string.minLength', 'Min Length')}
                                        stringVersionedLabel={ctx.t('attributes.typeSettings.string.versioned', 'Versioned (VLC)')}
                                        stringLocalizedLabel={ctx.t('attributes.typeSettings.string.localized', 'Localized (VLC)')}
                                        numberPrecisionLabel={ctx.t('attributes.typeSettings.number.precision', 'Precision')}
                                        numberScaleLabel={ctx.t('attributes.typeSettings.number.scale', 'Scale')}
                                        numberMinLabel={ctx.t('attributes.typeSettings.number.min', 'Min Value')}
                                        numberMaxLabel={ctx.t('attributes.typeSettings.number.max', 'Max Value')}
                                        numberNonNegativeLabel={ctx.t('attributes.typeSettings.number.nonNegative', 'Non-negative only')}
                                        dateCompositionLabel={ctx.t('attributes.typeSettings.date.composition', 'Date Composition')}
                                        dateCompositionOptions={[
                                            {
                                                value: 'date',
                                                label: ctx.t('attributes.typeSettings.date.compositionOptions.date', 'Date only')
                                            },
                                            {
                                                value: 'time',
                                                label: ctx.t('attributes.typeSettings.date.compositionOptions.time', 'Time only')
                                            },
                                            {
                                                value: 'datetime',
                                                label: ctx.t('attributes.typeSettings.date.compositionOptions.datetime', 'Date and Time')
                                            }
                                        ]}
                                        physicalTypeLabel={ctx.t('attributes.physicalType.label', 'PostgreSQL type')}
                                        metahubId={(ctx as any).metahubId as string}
                                        currentCatalogId={(ctx as any).catalogId as string | undefined}
                                        dataTypeDisabled
                                        dataTypeHelperText={ctx.t(
                                            'attributes.edit.typeChangeDisabled',
                                            'Data type cannot be changed after creation'
                                        )}
                                        disableVlcToggles
                                        hideDisplayAttribute
                                    />
                                )
                            },
                            {
                                id: 'presentation',
                                label: ctx.t('attributes.tabs.presentation', 'Presentation'),
                                content: (
                                    <PresentationTabFields
                                        values={values}
                                        setValue={setValue}
                                        isLoading={isLoading}
                                        metahubId={(ctx as any).metahubId as string | undefined}
                                        displayAttributeLabel={ctx.t('attributes.isDisplayAttributeLabel', 'Display attribute')}
                                        displayAttributeHelper={ctx.t(
                                            'attributes.isDisplayAttributeHelper',
                                            'Use as representation when referencing elements of this catalog'
                                        )}
                                        displayAttributeLocked={displayAttributeLocked}
                                        headerAsCheckboxLabel={ctx.t(
                                            'attributes.presentation.headerAsCheckbox',
                                            'Display header as checkbox'
                                        )}
                                        headerAsCheckboxHelper={ctx.t(
                                            'attributes.presentation.headerAsCheckboxHelper',
                                            'Show a checkbox in the column header instead of the text label'
                                        )}
                                        dataType={values.dataType ?? 'STRING'}
                                        targetEntityKind={values.targetEntityKind ?? null}
                                        targetEntityId={values.targetEntityId ?? null}
                                        isRequired={Boolean(values.isRequired)}
                                    />
                                )
                            }
                        ]
                    },
                    validate: (values: Record<string, any>) => validateAttributeForm(ctx, values),
                    canSave: canSaveAttributeForm,
                    showDeleteButton: true,
                    deleteButtonDisabled: isDisplayAttributeEntity(ctx),
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
                            console.error('Failed to refresh attributes list after edit', e)
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
        id: 'copy',
        labelKey: 'common:actions.copy',
        icon: <ContentCopyRoundedIcon />,
        order: 15,
        dialog: {
            loader: async () => {
                const module = await import('@universo/template-mui/components/dialogs')
                return { default: module.EntityFormDialog }
            },
            buildProps: (ctx) => {
                const attributeMap = ctx.attributeMap as Map<string, Attribute> | undefined
                const raw = attributeMap?.get(ctx.entity.id)
                const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)
                const sourceName = raw?.codename ?? ctx.entity?.codename ?? 'attribute'
                const rawDataType = raw?.dataType ?? ctx.entity?.dataType
                const sourceDataType = ATTRIBUTE_DATA_TYPES.has(rawDataType as Attribute['dataType'])
                    ? (rawDataType as Attribute['dataType'])
                    : 'STRING'
                const initial = {
                    nameVlc: appendCopySuffix(raw?.name ?? null, uiLocale, sourceName),
                    codename: sanitizeCodename(`${raw?.codename ?? ctx.entity?.codename ?? 'attribute'}-copy`),
                    codenameTouched: true,
                    dataType: sourceDataType,
                    isRequired: raw?.isRequired ?? ctx.entity?.isRequired ?? false,
                    isDisplayAttribute: false,
                    targetEntityId: raw?.targetEntityId ?? ctx.entity?.targetEntityId ?? null,
                    targetEntityKind: raw?.targetEntityKind ?? ctx.entity?.targetEntityKind ?? null,
                    validationRules: raw?.validationRules ?? ctx.entity?.validationRules ?? {},
                    uiConfig: raw?.uiConfig ?? ctx.entity?.uiConfig ?? {},
                    copyChildAttributes: true
                }

                return {
                    open: true,
                    mode: 'copy' as const,
                    key: `attribute-copy-${ctx.entity.id}-${sourceDataType}-${raw?.version ?? 'na'}`,
                    title: ctx.t('attributes.copyTitle', 'Copy Attribute'),
                    saveButtonText: ctx.t('attributes.copy.action', 'Copy'),
                    savingButtonText: ctx.t('attributes.copy.actionLoading', 'Copying...'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    hideDefaultFields: true,
                    initialExtraValues: initial,
                    tabs: ({
                        values,
                        setValue,
                        isLoading,
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
                                label: ctx.t('attributes.copy.generalTab', 'General'),
                                content: (
                                    <AttributeFormFields
                                        values={values}
                                        setValue={setValue}
                                        isLoading={isLoading}
                                        errors={errors}
                                        uiLocale={ctx.uiLocale as string}
                                        nameLabel={ctx.t('common:fields.name')}
                                        codenameLabel={ctx.t('attributes.codename', 'Codename')}
                                        codenameHelper={ctx.t('attributes.codenameHelper', 'Unique identifier')}
                                        dataTypeLabel={ctx.t('attributes.dataType', 'Data Type')}
                                        requiredLabel={ctx.t('attributes.isRequiredLabel', 'Required')}
                                        displayAttributeLabel={ctx.t('attributes.isDisplayAttributeLabel', 'Display attribute')}
                                        displayAttributeHelper={ctx.t(
                                            'attributes.isDisplayAttributeHelper',
                                            'Use as representation when referencing elements of this catalog'
                                        )}
                                        displayAttributeLocked={false}
                                        dataTypeOptions={[
                                            { value: 'STRING', label: ctx.t('attributes.dataTypeOptions.string', 'String') },
                                            { value: 'NUMBER', label: ctx.t('attributes.dataTypeOptions.number', 'Number') },
                                            { value: 'BOOLEAN', label: ctx.t('attributes.dataTypeOptions.boolean', 'Boolean') },
                                            { value: 'DATE', label: ctx.t('attributes.dataTypeOptions.date', 'Date') },
                                            { value: 'REF', label: ctx.t('attributes.dataTypeOptions.ref', 'Reference') },
                                            { value: 'JSON', label: ctx.t('attributes.dataTypeOptions.json', 'JSON') },
                                            { value: 'TABLE', label: ctx.t('attributes.dataTypeOptions.table', 'Table') }
                                        ]}
                                        typeSettingsLabel={ctx.t('attributes.typeSettings.title', 'Type Settings')}
                                        stringMaxLengthLabel={ctx.t('attributes.typeSettings.string.maxLength', 'Max Length')}
                                        stringMinLengthLabel={ctx.t('attributes.typeSettings.string.minLength', 'Min Length')}
                                        stringVersionedLabel={ctx.t('attributes.typeSettings.string.versioned', 'Versioned (VLC)')}
                                        stringLocalizedLabel={ctx.t('attributes.typeSettings.string.localized', 'Localized (VLC)')}
                                        numberPrecisionLabel={ctx.t('attributes.typeSettings.number.precision', 'Precision')}
                                        numberScaleLabel={ctx.t('attributes.typeSettings.number.scale', 'Scale')}
                                        numberMinLabel={ctx.t('attributes.typeSettings.number.min', 'Min Value')}
                                        numberMaxLabel={ctx.t('attributes.typeSettings.number.max', 'Max Value')}
                                        numberNonNegativeLabel={ctx.t('attributes.typeSettings.number.nonNegative', 'Non-negative only')}
                                        dateCompositionLabel={ctx.t('attributes.typeSettings.date.composition', 'Date Composition')}
                                        dateCompositionOptions={[
                                            {
                                                value: 'date',
                                                label: ctx.t('attributes.typeSettings.date.compositionOptions.date', 'Date only')
                                            },
                                            {
                                                value: 'time',
                                                label: ctx.t('attributes.typeSettings.date.compositionOptions.time', 'Time only')
                                            },
                                            {
                                                value: 'datetime',
                                                label: ctx.t('attributes.typeSettings.date.compositionOptions.datetime', 'Date and Time')
                                            }
                                        ]}
                                        physicalTypeLabel={ctx.t('attributes.physicalType.label', 'PostgreSQL type')}
                                        metahubId={(ctx as any).metahubId as string}
                                        currentCatalogId={(ctx as any).catalogId as string | undefined}
                                        dataTypeDisabled
                                        disableVlcToggles
                                        hideDisplayAttribute
                                    />
                                )
                            },
                            {
                                id: 'presentation',
                                label: ctx.t('attributes.tabs.presentation', 'Presentation'),
                                content: (
                                    <PresentationTabFields
                                        values={values}
                                        setValue={setValue}
                                        isLoading={isLoading}
                                        metahubId={(ctx as any).metahubId as string | undefined}
                                        displayAttributeLabel={ctx.t('attributes.isDisplayAttributeLabel', 'Display attribute')}
                                        displayAttributeHelper={ctx.t(
                                            'attributes.isDisplayAttributeHelper',
                                            'Use as representation when referencing elements of this catalog'
                                        )}
                                        displayAttributeLocked={false}
                                        forceDisplayAttributeWhenLocked={false}
                                        headerAsCheckboxLabel={ctx.t(
                                            'attributes.presentation.headerAsCheckbox',
                                            'Display header as checkbox'
                                        )}
                                        headerAsCheckboxHelper={ctx.t(
                                            'attributes.presentation.headerAsCheckboxHelper',
                                            'Show a checkbox in the column header instead of the text label'
                                        )}
                                        dataType={values.dataType ?? 'STRING'}
                                        targetEntityKind={values.targetEntityKind ?? null}
                                        targetEntityId={values.targetEntityId ?? null}
                                        isRequired={Boolean(values.isRequired)}
                                    />
                                )
                            }
                        ]
                        if (sourceDataType === 'TABLE') {
                            tabs.push({
                                id: 'options',
                                label: ctx.t('attributes.copy.optionsTab', 'Options'),
                                content: (
                                    <Stack spacing={1}>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={Boolean(values.copyChildAttributes ?? true)}
                                                    onChange={(event) => setValue('copyChildAttributes', event.target.checked)}
                                                    disabled={isLoading}
                                                />
                                            }
                                            label={ctx.t('attributes.copy.copyChildAttributes', 'Copy child attributes')}
                                        />
                                    </Stack>
                                )
                            })
                        }
                        return tabs
                    },
                    validate: (values: Record<string, any>) => {
                        const errors: Record<string, string> = {}
                        const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
                        if (!hasPrimaryContent(nameVlc)) {
                            errors.nameVlc = ctx.t('common:crud.nameRequired', 'Name is required')
                        }
                        const codename = sanitizeCodename(String(values.codename ?? ''))
                        if (!codename) {
                            errors.codename = ctx.t('attributes.validation.codenameRequired', 'Codename is required')
                        } else if (!isValidCodename(codename)) {
                            errors.codename = ctx.t('attributes.validation.codenameInvalid', 'Codename contains invalid characters')
                        }
                        return Object.keys(errors).length > 0 ? errors : null
                    },
                    canSave: (values: Record<string, any>) => {
                        const codename = sanitizeCodename(String(values.codename ?? ''))
                        return Boolean(codename) && isValidCodename(codename) && hasPrimaryContent(values.nameVlc)
                    },
                    onSave: async (values: Record<string, any>) => {
                        try {
                            const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(values.nameVlc)
                            const payload: Record<string, unknown> = {
                                codename: sanitizeCodename(String(values.codename ?? '')),
                                name: nameInput ?? {},
                                namePrimaryLocale,
                                validationRules: values.validationRules ?? {},
                                uiConfig: values.uiConfig ?? {},
                                isRequired: typeof values.isRequired === 'boolean' ? values.isRequired : false
                            }
                            if (sourceDataType === 'TABLE') {
                                payload.copyChildAttributes = Boolean(values.copyChildAttributes ?? true)
                            }
                            await ctx.api?.copyEntity?.(ctx.entity.id, payload)
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
        id: 'move-up',
        labelKey: 'attributes.actions.moveUp',
        icon: <ArrowUpwardRoundedIcon />,
        order: 20,
        group: 'reorder',
        enabled: (ctx) => {
            const attributeMap = ctx.attributeMap as Map<string, Attribute> | undefined
            if ((attributeMap?.size ?? 0) <= 1) return false
            const { min } = getSortBounds(attributeMap)
            const current = getCurrentSortOrder(ctx, attributeMap)
            if (min == null || current == null) return false
            return current > min
        },
        onSelect: async (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
            try {
                if (typeof (ctx as any).moveAttribute === 'function') {
                    await (ctx as any).moveAttribute(ctx.entity.id, 'up')
                }
            } catch (error: unknown) {
                notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
            }
        }
    },
    {
        id: 'move-down',
        labelKey: 'attributes.actions.moveDown',
        icon: <ArrowDownwardRoundedIcon />,
        order: 30,
        group: 'reorder',
        enabled: (ctx) => {
            const attributeMap = ctx.attributeMap as Map<string, Attribute> | undefined
            if ((attributeMap?.size ?? 0) <= 1) return false
            const { max } = getSortBounds(attributeMap)
            const current = getCurrentSortOrder(ctx, attributeMap)
            if (max == null || current == null) return false
            return current < max
        },
        onSelect: async (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
            try {
                if (typeof (ctx as any).moveAttribute === 'function') {
                    await (ctx as any).moveAttribute(ctx.entity.id, 'down')
                }
            } catch (error: unknown) {
                notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
            }
        }
    },
    {
        id: 'set-required',
        labelKey: 'attributes.actions.setRequired',
        icon: <CheckCircleOutlineIcon />,
        order: 40,
        group: 'flags',
        visible: (ctx) => {
            const attributeMap = ctx.attributeMap as Map<string, Attribute> | undefined
            const raw = attributeMap?.get(ctx.entity.id)
            const isRequired = raw?.isRequired ?? ctx.entity?.isRequired ?? false
            return !isRequired
        },
        onSelect: async (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
            try {
                if (typeof (ctx as any).toggleRequired === 'function') {
                    await (ctx as any).toggleRequired(ctx.entity.id, true)
                }
            } catch (error: unknown) {
                notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
            }
        }
    },
    {
        id: 'set-optional',
        labelKey: 'attributes.actions.setOptional',
        icon: <RadioButtonUncheckedIcon />,
        order: 41,
        group: 'flags',
        visible: (ctx) => {
            const attributeMap = ctx.attributeMap as Map<string, Attribute> | undefined
            const raw = attributeMap?.get(ctx.entity.id)
            const isRequired = raw?.isRequired ?? ctx.entity?.isRequired ?? false
            const isDisplayAttribute = raw?.isDisplayAttribute ?? (ctx.entity as any)?.isDisplayAttribute ?? false
            return isRequired && !isDisplayAttribute
        },
        onSelect: async (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
            try {
                if (typeof (ctx as any).toggleRequired === 'function') {
                    await (ctx as any).toggleRequired(ctx.entity.id, false)
                }
            } catch (error: unknown) {
                notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
            }
        }
    },
    {
        id: 'set-display-attribute',
        labelKey: 'attributes.actions.setDisplayAttribute',
        icon: <StarOutlineIcon />,
        order: 50,
        group: 'flags',
        visible: (ctx) => {
            const attributeMap = ctx.attributeMap as Map<string, Attribute> | undefined
            const raw = attributeMap?.get(ctx.entity.id)
            const isDisplayAttribute = raw?.isDisplayAttribute ?? (ctx.entity as any)?.isDisplayAttribute ?? false
            // Hide if already display attribute or if only one attribute (locked)
            return !isDisplayAttribute
        },
        onSelect: async (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
            try {
                if (typeof (ctx as any).toggleDisplayAttribute === 'function') {
                    await (ctx as any).toggleDisplayAttribute(ctx.entity.id, true)
                }
            } catch (error: unknown) {
                notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
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
        enabled: (ctx) => !isDisplayAttributeEntity(ctx),
        dialog: {
            loader: async () => {
                const module = await import('@universo/template-mui/components/dialogs')
                return { default: module.ConfirmDeleteDialog }
            },
            buildProps: (ctx) => ({
                open: true,
                title: ctx.t('attributes.deleteDialog.title', 'Delete Attribute'),
                description: ctx.t('attributes.deleteDialog.message'),
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

export default attributeActions
