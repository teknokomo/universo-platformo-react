import { entityRecordPolicySchema, type EntityRecordPolicy } from '@universo-react/types'
import {
    assertEntityMetadataSecurityUpdate,
    assertMarketingHeroComponentMutation,
    isEntityMetadataPolicyManaged
} from '../../domains/shared/entityMetadataMutationPolicy'

const heroPolicy: EntityRecordPolicy = entityRecordPolicySchema.parse({
    version: 1,
    semanticKey: { componentCodename: 'HeroKey', creationPrefix: 'hero', protectedValues: ['default'] },
    denyDeleteWhenBound: true,
    immutableSemanticKeyWhenBound: true,
    runtimeMutation: 'deny',
    requiredLocales: ['en', 'ru'],
    validatorKey: 'marketing.hero.v1'
})

const heroConfig = { marketingRole: 'hero', recordPolicy: heroPolicy }

describe('Entity metadata mutation policy', () => {
    it('protects Hero runtime and delete invariants from generic metadata updates', () => {
        expect(() =>
            assertEntityMetadataSecurityUpdate({
                codename: 'MarketingPageHero',
                config: heroConfig,
                configPatch: { recordPolicy: { ...heroPolicy, runtimeMutation: 'allow' } }
            })
        ).toThrow('Entity record policies are managed by the platform.')
        expect(() =>
            assertEntityMetadataSecurityUpdate({
                codename: 'MarketingPageHero',
                config: heroConfig,
                configPatch: { recordPolicy: { ...heroPolicy, denyDeleteWhenBound: false } }
            })
        ).toThrow('Entity record policies are managed by the platform.')
    })

    it('keeps the bound Hero Object codename and role fixed', () => {
        expect(() =>
            assertEntityMetadataSecurityUpdate({
                codename: 'MarketingPageHero',
                config: heroConfig,
                nextCodename: 'RenamedHero'
            })
        ).toThrow('The Marketing Hero Object codename is fixed')
        expect(() =>
            assertEntityMetadataSecurityUpdate({
                codename: 'MarketingPageHero',
                config: heroConfig,
                configPatch: { marketingRole: 'content' }
            })
        ).toThrow('The Marketing Hero Object role is managed')
    })

    it('allows presentation metadata updates and unchanged policy input', () => {
        expect(() =>
            assertEntityMetadataSecurityUpdate({
                codename: 'MarketingPageHero',
                config: heroConfig,
                configPatch: { recordPolicy: heroPolicy }
            })
        ).not.toThrow()
        expect(isEntityMetadataPolicyManaged('MarketingPageHero', heroConfig)).toBe(true)
    })

    it('does not allow a generic Entity to acquire or replace a record policy', () => {
        expect(() =>
            assertEntityMetadataSecurityUpdate({
                codename: 'Article',
                config: {},
                configPatch: { recordPolicy: heroPolicy }
            })
        ).toThrow('Entity record policies are managed by the platform.')

        const otherPolicy = { ...heroPolicy, validatorKey: 'article.v1' }
        expect(() =>
            assertEntityMetadataSecurityUpdate({
                codename: 'Article',
                config: { recordPolicy: otherPolicy },
                configPatch: { recordPolicy: heroPolicy }
            })
        ).toThrow('Entity record policies are managed by the platform.')
    })

    it('protects registered binding field requirements and permits presentation-only edits', () => {
        const description = {
            codename: 'Description',
            dataType: 'STRING',
            isRequired: true,
            validationRules: { maxLength: 2000, localized: true, versioned: true },
            parentComponentId: null
        }

        expect(() =>
            assertMarketingHeroComponentMutation({
                entityCodename: 'MarketingPageHero',
                entityConfig: heroConfig,
                current: description,
                next: { ...description, isRequired: false },
                operation: 'update'
            })
        ).toThrow('cannot be changed in a way that invalidates its bindings')

        expect(() =>
            assertMarketingHeroComponentMutation({
                entityCodename: 'MarketingPageHero',
                entityConfig: heroConfig,
                current: description,
                next: { ...description, validationRules: { ...description.validationRules, localized: false } },
                operation: 'update'
            })
        ).toThrow('cannot be changed in a way that invalidates its bindings')

        expect(() =>
            assertMarketingHeroComponentMutation({
                entityCodename: 'MarketingPageHero',
                entityConfig: heroConfig,
                current: description,
                operation: 'delete'
            })
        ).toThrow('cannot be changed in a way that invalidates its bindings')

        expect(() =>
            assertMarketingHeroComponentMutation({
                entityCodename: 'MarketingPageHero',
                entityConfig: heroConfig,
                current: {
                    codename: 'Accent',
                    dataType: 'STRING',
                    isRequired: false,
                    validationRules: { maxLength: 120, localized: true, versioned: true },
                    parentComponentId: null
                },
                next: {
                    codename: 'Accent',
                    dataType: 'STRING',
                    isRequired: true,
                    validationRules: { maxLength: 120, localized: true, versioned: true },
                    parentComponentId: null
                },
                operation: 'set-display'
            })
        ).toThrow('cannot be changed in a way that invalidates its bindings')

        expect(() =>
            assertMarketingHeroComponentMutation({
                entityCodename: 'MarketingPageHero',
                entityConfig: heroConfig,
                current: description,
                next: { ...description, parentComponentId: 'table-component-id' },
                operation: 'move'
            })
        ).toThrow('cannot be changed in a way that invalidates its bindings')

        expect(() =>
            assertMarketingHeroComponentMutation({
                entityCodename: 'MarketingPageHero',
                entityConfig: heroConfig,
                current: description,
                next: description,
                operation: 'update'
            })
        ).not.toThrow()
    })

    it.each(['PrimaryAction', 'TermsAction'])('protects the registered %s validator format', (codename) => {
        const component = {
            codename,
            dataType: 'JSON',
            isRequired: codename === 'PrimaryAction',
            validationRules: { format: 'marketingAction' },
            parentComponentId: null
        }

        expect(() =>
            assertMarketingHeroComponentMutation({
                entityCodename: 'MarketingPageHero',
                entityConfig: heroConfig,
                current: component,
                next: { ...component, validationRules: { format: 'untrusted' } },
                operation: 'update'
            })
        ).toThrow('cannot be changed in a way that invalidates its bindings')
    })
})
