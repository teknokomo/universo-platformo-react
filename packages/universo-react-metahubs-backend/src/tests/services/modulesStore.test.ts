import { insertStoredMetahubModule } from '../../domains/modules/services/modulesStore'

describe('modulesStore', () => {
    it('uses distinct bind parameters for storage-aware module insert metadata fields', async () => {
        const storedRow = {
            id: 'module-1',
            codename: {},
            presentation: {},
            attached_to_kind: 'general',
            attached_to_id: null,
            module_role: 'library',
            source_kind: 'embedded',
            sdk_api_version: '1.0.0',
            source_code: null,
            storage_mode: 'file',
            source_path: 'modules/general/shared.ts',
            source_checksum: 'source-checksum',
            manifest: {},
            server_bundle: null,
            client_bundle: null,
            checksum: 'compiled-checksum',
            is_active: true,
            config: { test: true },
            _upl_version: 1
        }
        const executor = {
            query: jest
                .fn()
                .mockResolvedValueOnce([{ available: true }])
                .mockResolvedValueOnce([storedRow])
        }

        await expect(
            insertStoredMetahubModule(executor, 'mhb_1234567890abcdef1234567890abcdef', {
                codename: { _primary: 'en', locales: { en: { content: 'shared' } } },
                presentation: { name: { _primary: 'en', locales: { en: { content: 'Shared' } } } },
                attachedToKind: 'general',
                attachedToId: null,
                moduleRole: 'library',
                sourceKind: 'embedded',
                sdkApiVersion: '1.0.0',
                sourceCode: null,
                storageMode: 'file',
                sourcePath: 'modules/general/shared.ts',
                sourceChecksum: 'source-checksum',
                sourceLastReadAt: new Date('2026-06-01T12:00:00.000Z'),
                sourceLastCompileAt: new Date('2026-06-01T12:01:00.000Z'),
                sourceLastCompileStatus: 'success',
                sourceLastCompileMessageCode: null,
                manifest: { className: 'Shared' },
                serverBundle: null,
                clientBundle: 'module.exports = class Shared {}',
                checksum: 'compiled-checksum',
                isActive: true,
                config: { test: true },
                userId: 'user-1'
            })
        ).resolves.toEqual(storedRow)

        const insertCall = executor.query.mock.calls[1]
        expect(insertCall[0]).toContain('$16, $17, $18, $19, $20, $21, $22, $23, $22, $23')
        expect(insertCall[1]).toHaveLength(23)
        expect(insertCall[1][20]).toBe(JSON.stringify({ test: true }))
        expect(insertCall[1][21]).toBeInstanceOf(Date)
        expect(insertCall[1][22]).toBe('user-1')
    })
})
