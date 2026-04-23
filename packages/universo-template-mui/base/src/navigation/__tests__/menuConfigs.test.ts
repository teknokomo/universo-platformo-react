import { getApplicationMenuItems, getMetahubMenuItems } from '../menuConfigs'

describe('menuConfigs', () => {
    it('includes layouts in the application admin menu', () => {
        expect(getApplicationMenuItems('app-1')).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'application-layouts',
                    titleKey: 'layouts',
                    url: '/a/app-1/admin/layouts'
                })
            ])
        )
    })

    it('includes settings in the application admin menu', () => {
        expect(getApplicationMenuItems('app-1')).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'application-settings',
                    titleKey: 'settings',
                    url: '/a/app-1/admin/settings'
                })
            ])
        )
    })

    it('includes entity types in the metahub menu', () => {
        expect(getMetahubMenuItems('mhb-1', { canManageMetahub: true, canManageMembers: true })).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'metahub-entities',
                    titleKey: 'entityTypes',
                    url: '/metahub/mhb-1/entities'
                })
            ])
        )
    })

    it('inserts published custom entity kinds below the legacy object items', () => {
        const menuItems = getMetahubMenuItems('mhb-1', {
            canManageMetahub: true,
            canManageMembers: true,
            menuEntityTypes: [
                {
                    kindKey: 'catalog',
                    title: 'Catalogs',
                    iconName: 'IconDatabase',
                    sidebarSection: 'objects',
                    sidebarOrder: 20
                },
                {
                    kindKey: 'custom-order',
                    title: 'Custom Order',
                    iconName: 'IconBolt',
                    sidebarSection: 'objects',
                    sidebarOrder: 20
                }
            ]
        })

        expect(menuItems).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'metahub-entity-custom-order',
                    title: 'Custom Order',
                    url: '/metahub/mhb-1/entities/custom-order/instances'
                })
            ])
        )

        const catalogsIndex = menuItems.findIndex((item) => item.id === 'metahub-entity-catalog')
        const customIndex = menuItems.findIndex((item) => item.id === 'metahub-entity-custom-order')
        const publicationsIndex = menuItems.findIndex((item) => item.id === 'metahub-publications')

        expect(customIndex).toBeGreaterThan(catalogsIndex)
        expect(customIndex).toBeLessThan(publicationsIndex)
    })

    it('sorts published custom entity kinds by explicit sidebar order before fallback title ordering', () => {
        const menuItems = getMetahubMenuItems('mhb-1', {
            canManageMetahub: true,
            canManageMembers: true,
            menuEntityTypes: [
                {
                    kindKey: 'custom-zeta',
                    title: 'Zeta',
                    iconName: 'IconBolt',
                    sidebarSection: 'objects',
                    sidebarOrder: 40
                },
                {
                    kindKey: 'custom-alpha',
                    title: 'Alpha',
                    iconName: 'IconBolt',
                    sidebarSection: 'objects',
                    sidebarOrder: 10
                },
                {
                    kindKey: 'custom-beta',
                    title: 'Beta',
                    iconName: 'IconBolt',
                    sidebarSection: 'objects',
                    sidebarOrder: 20
                }
            ]
        })

        const dynamicItemIds = menuItems
            .filter((item) => item.type !== 'divider' && item.id.startsWith('metahub-entity-'))
            .map((item) => item.id)

        expect(dynamicItemIds).toEqual(['metahub-entity-custom-alpha', 'metahub-entity-custom-beta', 'metahub-entity-custom-zeta'])
    })

    it('hides authoring-only metahub items and compacts dividers without manage access', () => {
        const menuItems = getMetahubMenuItems('mhb-1', {
            canManageMetahub: false,
            canManageMembers: false,
            menuEntityTypes: [
                {
                    kindKey: 'catalog',
                    title: 'Catalogs',
                    iconName: 'IconDatabase',
                    sidebarSection: 'objects',
                    sidebarOrder: 20
                },
                {
                    kindKey: 'custom-order',
                    title: 'Custom Order',
                    iconName: 'IconBolt',
                    sidebarSection: 'objects',
                    sidebarOrder: 20
                }
            ]
        })

        expect(menuItems.find((item) => item.id === 'metahub-branches')).toBeUndefined()
        expect(menuItems.find((item) => item.id === 'metahub-common')).toBeUndefined()
        expect(menuItems.find((item) => item.id === 'metahub-entities')).toBeUndefined()
        expect(menuItems.find((item) => item.id === 'metahub-entity-catalog')).toBeDefined()
        expect(menuItems.find((item) => item.id === 'metahub-entity-custom-order')).toBeDefined()
        expect(menuItems.find((item) => item.id === 'metahub-publications')).toBeUndefined()
        expect(menuItems.find((item) => item.id === 'metahub-access')).toBeUndefined()
        expect(menuItems.some((item, index) => item.type === 'divider' && index > 0 && menuItems[index - 1]?.type === 'divider')).toBe(
            false
        )
        expect(menuItems[0]?.type).not.toBe('divider')
        expect(menuItems[menuItems.length - 1]?.type).not.toBe('divider')
    })
})
