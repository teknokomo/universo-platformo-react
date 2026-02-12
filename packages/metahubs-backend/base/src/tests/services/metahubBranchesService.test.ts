jest.mock(
    'typeorm',
    () => {
        const decorator = () => () => {}
        return {
            __esModule: true,
            Entity: decorator,
            PrimaryGeneratedColumn: decorator,
            PrimaryColumn: decorator,
            Column: decorator,
            CreateDateColumn: decorator,
            UpdateDateColumn: decorator,
            VersionColumn: decorator,
            ManyToOne: decorator,
            OneToMany: decorator,
            OneToOne: decorator,
            ManyToMany: decorator,
            JoinTable: decorator,
            JoinColumn: decorator,
            Index: decorator,
            Unique: decorator
        }
    },
    { virtual: true }
)

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

        const metahubRepo = {
            findOne: jest.fn().mockResolvedValue({
                id: 'metahub-1',
                defaultBranchId: null,
                templateVersionId: null
            })
        }

        const branchRepo = {
            findOne: jest.fn().mockResolvedValue(null)
        }

        const manager = {
            transaction: jest.fn(),
            getRepository: jest.fn((entity: { name?: string }) => {
                if (entity?.name === 'Metahub') return metahubRepo
                if (entity?.name === 'MetahubBranch') return branchRepo
                if (entity?.name === 'TemplateVersion') return { findOneBy: jest.fn() }
                throw new Error(`Unexpected repository: ${entity?.name ?? 'unknown'}`)
            })
        }

        const service = new MetahubBranchesService({} as any, manager as any)

        await expect(
            service.createInitialBranch({
                metahubId: 'metahub-1',
                codename: 'main',
                name: { _schema: '1', _primary: 'en', locales: { en: { content: 'Main' } } } as any
            })
        ).rejects.toThrow('init failed')

        expect(manager.transaction).not.toHaveBeenCalled()
        expect(mockDropSchema).toHaveBeenCalledWith('mhb_metahub1_b1')
        expect(mockReleaseAdvisoryLock).toHaveBeenCalled()
    })

    it('uses manifest minStructureVersion for branch created without source', async () => {
        const metahubId = 'metahub-1'

        const metahubQb = {
            setLock: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue({
                id: metahubId,
                lastBranchNumber: 1,
                templateVersionId: 'tpl-v1'
            })
        }
        const metahubUpdateQb = {
            update: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            execute: jest.fn().mockResolvedValue({ affected: 1 })
        }
        const metahubRepo = {
            createQueryBuilder: jest.fn((alias?: string) => (alias === 'm' ? metahubQb : metahubUpdateQb))
        }

        const branchStatsQb = {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            getRawOne: jest.fn().mockResolvedValue({ maxBranchNumber: '1' })
        }
        const branchRepo = {
            findOne: jest.fn().mockResolvedValue(null),
            createQueryBuilder: jest.fn(() => branchStatsQb),
            create: jest.fn((payload: Record<string, unknown>) => payload),
            save: jest.fn(async (payload: Record<string, unknown>) => ({ ...payload, id: 'branch-2' }))
        }

        const templateVersionRepo = {
            findOneBy: jest.fn().mockResolvedValue({
                id: 'tpl-v1',
                manifestJson: {
                    minStructureVersion: 3
                }
            })
        }

        const manager = {
            transaction: jest.fn(async (callback: (txManager: typeof manager) => Promise<unknown>) => callback(manager)),
            getRepository: jest.fn((entity: { name?: string }) => {
                if (entity?.name === 'Metahub') return metahubRepo
                if (entity?.name === 'MetahubBranch') return branchRepo
                if (entity?.name === 'TemplateVersion') return templateVersionRepo
                throw new Error(`Unexpected repository: ${entity?.name ?? 'unknown'}`)
            })
        }

        const service = new MetahubBranchesService({} as any, manager as any)

        const created = await service.createBranch({
            metahubId,
            codename: 'dev',
            name: { _schema: '1', _primary: 'en', locales: { en: { content: 'Dev' } } } as any,
            sourceBranchId: null
        })

        expect(mockInitializeSchema).toHaveBeenCalledWith('mhb_metahub1_b2', expect.objectContaining({ minStructureVersion: 3 }))
        expect(branchRepo.create).toHaveBeenCalledWith(expect.objectContaining({ structureVersion: 3 }))
        expect((created as any).structureVersion).toBe(3)
        expect(mockAcquireAdvisoryLock).toHaveBeenCalled()
        expect(mockReleaseAdvisoryLock).toHaveBeenCalled()
    })

    it('findByCodename checks only active branches', async () => {
        const qb = {
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue({ id: 'branch-1', codename: 'main' })
        }
        const branchRepo = {
            createQueryBuilder: jest.fn(() => qb)
        }
        const manager = {
            getRepository: jest.fn((entity: { name?: string }) => {
                if (entity?.name === 'MetahubBranch') return branchRepo
                throw new Error(`Unexpected repository: ${entity?.name ?? 'unknown'}`)
            })
        }

        const service = new MetahubBranchesService({} as any, manager as any)
        const found = await service.findByCodename('metahub-1', 'main')

        expect(qb.where).toHaveBeenCalledWith('b.metahub_id = :metahubId', { metahubId: 'metahub-1' })
        expect(qb.andWhere).toHaveBeenCalledWith('b.codename = :codename', { codename: 'main' })
        expect(qb.andWhere).toHaveBeenCalledWith('b._upl_deleted = false')
        expect(qb.andWhere).toHaveBeenCalledWith('b._mhb_deleted = false')
        expect(found).toEqual({ id: 'branch-1', codename: 'main' })
    })

    it('activateBranch updates schema service user branch cache', async () => {
        const branchRepo = {
            findOne: jest.fn().mockResolvedValue({ id: 'branch-2', metahubId: 'metahub-1' })
        }
        const membership = { id: 'member-1', metahubId: 'metahub-1', userId: 'user-1', activeBranchId: null }
        const memberRepo = {
            findOne: jest.fn().mockResolvedValue(membership),
            save: jest.fn().mockResolvedValue(undefined)
        }
        const manager = {
            getRepository: jest.fn((entity: { name?: string }) => {
                if (entity?.name === 'MetahubBranch') return branchRepo
                if (entity?.name === 'MetahubUser') return memberRepo
                throw new Error(`Unexpected repository: ${entity?.name ?? 'unknown'}`)
            })
        }

        const service = new MetahubBranchesService({} as any, manager as any)
        const branch = await service.activateBranch('metahub-1', 'branch-2', 'user-1')

        expect(memberRepo.save).toHaveBeenCalledWith(expect.objectContaining({ activeBranchId: 'branch-2' }))
        expect(mockSetUserBranchCache).toHaveBeenCalledWith('metahub-1', 'user-1', 'branch-2')
        expect(branch).toEqual({ id: 'branch-2', metahubId: 'metahub-1' })
    })

    it('setDefaultBranch clears cached user branch resolution for metahub', async () => {
        const metahubId = 'metahub-1'
        const branchId = 'branch-2'
        const branchRepo = {
            findOne: jest.fn().mockResolvedValue({ id: branchId, metahubId })
        }
        const metahubRepo = {
            update: jest.fn().mockResolvedValue({ affected: 1 })
        }
        const manager = {
            getRepository: jest.fn((entity: { name?: string }) => {
                if (entity?.name === 'MetahubBranch') return branchRepo
                if (entity?.name === 'Metahub') return metahubRepo
                throw new Error(`Unexpected repository: ${entity?.name ?? 'unknown'}`)
            })
        }

        const service = new MetahubBranchesService({} as any, manager as any)
        const branch = await service.setDefaultBranch(metahubId, branchId)

        expect(metahubRepo.update).toHaveBeenCalledWith(metahubId, { defaultBranchId: branchId })
        expect(mockClearUserBranchCache).toHaveBeenCalledWith(metahubId)
        expect(branch).toEqual({ id: branchId, metahubId })
    })
})
