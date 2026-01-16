import { FormControl, InputLabel, Select, MenuItem, FormControlLabel, Switch, Divider } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import type { ActionDescriptor, ActionContext } from '@universo/template-mui'
import { LocalizedInlineField, useCodenameAutoFill, notifyError } from '@universo/template-mui'
import type { VersionedLocalizedContent } from '@universo/types'
import type { Attribute, AttributeDisplay, AttributeLocalizedPayload } from '../../../types'
import { getVLCString } from '../../../types'
import { sanitizeCodename, isValidCodename } from '../../../utils/codename'
import { extractLocalizedInput, ensureLocalizedContent, hasPrimaryContent, normalizeLocale } from '../../../utils/localizedInput'
import { CodenameField } from '../../../components'

const buildInitialValues = (ctx: ActionContext<AttributeDisplay, AttributeLocalizedPayload>) => {
    const attributeMap = ctx.attributeMap as Map<string, Attribute> | undefined
    const raw = attributeMap?.get(ctx.entity.id)
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)
    const nameFallback = ctx.entity?.name || ctx.entity?.codename || ''

    return {
        nameVlc: ensureLocalizedContent(raw?.name ?? ctx.entity?.name, uiLocale, nameFallback),
        codename: raw?.codename ?? ctx.entity?.codename ?? '',
        codenameTouched: true,
        dataType: raw?.dataType ?? ctx.entity?.dataType ?? 'STRING',
        isRequired: raw?.isRequired ?? ctx.entity?.isRequired ?? false
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

    return {
        codename,
        dataType,
        isRequired,
        name: nameInput ?? {},
        namePrimaryLocale
    }
}

const AttributeEditFields = ({
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
    t: ActionContext<AttributeDisplay, AttributeLocalizedPayload>['t']
    uiLocale?: string
}) => {
    const fieldErrors = errors ?? {}
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const codename = typeof values.codename === 'string' ? values.codename : ''
    const codenameTouched = Boolean(values.codenameTouched)
    const primaryLocale = nameVlc?._primary ?? normalizeLocale(uiLocale)
    const nameValue = getVLCString(nameVlc || undefined, primaryLocale)
    const nextCodename = sanitizeCodename(nameValue)

    useCodenameAutoFill({
        codename,
        codenameTouched,
        nextCodename,
        nameValue,
        setValue: setValue as (field: 'codename' | 'codenameTouched', value: string | boolean) => void
    })

    return (
        <>
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
            <FormControl fullWidth disabled={isLoading}>
                <InputLabel id='attribute-data-type-label'>{t('attributes.dataType', 'Data Type')}</InputLabel>
                <Select
                    labelId='attribute-data-type-label'
                    label={t('attributes.dataType', 'Data Type')}
                    value={values.dataType ?? 'STRING'}
                    onChange={(event) => setValue('dataType', event.target.value)}
                >
                    <MenuItem value='STRING'>{t('attributes.dataTypeOptions.string', 'String')}</MenuItem>
                </Select>
            </FormControl>
            <FormControlLabel
                control={<Switch checked={Boolean(values.isRequired)} onChange={(event) => setValue('isRequired', event.target.checked)} />}
                label={t('attributes.isRequiredLabel', 'Required')}
                disabled={isLoading}
            />
            <Divider />
            <CodenameField
                value={codename}
                onChange={(value) => setValue('codename', value)}
                touched={codenameTouched}
                onTouchedChange={(touched) => setValue('codenameTouched', touched)}
                label={t('attributes.codename', 'Codename')}
                helperText={t('attributes.codenameHelper', 'Unique identifier')}
                error={fieldErrors.codename}
                disabled={isLoading}
                required
            />
        </>
    )
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
                    extraFields: ({ values, setValue, isLoading, errors }: any) => (
                        <AttributeEditFields
                            values={values}
                            setValue={setValue}
                            isLoading={isLoading}
                            errors={errors}
                            t={ctx.t}
                            uiLocale={ctx.uiLocale as string}
                        />
                    ),
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
