import { useCallback, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Divider, Stack, Switch, FormControlLabel, Tooltip, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import StarOutlineRoundedIcon from '@mui/icons-material/StarOutlineRounded'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import StarIcon from '@mui/icons-material/Star'
import { useQuery } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import {
    TemplateMainCard as MainCard,
    ToolbarControls,
    EmptyListState,
    APIEmptySVG,
    FlowListTable,
    ViewHeaderMUI as ViewHeader,
    LocalizedInlineField,
    useCodenameAutoFill,
    BaseEntityMenu
} from '@universo/template-mui'
import { ConfirmDeleteDialog, EntityFormDialog } from '@universo/template-mui/components/dialogs'
import type { VersionedLocalizedContent } from '@universo/types'
import type { ActionDescriptor } from '@universo/template-mui'
import type { EnumerationValue, EnumerationValueDisplay } from '../../../types'
import { getVLCString, toEnumerationValueDisplay } from '../../../types'
import { normalizeLocale, extractLocalizedInput, hasPrimaryContent, ensureLocalizedContent } from '../../../utils/localizedInput'
import { sanitizeCodename, isValidCodename } from '../../../utils/codename'
import { CodenameField } from '../../../components'
import { getEnumerationValueBlockingReferences, listEnumerationValues } from '../api'
import {
    useCopyEnumerationValue,
    useCreateEnumerationValue,
    useDeleteEnumerationValue,
    useMoveEnumerationValue,
    useUpdateEnumerationValue
} from '../hooks'
import { metahubsQueryKeys } from '../../shared'

type ValueFormValues = {
    nameVlc: VersionedLocalizedContent<string> | null
    descriptionVlc: VersionedLocalizedContent<string> | null
    codename: string
    codenameTouched?: boolean
    isDefault?: boolean
}

type CopyValueFormValues = {
    nameVlc: VersionedLocalizedContent<string> | null
    descriptionVlc: VersionedLocalizedContent<string> | null
    codename: string
    codenameTouched?: boolean
    isDefault?: boolean
}

const appendCopySuffix = (
    value: VersionedLocalizedContent<string> | null | undefined,
    uiLocale: string,
    fallback: string
): VersionedLocalizedContent<string> => {
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

const ValueFormFields = ({
    values,
    setValue,
    isLoading,
    errors,
    uiLocale,
    translate,
    showDefaultToggle = true
}: {
    values: Record<string, any>
    setValue: (name: string, value: any) => void
    isLoading: boolean
    errors: Record<string, string>
    uiLocale: string
    translate: (key: string, defaultValue?: string) => string
    showDefaultToggle?: boolean
}) => {
    const nameVlc = (values.nameVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const descriptionVlc = (values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
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
        <Stack spacing={2}>
            <LocalizedInlineField
                mode='localized'
                label={translate('common:fields.name', 'Name')}
                required
                disabled={isLoading}
                value={nameVlc}
                onChange={(next) => setValue('nameVlc', next)}
                error={errors.nameVlc || null}
                helperText={errors.nameVlc}
                uiLocale={uiLocale}
            />

            <LocalizedInlineField
                mode='localized'
                label={translate('common:fields.description', 'Description')}
                disabled={isLoading}
                value={descriptionVlc}
                onChange={(next) => setValue('descriptionVlc', next)}
                uiLocale={uiLocale}
                multiline
                rows={2}
            />

            <Divider />

            {showDefaultToggle ? (
                <>
                    <FormControlLabel
                        control={<Switch checked={Boolean(values.isDefault)} onChange={(_, checked) => setValue('isDefault', checked)} />}
                        label={translate('enumerationValues.isDefault', 'Default value')}
                        disabled={isLoading}
                    />

                    <Divider />
                </>
            ) : null}

            <CodenameField
                value={codename}
                onChange={(value) => setValue('codename', value)}
                touched={codenameTouched}
                onTouchedChange={(touched) => setValue('codenameTouched', touched)}
                label={translate('enumerationValues.codename', 'Codename')}
                helperText={translate('enumerationValues.codenameHelper', 'Unique identifier')}
                error={errors.codename}
                disabled={isLoading}
                required
            />
        </Stack>
    )
}

const EnumerationValueList = () => {
    const { metahubId, enumerationId } = useParams<{ metahubId: string; enumerationId: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()
    const { enqueueSnackbar } = useSnackbar()

    const [search, setSearch] = useState('')
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [editingValue, setEditingValue] = useState<EnumerationValue | null>(null)
    const [dialogError, setDialogError] = useState<string | null>(null)
    const [deleteState, setDeleteState] = useState<{ open: boolean; value: EnumerationValue | null }>({ open: false, value: null })

    const createMutation = useCreateEnumerationValue()
    const updateMutation = useUpdateEnumerationValue()
    const deleteMutation = useDeleteEnumerationValue()
    const moveMutation = useMoveEnumerationValue()
    const copyMutation = useCopyEnumerationValue()

    const {
        data: valuesResponse,
        isLoading,
        error
    } = useQuery({
        queryKey: metahubId && enumerationId ? metahubsQueryKeys.enumerationValuesList(metahubId, enumerationId) : ['empty'],
        queryFn: () => listEnumerationValues(metahubId!, enumerationId!),
        enabled: Boolean(metahubId && enumerationId)
    })

    const values = useMemo(() => valuesResponse?.items ?? [], [valuesResponse?.items])

    const [copyState, setCopyState] = useState<{ open: boolean; value: EnumerationValue | null }>({ open: false, value: null })
    const [copyDialogError, setCopyDialogError] = useState<string | null>(null)

    const { data: blockingInfo } = useQuery({
        queryKey:
            metahubId && enumerationId && editingValue?.id
                ? ['metahubs', 'enumerationValueBlockingRefs', metahubId, enumerationId, editingValue.id]
                : ['metahubs', 'enumerationValueBlockingRefs', 'empty'],
        queryFn: () => getEnumerationValueBlockingReferences(metahubId!, enumerationId!, editingValue!.id),
        enabled: Boolean(metahubId && enumerationId && editingValue?.id)
    })

    const filteredValues = useMemo(() => {
        const searchValue = search.trim().toLowerCase()
        if (!searchValue) return values
        return values.filter((value) => {
            const displayName = getVLCString(value.name, i18n.language) || getVLCString(value.name, 'en') || value.codename
            return displayName.toLowerCase().includes(searchValue) || value.codename.toLowerCase().includes(searchValue)
        })
    }, [values, search, i18n.language])

    const tableData = useMemo<EnumerationValueDisplay[]>(
        () =>
            filteredValues
                .map((value) => toEnumerationValueDisplay(value, i18n.language))
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
        [filteredValues, i18n.language]
    )

    const valueMap = useMemo(() => new Map(values.map((value) => [value.id, value])), [values])
    const valueOrderMap = useMemo(() => {
        const sortedIds = values
            .slice()
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id))
            .map((item) => item.id)
        return new Map(sortedIds.map((id, index) => [id, index]))
    }, [values])
    const createValueActionContext = useCallback(
        (base: Record<string, unknown>) => ({
            ...base,
            valueMap,
            valueOrderMap,
            valueCount: values.length,
            openEditDialog: (value: EnumerationValue) => {
                setEditingValue(value)
                setDialogError(null)
                setDialogOpen(true)
            },
            openDeleteDialog: (value: EnumerationValue) => {
                setDeleteState({ open: true, value })
            },
            setDefaultValue: async (value: EnumerationValue) => {
                if (!metahubId || !enumerationId) return
                if (value.isDefault) return
                await updateMutation.mutateAsync({
                    metahubId,
                    enumerationId,
                    valueId: value.id,
                    data: {
                        isDefault: true,
                        expectedVersion: value.version
                    }
                })
            },
            clearDefaultValue: async (value: EnumerationValue) => {
                if (!metahubId || !enumerationId) return
                if (!value.isDefault) return
                await updateMutation.mutateAsync({
                    metahubId,
                    enumerationId,
                    valueId: value.id,
                    data: {
                        isDefault: false,
                        expectedVersion: value.version
                    }
                })
            },
            moveValue: async (value: EnumerationValue, direction: 'up' | 'down') => {
                if (!metahubId || !enumerationId) return
                await moveMutation.mutateAsync({
                    metahubId,
                    enumerationId,
                    valueId: value.id,
                    direction
                })
            }
        }),
        [valueMap, valueOrderMap, values.length, metahubId, enumerationId, updateMutation, moveMutation]
    )

    const valueActions = useMemo<readonly ActionDescriptor<EnumerationValueDisplay, never>[]>(
        () => [
            {
                id: 'edit',
                labelKey: 'common:actions.edit',
                order: 10,
                icon: <EditRoundedIcon fontSize='small' />,
                onSelect: (ctx) => {
                    const source = (ctx.valueMap as Map<string, EnumerationValue> | undefined)?.get(ctx.entity.id)
                    if (source) {
                        ;(ctx.openEditDialog as ((value: EnumerationValue) => void) | undefined)?.(source)
                    }
                }
            },
            {
                id: 'copy',
                labelKey: 'common:actions.copy',
                order: 11,
                icon: <ContentCopyRoundedIcon fontSize='small' />,
                onSelect: (ctx) => {
                    const source = (ctx.valueMap as Map<string, EnumerationValue> | undefined)?.get(ctx.entity.id)
                    if (source) {
                        setCopyDialogError(null)
                        setCopyState({ open: true, value: source })
                    }
                }
            },
            {
                id: 'set-default',
                labelKey: 'enumerationValues.actions.setDefault',
                order: 20,
                icon: <StarRoundedIcon fontSize='small' />,
                visible: (ctx) => {
                    const source = (ctx.valueMap as Map<string, EnumerationValue> | undefined)?.get(ctx.entity.id)
                    return !source?.isDefault
                },
                onSelect: async (ctx) => {
                    const source = (ctx.valueMap as Map<string, EnumerationValue> | undefined)?.get(ctx.entity.id)
                    if (source) {
                        await (ctx.setDefaultValue as ((value: EnumerationValue) => Promise<void>) | undefined)?.(source)
                    }
                }
            },
            {
                id: 'clear-default',
                labelKey: 'enumerationValues.actions.clearDefault',
                order: 21,
                icon: <StarOutlineRoundedIcon fontSize='small' />,
                visible: (ctx) => {
                    const source = (ctx.valueMap as Map<string, EnumerationValue> | undefined)?.get(ctx.entity.id)
                    return Boolean(source?.isDefault)
                },
                onSelect: async (ctx) => {
                    const source = (ctx.valueMap as Map<string, EnumerationValue> | undefined)?.get(ctx.entity.id)
                    if (source) {
                        await (ctx.clearDefaultValue as ((value: EnumerationValue) => Promise<void>) | undefined)?.(source)
                    }
                }
            },
            {
                id: 'move-up',
                labelKey: 'attributes.actions.moveUp',
                order: 30,
                dividerBefore: true,
                icon: <ArrowUpwardRoundedIcon fontSize='small' />,
                enabled: (ctx) => {
                    const orderMap = ctx.valueOrderMap as Map<string, number> | undefined
                    if (!orderMap || orderMap.size <= 1) return false
                    const index = orderMap.get(ctx.entity.id)
                    return typeof index === 'number' && index > 0
                },
                onSelect: async (ctx) => {
                    const source = (ctx.valueMap as Map<string, EnumerationValue> | undefined)?.get(ctx.entity.id)
                    if (source) {
                        await (ctx.moveValue as ((value: EnumerationValue, direction: 'up' | 'down') => Promise<void>) | undefined)?.(
                            source,
                            'up'
                        )
                    }
                }
            },
            {
                id: 'move-down',
                labelKey: 'attributes.actions.moveDown',
                order: 40,
                icon: <ArrowDownwardRoundedIcon fontSize='small' />,
                enabled: (ctx) => {
                    const orderMap = ctx.valueOrderMap as Map<string, number> | undefined
                    if (!orderMap || orderMap.size <= 1) return false
                    const index = orderMap.get(ctx.entity.id)
                    if (typeof index !== 'number') return false
                    return index < orderMap.size - 1
                },
                onSelect: async (ctx) => {
                    const source = (ctx.valueMap as Map<string, EnumerationValue> | undefined)?.get(ctx.entity.id)
                    if (source) {
                        await (ctx.moveValue as ((value: EnumerationValue, direction: 'up' | 'down') => Promise<void>) | undefined)?.(
                            source,
                            'down'
                        )
                    }
                }
            },
            {
                id: 'delete',
                labelKey: 'common:actions.delete',
                order: 100,
                dividerBefore: true,
                icon: <DeleteRoundedIcon fontSize='small' />,
                tone: 'danger',
                onSelect: (ctx) => {
                    const source = (ctx.valueMap as Map<string, EnumerationValue> | undefined)?.get(ctx.entity.id)
                    if (source) {
                        ;(ctx.openDeleteDialog as ((value: EnumerationValue) => void) | undefined)?.(source)
                    }
                }
            }
        ],
        []
    )

    const images = useMemo(() => {
        const imageMap: Record<string, any[]> = {}
        values.forEach((value) => {
            imageMap[value.id] = []
        })
        return imageMap
    }, [values])

    const formDefaults = useMemo<ValueFormValues>(
        () => ({
            nameVlc: null,
            descriptionVlc: null,
            codename: '',
            codenameTouched: false,
            isDefault: false
        }),
        []
    )

    const initialFormValues = useMemo<ValueFormValues>(() => {
        if (!editingValue) return formDefaults
        return {
            nameVlc: editingValue.name ?? null,
            descriptionVlc: editingValue.description ?? null,
            codename: editingValue.codename,
            codenameTouched: true,
            isDefault: editingValue.isDefault ?? false
        }
    }, [editingValue, formDefaults])

    const copyInitialValues = useMemo<CopyValueFormValues>(() => {
        if (!copyState.value) {
            return {
                nameVlc: null,
                descriptionVlc: null,
                codename: '',
                codenameTouched: false,
                isDefault: false
            }
        }
        const source = copyState.value
        const sourceName = source.codename || 'value'
        return {
            nameVlc: appendCopySuffix(source.name ?? null, i18n.language, sourceName),
            descriptionVlc: source.description ?? null,
            codename: sanitizeCodename(`${source.codename}-copy`),
            codenameTouched: true,
            isDefault: false
        }
    }, [copyState.value, i18n.language])

    const validateForm = (valuesToValidate: Record<string, any>) => {
        const errors: Record<string, string> = {}
        const nameVlc = valuesToValidate.nameVlc as VersionedLocalizedContent<string> | null | undefined
        if (!hasPrimaryContent(nameVlc)) {
            errors.nameVlc = tc('crud.nameRequired', 'Name is required')
        }
        const rawCodename = typeof valuesToValidate.codename === 'string' ? valuesToValidate.codename : ''
        const normalizedCodename = sanitizeCodename(rawCodename)
        if (!normalizedCodename) {
            errors.codename = t('enumerationValues.validation.codenameRequired', 'Codename is required')
        } else if (!isValidCodename(normalizedCodename)) {
            errors.codename = t('enumerationValues.validation.codenameInvalid', 'Codename contains invalid characters')
        }
        return Object.keys(errors).length > 0 ? errors : null
    }

    const canSaveForm = (valuesToValidate: Record<string, any>) => {
        const nameVlc = valuesToValidate.nameVlc as VersionedLocalizedContent<string> | null | undefined
        const rawCodename = typeof valuesToValidate.codename === 'string' ? valuesToValidate.codename : ''
        const normalizedCodename = sanitizeCodename(rawCodename)
        return hasPrimaryContent(nameVlc) && Boolean(normalizedCodename) && isValidCodename(normalizedCodename)
    }

    const handleSave = async (formValues: Record<string, any>) => {
        if (!metahubId || !enumerationId) return
        setDialogError(null)

        const nameVlc = formValues.nameVlc as VersionedLocalizedContent<string> | null | undefined
        const descriptionVlc = formValues.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
        const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
        const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)
        const codename = sanitizeCodename(String(formValues.codename || ''))
        const isDefault = Boolean(formValues.isDefault)

        if (!nameInput || !namePrimaryLocale) {
            setDialogError(tc('crud.nameRequired', 'Name is required'))
            return
        }
        if (!codename) {
            setDialogError(t('enumerationValues.validation.codenameRequired', 'Codename is required'))
            return
        }

        try {
            if (editingValue) {
                await updateMutation.mutateAsync({
                    metahubId,
                    enumerationId,
                    valueId: editingValue.id,
                    data: {
                        codename,
                        name: nameInput,
                        description: descriptionInput,
                        namePrimaryLocale,
                        descriptionPrimaryLocale,
                        isDefault,
                        expectedVersion: editingValue.version
                    }
                })
            } else {
                await createMutation.mutateAsync({
                    metahubId,
                    enumerationId,
                    data: {
                        codename,
                        name: nameInput,
                        description: descriptionInput,
                        namePrimaryLocale,
                        descriptionPrimaryLocale,
                        isDefault
                    }
                })
            }

            setDialogOpen(false)
            setEditingValue(null)
            setDialogError(null)
        } catch (e: unknown) {
            const responseMessage =
                e && typeof e === 'object' && 'response' in e
                    ? (e as any)?.response?.data?.error ?? (e as any)?.response?.data?.message
                    : undefined
            const message =
                typeof responseMessage === 'string'
                    ? responseMessage
                    : e instanceof Error
                    ? e.message
                    : typeof e === 'string'
                    ? e
                    : editingValue
                    ? t('enumerationValues.updateError', 'Failed to update enumeration value')
                    : t('enumerationValues.createError', 'Failed to create enumeration value')
            setDialogError(message)
        }
    }

    if (!metahubId || !enumerationId) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Invalid enumeration'
                title={t('metahubs:errors.invalidMetahub')}
                description={t('metahubs:errors.pleaseSelectMetahub')}
            />
        )
    }

    const isBusy = isLoading
    return (
        <MainCard
            sx={{ maxWidth: '100%', width: '100%' }}
            contentSX={{ px: 0, py: 0 }}
            disableContentPadding
            disableHeader
            border={false}
            shadow={false}
        >
            {error ? (
                <EmptyListState
                    image={APIEmptySVG}
                    imageAlt='Connection error'
                    title={t('errors.connectionFailed')}
                    description={t('errors.pleaseTryLater')}
                />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 1 }}>
                    <ViewHeader
                        search={true}
                        searchPlaceholder={t('enumerationValues.searchPlaceholder', 'Search enumeration values...')}
                        onSearchChange={setSearch}
                        title={t('enumerationValues.title', 'Values')}
                    >
                        <ToolbarControls
                            primaryAction={{
                                label: tc('create'),
                                onClick: () => {
                                    setEditingValue(null)
                                    setDialogError(null)
                                    setDialogOpen(true)
                                },
                                startIcon: <AddRoundedIcon />
                            }}
                        />
                    </ViewHeader>

                    {!isBusy && tableData.length === 0 ? (
                        <EmptyListState
                            image={APIEmptySVG}
                            imageAlt='No enumeration values'
                            title={t('enumerationValues.empty', 'No values yet')}
                            description={t(
                                'enumerationValues.emptyDescription',
                                'Add values to define available options in this enumeration'
                            )}
                        />
                    ) : (
                        <Box sx={{ mx: { xs: -1.5, md: -2 } }}>
                            <FlowListTable
                                data={tableData}
                                images={images}
                                isLoading={isBusy}
                                customColumns={[
                                    {
                                        id: 'sortOrder',
                                        label: t('attributes.table.order', '#'),
                                        width: '4%',
                                        align: 'center',
                                        sortable: true,
                                        sortAccessor: (row: EnumerationValueDisplay) => row.sortOrder ?? 0,
                                        render: (row: EnumerationValueDisplay) => (
                                            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{row.sortOrder ?? 0}</Typography>
                                        )
                                    },
                                    {
                                        id: 'name',
                                        label: tc('table.name', 'Name'),
                                        width: '30%',
                                        align: 'left',
                                        render: (row: EnumerationValueDisplay) => (
                                            <Stack direction='row' spacing={0.5} alignItems='center'>
                                                {row.isDefault && (
                                                    <Tooltip
                                                        title={t('enumerationValues.defaultTooltip', 'This value is used by default.')}
                                                        arrow
                                                    >
                                                        <StarIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                                    </Tooltip>
                                                )}
                                                <Typography sx={{ fontSize: 14, fontWeight: 500, wordBreak: 'break-word' }}>
                                                    {row.name || '—'}
                                                </Typography>
                                            </Stack>
                                        )
                                    },
                                    {
                                        id: 'description',
                                        label: tc('table.description', 'Description'),
                                        width: '30%',
                                        align: 'left',
                                        render: (row: EnumerationValueDisplay) => (
                                            <Typography sx={{ fontSize: 14, wordBreak: 'break-word' }}>{row.description || '—'}</Typography>
                                        )
                                    },
                                    {
                                        id: 'codename',
                                        label: t('enumerationValues.codename', 'Codename'),
                                        width: '20%',
                                        align: 'left',
                                        render: (row: EnumerationValueDisplay) => (
                                            <Typography sx={{ fontSize: 14, fontWeight: 600, fontFamily: 'monospace' }}>
                                                {row.codename}
                                            </Typography>
                                        )
                                    }
                                ]}
                                i18nNamespace='flowList'
                                renderActions={(row: EnumerationValueDisplay) => (
                                    <BaseEntityMenu<EnumerationValueDisplay, never>
                                        entity={row}
                                        entityKind='enumerationValue'
                                        descriptors={valueActions}
                                        namespace='metahubs'
                                        menuButtonLabelKey='flowList:menu.button'
                                        i18nInstance={i18n}
                                        createContext={createValueActionContext}
                                    />
                                )}
                            />
                        </Box>
                    )}
                </Stack>
            )}

            <EntityFormDialog
                key={`enum-value-edit-${editingValue?.id ?? 'none'}-${editingValue?.version ?? 0}`}
                open={isDialogOpen}
                mode='edit'
                title={
                    editingValue
                        ? t('enumerationValues.editDialog.title', 'Edit enumeration value')
                        : t('enumerationValues.createDialog.title', 'Create value')
                }
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={editingValue ? tc('actions.save', 'Save') : tc('actions.create', 'Create')}
                savingButtonText={editingValue ? tc('actions.saving', 'Saving...') : tc('actions.creating', 'Creating...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={createMutation.isPending || updateMutation.isPending}
                error={dialogError || undefined}
                onClose={() => {
                    setDialogOpen(false)
                    setEditingValue(null)
                    setDialogError(null)
                }}
                onSave={handleSave}
                hideDefaultFields
                initialExtraValues={initialFormValues}
                extraFields={({ values, setValue, isLoading, errors }) => (
                    <ValueFormFields
                        values={values}
                        setValue={setValue}
                        isLoading={isLoading}
                        errors={errors ?? {}}
                        uiLocale={i18n.language}
                        translate={(key, defaultValue) => t(key, defaultValue)}
                    />
                )}
                validate={validateForm}
                canSave={canSaveForm}
                showDeleteButton={Boolean(editingValue)}
                deleteButtonText={tc('actions.delete', 'Delete')}
                deleteButtonDisabled={Boolean(editingValue && blockingInfo && !blockingInfo.canDelete)}
                deleteButtonDisabledReason={
                    editingValue && blockingInfo && !blockingInfo.canDelete
                        ? t(
                              'enumerationValues.deleteBlockedReason',
                              'Deletion is blocked because this value is used in defaults or predefined elements.'
                          )
                        : undefined
                }
                onDelete={() => {
                    if (editingValue) {
                        setDeleteState({ open: true, value: editingValue })
                        setDialogOpen(false)
                    }
                }}
            />

            <EntityFormDialog
                key={`enum-value-copy-${copyState.value?.id ?? 'none'}-${copyState.value?.version ?? 0}`}
                open={copyState.open}
                mode='copy'
                title={t('enumerationValues.copyTitle', 'Copy Value')}
                saveButtonText={t('enumerationValues.copy.action', 'Copy')}
                savingButtonText={t('enumerationValues.copy.actionLoading', 'Copying...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={copyMutation.isPending}
                error={copyDialogError || undefined}
                onClose={() => {
                    setCopyState({ open: false, value: null })
                    setCopyDialogError(null)
                }}
                onSave={async (formValues: Record<string, any>) => {
                    if (!metahubId || !enumerationId || !copyState.value) return
                    setCopyDialogError(null)

                    const nameVlc = formValues.nameVlc as VersionedLocalizedContent<string> | null | undefined
                    const descriptionVlc = formValues.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
                    const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
                    const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)
                    const codename = sanitizeCodename(String(formValues.codename || ''))
                    const isDefault = Boolean(formValues.isDefault)

                    if (!nameInput || !namePrimaryLocale) {
                        setCopyDialogError(tc('crud.nameRequired', 'Name is required'))
                        return
                    }
                    if (!codename) {
                        setCopyDialogError(t('enumerationValues.validation.codenameRequired', 'Codename is required'))
                        return
                    }

                    try {
                        await copyMutation.mutateAsync({
                            metahubId,
                            enumerationId,
                            valueId: copyState.value.id,
                            data: {
                                codename,
                                name: nameInput,
                                description: descriptionInput,
                                namePrimaryLocale,
                                descriptionPrimaryLocale,
                                isDefault
                            }
                        })
                        setCopyState({ open: false, value: null })
                    } catch (e: unknown) {
                        const responseMessage =
                            e && typeof e === 'object' && 'response' in e
                                ? (e as any)?.response?.data?.error ?? (e as any)?.response?.data?.message
                                : undefined
                        setCopyDialogError(
                            typeof responseMessage === 'string'
                                ? responseMessage
                                : e instanceof Error
                                ? e.message
                                : t('enumerationValues.copyError', 'Failed to copy enumeration value')
                        )
                    }
                }}
                hideDefaultFields
                initialExtraValues={copyInitialValues}
                extraFields={({ values, setValue, isLoading, errors }) => (
                    <ValueFormFields
                        values={values}
                        setValue={setValue}
                        isLoading={isLoading}
                        errors={errors ?? {}}
                        uiLocale={i18n.language}
                        translate={(key, defaultValue) => t(key, defaultValue)}
                    />
                )}
                validate={validateForm}
                canSave={canSaveForm}
            />

            <ConfirmDeleteDialog
                open={deleteState.open}
                title={t('enumerationValues.deleteDialog.title', 'Delete enumeration value')}
                description={t(
                    'enumerationValues.deleteDialog.message',
                    'Are you sure you want to delete this enumeration value? This action cannot be undone.'
                )}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setDeleteState({ open: false, value: null })}
                onConfirm={async () => {
                    if (!deleteState.value || !metahubId || !enumerationId) return
                    try {
                        await deleteMutation.mutateAsync({
                            metahubId,
                            enumerationId,
                            valueId: deleteState.value.id
                        })
                        setDeleteState({ open: false, value: null })
                    } catch (e: unknown) {
                        const responseMessage =
                            e && typeof e === 'object' && 'response' in e
                                ? (e as any)?.response?.data?.error ?? (e as any)?.response?.data?.message
                                : undefined
                        const message =
                            typeof responseMessage === 'string'
                                ? responseMessage
                                : e instanceof Error
                                ? e.message
                                : typeof e === 'string'
                                ? e
                                : t('enumerationValues.deleteError', 'Failed to delete enumeration value')
                        enqueueSnackbar(message, { variant: 'error' })
                    }
                }}
                deleting={deleteMutation.isPending}
            />
        </MainCard>
    )
}

export default EnumerationValueList
