import { z } from 'zod'
import type { DbExecutor } from '@universo/utils/database'
import type { SqlQueryable } from '../../../persistence'
import type { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { MetahubSettingsService } from '../services/MetahubSettingsService'
import { ENTITY_SETTINGS_KINDS, METAHUB_SETTINGS_REGISTRY, getSettingDefinition } from '@universo/types'
import type { MetahubSettingRow, ResolvedEntityType } from '@universo/types'
import { validateSettingValue } from '../../shared/validateSettingValue'
import { EntityTypeService } from '../../entities/services/EntityTypeService'

type RegistryEntry = (typeof METAHUB_SETTINGS_REGISTRY)[number]

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

const buildSettingsTabOrder = (entityTypes: ResolvedEntityType[]): string[] => {
    const orderedEntityTabs = entityTypes
        .filter((entityType) => isEntitySettingKind(entityType.kindKey))
        .slice()
        .sort((left, right) => {
            const leftOrder = typeof left.ui?.sidebarOrder === 'number' ? left.ui.sidebarOrder : Number.MAX_SAFE_INTEGER
            const rightOrder = typeof right.ui?.sidebarOrder === 'number' ? right.ui.sidebarOrder : Number.MAX_SAFE_INTEGER
            return leftOrder - rightOrder || left.kindKey.localeCompare(right.kindKey)
        })
        .map((entityType) => entityType.kindKey)

    return ['general', 'common', ...orderedEntityTabs]
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
}): Promise<{ registry: RegistryEntry[]; tabOrder: string[] }> => {
    const entityTypes = await new EntityTypeService(exec, schemaService).listTypes(metahubId, userId)
    return {
        registry: filterRegistryForEntityTypes(withDynamicLanguageOptions(languageOptions), entityTypes),
        tabOrder: buildSettingsTabOrder(entityTypes)
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
        const { registry, tabOrder } = await buildRegistry({ exec, schemaService, metahubId, userId, languageOptions })
        const merged = mergeSettingsWithDefaults(dbRows, registry)
        const hasHubNesting = await settingsService.hasHubNesting(metahubId, userId)

        res.json({ settings: merged, registry, meta: { hasHubNesting, tabOrder } })
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
            for (const s of parsed.data.settings) {
                const err = validateSettingValue(s.key, s.value, s.key === 'general.language' ? languageOptions : undefined)
                if (err) validationErrors.push({ key: s.key, error: err })
            }
            if (validationErrors.length > 0) {
                res.status(400).json({ error: 'Invalid setting values', details: validationErrors })
                return
            }

            await settingsService.bulkUpsert(metahubId, parsed.data.settings, userId)

            const requestedResetNesting =
                parsed.data.settings.find((entry) => entry.key === 'entity.hub.resetNestingOnce')?.value?._value === true
            if (requestedResetNesting) {
                await settingsService.clearHubNesting(metahubId, userId)
                await settingsService.resetToDefault(metahubId, 'entity.hub.resetNestingOnce', userId)
            }

            const dbRows = await settingsService.findAll(metahubId, userId)
            const { registry, tabOrder } = await buildRegistry({ exec, schemaService, metahubId, userId, languageOptions })
            const merged = mergeSettingsWithDefaults(dbRows, registry)
            const hasHubNesting = await settingsService.hasHubNesting(metahubId, userId)
            res.json({ settings: merged, registry, meta: { hasHubNesting, tabOrder } })
        },
        { permission: 'manageMetahub' }
    )

    // GET /metahub/:metahubId/setting/:key
    const getByKey = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const settingsService = new MetahubSettingsService(exec, schemaService)

        const { key } = req.params
        const row = await settingsService.findByKey(metahubId, key, userId)
        if (!row) {
            const def = METAHUB_SETTINGS_REGISTRY.find((s) => s.key === key)
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

            const { key } = req.params
            const def = getSettingDefinition(key)
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
