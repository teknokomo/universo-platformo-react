import { getApplicationMenuItems, getMetahubMenuItems } from '../menuConfigs'

describe('menuConfigs', () => {
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

    it('includes entities in the metahub menu', () => {
        expect(getMetahubMenuItems('mhb-1', { canManageMetahub: true, canManageMembers: true })).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'metahub-entities',
                    titleKey: 'entities',
                    url: '/metahub/mhb-1/entities'
                })
            ])
        )
    })

    it('inserts published custom entity kinds below the legacy object items', () => {
        const menuItems = getMetahubMenuItems('mhb-1', {
            canManageMetahub: true,
            canManageMembers: true,
            publishedEntityTypes: [
                {
                    kindKey: 'custom-order',
                    title: 'Custom Order',
                    iconName: 'IconBolt',
                    sidebarSection: 'objects'
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

        const enumerationsIndex = menuItems.findIndex((item) => item.id === 'metahub-enumerations')
        const customIndex = menuItems.findIndex((item) => item.id === 'metahub-entity-custom-order')
        const publicationsIndex = menuItems.findIndex((item) => item.id === 'metahub-publications')

        expect(customIndex).toBeGreaterThan(enumerationsIndex)
        expect(customIndex).toBeLessThan(publicationsIndex)
    })

    it('hides authoring-only metahub items and compacts dividers without manage access', () => {
        const menuItems = getMetahubMenuItems('mhb-1', {
            canManageMetahub: false,
            canManageMembers: false,
            publishedEntityTypes: [
                {
                    kindKey: 'custom-order',
                    title: 'Custom Order',
                    iconName: 'IconBolt',
                    sidebarSection: 'objects'
                }
            ]
        })

        expect(menuItems.find((item) => item.id === 'metahub-branches')).toBeUndefined()
        expect(menuItems.find((item) => item.id === 'metahub-common')).toBeUndefined()
        expect(menuItems.find((item) => item.id === 'metahub-entities')).toBeUndefined()
        expect(menuItems.find((item) => item.id === 'metahub-entity-custom-order')).toBeUndefined()
        expect(menuItems.find((item) => item.id === 'metahub-publications')).toBeUndefined()
        expect(menuItems.find((item) => item.id === 'metahub-access')).toBeUndefined()
        expect(menuItems.some((item, index) => item.type === 'divider' && index > 0 && menuItems[index - 1]?.type === 'divider')).toBe(
            false
        )
        expect(menuItems[0]?.type).not.toBe('divider')
        expect(menuItems[menuItems.length - 1]?.type).not.toBe('divider')
    })
})
