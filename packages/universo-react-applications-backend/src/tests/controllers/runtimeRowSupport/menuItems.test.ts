import {
    buildRuntimeWorkspaceMenuItem,
    normalizeRuntimeMenuItem,
    resolveRuntimeMenuObjectCollectionId,
    resolveRuntimeMenuSectionTarget,
    resolveRuntimeMenuStartTarget,
    resolveRuntimeMenuTreeEntityId,
    toRuntimeMenuStartTarget,
    type RuntimeMenuLookups,
    type RuntimeMenuItem,
    type RuntimeObjectCollectionMeta,
    type RuntimeTreeEntityMeta
} from '../../../controllers/runtimeRowSupport/menuItems'

const localized = (locale: string, text: string) => ({ _primary: locale, locales: { [locale]: { content: text } } })

const collection = (id: string, codename: string, kind: string | null = 'object'): RuntimeObjectCollectionMeta => ({
    id,
    codename,
    kind,
    title: codename,
    sortOrder: 0,
    treeEntityIds: []
})

const treeEntity = (id: string, codename: string): RuntimeTreeEntityMeta => ({
    id,
    codename,
    title: codename,
    parentTreeEntityId: null,
    sortOrder: 0
})

const recordsCollection = collection('collection-1', 'records')
const pageCollection = collection('page-1', 'homepage', 'page')
const facultyTreeEntity = treeEntity('tree-1', 'faculty')

const lookups: RuntimeMenuLookups = {
    runtimeMenuTargetById: new Map<string, unknown>([['section-1', { id: 'section-1' }]]),
    objectCollectionMetaById: new Map([
        [recordsCollection.id, recordsCollection],
        [pageCollection.id, pageCollection]
    ]),
    objectCollectionMetaByCodename: new Map([
        ['records', recordsCollection],
        ['homepage', pageCollection]
    ]),
    treeEntityMetaById: new Map([[facultyTreeEntity.id, facultyTreeEntity]]),
    treeEntityMetaByCodename: new Map([['faculty', facultyTreeEntity]]),
    childTreeEntityIdsByParent: new Map(),
    objectCollectionsByTreeEntity: new Map()
}

const menuItem = (overrides: Partial<RuntimeMenuItem> & Pick<RuntimeMenuItem, 'id'>): RuntimeMenuItem => ({
    kind: 'section',
    title: 'Records',
    icon: null,
    href: null,
    objectCollectionId: null,
    sectionId: null,
    treeEntityId: null,
    sortOrder: 0,
    isActive: true,
    ...overrides
})

const objectCollectionId = (value: unknown) => resolveRuntimeMenuObjectCollectionId({ ...lookups, value })
const sectionTarget = (value: unknown) => resolveRuntimeMenuSectionTarget({ ...lookups, value })
const treeEntityId = (value: unknown) => resolveRuntimeMenuTreeEntityId({ ...lookups, value })
const normalizeItem = (locale: string, item: unknown) => normalizeRuntimeMenuItem({ ...lookups, locale, item })
const startTarget = (target: unknown, items: RuntimeMenuItem[] = []) => resolveRuntimeMenuStartTarget({ ...lookups, items, target })

describe('resolveRuntimeMenuObjectCollectionId', () => {
    it('resolves by id and codename and rejects page collections', () => {
        expect(objectCollectionId('collection-1')).toBe('collection-1')
        expect(objectCollectionId('records')).toBe('collection-1')
        expect(objectCollectionId('page-1')).toBeNull()
        expect(objectCollectionId('missing')).toBeNull()
        expect(objectCollectionId('   ')).toBeNull()
    })
})

describe('resolveRuntimeMenuSectionTarget', () => {
    it('prefers a runtime section target over an object collection', () => {
        expect(sectionTarget('section-1')).toEqual({ id: 'section-1', kind: 'section' })
        expect(sectionTarget('collection-1')).toEqual({ id: 'collection-1', kind: 'objectCollection' })
        expect(sectionTarget('records')).toEqual({ id: 'collection-1', kind: 'objectCollection' })
    })

    it('returns null for page collections, unknown values and non-strings', () => {
        expect(sectionTarget('page-1')).toBeNull()
        expect(sectionTarget('missing')).toBeNull()
        expect(sectionTarget(42)).toBeNull()
    })

    it('resolves tree entities by id and codename only', () => {
        expect(treeEntityId('tree-1')).toBe('tree-1')
        expect(treeEntityId('faculty')).toBe('tree-1')
        expect(treeEntityId('missing')).toBeNull()
    })
})

describe('toRuntimeMenuStartTarget', () => {
    it('prefers the object collection and falls back to the section', () => {
        expect(toRuntimeMenuStartTarget(menuItem({ id: 'i1', objectCollectionId: 'c1', sectionId: 's1' }))).toEqual({
            id: 'c1',
            kind: 'objectCollection'
        })
        expect(toRuntimeMenuStartTarget(menuItem({ id: 'i2', sectionId: 's1' }))).toEqual({ id: 's1', kind: 'section' })
        expect(toRuntimeMenuStartTarget(null)).toBeNull()
    })
})

describe('resolveRuntimeMenuStartTarget', () => {
    it('resolves menuItem, section, objectCollection and hub targets', () => {
        const items = [
            menuItem({ id: 'item-1', objectCollectionId: 'collection-1' }),
            menuItem({ id: 'item-2', treeEntityId: 'tree-1', objectCollectionId: 'collection-1' })
        ]
        expect(startTarget({ kind: 'menuItem', menuItemId: 'item-1' }, items)).toEqual({ id: 'collection-1', kind: 'objectCollection' })
        expect(startTarget({ kind: 'section', sectionId: 'section-1' })).toEqual({ id: 'section-1', kind: 'section' })
        expect(startTarget({ kind: 'objectCollection', objectCollectionId: 'records' })).toEqual({
            id: 'collection-1',
            kind: 'objectCollection'
        })
        expect(startTarget({ kind: 'hub', hubId: 'faculty' }, items)).toEqual({ id: 'collection-1', kind: 'objectCollection' })
    })

    it('returns null for unknown items, unknown target kinds and non-objects', () => {
        expect(startTarget({ kind: 'menuItem', menuItemId: 'missing' })).toBeNull()
        expect(startTarget({ kind: 'mystery' })).toBeNull()
        expect(startTarget(null)).toBeNull()
    })
})

describe('normalizeRuntimeMenuItem', () => {
    it('returns null for inactive and non-object items', () => {
        expect(normalizeItem('en', { id: 'i1', isActive: false })).toBeNull()
        expect(normalizeItem('en', null)).toBeNull()
        expect(normalizeItem('en', 'not-an-object')).toBeNull()
    })

    it('applies link defaults and resolves a localized title', () => {
        expect(normalizeItem('ru', { title: localized('ru', 'Записи') })).toEqual({
            id: '',
            kind: 'link',
            title: 'Записи',
            icon: null,
            href: null,
            objectCollectionId: null,
            sectionId: null,
            treeEntityId: null,
            sortOrder: 0,
            isActive: true
        })
    })

    it('resolves object collection, section and tree entity bindings', () => {
        expect(
            normalizeItem('en', { id: 'i1', kind: 'section', title: 'Records', objectCollectionId: 'records', hubId: 'faculty' })
        ).toMatchObject({
            id: 'i1',
            kind: 'section',
            title: 'Records',
            objectCollectionId: 'collection-1',
            sectionId: 'collection-1',
            treeEntityId: 'tree-1'
        })
        expect(normalizeItem('en', { id: 'i2', title: 'Section', sectionId: 'section-1' })).toMatchObject({
            objectCollectionId: null,
            sectionId: 'section-1'
        })
    })

    it('keeps only string icon and href values', () => {
        expect(normalizeItem('en', { id: 'i1', title: 'x', icon: 5, href: '/path' })).toMatchObject({ icon: null, href: '/path' })
    })
})

describe('buildRuntimeWorkspaceMenuItem', () => {
    it('builds a localized workspace link', () => {
        expect(buildRuntimeWorkspaceMenuItem({ sortOrder: 3, locale: 'ru', applicationId: 'app-1' })).toEqual({
            id: 'runtime-workspaces',
            kind: 'link',
            title: 'Рабочие пространства',
            icon: 'apps',
            href: '/a/app-1/workspaces',
            objectCollectionId: null,
            sectionId: null,
            treeEntityId: null,
            sortOrder: 3,
            isActive: true
        })
    })
})
