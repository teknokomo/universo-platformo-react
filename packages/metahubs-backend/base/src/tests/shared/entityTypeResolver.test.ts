import { MetaEntityKind } from '@universo/types'

import { EntityTypeResolver } from '../../domains/shared/entityTypeResolver'

describe('EntityTypeResolver', () => {
    it('resolves built-in entity kinds from the shared registry', async () => {
        const resolver = new EntityTypeResolver()
        const resolved = await resolver.resolve(MetaEntityKind.CATALOG)

        expect(resolved).not.toBeNull()
        expect(resolved?.kindKey).toBe(MetaEntityKind.CATALOG)
        expect(resolved?.source).toBe('builtin')
    })

    it('resolves custom kinds through the DB-backed entity type service when metahub context is provided', async () => {
        const mockEntityTypeService = {
            resolveType: jest.fn(async () => ({
                kindKey: 'custom_registry',
                source: 'custom',
                isBuiltin: false,
                components: { dataSchema: { enabled: true } },
                ui: { iconName: 'IconBolt', tabs: ['general'], sidebarSection: 'objects', nameKey: 'Custom Registry' }
            }))
        }

        const resolver = new EntityTypeResolver(mockEntityTypeService as never)
        const resolved = await resolver.resolve('custom_registry', { metahubId: 'metahub-1', userId: 'user-1' })

        expect(resolved?.kindKey).toBe('custom_registry')
        expect(resolved?.source).toBe('custom')
        expect(mockEntityTypeService.resolveType).toHaveBeenCalledWith('metahub-1', 'custom_registry', 'user-1')
    })

    it('caches repeated custom-kind lookups within the same resolver instance', async () => {
        const mockEntityTypeService = {
            resolveType: jest.fn(async () => ({
                kindKey: 'custom_registry',
                source: 'custom',
                isBuiltin: false,
                components: { actions: { enabled: true } },
                ui: { iconName: 'IconBolt', tabs: ['general'], sidebarSection: 'objects', nameKey: 'Custom Registry' }
            }))
        }

        const resolver = new EntityTypeResolver(mockEntityTypeService as never)

        await resolver.resolve('custom_registry', { metahubId: 'metahub-1', userId: 'user-1' })
        await resolver.resolve('custom_registry', { metahubId: 'metahub-1', userId: 'user-1' })

        expect(mockEntityTypeService.resolveType).toHaveBeenCalledTimes(1)
    })

    it('returns null for unknown kinds without metahub DB context', async () => {
        const resolver = new EntityTypeResolver()

        await expect(resolver.resolve('custom_registry')).resolves.toBeNull()
    })

    it('checks component enablement against the resolved entity definition', async () => {
        const resolver = new EntityTypeResolver()

        await expect(resolver.isComponentEnabled(MetaEntityKind.CATALOG, 'dataSchema')).resolves.toBe(true)
        await expect(resolver.isComponentEnabled(MetaEntityKind.HUB, 'dataSchema')).resolves.toBe(false)
    })
})
