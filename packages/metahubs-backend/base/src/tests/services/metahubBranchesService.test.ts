const mockAcquireAdvisoryLock = jest.fn(async () => true)
const mockReleaseAdvisoryLock = jest.fn(async () => undefined)
const mockInitializeSchema = jest.fn(async () => undefined)
const mockDropSchema = jest.fn(async () => undefined)
const mockSetUserBranchCache = jest.fn()
const mockClearUserBranchCache = jest.fn()
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

jest.mock('../../domains/ddl', () => ({
    __esModule: true,
    KnexClient: {
        getInstance: jest.fn(() => ({}))
    },
    uuidToLockKey: jest.fn(() => 'metahub:branch-create'),
    acquireAdvisoryLock: (...args: unknown[]) => mockAcquireAdvisoryLock(...args),
    releaseAdvisoryLock: (...args: unknown[]) => mockReleaseAdvisoryLock(...args),
    getDDLServices: () => ({
        cloner: { clone: jest.fn(async () => undefined) },
        generator: { dropSchema: (...args: unknown[]) => mockDropSchema(...args) }
    })
}))

import { MetahubBranchesService } from '../../domains/branches/services/MetahubBranchesService'
import type { DbExecutor } from '@universo/utils/database'

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

describe('MetahubBranchesService', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockAcquireAdvisoryLock.mockResolvedValue(true)
        mockReleaseAdvisoryLock.mockResolvedValue(undefined)
        mockInitializeSchema.mockResolvedValue(undefined)
        mockDropSchema.mockResolvedValue(undefined)
        mockSetUserBranchCache.mockReset()
        mockClearUserBranchCache.mockReset()
    })

    it('createInitialBranch drops schema when initialization fails before branch save', async () => {
        mockInitializeSchema.mockRejectedValueOnce(new Error('init failed'))

        mockFindMetahubById.mockResolvedValue({
            id: 'metahub-1',
            defaultBranchId: null,
            templateVersionId: null
        })
        mockFindBranchBySchemaName.mockResolvedValue(null)

        const exec = createMockExecutor()
        const service = new MetahubBranchesService(exec)

        await expect(
            service.createInitialBranch({
                metahubId: 'metahub-1',
                codename: 'main',
                name: { _schema: '1', _primary: 'en', locales: { en: { content: 'Main' } } } as any
            })
        ).rejects.toThrow('init failed')

        expect(exec.transaction).not.toHaveBeenCalled()
        expect(mockDropSchema).toHaveBeenCalledWith('mhb_metahub1_b1')
        expect(mockReleaseAdvisoryLock).toHaveBeenCalled()
    })

    it('uses manifest minStructureVersion for branch created without source', async () => {
        const metahubId = 'metahub-1'

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
            name: { _schema: '1', _primary: 'en', locales: { en: { content: 'Dev' } } } as any,
            sourceBranchId: null
        })

        expect(mockInitializeSchema).toHaveBeenCalledWith('mhb_metahub1_b2', expect.objectContaining({ minStructureVersion: '0.1.0' }))
        expect(mockCreateBranchRow).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ structureVersion: '0.1.0' })
        )
        expect((created as any).structureVersion).toBe('0.1.0')
        expect(mockAcquireAdvisoryLock).toHaveBeenCalled()
        expect(mockReleaseAdvisoryLock).toHaveBeenCalled()
    })

    it('throws BRANCH_COPY_DANGLING_REFERENCES when partial copy removes referenced object groups', async () => {
        const metahubId = 'metahub-1'

        mockFindMetahubForUpdate.mockResolvedValue({
            id: metahubId,
            lastBranchNumber: 1,
            templateVersionId: 'tpl-v1'
        })
        mockGetMaxBranchNumber.mockResolvedValue(1)

        const sourceBranch = {
            id: 'source-branch-1',
            metahubId,
            schemaName: 'mhb_metahub1_b1',
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
                name: { _schema: '1', _primary: 'en', locales: { en: { content: 'Dev Partial' } } } as any,
                copyOptions: {
                    fullCopy: false,
                    copyHubs: true,
                    copyCatalogs: false,
                    copyEnumerations: true,
                    copyLayouts: true
                }
            })
        ).rejects.toThrow('BRANCH_COPY_DANGLING_REFERENCES')

        expect(mockDropSchema).toHaveBeenCalledWith('mhb_metahub1_b2')
        expect(mockReleaseAdvisoryLock).toHaveBeenCalled()
    })

    it('clears hub references from kept object configs when hubs are excluded from partial copy', async () => {
        const metahubId = 'metahub-1'

        mockFindMetahubForUpdate.mockResolvedValue({
            id: metahubId,
            lastBranchNumber: 1,
            templateVersionId: null
        })
        mockGetMaxBranchNumber.mockResolvedValue(1)

        const sourceBranch = {
            id: 'source-branch-1',
            metahubId,
            schemaName: 'mhb_metahub1_b1',
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
            name: { _schema: '1', _primary: 'en', locales: { en: { content: 'Dev Partial Hubs' } } } as any,
            copyOptions: {
                fullCopy: false,
                copyHubs: false,
                copyCatalogs: true,
                copyEnumerations: false,
                copyLayouts: true
            }
        })

        expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('UPDATE "mhb_metahub1_b2"._mhb_objects'), [['catalog', 'set']])
        expect(queryMock).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM "mhb_metahub1_b2"._mhb_objects WHERE kind = ANY($1::text[])'),
            [['hub', 'enumeration']]
        )
        expect(queryMock).toHaveBeenCalledWith(
            expect.stringContaining("SET config = jsonb_set(COALESCE(child.config, '{}'::jsonb), '{parentHubId}'")
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
