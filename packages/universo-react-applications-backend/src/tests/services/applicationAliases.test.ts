import { createMockDbExecutor } from '../utils/dbMocks'
import * as aliasStore from '../../persistence/applicationAliasesStore'
import { ApplicationAliasServiceError, createApplicationAliasesService } from '../../services/applicationAliases'

jest.mock('../../persistence/applicationAliasesStore', () => {
    const actual = jest.requireActual('../../persistence/applicationAliasesStore')
    return {
        ...actual,
        clearOtherPrimaryApplicationAliases: jest.fn(),
        createApplicationAliasAtomically: jest.fn(),
        findApplicationAliasById: jest.fn(),
        findApplicationAliasByIdForUpdate: jest.fn(),
        getApplicationAliasPolicy: jest.fn(),
        getApplicationAliasPolicyForUpdate: jest.fn(),
        listActiveApplicationAliasesForUpdate: jest.fn(),
        listApplicationAliases: jest.fn(),
        listApplicationAliasesByApplication: jest.fn(),
        lockApplicationAliasTransitions: jest.fn(),
        releaseApplicationAlias: jest.fn(),
        setApplicationAliasPrimary: jest.fn(),
        updateApplicationAliasPolicy: jest.fn(),
        updateApplicationAliasValue: jest.fn()
    }
})

const mockedStore = jest.mocked(aliasStore)

describe('applicationAliases service', () => {
    const applicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312268'
    const aliasId = '019ccefc-2f7b-7b36-82f4-85cdb1312269'
    const secondAliasId = '019ccefc-2f7b-7b36-82f4-85cdb1312270'
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
        mockedStore.findApplicationAliasByIdForUpdate.mockResolvedValue(inserted)

        const service = createApplicationAliasesService(executor)
        const result = await service.create({ applicationId, alias: '  Meridian-73  ', userId })

        expect(mockedStore.lockApplicationAliasTransitions).toHaveBeenCalledWith(txExecutor, applicationId)
        expect(mockedStore.createApplicationAliasAtomically).toHaveBeenCalledWith(txExecutor, {
            applicationId,
            alias: 'meridian-73',
            makePrimary: false,
            userId
        })
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

    it('releases a primary alias and deterministically promotes the remaining canonical alias in the same transaction', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const current = aliasRow({ isPrimary: true })
        const released = aliasRow({ isPrimary: false, releasedAt: new Date('2026-09-15T11:00:00.000Z') })
        const remaining = aliasRow({ id: secondAliasId, alias: 'om73', isPrimary: false })
        const promoted = { ...remaining, isPrimary: true }

        mockedStore.findApplicationAliasById.mockResolvedValue(current)
        mockedStore.findApplicationAliasByIdForUpdate.mockResolvedValue(current)
        mockedStore.getApplicationAliasPolicyForUpdate.mockResolvedValue({ applicationId, routingMode: 'canonical' })
        mockedStore.releaseApplicationAlias.mockResolvedValue(released)
        mockedStore.listActiveApplicationAliasesForUpdate.mockResolvedValue([remaining])
        mockedStore.clearOtherPrimaryApplicationAliases.mockResolvedValue([])
        mockedStore.setApplicationAliasPrimary.mockResolvedValue(promoted)

        const service = createApplicationAliasesService(executor)
        await service.release(aliasId, userId)

        expect(mockedStore.lockApplicationAliasTransitions).toHaveBeenCalledWith(txExecutor, applicationId)
        expect(mockedStore.releaseApplicationAlias).toHaveBeenCalledWith(txExecutor, aliasId, userId)
        expect(mockedStore.setApplicationAliasPrimary).toHaveBeenCalledWith(txExecutor, applicationId, secondAliasId, userId)
    })

    it('establishes exactly one primary when switching a populated application to canonical routing', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const onlyAlias = aliasRow({ isPrimary: false })
        mockedStore.getApplicationAliasPolicyForUpdate.mockResolvedValue({ applicationId, routingMode: 'direct' })
        mockedStore.updateApplicationAliasPolicy.mockResolvedValue({ applicationId, routingMode: 'canonical' })
        mockedStore.listActiveApplicationAliasesForUpdate.mockResolvedValue([onlyAlias])
        mockedStore.clearOtherPrimaryApplicationAliases.mockResolvedValue([])
        mockedStore.setApplicationAliasPrimary.mockResolvedValue({ ...onlyAlias, isPrimary: true })

        const service = createApplicationAliasesService(executor)
        await expect(service.updatePolicy(applicationId, 'canonical', userId)).resolves.toEqual({
            applicationId,
            routingMode: 'canonical'
        })

        expect(mockedStore.lockApplicationAliasTransitions).toHaveBeenCalledWith(txExecutor, applicationId)
        expect(mockedStore.setApplicationAliasPrimary).toHaveBeenCalledWith(txExecutor, applicationId, aliasId, userId)
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
