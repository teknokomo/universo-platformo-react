import { ApplicationMembershipState } from '@universo/types'
import { partitionRuntimeMenuItems, resolvePreferredScopeEntityIdFromGlobalMenu } from '../../controllers/runtimeRowsController'
import {
    UpdateFailure,
    coerceRuntimeValue,
    normalizeRuntimeTableChildInsertValue,
    resolveRequestedRuntimeWorkspaceId
} from '../../shared/runtimeHelpers'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('runtimeRowsController startup section resolution', () => {
    it('prefers the menu startPage section before bound hub fallback', async () => {
        const { executor } = createMockDbExecutor()

        executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('information_schema.tables')) {
                return [{ layoutsExists: true, widgetsExists: true }]
            }

            if (sql.includes('FROM runtime_schema._app_layouts')) {
                return [{ id: 'global-layout-1' }]
            }

            if (sql.includes('FROM runtime_schema._app_widgets')) {
                return [
                    {
                        config: {
                            bindToHub: true,
                            boundHubId: 'hub-1',
                            startPage: 'Modules',
                            items: [{ id: 'section', kind: 'section', sectionId: 'Modules' }]
                        }
                    }
                ]
            }

            if (sql.includes('FROM runtime_schema._app_objects') && sql.includes('id::text = $1')) {
                expect(params).toEqual(['Modules'])
                expect(sql).toContain("COALESCE(kind, '') NOT IN")
                expect(sql).toContain("= 'page'")
                return [{ id: 'modules-catalog-id' }]
            }

            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await expect(
            resolvePreferredScopeEntityIdFromGlobalMenu({
                manager: executor,
                schemaName: 'runtime_schema',
                schemaIdent: 'runtime_schema'
            })
        ).resolves.toBe('modules-catalog-id')

        const executedSql = executor.query.mock.calls.map(([sql]) => String(sql)).join('\n')
        expect(executedSql).not.toContain("config->'hubs' @>")
    })

    it('limits startup scope tokens to runtime-renderable catalog-like or page sections', async () => {
        const { executor } = createMockDbExecutor()

        executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('information_schema.tables')) {
                return [{ layoutsExists: true, widgetsExists: true }]
            }

            if (sql.includes('FROM runtime_schema._app_layouts')) {
                return [{ id: 'global-layout-1' }]
            }

            if (sql.includes('FROM runtime_schema._app_widgets')) {
                return [{ config: { startPage: 'CustomLanding' } }]
            }

            if (sql.includes('FROM runtime_schema._app_objects') && sql.includes('id::text = $1')) {
                expect(params).toEqual(['CustomLanding'])
                expect(sql).toContain("COALESCE(kind, '') NOT IN")
                expect(sql).toContain("= 'page'")
                return [{ id: 'custom-layout-capable-entity-id' }]
            }

            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await expect(
            resolvePreferredScopeEntityIdFromGlobalMenu({
                manager: executor,
                schemaName: 'runtime_schema',
                schemaIdent: 'runtime_schema'
            })
        ).resolves.toBe('custom-layout-capable-entity-id')
    })

    it('derives startup section bindings from the global default or active layout only with config-aware section filtering', async () => {
        const { executor } = createMockDbExecutor()

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('information_schema.tables')) {
                return [{ layoutsExists: true, widgetsExists: true }]
            }

            if (sql.includes('FROM runtime_schema._app_layouts')) {
                expect(sql).toContain('scope_entity_id IS NULL')
                return [{ id: 'global-layout-1' }]
            }

            if (sql.includes('FROM runtime_schema._app_widgets')) {
                return [{ config: { bindToHub: true, boundHubId: 'hub-1' } }]
            }

            if (sql.includes("config->'hubs' @>")) {
                expect(sql).toContain("COALESCE(kind, '') NOT IN ('hub', 'set', 'enumeration', 'page', 'ledger')")
                expect(sql).not.toContain('custom.')
                return [{ id: 'catalog-1' }]
            }

            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await expect(
            resolvePreferredScopeEntityIdFromGlobalMenu({
                manager: executor,
                schemaName: 'runtime_schema',
                schemaIdent: 'runtime_schema'
            })
        ).resolves.toBe('catalog-1')

        expect(executor.query).toHaveBeenCalled()
    })
})

describe('partitionRuntimeMenuItems', () => {
    const items = ['modules', 'knowledge', 'development', 'reports']
    const workspaceItem = 'workspaces'

    it('keeps the injected workspace item inside the primary menu limit', () => {
        const result = partitionRuntimeMenuItems(items, 3, workspaceItem, 'primary')

        expect(result.primaryItems).toEqual(['modules', 'knowledge', 'workspaces'])
        expect(result.overflowItems).toEqual(['development', 'reports'])
    })

    it('handles a primary workspace item when the limit leaves no room for regular items', () => {
        const result = partitionRuntimeMenuItems(items, 1, workspaceItem, 'primary')

        expect(result.primaryItems).toEqual(['workspaces'])
        expect(result.overflowItems).toEqual(items)
    })

    it('does not reserve primary capacity when the workspace item is in overflow or hidden', () => {
        expect(partitionRuntimeMenuItems(items, 2, workspaceItem, 'overflow')).toEqual({
            primaryItems: ['modules', 'knowledge'],
            overflowItems: ['development', 'reports', 'workspaces']
        })
        expect(partitionRuntimeMenuItems(items, 2, workspaceItem, 'hidden')).toEqual({
            primaryItems: ['modules', 'knowledge'],
            overflowItems: ['development', 'reports']
        })
    })

    it('does not mutate the source items when there is no primary limit', () => {
        const result = partitionRuntimeMenuItems(items, null, workspaceItem, 'primary')

        expect(result.primaryItems).toEqual(['modules', 'knowledge', 'development', 'reports', 'workspaces'])
        expect(result.overflowItems).toEqual([])
        expect(items).toEqual(['modules', 'knowledge', 'development', 'reports'])
    })
})

describe('normalizeRuntimeTableChildInsertValue', () => {
    it('stringifies JSON child values exactly once', () => {
        expect(normalizeRuntimeTableChildInsertValue({ ok: true }, 'JSON')).toBe('{"ok":true}')
        expect(normalizeRuntimeTableChildInsertValue('[1,2,3]', 'JSON')).toBe('[1,2,3]')
    })

    it('stringifies localized STRING child objects for json-backed VLC storage', () => {
        expect(
            normalizeRuntimeTableChildInsertValue({ _primary: 'en', locales: { en: { content: 'Hello' } } }, 'STRING', { localized: true })
        ).toBe('{"_primary":"en","locales":{"en":{"content":"Hello"}}}')
    })

    it('wraps plain strings into VLC objects before json-backed localized storage', () => {
        const coerced = coerceRuntimeValue('Hello', 'STRING', { localized: true, versioned: true })

        expect(coerced).toEqual(
            expect.objectContaining({
                _schema: '1',
                _primary: 'en',
                locales: expect.objectContaining({
                    en: expect.objectContaining({ content: 'Hello', version: 1, isActive: true })
                })
            })
        )
        expect(normalizeRuntimeTableChildInsertValue(coerced, 'STRING', { localized: true, versioned: true })).toContain(
            '"content":"Hello"'
        )
    })
})

describe('resolveRequestedRuntimeWorkspaceId', () => {
    it('prefers an allowed explicit workspace over the default workspace', () => {
        expect(
            resolveRequestedRuntimeWorkspaceId('workspace-shared', {
                membershipState: ApplicationMembershipState.JOINED,
                defaultWorkspaceId: 'workspace-personal',
                allowedWorkspaceIds: ['workspace-personal', 'workspace-shared']
            })
        ).toBe('workspace-shared')
    })

    it('falls back to the default workspace when no explicit workspace is requested', () => {
        expect(
            resolveRequestedRuntimeWorkspaceId(null, {
                membershipState: ApplicationMembershipState.JOINED,
                defaultWorkspaceId: 'workspace-personal',
                allowedWorkspaceIds: ['workspace-personal', 'workspace-shared']
            })
        ).toBe('workspace-personal')
    })

    it('rejects explicit workspaces that are not available to the current user', () => {
        expect(() =>
            resolveRequestedRuntimeWorkspaceId('workspace-foreign', {
                membershipState: ApplicationMembershipState.JOINED,
                defaultWorkspaceId: 'workspace-personal',
                allowedWorkspaceIds: ['workspace-personal', 'workspace-shared']
            })
        ).toThrow(UpdateFailure)
    })
})
