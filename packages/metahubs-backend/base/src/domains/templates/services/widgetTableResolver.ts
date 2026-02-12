import type { Knex } from 'knex'
import { MetahubMigrationRequiredError } from '../../shared/domainErrors'

const widgetTableCache = new Map<string, '_mhb_widgets' | '_mhb_layout_zone_widgets'>()

const buildCacheKey = (schemaName: string): string => schemaName.trim()

export const clearWidgetTableResolverCache = (): void => {
    widgetTableCache.clear()
}

type KnexLike = Knex | Knex.Transaction

export const resolveWidgetTableName = async (
    queryBuilder: KnexLike,
    schemaName: string
): Promise<'_mhb_widgets' | '_mhb_layout_zone_widgets'> => {
    const cacheKey = buildCacheKey(schemaName)
    const cached = widgetTableCache.get(cacheKey)
    if (cached) {
        return cached
    }

    const [hasWidgets, hasLegacyWidgets] = await Promise.all([
        queryBuilder.schema.withSchema(schemaName).hasTable('_mhb_widgets'),
        queryBuilder.schema.withSchema(schemaName).hasTable('_mhb_layout_zone_widgets')
    ])

    if (hasWidgets) {
        widgetTableCache.set(cacheKey, '_mhb_widgets')
        return '_mhb_widgets'
    }

    if (hasLegacyWidgets) {
        widgetTableCache.set(cacheKey, '_mhb_layout_zone_widgets')
        return '_mhb_layout_zone_widgets'
    }

    throw new MetahubMigrationRequiredError('Widget system table is missing. Metahub migration is required before template sync.', {
        schemaName,
        requiredTables: ['_mhb_widgets', '_mhb_layout_zone_widgets']
    })
}
