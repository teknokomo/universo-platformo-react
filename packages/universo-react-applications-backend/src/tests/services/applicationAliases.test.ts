import { createMockDbExecutor } from '../utils/dbMocks'
import * as aliasStore from '../../persistence/applicationAliasesStore'
import { ApplicationAliasServiceError, createApplicationAliasesService } from '../../services/applicationAliases'

jest.mock('../../persistence/applicationAliasesStore', () => {
    const actual = jest.requireActual('../../persistence/applicationAliasesStore')
    return {
        ...actual,
        createApplicationAliasAtomically: jest.fn(),
        ensureCanonicalApplicationAliasPrimary: jest.fn(),
        findApplicationAliasForManagement: jest.fn(),
        getApplicationAliasPolicy: jest.fn(),
        getApplicationAliasPolicyForUpdate: jest.fn(),
        listApplicationAliases: jest.fn(),
        listApplicationAliasesByApplication: jest.fn(),
        lockApplicationAliasTransitions: jest.fn(),
        mutateApplicationAlias: jest.fn(),
        updateApplicationAliasPolicy: jest.fn()
    }
})

const mockedStore = jest.mocked(aliasStore)

describe('applicationAliases service', () => {
    const applicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312268'
    const aliasId = '019ccefc-2f7b-7b36-82f4-85cdb1312269'
    const userId = '019ccefc-2f7b-7b36-82f4-85cdb1312271'
    const timestamp = new Date('2026-09-15T10:00:00.000Z')

    const aliasRow = (overrides: Partial<aliasStore.ApplicationAliasRow> = {}): aliasStore.ApplicationAliasRow => ({
        id: aliasId,
        applicationId,
        alias: 'meridian-73',
        isPrimary: false,
        releasedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    })

    beforeEach(() => {
        jest.resetAllMocks()
    })

    it('normalizes aliases and makes the first canonical alias primary', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const inserted = aliasRow({ isPrimary: true })
        mockedStore.getApplicationAliasPolicyForUpdate.mockResolvedValue({ applicationId, routingMode: 'canonical' })
        mockedStore.createApplicationAliasAtomically.mockResolvedValue(inserted)

        const service = createApplicationAliasesService(executor)
        const result = await service.create({ applicationId, alias: '  Meridian-73  ', userId })

        expect(mockedStore.lockApplicationAliasTransitions).toHaveBeenCalledWith(txExecutor, applicationId)
        expect(mockedStore.createApplicationAliasAtomically).toHaveBeenCalledWith(txExecutor, {
            applicationId,
            alias: 'meridian-73',
            makePrimary: false,
            userId
        })
        expect(mockedStore.findApplicationAliasForManagement).not.toHaveBeenCalled()
        expect(result).toMatchObject({ alias: 'meridian-73', isPrimary: true, routingMode: 'canonical' })
    })

    it('maps the active-alias partial unique violation to a reusable conflict code', async () => {
        const { executor } = createMockDbExecutor()
        mockedStore.getApplicationAliasPolicyForUpdate.mockResolvedValue({ applicationId, routingMode: 'direct' })
        mockedStore.createApplicationAliasAtomically.mockRejectedValue({
            code: '23505',
            constraint: aliasStore.APPLICATION_ALIAS_ACTIVE_UNIQUE_INDEX,
            detail: 'Key (alias)=(meridian-73) already exists.'
        })

        const service = createApplicationAliasesService(executor)
        await expect(service.create({ applicationId, alias: 'meridian-73', userId })).rejects.toMatchObject<
            Partial<ApplicationAliasServiceError>
        >({ code: 'APPLICATION_ALIAS_CONFLICT', statusCode: 409 })
    })

    it('uses the returned camelCase application identity when renaming an alias', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const current = aliasRow()
        const updated = aliasRow({ alias: 'meridian-renamed' })
        mockedStore.findApplicationAliasForManagement.mockResolvedValue(current)
        mockedStore.mutateApplicationAlias.mockResolvedValue(updated)
        mockedStore.getApplicationAliasPolicyForUpdate.mockResolvedValue({ applicationId, routingMode: 'canonical' })

        const service = createApplicationAliasesService(executor)
        const result = await service.rename(aliasId, 'meridian-renamed', userId)

        expect(mockedStore.findApplicationAliasForManagement).toHaveBeenCalledWith(txExecutor, aliasId, userId, 'update')
        expect(mockedStore.mutateApplicationAlias).toHaveBeenCalledWith(txExecutor, {
            aliasId,
            alias: 'meridian-renamed',
            operation: 'rename',
            userId
        })
        expect(mockedStore.getApplicationAliasPolicyForUpdate).toHaveBeenCalledWith(txExecutor, applicationId, true)
        expect(result).toMatchObject({ applicationId, alias: 'meridian-renamed', routingMode: 'canonical' })
    })

    it('releases an alias through the guarded mutation that repairs canonical primary selection', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const current = aliasRow({ isPrimary: true })
        const released = aliasRow({ isPrimary: false, releasedAt: new Date('2026-09-15T11:00:00.000Z') })

        mockedStore.findApplicationAliasForManagement.mockResolvedValue(current)
        mockedStore.mutateApplicationAlias.mockResolvedValueOnce(released)

        const service = createApplicationAliasesService(executor)
        await service.release(aliasId, userId)

        expect(mockedStore.findApplicationAliasForManagement).toHaveBeenCalledWith(txExecutor, aliasId, userId, 'delete')
        expect(mockedStore.mutateApplicationAlias).toHaveBeenCalledWith(txExecutor, {
            aliasId,
            operation: 'release',
            userId
        })
        expect(mockedStore.getApplicationAliasPolicyForUpdate).not.toHaveBeenCalled()
        expect(mockedStore.ensureCanonicalApplicationAliasPrimary).not.toHaveBeenCalled()
    })

    it('establishes exactly one primary when switching a populated application to canonical routing', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        mockedStore.getApplicationAliasPolicyForUpdate.mockResolvedValue({ applicationId, routingMode: 'direct' })
        mockedStore.updateApplicationAliasPolicy.mockResolvedValue({ applicationId, routingMode: 'canonical' })
        mockedStore.ensureCanonicalApplicationAliasPrimary.mockResolvedValue(undefined)

        const service = createApplicationAliasesService(executor)
        await expect(service.updatePolicy(applicationId, 'canonical', userId)).resolves.toEqual({
            applicationId,
            routingMode: 'canonical'
        })

        expect(mockedStore.lockApplicationAliasTransitions).toHaveBeenCalledWith(txExecutor, applicationId)
        expect(mockedStore.ensureCanonicalApplicationAliasPrimary).toHaveBeenCalledWith(txExecutor, applicationId, userId)
    })

    it('rejects non-v7 application identifiers before touching persistence', async () => {
        const { executor } = createMockDbExecutor()
        const service = createApplicationAliasesService(executor)

        await expect(
            service.create({ applicationId: '550e8400-e29b-41d4-a716-446655440000', alias: 'meridian-73', userId })
        ).rejects.toMatchObject<Partial<ApplicationAliasServiceError>>({ code: 'APPLICATION_ID_INVALID', statusCode: 400 })
        expect(mockedStore.lockApplicationAliasTransitions).not.toHaveBeenCalled()
    })
})
