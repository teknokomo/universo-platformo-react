import type { Request } from 'express'
import type { DataSource, Repository } from 'typeorm'
import { WorkspaceAccessService } from '../../src/services/access-control'
import { UnikUser } from '@universo/uniks-srv'
import { UnikRole } from '../../src/services/access-control/roles'

type MockRepo = {
  findOne: jest.MockedFunction<any>
  find: jest.MockedFunction<any>
  findOneBy: jest.MockedFunction<any>
  create: jest.MockedFunction<any>
  save: jest.MockedFunction<any>
  count: jest.MockedFunction<any>
  remove: jest.MockedFunction<any>
  delete: jest.MockedFunction<any>
  update: jest.MockedFunction<any>
  insert: jest.MockedFunction<any>
  softRemove: jest.MockedFunction<any>
  softDelete: jest.MockedFunction<any>
  createQueryBuilder: jest.MockedFunction<any>
  merge: jest.MockedFunction<any>
  metadata: any
  manager: any
  queryRunner: any
}

const createRequest = (): Request => ({ headers: {}, params: {} } as unknown as Request)

const createMockRepository = (): MockRepo => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  remove: jest.fn(),
  insert: jest.fn(),
  softRemove: jest.fn(),
  softDelete: jest.fn(),
  merge: jest.fn(),
  manager: {} as any,
  metadata: {} as any,
  queryRunner: undefined
})

const createMembership = (overrides: Partial<UnikUser> = {}): UnikUser => 
  Object.assign(new UnikUser(), {
    id: 'membership-1',
    user_id: 'user-1',
    unik_id: 'unik-1',
    role: 'owner' as UnikRole,
    ...overrides
  })

describe('WorkspaceAccessService', () => {
  const setupService = () => {
    const membershipRepo = createMockRepository()
    const queryMock = jest.fn()
    const dataSource = {
      isInitialized: true,
      getRepository: jest.fn((entity: any) => {
        if (entity === UnikUser) return membershipRepo
        return createMockRepository()
      }),
      query: queryMock
    } as unknown as DataSource

    const service = new WorkspaceAccessService(() => dataSource)
    return { service, membershipRepo, queryMock }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('membership caching', () => {
    it('caches membership results across multiple checks within the same request', async () => {
      const { service, membershipRepo } = setupService()
      const membership = createMembership()
      membershipRepo.findOne.mockResolvedValueOnce(membership)

      const req = createRequest()

      const first = await service.hasUnikAccess(req, 'user-1', 'unik-1')
      const second = await service.hasUnikAccess(req, 'user-1', 'unik-1')

      expect(first).toBe(true)
      expect(second).toBe(true)
      expect(membershipRepo.findOne).toHaveBeenCalledTimes(1)
    })

    it('returns false when user has no membership', async () => {
      const { service, membershipRepo } = setupService()
      membershipRepo.findOne.mockResolvedValueOnce(null)

      const req = createRequest()
      const hasAccess = await service.hasUnikAccess(req, 'user-1', 'unik-1')

      expect(hasAccess).toBe(false)
    })
  })

  describe('role validation', () => {
    it('accepts valid roles from database', async () => {
      const { service, membershipRepo } = setupService()
      const membership = createMembership({ role: 'editor' })
      membershipRepo.findOne.mockResolvedValueOnce(membership)

      const req = createRequest()

      const result = await service.requireUnikRole(req, 'user-1', 'unik-1', { 
        allowedRoles: ['editor', 'admin'] 
      })

      expect(result).toBe(membership)
    })

    it('throws when user role is insufficient', async () => {
      const { service, membershipRepo } = setupService()
      const membership = createMembership({ role: 'member' })
      membershipRepo.findOne.mockResolvedValueOnce(membership)

      const req = createRequest()

      await expect(
        service.requireUnikRole(req, 'user-1', 'unik-1', { allowedRoles: ['owner'] })
      ).rejects.toMatchObject({ status: 403 })
    })

    it('throws when database contains invalid role', async () => {
      const { service, membershipRepo } = setupService()
      const membership = createMembership({ role: 'invalid_role' as any })
      membershipRepo.findOne.mockResolvedValueOnce(membership)

      const req = createRequest()

      await expect(
        service.requireUnikRole(req, 'user-1', 'unik-1')
      ).rejects.toMatchObject({ 
        status: 500,
        message: 'Invalid role in database: invalid_role'
      })
    })

    it('allows access when no role restrictions specified', async () => {
      const { service, membershipRepo } = setupService()
      const membership = createMembership({ role: 'member' })
      membershipRepo.findOne.mockResolvedValueOnce(membership)

      const req = createRequest()

      await expect(
        service.requireUnikRole(req, 'user-1', 'unik-1')
      ).resolves.toEqual(membership)
    })

    it('allows higher roles to access lower role operations (hierarchy)', async () => {
      const { service, membershipRepo } = setupService()
      
      // Owner should be able to do admin operations
      const ownerMembership = createMembership({ role: 'owner' })
      membershipRepo.findOne.mockResolvedValueOnce(ownerMembership)
      
      const req1 = createRequest()
      await expect(
        service.requireUnikRole(req1, 'user-1', 'unik-1', { allowedRoles: ['admin'] })
      ).resolves.toEqual(ownerMembership)

      // Admin should be able to do editor operations
      const adminMembership = createMembership({ role: 'admin' })
      membershipRepo.findOne.mockResolvedValueOnce(adminMembership)
      
      const req2 = createRequest()
      await expect(
        service.requireUnikRole(req2, 'user-2', 'unik-1', { allowedRoles: ['editor'] })
      ).resolves.toEqual(adminMembership)

      // Editor should be able to do member operations
      const editorMembership = createMembership({ role: 'editor' })
      membershipRepo.findOne.mockResolvedValueOnce(editorMembership)
      
      const req3 = createRequest()
      await expect(
        service.requireUnikRole(req3, 'user-3', 'unik-1', { allowedRoles: ['member'] })
      ).resolves.toEqual(editorMembership)
    })
  })

  describe('chatflow access resolution', () => {
    it('returns false when chatflow link cannot resolve unik', async () => {
      const { service, membershipRepo, queryMock } = setupService()
      membershipRepo.findOne.mockResolvedValue(null)
      queryMock.mockResolvedValue([]) // Empty SQL result

      const req = createRequest()
      const hasAccess = await service.hasChatflowAccess(req, 'user-x', 'flow-x')
      expect(hasAccess).toBe(false)
    })

    it('returns true when chatflow resolves to accessible unik', async () => {
      const { service, membershipRepo, queryMock } = setupService()
      queryMock.mockResolvedValue([{ unikId: 'unik-1' }]) // SQL finds unik
      const membership = createMembership()
      membershipRepo.findOne.mockResolvedValueOnce(membership)

      const req = createRequest()
      const hasAccess = await service.hasChatflowAccess(req, 'user-1', 'flow-1')
      expect(hasAccess).toBe(true)
    })
  })

  describe('error handling', () => {
    it('throws 403 when user not found in membership', async () => {
      const { service, membershipRepo } = setupService()
      membershipRepo.findOne.mockResolvedValueOnce(null)

      const req = createRequest()

      await expect(
        service.requireUnikRole(req, 'user-1', 'unik-1')
      ).rejects.toMatchObject({ status: 403 })
    })
  })
})
