import { hashApplicationLayoutContent } from '../../utils/applicationLayoutHash'

describe('application layout content hash', () => {
    const layout = {
        scopeEntityId: null,
        templateKey: 'dashboard',
        name: { en: 'Main' },
        description: null,
        config: { showHeader: true },
        isActive: true,
        isDefault: true,
        sortOrder: 0
    }

    it('is stable when widget input order changes', () => {
        const first = hashApplicationLayoutContent({
            layout,
            widgets: [
                { zone: 'right', widgetKey: 'detailsTable', sortOrder: 2, config: {}, isActive: true },
                { zone: 'left', widgetKey: 'menuWidget', sortOrder: 1, config: {}, isActive: true }
            ]
        })
        const second = hashApplicationLayoutContent({
            layout,
            widgets: [
                { zone: 'left', widgetKey: 'menuWidget', sortOrder: 1, config: {}, isActive: true },
                { zone: 'right', widgetKey: 'detailsTable', sortOrder: 2, config: {}, isActive: true }
            ]
        })

        expect(second).toBe(first)
    })

    it('changes when widget activation changes', () => {
        const active = hashApplicationLayoutContent({
            layout,
            widgets: [{ zone: 'left', widgetKey: 'menuWidget', sortOrder: 1, config: {}, isActive: true }]
        })
        const inactive = hashApplicationLayoutContent({
            layout,
            widgets: [{ zone: 'left', widgetKey: 'menuWidget', sortOrder: 1, config: {}, isActive: false }]
        })

        expect(inactive).not.toBe(active)
    })
})
