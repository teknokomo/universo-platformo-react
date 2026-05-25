import { DEFAULT_LEDGER_CONFIG, type ResolvedEntityType } from '@universo/types'

import { validateLedgerConfigReferencesForEntity } from '../../domains/entities/controllers/entityControllerShared'

const buildLedgerType = (): ResolvedEntityType =>
    ({
        kindKey: 'ledger',
        capabilities: {
            dataSchema: { enabled: true },
            physicalTable: { enabled: true },
            ledgerSchema: { enabled: true }
        },
        ui: {
            iconName: 'Database',
            tabs: [],
            sidebarSection: 'objects',
            nameKey: 'entities.ledger.name'
        }
    } as ResolvedEntityType)

describe('entityControllerShared ledger config validation', () => {
    it('allows creating a ledger before field definitions exist', async () => {
        const componentsService = {
            findAllFlat: jest.fn()
        }

        await expect(
            validateLedgerConfigReferencesForEntity({
                resolvedType: buildLedgerType(),
                config: { ledger: DEFAULT_LEDGER_CONFIG },
                metahubId: 'metahub-1',
                objectId: null,
                userId: 'user-1',
                componentsService: componentsService as never
            })
        ).resolves.toBeUndefined()
        expect(componentsService.findAllFlat).not.toHaveBeenCalled()
    })

    it('rejects updating a ledger when schema references missing fields', async () => {
        const componentsService = {
            findAllFlat: jest.fn(async () => [])
        }

        await expect(
            validateLedgerConfigReferencesForEntity({
                resolvedType: buildLedgerType(),
                config: { ledger: DEFAULT_LEDGER_CONFIG },
                metahubId: 'metahub-1',
                objectId: 'ledger-1',
                userId: 'user-1',
                componentsService: componentsService as never
            })
        ).rejects.toMatchObject({
            message: 'Ledger schema config contains invalid field references',
            details: {
                field: 'config.ledger'
            }
        })
        expect(componentsService.findAllFlat).toHaveBeenCalledWith('metahub-1', 'ledger-1', 'user-1', 'business')
    })
})
