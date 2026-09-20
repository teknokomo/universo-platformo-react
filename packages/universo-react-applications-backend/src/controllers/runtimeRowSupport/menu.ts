import { type DbExecutor } from '@universo-react/utils'
import { EffectiveLayoutError } from '../../services/effectiveLayoutContract'
import { resolveEffectiveLayoutForRequest } from '../../services/effectiveLayoutResolver'
import { UpdateFailure, runtimeCodenameTextSql } from '../../shared/runtimeHelpers'
import {
    RUNTIME_LAYOUT_CAPABLE_FILTER_SQL,
    RUNTIME_OBJECT_FILTER_SQL,
    createEmptyRuntimeZoneWidgets,
    mapRuntimeZoneWidgets,
    type RuntimeZoneWidgets
} from './contracts'

export const resolveRuntimeEffectiveLayout = async (params: {
    manager: DbExecutor
    applicationId: string
    userId: string
    role: Parameters<typeof resolveEffectiveLayoutForRequest>[1]['role']
    targetKind: 'page' | 'object'
    entityTypeId: string
    workspaceId: string | null
    locale: string
}): Promise<{ layoutId: string; layoutConfig: Record<string, unknown>; zoneWidgets: RuntimeZoneWidgets }> => {
    try {
        const result = await resolveEffectiveLayoutForRequest(
            params.manager,
            {
                applicationId: params.applicationId,
                userId: params.userId,
                role: params.role
            },
            {
                applicationId: params.applicationId,
                targetKind: params.targetKind,
                entityTypeId: params.entityTypeId,
                ...(params.workspaceId !== null ? { workspaceId: params.workspaceId } : {}),
                locale: params.locale
            }
        )
        const zoneWidgets =
            result.layout.templateKey === 'dashboard'
                ? mapRuntimeZoneWidgets(
                      result.widgets
                          .filter((widget) => widget.isActive)
                          .map((widget) => ({
                              id: widget.id,
                              layout_id: widget.layoutId ?? result.layout.id,
                              widget_key: widget.widgetKey,
                              sort_order: widget.sortOrder,
                              config: widget.config,
                              zone: widget.zone
                          }))
                  )
                : createEmptyRuntimeZoneWidgets()
        return {
            layoutId: result.layout.id,
            layoutConfig: result.layout.config ?? {},
            zoneWidgets
        }
    } catch (error) {
        if (error instanceof EffectiveLayoutError) {
            throw new UpdateFailure(error.httpStatus, {
                error: 'Runtime layout could not be resolved',
                code: error.code
            })
        }
        throw error
    }
}

export const resolvePreferredScopeEntityIdFromGlobalMenu = async (params: {
    manager: DbExecutor
    schemaName: string
    schemaIdent: string
}) => {
    const { manager, schemaName, schemaIdent } = params

    const resolveScopeEntityByToken = async (token: string): Promise<string | null> => {
        const normalized = token.trim()
        if (!normalized) return null

        const rows = (await manager.query(
            `
        SELECT id
        FROM ${schemaIdent}._app_objects
        WHERE _upl_deleted = false
          AND _app_deleted = false
          AND ${RUNTIME_LAYOUT_CAPABLE_FILTER_SQL}
          AND (id::text = $1 OR ${runtimeCodenameTextSql('codename')} = $1)
        ORDER BY CASE
                   WHEN id::text = $1 THEN 0
                   WHEN ${runtimeCodenameTextSql('codename')} = $1 THEN 1
                   ELSE 2
                 END,
                 ${runtimeCodenameTextSql('codename')} ASC,
                 id ASC
        LIMIT 1
      `,
            [normalized]
        )) as Array<{ id: string }>

        return rows[0]?.id ?? null
    }

    const resolveStartPageTokenFromMenuConfig = (config: Record<string, unknown>): string | null => {
        const startTarget = config.startTarget
        if (startTarget && typeof startTarget === 'object' && !Array.isArray(startTarget)) {
            const typedTarget = startTarget as Record<string, unknown>
            const targetKind = typedTarget.kind
            if (targetKind === 'section' && typeof typedTarget.sectionId === 'string' && typedTarget.sectionId.trim()) {
                return typedTarget.sectionId.trim()
            }
            if (
                targetKind === 'objectCollection' &&
                typeof typedTarget.objectCollectionId === 'string' &&
                typedTarget.objectCollectionId.trim()
            ) {
                return typedTarget.objectCollectionId.trim()
            }
        }

        const startPage = typeof config.startPage === 'string' ? config.startPage.trim() : ''
        if (!startPage) return null

        const items = Array.isArray(config.items) ? config.items : []
        const matchedItem = items
            .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : null))
            .find((item) => item?.id === startPage)

        if (matchedItem) {
            for (const key of ['sectionId', 'objectCollectionId']) {
                const value = matchedItem[key]
                if (typeof value === 'string' && value.trim()) {
                    return value.trim()
                }
            }
        }

        return startPage
    }

    try {
        const [{ layoutsExists, widgetsExists }] = (await manager.query(
            `
        SELECT
          EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = $1 AND table_name = '_app_layouts'
          ) AS "layoutsExists",
          EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = $1 AND table_name = '_app_widgets'
          ) AS "widgetsExists"
      `,
            [schemaName]
        )) as Array<{ layoutsExists: boolean; widgetsExists: boolean }>

        if (!layoutsExists || !widgetsExists) {
            return null
        }

        const defaultLayoutRows = (await manager.query(
            `
        SELECT id
        FROM ${schemaIdent}._app_layouts
        WHERE scope_entity_id IS NULL
          AND is_active = true
          AND _upl_deleted = false
          AND _app_deleted = false
        ORDER BY is_default DESC,
                 is_active DESC,
                 sort_order ASC,
                 _upl_created_at ASC
        LIMIT 1
      `
        )) as Array<{ id: string }>
        const activeLayoutId = defaultLayoutRows[0]?.id

        if (!activeLayoutId) {
            return null
        }

        const menuWidgets = (await manager.query(
            `
        SELECT config
        FROM ${schemaIdent}._app_widgets
        WHERE layout_id = $1
          AND zone = 'left'
          AND widget_key = 'menuWidget'
          AND is_active = true
          AND _upl_deleted = false
          AND _app_deleted = false
        ORDER BY sort_order ASC, _upl_created_at ASC
      `,
            [activeLayoutId]
        )) as Array<{ config?: unknown }>

        const menuConfigs = menuWidgets
            .map((row) => (row.config && typeof row.config === 'object' ? (row.config as Record<string, unknown>) : null))
            .filter((cfg): cfg is Record<string, unknown> => Boolean(cfg))

        for (const cfg of menuConfigs) {
            const startPageToken = resolveStartPageTokenFromMenuConfig(cfg)
            if (!startPageToken) continue

            const scopeEntityId = await resolveScopeEntityByToken(startPageToken)
            if (scopeEntityId) {
                return scopeEntityId
            }
        }

        const boundMenuConfig = menuConfigs.find((cfg) => Boolean(cfg.bindToHub) && typeof cfg.boundHubId === 'string')

        const boundTreeEntityId = typeof boundMenuConfig?.boundHubId === 'string' ? boundMenuConfig.boundHubId : null
        if (!boundTreeEntityId) {
            return null
        }

        const preferredObjectCollectionRows = (await manager.query(
            `
        SELECT id
        FROM ${schemaIdent}._app_objects
        WHERE ${RUNTIME_OBJECT_FILTER_SQL}
          AND _upl_deleted = false
          AND _app_deleted = false
          AND config->'hubs' @> $1::jsonb
        ORDER BY COALESCE((config->>'sortOrder')::int, 0) ASC, codename ASC
        LIMIT 1
      `,
            [JSON.stringify([boundTreeEntityId])]
        )) as Array<{ id: string }>

        return preferredObjectCollectionRows[0]?.id ?? null
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[ApplicationsRuntime] Failed to resolve preferred startup section from menu binding (ignored)', e)
        return null
    }
}
