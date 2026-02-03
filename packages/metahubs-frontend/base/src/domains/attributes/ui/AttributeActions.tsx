import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import StarIcon from '@mui/icons-material/Star'
import StarOutlineIcon from '@mui/icons-material/StarOutline'
import type { ActionDescriptor, ActionContext } from '@universo/template-mui'
import { notifyError } from '@universo/template-mui'
import type { VersionedLocalizedContent, MetaEntityKind } from '@universo/types'
import type { Attribute, AttributeDisplay, AttributeLocalizedPayload, AttributeValidationRules } from '../../../types'
import { sanitizeCodename, isValidCodename } from '../../../utils/codename'
import { extractLocalizedInput, ensureLocalizedContent, hasPrimaryContent, normalizeLocale } from '../../../utils/localizedInput'
import AttributeFormFields from './AttributeFormFields'

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
        isRequired: raw?.isRequired ?? ctx.entity?.isRequired ?? false,
        isDisplayAttribute: isSingleAttribute ? true : (raw?.isDisplayAttribute ?? (ctx.entity as any)?.isDisplayAttribute ?? false),
        validationRules: raw?.validationRules ?? ctx.entity?.validationRules ?? {},
        targetEntityId: raw?.targetEntityId ?? ctx.entity?.targetEntityId ?? null,
        targetEntityKind: raw?.targetEntityKind ?? ctx.entity?.targetEntityKind ?? null
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
    return Object.keys(errors).length > 0 ? errors : null
}

const canSaveAttributeForm = (values: Record<string, any>) => {
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const rawCodename = typeof values.codename === 'string' ? values.codename : ''
    const normalizedCodename = sanitizeCodename(rawCodename)
    return hasPrimaryContent(nameVlc) && Boolean(normalizedCodename) && isValidCodename(normalizedCodename)
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

    return {
        codename,
        dataType,
        isRequired,
        isDisplayAttribute,
        name: nameInput ?? {},
        namePrimaryLocale,
        validationRules,
        targetEntityId,
        targetEntityKind
    }
}

const resolveSortOrder = (attribute?: { sortOrder?: number }) => {
    if (!attribute) return null
    const value = attribute.sortOrder
    return typeof value === 'number' && Number.isFinite(value) ? value : null
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
                    extraFields: ({ values, setValue, isLoading, errors }: any) => {
                        const attributeMap = ctx.attributeMap as Map<string, Attribute> | undefined
                        const displayAttributeLocked = (attributeMap?.size ?? 0) <= 1
                        return (
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
                                displayAttributeHelper={ctx.t('attributes.isDisplayAttributeHelper', 'Use as representation when referencing elements of this catalog')}
                                displayAttributeLocked={displayAttributeLocked}
                                dataTypeOptions={[
                                    { value: 'STRING', label: ctx.t('attributes.dataTypeOptions.string', 'String') },
                                    { value: 'NUMBER', label: ctx.t('attributes.dataTypeOptions.number', 'Number') },
                                    { value: 'BOOLEAN', label: ctx.t('attributes.dataTypeOptions.boolean', 'Boolean') },
                                    { value: 'DATE', label: ctx.t('attributes.dataTypeOptions.date', 'Date') },
                                    { value: 'REF', label: ctx.t('attributes.dataTypeOptions.ref', 'Reference') },
                                    { value: 'JSON', label: ctx.t('attributes.dataTypeOptions.json', 'JSON') }
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
                                    { value: 'date', label: ctx.t('attributes.typeSettings.date.compositionOptions.date', 'Date only') },
                                    { value: 'time', label: ctx.t('attributes.typeSettings.date.compositionOptions.time', 'Time only') },
                                    { value: 'datetime', label: ctx.t('attributes.typeSettings.date.compositionOptions.datetime', 'Date and Time') }
                                ]}
                                physicalTypeLabel={ctx.t('attributes.physicalType.label', 'PostgreSQL type')}
                                metahubId={(ctx as any).metahubId as string}
                                currentCatalogId={(ctx as any).catalogId as string | undefined}
                                dataTypeDisabled
                                dataTypeHelperText={ctx.t('attributes.edit.typeChangeDisabled', 'Data type cannot be changed after creation')}
                                disableVlcToggles
                            />
                        )
                    },
                    validate: (values: Record<string, any>) => validateAttributeForm(ctx, values),
                    canSave: canSaveAttributeForm,
                    showDeleteButton: true,
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
            return isRequired
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
        order: 100,
        group: 'danger',
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
