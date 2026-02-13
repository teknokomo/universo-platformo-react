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

    const candidates: Array<'_mhb_widgets' | '_mhb_layout_zone_widgets'> = ['_mhb_widgets', '_mhb_layout_zone_widgets']

    // Single query to check both candidates. Avoids parallel hasTable() calls
    // that each acquire a separate pool connection under advisory locks.
    const result = await queryBuilder.raw<{ rows: Array<{ table_name: string }> }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name = ANY(?)`,
        [schemaName, candidates]
    )
    const existing = new Set(result.rows.map((r) => r.table_name))

    if (existing.has('_mhb_widgets')) {
        widgetTableCache.set(cacheKey, '_mhb_widgets')
        return '_mhb_widgets'
    }

    if (existing.has('_mhb_layout_zone_widgets')) {
        widgetTableCache.set(cacheKey, '_mhb_layout_zone_widgets')
        return '_mhb_layout_zone_widgets'
    }

    throw new MetahubMigrationRequiredError('Widget system table is missing. Metahub migration is required before template sync.', {
        schemaName,
        requiredTables: ['_mhb_widgets', '_mhb_layout_zone_widgets']
    })
}
