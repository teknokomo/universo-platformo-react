import {
    getPlatformSystemComponentMutationBlockReason,
    readPlatformSystemComponentsPolicy,
    resolveObjectSystemComponentSeedPlan,
    shouldExposeObjectSystemComponent
} from '../../domains/shared/platformSystemComponentsPolicy'

describe('platformSystemComponentsPolicy', () => {
    it('reads the global platform policy from admin settings rows', async () => {
        const exec = {
            query: jest.fn(async () => [
                { key: 'platformSystemComponentsConfigurable', value: { _value: true } },
                { key: 'platformSystemComponentsRequired', value: { _value: false } },
                { key: 'platformSystemComponentsIgnoreMetahubSettings', value: { _value: false } }
            ])
        }

        const policy = await readPlatformSystemComponentsPolicy(exec)

        expect(policy).toEqual({
            allowConfiguration: true,
            forceCreate: false,
            ignoreMetahubSettings: false
        })
    })

    it('forces platform rows back to canonical defaults when ignoreMetahubSettings is enabled', () => {
        const plan = resolveObjectSystemComponentSeedPlan([{ key: 'upl.deleted', enabled: false }], {
            allowConfiguration: false,
            forceCreate: true,
            ignoreMetahubSettings: true
        })

        expect(plan.allowedKeys.has('upl.deleted')).toBe(true)
        expect(plan.forceStateKeys).toContain('upl.deleted')
        expect(plan.states).toEqual(expect.arrayContaining([{ key: 'upl.deleted', enabled: true }]))
    })

    it('keeps platform rows hidden from the System view when configuration is disabled', () => {
        expect(
            shouldExposeObjectSystemComponent('upl.deleted', {
                allowConfiguration: false,
                forceCreate: true,
                ignoreMetahubSettings: true
            })
        ).toBe(false)

        expect(
            shouldExposeObjectSystemComponent('app.deleted', {
                allowConfiguration: false,
                forceCreate: true,
                ignoreMetahubSettings: true
            })
        ).toBe(true)
    })

    it('allows platform-row mutations when configuration is enabled even if seed defaults ignore metahub settings', () => {
        expect(
            getPlatformSystemComponentMutationBlockReason('upl.deleted', {
                allowConfiguration: true,
                forceCreate: true,
                ignoreMetahubSettings: true
            })
        ).toBeNull()
    })
})
