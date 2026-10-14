import { qSchemaTable } from '@universo-react/database'
import {
    globalShortLinkResourceOptionSchema,
    type GlobalShortLinkResourceOption,
    type GlobalShortLinkResourceKind
} from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import {
    runtimeLayoutCapableFilterSql,
    runtimeObjectFilterSql,
    resolvePresentationName,
    resolveRuntimeCodenameText
} from '../shared/runtimeHelpers'
import { buildPublicMarketingLifecyclePredicate } from '../shared/marketingRuntimeLifecycleSql'

interface GlobalShortLinkResourceRow {
    kind: unknown
    codename: unknown
    presentation: unknown
}

const RESOURCE_OPTIONS_LIMIT = 100

/** List only active, published layout-capable resource types for the application's public runtime. */
export async function listGlobalShortLinkResourceOptions(
    executor: DbExecutor,
    schemaName: string,
    locale: 'en' | 'ru'
): Promise<GlobalShortLinkResourceOption[]> {
    const objectsTable = qSchemaTable(schemaName, '_app_objects')
    const rows = await executor.query<GlobalShortLinkResourceRow>(
        `
        SELECT o.kind, o.codename, o.presentation
        FROM ${objectsTable} o
        WHERE (o.kind = 'page' OR ${runtimeObjectFilterSql('o.kind', 'o.config')})
          AND ${buildPublicMarketingLifecyclePredicate('o')}
          AND ${runtimeLayoutCapableFilterSql('o.config')}
        ORDER BY o.kind ASC, o.id ASC
        LIMIT $1
        `,
        [RESOURCE_OPTIONS_LIMIT]
    )

    const options: GlobalShortLinkResourceOption[] = []
    for (const row of rows) {
        const targetKind: GlobalShortLinkResourceKind | null = row.kind === 'page' ? 'page' : row.kind ? 'object' : null
        if (!targetKind) continue

        const fallback = resolveRuntimeCodenameText(row.codename).trim()
        const label = resolvePresentationName(row.presentation, locale, fallback).trim().slice(0, 1000)
        if (!label) continue

        const parsed = globalShortLinkResourceOptionSchema.safeParse({
            targetKind,
            entityTypeCodename: fallback,
            label
        })
        if (parsed.success) options.push(parsed.data)
    }

    return options
}
