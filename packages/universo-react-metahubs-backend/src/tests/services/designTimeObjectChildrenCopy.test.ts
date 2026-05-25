import { copyDesignTimeObjectChildren } from '../../domains/entities/services/designTimeObjectChildrenCopy'

describe('copyDesignTimeObjectChildren', () => {
    const schemaName = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'

    it('copies components, elements, constants, and enumeration values through the shared helper', async () => {
        const tx = {
            query: jest
                .fn()
                .mockResolvedValueOnce([
                    {
                        id: 'attr-1',
                        codename: { _primary: 'en', locales: { en: { content: 'Title' } } },
                        data_type: 'STRING',
                        presentation: { name: { en: 'Title' } },
                        validation_rules: {},
                        ui_config: {},
                        sort_order: 1,
                        is_required: false,
                        is_display_component: true,
                        target_object_id: 'source-1',
                        target_object_kind: 'custom-order',
                        target_constant_id: null,
                        parent_component_id: null,
                        is_system: false,
                        system_key: null,
                        is_system_managed: false,
                        is_system_enabled: true
                    }
                ])
                .mockResolvedValueOnce([{ id: 'attr-copy-1' }])
                .mockResolvedValueOnce([{ data: { title: 'Sample' }, sort_order: 1, owner_id: null }])
                .mockResolvedValueOnce([{ id: 'elem-copy-1' }])
                .mockResolvedValueOnce([
                    {
                        codename: { _primary: 'en', locales: { en: { content: 'Open' } } },
                        presentation: { name: { en: 'Open' } },
                        sort_order: 1,
                        is_default: false
                    }
                ])
                .mockResolvedValueOnce([{ id: 'value-copy-1' }])
        }
        const fixedValuesService = {
            findAll: jest.fn().mockResolvedValue([
                {
                    codename: { _primary: 'en', locales: { en: { content: 'TaxRate' } } },
                    dataType: 'NUMBER',
                    name: { en: 'Tax Rate' },
                    validationRules: {},
                    uiConfig: {},
                    value: 20,
                    sortOrder: 1
                }
            ]),
            ensureUniqueCodenameWithRetries: jest.fn().mockResolvedValue('TaxRate'),
            create: jest.fn().mockResolvedValue({ id: 'const-copy-1' })
        }

        const result = await copyDesignTimeObjectChildren({
            metahubId: 'metahub-1',
            sourceObjectId: 'source-1',
            targetObjectId: 'target-1',
            tx: tx as any,
            userId: 'user-1',
            schemaName,
            copyComponents: true,
            copyRecords: true,
            copyFixedValues: true,
            copyOptionValues: true,
            codenameStyle: 'pascal-case',
            codenameAlphabet: 'en-ru',
            fixedValuesService
        })

        expect(result).toEqual({
            componentsCopied: 1,
            recordsCopied: 1,
            fixedValuesCopied: 1,
            optionValuesCopied: 1
        })
        expect(tx.query.mock.calls[1][1][9]).toBe('target-1')
        expect(fixedValuesService.ensureUniqueCodenameWithRetries).toHaveBeenCalledWith(
            expect.objectContaining({
                valueGroupId: 'target-1',
                desiredCodename: 'TaxRate',
                codenameStyle: 'pascal-case'
            })
        )
        expect(fixedValuesService.create).toHaveBeenCalledWith(
            'metahub-1',
            expect.objectContaining({
                valueGroupId: 'target-1',
                sortOrder: 1,
                value: 20
            }),
            'user-1',
            tx
        )
    })

    it('replays source system states when system rows must be reseeded without component copy', async () => {
        const tx = {
            query: jest.fn().mockResolvedValue([
                { system_key: 'app.deleted', is_system_enabled: false },
                { system_key: 'app.deleted_at', is_system_enabled: false }
            ])
        }
        const ensureObjectSystemComponents = jest.fn().mockResolvedValue([])

        const result = await copyDesignTimeObjectChildren({
            metahubId: 'metahub-1',
            sourceObjectId: 'source-object',
            targetObjectId: 'target-object',
            tx: tx as any,
            userId: 'user-1',
            schemaName,
            ensureObjectSystemComponents,
            platformSystemComponentsPolicy: {
                allowConfiguration: false,
                forceCreate: true,
                ignoreMetahubSettings: true
            }
        })

        expect(result).toEqual({
            componentsCopied: 0,
            recordsCopied: 0,
            fixedValuesCopied: 0,
            optionValuesCopied: 0
        })
        expect(ensureObjectSystemComponents).toHaveBeenCalledWith('metahub-1', 'target-object', 'user-1', tx, {
            states: [
                { key: 'app.deleted', enabled: false },
                { key: 'app.deleted_at', enabled: false }
            ],
            policy: {
                allowConfiguration: false,
                forceCreate: true,
                ignoreMetahubSettings: true
            }
        })
    })
})
