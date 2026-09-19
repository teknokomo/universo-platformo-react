import type { Request, Response } from 'express'
import { normalizeDashboardSideMenuConfig } from '@universo-react/utils'
import { normalizeLocale, resolveRuntimeSchema } from '../../shared/runtimeHelpers'
import { runtimeQuerySchema } from '../runtimeRowSupport/contracts'

import type { RuntimeRowReadHandlerDeps } from './types'
import {
    buildRuntimeReadColumnDefinitions,
    loadRuntimeReadComponents,
    loadRuntimeReadEnumOptions,
    loadRuntimeReadObjectCollections,
    loadRuntimeReadObjectRefOptions,
    loadRuntimeReadRows,
    loadRuntimeReadWorkspaceLimit,
    resolveRuntimeReadActiveObjectCollection,
    resolveRuntimeReadLayout
} from './dataLoaders'
import { buildRuntimeReadMenus, loadRuntimeMenuStructure } from './menus'
import { buildRuntimeReadResponsePayload, buildRuntimeReadSections } from './payload'

export const createGetRuntimeHandler = ({ getDbExecutor, query }: RuntimeRowReadHandlerDeps) => {
    // ============ GET RUNTIME TABLE ============

    const getRuntime = async (req: Request, res: Response) => {
        const { applicationId } = req.params

        const parsedQuery = runtimeQuerySchema.safeParse(req.query)
        if (!parsedQuery.success) {
            return res.status(400).json({ error: 'Invalid query', details: parsedQuery.error.flatten() })
        }

        const { limit, offset, locale } = parsedQuery.data
        const requestedLocale = normalizeLocale(locale)
        const requestedSectionId = parsedQuery.data.sectionId ?? null
        const requestedObjectCollectionId = parsedQuery.data.objectCollectionId ?? requestedSectionId ?? null
        const requestedObjectCollectionCodename = parsedQuery.data.objectCollectionCodename?.trim() || null
        const runtimeContext = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!runtimeContext) return

        const { schemaName, schemaIdent } = runtimeContext
        const manager = runtimeContext.manager

        const { objectCollections, runtimeObjects } = await loadRuntimeReadObjectCollections({ manager, schemaIdent })
        if (objectCollections.length === 0) {
            return res.status(404).json({ error: 'No objectCollections available in application runtime schema' })
        }

        const activeResult = await resolveRuntimeReadActiveObjectCollection({
            manager,
            schemaName,
            schemaIdent,
            runtimeObjects,
            requestedSectionId,
            requestedObjectCollectionId,
            requestedObjectCollectionCodename
        })
        if ('failure' in activeResult) {
            return res.status(activeResult.failure.statusCode).json(activeResult.failure.body)
        }
        const {
            activeObjectCollection,
            activeObjectCollectionKind,
            isActivePage,
            activeRecordBehavior,
            activeRecordBehaviorEnabled,
            activeWorkflowActions,
            includeRuntimeRowVersion
        } = activeResult

        const { safeComponents, physicalComponents, tableAttrs, childAttrsByTableId, allChildComponents } = await loadRuntimeReadComponents(
            {
                manager,
                schemaIdent,
                activeObjectCollection,
                isActivePage
            }
        )

        const enumOptionsMap = await loadRuntimeReadEnumOptions({
            manager,
            schemaIdent,
            requestedLocale,
            safeComponents,
            allChildComponents
        })

        const objectRefOptionsMap = await loadRuntimeReadObjectRefOptions({
            manager,
            schemaIdent,
            runtimeContext,
            requestedLocale,
            safeComponents,
            allChildComponents
        })

        const layoutResult = await resolveRuntimeReadLayout({
            manager,
            applicationId,
            runtimeContext,
            isActivePage,
            activeObjectCollection,
            requestedLocale,
            safeComponents
        })
        if ('failure' in layoutResult) {
            return res.status(layoutResult.failure.statusCode).json(layoutResult.failure.body)
        }
        const { selectedLayout, activeObjectCollectionRuntimeConfig, reorderFieldAttr } = layoutResult

        let total = 0
        let rows: Array<Record<string, unknown> & { id: string }> = []
        let canPersistRowReordering = false

        if (!isActivePage) {
            const rowsResult = await loadRuntimeReadRows({
                manager,
                schemaIdent,
                runtimeContext,
                activeObjectCollection,
                physicalComponents,
                safeComponents,
                tableAttrs,
                activeRecordBehaviorEnabled,
                includeRuntimeRowVersion,
                reorderFieldAttr,
                activeObjectCollectionRuntimeConfig,
                query: parsedQuery.data,
                requestedLocale
            })
            if ('failure' in rowsResult) {
                return res.status(rowsResult.failure.statusCode).json(rowsResult.failure.body)
            }
            total = rowsResult.total
            rows = rowsResult.rows
            canPersistRowReordering = rowsResult.canPersistRowReordering
        }

        const workspaceLimit = await loadRuntimeReadWorkspaceLimit({
            manager,
            runtimeContext,
            isActivePage,
            activeObjectCollection,
            schemaName
        })

        const {
            layoutConfig: initialLayoutConfig,
            objectCollectionsForRuntime,
            runtimeMenuTargetById,
            zoneWidgets
        } = buildRuntimeReadSections({
            runtimeObjects,
            activeObjectCollection,
            activeObjectCollectionRuntimeConfig,
            requestedLocale,
            canPersistRowReordering,
            selectedLayout
        })
        let layoutConfig = initialLayoutConfig

        const menuStructure = await loadRuntimeMenuStructure({ manager, schemaIdent, requestedLocale })
        const { menus, activeMenuId } = buildRuntimeReadMenus({
            objectCollectionsForRuntime,
            runtimeMenuTargetById,
            menuStructure,
            zoneWidgets,
            requestedLocale,
            applicationId,
            workspacesEnabled: runtimeContext.workspacesEnabled
        })

        const sideMenuWidgetConfig = zoneWidgets.left.find(
            (widget) => widget.widgetKey === 'menuWidget' && widget.config && typeof widget.config.sideMenu === 'object'
        )?.config.sideMenu
        if (sideMenuWidgetConfig && (layoutConfig.sideMenu === undefined || layoutConfig.sideMenu === null)) {
            layoutConfig = {
                ...layoutConfig,
                sideMenu: normalizeDashboardSideMenuConfig(sideMenuWidgetConfig)
            }
        }

        const columns = buildRuntimeReadColumnDefinitions({
            safeComponents,
            enumOptionsMap,
            objectRefOptionsMap,
            childAttrsByTableId,
            requestedLocale
        })

        return res.json(
            buildRuntimeReadResponsePayload({
                runtimeContext,
                activeObjectCollection,
                activeObjectCollectionKind,
                isActivePage,
                activeRecordBehavior,
                activeWorkflowActions,
                activeObjectCollectionRuntimeConfig,
                canPersistRowReordering,
                requestedLocale,
                objectCollectionsForRuntime,
                columns,
                rows,
                total,
                limit,
                offset,
                workspaceLimit,
                layoutConfig,
                zoneWidgets,
                menus,
                activeMenuId
            })
        )
    }
    return getRuntime
}
