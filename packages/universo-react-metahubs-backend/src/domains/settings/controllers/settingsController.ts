import { z } from 'zod'
import type { DbExecutor } from '@universo-react/utils/database'
import type { SqlQueryable } from '../../../persistence'
import type { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { MetahubSettingsService } from '../services/MetahubSettingsService'
import { BuiltinEntityKinds, ENTITY_SETTINGS_KINDS, METAHUB_SETTINGS_REGISTRY, isEnabledCapabilityConfig } from '@universo-react/types'
import type { MetahubSettingRow, ResolvedEntityType, SettingDefinition, VersionedLocalizedContent } from '@universo-react/types'
import { validateSettingValue } from '../../shared/validateSettingValue'
import { EntityTypeService } from '../../entities/services/EntityTypeService'
import { resolveEntityMetadataKindFromType } from '../../shared/entityMetadataKinds'

type RegistryEntry = SettingDefinition

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const settingsUpdateSchema = z
    .object({
        settings: z
            .array(
                z.object({
                    key: z.string().min(1).max(100),
                    value: z.record(z.unknown())
                })
            )
            .min(1)
            .max(50)
    })
    .strict()

const ENTITY_SETTING_TABS = new Set<string>(ENTITY_SETTINGS_KINDS)
const BASE_ENTITY_SETTING_TABS = new Set<string>(ENTITY_SETTINGS_KINDS)

const isEntitySettingKind = (value: string): value is (typeof ENTITY_SETTINGS_KINDS)[number] => {
    return ENTITY_SETTING_TABS.has(value)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mergeSettingsWithDefaults(dbRows: MetahubSettingRow[], registry: readonly RegistryEntry[] = METAHUB_SETTINGS_REGISTRY) {
    const dbMap = new Map(dbRows.map((r) => [r.key, r]))
    return registry.map((def) => {
        const dbRow = dbMap.get(def.key)
        if (dbRow) {
            return {
                key: def.key,
                value: dbRow.value,
                id: dbRow.id,
                version: dbRow._upl_version,
                updatedAt: dbRow._upl_updated_at,
                isDefault: false
            }
        }
        return {
            key: def.key,
            value: { _value: def.defaultValue },
            id: null,
            version: 0,
            updatedAt: null,
            isDefault: true
        }
    })
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const isLocalizedContent = (value: unknown): value is VersionedLocalizedContent<string> =>
    isRecord(value) && isRecord(value.locales) && typeof value._primary === 'string'

const resolveTabLabel = (entityType: ResolvedEntityType): VersionedLocalizedContent<string> | undefined => {
    const presentation = isRecord(entityType.presentation) ? entityType.presentation : undefined
    const presentationName = presentation?.name
    if (isLocalizedContent(presentationName)) {
        return presentationName
    }

    const codename = (entityType as { codename?: unknown }).codename
    return isLocalizedContent(codename) ? codename : undefined
}

const getSettingSuffix = (definition: SettingDefinition): string => definition.key.split('.').slice(2).join('.')

const cloneEntitySetting = (definition: SettingDefinition, kindKey: string, sortOrder: number): SettingDefinition => ({
    ...definition,
    key: `entity.${kindKey}.${getSettingSuffix(definition)}`,
    tab: kindKey,
    sortOrder
})

const getBaseEntitySettingTemplates = (baseKind: string, suffixes: readonly string[] | null = null): SettingDefinition[] =>
    METAHUB_SETTINGS_REGISTRY.filter((definition) => definition.tab === baseKind).filter((definition) =>
        suffixes ? suffixes.includes(getSettingSuffix(definition)) : true
    )

const buildEntityTypeSettingDefinitions = (entityType: ResolvedEntityType): SettingDefinition[] => {
    if (BASE_ENTITY_SETTING_TABS.has(entityType.kindKey)) {
        return []
    }

    const settings: SettingDefinition[] = []
    let sortOrder = 1
    const addTemplates = (baseKind: string, suffixes: readonly string[] | null = null) => {
        for (const template of getBaseEntitySettingTemplates(baseKind, suffixes)) {
            settings.push(cloneEntitySetting(template, entityType.kindKey, sortOrder++))
        }
    }

    const metadataKind = resolveEntityMetadataKindFromType(entityType)
    if (metadataKind) {
        addTemplates(metadataKind, ['allowCopy', 'allowDelete'])
    } else {
        addTemplates(BuiltinEntityKinds.OBJECT, ['allowCopy', 'allowDelete'])
    }

    if (isEnabledCapabilityConfig(entityType.capabilities.dataSchema)) {
        addTemplates(BuiltinEntityKinds.OBJECT, [
            'componentCodenameScope',
            'allowedComponentTypes',
            'allowComponentCopy',
            'allowComponentDelete',
            'allowDeleteLastDisplayComponent',
            'allowComponentMoveBetweenRootAndChildren',
            'allowComponentMoveBetweenChildLists'
        ])
    }

    if (isEnabledCapabilityConfig(entityType.capabilities.records)) {
        addTemplates(BuiltinEntityKinds.OBJECT, ['allowElementCopy', 'allowElementDelete'])
    }

    if (isEnabledCapabilityConfig(entityType.capabilities.fixedValues)) {
        addTemplates(BuiltinEntityKinds.SET, ['constantCodenameScope', 'allowedConstantTypes', 'allowConstantCopy', 'allowConstantDelete'])
    }

    if (isEnabledCapabilityConfig(entityType.capabilities.optionValues)) {
        addTemplates(BuiltinEntityKinds.ENUMERATION, ['allowCopy', 'allowDelete'])
    }

    const unique = new Map<string, SettingDefinition>()
    for (const setting of settings) {
        unique.set(setting.key, setting)
    }

    return [...unique.values()]
}

const SYSTEM_LANGUAGE_OPTION = 'system'

const buildLanguageOptions = (codes: string[]): string[] => {
    const normalized = codes
        .filter((code): code is string => typeof code === 'string')
        .map((code) => code.trim())
        .filter((code) => code.length > 0)

    const unique = Array.from(new Set(normalized))
    if (!unique.includes(SYSTEM_LANGUAGE_OPTION)) {
        return [SYSTEM_LANGUAGE_OPTION, ...unique]
    }
    return unique
}

const getContentLocaleCodes = async (ds: SqlQueryable): Promise<string[]> => {
    try {
        const rows = (await ds.query(
            `
        SELECT code
        FROM admin.cfg_locales
        WHERE is_enabled_content = true
        ORDER BY sort_order ASC, code ASC
      `
        )) as Array<{ code?: unknown }>

        const codes = rows.map((row) => (typeof row.code === 'string' ? row.code : '')).filter((code) => code.length > 0)

        return buildLanguageOptions(codes)
    } catch {
        const def = METAHUB_SETTINGS_REGISTRY.find((entry) => entry.key === 'general.language')
        return buildLanguageOptions((def?.options ?? []) as string[])
    }
}

const withDynamicLanguageOptions = (languageOptions: string[]): RegistryEntry[] => {
    return METAHUB_SETTINGS_REGISTRY.map((def) => {
        if (def.key !== 'general.language') return def
        return {
            ...def,
            options: languageOptions
        } as RegistryEntry
    })
}

const filterRegistryForEntityTypes = (registry: RegistryEntry[], entityTypes: ResolvedEntityType[]): RegistryEntry[] => {
    const availableEntityTabs = new Set(entityTypes.map((entityType) => entityType.kindKey).filter(isEntitySettingKind))

    return registry.filter((entry) => !isEntitySettingKind(entry.tab) || availableEntityTabs.has(entry.tab))
}

const buildSettingsTabOrder = (entityTypes: ResolvedEntityType[], registry: readonly RegistryEntry[]): string[] => {
    const registryTabs = new Set(registry.map((entry) => entry.tab))
    const orderedEntityTabs = entityTypes
        .filter((entityType) => registryTabs.has(entityType.kindKey))
        .slice()
        .sort((left, right) => {
            const leftOrder = typeof left.ui?.sidebarOrder === 'number' ? left.ui.sidebarOrder : Number.MAX_SAFE_INTEGER
            const rightOrder = typeof right.ui?.sidebarOrder === 'number' ? right.ui.sidebarOrder : Number.MAX_SAFE_INTEGER
            return leftOrder - rightOrder || left.kindKey.localeCompare(right.kindKey)
        })
        .map((entityType) => entityType.kindKey)

    return ['general', 'common', ...orderedEntityTabs]
}

const buildSettingsTabLabels = (entityTypes: ResolvedEntityType[]): Record<string, VersionedLocalizedContent<string>> => {
    const labels: Record<string, VersionedLocalizedContent<string>> = {}
    for (const entityType of entityTypes) {
        const label = resolveTabLabel(entityType)
        if (label) {
            labels[entityType.kindKey] = label
        }
    }

    return labels
}

const buildRegistry = async ({
    exec,
    schemaService,
    metahubId,
    userId,
    languageOptions
}: {
    exec: DbExecutor
    schemaService: ConstructorParameters<typeof EntityTypeService>[1]
    metahubId: string
    userId?: string
    languageOptions: string[]
}): Promise<{ registry: RegistryEntry[]; tabOrder: string[]; tabLabels: Record<string, VersionedLocalizedContent<string>> }> => {
    const entityTypes = await new EntityTypeService(exec, schemaService).listTypes(metahubId, userId)
    const staticRegistry = filterRegistryForEntityTypes(withDynamicLanguageOptions(languageOptions), entityTypes)
    const dynamicRegistry = entityTypes.flatMap(buildEntityTypeSettingDefinitions)
    const registry = [...staticRegistry, ...dynamicRegistry]
    return {
        registry,
        tabOrder: buildSettingsTabOrder(entityTypes, registry),
        tabLabels: buildSettingsTabLabels(entityTypes)
    }
}

// ---------------------------------------------------------------------------
// Controller factory
// ---------------------------------------------------------------------------

export function createSettingsController(createHandler: ReturnType<typeof createMetahubHandlerFactory>) {
    // GET /metahub/:metahubId/settings
    const list = createHandler(async ({ res, metahubId, userId, exec, schemaService }) => {
        const settingsService = new MetahubSettingsService(exec, schemaService)

        const dbRows = await settingsService.findAll(metahubId, userId)
        const languageOptions = await getContentLocaleCodes(exec)
        const { registry, tabOrder, tabLabels } = await buildRegistry({ exec, schemaService, metahubId, userId, languageOptions })
        const merged = mergeSettingsWithDefaults(dbRows, registry)
        const hasHubNesting = await settingsService.hasHubNesting(metahubId, userId)

        res.json({ settings: merged, registry, meta: { hasHubNesting, tabOrder, tabLabels } })
    })

    // PUT /metahub/:metahubId/settings
    const bulkUpdate = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const settingsService = new MetahubSettingsService(exec, schemaService)
            const languageOptions = await getContentLocaleCodes(exec)

            const parsed = settingsUpdateSchema.safeParse(req.body)
            if (!parsed.success) {
                res.status(400).json({ error: 'Invalid settings payload', details: parsed.error.issues })
                return
            }

            const validationErrors: Array<{ key: string; error: string }> = []
            const { registry, tabOrder, tabLabels } = await buildRegistry({ exec, schemaService, metahubId, userId, languageOptions })
            const registryByKey = new Map(registry.map((entry) => [entry.key, entry]))

            for (const s of parsed.data.settings) {
                const err = validateSettingValue(
                    s.key,
                    s.value,
                    s.key === 'general.language' ? languageOptions : undefined,
                    registryByKey.get(s.key)
                )
                if (err) validationErrors.push({ key: s.key, error: err })
            }
            if (validationErrors.length > 0) {
                res.status(400).json({ error: 'Invalid setting values', details: validationErrors })
                return
            }

            await settingsService.bulkUpsert(metahubId, parsed.data.settings, userId, registry)

            const requestedResetNesting =
                parsed.data.settings.find((entry) => entry.key === 'entity.hub.resetNestingOnce')?.value?._value === true
            if (requestedResetNesting) {
                await settingsService.clearHubNesting(metahubId, userId)
                await settingsService.resetToDefault(metahubId, 'entity.hub.resetNestingOnce', userId)
            }

            const dbRows = await settingsService.findAll(metahubId, userId)
            const merged = mergeSettingsWithDefaults(dbRows, registry)
            const hasHubNesting = await settingsService.hasHubNesting(metahubId, userId)
            res.json({ settings: merged, registry, meta: { hasHubNesting, tabOrder, tabLabels } })
        },
        { permission: 'manageMetahub' }
    )

    // GET /metahub/:metahubId/setting/:key
    const getByKey = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const settingsService = new MetahubSettingsService(exec, schemaService)
        const languageOptions = await getContentLocaleCodes(exec)
        const { registry } = await buildRegistry({ exec, schemaService, metahubId, userId, languageOptions })

        const { key } = req.params
        const row = await settingsService.findByKey(metahubId, key, userId)
        if (!row) {
            const def = registry.find((s) => s.key === key)
            if (!def) {
                res.status(404).json({ error: `Unknown setting key: ${key}` })
                return
            }
            res.json({ key: def.key, value: { _value: def.defaultValue }, isDefault: true })
            return
        }
        res.json({ key: row.key, value: row.value, isDefault: false, version: row._upl_version })
    })

    // DELETE /metahub/:metahubId/setting/:key
    const resetByKey = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const settingsService = new MetahubSettingsService(exec, schemaService)
            const languageOptions = await getContentLocaleCodes(exec)
            const { registry } = await buildRegistry({ exec, schemaService, metahubId, userId, languageOptions })

            const { key } = req.params
            const def = registry.find((s) => s.key === key)
            if (!def) {
                res.status(404).json({ error: `Unknown setting key: ${key}` })
                return
            }

            await settingsService.resetToDefault(metahubId, key, userId)
            res.json({ key, value: { _value: def.defaultValue }, isDefault: true })
        },
        { permission: 'manageMetahub' }
    )

    return { list, bulkUpdate, getByKey, resetByKey }
}
