import { ApplicationMembershipState } from '@universo/types'
import {
    normalizeRuntimeTableChildInsertValue,
    resolvePreferredLinkedCollectionIdFromGlobalMenu
} from '../../controllers/runtimeRowsController'
import { UpdateFailure, resolveRequestedRuntimeWorkspaceId } from '../../shared/runtimeHelpers'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('runtimeRowsController startup catalog resolution', () => {
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
