jest.mock('../../domains/layouts/marketingHeroActionIntegrityStore', () => ({
    assertMarketingHeroRecordActionsRemainValid: jest.fn(async () => undefined)
}))

jest.mock('../../domains/layouts/marketingHeroBindingsStore', () => ({
    projectMarketingHeroContentData: jest.fn(() => ({ title: { en: 'Welcome' } }))
}))

import { assertMarketingHeroRecordActionsRemainValid } from '../../domains/layouts/marketingHeroActionIntegrityStore'
import { assertMarketingHeroUpdateActionsRemainValid } from '../../domains/metahubs/services/marketingHeroUpdatePolicy'

describe('marketing Hero update action policy', () => {
    it('checks action safety for any compatible Hero Object codename', async () => {
        await assertMarketingHeroUpdateActionsRemainValid({
            db: {} as never,
            schemaName: 'mhb_test',
            objectCodename: 'CustomHeroContent',
            semanticKey: { componentCodename: 'HeroKey', creationPrefix: 'hero', protectedValues: ['default'] },
            recordData: { HeroKey: 'hero-featured' },
            normalizedRecordData: { HeroKey: 'hero-featured' }
        })

        expect(assertMarketingHeroRecordActionsRemainValid).toHaveBeenCalledWith(
            expect.anything(),
            'mhb_test',
            'HeroKey',
            'hero-featured',
            { title: { en: 'Welcome' } }
        )
    })

    it('ignores unrelated semantic-key policies', async () => {
        jest.mocked(assertMarketingHeroRecordActionsRemainValid).mockClear()
        await assertMarketingHeroUpdateActionsRemainValid({
            db: {} as never,
            schemaName: 'mhb_test',
            objectCodename: 'OtherEntity',
            semanticKey: { componentCodename: 'RecordKey', creationPrefix: 'record', protectedValues: [] },
            recordData: { RecordKey: 'record-1' },
            normalizedRecordData: { RecordKey: 'record-1' }
        })
        expect(assertMarketingHeroRecordActionsRemainValid).not.toHaveBeenCalled()
    })
})
