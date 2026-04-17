import { useCallback, useMemo, useState } from 'react'
import {
    Alert,
    Box,
    Checkbox,
    Chip,
    Divider,
    FormControl,
    FormControlLabel,
    FormGroup,
    FormHelperText,
    InputLabel,
    MenuItem,
    Select,
    Skeleton,
    Stack,
    TextField,
    Typography
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import DeleteIcon from '@mui/icons-material/Delete'
import {
    COMPONENT_DEPENDENCIES,
    ENTITY_COMPONENT_KEYS,
    getEnabledComponentKeys,
    isBuiltinEntityKind,
    isEnabledComponentConfig,
    validateComponentDependencies,
    type ComponentManifest,
    type EntityComponentKey,
    type EntityTypeUIConfig,
    type VersionedLocalizedContent
} from '@universo/types'
import { isOptimisticLockConflict, extractConflictInfo, type ConflictInfo } from '@universo/utils'
import { useCommonTranslations } from '@universo/i18n'

import {
    APIEmptySVG,
    BaseEntityMenu,
    EmptyListState,
    FlowListTable,
    ItemCard,
    SkeletonGrid,
    TemplateMainCard as MainCard,
    ToolbarControls,
    ViewHeaderMUI as ViewHeader,
    gridSpacing,
    type ActionContext,
    type ActionDescriptor
} from '@universo/template-mui'
import type { TabConfig } from '@universo/template-mui/components/dialogs'
import { ConfirmDeleteDialog, ConflictResolutionDialog, EntityFormDialog } from '@universo/template-mui/components/dialogs'

import { ExistingCodenamesProvider } from '../../../components'
import { STORAGE_KEYS } from '../../../view-preferences/storage'
import { useViewPreference } from '../../../hooks/useViewPreference'
import { ensureLocalizedContent, extractLocalizedInput, getLocalizedContentText, hasPrimaryContent } from '../../../utils/localizedInput'
import { getVLCString, type Metahub } from '../../../types'
import { normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../utils/codename'
import { useMetahubDetails } from '../../metahubs/hooks'
import { useCodenameConfig } from '../../settings/hooks/useCodenameConfig'
import { useMetahubPrimaryLocale } from '../../settings/hooks/useMetahubPrimaryLocale'
import GeneralTabFields from '../../shared/ui/GeneralTabFields'
import { invalidateEntityTypesQueries, metahubsQueryKeys } from '../../shared'
import type { EntityTypePayload, UpdateEntityTypePayload, MetahubEntityType } from '../api'
import { useCopyEntityType, useCreateEntityType, useDeleteEntityType, useEntityTypesQuery, useUpdateEntityType } from '../hooks'
import { EntityTypePresetSelector } from './EntityTypePresetSelector'

type EntityTypeFormValues = Record<string, unknown>

type EntitiesViewMode = 'card' | 'list'
type SupportedEntityTab = 'general' | 'treeEntities' | 'layout' | 'scripts'

const STRUCTURED_ENTITY_TAB_LABELS: Record<SupportedEntityTab, string> = {
    general: 'General',
    treeEntities: 'Hubs',
    layout: 'Layout',
    scripts: 'Scripts'
}

const EMPTY_ENTITY_TYPES: MetahubEntityType[] = []

type EntityTypeDisplayRow = {
    id: string
    name: string
    description: string
    kindKey: string
    codename: string
    sidebarSection: 'objects' | 'admin'
    sidebarOrder: number | null
    iconName: string
    updatedAt: string
    componentKeys: string[]
    componentCount: number
    published: boolean
    raw: MetahubEntityType
}

type EntityTypeMenuContext = ActionContext<EntityTypeDisplayRow>

const ENTITY_KIND_KEY_PATTERN = /^[a-z][a-z0-9._-]{0,63}$/
const DIALOG_SAVE_CANCEL = { __dialogCancelled: true }
const STRUCTURED_ENTITY_TABS: readonly SupportedEntityTab[] = ['general', 'treeEntities', 'layout', 'scripts']
const OPTIONAL_ENTITY_TABS: readonly Exclude<SupportedEntityTab, 'general'>[] = ['treeEntities', 'layout', 'scripts']
const RELATION_TYPE_SEPARATOR_PATTERN = /[\n,]/
const ENTITY_TYPE_MENU_KIND = 'entity-type'
const COMPONENT_SECTION_SX = {
    border: 1,
    borderColor: 'divider',
    borderRadius: 2,
    p: 2
} as const

const buildEntityInstancesPath = (metahubId: string, kindKey: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(kindKey)}/instances`

const shouldTranslateEntityTypeUiText = (kindKey: string) => isBuiltinEntityKind(kindKey)

const DEFAULT_COMPONENTS_TEMPLATE: ComponentManifest = {
    dataSchema: { enabled: true },
    records: false,
    treeAssignment: false,
    optionValues: false,
    fixedValues: false,
    hierarchy: false,
    nestedCollections: false,
    relations: false,
    actions: { enabled: true },
    events: { enabled: true },
    scripting: { enabled: true },
    layoutConfig: { enabled: true },
    runtimeBehavior: { enabled: true },
    physicalTable: { enabled: true, prefix: 'obj' }
}

const DEFAULT_PRESENTATION_TEMPLATE: Record<string, unknown> = {}
const DEFAULT_CONFIG_TEMPLATE: Record<string, unknown> = {}

const appendLocalizedCopySuffix = (
    value: VersionedLocalizedContent<string> | null | undefined,
    uiLocale: string,
    fallback: string
): VersionedLocalizedContent<string> => {
    const normalizedLocale = uiLocale.toLowerCase().startsWith('ru') ? 'ru' : 'en'
    const suffix = normalizedLocale === 'ru' ? ' (копия)' : ' (copy)'

    if (!value?.locales) {
        return {
            _schema: 'v1',
            _primary: normalizedLocale,
            locales: {
                [normalizedLocale]: {
                    content: `${fallback || (normalizedLocale === 'ru' ? 'Копия' : 'Copy')}${suffix}`
                }
            }
        }
    }

    const nextLocales = { ...value.locales } as Record<string, { content?: string }>
    for (const [locale, localeValue] of Object.entries(nextLocales)) {
        const localeSuffix = locale.toLowerCase().startsWith('ru') ? ' (копия)' : ' (copy)'
        const content = typeof localeValue?.content === 'string' ? localeValue.content.trim() : ''
        if (content.length > 0) {
            nextLocales[locale] = { ...localeValue, content: `${content}${localeSuffix}` }
        }
    }

    const hasContent = Object.values(nextLocales).some((entry) => typeof entry?.content === 'string' && entry.content.trim().length > 0)
    if (!hasContent) {
        nextLocales[normalizedLocale] = {
            content: `${fallback || (normalizedLocale === 'ru' ? 'Копия' : 'Copy')}${suffix}`
        }
    }

    return {
        ...value,
        locales: nextLocales
    }
}

const buildCopyEntityTypeKindKey = (kindKey: string): string => {
    const normalizedKindKey = kindKey.trim().toLowerCase()
    const existingCopyMatch = normalizedKindKey.match(/^(.*?)-copy(?:-(\d+))?$/)
    if (existingCopyMatch) {
        const nextIndex = existingCopyMatch[2] ? Number.parseInt(existingCopyMatch[2], 10) + 1 : 2
        return `${existingCopyMatch[1]}-copy-${nextIndex}`
    }

    return `${normalizedKindKey}-copy`
}

const parseSidebarOrderValue = (value: unknown): number | undefined => {
    if (value === null || value === undefined) {
        return undefined
    }

    const rawValue = typeof value === 'string' ? value.trim() : String(value).trim()
    if (!rawValue) {
        return undefined
    }

    if (!/^\d+$/.test(rawValue)) {
        return undefined
    }

    const parsedValue = Number.parseInt(rawValue, 10)
    return Number.isSafeInteger(parsedValue) ? parsedValue : undefined
}

const stringifyJson = (value: unknown): string => JSON.stringify(value ?? {}, null, 2)

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const parseTabsInput = (value: unknown): string[] => {
    if (typeof value !== 'string') return []
    return Array.from(
        new Set(
            value
                .split(/[\n,]/)
                .map((item) => item.trim())
                .filter((item) => item.length > 0)
        )
    )
}

const parseJsonRecordField = (value: unknown, emptyFallback: Record<string, unknown> = {}): Record<string, unknown> => {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return emptyFallback
    }

    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Expected JSON object')
    }

    return parsed as Record<string, unknown>
}

const normalizeOptionalInteger = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const normalized = Number(value)
    if (!Number.isFinite(normalized) || normalized < 1) {
        return null
    }

    return Math.trunc(normalized)
}

const normalizeStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return Array.from(
            new Set(
                value
                    .filter((item): item is string => typeof item === 'string')
                    .map((item) => item.trim())
                    .filter((item) => item.length > 0)
            )
        )
    }

    if (typeof value !== 'string') {
        return []
    }

    return Array.from(
        new Set(
            value
                .split(RELATION_TYPE_SEPARATOR_PATTERN)
                .map((item) => item.trim())
                .filter((item) => item.length > 0)
        )
    )
}

const isSupportedEntityTab = (value: string): value is SupportedEntityTab => (STRUCTURED_ENTITY_TABS as readonly string[]).includes(value)

const normalizeEntityTypeTabs = (selectedValue: unknown, customTabsValue?: unknown): string[] => {
    const selectedTabs = Array.isArray(selectedValue)
        ? selectedValue.filter((tab): tab is string => typeof tab === 'string').map((tab) => tab.trim())
        : []
    const customTabs = parseTabsInput(customTabsValue)

    return Array.from(
        new Set(
            [
                'general',
                ...selectedTabs.filter((tab) => tab !== 'general'),
                ...customTabs.filter((tab) => !isSupportedEntityTab(tab))
            ].filter((tab) => tab.length > 0)
        )
    )
}

const normalizeStructuredEntityTabs = (value: unknown): SupportedEntityTab[] => {
    const selectedTabs = Array.isArray(value) ? value.filter((tab): tab is string => typeof tab === 'string').map((tab) => tab.trim()) : []

    return Array.from(
        new Set(['general', ...selectedTabs.filter((tab): tab is SupportedEntityTab => isSupportedEntityTab(tab) && tab !== 'general')])
    ) as SupportedEntityTab[]
}

const getDefaultEnabledComponent = (key: keyof ComponentManifest) => {
    switch (key) {
        case 'dataSchema':
            return { enabled: true, maxAttributes: null }
        case 'records':
            return { enabled: true, maxElements: null }
        case 'treeAssignment':
            return { enabled: true, isSingleHub: false, isRequiredHub: false }
        case 'hierarchy':
            return { enabled: true, supportsFolders: true }
        case 'nestedCollections':
            return { enabled: true, maxCollections: null }
        case 'relations':
            return { enabled: true, allowedRelationTypes: ['manyToOne'] }
        case 'physicalTable':
            return { enabled: true, prefix: 'obj' }
        default:
            return { enabled: true }
    }
}

const normalizeComponentManifestForBuilder = (value: unknown): ComponentManifest => {
    const source = isRecord(value) ? value : {}

    const dataSchema = isEnabledComponentConfig(source.dataSchema as never)
        ? {
              enabled: true,
              maxAttributes: normalizeOptionalInteger((source.dataSchema as Record<string, unknown>).maxAttributes)
          }
        : false
    const records = isEnabledComponentConfig(source.records as never)
        ? {
              enabled: true,
              maxElements: normalizeOptionalInteger((source.records as Record<string, unknown>).maxElements)
          }
        : false
    const treeAssignment = isEnabledComponentConfig(source.treeAssignment as never)
        ? {
              enabled: true,
              isSingleHub: (source.treeAssignment as Record<string, unknown>).isSingleHub === true,
              isRequiredHub: (source.treeAssignment as Record<string, unknown>).isRequiredHub === true
          }
        : false
    const hierarchy = isEnabledComponentConfig(source.hierarchy as never)
        ? {
              enabled: true,
              supportsFolders: (source.hierarchy as Record<string, unknown>).supportsFolders !== false
          }
        : false
    const nestedCollections = isEnabledComponentConfig(source.nestedCollections as never)
        ? {
              enabled: true,
              maxCollections: normalizeOptionalInteger((source.nestedCollections as Record<string, unknown>).maxCollections)
          }
        : false
    const relations = isEnabledComponentConfig(source.relations as never)
        ? {
              enabled: true,
              allowedRelationTypes: normalizeStringArray((source.relations as Record<string, unknown>).allowedRelationTypes)
          }
        : false
    const physicalTable = isEnabledComponentConfig(source.physicalTable as never)
        ? {
              enabled: true,
              prefix: String((source.physicalTable as Record<string, unknown>).prefix ?? '').trim() || 'obj'
          }
        : false

    const manifest: ComponentManifest = {
        dataSchema,
        records,
        treeAssignment,
        optionValues: isEnabledComponentConfig(source.optionValues as never) ? { enabled: true } : false,
        fixedValues: isEnabledComponentConfig(source.fixedValues as never) ? { enabled: true } : false,
        hierarchy,
        nestedCollections,
        relations,
        actions: isEnabledComponentConfig(source.actions as never) ? { enabled: true } : false,
        events: isEnabledComponentConfig(source.events as never) ? { enabled: true } : false,
        scripting: isEnabledComponentConfig(source.scripting as never) ? { enabled: true } : false,
        layoutConfig: isEnabledComponentConfig(source.layoutConfig as never) ? { enabled: true } : false,
        runtimeBehavior: isEnabledComponentConfig(source.runtimeBehavior as never) ? { enabled: true } : false,
        physicalTable
    }

    if (!isEnabledComponentConfig(manifest.dataSchema)) {
        manifest.records = false
        manifest.hierarchy = false
        manifest.nestedCollections = false
        manifest.relations = false
    }

    if (!isEnabledComponentConfig(manifest.actions)) {
        manifest.events = false
    }

    if (!isEnabledComponentConfig(manifest.layoutConfig)) {
        manifest.runtimeBehavior = false
    }

    return manifest
}

const setComponentEnabledState = (manifestValue: unknown, key: EntityComponentKey, enabled: boolean): ComponentManifest => {
    let manifest = normalizeComponentManifestForBuilder(manifestValue)

    if (enabled) {
        const enableRecursively = (componentKey: EntityComponentKey) => {
            for (const dependency of COMPONENT_DEPENDENCIES[componentKey]) {
                enableRecursively(dependency)
            }

            if (!isEnabledComponentConfig(manifest[componentKey])) {
                ;(manifest as Record<string, unknown>)[componentKey] = getDefaultEnabledComponent(componentKey)
            }
        }

        enableRecursively(key)
        return normalizeComponentManifestForBuilder(manifest)
    }

    const disableRecursively = (componentKey: EntityComponentKey) => {
        ;(manifest as Record<string, unknown>)[componentKey] = false

        for (const candidate of ENTITY_COMPONENT_KEYS) {
            if (COMPONENT_DEPENDENCIES[candidate].includes(componentKey) && isEnabledComponentConfig(manifest[candidate])) {
                disableRecursively(candidate)
            }
        }
    }

    disableRecursively(key)
    return normalizeComponentManifestForBuilder(manifest)
}

const patchEnabledComponentConfig = (
    manifestValue: unknown,
    key: EntityComponentKey,
    patch: Record<string, unknown>
): ComponentManifest => {
    const manifest = setComponentEnabledState(manifestValue, key, true)
    const currentValue = isEnabledComponentConfig(manifest[key])
        ? (manifest[key] as Record<string, unknown>)
        : (getDefaultEnabledComponent(key) as Record<string, unknown>)

    ;(manifest as Record<string, unknown>)[key] = {
        ...currentValue,
        ...patch,
        enabled: true
    }

    return normalizeComponentManifestForBuilder(manifest)
}

const resolveEntityTypeText = (
    entityType: MetahubEntityType,
    value: string | undefined,
    t: (key: string, options?: Record<string, unknown>) => string
) => {
    if (!value || value.trim().length === 0) {
        return ''
    }

    if (shouldTranslateEntityTypeUiText(entityType.kindKey)) {
        const translated = t(value, { defaultValue: '' }).trim()
        if (translated.length > 0) {
            return translated
        }

        const namespaceSeparatorIndex = value.indexOf(':')
        if (namespaceSeparatorIndex > 0 && namespaceSeparatorIndex < value.length - 1) {
            const namespace = value.slice(0, namespaceSeparatorIndex)
            const key = value.slice(namespaceSeparatorIndex + 1)
            const translatedWithNamespace = t(key, { ns: namespace, defaultValue: '' }).trim()
            if (translatedWithNamespace.length > 0) {
                return translatedWithNamespace
            }
        }

        return value
    }

    return value
}

const getEntityTypePresentation = (entityType: Pick<MetahubEntityType, 'presentation'> | null | undefined): Record<string, unknown> => {
    if (!entityType?.presentation || typeof entityType.presentation !== 'object' || Array.isArray(entityType.presentation)) {
        return {}
    }

    return entityType.presentation as Record<string, unknown>
}

const resolveEntityTypePresentationText = (
    entityType: MetahubEntityType,
    field: 'name' | 'description',
    uiLocale: string,
    fallback: string
) => {
    const presentation = getEntityTypePresentation(entityType)
    const localized = getLocalizedContentText(presentation[field], uiLocale, '').trim()
    return localized || fallback
}

const buildEntityTypeDisplayRow = (
    entityType: MetahubEntityType,
    uiLocale: string,
    t: (key: string, options?: Record<string, unknown>) => string
): EntityTypeDisplayRow => {
    const codename = getLocalizedContentText(
        entityType.codename as VersionedLocalizedContent<string> | string | null | undefined,
        uiLocale,
        ''
    )
    const fallbackName = resolveEntityTypeText(entityType, entityType.ui.nameKey, t) || codename || entityType.kindKey
    const fallbackDescription =
        resolveEntityTypeText(entityType, entityType.ui.descriptionKey, t) || codename || t('entities.noDescription', 'No description')
    const name = resolveEntityTypePresentationText(entityType, 'name', uiLocale, fallbackName)
    const description = resolveEntityTypePresentationText(entityType, 'description', uiLocale, fallbackDescription)
    const componentKeys = getEnabledComponentKeys(entityType.components)

    return {
        id: entityType.id ?? entityType.kindKey,
        name,
        description,
        kindKey: entityType.kindKey,
        codename,
        sidebarSection: entityType.ui.sidebarSection === 'admin' ? 'admin' : 'objects',
        sidebarOrder: typeof entityType.ui.sidebarOrder === 'number' ? entityType.ui.sidebarOrder : null,
        iconName: entityType.ui.iconName,
        updatedAt: entityType.updatedAt ?? '',
        componentKeys,
        componentCount: componentKeys.length,
        published: entityType.published === true,
        raw: entityType
    }
}

const buildInitialFormValues = (uiLocale: string, entityType?: MetahubEntityType | null): EntityTypeFormValues => {
    if (!entityType) {
        return {
            nameVlc: null,
            descriptionVlc: null,
            codename: null,
            codenameTouched: false,
            presetTemplateId: undefined,
            kindKey: '',
            iconName: 'IconBox',
            tabs: ['general'],
            customTabsInput: '',
            sidebarSection: 'objects',
            sidebarOrder: '',
            components: normalizeComponentManifestForBuilder(DEFAULT_COMPONENTS_TEMPLATE),
            presentationText: stringifyJson(DEFAULT_PRESENTATION_TEMPLATE),
            configText: stringifyJson(DEFAULT_CONFIG_TEMPLATE),
            published: true
        }
    }

    const normalizedTabs = normalizeEntityTypeTabs(entityType.ui.tabs, undefined)
    const structuredTabs = normalizedTabs.filter(isSupportedEntityTab)
    const customTabs = normalizedTabs.filter((tab) => !isSupportedEntityTab(tab))

    return {
        nameVlc: ensureLocalizedContent(getEntityTypePresentation(entityType).name ?? entityType.ui.nameKey, uiLocale, entityType.kindKey),
        descriptionVlc: entityType.ui.descriptionKey
            ? ensureLocalizedContent(
                  getEntityTypePresentation(entityType).description ?? entityType.ui.descriptionKey,
                  uiLocale,
                  entityType.ui.descriptionKey
              )
            : getEntityTypePresentation(entityType).description
            ? ensureLocalizedContent(getEntityTypePresentation(entityType).description, uiLocale, '')
            : null,
        codename: ensureLocalizedContent(entityType.codename ?? entityType.kindKey, uiLocale, entityType.kindKey),
        codenameTouched: false,
        presetTemplateId: undefined,
        kindKey: entityType.kindKey,
        iconName: entityType.ui.iconName,
        tabs: structuredTabs.length > 0 ? structuredTabs : ['general'],
        customTabsInput: customTabs.join(', '),
        sidebarSection: entityType.ui.sidebarSection === 'admin' ? 'admin' : 'objects',
        sidebarOrder: typeof entityType.ui.sidebarOrder === 'number' ? String(entityType.ui.sidebarOrder) : '',
        components: normalizeComponentManifestForBuilder(entityType.components),
        presentationText: stringifyJson(entityType.presentation ?? DEFAULT_PRESENTATION_TEMPLATE),
        configText: stringifyJson(entityType.config ?? DEFAULT_CONFIG_TEMPLATE),
        published: entityType.published !== false
    }
}

const buildCopyInitialFormValues = (uiLocale: string, entityType: MetahubEntityType): EntityTypeFormValues => {
    const initialValues = buildInitialFormValues(uiLocale, entityType)
    const fallbackName =
        getLocalizedContentText(
            initialValues.codename as VersionedLocalizedContent<string> | string | null | undefined,
            uiLocale,
            ''
        ).trim() || entityType.kindKey

    return {
        ...initialValues,
        nameVlc: appendLocalizedCopySuffix(
            initialValues.nameVlc as VersionedLocalizedContent<string> | null | undefined,
            uiLocale,
            fallbackName
        ),
        codename: null,
        codenameTouched: false,
        kindKey: buildCopyEntityTypeKindKey(entityType.kindKey)
    }
}

const EntitiesWorkspace = () => {
    const { metahubId } = useParams<{ metahubId: string }>()
    const navigate = useNavigate()
    const preferredVlcLocale = useMetahubPrimaryLocale()
    const codenameConfig = useCodenameConfig()
    const { t } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()
    const queryClient = useQueryClient()
    const metahubDetailsQuery = useMetahubDetails(metahubId ?? '', { enabled: Boolean(metahubId) })
    const cachedMetahub = metahubId ? queryClient.getQueryData<Metahub>(metahubsQueryKeys.detail(metahubId)) : undefined
    const resolvedPermissions = metahubDetailsQuery.data?.permissions ?? cachedMetahub?.permissions
    const canManageEntityTypes = resolvedPermissions?.manageMetahub === true
    const showManageEntityTypesNotice = Boolean(resolvedPermissions) && !canManageEntityTypes

    const [searchValue, setSearchValue] = useState('')
    const [storedView, setStoredView] = useViewPreference(STORAGE_KEYS.ENTITY_DISPLAY_STYLE, 'list')
    const view = (storedView === 'table' ? 'list' : storedView) as EntitiesViewMode
    const [editorState, setEditorState] = useState<{ mode: 'create' | 'edit' | 'copy'; entity: MetahubEntityType | null; open: boolean }>({
        mode: 'create',
        entity: null,
        open: false
    })
    const [deleteTarget, setDeleteTarget] = useState<MetahubEntityType | null>(null)
    const [conflictState, setConflictState] = useState<{
        open: boolean
        conflict: ConflictInfo | null
        entity: MetahubEntityType | null
        patch: UpdateEntityTypePayload | null
    }>({ open: false, conflict: null, entity: null, patch: null })

    const entityTypesQuery = useEntityTypesQuery(metahubId, {
        limit: 1000,
        offset: 0,
        sortBy: 'codename',
        sortOrder: 'asc'
    })

    const createEntityTypeMutation = useCreateEntityType()
    const copyEntityTypeMutation = useCopyEntityType()
    const updateEntityTypeMutation = useUpdateEntityType()
    const deleteEntityTypeMutation = useDeleteEntityType()

    const entityTypes = entityTypesQuery.data?.items ?? EMPTY_ENTITY_TYPES
    const entityTypeMap = useMemo(() => {
        const nextMap = new Map<string, MetahubEntityType>()
        for (const entityType of entityTypes) {
            if (typeof entityType.id === 'string' && entityType.id.length > 0) {
                nextMap.set(entityType.id, entityType)
            }
        }
        return nextMap
    }, [entityTypes])

    const filteredRows = useMemo(() => {
        const query = searchValue.trim().toLowerCase()
        const rows = entityTypes.map((entityType) => buildEntityTypeDisplayRow(entityType, preferredVlcLocale, t))

        if (!query) return rows

        return rows.filter((row) => {
            return (
                row.name.toLowerCase().includes(query) ||
                row.kindKey.toLowerCase().includes(query) ||
                row.codename.toLowerCase().includes(query) ||
                row.componentKeys.some((component) => component.toLowerCase().includes(query))
            )
        })
    }, [entityTypes, preferredVlcLocale, searchValue, t])

    const createEntityTypeMenuContext = useCallback(
        (base: Partial<EntityTypeMenuContext>): EntityTypeMenuContext => ({
            entity: base.entity as EntityTypeDisplayRow,
            entityKind: base.entityKind ?? ENTITY_TYPE_MENU_KIND,
            t: base.t ?? ((key) => key)
        }),
        []
    )

    const editorInitialValues = useMemo(() => {
        if (editorState.mode === 'edit') {
            return buildInitialFormValues(preferredVlcLocale, editorState.entity)
        }

        if (editorState.mode === 'copy' && editorState.entity) {
            return buildCopyInitialFormValues(preferredVlcLocale, editorState.entity)
        }

        return buildInitialFormValues(preferredVlcLocale, null)
    }, [editorState.entity, editorState.mode, preferredVlcLocale])

    const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setSearchValue(event.target.value)
    }, [])

    const handleOpenCreate = useCallback(() => {
        if (!canManageEntityTypes) return
        setEditorState({ mode: 'create', entity: null, open: true })
    }, [canManageEntityTypes])

    const resolveEntityTypeForAction = useCallback(
        (row: Pick<EntityTypeDisplayRow, 'id' | 'kindKey' | 'raw'>): MetahubEntityType | null => {
            const rawId = typeof row.raw?.id === 'string' && row.raw.id.length > 0 ? row.raw.id : null
            if (rawId) {
                return entityTypeMap.get(rawId) ?? row.raw ?? null
            }

            if (entityTypeMap.has(row.id)) {
                return entityTypeMap.get(row.id) ?? null
            }

            const resolvedFromKindKey = entityTypes.find((entityType) => entityType.kindKey === row.kindKey)
            return resolvedFromKindKey ?? row.raw ?? null
        },
        [entityTypeMap, entityTypes]
    )

    const handleOpenEdit = useCallback(
        (entityType: MetahubEntityType) => {
            if (!canManageEntityTypes || !entityType.id) return
            setEditorState({ mode: 'edit', entity: entityType, open: true })
        },
        [canManageEntityTypes]
    )

    const handleOpenCopy = useCallback(
        (entityType: MetahubEntityType) => {
            if (!canManageEntityTypes || !entityType.id) return
            setEditorState({ mode: 'copy', entity: entityType, open: true })
        },
        [canManageEntityTypes]
    )

    const handleOpenInstances = useCallback(
        (entityType: MetahubEntityType) => {
            if (!metahubId || !canManageEntityTypes) return
            navigate(buildEntityInstancesPath(metahubId, entityType.kindKey))
        },
        [canManageEntityTypes, metahubId, navigate]
    )

    const entityTypeMenuDescriptors = useMemo<ActionDescriptor<EntityTypeDisplayRow>[]>(
        () => [
            {
                id: 'instances',
                labelKey: 'entities.actions.instances',
                icon: <ViewListRoundedIcon fontSize='small' />,
                order: 10,
                onSelect: ({ entity }) => {
                    const resolvedEntityType = resolveEntityTypeForAction(entity)
                    if (!resolvedEntityType) return
                    handleOpenInstances(resolvedEntityType)
                }
            },
            {
                id: 'edit',
                labelKey: 'common:actions.edit',
                icon: <EditRoundedIcon fontSize='small' />,
                order: 20,
                onSelect: ({ entity }) => {
                    const resolvedEntityType = resolveEntityTypeForAction(entity)
                    if (!resolvedEntityType) return
                    handleOpenEdit(resolvedEntityType)
                }
            },
            {
                id: 'copy',
                labelKey: 'common:actions.copy',
                icon: <ContentCopyRoundedIcon fontSize='small' />,
                order: 30,
                onSelect: ({ entity }) => {
                    const resolvedEntityType = resolveEntityTypeForAction(entity)
                    if (!resolvedEntityType) return
                    handleOpenCopy(resolvedEntityType)
                }
            },
            {
                id: 'delete',
                labelKey: 'common:actions.delete',
                icon: <DeleteIcon fontSize='small' />,
                tone: 'danger',
                order: 100,
                group: 'danger',
                onSelect: ({ entity }) => {
                    const resolvedEntityType = resolveEntityTypeForAction(entity)
                    if (!resolvedEntityType) return
                    setDeleteTarget(resolvedEntityType)
                }
            }
        ],
        [handleOpenCopy, handleOpenEdit, handleOpenInstances, resolveEntityTypeForAction]
    )

    const renderEntityTypeMenu = useCallback(
        (row: EntityTypeDisplayRow) => {
            const resolvedEntityType = resolveEntityTypeForAction(row)
            if (!canManageEntityTypes || !resolvedEntityType?.id) {
                return null
            }

            return (
                <BaseEntityMenu
                    entity={row}
                    entityKind={ENTITY_TYPE_MENU_KIND}
                    descriptors={entityTypeMenuDescriptors}
                    namespace='metahubs'
                    menuButtonLabelKey='flowList:menu.button'
                    createContext={createEntityTypeMenuContext}
                />
            )
        },
        [canManageEntityTypes, createEntityTypeMenuContext, entityTypeMenuDescriptors, resolveEntityTypeForAction]
    )

    const handleCloseEditor = useCallback(() => {
        if (createEntityTypeMutation.isPending || copyEntityTypeMutation.isPending || updateEntityTypeMutation.isPending) return
        setEditorState((prev) => ({ ...prev, open: false }))
    }, [copyEntityTypeMutation.isPending, createEntityTypeMutation.isPending, updateEntityTypeMutation.isPending])

    const handleCloseConflict = useCallback(() => {
        setConflictState({ open: false, conflict: null, entity: null, patch: null })
    }, [])

    const parseEntityTypePayload = useCallback(
        (values: EntityTypeFormValues): EntityTypePayload => {
            const kindKey = String(values.kindKey ?? '')
                .trim()
                .toLowerCase()
            const iconName = String(values.iconName ?? '').trim()
            const sidebarSection = values.sidebarSection === 'admin' ? 'admin' : 'objects'
            const sidebarOrder = parseSidebarOrderValue(values.sidebarOrder)
            const tabs = normalizeEntityTypeTabs(values.tabs, values.customTabsInput)
            const components = normalizeComponentManifestForBuilder(values.components)
            const presentation = parseJsonRecordField(values.presentationText, DEFAULT_PRESENTATION_TEMPLATE)
            const config = parseJsonRecordField(values.configText, DEFAULT_CONFIG_TEMPLATE)
            const nameVlc = (values.nameVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
            const descriptionVlc = (values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
            const codenameValue = (values.codename as VersionedLocalizedContent<string> | null | undefined) ?? null
            const { primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
            const descriptionLocale = descriptionVlc?._primary ?? namePrimaryLocale ?? preferredVlcLocale
            const normalizedCodename = normalizeCodenameForStyle(
                getVLCString(codenameValue || undefined, codenameValue?._primary ?? namePrimaryLocale ?? preferredVlcLocale),
                codenameConfig.style,
                codenameConfig.alphabet
            )
            const codename = ensureLocalizedContent(codenameValue, namePrimaryLocale ?? preferredVlcLocale, normalizedCodename || kindKey)
            const nextPresentation = {
                ...presentation,
                name: nameVlc ?? presentation.name,
                ...(descriptionVlc ? { description: descriptionVlc } : {})
            }

            if (!descriptionVlc && 'description' in nextPresentation) {
                delete nextPresentation.description
            }
            const ui: EntityTypeUIConfig = {
                iconName,
                tabs,
                sidebarSection,
                ...(sidebarOrder !== undefined ? { sidebarOrder } : {}),
                nameKey: getLocalizedContentText(nameVlc, namePrimaryLocale ?? preferredVlcLocale, kindKey),
                descriptionKey: getLocalizedContentText(descriptionVlc, descriptionLocale, '').trim() || undefined
            }

            return {
                kindKey,
                codename,
                presentation: nextPresentation,
                components,
                ui,
                config,
                published: values.published !== false
            }
        },
        [codenameConfig.alphabet, codenameConfig.style, preferredVlcLocale]
    )

    const validateEntityTypeForm = useCallback(
        (values: EntityTypeFormValues) => {
            const errors: Record<string, string> = {}
            const kindKey = String(values.kindKey ?? '')
                .trim()
                .toLowerCase()
            const iconName = String(values.iconName ?? '').trim()
            const sidebarOrderValue = String(values.sidebarOrder ?? '').trim()
            const tabs = normalizeEntityTypeTabs(values.tabs, values.customTabsInput)
            const nameVlc = (values.nameVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
            const codenameValue = (values.codename as VersionedLocalizedContent<string> | null | undefined) ?? null
            const normalizedCodename = normalizeCodenameForStyle(
                getVLCString(codenameValue || undefined, codenameValue?._primary ?? preferredVlcLocale),
                codenameConfig.style,
                codenameConfig.alphabet
            )

            if (!hasPrimaryContent(nameVlc)) {
                errors.nameVlc = tc('crud.nameRequired', 'Name is required')
            }

            if (!kindKey) {
                errors.kindKey = t('entities.validation.kindKeyRequired', 'Kind key is required')
            } else if (!ENTITY_KIND_KEY_PATTERN.test(kindKey)) {
                errors.kindKey = t(
                    'entities.validation.kindKeyInvalid',
                    'Kind key must start with a letter and use only lowercase letters, digits, dots, underscores, or hyphens'
                )
            } else {
                const duplicate = entityTypes.find((entityType) => {
                    if (entityType.kindKey !== kindKey) return false
                    if (editorState.mode === 'edit' && editorState.entity?.id && entityType.id === editorState.entity.id) {
                        return false
                    }
                    return true
                })

                if (duplicate) {
                    errors.kindKey = t('entities.validation.kindKeyDuplicate', 'Another entity type already uses this kind key')
                }
            }

            if (!normalizedCodename) {
                errors.codename = t('entities.validation.codenameRequired', 'Codename is required')
            } else if (
                !isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            ) {
                errors.codename = t('entities.validation.codenameInvalid', 'Codename contains invalid characters')
            }

            if (!iconName) {
                errors.iconName = t('entities.validation.iconNameRequired', 'Icon name is required')
            }

            if (sidebarOrderValue.length > 0) {
                const parsedSidebarOrder = Number.parseInt(sidebarOrderValue, 10)
                if (!/^\d+$/.test(sidebarOrderValue) || !Number.isSafeInteger(parsedSidebarOrder)) {
                    errors.sidebarOrder = t('entities.validation.sidebarOrderInvalid', 'Sidebar order must be a non-negative integer')
                }
            }

            if (tabs.length === 0) {
                errors.tabs = t('entities.validation.tabsRequired', 'At least one tab is required')
            }

            try {
                const components = normalizeComponentManifestForBuilder(values.components)
                const dependencyErrors = validateComponentDependencies(components)
                if (dependencyErrors.length > 0) {
                    errors.components = dependencyErrors[0]
                }
            } catch {
                errors.components = t('entities.validation.componentsInvalid', 'Components must be a valid JSON object')
            }

            try {
                parseJsonRecordField(values.presentationText, DEFAULT_PRESENTATION_TEMPLATE)
            } catch {
                errors.presentationText = t('entities.validation.presentationInvalid', 'Presentation must be a valid JSON object')
            }

            try {
                parseJsonRecordField(values.configText, DEFAULT_CONFIG_TEMPLATE)
            } catch {
                errors.configText = t('entities.validation.configInvalid', 'Config must be a valid JSON object')
            }

            return Object.keys(errors).length > 0 ? errors : null
        },
        [
            codenameConfig.allowMixed,
            codenameConfig.alphabet,
            codenameConfig.style,
            entityTypes,
            editorState.entity,
            editorState.mode,
            preferredVlcLocale,
            t,
            tc
        ]
    )

    const canSaveEntityTypeForm = useCallback(
        (values: EntityTypeFormValues) => {
            if (values._hasCodenameDuplicate) return false
            return validateEntityTypeForm(values) === null
        },
        [validateEntityTypeForm]
    )

    const handleSaveEntityType = useCallback(
        async (values: EntityTypeFormValues) => {
            if (!metahubId || !canManageEntityTypes) return

            const payload = parseEntityTypePayload(values)

            if (editorState.mode === 'edit' && editorState.entity?.id) {
                const updatePayload: UpdateEntityTypePayload = {
                    ...payload,
                    expectedVersion: editorState.entity.version
                }

                try {
                    await updateEntityTypeMutation.mutateAsync({
                        metahubId,
                        entityTypeId: editorState.entity.id,
                        data: updatePayload
                    })
                } catch (error) {
                    if (isOptimisticLockConflict(error)) {
                        setConflictState({
                            open: true,
                            conflict: extractConflictInfo(error),
                            entity: editorState.entity,
                            patch: updatePayload
                        })
                        throw DIALOG_SAVE_CANCEL
                    }
                    throw error
                }

                return
            }

            if (editorState.mode === 'copy') {
                await copyEntityTypeMutation.mutateAsync({
                    metahubId,
                    data: payload
                })

                return
            }

            await createEntityTypeMutation.mutateAsync({
                metahubId,
                data: payload
            })
        },
        [
            canManageEntityTypes,
            copyEntityTypeMutation,
            createEntityTypeMutation,
            editorState.entity,
            editorState.mode,
            metahubId,
            parseEntityTypePayload,
            updateEntityTypeMutation
        ]
    )

    const handleConfirmDelete = useCallback(async () => {
        if (!metahubId || !deleteTarget?.id || !canManageEntityTypes) return
        await deleteEntityTypeMutation.mutateAsync({ metahubId, entityTypeId: deleteTarget.id })
    }, [canManageEntityTypes, deleteTarget?.id, deleteEntityTypeMutation, metahubId])

    const handleOverwriteConflict = useCallback(async () => {
        if (!metahubId || !conflictState.entity?.id || !conflictState.patch || !canManageEntityTypes) return

        const { expectedVersion: _ignoredVersion, ...patchWithoutVersion } = conflictState.patch
        await updateEntityTypeMutation.mutateAsync({
            metahubId,
            entityTypeId: conflictState.entity.id,
            data: patchWithoutVersion
        })

        setConflictState({ open: false, conflict: null, entity: null, patch: null })
        setEditorState({ mode: 'create', entity: null, open: false })
    }, [canManageEntityTypes, conflictState.entity, conflictState.patch, metahubId, updateEntityTypeMutation])

    const handleReloadAfterConflict = useCallback(() => {
        if (metahubId) {
            invalidateEntityTypesQueries.all(queryClient, metahubId)
        }
        handleCloseConflict()
    }, [handleCloseConflict, metahubId, queryClient])

    const buildFormTabs = useCallback(
        ({
            values,
            setValue,
            isLoading,
            errors
        }: {
            values: EntityTypeFormValues
            setValue: (name: string, value: unknown) => void
            isLoading: boolean
            errors: Record<string, string>
        }): TabConfig[] => {
            const structuredTabs = normalizeStructuredEntityTabs(values.tabs)
            const components = normalizeComponentManifestForBuilder(values.components)

            const toggleAuthoringTab = (tab: Exclude<SupportedEntityTab, 'general'>, checked: boolean) => {
                const nextTabs = checked ? [...structuredTabs, tab] : structuredTabs.filter((currentTab) => currentTab !== tab)

                setValue(
                    'tabs',
                    Array.from(new Set(['general', ...OPTIONAL_ENTITY_TABS.filter((candidate) => nextTabs.includes(candidate))]))
                )
            }

            const setComponentEnabled = (key: EntityComponentKey, enabled: boolean) => {
                setValue('components', setComponentEnabledState(values.components, key, enabled))
            }

            const updateComponentConfig = (key: EntityComponentKey, patch: Record<string, unknown>) => {
                setValue('components', patchEnabledComponentConfig(values.components, key, patch))
            }

            return [
                {
                    id: 'general',
                    label: t('entities.tabs.general', 'General'),
                    content: (
                        <Stack spacing={2}>
                            {editorState.mode === 'create' ? (
                                <EntityTypePresetSelector
                                    value={typeof values.presetTemplateId === 'string' ? values.presetTemplateId : undefined}
                                    setValue={setValue}
                                    disabled={isLoading}
                                    uiLocale={preferredVlcLocale}
                                    codenameStyle={codenameConfig.style}
                                    codenameAlphabet={codenameConfig.alphabet}
                                />
                            ) : null}
                            <GeneralTabFields
                                values={values}
                                setValue={setValue}
                                isLoading={isLoading}
                                errors={errors}
                                uiLocale={preferredVlcLocale}
                                nameLabel={tc('fields.name', 'Name')}
                                descriptionLabel={tc('fields.description', 'Description')}
                                codenameLabel={tc('fields.codename', 'Codename')}
                                codenameHelper={t(
                                    'entities.fields.codenameHelper',
                                    'Stable codename used for generic entity routes and references'
                                )}
                                editingEntityId={editorState.entity?.id ?? null}
                            />
                            <TextField
                                label={t('entities.fields.kindKey', 'Kind key')}
                                value={String(values.kindKey ?? '')}
                                onChange={(event) => setValue('kindKey', event.target.value)}
                                disabled={isLoading}
                                error={Boolean(errors.kindKey)}
                                helperText={
                                    errors.kindKey || t('entities.fields.kindKeyHelper', 'Lowercase identifier used in generic entity APIs')
                                }
                                required
                                fullWidth
                            />
                            <TextField
                                label={t('entities.fields.iconName', 'Icon name')}
                                value={String(values.iconName ?? '')}
                                onChange={(event) => setValue('iconName', event.target.value)}
                                disabled={isLoading}
                                error={Boolean(errors.iconName)}
                                helperText={
                                    errors.iconName ||
                                    t('entities.fields.iconNameHelper', 'Tabler icon export name used by downstream surfaces')
                                }
                                required
                                fullWidth
                            />
                            <Box sx={COMPONENT_SECTION_SX}>
                                <Stack spacing={1.5}>
                                    <Typography variant='subtitle2'>{t('entities.fields.tabs', 'Tabs')}</Typography>
                                    <Typography variant='body2' color='text.secondary'>
                                        {t(
                                            'entities.fields.tabsHelperStructured',
                                            'Choose which authoring tabs should be exposed for this entity type. General is always enabled.'
                                        )}
                                    </Typography>
                                    <FormGroup>
                                        {OPTIONAL_ENTITY_TABS.map((tab) => (
                                            <FormControlLabel
                                                key={tab}
                                                control={
                                                    <Checkbox
                                                        checked={structuredTabs.includes(tab)}
                                                        onChange={(event) => toggleAuthoringTab(tab, event.target.checked)}
                                                        disabled={isLoading}
                                                    />
                                                }
                                                label={t(`entities.tabOptions.${tab}`, STRUCTURED_ENTITY_TAB_LABELS[tab])}
                                            />
                                        ))}
                                    </FormGroup>
                                    <TextField
                                        label={t('entities.fields.customTabs', 'Additional tabs')}
                                        value={String(values.customTabsInput ?? '')}
                                        onChange={(event) => setValue('customTabsInput', event.target.value)}
                                        disabled={isLoading}
                                        error={Boolean(errors.tabs)}
                                        helperText={
                                            errors.tabs ||
                                            t(
                                                'entities.fields.customTabsHelper',
                                                'Optional extra tab identifiers, separated by commas or new lines. Structured toggles above cover the current supported tabs.'
                                            )
                                        }
                                        multiline
                                        minRows={2}
                                        fullWidth
                                    />
                                </Stack>
                            </Box>
                            <FormControl fullWidth error={Boolean(errors.sidebarSection)} disabled={isLoading}>
                                <InputLabel id='entity-type-sidebar-section-label'>
                                    {t('entities.fields.sidebarSection', 'Sidebar section')}
                                </InputLabel>
                                <Select
                                    labelId='entity-type-sidebar-section-label'
                                    label={t('entities.fields.sidebarSection', 'Sidebar section')}
                                    value={String(values.sidebarSection ?? 'objects')}
                                    onChange={(event) => setValue('sidebarSection', event.target.value)}
                                >
                                    <MenuItem value='objects'>{t('entities.sidebarSections.objects', 'Objects')}</MenuItem>
                                    <MenuItem value='admin'>{t('entities.sidebarSections.admin', 'Admin')}</MenuItem>
                                </Select>
                                <FormHelperText>
                                    {errors.sidebarSection ||
                                        t('entities.fields.sidebarSectionHelper', 'Controls where future menus may place this entity type')}
                                </FormHelperText>
                            </FormControl>
                            <TextField
                                label={t('entities.fields.sidebarOrder', 'Sidebar order')}
                                value={String(values.sidebarOrder ?? '')}
                                onChange={(event) => setValue('sidebarOrder', event.target.value)}
                                disabled={isLoading}
                                error={Boolean(errors.sidebarOrder)}
                                helperText={
                                    errors.sidebarOrder ||
                                    t(
                                        'entities.fields.sidebarOrderHelper',
                                        'Optional non-negative integer used to sort published entity links inside the dynamic menu zone.'
                                    )
                                }
                                type='number'
                                inputProps={{ min: 0, step: 1 }}
                                fullWidth
                            />
                            <Box sx={COMPONENT_SECTION_SX}>
                                <Stack spacing={1}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={values.published !== false}
                                                onChange={(event) => setValue('published', event.target.checked)}
                                                disabled={isLoading}
                                            />
                                        }
                                        label={t('entities.fields.published', 'Publish to dynamic menu')}
                                    />
                                    <FormHelperText sx={{ mt: 0 }}>
                                        {t(
                                            'entities.fields.publishedHelper',
                                            'Only published custom entity types appear in the dynamic metahub menu zone.'
                                        )}
                                    </FormHelperText>
                                </Stack>
                            </Box>
                        </Stack>
                    )
                },
                {
                    id: 'components',
                    label: t('entities.tabs.components', 'Components'),
                    content: (
                        <Stack spacing={2}>
                            <Alert severity='info'>
                                {t(
                                    'entities.fields.componentsHelperStructured',
                                    'Use guided toggles for the current Zerocode scope. Dependency-sensitive components are enabled and pruned automatically.'
                                )}
                            </Alert>
                            {errors.components ? <Alert severity='error'>{errors.components}</Alert> : null}
                            <Box
                                sx={{
                                    display: 'grid',
                                    gap: 2,
                                    gridTemplateColumns: {
                                        xs: '1fr',
                                        md: 'repeat(2, minmax(0, 1fr))'
                                    }
                                }}
                            >
                                <Box sx={COMPONENT_SECTION_SX}>
                                    <Stack spacing={1.5}>
                                        <Typography variant='subtitle2'>{t('entities.components.dataSchema', 'Data schema')}</Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t(
                                                'entities.components.dataSchemaHelper',
                                                'Enables attribute-driven modeling and generated value editors for the entity type.'
                                            )}
                                        </Typography>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={isEnabledComponentConfig(components.dataSchema)}
                                                    onChange={(event) => setComponentEnabled('dataSchema', event.target.checked)}
                                                    disabled={isLoading}
                                                />
                                            }
                                            label={t('entities.components.dataSchema', 'Data schema')}
                                        />
                                        {isEnabledComponentConfig(components.dataSchema) ? (
                                            <TextField
                                                label={t('entities.components.maxAttributes', 'Maximum fieldDefinitions')}
                                                type='number'
                                                value={components.dataSchema.maxAttributes ?? ''}
                                                onChange={(event) =>
                                                    updateComponentConfig('dataSchema', { maxAttributes: event.target.value })
                                                }
                                                disabled={isLoading}
                                                inputProps={{ min: 1 }}
                                                fullWidth
                                            />
                                        ) : null}
                                    </Stack>
                                </Box>
                                <Box sx={COMPONENT_SECTION_SX}>
                                    <Stack spacing={1.5}>
                                        <Typography variant='subtitle2'>
                                            {t('entities.components.records', 'Predefined records')}
                                        </Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t(
                                                'entities.components.recordsHelper',
                                                'Reuses the existing predefined-element flows for linked-collection presets and other seeded entity types.'
                                            )}
                                        </Typography>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={isEnabledComponentConfig(components.records)}
                                                    onChange={(event) => setComponentEnabled('records', event.target.checked)}
                                                    disabled={isLoading}
                                                />
                                            }
                                            label={t('entities.components.records', 'Predefined records')}
                                        />
                                        {isEnabledComponentConfig(components.records) ? (
                                            <TextField
                                                label={t('entities.components.maxElements', 'Maximum predefined records')}
                                                type='number'
                                                value={components.records.maxElements ?? ''}
                                                onChange={(event) => updateComponentConfig('records', { maxElements: event.target.value })}
                                                disabled={isLoading}
                                                inputProps={{ min: 1 }}
                                                fullWidth
                                            />
                                        ) : null}
                                    </Stack>
                                </Box>
                                <Box sx={COMPONENT_SECTION_SX}>
                                    <Stack spacing={1.5}>
                                        <Typography variant='subtitle2'>
                                            {t('entities.components.treeAssignment', 'TreeEntity assignment')}
                                        </Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t(
                                                'entities.components.treeAssignmentHelper',
                                                'Allows the entity instances page to reuse the shared hub-assignment controls and Catalogs-style tabs.'
                                            )}
                                        </Typography>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={isEnabledComponentConfig(components.treeAssignment)}
                                                    onChange={(event) => setComponentEnabled('treeAssignment', event.target.checked)}
                                                    disabled={isLoading}
                                                />
                                            }
                                            label={t('entities.components.treeAssignment', 'TreeEntity assignment')}
                                        />
                                        {isEnabledComponentConfig(components.treeAssignment) ? (
                                            <FormGroup>
                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            checked={components.treeAssignment.isSingleHub === true}
                                                            onChange={(event) =>
                                                                updateComponentConfig('treeAssignment', {
                                                                    isSingleHub: event.target.checked
                                                                })
                                                            }
                                                            disabled={isLoading}
                                                        />
                                                    }
                                                    label={t('entities.components.singleHub', 'Single hub only')}
                                                />
                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            checked={components.treeAssignment.isRequiredHub === true}
                                                            onChange={(event) =>
                                                                updateComponentConfig('treeAssignment', {
                                                                    isRequiredHub: event.target.checked
                                                                })
                                                            }
                                                            disabled={isLoading}
                                                        />
                                                    }
                                                    label={t('entities.components.requiredHub', 'Require at least one hub')}
                                                />
                                            </FormGroup>
                                        ) : null}
                                    </Stack>
                                </Box>
                                <Box sx={COMPONENT_SECTION_SX}>
                                    <Stack spacing={1.5}>
                                        <Typography variant='subtitle2'>{t('entities.components.hierarchy', 'Hierarchy')}</Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t(
                                                'entities.components.hierarchyHelper',
                                                'Adds parent-child structure support on top of the entity data schema.'
                                            )}
                                        </Typography>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={isEnabledComponentConfig(components.hierarchy)}
                                                    onChange={(event) => setComponentEnabled('hierarchy', event.target.checked)}
                                                    disabled={isLoading}
                                                />
                                            }
                                            label={t('entities.components.hierarchy', 'Hierarchy')}
                                        />
                                        {isEnabledComponentConfig(components.hierarchy) ? (
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={components.hierarchy.supportsFolders !== false}
                                                        onChange={(event) =>
                                                            updateComponentConfig('hierarchy', { supportsFolders: event.target.checked })
                                                        }
                                                        disabled={isLoading}
                                                    />
                                                }
                                                label={t('entities.components.supportsFolders', 'Allow folders')}
                                            />
                                        ) : null}
                                    </Stack>
                                </Box>
                                <Box sx={COMPONENT_SECTION_SX}>
                                    <Stack spacing={1.5}>
                                        <Typography variant='subtitle2'>
                                            {t('entities.components.nestedCollections', 'Nested collections')}
                                        </Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t(
                                                'entities.components.nestedCollectionsHelper',
                                                'Allows the entity schema to define repeating child collections inside the same type.'
                                            )}
                                        </Typography>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={isEnabledComponentConfig(components.nestedCollections)}
                                                    onChange={(event) => setComponentEnabled('nestedCollections', event.target.checked)}
                                                    disabled={isLoading}
                                                />
                                            }
                                            label={t('entities.components.nestedCollections', 'Nested collections')}
                                        />
                                        {isEnabledComponentConfig(components.nestedCollections) ? (
                                            <TextField
                                                label={t('entities.components.maxCollections', 'Maximum nested collections')}
                                                type='number'
                                                value={components.nestedCollections.maxCollections ?? ''}
                                                onChange={(event) =>
                                                    updateComponentConfig('nestedCollections', { maxCollections: event.target.value })
                                                }
                                                disabled={isLoading}
                                                inputProps={{ min: 1 }}
                                                fullWidth
                                            />
                                        ) : null}
                                    </Stack>
                                </Box>
                                <Box sx={COMPONENT_SECTION_SX}>
                                    <Stack spacing={1.5}>
                                        <Typography variant='subtitle2'>{t('entities.components.relations', 'Relations')}</Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t(
                                                'entities.components.relationsHelper',
                                                'Enables reference fieldDefinitions and relation-aware runtime behaviors for the entity type.'
                                            )}
                                        </Typography>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={isEnabledComponentConfig(components.relations)}
                                                    onChange={(event) => setComponentEnabled('relations', event.target.checked)}
                                                    disabled={isLoading}
                                                />
                                            }
                                            label={t('entities.components.relations', 'Relations')}
                                        />
                                        {isEnabledComponentConfig(components.relations) ? (
                                            <TextField
                                                label={t('entities.components.allowedRelationTypes', 'Allowed relation types')}
                                                value={components.relations.allowedRelationTypes?.join(', ') ?? ''}
                                                onChange={(event) =>
                                                    updateComponentConfig('relations', { allowedRelationTypes: event.target.value })
                                                }
                                                disabled={isLoading}
                                                helperText={t(
                                                    'entities.components.allowedRelationTypesHelper',
                                                    'Comma-separated relation kinds, for example manyToOne.'
                                                )}
                                                fullWidth
                                            />
                                        ) : null}
                                    </Stack>
                                </Box>
                            </Box>
                            <Divider flexItem />
                            <Box
                                sx={{
                                    display: 'grid',
                                    gap: 2,
                                    gridTemplateColumns: {
                                        xs: '1fr',
                                        md: 'repeat(2, minmax(0, 1fr))'
                                    }
                                }}
                            >
                                <Box sx={COMPONENT_SECTION_SX}>
                                    <Stack spacing={1.5}>
                                        <Typography variant='subtitle2'>
                                            {t('entities.components.optionValues', 'OptionListEntity values')}
                                        </Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t(
                                                'entities.components.optionValuesHelper',
                                                'Keeps the type compatible with enumeration-style value registries.'
                                            )}
                                        </Typography>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={isEnabledComponentConfig(components.optionValues)}
                                                    onChange={(event) => setComponentEnabled('optionValues', event.target.checked)}
                                                    disabled={isLoading}
                                                />
                                            }
                                            label={t('entities.components.optionValues', 'OptionListEntity values')}
                                        />
                                    </Stack>
                                </Box>
                                <Box sx={COMPONENT_SECTION_SX}>
                                    <Stack spacing={1.5}>
                                        <Typography variant='subtitle2'>{t('entities.components.fixedValues', 'Constants')}</Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t(
                                                'entities.components.fixedValuesHelper',
                                                'Keeps the type compatible with set-style constant registries.'
                                            )}
                                        </Typography>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={isEnabledComponentConfig(components.fixedValues)}
                                                    onChange={(event) => setComponentEnabled('fixedValues', event.target.checked)}
                                                    disabled={isLoading}
                                                />
                                            }
                                            label={t('entities.components.fixedValues', 'Constants')}
                                        />
                                    </Stack>
                                </Box>
                                <Box sx={COMPONENT_SECTION_SX}>
                                    <Stack spacing={1.5}>
                                        <Typography variant='subtitle2'>{t('entities.components.actions', 'Actions')}</Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t(
                                                'entities.components.actionsHelper',
                                                'Enables object-scoped actions for ECAE lifecycle orchestration.'
                                            )}
                                        </Typography>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={isEnabledComponentConfig(components.actions)}
                                                    onChange={(event) => setComponentEnabled('actions', event.target.checked)}
                                                    disabled={isLoading}
                                                />
                                            }
                                            label={t('entities.components.actions', 'Actions')}
                                        />
                                    </Stack>
                                </Box>
                                <Box sx={COMPONENT_SECTION_SX}>
                                    <Stack spacing={1.5}>
                                        <Typography variant='subtitle2'>{t('entities.components.events', 'Events')}</Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t(
                                                'entities.components.eventsHelper',
                                                'Allows lifecycle event bindings on top of the action contract.'
                                            )}
                                        </Typography>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={isEnabledComponentConfig(components.events)}
                                                    onChange={(event) => setComponentEnabled('events', event.target.checked)}
                                                    disabled={isLoading}
                                                />
                                            }
                                            label={t('entities.components.events', 'Events')}
                                        />
                                    </Stack>
                                </Box>
                                <Box sx={COMPONENT_SECTION_SX}>
                                    <Stack spacing={1.5}>
                                        <Typography variant='subtitle2'>{t('entities.components.scripting', 'Scripting')}</Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t(
                                                'entities.components.scriptingHelper',
                                                'Exposes the existing EntityScriptsTab for script attachments and reuse.'
                                            )}
                                        </Typography>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={isEnabledComponentConfig(components.scripting)}
                                                    onChange={(event) => setComponentEnabled('scripting', event.target.checked)}
                                                    disabled={isLoading}
                                                />
                                            }
                                            label={t('entities.components.scripting', 'Scripting')}
                                        />
                                    </Stack>
                                </Box>
                                <Box sx={COMPONENT_SECTION_SX}>
                                    <Stack spacing={1.5}>
                                        <Typography variant='subtitle2'>
                                            {t('entities.components.layoutConfig', 'Layout config')}
                                        </Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t(
                                                'entities.components.layoutConfigHelper',
                                                'Enables LinkedCollectionEntity-compatible layout configuration and the dedicated layout authoring tab.'
                                            )}
                                        </Typography>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={isEnabledComponentConfig(components.layoutConfig)}
                                                    onChange={(event) => setComponentEnabled('layoutConfig', event.target.checked)}
                                                    disabled={isLoading}
                                                />
                                            }
                                            label={t('entities.components.layoutConfig', 'Layout config')}
                                        />
                                    </Stack>
                                </Box>
                                <Box sx={COMPONENT_SECTION_SX}>
                                    <Stack spacing={1.5}>
                                        <Typography variant='subtitle2'>
                                            {t('entities.components.runtimeBehavior', 'Runtime behavior')}
                                        </Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t(
                                                'entities.components.runtimeBehaviorHelper',
                                                'Publishes layout-aware runtime behavior so the generic application surfaces can render this entity type.'
                                            )}
                                        </Typography>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={isEnabledComponentConfig(components.runtimeBehavior)}
                                                    onChange={(event) => setComponentEnabled('runtimeBehavior', event.target.checked)}
                                                    disabled={isLoading}
                                                />
                                            }
                                            label={t('entities.components.runtimeBehavior', 'Runtime behavior')}
                                        />
                                    </Stack>
                                </Box>
                                <Box sx={COMPONENT_SECTION_SX}>
                                    <Stack spacing={1.5}>
                                        <Typography variant='subtitle2'>
                                            {t('entities.components.physicalTable', 'Physical table')}
                                        </Typography>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t(
                                                'entities.components.physicalTableHelper',
                                                'Creates a dedicated runtime table for publication and application sync pipelines.'
                                            )}
                                        </Typography>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={isEnabledComponentConfig(components.physicalTable)}
                                                    onChange={(event) => setComponentEnabled('physicalTable', event.target.checked)}
                                                    disabled={isLoading}
                                                />
                                            }
                                            label={t('entities.components.physicalTable', 'Physical table')}
                                        />
                                        {isEnabledComponentConfig(components.physicalTable) ? (
                                            <TextField
                                                label={t('entities.components.tablePrefix', 'Table prefix')}
                                                value={components.physicalTable.prefix ?? ''}
                                                onChange={(event) => updateComponentConfig('physicalTable', { prefix: event.target.value })}
                                                disabled={isLoading}
                                                helperText={t(
                                                    'entities.components.tablePrefixHelper',
                                                    'Prefix used when the runtime DDL pipeline generates a physical table name.'
                                                )}
                                                fullWidth
                                            />
                                        ) : null}
                                    </Stack>
                                </Box>
                            </Box>
                        </Stack>
                    )
                },
                {
                    id: 'advanced',
                    label: t('entities.tabs.advanced', 'Advanced'),
                    content: (
                        <Stack spacing={2}>
                            <TextField
                                label={t('entities.fields.presentation', 'Presentation JSON')}
                                value={String(values.presentationText ?? '')}
                                onChange={(event) => setValue('presentationText', event.target.value)}
                                disabled={isLoading}
                                error={Boolean(errors.presentationText)}
                                helperText={
                                    errors.presentationText ||
                                    t('entities.fields.presentationHelper', 'Optional presentation metadata stored with the entity type')
                                }
                                multiline
                                minRows={8}
                                fullWidth
                                InputProps={{ sx: { fontFamily: 'monospace' } }}
                            />
                            <TextField
                                label={t('entities.fields.config', 'Config JSON')}
                                value={String(values.configText ?? '')}
                                onChange={(event) => setValue('configText', event.target.value)}
                                disabled={isLoading}
                                error={Boolean(errors.configText)}
                                helperText={
                                    errors.configText ||
                                    t('entities.fields.configHelper', 'Optional backend config object stored with the entity type')
                                }
                                multiline
                                minRows={8}
                                fullWidth
                                InputProps={{ sx: { fontFamily: 'monospace' } }}
                            />
                        </Stack>
                    )
                }
            ]
        },
        [codenameConfig.alphabet, codenameConfig.style, editorState.entity?.id, editorState.mode, preferredVlcLocale, t, tc]
    )

    const columns = useMemo(
        () => [
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '24%',
                sortable: true,
                sortAccessor: (row: EntityTypeDisplayRow) => row.name.toLowerCase(),
                render: (row: EntityTypeDisplayRow) => (
                    <Typography variant='body2' sx={{ fontWeight: 500 }}>
                        {row.name || row.kindKey}
                    </Typography>
                )
            },
            {
                id: 'kindKey',
                label: t('entities.columns.kindKey', 'Kind key'),
                width: '18%',
                sortable: true,
                sortAccessor: (row: EntityTypeDisplayRow) => row.kindKey,
                render: (row: EntityTypeDisplayRow) => (
                    <Typography variant='body2' sx={{ fontFamily: 'monospace' }}>
                        {row.kindKey}
                    </Typography>
                )
            },
            {
                id: 'sidebarSection',
                label: t('entities.columns.sidebarSection', 'Section'),
                width: '10%',
                sortable: true,
                sortAccessor: (row: EntityTypeDisplayRow) => row.sidebarSection,
                render: (row: EntityTypeDisplayRow) => (
                    <Typography variant='body2'>{t(`entities.sidebarSections.${row.sidebarSection}`, row.sidebarSection)}</Typography>
                )
            },
            {
                id: 'sidebarOrder',
                label: t('entities.columns.sidebarOrder', 'Order'),
                width: '8%',
                sortable: true,
                sortAccessor: (row: EntityTypeDisplayRow) => row.sidebarOrder ?? Number.MAX_SAFE_INTEGER,
                render: (row: EntityTypeDisplayRow) => (
                    <Typography variant='body2' color={row.sidebarOrder === null ? 'text.secondary' : 'text.primary'}>
                        {row.sidebarOrder ?? t('entities.columns.sidebarOrderAuto', 'Auto')}
                    </Typography>
                )
            },
            {
                id: 'published',
                label: t('entities.columns.published', 'Menu'),
                width: '10%',
                sortable: true,
                sortAccessor: (row: EntityTypeDisplayRow) => (row.published ? 'published' : 'hidden'),
                render: (row: EntityTypeDisplayRow) => (
                    <Chip
                        size='small'
                        color={row.published ? 'success' : 'default'}
                        variant={row.published ? 'filled' : 'outlined'}
                        label={row.published ? t('entities.badges.published', 'Published') : t('entities.badges.hidden', 'Hidden')}
                    />
                )
            },
            {
                id: 'components',
                label: t('entities.columns.components', 'Components'),
                width: '22%',
                sortable: true,
                sortAccessor: (row: EntityTypeDisplayRow) => row.componentCount,
                render: (row: EntityTypeDisplayRow) => (
                    <Stack direction='row' spacing={0.5} useFlexGap flexWrap='wrap'>
                        {row.componentKeys.slice(0, 3).map((componentKey) => (
                            <Chip key={componentKey} size='small' variant='outlined' label={componentKey} />
                        ))}
                        {row.componentKeys.length > 3 ? (
                            <Chip size='small' variant='outlined' label={`+${row.componentKeys.length - 3}`} />
                        ) : null}
                    </Stack>
                )
            },
            {
                id: 'updatedAt',
                label: t('entities.columns.updatedAt', 'Updated'),
                width: '10%',
                sortable: true,
                sortAccessor: (row: EntityTypeDisplayRow) => row.updatedAt,
                render: (row: EntityTypeDisplayRow) => (
                    <Typography variant='body2'>{row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : '—'}</Typography>
                )
            }
        ],
        [t, tc]
    )

    const renderRowActions = useCallback((row: EntityTypeDisplayRow) => renderEntityTypeMenu(row), [renderEntityTypeMenu])

    const renderCardAction = useCallback(
        (row: EntityTypeDisplayRow) => {
            const menu = renderEntityTypeMenu(row)
            if (!menu) return null

            return <Box onClick={(event) => event.stopPropagation()}>{menu}</Box>
        },
        [renderEntityTypeMenu]
    )

    const errorMessage = useMemo(() => {
        if (!entityTypesQuery.error) return null
        if (entityTypesQuery.error instanceof Error && entityTypesQuery.error.message) return entityTypesQuery.error.message
        return t('entities.loadError', 'Failed to load entity types')
    }, [entityTypesQuery.error, t])

    return (
        <ExistingCodenamesProvider entities={entityTypes}>
            <MainCard
                sx={{ maxWidth: '100%', width: '100%' }}
                contentSX={{ px: 0, py: 0 }}
                disableContentPadding
                disableHeader
                border={false}
                shadow={false}
            >
                <Stack flexDirection='column' sx={{ gap: 1 }}>
                    <ViewHeader
                        title={t('entities.title', 'Entities')}
                        search
                        searchValue={searchValue}
                        onSearchChange={handleSearchChange}
                        searchPlaceholder={t('entities.searchPlaceholder', 'Search entity types...')}
                    >
                        <ToolbarControls
                            viewToggleEnabled
                            viewMode={view}
                            onViewModeChange={(nextView) => setStoredView(nextView)}
                            cardViewTitle={tc('cardView')}
                            listViewTitle={tc('listView')}
                            primaryAction={
                                canManageEntityTypes
                                    ? {
                                          label: tc('actions.create', 'Create'),
                                          onClick: handleOpenCreate,
                                          startIcon: <AddRoundedIcon />
                                      }
                                    : undefined
                            }
                        />
                    </ViewHeader>

                    {showManageEntityTypesNotice ? (
                        <Alert severity='info'>
                            {t('entities.noManagePermission', 'You do not have permission to manage entity types for this metahub.')}
                        </Alert>
                    ) : null}

                    {errorMessage ? <Alert severity='error'>{errorMessage}</Alert> : null}

                    {entityTypesQuery.isLoading && filteredRows.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid insetMode='content' />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : filteredRows.length === 0 ? (
                        <EmptyListState
                            image={APIEmptySVG}
                            imageAlt='No entity types'
                            title={
                                searchValue
                                    ? t('entities.noSearchResults', 'No entity types found')
                                    : t('entities.empty', 'No entity types yet')
                            }
                            description={
                                searchValue
                                    ? t('entities.noSearchResultsDescription', 'Try a different search query or clear the filter.')
                                    : t('entities.emptyDescription', 'Create the first custom entity type to start modelling ECAE objects.')
                            }
                        />
                    ) : view === 'card' ? (
                        <Box
                            sx={{
                                display: 'grid',
                                gap: gridSpacing,
                                gridTemplateColumns: {
                                    xs: '1fr',
                                    sm: 'repeat(auto-fill, minmax(240px, 1fr))',
                                    lg: 'repeat(auto-fill, minmax(280px, 1fr))'
                                }
                            }}
                        >
                            {filteredRows.map((row) => (
                                <ItemCard
                                    key={row.id}
                                    data={{ name: row.name, description: row.description }}
                                    onClick={
                                        canManageEntityTypes
                                            ? () => {
                                                  const resolvedEntityType = resolveEntityTypeForAction(row)
                                                  if (!resolvedEntityType) return
                                                  handleOpenEdit(resolvedEntityType)
                                              }
                                            : undefined
                                    }
                                    headerAction={renderCardAction(row)}
                                    footerStartContent={
                                        <Stack direction='row' spacing={0.5} useFlexGap flexWrap='wrap'>
                                            <Chip
                                                size='small'
                                                color={row.published ? 'success' : 'default'}
                                                variant={row.published ? 'filled' : 'outlined'}
                                                label={
                                                    row.published
                                                        ? t('entities.badges.published', 'Published')
                                                        : t('entities.badges.hidden', 'Hidden')
                                                }
                                            />
                                            <Chip size='small' variant='outlined' label={row.kindKey} />
                                        </Stack>
                                    }
                                    footerEndContent={
                                        <Typography variant='caption' color='text.secondary'>
                                            {t('entities.componentsCount', {
                                                count: row.componentCount,
                                                defaultValue: '{{count}} components'
                                            })}
                                        </Typography>
                                    }
                                />
                            ))}
                        </Box>
                    ) : (
                        <Box>
                            <FlowListTable<EntityTypeDisplayRow>
                                data={filteredRows}
                                isLoading={entityTypesQuery.isLoading}
                                customColumns={columns}
                                i18nNamespace='flowList'
                                renderActions={renderRowActions}
                                initialOrder='asc'
                                initialOrderBy='name'
                            />
                        </Box>
                    )}
                </Stack>

                <EntityFormDialog
                    open={editorState.open && canManageEntityTypes}
                    mode={editorState.mode}
                    title={
                        editorState.mode === 'edit'
                            ? t('entities.editDialog.title', 'Edit Entity Type')
                            : editorState.mode === 'copy'
                            ? t('entities.copyDialog.title', 'Copy Entity Type')
                            : t('entities.createDialog.title', 'Create Entity Type')
                    }
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={
                        editorState.mode === 'edit'
                            ? tc('actions.save', 'Save')
                            : editorState.mode === 'copy'
                            ? tc('actions.copy', 'Copy')
                            : tc('actions.create', 'Create')
                    }
                    savingButtonText={
                        editorState.mode === 'edit'
                            ? tc('actions.saving', 'Saving...')
                            : editorState.mode === 'copy'
                            ? t('entities.copyDialog.copying', 'Copying...')
                            : tc('actions.creating', 'Creating...')
                    }
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onClose={handleCloseEditor}
                    onSave={handleSaveEntityType}
                    hideDefaultFields
                    initialExtraValues={editorInitialValues}
                    tabs={buildFormTabs}
                    validate={validateEntityTypeForm}
                    canSave={canSaveEntityTypeForm}
                    loading={createEntityTypeMutation.isPending || copyEntityTypeMutation.isPending || updateEntityTypeMutation.isPending}
                />

                <ConfirmDeleteDialog
                    open={Boolean(deleteTarget) && canManageEntityTypes}
                    title={t('entities.deleteDialog.title', 'Delete Entity Type')}
                    description={t('entities.deleteDialog.description', {
                        defaultValue: 'Delete entity type "{{name}}"? Platform-provided standard types cannot be deleted here.',
                        name: deleteTarget ? buildEntityTypeDisplayRow(deleteTarget, preferredVlcLocale, t).name : ''
                    })}
                    confirmButtonText={tc('actions.delete', 'Delete')}
                    deletingButtonText={tc('actions.deleting', 'Deleting...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onCancel={() => setDeleteTarget(null)}
                    onConfirm={handleConfirmDelete}
                    loading={deleteEntityTypeMutation.isPending}
                />

                <ConflictResolutionDialog
                    open={conflictState.open && canManageEntityTypes}
                    conflict={conflictState.conflict}
                    onCancel={handleCloseConflict}
                    onReload={handleReloadAfterConflict}
                    onOverwrite={handleOverwriteConflict}
                    isLoading={updateEntityTypeMutation.isPending}
                />
            </MainCard>
        </ExistingCodenamesProvider>
    )
}

export default EntitiesWorkspace
