import { createMockDbExecutor } from '../utils/dbMocks'
import {
    interpretationNetworkEnsureSystemStructureRequestSchema,
    interpretationNetworkMaterialAssociationsQuerySchema,
    interpretationNetworkTemplateInstantiateRequestSchema,
    interpretationNetworkTemplateSaveRequestSchema,
    listMaterialAssociationsForInterpretation,
    resolveInterpretationNetworkRuntimeSurface
} from '../../services/interpretationNetwork/runtimeInterpretationNetworkService'
import { asSurface, makeCtx, schemaName, vlcText, workspaceId } from '../utils/interpretationNetworkRuntimeFixtures'

describe('runtimeInterpretationNetworkService surface resolution', () => {
    it('rejects extra keys in strict command schemas', () => {
        expect(interpretationNetworkEnsureSystemStructureRequestSchema.safeParse({ extra: true }).success).toBe(false)
        expect(
            interpretationNetworkTemplateSaveRequestSchema.safeParse({
                sourceStructureId: '019f2000-0000-7000-8000-000000000001',
                templateName: vlcText('Template'),
                scope: { kind: 'wholeStructure' },
                includeMaterials: false,
                extra: true
            }).success
        ).toBe(false)
        expect(
            interpretationNetworkTemplateInstantiateRequestSchema.safeParse({
                structureName: vlcText('From template'),
                expectedVersion: 1,
                extra: true
            }).success
        ).toBe(false)
    })

    it('reads only active cell-to-material pairs for the requested workspace and page', async () => {
        const { executor } = createMockDbExecutor()
        const interpretationId = '019f2000-0000-7000-8000-000000000501'
        const cellId = '019f2000-0000-7000-8000-000000000502'
        const materialId = '019f2000-0000-7000-8000-000000000503'
        const surface = asSurface('multiple')
        executor.query.mockResolvedValueOnce([{ id: interpretationId }]).mockResolvedValueOnce([{ cellId, materialId }])

        const query = interpretationNetworkMaterialAssociationsQuerySchema.parse({
            interpretationId,
            limit: '1',
            offset: '4'
        })
        const result = await listMaterialAssociationsForInterpretation(makeCtx(executor), surface, query)

        expect(result).toEqual({
            items: [{ cellId, materialId }],
            page: { offset: 4, limit: 1, hasMore: false }
        })
        const [parentSql, parentParams] = executor.query.mock.calls[0] as [string, unknown[]]
        expect(parentSql).toContain(`FROM "${schemaName}"."interpretation"`)
        expect(parentParams).toEqual([interpretationId, workspaceId])
        const [associationSql, associationParams] = executor.query.mock.calls[1] as [string, unknown[]]
        expect(associationSql).toContain(`FROM "${schemaName}"."interpretation_rows" AS matrix`)
        expect(associationSql).toContain(`JOIN "${schemaName}"."material" AS material`)
        expect(associationSql).toContain('"matrix"."_upl_deleted" = false')
        expect(associationSql).toContain('"material"."_upl_deleted" = false')
        expect(associationParams).toEqual([interpretationId, workspaceId, workspaceId, 2, 4])
    })

    it('rejects material association queries with non-v7 identifiers or excessive offsets', () => {
        expect(
            interpretationNetworkMaterialAssociationsQuerySchema.safeParse({
                interpretationId: '00000000-0000-0000-0000-000000000001'
            }).success
        ).toBe(false)
        expect(
            interpretationNetworkMaterialAssociationsQuerySchema.safeParse({
                interpretationId: '019f2000-0000-7000-8000-000000000501',
                offset: 100_001
            }).success
        ).toBe(false)
    })

    it('returns missing-shared-contract when structureMode is absent', async () => {
        const { executor } = createMockDbExecutor()

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes(`FROM "${schemaName}"."_app_widgets"`)) {
                return [
                    {
                        id: 'widget-1',
                        layout_id: 'layout-1',
                        widget_key: 'interpretationNetworkWorkspace',
                        config: {}
                    }
                ]
            }
            return []
        })

        const surface = await resolveInterpretationNetworkRuntimeSurface(executor, {
            applicationId: 'app-1',
            schemaName,
            workspaceId
        })

        expect(surface.featureState).toBe('missing-metadata')
        expect(surface.structureMode).toBe('multiple')
    })

    it('returns missing-widget when the interpretation network widget is absent', async () => {
        const { executor } = createMockDbExecutor()

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes(`FROM "${schemaName}"."_app_widgets"`)) {
                return []
            }
            return []
        })

        const surface = await resolveInterpretationNetworkRuntimeSurface(executor, {
            applicationId: 'app-1',
            schemaName,
            workspaceId
        })

        expect(surface.featureState).toBe('missing-widget')
        expect(surface.missing).toEqual(['interpretationNetworkWorkspace'])
    })

    it('locks the active widget and layout rows when resolving a mutation surface', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValueOnce([])

        await resolveInterpretationNetworkRuntimeSurface(executor, {
            applicationId: 'app-1',
            schemaName,
            workspaceId,
            lockRuntimePlacement: true
        })

        expect(executor.query.mock.calls[0]?.[0]).toContain('FOR SHARE OF widget, layout')
    })

    it('resolves an explicitly selected scoped widget without comparing its scope to the workspace ID', async () => {
        const { executor } = createMockDbExecutor()
        const layoutId = '019f2000-0000-7000-8000-000000000030'
        const widgetId = '019f2000-0000-7000-8000-000000000031'
        executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes(`FROM "${schemaName}"."_app_widgets"`)) {
                expect(sql).toContain('layout.scope_entity_id = $2')
                expect(params).toEqual(['interpretationNetworkWorkspace', null, layoutId, widgetId])
                return [
                    {
                        id: widgetId,
                        layout_id: layoutId,
                        widget_key: 'interpretationNetworkWorkspace',
                        config: { structureMode: 'multiple' }
                    }
                ]
            }
            return []
        })

        const surface = await resolveInterpretationNetworkRuntimeSurface(executor, {
            applicationId: 'app-1',
            schemaName,
            workspaceId,
            layoutId,
            widgetId
        })

        expect(surface.featureState).toBe('missing-metadata')
        expect(surface.layoutId).toBe(layoutId)
        expect(surface.widgetId).toBe(widgetId)
    })

    it('fails closed for multiple active widgets unless the runtime identity scopes the surface', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes(`FROM "${schemaName}"."_app_widgets"`)) {
                expect(params).toEqual(['interpretationNetworkWorkspace', null, null, null])
                return [
                    {
                        id: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                        layout_id: '018f8a78-7b8f-7c1d-a111-2222333345a1',
                        widget_key: 'interpretationNetworkWorkspace',
                        config: { structureMode: 'singleSystem' }
                    },
                    {
                        id: '018f8a78-7b8f-7c1d-a111-2222333344a2',
                        layout_id: '018f8a78-7b8f-7c1d-a111-2222333345a2',
                        widget_key: 'interpretationNetworkWorkspace',
                        config: { structureMode: 'multiple' }
                    }
                ]
            }
            return []
        })

        const surface = await resolveInterpretationNetworkRuntimeSurface(executor, {
            applicationId: 'app-1',
            schemaName,
            workspaceId
        })

        expect(surface.featureState).toBe('ambiguous-widget')
        expect(surface.widgetId).toBeNull()
    })

    it('uses the entity scope independently from the workspace ID', async () => {
        const { executor } = createMockDbExecutor()
        const scopeEntityId = '019f2000-0000-7000-8000-000000000020'
        expect(scopeEntityId).not.toBe(workspaceId)
        executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes(`FROM "${schemaName}"."_app_widgets"`)) {
                expect(sql).toContain('layout.scope_entity_id IS NULL')
                expect(sql).toContain('layout.scope_entity_id = $2')
                expect(sql).not.toContain("widget.config->>'workspaceId'")
                expect(params).toEqual(['interpretationNetworkWorkspace', scopeEntityId, null, null])
                return [
                    {
                        id: 'widget-current-workspace',
                        layout_id: 'layout-current-workspace',
                        widget_key: 'interpretationNetworkWorkspace',
                        config: { structureMode: 'singleSystem' }
                    }
                ]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                return [
                    { id: 'structure-1', codename: 'Structure', table_name: 'structure' },
                    { id: 'interpretation-1', codename: 'Interpretation', table_name: 'interpretation' },
                    { id: 'material-1', codename: 'Material', table_name: 'material' },
                    { id: 'table-template-1', codename: 'TableTemplate', table_name: 'table_template' },
                    { id: 'favorite-1', codename: 'Favorite', table_name: 'favorite' }
                ]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                const objectId = params?.[0]
                if (objectId === 'structure-1') {
                    return [
                        { codename: 'Name', column_name: 'name', data_type: 'STRING' },
                        { codename: 'SystemKey', column_name: 'system_key', data_type: 'STRING' }
                    ]
                }
                if (objectId === 'interpretation-1') {
                    return [
                        { id: 'interpretation-title', codename: 'Title', column_name: 'title', data_type: 'STRING' },
                        { id: 'interpretation-parent', codename: 'ParentStructure', column_name: 'parent_structure', data_type: 'REF' },
                        {
                            id: 'interpretation-matrix',
                            codename: 'InterpretationMatrix',
                            column_name: 'interpretation_matrix',
                            data_type: 'TABLE'
                        },
                        {
                            id: 'interpretation-cell-id',
                            codename: 'CellId',
                            column_name: 'cell_id',
                            data_type: 'STRING',
                            parent_component_id: 'interpretation-matrix'
                        },
                        {
                            id: 'interpretation-material-ref',
                            codename: 'MaterialRef',
                            column_name: 'material_ref',
                            data_type: 'REF',
                            parent_component_id: 'interpretation-matrix'
                        }
                    ]
                }
                if (objectId === 'material-1') {
                    return [
                        { codename: 'CellId', column_name: 'cell_id', data_type: 'STRING' },
                        { codename: 'InterpretationId', column_name: 'interpretation_id', data_type: 'STRING' },
                        { codename: 'TemplateOwnerId', column_name: 'template_owner_id', data_type: 'STRING' }
                    ]
                }
                if (objectId === 'table-template-1') {
                    return [
                        { id: 'template-name', codename: 'Name', column_name: 'name', data_type: 'STRING' },
                        { id: 'template-policy', codename: 'MaterialPolicy', column_name: 'material_policy', data_type: 'STRING' },
                        { id: 'template-matrix', codename: 'TemplateMatrix', column_name: 'template_matrix', data_type: 'TABLE' },
                        {
                            id: 'template-cell-id',
                            codename: 'CellId',
                            column_name: 'cell_id',
                            data_type: 'STRING',
                            parent_component_id: 'template-matrix'
                        },
                        {
                            id: 'template-material-ref',
                            codename: 'MaterialRef',
                            column_name: 'material_ref',
                            data_type: 'REF',
                            parent_component_id: 'template-matrix'
                        }
                    ]
                }
            }
            return []
        })

        const surface = await resolveInterpretationNetworkRuntimeSurface(executor, {
            applicationId: 'app-1',
            schemaName,
            workspaceId,
            scopeEntityId
        })

        expect(surface.featureState).toBe('ready')
        expect(surface.layoutId).toBe('layout-current-workspace')
        expect(surface.widgetId).toBe('widget-current-workspace')
    })

    it('prefers an entity-scoped widget over a global Interpretation Network widget', async () => {
        const { executor } = createMockDbExecutor()
        const scopeEntityId = '019f2000-0000-7000-8000-000000000021'
        executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes(`FROM "${schemaName}"."_app_widgets"`)) {
                expect(sql).toContain('CASE WHEN layout.scope_entity_id = $2 THEN 0 ELSE 1 END AS scope_rank')
                expect(sql).toContain('ORDER BY scope_rank ASC')
                expect(params).toEqual(['interpretationNetworkWorkspace', scopeEntityId, null, null])
                return [
                    {
                        id: 'widget-current-workspace',
                        layout_id: 'layout-current-workspace',
                        widget_key: 'interpretationNetworkWorkspace',
                        config: { structureMode: 'multiple' },
                        scope_rank: 0
                    },
                    {
                        id: 'widget-global',
                        layout_id: 'layout-global',
                        widget_key: 'interpretationNetworkWorkspace',
                        config: { structureMode: 'singleSystem' },
                        scope_rank: 1
                    }
                ]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                return [
                    { id: 'structure-1', codename: 'Structure', table_name: 'structure' },
                    { id: 'interpretation-1', codename: 'Interpretation', table_name: 'interpretation' },
                    { id: 'material-1', codename: 'Material', table_name: 'material' },
                    { id: 'table-template-1', codename: 'TableTemplate', table_name: 'table_template' },
                    { id: 'favorite-1', codename: 'Favorite', table_name: 'favorite' }
                ]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                const objectId = params?.[0]
                if (objectId === 'structure-1') {
                    return [
                        { codename: 'Name', column_name: 'name', data_type: 'STRING' },
                        { codename: 'SystemKey', column_name: 'system_key', data_type: 'STRING' }
                    ]
                }
                if (objectId === 'interpretation-1') {
                    return [
                        { id: 'interpretation-title', codename: 'Title', column_name: 'title', data_type: 'STRING' },
                        { id: 'interpretation-parent', codename: 'ParentStructure', column_name: 'parent_structure', data_type: 'REF' },
                        {
                            id: 'interpretation-matrix',
                            codename: 'InterpretationMatrix',
                            column_name: 'interpretation_matrix',
                            data_type: 'TABLE'
                        },
                        {
                            id: 'interpretation-cell-id',
                            codename: 'CellId',
                            column_name: 'cell_id',
                            data_type: 'STRING',
                            parent_component_id: 'interpretation-matrix'
                        },
                        {
                            id: 'interpretation-material-ref',
                            codename: 'MaterialRef',
                            column_name: 'material_ref',
                            data_type: 'REF',
                            parent_component_id: 'interpretation-matrix'
                        }
                    ]
                }
                if (objectId === 'material-1') {
                    return [
                        { codename: 'CellId', column_name: 'cell_id', data_type: 'STRING' },
                        { codename: 'InterpretationId', column_name: 'interpretation_id', data_type: 'STRING' },
                        { codename: 'TemplateOwnerId', column_name: 'template_owner_id', data_type: 'STRING' }
                    ]
                }
                if (objectId === 'table-template-1') {
                    return [
                        { id: 'template-name', codename: 'Name', column_name: 'name', data_type: 'STRING' },
                        { id: 'template-policy', codename: 'MaterialPolicy', column_name: 'material_policy', data_type: 'STRING' },
                        { id: 'template-matrix', codename: 'TemplateMatrix', column_name: 'template_matrix', data_type: 'TABLE' },
                        {
                            id: 'template-cell-id',
                            codename: 'CellId',
                            column_name: 'cell_id',
                            data_type: 'STRING',
                            parent_component_id: 'template-matrix'
                        },
                        {
                            id: 'template-material-ref',
                            codename: 'MaterialRef',
                            column_name: 'material_ref',
                            data_type: 'REF',
                            parent_component_id: 'template-matrix'
                        }
                    ]
                }
            }
            return []
        })

        const surface = await resolveInterpretationNetworkRuntimeSurface(executor, {
            applicationId: 'app-1',
            schemaName,
            workspaceId,
            scopeEntityId
        })

        expect(surface.featureState).toBe('ready')
        expect(surface.structureMode).toBe('multiple')
        expect(surface.layoutId).toBe('layout-current-workspace')
        expect(surface.widgetId).toBe('widget-current-workspace')
    })

    it('fails closed when two widgets have the same effective entity scope', async () => {
        const { executor } = createMockDbExecutor()
        const scopeEntityId = '019f2000-0000-7000-8000-000000000022'
        executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes(`FROM "${schemaName}"."_app_widgets"`)) {
                expect(params).toEqual(['interpretationNetworkWorkspace', scopeEntityId, null, null])
                return [
                    {
                        id: 'widget-current-workspace-a',
                        layout_id: 'layout-current-workspace-a',
                        widget_key: 'interpretationNetworkWorkspace',
                        config: { structureMode: 'singleSystem' },
                        scope_rank: 0
                    },
                    {
                        id: 'widget-current-workspace-b',
                        layout_id: 'layout-current-workspace-b',
                        widget_key: 'interpretationNetworkWorkspace',
                        config: { structureMode: 'multiple' },
                        scope_rank: 0
                    }
                ]
            }
            return []
        })

        const surface = await resolveInterpretationNetworkRuntimeSurface(executor, {
            applicationId: 'app-1',
            schemaName,
            workspaceId,
            scopeEntityId
        })

        expect(surface.featureState).toBe('ambiguous-widget')
        expect(surface.layoutId).toBeNull()
        expect(surface.widgetId).toBeNull()
        expect(surface.missing).toEqual(['interpretationNetworkWorkspace:ambiguous'])
    })

    it('resolves ready surface only when the required metadata is present', async () => {
        const { executor } = createMockDbExecutor()
        let includeFavorite = true

        executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes(`FROM "${schemaName}"."_app_widgets"`)) {
                return [
                    {
                        id: 'widget-1',
                        layout_id: 'layout-1',
                        widget_key: 'interpretationNetworkWorkspace',
                        config: { structureMode: 'singleSystem' }
                    }
                ]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                return [
                    { id: 'structure-1', codename: 'Structure', table_name: 'structure' },
                    { id: 'interpretation-1', codename: 'Interpretation', table_name: 'interpretation' },
                    { id: 'material-1', codename: 'Material', table_name: 'material' },
                    { id: 'table-template-1', codename: 'TableTemplate', table_name: 'table_template' },
                    ...(includeFavorite ? [{ id: 'favorite-1', codename: 'Favorite', table_name: 'favorite' }] : [])
                ]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                const objectId = params?.[0]
                if (objectId === 'structure-1') {
                    return [
                        { codename: 'Name', column_name: 'name', data_type: 'STRING' },
                        { codename: 'Description', column_name: 'description', data_type: 'STRING' },
                        { codename: 'SystemKey', column_name: 'system_key', data_type: 'STRING' }
                    ]
                }
                if (objectId === 'interpretation-1') {
                    return [
                        { id: 'interpretation-title', codename: 'Title', column_name: 'title', data_type: 'STRING' },
                        { id: 'interpretation-parent', codename: 'ParentStructure', column_name: 'parent_structure', data_type: 'REF' },
                        {
                            id: 'interpretation-matrix',
                            codename: 'InterpretationMatrix',
                            column_name: 'interpretation_matrix',
                            data_type: 'TABLE'
                        },
                        {
                            id: 'interpretation-cell-id',
                            codename: 'CellId',
                            column_name: 'cell_id',
                            data_type: 'STRING',
                            parent_component_id: 'interpretation-matrix'
                        },
                        {
                            id: 'interpretation-material-ref',
                            codename: 'MaterialRef',
                            column_name: 'material_ref',
                            data_type: 'REF',
                            parent_component_id: 'interpretation-matrix'
                        }
                    ]
                }
                if (objectId === 'material-1') {
                    return [
                        { codename: 'Title', column_name: 'title', data_type: 'STRING' },
                        { codename: 'Description', column_name: 'description', data_type: 'STRING' },
                        { codename: 'Body', column_name: 'body', data_type: 'JSON' },
                        { codename: 'CellId', column_name: 'cell_id', data_type: 'STRING' },
                        { codename: 'InterpretationId', column_name: 'interpretation_id', data_type: 'STRING' },
                        { codename: 'TemplateOwnerId', column_name: 'template_owner_id', data_type: 'STRING' }
                    ]
                }
                if (objectId === 'table-template-1') {
                    return [
                        { id: 'template-name', codename: 'Name', column_name: 'name', data_type: 'STRING' },
                        { id: 'template-policy', codename: 'MaterialPolicy', column_name: 'material_policy', data_type: 'STRING' },
                        { id: 'template-matrix', codename: 'TemplateMatrix', column_name: 'template_matrix', data_type: 'TABLE' },
                        {
                            id: 'template-cell-id',
                            codename: 'CellId',
                            column_name: 'cell_id',
                            data_type: 'STRING',
                            parent_component_id: 'template-matrix'
                        },
                        {
                            id: 'template-material-ref',
                            codename: 'MaterialRef',
                            column_name: 'material_ref',
                            data_type: 'REF',
                            parent_component_id: 'template-matrix'
                        }
                    ]
                }
            }
            return []
        })

        const surface = await resolveInterpretationNetworkRuntimeSurface(executor, {
            applicationId: 'app-1',
            schemaName,
            workspaceId
        })

        expect(surface.featureState).toBe('ready')
        expect(surface.structureMode).toBe('singleSystem')
        expect(surface.missing).toEqual([])
        expect(surface.resolvedObjects).toEqual({
            Structure: 'structure-1',
            Interpretation: 'interpretation-1',
            Material: 'material-1',
            TableTemplate: 'table-template-1'
        })

        includeFavorite = false
        const surfaceWithoutFavorites = await resolveInterpretationNetworkRuntimeSurface(executor, {
            applicationId: 'app-1',
            schemaName,
            workspaceId
        })
        expect(surfaceWithoutFavorites.featureState).toBe('missing-metadata')
        expect(surfaceWithoutFavorites.missing).toEqual(['Favorite'])
    })
})
