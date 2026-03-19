import { getApplicationMenuItems } from '../menuConfigs'

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
})
