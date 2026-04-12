const mockAcquireAdvisoryLock = jest.fn(async () => true)
const mockReleaseAdvisoryLock = jest.fn(async () => undefined)
const mockInitializeSchema = jest.fn(async () => undefined)
const mockDropSchema = jest.fn(async () => undefined)
const mockSetUserBranchCache = jest.fn()
const mockClearUserBranchCache = jest.fn()
const mockEntityTypeService = {
    listCustomTypesInSchema: jest.fn()
}
const MockMetahubSchemaService = jest.fn().mockImplementation(() => ({
    initializeSchema: (...args: unknown[]) => mockInitializeSchema(...args)
}))

type MockSchemaServiceStatics = {
    setUserBranchCache: (...args: unknown[]) => void
    clearUserBranchCache: (...args: unknown[]) => void
}

const mockSchemaServiceStatics = MockMetahubSchemaService as unknown as MockSchemaServiceStatics
mockSchemaServiceStatics.setUserBranchCache = (...args: unknown[]) => mockSetUserBranchCache(...args)
mockSchemaServiceStatics.clearUserBranchCache = (...args: unknown[]) => mockClearUserBranchCache(...args)

// Mock persistence functions
const mockFindMetahubById = jest.fn()
const mockFindMetahubForUpdate = jest.fn()
const mockFindBranchByIdAndMetahub = jest.fn()
const mockFindBranchBySchemaName = jest.fn()
const mockCreateBranchRow = jest.fn()
const mockUpdateBranchRow = jest.fn()
const mockUpdateMetahubFieldsRaw = jest.fn()
const mockGetMaxBranchNumber = jest.fn()
const mockFindTemplateVersionById = jest.fn()
const mockFindMetahubMembership = jest.fn()
const mockUpdateMetahubMember = jest.fn()
const mockFindBranchByCodename = jest.fn()
const mockFindBranchForUpdate = jest.fn()
const mockDeleteBranchById = jest.fn()
const mockCountMembersOnBranch = jest.fn()
const mockClearMemberActiveBranch = jest.fn()

jest.mock('../../persistence', () => ({
    __esModule: true,
    findMetahubById: (...args: unknown[]) => mockFindMetahubById(...args),
    findMetahubForUpdate: (...args: unknown[]) => mockFindMetahubForUpdate(...args),
    findBranchByIdAndMetahub: (...args: unknown[]) => mockFindBranchByIdAndMetahub(...args),
    findBranchBySchemaName: (...args: unknown[]) => mockFindBranchBySchemaName(...args),
    findBranchByCodename: (...args: unknown[]) => mockFindBranchByCodename(...args),
    findBranchForUpdate: (...args: unknown[]) => mockFindBranchForUpdate(...args),
    findBranchesByMetahub: jest.fn(async () => []),
    createBranch: (...args: unknown[]) => mockCreateBranchRow(...args),
    updateBranch: (...args: unknown[]) => mockUpdateBranchRow(...args),
    deleteBranchById: (...args: unknown[]) => mockDeleteBranchById(...args),
    updateMetahubFieldsRaw: (...args: unknown[]) => mockUpdateMetahubFieldsRaw(...args),
    getMaxBranchNumber: (...args: unknown[]) => mockGetMaxBranchNumber(...args),
    findTemplateVersionById: (...args: unknown[]) => mockFindTemplateVersionById(...args),
    findMetahubMembership: (...args: unknown[]) => mockFindMetahubMembership(...args),
    updateMetahubMember: (...args: unknown[]) => mockUpdateMetahubMember(...args),
    countMembersOnBranch: (...args: unknown[]) => mockCountMembersOnBranch(...args),
    clearMemberActiveBranch: (...args: unknown[]) => mockClearMemberActiveBranch(...args)
}))

jest.mock('../../domains/templates/services/TemplateManifestValidator', () => ({
    __esModule: true,
    validateTemplateManifest: jest.fn((manifest) => manifest)
}))

jest.mock('../../domains/metahubs/services/MetahubSchemaService', () => ({
    __esModule: true,
    MetahubSchemaService: MockMetahubSchemaService
}))

jest.mock('../../domains/entities/services/EntityTypeService', () => ({
    __esModule: true,
    EntityTypeService: jest.fn().mockImplementation(() => mockEntityTypeService)
}))

jest.mock('@universo/database', () => ({
    __esModule: true,
    getKnex: jest.fn(() => ({})),
    qSchema: jest.requireActual('@universo/database').qSchema,
    qTable: jest.requireActual('@universo/database').qTable,
    qSchemaTable: jest.requireActual('@universo/database').qSchemaTable,
    qColumn: jest.requireActual('@universo/database').qColumn,
    createKnexExecutor: jest.requireActual('@universo/database').createKnexExecutor
}))

jest.mock('../../domains/ddl', () => ({
    __esModule: true,
    uuidToLockKey: jest.fn(() => 'metahub:branch-create'),
    acquireAdvisoryLock: (...args: unknown[]) => mockAcquireAdvisoryLock(...args),
    releaseAdvisoryLock: (...args: unknown[]) => mockReleaseAdvisoryLock(...args),
    getDDLServices: () => ({
        cloner: { clone: jest.fn(async () => undefined) },
        generator: { dropSchema: (...args: unknown[]) => mockDropSchema(...args) }
    })
}))

import { MetahubBranchesService } from '../../domains/branches/services/MetahubBranchesService'
import { CURRENT_STRUCTURE_VERSION_SEMVER } from '../../domains/metahubs/services/structureVersions'
import type { DbExecutor } from '@universo/utils/database'
import type { VersionedLocalizedContent } from '@universo/types'

function createMockExecutor(queryFn?: jest.Mock): DbExecutor {
    const qFn = queryFn ?? jest.fn(async () => [])
    return {
        query: qFn,
        transaction: jest.fn(async (cb: (tx: DbExecutor) => Promise<unknown>) => {
            const txExec: DbExecutor = {
                query: qFn,
                transaction: jest.fn(),
                isReleased: () => false
            }
            return cb(txExec)
        }),
        isReleased: () => false
    }
}

const createLocalizedName = (value: string): VersionedLocalizedContent<string> => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: { content: value }
    }
})

const TEST_METAHUB_ID = '018f8a78-7b8f-7c1d-a111-222233334444'
const TEST_METAHUB_BRANCH_SCHEMA_1 = 'mhb_018f8a787b8f7c1da111222233334444_b1'
const TEST_METAHUB_BRANCH_SCHEMA_2 = 'mhb_018f8a787b8f7c1da111222233334444_b2'

describe('MetahubBranchesService', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockAcquireAdvisoryLock.mockResolvedValue(true)
        mockReleaseAdvisoryLock.mockResolvedValue(undefined)
        mockInitializeSchema.mockResolvedValue(undefined)
        mockDropSchema.mockResolvedValue(undefined)
        mockSetUserBranchCache.mockReset()
        mockClearUserBranchCache.mockReset()
        mockEntityTypeService.listCustomTypesInSchema.mockResolvedValue([])
    })

    it('createInitialBranch drops schema when initialization fails before branch save', async () => {
        mockInitializeSchema.mockRejectedValueOnce(new Error('init failed'))

        mockFindMetahubById.mockResolvedValue({
            id: TEST_METAHUB_ID,
            defaultBranchId: null,
            templateVersionId: null
        })
        mockFindBranchBySchemaName.mockResolvedValue(null)

        const exec = createMockExecutor()
        const service = new MetahubBranchesService(exec)

        await expect(
            service.createInitialBranch({
                metahubId: TEST_METAHUB_ID,
                codename: 'main',
                name: createLocalizedName('Main')
            })
        ).rejects.toThrow('init failed')

        expect(exec.transaction).not.toHaveBeenCalled()
        expect(mockDropSchema).toHaveBeenCalledWith(TEST_METAHUB_BRANCH_SCHEMA_1)
        expect(mockReleaseAdvisoryLock).toHaveBeenCalled()
    })

    it('listBranches excludes soft-deleted rows', async () => {
        const queryMock = jest.fn(async () => [])
        const exec = createMockExecutor(queryMock)
        const service = new MetahubBranchesService(exec)

        await service.listBranches(TEST_METAHUB_ID, { limit: 20, offset: 0 })

        expect(queryMock).toHaveBeenCalled()
        expect(queryMock.mock.calls[0][0]).toContain('b._upl_deleted = false AND b._app_deleted = false')
    })

    it('listAllBranches excludes soft-deleted rows', async () => {
        const queryMock = jest.fn(async () => [])
        const exec = createMockExecutor(queryMock)
        const service = new MetahubBranchesService(exec)

        await service.listAllBranches(TEST_METAHUB_ID)

        expect(queryMock).toHaveBeenCalled()
        expect(queryMock.mock.calls[0][0]).toContain('b._upl_deleted = false AND b._app_deleted = false')
    })

    it('createInitialBranch throws explicit rollback cleanup error when schema cleanup fails', async () => {
        mockInitializeSchema.mockRejectedValueOnce(new Error('init failed'))
        mockDropSchema.mockRejectedValueOnce(new Error('drop failed'))

        mockFindMetahubById.mockResolvedValue({
            id: TEST_METAHUB_ID,
            defaultBranchId: null,
            templateVersionId: null
        })
        mockFindBranchBySchemaName.mockResolvedValue(null)

        const exec = createMockExecutor()
        const service = new MetahubBranchesService(exec)

        await expect(
            service.createInitialBranch({
                metahubId: TEST_METAHUB_ID,
                codename: 'main',
                name: createLocalizedName('Main')
            })
        ).rejects.toThrow(`Branch rollback cleanup failed for schema "${TEST_METAHUB_BRANCH_SCHEMA_1}": drop failed`)

        expect(mockDropSchema).toHaveBeenCalledWith(TEST_METAHUB_BRANCH_SCHEMA_1)
    })

    it('uses manifest minStructureVersion for branch created without source', async () => {
        const metahubId = TEST_METAHUB_ID

        mockFindMetahubForUpdate.mockResolvedValue({
            id: metahubId,
            lastBranchNumber: 1,
            templateVersionId: 'tpl-v1'
        })
        mockGetMaxBranchNumber.mockResolvedValue(1)
        mockFindTemplateVersionById.mockResolvedValue({
            id: 'tpl-v1',
            versionLabel: 'v1',
            manifestJson: {
                minStructureVersion: '0.1.0'
            }
        })
        mockCreateBranchRow.mockImplementation(async (_tx: unknown, input: Record<string, unknown>) => ({
            ...input,
            id: 'branch-2'
        }))
        mockUpdateMetahubFieldsRaw.mockResolvedValue(undefined)

        const exec = createMockExecutor()
        const service = new MetahubBranchesService(exec)

        const created = await service.createBranch({
            metahubId,
            codename: 'dev',
            name: createLocalizedName('Dev'),
            sourceBranchId: null
        })

        expect(mockInitializeSchema).toHaveBeenCalledWith(
            TEST_METAHUB_BRANCH_SCHEMA_2,
            expect.objectContaining({ minStructureVersion: '0.1.0' })
        )
        expect(mockCreateBranchRow).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ structureVersion: CURRENT_STRUCTURE_VERSION_SEMVER })
        )
        expect(created.structureVersion).toBe(CURRENT_STRUCTURE_VERSION_SEMVER)
        expect(mockAcquireAdvisoryLock).toHaveBeenCalled()
        expect(mockReleaseAdvisoryLock).toHaveBeenCalled()
    })

    it('throws BRANCH_COPY_DANGLING_REFERENCES when partial copy removes referenced object groups', async () => {
        const metahubId = TEST_METAHUB_ID

        mockFindMetahubForUpdate.mockResolvedValue({
            id: metahubId,
            lastBranchNumber: 1,
            templateVersionId: 'tpl-v1'
        })
        mockGetMaxBranchNumber.mockResolvedValue(1)

        const sourceBranch = {
            id: 'source-branch-1',
            metahubId,
            schemaName: TEST_METAHUB_BRANCH_SCHEMA_1,
            structureVersion: '0.1.0',
            lastTemplateVersionId: null,
            lastTemplateVersionLabel: null,
            lastTemplateSyncedAt: null
        }
        mockFindBranchByIdAndMetahub.mockResolvedValue(sourceBranch)
        mockFindBranchBySchemaName.mockResolvedValue(null)

        // assertCopyCompatibility query returns dangling refs
        const queryMock = jest.fn(async () => [{ target_kind: 'catalog' }])
        const exec = createMockExecutor(queryMock)
        const service = new MetahubBranchesService(exec)

        await expect(
            service.createBranch({
                metahubId,
                sourceBranchId: sourceBranch.id,
                codename: 'dev-partial',
                name: createLocalizedName('Dev Partial'),
                copyOptions: {
                    fullCopy: false,
                    copyHubs: true,
                    copyCatalogs: false,
                    copyEnumerations: true,
                    copyLayouts: true
                }
            })
        ).rejects.toThrow('BRANCH_COPY_DANGLING_REFERENCES')

        expect(mockDropSchema).toHaveBeenCalledWith(TEST_METAHUB_BRANCH_SCHEMA_2)
        expect(mockReleaseAdvisoryLock).toHaveBeenCalled()
    })

    it('createBranch throws explicit rollback cleanup error when schema cleanup fails', async () => {
        const metahubId = TEST_METAHUB_ID

        mockFindMetahubForUpdate.mockResolvedValue({
            id: metahubId,
            lastBranchNumber: 1,
            templateVersionId: null
        })
        mockGetMaxBranchNumber.mockResolvedValue(1)

        const sourceBranch = {
            id: 'source-branch-1',
            metahubId,
            schemaName: TEST_METAHUB_BRANCH_SCHEMA_1,
            structureVersion: '0.1.0',
            lastTemplateVersionId: null,
            lastTemplateVersionLabel: null,
            lastTemplateSyncedAt: null
        }
        mockFindBranchByIdAndMetahub.mockResolvedValue(sourceBranch)
        mockDropSchema.mockRejectedValueOnce(new Error('drop failed'))

        const queryMock = jest.fn(async (sql: string) => {
            if (sql.includes('SELECT DISTINCT COALESCE(target.kind, attr.target_object_kind)::text AS target_kind')) {
                return [{ target_kind: 'catalog' }]
            }
            return []
        })

        const exec = createMockExecutor(queryMock)
        const service = new MetahubBranchesService(exec)

        await expect(
            service.createBranch({
                metahubId,
                sourceBranchId: sourceBranch.id,
                codename: 'dev-partial',
                name: createLocalizedName('Dev Partial'),
                copyOptions: {
                    fullCopy: false,
                    copyHubs: true,
                    copyCatalogs: false,
                    copyEnumerations: true,
                    copyLayouts: true
                }
            })
        ).rejects.toThrow(`Branch rollback cleanup failed for schema "${TEST_METAHUB_BRANCH_SCHEMA_2}": drop failed`)

        expect(mockDropSchema).toHaveBeenCalledWith(TEST_METAHUB_BRANCH_SCHEMA_2)
    })

    it('clears hub references from kept object configs when hubs are excluded from partial copy', async () => {
        const metahubId = TEST_METAHUB_ID

        mockFindMetahubForUpdate.mockResolvedValue({
            id: metahubId,
            lastBranchNumber: 1,
            templateVersionId: null
        })
        mockGetMaxBranchNumber.mockResolvedValue(1)

        const sourceBranch = {
            id: 'source-branch-1',
            metahubId,
            schemaName: TEST_METAHUB_BRANCH_SCHEMA_1,
            structureVersion: '0.1.0',
            lastTemplateVersionId: null,
            lastTemplateVersionLabel: null,
            lastTemplateSyncedAt: null
        }
        mockFindBranchByIdAndMetahub.mockResolvedValue(sourceBranch)
        mockCreateBranchRow.mockImplementation(async (_tx: unknown, input: Record<string, unknown>) => ({
            ...input,
            id: 'branch-2'
        }))
        mockUpdateMetahubFieldsRaw.mockResolvedValue(undefined)

        const queryMock = jest.fn(async (sql: string) => {
            if (sql.includes('SELECT DISTINCT COALESCE(target.kind, attr.target_object_kind)::text AS target_kind')) {
                return []
            }
            return undefined
        })

        const exec = createMockExecutor(queryMock)
        const service = new MetahubBranchesService(exec)

        await service.createBranch({
            metahubId,
            sourceBranchId: sourceBranch.id,
            codename: 'dev-partial-hubs',
            name: createLocalizedName('Dev Partial Hubs'),
            copyOptions: {
                fullCopy: false,
                copyHubs: false,
                copyCatalogs: true,
                copyEnumerations: false,
                copyLayouts: true
            }
        })

        expect(queryMock).toHaveBeenCalledWith(expect.stringContaining(`UPDATE "${TEST_METAHUB_BRANCH_SCHEMA_2}"._mhb_objects`), [
            ['catalog', 'set']
        ])
        expect(queryMock).toHaveBeenCalledWith(
            expect.stringContaining(`DELETE FROM "${TEST_METAHUB_BRANCH_SCHEMA_2}"._mhb_objects WHERE kind = ANY($1::text[])`),
            [['hub', 'enumeration']]
        )
        expect(queryMock).toHaveBeenCalledWith(
            expect.stringContaining("SET config = jsonb_set(COALESCE(child.config, '{}'::jsonb), '{parentHubId}'"),
            [['hub']]
        )
    })

    it('uses legacy-compatible custom kind groups throughout partial copy compatibility and prune steps', async () => {
        const metahubId = TEST_METAHUB_ID

        mockEntityTypeService.listCustomTypesInSchema.mockResolvedValue([
            { kindKey: 'custom.hub-v2-compatible', config: { compatibility: { legacyObjectKind: 'hub' } } },
            { kindKey: 'custom.catalog-v2-compatible', config: { compatibility: { legacyObjectKind: 'catalog' } } },
            { kindKey: 'custom.set-v2-compatible', config: { compatibility: { legacyObjectKind: 'set' } } },
            { kindKey: 'custom.enumeration-v2-compatible', config: { compatibility: { legacyObjectKind: 'enumeration' } } }
        ])

        mockFindMetahubForUpdate.mockResolvedValue({
            id: metahubId,
            lastBranchNumber: 1,
            templateVersionId: null
        })
        mockGetMaxBranchNumber.mockResolvedValue(1)

        const sourceBranch = {
            id: 'source-branch-1',
            metahubId,
            schemaName: TEST_METAHUB_BRANCH_SCHEMA_1,
            structureVersion: '0.1.0',
            lastTemplateVersionId: null,
            lastTemplateVersionLabel: null,
            lastTemplateSyncedAt: null
        }
        mockFindBranchByIdAndMetahub.mockResolvedValue(sourceBranch)
        mockCreateBranchRow.mockImplementation(async (_tx: unknown, input: Record<string, unknown>) => ({
            ...input,
            id: 'branch-2'
        }))
        mockUpdateMetahubFieldsRaw.mockResolvedValue(undefined)

        const queryMock = jest.fn(async (sql: string) => {
            if (sql.includes('SELECT DISTINCT COALESCE(target.kind, attr.target_object_kind)::text AS target_kind')) {
                return []
            }
            return undefined
        })

        const exec = createMockExecutor(queryMock)
        const service = new MetahubBranchesService(exec)

        await service.createBranch({
            metahubId,
            sourceBranchId: sourceBranch.id,
            codename: 'dev-partial-compatible',
            name: createLocalizedName('Dev Partial Compatible'),
            copyOptions: {
                fullCopy: false,
                copyHubs: false,
                copyCatalogs: true,
                copySets: true,
                copyEnumerations: false,
                copyLayouts: true
            }
        })

        expect(queryMock).toHaveBeenCalledWith(
            expect.stringContaining('SELECT DISTINCT COALESCE(target.kind, attr.target_object_kind)::text AS target_kind'),
            [
                ['catalog', 'custom.catalog-v2-compatible', 'set', 'custom.set-v2-compatible'],
                ['hub', 'custom.hub-v2-compatible', 'enumeration', 'custom.enumeration-v2-compatible']
            ]
        )
        expect(queryMock).toHaveBeenCalledWith(expect.stringContaining(`UPDATE "${TEST_METAHUB_BRANCH_SCHEMA_2}"._mhb_objects`), [
            ['catalog', 'custom.catalog-v2-compatible', 'set', 'custom.set-v2-compatible']
        ])
        expect(queryMock).toHaveBeenCalledWith(
            expect.stringContaining(`DELETE FROM "${TEST_METAHUB_BRANCH_SCHEMA_2}"._mhb_objects WHERE kind = ANY($1::text[])`),
            [['hub', 'custom.hub-v2-compatible', 'enumeration', 'custom.enumeration-v2-compatible']]
        )
        expect(queryMock).toHaveBeenCalledWith(
            expect.stringContaining("SET config = jsonb_set(COALESCE(child.config, '{}'::jsonb), '{parentHubId}'"),
            [['hub', 'custom.hub-v2-compatible']]
        )
    })

    it('findByCodename returns branch for given metahub and codename', async () => {
        mockFindBranchByCodename.mockResolvedValue({ id: 'branch-1', codename: 'main', metahubId: 'metahub-1' })

        const exec = createMockExecutor()
        const service = new MetahubBranchesService(exec)
        const found = await service.findByCodename('metahub-1', 'main')

        expect(mockFindBranchByCodename).toHaveBeenCalledWith(expect.anything(), 'metahub-1', 'main')
        expect(found).toEqual({ id: 'branch-1', codename: 'main', metahubId: 'metahub-1' })
    })

    it('activateBranch updates schema service user branch cache', async () => {
        mockFindBranchByIdAndMetahub.mockResolvedValue({ id: 'branch-2', metahubId: 'metahub-1' })
        const membership = { id: 'member-1', metahubId: 'metahub-1', userId: 'user-1', activeBranchId: null }
        mockFindMetahubMembership.mockResolvedValue(membership)
        mockUpdateMetahubMember.mockResolvedValue({ ...membership, activeBranchId: 'branch-2' })

        const exec = createMockExecutor()
        const service = new MetahubBranchesService(exec)
        const branch = await service.activateBranch('metahub-1', 'branch-2', 'user-1')

        expect(mockUpdateMetahubMember).toHaveBeenCalledWith(expect.anything(), 'member-1', { activeBranchId: 'branch-2' })
        expect(mockSetUserBranchCache).toHaveBeenCalledWith('metahub-1', 'user-1', 'branch-2')
        expect(branch).toEqual({ id: 'branch-2', metahubId: 'metahub-1' })
    })

    it('setDefaultBranch clears cached user branch resolution for metahub', async () => {
        const metahubId = 'metahub-1'
        const branchId = 'branch-2'
        mockFindBranchByIdAndMetahub.mockResolvedValue({ id: branchId, metahubId })
        mockUpdateMetahubFieldsRaw.mockResolvedValue(undefined)

        const exec = createMockExecutor()
        const service = new MetahubBranchesService(exec)
        const branch = await service.setDefaultBranch(metahubId, branchId)

        expect(mockUpdateMetahubFieldsRaw).toHaveBeenCalledWith(expect.anything(), metahubId, { defaultBranchId: branchId })
        expect(mockClearUserBranchCache).toHaveBeenCalledWith(metahubId)
        expect(branch).toEqual({ id: branchId, metahubId })
    })
})
