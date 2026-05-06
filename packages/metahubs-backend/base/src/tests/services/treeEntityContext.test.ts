import { isEnabledComponentConfig } from '@universo/types'
import { queryMany } from '@universo/utils/database'

import { findBlockingTreeDependencies, loadTreeEntityContext } from '../../domains/entities/children/treeEntityContext'
import {
    CATALOG_TYPE_COMPONENTS,
    CATALOG_TYPE_UI,
    ENUMERATION_TYPE_COMPONENTS,
    ENUMERATION_TYPE_UI,
    HUB_TYPE_COMPONENTS,
    HUB_TYPE_UI,
    PAGE_TYPE_COMPONENTS,
    PAGE_TYPE_UI,
    SET_TYPE_COMPONENTS,
    SET_TYPE_UI
} from '../../domains/templates/data/standardEntityTypeDefinitions'
import type { EntityTypeService } from '../../domains/entities/services/EntityTypeService'

jest.mock('@universo/utils/database', () => ({
    queryMany: jest.fn()
}))

const queryManyMock = queryMany as jest.MockedFunction<typeof queryMany>

const createType = (kindKey: string, components: unknown, ui: unknown) => ({
    kindKey,
    codename: {
        _primary: 'en',
        locales: {
            en: { content: kindKey }
        }
    },
    components,
    ui
})

describe('treeEntityContext', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('treats every treeAssignment-enabled entity type as hub-assignable', async () => {
        expect(isEnabledComponentConfig(SET_TYPE_COMPONENTS.treeAssignment)).toBe(true)
        expect(isEnabledComponentConfig(ENUMERATION_TYPE_COMPONENTS.treeAssignment)).toBe(true)
        expect(isEnabledComponentConfig(PAGE_TYPE_COMPONENTS.treeAssignment)).toBe(true)

        const entityTypeService = {
            listEditableTypes: jest.fn().mockResolvedValue([
                createType('hub', HUB_TYPE_COMPONENTS, HUB_TYPE_UI),
                createType('catalog', CATALOG_TYPE_COMPONENTS, CATALOG_TYPE_UI),
                createType('page', PAGE_TYPE_COMPONENTS, PAGE_TYPE_UI),
                createType('set', SET_TYPE_COMPONENTS, SET_TYPE_UI),
                createType('enumeration', ENUMERATION_TYPE_COMPONENTS, ENUMERATION_TYPE_UI),
                createType(
                    'article',
                    {
                        ...PAGE_TYPE_COMPONENTS,
                        treeAssignment: { enabled: true }
                    },
                    {
                        ...PAGE_TYPE_UI,
                        nameKey: 'Article'
                    }
                )
            ])
        } as unknown as Pick<EntityTypeService, 'listEditableTypes'>

        const context = await loadTreeEntityContext(entityTypeService, 'metahub-1', 'user-1')

        expect(context.hubAssignableKinds).toEqual(expect.arrayContaining(['catalog', 'page', 'set', 'enumeration', 'article']))
        expect(context.hubAssignableKinds).not.toContain('hub')
        expect(context.relatedKinds).toEqual(context.hubAssignableKinds)
    })

    it('returns generic hub blockers for every hub-assignable entity kind', async () => {
        queryManyMock
            .mockResolvedValueOnce([
                {
                    id: 'page-1',
                    kind: 'page',
                    codename: {
                        _primary: 'en',
                        locales: { en: { content: 'WelcomePage' } }
                    },
                    presentation: {
                        name: {
                            _primary: 'en',
                            locales: { en: { content: 'Welcome Page' } }
                        }
                    }
                }
            ] as never)
            .mockResolvedValueOnce([] as never)

        const result = await findBlockingTreeDependencies({
            metahubId: 'metahub-1',
            treeEntityId: 'hub-1',
            userId: 'user-1',
            db: { query: jest.fn() },
            schemaService: { ensureSchema: jest.fn().mockResolvedValue('mhb_019df00000007000a000000000000000_b1') } as never,
            compatibility: {
                hubKinds: ['hub'],
                hubKindSet: new Set(['hub']),
                linkedCollectionKinds: ['catalog'],
                linkedCollectionKindSet: new Set(['catalog']),
                valueGroupKinds: ['set'],
                valueGroupKindSet: new Set(['set']),
                optionListKinds: ['enumeration'],
                optionListKindSet: new Set(['enumeration']),
                hubAssignableKinds: ['page'],
                hubAssignableKindSet: new Set(['page']),
                hubAssignableTypeByKind: new Map([
                    [
                        'page',
                        {
                            nameKey: 'metahubs:pages.title',
                            name: {
                                _primary: 'en',
                                locales: { en: { content: 'Pages' } }
                            }
                        }
                    ]
                ]),
                relatedKinds: ['page']
            }
        })

        expect(queryManyMock.mock.calls[0][2]).toEqual([['page'], JSON.stringify(['hub-1'])])
        expect(result.blockingRelatedObjects).toEqual([
            expect.objectContaining({
                id: 'page-1',
                kind: 'page',
                typeNameKey: 'metahubs:pages.title'
            })
        ])
        expect(result.blockingChildTreeEntities).toEqual([])
    })
})
