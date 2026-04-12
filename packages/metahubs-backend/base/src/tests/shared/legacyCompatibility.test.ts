import {
    resolveRequestedLegacyCompatibleKind,
    resolveRequestedLegacyCompatibleKinds
} from '../../domains/shared/legacyCompatibility'

describe('legacyCompatibility', () => {
    it('keeps legacy rows visible on V2 list scopes after validating the requested compatible kind', async () => {
        const entityTypeService = {
            listCustomTypes: jest.fn(async () => [
                {
                    kindKey: 'custom.enumeration-v2',
                    config: { compatibility: { legacyObjectKind: 'enumeration' } }
                },
                {
                    kindKey: 'custom.enumeration-v2-secondary',
                    config: { compatibility: { legacyObjectKind: 'enumeration' } }
                },
                {
                    kindKey: 'custom.set-v2',
                    config: { compatibility: { legacyObjectKind: 'set' } }
                }
            ]),
            resolveType: jest.fn(async (_metahubId: string, kindKey: string) => {
                if (kindKey === 'custom.enumeration-v2') {
                    return {
                        kindKey,
                        source: 'custom' as const,
                        config: { compatibility: { legacyObjectKind: 'enumeration' } }
                    }
                }

                return null
            })
        }

        await expect(
            resolveRequestedLegacyCompatibleKind(entityTypeService as never, 'metahub-1', 'enumeration', 'custom.enumeration-v2', 'user-1')
        ).resolves.toBe('custom.enumeration-v2')

        await expect(
            resolveRequestedLegacyCompatibleKinds(entityTypeService as never, 'metahub-1', 'enumeration', 'custom.enumeration-v2', 'user-1')
        ).resolves.toEqual(['enumeration', 'custom.enumeration-v2', 'custom.enumeration-v2-secondary'])
    })

    it('rejects incompatible requested kind keys before widening the legacy-compatible list scope', async () => {
        const entityTypeService = {
            listCustomTypes: jest.fn(async () => []),
            resolveType: jest.fn(async () => ({
                kindKey: 'custom.set-v2',
                source: 'custom' as const,
                config: { compatibility: { legacyObjectKind: 'set' } }
            }))
        }

        await expect(
            resolveRequestedLegacyCompatibleKinds(entityTypeService as never, 'metahub-1', 'enumeration', 'custom.set-v2', 'user-1')
        ).rejects.toThrow('Requested kindKey is not compatible with the expected legacy surface')
    })
})