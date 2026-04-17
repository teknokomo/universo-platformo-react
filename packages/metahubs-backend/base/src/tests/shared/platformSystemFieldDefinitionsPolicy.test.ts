import {
    getPlatformSystemFieldDefinitionMutationBlockReason,
    readPlatformSystemFieldDefinitionsPolicy,
    resolveCatalogSystemFieldDefinitionSeedPlan,
    shouldExposeCatalogSystemField
} from '../../domains/shared/platformSystemFieldDefinitionsPolicy'

describe('platformSystemFieldDefinitionsPolicy', () => {
    it('reads the global platform policy from admin settings rows', async () => {
        const exec = {
            query: jest.fn(async () => [
                { key: 'platformSystemFieldDefinitionsConfigurable', value: { _value: true } },
                { key: 'platformSystemFieldDefinitionsRequired', value: { _value: false } },
                { key: 'platformSystemFieldDefinitionsIgnoreMetahubSettings', value: { _value: false } }
            ])
        }

        const policy = await readPlatformSystemFieldDefinitionsPolicy(exec)

        expect(policy).toEqual({
            allowConfiguration: true,
            forceCreate: false,
            ignoreMetahubSettings: false
        })
    })

    it('forces platform rows back to canonical defaults when ignoreMetahubSettings is enabled', () => {
        const plan = resolveCatalogSystemFieldDefinitionSeedPlan([{ key: 'upl.deleted', enabled: false }], {
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
            getPlatformSystemFieldDefinitionMutationBlockReason('upl.deleted', {
                allowConfiguration: true,
                forceCreate: true,
                ignoreMetahubSettings: true
            })
        ).toBeNull()
    })
})
