import { generateTableName } from '../../domains/ddl'
import { buildBuiltinKindDeletePlan, resolveBuiltinGeneratedTableName } from '../../domains/entities/services/builtinKindCapabilities'

describe('builtinKindCapabilities', () => {
    const createContext = () => ({
        metahubId: 'metahub-1',
        entityId: 'entity-1',
        userId: 'user-1',
        exec: {} as never,
        schemaService: {} as never,
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
                    error: 'Cannot delete value group because there are blocking references',
                    code: 'SET_DELETE_BLOCKED_BY_REFERENCES',
                    valueGroupId: 'entity-1',
                    blockingReferences: [{ id: 'const-1' }]
                }
            }
        })
    })
})
