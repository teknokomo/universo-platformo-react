import { Checkbox, FormControlLabel, Stack, Typography } from '@mui/material'
import { useQueries, useQuery } from '@tanstack/react-query'
import type { ActionDescriptor, ActionContext } from '@universo/template-mui'
import { createCopyActionIcon, createDeleteActionIcon, createEditActionIcon, notifyError } from '@universo/template-mui'
import type { TabConfig } from '@universo/template-mui/components/dialogs'
import {
    normalizeCatalogRecordBehavior,
    normalizeCatalogRecordBehaviorFromConfig,
    normalizeLedgerConfig,
    normalizeLedgerConfigFromConfig,
    supportsLedgerSchema,
    validateLedgerConfigReferences,
    type CatalogRecordBehavior,
    type ComponentManifest,
    type LedgerConfig,
    type VersionedLocalizedContent
} from '@universo/types'
import { normalizeLinkedCollectionCopyOptions } from '@universo/utils'
import type { LinkedCollectionEntity, LinkedCollectionDisplay, LinkedCollectionLocalizedPayload, TreeEntity } from '../../../../types'
import { getVLCString } from '../../../../types'
import { LinkedCollectionWithContainers } from '../api/linkedCollections'
import { normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../../utils/codename'
import type { CodenameConfig } from '../../../settings/hooks/useCodenameConfig'
import {
    extractLocalizedInput,
    ensureLocalizedContent,
    ensureEntityCodenameContent,
    hasPrimaryContent,
    normalizeLocale
} from '../../../../utils/localizedInput'
import { ContainerSelectionPanel } from '../../../../components'
import LayoutList from '../../../layouts/ui/LayoutList'
import { createScriptsTab } from '../../../scripts/ui/EntityScriptsTab'
import { scriptsApi } from '../../../scripts/api/scriptsApi'
import GeneralTabFields from '../../../shared/ui/GeneralTabFields'
import { buildLinkedCollectionAuthoringPath } from './linkedCollectionRoutePaths'
import * as entitiesApi from '../../api'
import * as fieldDefinitionsApi from '../../metadata/fieldDefinition/api'
import RecordBehaviorFields from '../../ui/RecordBehaviorFields'
import type { RecordBehaviorOption } from '../../ui/RecordBehaviorFields'
import LedgerSchemaFields from '../../ui/LedgerSchemaFields'

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

/**
 * Extended LinkedCollectionDisplay type that includes treeEntityId for AllLinkedCollectionsList context
 */
export interface LinkedCollectionDisplayWithContainer extends LinkedCollectionDisplay {
    treeEntityId?: string
}

export type LinkedCollectionFormValues = Record<string, unknown>
const ensureFormValues = (values?: LinkedCollectionFormValues | null): LinkedCollectionFormValues => values ?? {}
export type LinkedCollectionFormSetValue = (name: string, value: unknown) => void
export type LinkedCollectionActionContext = ActionContext<LinkedCollectionDisplayWithContainer, LinkedCollectionLocalizedPayload> & {
    treeEntities?: TreeEntity[]
    currentTreeEntityId?: string | null
    metahubId?: string | null
    routeKindKey?: string | null
    recordBehaviorEnabled?: boolean
    recordBehaviorComponents?: ComponentManifest | null
    recordBehaviorDefaultConfig?: Record<string, unknown> | null
    ledgerSchemaEnabled?: boolean
    ledgerSchemaComponents?: ComponentManifest | null
    ledgerSchemaDefaultConfig?: Record<string, unknown> | null
    ledgerCandidateKindKeys?: string[]
    ledgerEntityKindOptions?: RecordBehaviorOption[]
}
export type LinkedCollectionDialogTabArgs = {
    values: LinkedCollectionFormValues
    setValue: LinkedCollectionFormSetValue
    isLoading: boolean
    errors?: Record<string, string>
}

const resolveLinkedCollectionAttachmentKind = (ctx: Pick<LinkedCollectionActionContext, 'routeKindKey' | 'entityKind'>): string => {
    const routeKindKey = typeof ctx.routeKindKey === 'string' ? ctx.routeKindKey.trim() : ''
    if (routeKindKey.length > 0) {
        return routeKindKey
    }

    const entityKind = typeof ctx.entityKind === 'string' ? ctx.entityKind.trim() : ''
    return entityKind.length > 0 ? entityKind : 'catalog'
}

const getRecordBehaviorFormValue = (value: unknown): CatalogRecordBehavior => normalizeCatalogRecordBehavior(value)
const getLedgerConfigFormValue = (value: unknown): LedgerConfig => normalizeLedgerConfig(value)
const hasLedgerConfig = (config: unknown): boolean =>
    Boolean(config && typeof config === 'object' && !Array.isArray(config) && 'ledger' in config)

const toRecordBehaviorOption = (entity: { id: string; codename?: unknown; name?: unknown }, uiLocale: string): RecordBehaviorOption => {
    const codename = getVLCString(entity.codename as VersionedLocalizedContent<string> | string | undefined, uiLocale) || entity.id
    const label = getVLCString(entity.name as VersionedLocalizedContent<string> | string | undefined, uiLocale) || codename
    return { codename, label }
}

const fieldDefinitionToRecordBehaviorOption = (
    field: { id: string; codename?: unknown; name?: unknown },
    uiLocale: string
): RecordBehaviorOption => {
    const codename = getVLCString(field.codename as VersionedLocalizedContent<string> | string | undefined, uiLocale) || field.id
    const label = getVLCString(field.name as VersionedLocalizedContent<string> | string | undefined, uiLocale) || codename
    return { codename, label }
}

const scriptToRecordBehaviorOption = (
    script: { id: string; codename?: unknown; presentation?: { name?: unknown } },
    uiLocale: string
): RecordBehaviorOption => {
    const codename = getVLCString(script.codename as VersionedLocalizedContent<string> | string | undefined, uiLocale) || script.id
    const label = getVLCString(script.presentation?.name as VersionedLocalizedContent<string> | string | undefined, uiLocale) || codename
    return { codename, label }
}

const validateRecordBehaviorValue = (
    behavior: CatalogRecordBehavior,
    t: (key: string, fallback?: string | Record<string, unknown>) => string
): Record<string, string> => {
    const errors: Record<string, string> = {}
    if (
        (behavior.mode === 'transactional' || behavior.mode === 'hybrid') &&
        behavior.posting.mode !== 'disabled' &&
        behavior.posting.targetLedgers.length === 0
    ) {
        errors.recordBehaviorPosting = t(
            'entities.recordBehavior.validation.targetLedgerRequired',
            'Select at least one target Ledger for posting.'
        )
    }
    if (behavior.posting.mode !== 'disabled' && behavior.lifecycle.enabled && !behavior.lifecycle.states.some((state) => state.isInitial)) {
        errors.recordBehaviorLifecycle = t(
            'entities.recordBehavior.validation.initialStateRequired',
            'Select an initial lifecycle state before enabling posting.'
        )
    }
    return errors
}

export const buildInitialValues = (ctx: ActionContext<LinkedCollectionDisplayWithContainer, LinkedCollectionLocalizedPayload>) => {
    const catalogMap = ctx.catalogMap as Map<string, LinkedCollectionEntity | LinkedCollectionWithContainers> | undefined
    const raw = catalogMap?.get(ctx.entity.id)
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)
    const nameFallback = ctx.entity?.name || ctx.entity?.codename || ''
    const descriptionFallback = ctx.entity?.description || ''

    let treeEntityIds: string[] = []
    let isSingleHub = false
    let isRequiredHub = false

    if (raw && Array.isArray(raw.treeEntities)) {
        treeEntityIds = raw.treeEntities.map((hub) => hub.id)
        isSingleHub = Boolean(raw.isSingleHub)
        isRequiredHub = Boolean(raw.isRequiredHub)
    } else if (Array.isArray(ctx.entity.treeEntities) && ctx.entity.treeEntities.length > 0) {
        treeEntityIds = ctx.entity.treeEntities.map((hub) => hub.id)
        isSingleHub = Boolean(ctx.entity.isSingleHub)
        isRequiredHub = Boolean(ctx.entity.isRequiredHub)
    } else if ((ctx.entity as LinkedCollectionDisplayWithContainer).treeEntityId) {
        treeEntityIds = [(ctx.entity as LinkedCollectionDisplayWithContainer).treeEntityId as string]
        isSingleHub = Boolean(ctx.entity.isSingleHub)
        isRequiredHub = Boolean(ctx.entity.isRequiredHub)
    }

    return {
        nameVlc: ensureLocalizedContent(raw?.name ?? ctx.entity?.name, uiLocale, nameFallback),
        descriptionVlc: ensureLocalizedContent(raw?.description ?? ctx.entity?.description, uiLocale, descriptionFallback),
        codename: ensureEntityCodenameContent(raw, uiLocale, raw?.codename ?? ctx.entity?.codename ?? ''),
        codenameTouched: true,
        treeEntityIds,
        isSingleHub,
        isRequiredHub,
        recordBehavior:
            raw?.config && typeof raw.config === 'object'
                ? normalizeCatalogRecordBehaviorFromConfig(raw.config)
                : normalizeCatalogRecordBehaviorFromConfig((ctx as LinkedCollectionActionContext).recordBehaviorDefaultConfig),
        ledgerSchemaEnabled:
            raw?.config && typeof raw.config === 'object'
                ? hasLedgerConfig(raw.config)
                : hasLedgerConfig((ctx as LinkedCollectionActionContext).ledgerSchemaDefaultConfig),
        ledgerConfig:
            raw?.config && typeof raw.config === 'object'
                ? normalizeLedgerConfigFromConfig(raw.config)
                : normalizeLedgerConfigFromConfig((ctx as LinkedCollectionActionContext).ledgerSchemaDefaultConfig)
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
    for (const [locale, localeValue] of Object.entries(nextLocales)) {
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

const buildCopyInitialValues = (ctx: ActionContext<LinkedCollectionDisplayWithContainer, LinkedCollectionLocalizedPayload>) => {
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
        ...normalizeLinkedCollectionCopyOptions()
    }
}

const getLinkedCollectionCopyOptions = (rawValues?: Record<string, unknown> | null) => {
    const values = ensureFormValues(rawValues)
    return normalizeLinkedCollectionCopyOptions({
        copyFieldDefinitions: values.copyFieldDefinitions as boolean | undefined,
        copyRecords: values.copyRecords as boolean | undefined
    })
}

export const validateLinkedCollectionForm = (
    ctx: ActionContext<LinkedCollectionDisplayWithContainer, LinkedCollectionLocalizedPayload>,
    rawValues?: LinkedCollectionFormValues | null
) => {
    const values = ensureFormValues(rawValues)
    const cc = _cc(values)
    const errors: Record<string, string> = {}

    const treeEntityIds = Array.isArray(values.treeEntityIds) ? values.treeEntityIds : []
    const isRequiredHub = Boolean(values.isRequiredHub)
    if (isRequiredHub && treeEntityIds.length === 0) {
        errors.treeEntityIds = ctx.t('catalogs.validation.hubRequired', 'At least one hub is required')
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

    if ((ctx as LinkedCollectionActionContext).recordBehaviorEnabled) {
        Object.assign(errors, validateRecordBehaviorValue(getRecordBehaviorFormValue(values.recordBehavior), ctx.t))
    }
    if ((ctx as LinkedCollectionActionContext).ledgerSchemaEnabled && values.ledgerSchemaEnabled === true) {
        try {
            normalizeLedgerConfig(values.ledgerConfig)
        } catch {
            errors.ledgerConfig = ctx.t('entities.ledgerSchema.validation.invalid', 'Ledger schema settings are invalid.')
        }
    }

    return Object.keys(errors).length > 0 ? errors : null
}

export const LinkedCollectionLayoutTabFields = ({
    values: _values,
    setValue: _setValue,
    isLoading: _isLoading,
    t,
    metahubId,
    scopeEntityId,
    currentTreeEntityId,
    routeKindKey
}: {
    values: LinkedCollectionFormValues
    setValue: LinkedCollectionFormSetValue
    isLoading: boolean
    t: ActionContext<LinkedCollectionDisplayWithContainer, LinkedCollectionLocalizedPayload>['t']
    metahubId?: string | null
    scopeEntityId?: string | null
    currentTreeEntityId?: string | null
    routeKindKey?: string | null
}) => {
    const showScopedLayoutManager = Boolean(metahubId && scopeEntityId)
    const detailBasePath =
        metahubId && scopeEntityId
            ? buildLinkedCollectionAuthoringPath({
                  metahubId,
                  linkedCollectionId: scopeEntityId,
                  treeEntityId: currentTreeEntityId ?? null,
                  kindKey: routeKindKey ?? null,
                  tab: 'fieldDefinitions'
              }).replace(/\/field-definitions$/, '/layout')
            : undefined

    return (
        <Stack spacing={2.5}>
            {showScopedLayoutManager ? (
                <>
                    <Typography variant='body2' color='text.secondary'>
                        {t(
                            'catalogs.layoutTab.entityLayoutsHelper',
                            'Entity layouts own widget composition and runtime behavior. The active global layout continues to work until you create an entity-specific override.'
                        )}
                    </Typography>
                    <LayoutList
                        metahubId={metahubId ?? undefined}
                        scopeEntityId={scopeEntityId ?? undefined}
                        detailBasePath={detailBasePath}
                        title={null}
                        emptyTitle={t('catalogs.layoutTab.emptyTitle', 'No entity layouts')}
                        emptyDescription={t(
                            'catalogs.layoutTab.emptyDescription',
                            'This entity currently uses the active global layout. Create the first entity layout to override widgets and runtime behavior.'
                        )}
                        embedded
                    />
                </>
            ) : (
                <Typography variant='body2' color='text.secondary'>
                    {t(
                        'catalogs.layoutTab.unavailable',
                        'Entity layouts are available when this entity is opened inside a metahub context.'
                    )}
                </Typography>
            )}
        </Stack>
    )
}

const LinkedCollectionRecordBehaviorTab = ({
    ctx,
    values,
    setValue,
    isLoading,
    errors,
    linkedCollectionId
}: {
    ctx: LinkedCollectionActionContext
    values: LinkedCollectionFormValues
    setValue: LinkedCollectionFormSetValue
    isLoading: boolean
    errors: Record<string, string>
    linkedCollectionId?: string | null
}) => {
    const metahubId = ctx.metahubId ?? ctx.entity.metahubId ?? null
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)
    const behaviorComponents = ctx.recordBehaviorComponents ?? null
    const attachedToKind = resolveLinkedCollectionAttachmentKind(ctx)
    const ledgerCandidateKindKeys = ctx.ledgerCandidateKindKeys?.length ? ctx.ledgerCandidateKindKeys : ['ledger']
    const ledgerQueries = useQueries({
        queries: ledgerCandidateKindKeys.map((kindKey) => ({
            queryKey:
                metahubId && ctx.recordBehaviorEnabled
                    ? ['metahubs', metahubId, 'catalogs', linkedCollectionId ?? 'create', 'recordBehavior', 'ledgers', kindKey]
                    : ['metahubs', 'catalogs', 'recordBehavior', 'ledgers', 'empty', kindKey],
            queryFn: () =>
                entitiesApi.listEntityInstances(metahubId!, {
                    kind: kindKey,
                    limit: 200,
                    offset: 0,
                    sortBy: 'codename',
                    sortOrder: 'asc'
                }),
            enabled: Boolean(metahubId && ctx.recordBehaviorEnabled),
            staleTime: 30 * 1000
        }))
    })
    const fieldDefinitionsQuery = useQuery({
        queryKey:
            metahubId && linkedCollectionId
                ? ['metahubs', metahubId, 'catalogs', linkedCollectionId, 'recordBehavior', 'fieldDefinitions']
                : ['metahubs', 'catalogs', 'recordBehavior', 'fieldDefinitions', 'empty'],
        queryFn: () =>
            fieldDefinitionsApi.listFieldDefinitionsDirect(metahubId!, linkedCollectionId!, {
                limit: 200,
                offset: 0,
                sortBy: 'sortOrder',
                sortOrder: 'asc',
                kindKey: ctx.routeKindKey ?? undefined
            }),
        enabled: Boolean(metahubId && linkedCollectionId),
        staleTime: 30 * 1000
    })
    const scriptsQuery = useQuery({
        queryKey:
            metahubId && linkedCollectionId
                ? ['metahubs', metahubId, attachedToKind, linkedCollectionId, 'recordBehavior', 'scripts']
                : ['metahubs', 'catalogs', 'recordBehavior', 'scripts', 'empty'],
        queryFn: () =>
            scriptsApi.list(metahubId!, {
                attachedToKind,
                attachedToId: linkedCollectionId
            }),
        enabled: Boolean(metahubId && linkedCollectionId),
        staleTime: 30 * 1000
    })
    const ledgerOptions = ledgerQueries
        .flatMap((query) => query.data?.items ?? [])
        .filter((entity) => hasLedgerConfig(entity.config))
        .map((entity) => toRecordBehaviorOption(entity, uiLocale))
    const fieldOptions = (fieldDefinitionsQuery.data?.items ?? []).map((field) => fieldDefinitionToRecordBehaviorOption(field, uiLocale))
    const scriptOptions = (scriptsQuery.data ?? []).map((script) => scriptToRecordBehaviorOption(script, uiLocale))

    return (
        <RecordBehaviorFields
            value={getRecordBehaviorFormValue(values.recordBehavior)}
            onChange={(nextValue) => setValue('recordBehavior', nextValue)}
            disabled={isLoading}
            components={behaviorComponents}
            fieldOptions={fieldOptions}
            ledgerOptions={ledgerOptions}
            scriptOptions={scriptOptions}
            errors={errors}
        />
    )
}

const LinkedCollectionLedgerSchemaTab = ({
    ctx,
    values,
    setValue,
    isLoading,
    errors,
    linkedCollectionId
}: {
    ctx: LinkedCollectionActionContext
    values: LinkedCollectionFormValues
    setValue: LinkedCollectionFormSetValue
    isLoading: boolean
    errors: Record<string, string>
    linkedCollectionId?: string | null
}) => {
    const metahubId = ctx.metahubId ?? ctx.entity.metahubId ?? null
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)
    const components = ctx.ledgerSchemaComponents ?? null
    const fieldDefinitionsQuery = useQuery({
        queryKey:
            metahubId && linkedCollectionId
                ? ['metahubs', metahubId, 'catalogs', linkedCollectionId, 'ledgerSchema', 'fieldDefinitions']
                : ['metahubs', 'catalogs', 'ledgerSchema', 'fieldDefinitions', 'empty'],
        queryFn: () =>
            fieldDefinitionsApi.listFieldDefinitionsDirect(metahubId!, linkedCollectionId!, {
                limit: 200,
                offset: 0,
                sortBy: 'sortOrder',
                sortOrder: 'asc',
                kindKey: ctx.routeKindKey ?? undefined
            }),
        enabled: Boolean(metahubId && linkedCollectionId),
        staleTime: 30 * 1000
    })
    const fieldOptions = (fieldDefinitionsQuery.data?.items ?? []).map((field) => fieldDefinitionToRecordBehaviorOption(field, uiLocale))
    const referenceFields = (fieldDefinitionsQuery.data?.items ?? []).map((field) => ({
        codename: getVLCString(field.codename as VersionedLocalizedContent<string> | string | undefined, uiLocale) || field.id,
        dataType: field.dataType
    }))
    const referenceErrors =
        values.ledgerSchemaEnabled === true && referenceFields.length > 0
            ? validateLedgerConfigReferences({ config: getLedgerConfigFormValue(values.ledgerConfig), fields: referenceFields })
            : []
    const mergedErrors =
        referenceErrors.length > 0
            ? {
                  ...errors,
                  ledgerConfig: ctx.t(
                      'entities.ledgerSchema.validation.referencesInvalid',
                      'Ledger schema references unknown or incompatible field definitions.'
                  )
              }
            : errors

    return (
        <Stack spacing={2}>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={values.ledgerSchemaEnabled === true}
                        onChange={(event) => setValue('ledgerSchemaEnabled', event.target.checked)}
                        disabled={isLoading}
                    />
                }
                label={ctx.t('entities.ledgerSchema.enabled', 'Use this entity as a ledger')}
            />
            {values.ledgerSchemaEnabled === true && components && supportsLedgerSchema(components) ? (
                <LedgerSchemaFields
                    value={getLedgerConfigFormValue(values.ledgerConfig)}
                    onChange={(nextValue) => setValue('ledgerConfig', nextValue)}
                    disabled={isLoading}
                    components={components}
                    fieldOptions={fieldOptions}
                    entityKindOptions={ctx.ledgerEntityKindOptions ?? []}
                    errors={mergedErrors}
                />
            ) : (
                <Typography variant='body2' color='text.secondary'>
                    {ctx.t(
                        'entities.ledgerSchema.disabledDescription',
                        'Enable ledger schema when this entity should store append-only facts, dimensions, resources, and projections.'
                    )}
                </Typography>
            )}
        </Stack>
    )
}

export const canSaveLinkedCollectionForm = (
    ctx: ActionContext<LinkedCollectionDisplayWithContainer, LinkedCollectionLocalizedPayload>,
    rawValues?: LinkedCollectionFormValues | null
) => {
    const values = ensureFormValues(rawValues)
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
    const behaviorValid =
        !(ctx as LinkedCollectionActionContext).recordBehaviorEnabled ||
        Object.keys(validateRecordBehaviorValue(getRecordBehaviorFormValue(values.recordBehavior), ctx.t)).length === 0
    const ledgerValid =
        !(ctx as LinkedCollectionActionContext).ledgerSchemaEnabled ||
        values.ledgerSchemaEnabled !== true ||
        (() => {
            try {
                normalizeLedgerConfig(values.ledgerConfig)
                return true
            } catch {
                return false
            }
        })()
    // TreeEntity requirement based on isRequiredHub flag in values
    const isRequiredHub = Boolean(values.isRequiredHub)
    if (isRequiredHub) {
        const treeEntityIds = Array.isArray(values.treeEntityIds) ? values.treeEntityIds : []
        return baseValid && behaviorValid && ledgerValid && treeEntityIds.length > 0
    }
    return baseValid && behaviorValid && ledgerValid
}

export const toPayload = (
    rawValues?: LinkedCollectionFormValues | null
): LinkedCollectionLocalizedPayload & {
    treeEntityIds?: string[]
    isSingleHub?: boolean
    isRequiredHub?: boolean
    ledgerConfig?: LedgerConfig | null
} => {
    const values = ensureFormValues(rawValues)
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
        isRequiredHub,
        recordBehavior: normalizeCatalogRecordBehavior(values.recordBehavior),
        ledgerConfig: values.ledgerSchemaEnabled === true ? normalizeLedgerConfig(values.ledgerConfig) : null
    }
}

const LinkedCollectionCopyOptionsTab = ({
    values,
    setValue,
    isLoading,
    t
}: {
    values: LinkedCollectionFormValues
    setValue: LinkedCollectionFormSetValue
    isLoading: boolean
    t: ActionContext<LinkedCollectionDisplayWithContainer, LinkedCollectionLocalizedPayload>['t']
}) => {
    const options = getLinkedCollectionCopyOptions(values)

    return (
        <Stack spacing={1}>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={options.copyFieldDefinitions}
                        onChange={(event) => {
                            setValue('copyFieldDefinitions', event.target.checked)
                            if (!event.target.checked) {
                                setValue('copyRecords', false)
                            }
                        }}
                        disabled={isLoading}
                    />
                }
                label={t('catalogs.copy.options.copyFieldDefinitions', 'Copy field definitions')}
            />
            <FormControlLabel
                control={
                    <Checkbox
                        checked={options.copyRecords}
                        onChange={(event) => setValue('copyRecords', event.target.checked)}
                        disabled={isLoading || !options.copyFieldDefinitions}
                    />
                }
                label={t('catalogs.copy.options.copyRecords', 'Copy records')}
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
    ctx: ActionContext<LinkedCollectionDisplayWithContainer, LinkedCollectionLocalizedPayload>,
    treeEntities: TreeEntity[],
    editingEntityId?: string | null
) => {
    return ({
        values,
        setValue,
        isLoading: isFormLoading,
        errors
    }: {
        values: LinkedCollectionFormValues
        setValue: LinkedCollectionFormSetValue
        isLoading: boolean
        errors: Record<string, string>
    }): TabConfig[] => {
        const metahubId = (ctx as LinkedCollectionActionContext).metahubId ?? ctx.entity.metahubId ?? null
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
                        uiLocale={ctx.uiLocale as string}
                        nameLabel={ctx.t('common:fields.name', 'Name')}
                        descriptionLabel={ctx.t('common:fields.description', 'Description')}
                        codenameLabel={ctx.t('catalogs.codename', 'Codename')}
                        codenameHelper={ctx.t('catalogs.codenameHelper', 'Unique identifier')}
                        editingEntityId={editingEntityId}
                    />
                )
            }
        ]

        if ((ctx as LinkedCollectionActionContext).recordBehaviorEnabled) {
            tabs.push({
                id: 'behavior',
                label: ctx.t('entities.instances.tabs.behavior', 'Behavior'),
                content: (
                    <LinkedCollectionRecordBehaviorTab
                        ctx={ctx as LinkedCollectionActionContext}
                        values={values}
                        setValue={setValue}
                        isLoading={isFormLoading}
                        errors={errors}
                        linkedCollectionId={editingEntityId}
                    />
                )
            })
        }

        if ((ctx as LinkedCollectionActionContext).ledgerSchemaEnabled) {
            tabs.push({
                id: 'ledgerSchema',
                label: ctx.t('entities.instances.tabs.ledgerSchema', 'Ledger schema'),
                content: (
                    <LinkedCollectionLedgerSchemaTab
                        ctx={ctx as LinkedCollectionActionContext}
                        values={values}
                        setValue={setValue}
                        isLoading={isFormLoading}
                        errors={errors}
                        linkedCollectionId={editingEntityId}
                    />
                )
            })
        }

        // Always show TreeEntities tab in edit mode (same as create mode)
        {
            const treeEntityIds = Array.isArray(values.treeEntityIds) ? values.treeEntityIds : []
            const isSingleHub = Boolean(values.isSingleHub)
            const isRequiredHub = Boolean(values.isRequiredHub)
            const currentTreeEntityId = (ctx as LinkedCollectionActionContext).currentTreeEntityId ?? null

            tabs.push({
                id: 'treeEntities',
                label: ctx.t('catalogs.tabs.treeEntities', 'Хабы'),
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

            tabs.push({
                id: 'layout',
                label: ctx.t('catalogs.tabs.layout', 'Layout'),
                content: (
                    <LinkedCollectionLayoutTabFields
                        values={values}
                        setValue={setValue}
                        isLoading={isFormLoading}
                        t={ctx.t}
                        metahubId={metahubId}
                        scopeEntityId={editingEntityId}
                        currentTreeEntityId={currentTreeEntityId}
                        routeKindKey={ctx.routeKindKey ?? null}
                    />
                )
            })
        }

        if (editingEntityId && metahubId) {
            tabs.push(
                createScriptsTab({
                    t: ctx.t,
                    metahubId,
                    attachedToKind: resolveLinkedCollectionAttachmentKind(ctx as LinkedCollectionActionContext),
                    attachedToId: editingEntityId
                })
            )
        }

        return tabs
    }
}

const linkedCollectionActions: readonly ActionDescriptor<LinkedCollectionDisplayWithContainer, LinkedCollectionLocalizedPayload>[] = [
    {
        id: 'edit',
        labelKey: 'common:actions.edit',
        icon: createEditActionIcon(),
        order: 10,
        dialog: {
            loader: async () => {
                const module = await import('@universo/template-mui/components/dialogs')
                return { default: module.EntityFormDialog }
            },
            buildProps: (ctx) => {
                const initial = buildInitialValues(ctx)
                const treeEntities = (ctx as LinkedCollectionActionContext).treeEntities ?? []

                return {
                    open: true,
                    mode: 'edit' as const,
                    title: ctx.t('catalogs.editTitle', 'Edit LinkedCollectionEntity'),
                    nameLabel: ctx.t('common:fields.name'),
                    descriptionLabel: ctx.t('common:fields.description'),
                    saveButtonText: ctx.t('common:actions.save'),
                    savingButtonText: ctx.t('common:actions.saving'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    hideDefaultFields: true,
                    initialExtraValues: initial,
                    tabs: buildFormTabs(ctx, treeEntities, ctx.entity.id),
                    validate: (values: LinkedCollectionFormValues) => validateLinkedCollectionForm(ctx, values),
                    canSave: (values: LinkedCollectionFormValues) => canSaveLinkedCollectionForm(ctx, values),
                    showDeleteButton: true,
                    deleteButtonText: ctx.t('common:actions.delete'),
                    onDelete: () => {
                        ctx.helpers?.openDeleteDialog?.(ctx.entity)
                    },
                    onClose: () => {
                        // BaseEntityMenu handles dialog closing
                    },
                    onSave: async (data: LinkedCollectionFormValues) => {
                        try {
                            const payload = toPayload(data)
                            const currentTreeEntityId = (ctx as LinkedCollectionActionContext).currentTreeEntityId
                            const detachedFromCurrentHub =
                                typeof currentTreeEntityId === 'string' &&
                                currentTreeEntityId.length > 0 &&
                                Array.isArray(payload.treeEntityIds) &&
                                !payload.treeEntityIds.includes(currentTreeEntityId)
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
        icon: createCopyActionIcon(),
        order: 11,
        dialog: {
            loader: async () => {
                const module = await import('@universo/template-mui/components/dialogs')
                return { default: module.EntityFormDialog }
            },
            buildProps: (ctx) => {
                const initial = buildCopyInitialValues(ctx)
                const treeEntities = (ctx as LinkedCollectionActionContext).treeEntities ?? []

                return {
                    open: true,
                    mode: 'create' as const,
                    title: ctx.t('catalogs.copyTitle', 'Copying LinkedCollectionEntity'),
                    nameLabel: ctx.t('common:fields.name'),
                    descriptionLabel: ctx.t('common:fields.description'),
                    saveButtonText: ctx.t('catalogs.copy.action', 'Copy'),
                    savingButtonText: ctx.t('catalogs.copy.actionLoading', 'Copying...'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    hideDefaultFields: true,
                    initialExtraValues: initial,
                    tabs: (args: LinkedCollectionDialogTabArgs) => [
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
                            label: ctx.t('catalogs.tabs.options', 'Options'),
                            content: (
                                <LinkedCollectionCopyOptionsTab
                                    values={args.values}
                                    setValue={args.setValue}
                                    isLoading={args.isLoading}
                                    t={ctx.t}
                                />
                            )
                        }
                    ],
                    validate: (values: LinkedCollectionFormValues) => validateLinkedCollectionForm(ctx, values),
                    canSave: (values: LinkedCollectionFormValues) => canSaveLinkedCollectionForm(ctx, values),
                    onClose: () => {
                        // BaseEntityMenu handles dialog closing
                    },
                    onSave: async (data: LinkedCollectionFormValues) => {
                        try {
                            const payload = toPayload(data)
                            const {
                                treeEntityIds: _hubIds,
                                isSingleHub: _isSingleHub,
                                isRequiredHub: _isRequiredHub,
                                recordBehavior,
                                ledgerConfig,
                                ...copyPayload
                            } = payload
                            const copyOptions = getLinkedCollectionCopyOptions(data)
                            const copiedConfig: Record<string, unknown> = {}
                            if ((ctx as LinkedCollectionActionContext).recordBehaviorEnabled) {
                                copiedConfig.recordBehavior = normalizeCatalogRecordBehavior(recordBehavior)
                            }
                            if ((ctx as LinkedCollectionActionContext).ledgerSchemaEnabled && ledgerConfig) {
                                copiedConfig.ledger = normalizeLedgerConfig(ledgerConfig)
                            }
                            const behaviorConfig = Object.keys(copiedConfig).length > 0 ? { config: copiedConfig } : {}
                            const currentTreeEntityId = (ctx as LinkedCollectionActionContext).currentTreeEntityId
                            const detachedFromCurrentHub =
                                typeof currentTreeEntityId === 'string' &&
                                currentTreeEntityId.length > 0 &&
                                Array.isArray(payload.treeEntityIds) &&
                                !payload.treeEntityIds.includes(currentTreeEntityId)
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
                                ...behaviorConfig,
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
        icon: createDeleteActionIcon(),
        tone: 'danger',
        order: 100,
        group: 'danger',
        onSelect: async (ctx) => {
            if (ctx.helpers?.openDeleteDialog) {
                ctx.helpers.openDeleteDialog(ctx.entity)
                return
            }

            const confirmed = await ctx.helpers?.confirm?.({
                title: ctx.t('catalogs.deleteDialog.title', 'Delete LinkedCollectionEntity'),
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

export default linkedCollectionActions
