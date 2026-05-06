import { generateTableName } from '../../domains/ddl'
import { buildBuiltinKindDeletePlan, resolveBuiltinGeneratedTableName } from '../../domains/entities/services/builtinKindCapabilities'

describe('builtinKindCapabilities', () => {
    const createContext = () => ({
        metahubId: 'metahub-1',
        entityId: 'entity-1',
        userId: 'user-1',
        exec: { query: jest.fn(async () => []) } as never,
        schemaService: { ensureSchema: jest.fn(async () => 'mhb_018f8a787b8f7c1da111222233334444_b1') } as never,
        resolvedType: { kindKey: 'catalog', components: {} } as never,
        settingsService: {
            findByKey: jest.fn(async () => null)
        } as never,
        fieldDefinitionsService: {
            findCatalogReferenceBlockers: jest.fn(async () => []),
            findReferenceBlockersByTarget: jest.fn(async () => [])
        } as never,
        fixedValuesService: {
            findSetReferenceBlockers: jest.fn(async () => [])
        } as never,
        entityTypeService: {} as never
    })

    it('resolves generated table names only for catalog kinds', () => {
        expect(resolveBuiltinGeneratedTableName('catalog', 'entity-1')).toBe(generateTableName('entity-1', 'catalog'))
        expect(resolveBuiltinGeneratedTableName('hub', 'entity-1')).toBeNull()
        expect(resolveBuiltinGeneratedTableName('set', 'entity-1')).toBeNull()
        expect(resolveBuiltinGeneratedTableName('enumeration', 'entity-1')).toBeNull()
    })

    it('returns a settings-based delete block', async () => {
        const context = createContext()
        context.settingsService.findByKey = jest.fn(async () => ({ value: { _value: false } })) as never

        const result = await buildBuiltinKindDeletePlan('catalog', context)

        expect(result).toEqual({
            policyOutcome: {
                status: 403,
                body: {
                    error: 'Deleting catalogs is disabled in metahub settings'
                }
            }
        })
    })

    it('returns a catalog blocking-reference response', async () => {
        const context = createContext()
        context.fieldDefinitionsService.findCatalogReferenceBlockers = jest.fn(async () => [{ id: 'attr-1' }]) as never

        const result = await buildBuiltinKindDeletePlan('catalog', context)

        expect(result).toEqual({
            policyOutcome: {
                status: 409,
                body: {
                    error: 'Cannot delete catalog: it is referenced by attributes in other catalogs',
                    blockingReferences: [{ id: 'attr-1' }]
                }
            }
        })
    })

    it('returns a set blocking-reference response', async () => {
        const context = {
            ...createContext(),
            resolvedType: { kindKey: 'set', components: {} } as never
        }
        context.fixedValuesService.findSetReferenceBlockers = jest.fn(async () => [{ id: 'const-1' }]) as never

        const result = await buildBuiltinKindDeletePlan('set', context)

        expect(result).toEqual({
            policyOutcome: {
                status: 409,
                body: {
                    error: 'Cannot delete set because there are blocking references',
                    code: 'SET_DELETE_BLOCKED_BY_REFERENCES',
                    valueGroupId: 'entity-1',
                    blockingReferences: [{ id: 'const-1' }]
                }
            }
        })
    })

    it('blocks Page deletion while runtime menu widgets reference it', async () => {
        const context = {
            ...createContext(),
            resolvedType: { kindKey: 'page', components: {} } as never
        }
        const query = (context.exec as unknown as { query: jest.Mock }).query
        query
            .mockResolvedValueOnce([{ id: 'entity-1', codename: 'LearnerHome' }])
            .mockResolvedValueOnce([
                {
                    source: 'layoutWidget',
                    layoutId: 'layout-1',
                    widgetId: 'widget-1',
                    layoutName: { en: 'Main' },
                    reference: 'LearnerHome'
                }
            ])
            .mockResolvedValueOnce([])

        const result = await buildBuiltinKindDeletePlan('page', context)

        expect(result).toEqual({
            policyOutcome: {
                status: 409,
                body: {
                    error: 'Cannot delete page because it is referenced by runtime navigation',
                    code: 'PAGE_DELETE_BLOCKED_BY_LAYOUT_REFERENCES',
                    pageId: 'entity-1',
                    blockingReferences: [
                        {
                            source: 'layoutWidget',
                            layoutId: 'layout-1',
                            widgetId: 'widget-1',
                            layoutName: { en: 'Main' },
                            reference: 'LearnerHome'
                        }
                    ]
                }
            }
        })
    })
})
