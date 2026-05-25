import { generateTableName } from '../../domains/ddl'
import { buildBuiltinKindDeletePlan, resolveBuiltinGeneratedTableName } from '../../domains/entities/services/builtinKindCapabilities'

describe('builtinKindCapabilities', () => {
    const createContext = () => ({
        metahubId: 'metahub-1',
        entityId: 'entity-1',
        userId: 'user-1',
        exec: { query: jest.fn(async () => []) } as never,
        schemaService: { ensureSchema: jest.fn(async () => 'mhb_018f8a787b8f7c1da111222233334444_b1') } as never,
        resolvedType: { kindKey: 'object', capabilities: {} } as never,
        settingsService: {
            findByKey: jest.fn(async () => null)
        } as never,
        componentsService: {
            findObjectReferenceBlockers: jest.fn(async () => []),
            findReferenceBlockersByTarget: jest.fn(async () => [])
        } as never,
        fixedValuesService: {
            findSetReferenceBlockers: jest.fn(async () => [])
        } as never,
        entityTypeService: {} as never
    })

    it('resolves generated table names only for object kinds', () => {
        expect(resolveBuiltinGeneratedTableName('object', 'entity-1')).toBe(generateTableName('entity-1', 'object'))
        expect(resolveBuiltinGeneratedTableName('hub', 'entity-1')).toBeNull()
        expect(resolveBuiltinGeneratedTableName('set', 'entity-1')).toBeNull()
        expect(resolveBuiltinGeneratedTableName('enumeration', 'entity-1')).toBeNull()
    })

    it('returns a settings-based delete block', async () => {
        const context = createContext()
        context.settingsService.findByKey = jest.fn(async () => ({ value: { _value: false } })) as never

        const result = await buildBuiltinKindDeletePlan('object', context)

        expect(result).toEqual({
            policyOutcome: {
                status: 403,
                body: {
                    error: 'Deleting objects is disabled in metahub settings'
                }
            }
        })
    })

    it('returns a object blocking-reference response', async () => {
        const context = createContext()
        context.componentsService.findObjectReferenceBlockers = jest.fn(async () => [{ id: 'attr-1' }]) as never

        const result = await buildBuiltinKindDeletePlan('object', context)

        expect(result).toEqual({
            policyOutcome: {
                status: 409,
                body: {
                    error: 'Cannot delete object: it is referenced by components in other objects',
                    blockingReferences: [{ id: 'attr-1' }]
                }
            }
        })
    })

    it('returns a set blocking-reference response', async () => {
        const context = {
            ...createContext(),
            resolvedType: { kindKey: 'set', capabilities: {} } as never
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
            resolvedType: { kindKey: 'page', capabilities: {} } as never
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
