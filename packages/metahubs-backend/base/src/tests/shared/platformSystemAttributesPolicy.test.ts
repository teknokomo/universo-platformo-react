import {
    getPlatformSystemAttributeMutationBlockReason,
    readPlatformSystemAttributesPolicy,
    resolveCatalogSystemAttributeSeedPlan,
    shouldExposeCatalogSystemField
} from '../../domains/shared/platformSystemAttributesPolicy'

describe('platformSystemAttributesPolicy', () => {
    it('reads the global platform policy from admin settings rows', async () => {
        const exec = {
            query: jest.fn(async () => [
                { key: 'platformSystemAttributesConfigurable', value: { _value: true } },
                { key: 'platformSystemAttributesRequired', value: { _value: false } },
                { key: 'platformSystemAttributesIgnoreMetahubSettings', value: { _value: false } }
            ])
        }

        const policy = await readPlatformSystemAttributesPolicy(exec)

        expect(policy).toEqual({
            allowConfiguration: true,
            forceCreate: false,
            ignoreMetahubSettings: false
        })
    })

    it('forces platform rows back to canonical defaults when ignoreMetahubSettings is enabled', () => {
        const plan = resolveCatalogSystemAttributeSeedPlan([{ key: 'upl.deleted', enabled: false }], {
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
            shouldExposeCatalogSystemField('upl.deleted', {
                allowConfiguration: false,
                forceCreate: true,
                ignoreMetahubSettings: true
            })
        ).toBe(false)

        expect(
            shouldExposeCatalogSystemField('app.deleted', {
                allowConfiguration: false,
                forceCreate: true,
                ignoreMetahubSettings: true
            })
        ).toBe(true)
    })

    it('allows platform-row mutations when configuration is enabled even if seed defaults ignore metahub settings', () => {
        expect(
            getPlatformSystemAttributeMutationBlockReason('upl.deleted', {
                allowConfiguration: true,
                forceCreate: true,
                ignoreMetahubSettings: true
            })
        ).toBeNull()
    })
})
