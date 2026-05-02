import { ApplicationMembershipState } from '@universo/types'
import { resolvePreferredLinkedCollectionIdFromGlobalMenu } from '../../controllers/runtimeRowsController'
import {
    UpdateFailure,
    coerceRuntimeValue,
    normalizeRuntimeTableChildInsertValue,
    resolveRequestedRuntimeWorkspaceId
} from '../../shared/runtimeHelpers'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('runtimeRowsController startup catalog resolution', () => {
    it('prefers the menu startPage catalog before bound hub fallback', async () => {
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
                            items: [{ id: 'catalog', kind: 'catalog', catalogId: 'Modules' }]
                        }
                    }
                ]
            }

            if (sql.includes('FROM runtime_schema._app_objects') && sql.includes('id::text = $1')) {
                expect(params).toEqual(['Modules'])
                return [{ id: 'modules-catalog-id' }]
            }

            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await expect(
            resolvePreferredLinkedCollectionIdFromGlobalMenu({
                manager: executor,
                schemaName: 'runtime_schema',
                schemaIdent: 'runtime_schema'
            })
        ).resolves.toBe('modules-catalog-id')

        const executedSql = executor.query.mock.calls.map(([sql]) => String(sql)).join('\n')
        expect(executedSql).not.toContain("config->'hubs' @>")
    })

    it('derives startup catalog bindings from the global default or active layout only with config-aware section filtering', async () => {
        const { executor } = createMockDbExecutor()

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('information_schema.tables')) {
                return [{ layoutsExists: true, widgetsExists: true }]
            }

            if (sql.includes('FROM runtime_schema._app_layouts')) {
                expect(sql).toContain('catalog_id IS NULL')
                return [{ id: 'global-layout-1' }]
            }

            if (sql.includes('FROM runtime_schema._app_widgets')) {
                return [{ config: { bindToHub: true, boundHubId: 'hub-1' } }]
            }

            if (sql.includes("config->'hubs' @>")) {
                expect(sql).toContain("COALESCE(kind, '') NOT IN ('hub', 'set', 'enumeration')")
                expect(sql).not.toContain('custom.')
                return [{ id: 'catalog-1' }]
            }

            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await expect(
            resolvePreferredLinkedCollectionIdFromGlobalMenu({
                manager: executor,
                schemaName: 'runtime_schema',
                schemaIdent: 'runtime_schema'
            })
        ).resolves.toBe('catalog-1')

        expect(executor.query).toHaveBeenCalled()
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
