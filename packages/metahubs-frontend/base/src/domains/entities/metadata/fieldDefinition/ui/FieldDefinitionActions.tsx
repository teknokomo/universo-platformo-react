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
import type { VersionedLocalizedContent, EntityKind } from '@universo/types'
import type {
    FieldDefinition,
    FieldDefinitionDisplay,
    FieldDefinitionLocalizedPayload,
    FieldDefinitionValidationRules
} from '../../../../../types'
import { getVLCString } from '../../../../../types'
import { normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../../../utils/codename'
import type { CodenameConfig } from '../../../../settings/hooks/useCodenameConfig'

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

type GenericFormValues = Record<string, unknown>

const ensureFormValues = (values?: GenericFormValues | null): GenericFormValues => values ?? {}

type AttributeContextExtras = {
    metahubId?: string
    linkedCollectionId?: string
    sharedEntityMode?: boolean
    allowAttributeCopy?: boolean
    allowAttributeDelete?: boolean
    allowDeleteLastDisplayAttribute?: boolean
    moveAttribute?: (id: string, direction: 'up' | 'down') => Promise<void>
    toggleRequired?: (id: string, value: boolean) => Promise<void>
    toggleDisplayAttribute?: (id: string, value: boolean) => Promise<void>
}

type AttributeTabArgs = {
    values: GenericFormValues
    setValue: (name: string, value: unknown) => void
    isLoading: boolean
    errors: Record<string, string>
}

const getEntityDisplayAttributeFlag = (entity: FieldDefinitionDisplay): boolean =>
    Boolean((entity as { isDisplayAttribute?: boolean }).isDisplayAttribute)

const canDeleteAttributeEntity = (ctx: ActionContext<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload>): boolean => {
    const contextExtras = ctx as ActionContext<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload> & AttributeContextExtras
    if (contextExtras.allowAttributeDelete === false) return false

    const attributeMap = ctx.attributeMap as Map<string, FieldDefinition> | undefined
    const raw = attributeMap?.get(ctx.entity.id)
    const isDisplayAttribute = raw?.isDisplayAttribute ?? getEntityDisplayAttributeFlag(ctx.entity)

    if (!isDisplayAttribute) return true
    if (contextExtras.allowDeleteLastDisplayAttribute !== false) return true

    if (!attributeMap) return false
    const scopeParentId = raw?.parentAttributeId ?? null
    const displayCount = Array.from(attributeMap.values()).reduce((count, attribute) => {
        const parentId = attribute.parentAttributeId ?? null
        if (parentId !== scopeParentId) return count
        return count + (attribute.isDisplayAttribute ? 1 : 0)
    }, 0)
    return displayCount > 1
}

import {
    extractLocalizedInput,
    ensureLocalizedContent,
    ensureEntityCodenameContent,
    hasPrimaryContent,
    normalizeLocale
} from '../../../../../utils/localizedInput'
import FieldDefinitionFormFields, { PresentationTabFields } from './FieldDefinitionFormFields'
import { shouldForceFirstAttributeDefaults, shouldLockDisplayAttributeToggle } from './fieldDefinitionDisplayRules'
import SharedEntitySettingsFields from '../../../../shared/ui/SharedEntitySettingsFields'
import { createScriptsTab } from '../../../../scripts/ui/EntityScriptsTab'
import { readSharedExcludedTargetIdsField, SHARED_EXCLUDED_TARGET_IDS_FIELD } from '../../../../shared/sharedEntityExclusions'

const _DIALOG_SAVE_CANCEL = { __dialogCancelled: true } as const

const FIELD_DEFINITION_DATA_TYPES = new Set<FieldDefinition['dataType']>(['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'JSON', 'TABLE'])

const buildInitialValues = (ctx: ActionContext<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload>) => {
    const attributeMap = ctx.attributeMap as Map<string, FieldDefinition> | undefined
    const raw = attributeMap?.get(ctx.entity.id)
    const contextExtras = ctx as ActionContext<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload> & AttributeContextExtras
    const shouldForceDefaults = shouldForceFirstAttributeDefaults(attributeMap?.size ?? 0, contextExtras.sharedEntityMode)
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)
    const nameFallback = ctx.entity?.name || ctx.entity?.codename || ''

    return {
        nameVlc: ensureLocalizedContent(raw?.name ?? ctx.entity?.name, uiLocale, nameFallback),
        codename: ensureEntityCodenameContent(raw, uiLocale, raw?.codename ?? ctx.entity?.codename ?? ''),
        codenameTouched: true,
        dataType: raw?.dataType ?? ctx.entity?.dataType ?? 'STRING',
        isRequired: shouldForceDefaults ? true : raw?.isRequired ?? ctx.entity?.isRequired ?? false,
        isDisplayAttribute: shouldForceDefaults ? true : raw?.isDisplayAttribute ?? getEntityDisplayAttributeFlag(ctx.entity),
        validationRules: raw?.validationRules ?? ctx.entity?.validationRules ?? {},
        targetEntityId: raw?.targetEntityId ?? ctx.entity?.targetEntityId ?? null,
        targetEntityKind: raw?.targetEntityKind ?? ctx.entity?.targetEntityKind ?? null,
        targetConstantId: raw?.targetConstantId ?? ctx.entity?.targetConstantId ?? null,
        uiConfig: raw?.uiConfig ?? ctx.entity?.uiConfig ?? {}
    }
}

const validateAttributeForm = (
    ctx: ActionContext<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload>,
    rawValues?: GenericFormValues | null
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
        errors.codename = ctx.t('fieldDefinitions.validation.codenameRequired', 'Codename is required')
    } else if (!isValidCodenameForStyle(normalizedCodename, cc.style, cc.alphabet, cc.allowMixed)) {
        errors.codename = ctx.t('fieldDefinitions.validation.codenameInvalid', 'Codename contains invalid characters')
    }
    if (values.dataType === 'REF') {
        if (!values.targetEntityKind) {
            errors.targetEntityKind = ctx.t(
                'fieldDefinitions.validation.targetEntityKindRequired',
                'Target entity type is required for Reference type'
            )
        }
        if (!values.targetEntityId) {
            errors.targetEntityId = ctx.t(
                'fieldDefinitions.validation.targetEntityIdRequired',
                'Target entity is required for Reference type'
            )
        }
        if (values.targetEntityKind === 'set' && !values.targetConstantId) {
            errors.targetConstantId = ctx.t(
                'fieldDefinitions.validation.targetConstantIdRequired',
                'Target constant is required for references to Set'
            )
        }
    }
    if (values.dataType === 'REF' && values.targetEntityKind !== 'set' && values.targetConstantId) {
        errors.targetConstantId = ctx.t(
            'fieldDefinitions.validation.targetConstantOnlyForSet',
            'Target constant can be selected only for references to Set'
        )
    }
    return Object.keys(errors).length > 0 ? errors : null
}

const canSaveAttributeForm = (rawValues?: GenericFormValues | null) => {
    const values = ensureFormValues(rawValues)
    const cc = _cc(values)
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
    const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? 'en'
    const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
    const normalizedCodename = normalizeCodenameForStyle(rawCodename, cc.style, cc.alphabet)
    const hasBasicInfo =
        !values._hasCodenameDuplicate &&
        hasPrimaryContent(nameVlc) &&
        Boolean(normalizedCodename) &&
        isValidCodenameForStyle(normalizedCodename, cc.style, cc.alphabet, cc.allowMixed)
    if (values.dataType === 'REF') {
        const hasTarget = Boolean(values.targetEntityKind) && Boolean(values.targetEntityId)
        if (!hasTarget) return false
        if (values.targetEntityKind === 'set') {
            return Boolean(values.targetConstantId)
        }
        return true
    }
    return hasBasicInfo
}

const sanitizeAttributeUiConfig = (
    dataType: FieldDefinitionLocalizedPayload['dataType'],
    targetEntityKind: EntityKind | null | undefined,
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

const toPayload = (rawValues?: GenericFormValues | null): FieldDefinitionLocalizedPayload & Record<string, unknown> => {
    const values = ensureFormValues(rawValues)
    const cc = _cc(values)
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
    const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
    const codenamePrimaryLocale = codenameValue?._primary ?? namePrimaryLocale ?? 'en'
    const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
    const codename = normalizeCodenameForStyle(rawCodename, cc.style, cc.alphabet)
    const dataType = (values.dataType as FieldDefinitionLocalizedPayload['dataType']) ?? 'STRING'
    const isRequired = Boolean(values.isRequired)
    const isDisplayAttribute = Boolean(values.isDisplayAttribute)
    const validationRules = values.validationRules as FieldDefinitionValidationRules | undefined
    const targetEntityId = (values.targetEntityId as string | null | undefined) ?? undefined
    const targetEntityKind = (values.targetEntityKind as EntityKind | null | undefined) ?? undefined
    const targetConstantId =
        dataType === 'REF' && targetEntityKind === 'set' ? (values.targetConstantId as string | null | undefined) ?? null : undefined
    const sourceUiConfig = (values.uiConfig as Record<string, unknown> | undefined) ?? {}
    const uiConfig = sanitizeAttributeUiConfig(dataType, targetEntityKind, sourceUiConfig, isRequired)
    const codenamePayload = ensureLocalizedContent(codenameValue, namePrimaryLocale ?? codenamePrimaryLocale, codename)

    const payload: FieldDefinitionLocalizedPayload & Record<string, unknown> = {
        codename: codenamePayload,
        dataType,
        isRequired,
        isDisplayAttribute,
        name: nameInput ?? {},
        namePrimaryLocale,
        validationRules,
        targetEntityId,
        targetEntityKind,
        targetConstantId,
        uiConfig: Object.keys(uiConfig).length > 0 ? uiConfig : undefined
    }

    const sharedExcludedTargetIds = readSharedExcludedTargetIdsField(values)
    if (sharedExcludedTargetIds !== undefined) {
        payload[SHARED_EXCLUDED_TARGET_IDS_FIELD] = sharedExcludedTargetIds
    }

    return payload
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

const getSortBounds = (attributeMap?: Map<string, FieldDefinition>) => {
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

const getCurrentSortOrder = (
    ctx: ActionContext<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload>,
    attributeMap?: Map<string, FieldDefinition>
) => {
    const fromMap = attributeMap?.get(ctx.entity.id)
    return resolveSortOrder(fromMap) ?? resolveSortOrder(ctx.entity)
}

const isDisplayAttributeEntity = (ctx: ActionContext<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload>) => {
    const attributeMap = ctx.attributeMap as Map<string, FieldDefinition> | undefined
    const raw = attributeMap?.get(ctx.entity.id)
    return Boolean(raw?.isDisplayAttribute ?? getEntityDisplayAttributeFlag(ctx.entity))
}

const attributeActions: readonly ActionDescriptor<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload>[] = [
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
                const contextExtras = ctx as ActionContext<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload> & AttributeContextExtras
                return {
                    open: true,
                    mode: 'edit' as const,
                    title: ctx.t('fieldDefinitions.editDialog.title', 'Edit Field Definition'),
                    nameLabel: ctx.t('common:fields.name'),
                    descriptionLabel: ctx.t('common:fields.description'),
                    saveButtonText: ctx.t('common:actions.save'),
                    savingButtonText: ctx.t('common:actions.saving'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    hideDefaultFields: true,
                    initialExtraValues: initial,
                    tabs: ({ values, setValue, isLoading, errors }: AttributeTabArgs): TabConfig[] => {
                        const attributeMap = ctx.attributeMap as Map<string, FieldDefinition> | undefined
                        const displayAttributeLocked = shouldLockDisplayAttributeToggle({
                            attributeCount: attributeMap?.size ?? 0,
                            sharedEntityMode: contextExtras.sharedEntityMode,
                            isCurrentDisplayAttribute: isDisplayAttributeEntity(ctx)
                        })
                        const tabs: TabConfig[] = [
                            {
                                id: 'general',
                                label: ctx.t('fieldDefinitions.tabs.general', 'General'),
                                content: (
                                    <FieldDefinitionFormFields
                                        values={values}
                                        setValue={setValue}
                                        isLoading={isLoading}
                                        errors={errors}
                                        uiLocale={ctx.uiLocale as string}
                                        nameLabel={ctx.t('common:fields.name')}
                                        codenameLabel={ctx.t('fieldDefinitions.codename', 'Codename')}
                                        codenameHelper={ctx.t('fieldDefinitions.codenameHelper', 'Unique identifier')}
                                        dataTypeLabel={ctx.t('fieldDefinitions.dataType', 'Data Type')}
                                        requiredLabel={ctx.t('fieldDefinitions.isRequiredLabel', 'Required')}
                                        displayAttributeLabel={ctx.t('fieldDefinitions.isDisplayAttributeLabel', 'Display attribute')}
                                        displayAttributeHelper={ctx.t(
                                            'fieldDefinitions.isDisplayAttributeHelper',
                                            'Use as representation when referencing records of this catalog'
                                        )}
                                        displayAttributeLocked={displayAttributeLocked}
                                        dataTypeOptions={[
                                            { value: 'STRING', label: ctx.t('fieldDefinitions.dataTypeOptions.string', 'String') },
                                            { value: 'NUMBER', label: ctx.t('fieldDefinitions.dataTypeOptions.number', 'Number') },
                                            { value: 'BOOLEAN', label: ctx.t('fieldDefinitions.dataTypeOptions.boolean', 'Boolean') },
                                            { value: 'DATE', label: ctx.t('fieldDefinitions.dataTypeOptions.date', 'Date') },
                                            { value: 'REF', label: ctx.t('fieldDefinitions.dataTypeOptions.ref', 'Reference') },
                                            { value: 'JSON', label: ctx.t('fieldDefinitions.dataTypeOptions.json', 'JSON') },
                                            { value: 'TABLE', label: ctx.t('fieldDefinitions.dataTypeOptions.table', 'Table') }
                                        ]}
                                        typeSettingsLabel={ctx.t('fieldDefinitions.typeSettings.title', 'Type Settings')}
                                        stringMaxLengthLabel={ctx.t('fieldDefinitions.typeSettings.string.maxLength', 'Max Length')}
                                        stringMinLengthLabel={ctx.t('fieldDefinitions.typeSettings.string.minLength', 'Min Length')}
                                        stringVersionedLabel={ctx.t('fieldDefinitions.typeSettings.string.versioned', 'Versioned (VLC)')}
                                        stringLocalizedLabel={ctx.t('fieldDefinitions.typeSettings.string.localized', 'Localized (VLC)')}
                                        numberPrecisionLabel={ctx.t('fieldDefinitions.typeSettings.number.precision', 'Precision')}
                                        numberScaleLabel={ctx.t('fieldDefinitions.typeSettings.number.scale', 'Scale')}
                                        numberMinLabel={ctx.t('fieldDefinitions.typeSettings.number.min', 'Min Value')}
                                        numberMaxLabel={ctx.t('fieldDefinitions.typeSettings.number.max', 'Max Value')}
                                        numberNonNegativeLabel={ctx.t(
                                            'fieldDefinitions.typeSettings.number.nonNegative',
                                            'Non-negative only'
                                        )}
                                        dateCompositionLabel={ctx.t('fieldDefinitions.typeSettings.date.composition', 'Date Composition')}
                                        dateCompositionOptions={[
                                            {
                                                value: 'date',
                                                label: ctx.t('fieldDefinitions.typeSettings.date.compositionOptions.date', 'Date only')
                                            },
                                            {
                                                value: 'time',
                                                label: ctx.t('fieldDefinitions.typeSettings.date.compositionOptions.time', 'Time only')
                                            },
                                            {
                                                value: 'datetime',
                                                label: ctx.t(
                                                    'fieldDefinitions.typeSettings.date.compositionOptions.datetime',
                                                    'Date and Time'
                                                )
                                            }
                                        ]}
                                        physicalTypeLabel={ctx.t('fieldDefinitions.physicalType.label', 'PostgreSQL type')}
                                        metahubId={contextExtras.metahubId as string}
                                        currentLinkedCollectionId={contextExtras.linkedCollectionId}
                                        dataTypeDisabled
                                        dataTypeHelperText={ctx.t(
                                            'fieldDefinitions.edit.typeChangeDisabled',
                                            'Data type cannot be changed after creation'
                                        )}
                                        disableVlcToggles
                                        hideDisplayAttribute
                                        editingEntityId={ctx.entity.id}
                                    />
                                )
                            },
                            {
                                id: 'presentation',
                                label: ctx.t('fieldDefinitions.tabs.presentation', 'Presentation'),
                                content: (
                                    <Stack spacing={2}>
                                        <PresentationTabFields
                                            values={values}
                                            setValue={setValue}
                                            isLoading={isLoading}
                                            metahubId={contextExtras.metahubId}
                                            displayAttributeLabel={ctx.t('fieldDefinitions.isDisplayAttributeLabel', 'Display attribute')}
                                            displayAttributeHelper={ctx.t(
                                                'fieldDefinitions.isDisplayAttributeHelper',
                                                'Use as representation when referencing records of this catalog'
                                            )}
                                            displayAttributeLocked={displayAttributeLocked}
                                            headerAsCheckboxLabel={ctx.t(
                                                'fieldDefinitions.presentation.headerAsCheckbox',
                                                'Display header as checkbox'
                                            )}
                                            headerAsCheckboxHelper={ctx.t(
                                                'fieldDefinitions.presentation.headerAsCheckboxHelper',
                                                'Show a checkbox in the column header instead of the text label'
                                            )}
                                            dataType={values.dataType ?? 'STRING'}
                                            targetEntityKind={values.targetEntityKind ?? null}
                                            targetEntityId={values.targetEntityId ?? null}
                                            isRequired={Boolean(values.isRequired)}
                                        />
                                        {contextExtras.sharedEntityMode ? (
                                            <SharedEntitySettingsFields
                                                metahubId={contextExtras.metahubId}
                                                entityKind='attribute'
                                                sharedEntityId={ctx.entity.id}
                                                storageField='uiConfig'
                                                section='behavior'
                                                values={values}
                                                setValue={setValue}
                                                isLoading={isLoading}
                                            />
                                        ) : null}
                                    </Stack>
                                )
                            },
                            createScriptsTab({
                                t: ctx.t,
                                metahubId: contextExtras.metahubId,
                                attachedToKind: 'attribute',
                                attachedToId: ctx.entity.id
                            })
                        ]

                        if (contextExtras.sharedEntityMode) {
                            tabs.splice(2, 0, {
                                id: 'exclusions',
                                label: ctx.t('shared.exclusions.tab', 'Exclusions'),
                                content: (
                                    <SharedEntitySettingsFields
                                        metahubId={contextExtras.metahubId}
                                        entityKind='attribute'
                                        sharedEntityId={ctx.entity.id}
                                        storageField='uiConfig'
                                        section='exclusions'
                                        values={values}
                                        setValue={setValue}
                                        isLoading={isLoading}
                                    />
                                )
                            })
                        }

                        return tabs
                    },
                    validate: (values: GenericFormValues) => validateAttributeForm(ctx, values),
                    canSave: canSaveAttributeForm,
                    showDeleteButton: true,
                    deleteButtonDisabled: !canDeleteAttributeEntity(ctx),
                    deleteButtonText: ctx.t('common:actions.delete'),
                    onDelete: () => {
                        ctx.helpers?.openDeleteDialog?.(ctx.entity)
                    },
                    onClose: () => {
                        // BaseEntityMenu handles dialog closing
                    },
                    onSave: async (data: GenericFormValues) => {
                        try {
                            const payload = toPayload(data)
                            await ctx.api?.updateEntity?.(ctx.entity.id, payload)
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
        icon: <ContentCopyRoundedIcon />,
        order: 15,
        visible: (ctx) => {
            const contextExtras = ctx as ActionContext<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload> & AttributeContextExtras
            return contextExtras.allowAttributeCopy !== false
        },
        dialog: {
            loader: async () => {
                const module = await import('@universo/template-mui/components/dialogs')
                return { default: module.EntityFormDialog }
            },
            buildProps: (ctx) => {
                const attributeMap = ctx.attributeMap as Map<string, FieldDefinition> | undefined
                const raw = attributeMap?.get(ctx.entity.id)
                const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)
                const sourceName = raw?.codename ?? ctx.entity?.codename ?? 'attribute'
                const rawDataType = raw?.dataType ?? ctx.entity?.dataType
                const sourceDataType = FIELD_DEFINITION_DATA_TYPES.has(rawDataType as FieldDefinition['dataType'])
                    ? (rawDataType as FieldDefinition['dataType'])
                    : 'STRING'
                const contextExtras = ctx as ActionContext<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload> & AttributeContextExtras
                const initial = {
                    nameVlc: appendCopySuffix(raw?.name ?? null, uiLocale, sourceName),
                    codename: null,
                    codenameTouched: false,
                    dataType: sourceDataType,
                    isRequired: raw?.isRequired ?? ctx.entity?.isRequired ?? false,
                    isDisplayAttribute: false,
                    targetEntityId: raw?.targetEntityId ?? ctx.entity?.targetEntityId ?? null,
                    targetEntityKind: raw?.targetEntityKind ?? ctx.entity?.targetEntityKind ?? null,
                    targetConstantId: raw?.targetConstantId ?? ctx.entity?.targetConstantId ?? null,
                    validationRules: raw?.validationRules ?? ctx.entity?.validationRules ?? {},
                    uiConfig: raw?.uiConfig ?? ctx.entity?.uiConfig ?? {},
                    copyChildFieldDefinitions: true
                }

                return {
                    open: true,
                    mode: 'copy' as const,
                    key: `attribute-copy-${ctx.entity.id}-${sourceDataType}-${raw?.version ?? 'na'}`,
                    title: ctx.t('fieldDefinitions.copyTitle', 'Copy Attribute'),
                    saveButtonText: ctx.t('fieldDefinitions.copy.action', 'Copy'),
                    savingButtonText: ctx.t('fieldDefinitions.copy.actionLoading', 'Copying...'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    hideDefaultFields: true,
                    initialExtraValues: initial,
                    tabs: ({ values, setValue, isLoading, errors }: AttributeTabArgs): TabConfig[] => {
                        const tabs: TabConfig[] = [
                            {
                                id: 'general',
                                label: ctx.t('fieldDefinitions.copy.generalTab', 'General'),
                                content: (
                                    <FieldDefinitionFormFields
                                        values={values}
                                        setValue={setValue}
                                        isLoading={isLoading}
                                        errors={errors}
                                        uiLocale={ctx.uiLocale as string}
                                        nameLabel={ctx.t('common:fields.name')}
                                        codenameLabel={ctx.t('fieldDefinitions.codename', 'Codename')}
                                        codenameHelper={ctx.t('fieldDefinitions.codenameHelper', 'Unique identifier')}
                                        dataTypeLabel={ctx.t('fieldDefinitions.dataType', 'Data Type')}
                                        requiredLabel={ctx.t('fieldDefinitions.isRequiredLabel', 'Required')}
                                        displayAttributeLabel={ctx.t('fieldDefinitions.isDisplayAttributeLabel', 'Display attribute')}
                                        displayAttributeHelper={ctx.t(
                                            'fieldDefinitions.isDisplayAttributeHelper',
                                            'Use as representation when referencing records of this catalog'
                                        )}
                                        displayAttributeLocked={false}
                                        dataTypeOptions={[
                                            { value: 'STRING', label: ctx.t('fieldDefinitions.dataTypeOptions.string', 'String') },
                                            { value: 'NUMBER', label: ctx.t('fieldDefinitions.dataTypeOptions.number', 'Number') },
                                            { value: 'BOOLEAN', label: ctx.t('fieldDefinitions.dataTypeOptions.boolean', 'Boolean') },
                                            { value: 'DATE', label: ctx.t('fieldDefinitions.dataTypeOptions.date', 'Date') },
                                            { value: 'REF', label: ctx.t('fieldDefinitions.dataTypeOptions.ref', 'Reference') },
                                            { value: 'JSON', label: ctx.t('fieldDefinitions.dataTypeOptions.json', 'JSON') },
                                            { value: 'TABLE', label: ctx.t('fieldDefinitions.dataTypeOptions.table', 'Table') }
                                        ]}
                                        typeSettingsLabel={ctx.t('fieldDefinitions.typeSettings.title', 'Type Settings')}
                                        stringMaxLengthLabel={ctx.t('fieldDefinitions.typeSettings.string.maxLength', 'Max Length')}
                                        stringMinLengthLabel={ctx.t('fieldDefinitions.typeSettings.string.minLength', 'Min Length')}
                                        stringVersionedLabel={ctx.t('fieldDefinitions.typeSettings.string.versioned', 'Versioned (VLC)')}
                                        stringLocalizedLabel={ctx.t('fieldDefinitions.typeSettings.string.localized', 'Localized (VLC)')}
                                        numberPrecisionLabel={ctx.t('fieldDefinitions.typeSettings.number.precision', 'Precision')}
                                        numberScaleLabel={ctx.t('fieldDefinitions.typeSettings.number.scale', 'Scale')}
                                        numberMinLabel={ctx.t('fieldDefinitions.typeSettings.number.min', 'Min Value')}
                                        numberMaxLabel={ctx.t('fieldDefinitions.typeSettings.number.max', 'Max Value')}
                                        numberNonNegativeLabel={ctx.t(
                                            'fieldDefinitions.typeSettings.number.nonNegative',
                                            'Non-negative only'
                                        )}
                                        dateCompositionLabel={ctx.t('fieldDefinitions.typeSettings.date.composition', 'Date Composition')}
                                        dateCompositionOptions={[
                                            {
                                                value: 'date',
                                                label: ctx.t('fieldDefinitions.typeSettings.date.compositionOptions.date', 'Date only')
                                            },
                                            {
                                                value: 'time',
                                                label: ctx.t('fieldDefinitions.typeSettings.date.compositionOptions.time', 'Time only')
                                            },
                                            {
                                                value: 'datetime',
                                                label: ctx.t(
                                                    'fieldDefinitions.typeSettings.date.compositionOptions.datetime',
                                                    'Date and Time'
                                                )
                                            }
                                        ]}
                                        physicalTypeLabel={ctx.t('fieldDefinitions.physicalType.label', 'PostgreSQL type')}
                                        metahubId={contextExtras.metahubId as string}
                                        currentLinkedCollectionId={contextExtras.linkedCollectionId}
                                        dataTypeDisabled
                                        disableVlcToggles
                                        hideDisplayAttribute
                                        editingEntityId={null}
                                    />
                                )
                            },
                            {
                                id: 'presentation',
                                label: ctx.t('fieldDefinitions.tabs.presentation', 'Presentation'),
                                content: (
                                    <Stack spacing={2}>
                                        <PresentationTabFields
                                            values={values}
                                            setValue={setValue}
                                            isLoading={isLoading}
                                            metahubId={contextExtras.metahubId}
                                            displayAttributeLabel={ctx.t('fieldDefinitions.isDisplayAttributeLabel', 'Display attribute')}
                                            displayAttributeHelper={ctx.t(
                                                'fieldDefinitions.isDisplayAttributeHelper',
                                                'Use as representation when referencing records of this catalog'
                                            )}
                                            displayAttributeLocked={false}
                                            forceDisplayAttributeWhenLocked={false}
                                            headerAsCheckboxLabel={ctx.t(
                                                'fieldDefinitions.presentation.headerAsCheckbox',
                                                'Display header as checkbox'
                                            )}
                                            headerAsCheckboxHelper={ctx.t(
                                                'fieldDefinitions.presentation.headerAsCheckboxHelper',
                                                'Show a checkbox in the column header instead of the text label'
                                            )}
                                            dataType={values.dataType ?? 'STRING'}
                                            targetEntityKind={values.targetEntityKind ?? null}
                                            targetEntityId={values.targetEntityId ?? null}
                                            isRequired={Boolean(values.isRequired)}
                                        />
                                        {contextExtras.sharedEntityMode ? (
                                            <SharedEntitySettingsFields
                                                metahubId={contextExtras.metahubId}
                                                entityKind='attribute'
                                                sharedEntityId={null}
                                                storageField='uiConfig'
                                                section='behavior'
                                                values={values}
                                                setValue={setValue}
                                                isLoading={isLoading}
                                            />
                                        ) : null}
                                    </Stack>
                                )
                            }
                        ]
                        if (sourceDataType === 'TABLE') {
                            tabs.push({
                                id: 'options',
                                label: ctx.t('fieldDefinitions.copy.optionsTab', 'Options'),
                                content: (
                                    <Stack spacing={1}>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={Boolean(values.copyChildFieldDefinitions ?? true)}
                                                    onChange={(event) => setValue('copyChildFieldDefinitions', event.target.checked)}
                                                    disabled={isLoading}
                                                />
                                            }
                                            label={ctx.t('fieldDefinitions.copy.copyChildAttributes', 'Copy child fieldDefinitions')}
                                        />
                                    </Stack>
                                )
                            })
                        }

                        if (contextExtras.sharedEntityMode) {
                            tabs.splice(2, 0, {
                                id: 'exclusions',
                                label: ctx.t('shared.exclusions.tab', 'Exclusions'),
                                content: (
                                    <SharedEntitySettingsFields
                                        metahubId={contextExtras.metahubId}
                                        entityKind='attribute'
                                        sharedEntityId={null}
                                        storageField='uiConfig'
                                        section='exclusions'
                                        values={values}
                                        setValue={setValue}
                                        isLoading={isLoading}
                                    />
                                )
                            })
                        }

                        return tabs
                    },
                    validate: (values: GenericFormValues) => {
                        const cc = _cc(values)
                        const errors: Record<string, string> = {}
                        const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
                        if (!hasPrimaryContent(nameVlc)) {
                            errors.nameVlc = ctx.t('common:crud.nameRequired', 'Name is required')
                        }
                        const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
                        const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? 'en'
                        const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
                        const codename = normalizeCodenameForStyle(rawCodename, cc.style, cc.alphabet)
                        if (!codename) {
                            errors.codename = ctx.t('fieldDefinitions.validation.codenameRequired', 'Codename is required')
                        } else if (!isValidCodenameForStyle(codename, cc.style, cc.alphabet, cc.allowMixed)) {
                            errors.codename = ctx.t('fieldDefinitions.validation.codenameInvalid', 'Codename contains invalid characters')
                        }
                        return Object.keys(errors).length > 0 ? errors : null
                    },
                    canSave: (values: GenericFormValues) => {
                        const cc = _cc(values)
                        const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
                        const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
                        const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? 'en'
                        const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
                        const codename = normalizeCodenameForStyle(rawCodename, cc.style, cc.alphabet)
                        return (
                            !values._hasCodenameDuplicate &&
                            Boolean(codename) &&
                            isValidCodenameForStyle(codename, cc.style, cc.alphabet, cc.allowMixed) &&
                            hasPrimaryContent(values.nameVlc)
                        )
                    },
                    onSave: async (values: GenericFormValues) => {
                        const cc = _cc(values)
                        try {
                            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
                            const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
                            const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
                            const codenamePrimaryLocale = codenameValue?._primary ?? namePrimaryLocale ?? 'en'
                            const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
                            const codename = normalizeCodenameForStyle(rawCodename, cc.style, cc.alphabet)
                            const codenamePayload = ensureLocalizedContent(
                                codenameValue,
                                namePrimaryLocale ?? codenamePrimaryLocale,
                                codename || ''
                            )
                            const payload: Record<string, unknown> = {
                                codename: codenamePayload,
                                name: nameInput ?? {},
                                namePrimaryLocale,
                                validationRules: values.validationRules ?? {},
                                uiConfig: values.uiConfig ?? {},
                                isRequired: typeof values.isRequired === 'boolean' ? values.isRequired : false
                            }
                            if (sourceDataType === 'TABLE') {
                                payload.copyChildFieldDefinitions = Boolean(values.copyChildFieldDefinitions ?? true)
                            }
                            void ctx.api?.copyEntity?.(ctx.entity.id, payload)
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
        labelKey: 'fieldDefinitions.actions.moveUp',
        icon: <ArrowUpwardRoundedIcon />,
        order: 20,
        group: 'reorder',
        enabled: (ctx) => {
            const attributeMap = ctx.attributeMap as Map<string, FieldDefinition> | undefined
            if ((attributeMap?.size ?? 0) <= 1) return false
            const { min } = getSortBounds(attributeMap)
            const current = getCurrentSortOrder(ctx, attributeMap)
            if (min == null || current == null) return false
            return current > min
        },
        onSelect: async (ctx: ActionContext<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload>) => {
            try {
                const contextExtras = ctx as ActionContext<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload> & AttributeContextExtras
                if (typeof contextExtras.moveAttribute === 'function') {
                    await contextExtras.moveAttribute(ctx.entity.id, 'up')
                }
            } catch (error: unknown) {
                notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
            }
        }
    },
    {
        id: 'move-down',
        labelKey: 'fieldDefinitions.actions.moveDown',
        icon: <ArrowDownwardRoundedIcon />,
        order: 30,
        group: 'reorder',
        enabled: (ctx) => {
            const attributeMap = ctx.attributeMap as Map<string, FieldDefinition> | undefined
            if ((attributeMap?.size ?? 0) <= 1) return false
            const { max } = getSortBounds(attributeMap)
            const current = getCurrentSortOrder(ctx, attributeMap)
            if (max == null || current == null) return false
            return current < max
        },
        onSelect: async (ctx: ActionContext<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload>) => {
            try {
                const contextExtras = ctx as ActionContext<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload> & AttributeContextExtras
                if (typeof contextExtras.moveAttribute === 'function') {
                    await contextExtras.moveAttribute(ctx.entity.id, 'down')
                }
            } catch (error: unknown) {
                notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
            }
        }
    },
    {
        id: 'set-required',
        labelKey: 'fieldDefinitions.actions.setRequired',
        icon: <CheckCircleOutlineIcon />,
        order: 40,
        group: 'flags',
        visible: (ctx) => {
            const attributeMap = ctx.attributeMap as Map<string, FieldDefinition> | undefined
            const raw = attributeMap?.get(ctx.entity.id)
            const isRequired = raw?.isRequired ?? ctx.entity?.isRequired ?? false
            return !isRequired
        },
        onSelect: async (ctx: ActionContext<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload>) => {
            try {
                const contextExtras = ctx as ActionContext<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload> & AttributeContextExtras
                if (typeof contextExtras.toggleRequired === 'function') {
                    await contextExtras.toggleRequired(ctx.entity.id, true)
                }
            } catch (error: unknown) {
                notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
            }
        }
    },
    {
        id: 'set-optional',
        labelKey: 'fieldDefinitions.actions.setOptional',
        icon: <RadioButtonUncheckedIcon />,
        order: 41,
        group: 'flags',
        visible: (ctx) => {
            const attributeMap = ctx.attributeMap as Map<string, FieldDefinition> | undefined
            const raw = attributeMap?.get(ctx.entity.id)
            const isRequired = raw?.isRequired ?? ctx.entity?.isRequired ?? false
            const isDisplayAttribute = raw?.isDisplayAttribute ?? getEntityDisplayAttributeFlag(ctx.entity)
            return isRequired && !isDisplayAttribute
        },
        onSelect: async (ctx: ActionContext<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload>) => {
            try {
                const contextExtras = ctx as ActionContext<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload> & AttributeContextExtras
                if (typeof contextExtras.toggleRequired === 'function') {
                    await contextExtras.toggleRequired(ctx.entity.id, false)
                }
            } catch (error: unknown) {
                notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
            }
        }
    },
    {
        id: 'set-display-attribute',
        labelKey: 'fieldDefinitions.actions.setDisplayAttribute',
        icon: <StarOutlineIcon />,
        order: 50,
        group: 'flags',
        visible: (ctx) => {
            const attributeMap = ctx.attributeMap as Map<string, FieldDefinition> | undefined
            const raw = attributeMap?.get(ctx.entity.id)
            const isDisplayAttribute = raw?.isDisplayAttribute ?? getEntityDisplayAttributeFlag(ctx.entity)
            // Hide if already display attribute or if only one attribute (locked)
            return !isDisplayAttribute
        },
        onSelect: async (ctx: ActionContext<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload>) => {
            try {
                const contextExtras = ctx as ActionContext<FieldDefinitionDisplay, FieldDefinitionLocalizedPayload> & AttributeContextExtras
                if (typeof contextExtras.toggleDisplayAttribute === 'function') {
                    await contextExtras.toggleDisplayAttribute(ctx.entity.id, true)
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
        enabled: (ctx) => canDeleteAttributeEntity(ctx),
        dialog: {
            loader: async () => {
                const module = await import('@universo/template-mui/components/dialogs')
                return { default: module.ConfirmDeleteDialog }
            },
            buildProps: (ctx) => ({
                open: true,
                title: ctx.t('fieldDefinitions.deleteDialog.title', 'Delete Attribute'),
                description: ctx.t('fieldDefinitions.deleteDialog.message'),
                confirmButtonText: ctx.t('common:actions.delete'),
                cancelButtonText: ctx.t('common:actions.cancel'),
                onCancel: () => {
                    // BaseEntityMenu handles dialog closing
                },
                onConfirm: async () => {
                    try {
                        await ctx.api?.deleteEntity?.(ctx.entity.id)
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
