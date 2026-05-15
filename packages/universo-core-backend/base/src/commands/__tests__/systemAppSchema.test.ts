const mockPlanRegisteredSystemAppSchemaGenerationPlans = jest.fn()
const mockCompileRegisteredSystemAppSchemaDefinitionArtifacts = jest.fn()
const mockApplyRegisteredSystemAppSchemaGenerationPlans = jest.fn()
const mockBootstrapRegisteredSystemAppStructureMetadata = jest.fn()
const mockInitKnex = jest.fn()
const mockDestroyKnex = jest.fn().mockResolvedValue(undefined)
const mockGetKnex = jest.fn(() => ({ tag: 'knex' }))
const mockLoggerError = jest.fn()

jest.mock(
    '@universo/migrations-platform',
    () => ({
        planRegisteredSystemAppSchemaGenerationPlans: mockPlanRegisteredSystemAppSchemaGenerationPlans,
        compileRegisteredSystemAppSchemaDefinitionArtifacts: mockCompileRegisteredSystemAppSchemaDefinitionArtifacts,
        applyRegisteredSystemAppSchemaGenerationPlans: mockApplyRegisteredSystemAppSchemaGenerationPlans,
        bootstrapRegisteredSystemAppStructureMetadata: mockBootstrapRegisteredSystemAppStructureMetadata
    }),
    { virtual: true }
)

jest.mock(
    '@universo/database',
    () => ({
        initKnex: mockInitKnex,
        destroyKnex: mockDestroyKnex,
        getKnex: mockGetKnex
    }),
    { virtual: true }
)

jest.mock('../../utils/logger', () => ({
    __esModule: true,
    default: {
        error: mockLoggerError
    }
}))

import SystemAppSchema from '../system-app-schema'

describe('system-app-schema command', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockPlanRegisteredSystemAppSchemaGenerationPlans.mockReturnValue([
            {
                definitionKey: 'profiles',
                schemaName: 'profiles',
                stage: 'target',
                storageModel: 'application_like'
            }
        ])
        mockCompileRegisteredSystemAppSchemaDefinitionArtifacts.mockReturnValue([
            {
                plan: {
                    definitionKey: 'profiles',
                    schemaName: 'profiles',
                    stage: 'target',
                    storageModel: 'application_like'
                },
                artifacts: [
                    {
                        schemaQualifiedName: 'system_app_compiled.schema.target.profiles.profiles'
                    }
                ]
            }
        ])
        mockApplyRegisteredSystemAppSchemaGenerationPlans.mockResolvedValue({
            applied: [
                {
                    definitionKey: 'profiles',
                    schemaName: 'profiles',
                    stage: 'target',
                    storageModel: 'application_like',
                    tablesCreated: ['_app_settings']
                }
            ]
        })
        mockBootstrapRegisteredSystemAppStructureMetadata.mockResolvedValue({
            bootstrapped: [
                {
                    definitionKey: 'profiles',
                    schemaName: 'profiles',
                    stage: 'target',
                    storageModel: 'application_like',
                    metadataObjectCount: 1,
                    metadataAttributeCount: 12,
                    systemTables: ['_app_migrations', '_app_settings', '_app_objects', '_app_components']
                }
            ]
        })
    })

    it('plans registered system app schema waves by default', async () => {
        const command = new SystemAppSchema([], {} as never)
        jest.spyOn(command, 'parse').mockResolvedValue({
            flags: {
                action: 'plan',
                stage: 'target',
                keys: 'profiles,metahubs'
            }
        } as never)
        const logSpy = jest.spyOn(command, 'log').mockImplementation()

        await command.run()

        expect(mockInitKnex).toHaveBeenCalledTimes(1)
        expect(mockPlanRegisteredSystemAppSchemaGenerationPlans).toHaveBeenCalledWith('target', ['profiles', 'metahubs'])
        expect(mockCompileRegisteredSystemAppSchemaDefinitionArtifacts).toHaveBeenCalledWith('target', ['profiles', 'metahubs'])
        expect(mockApplyRegisteredSystemAppSchemaGenerationPlans).not.toHaveBeenCalled()
        expect(logSpy).toHaveBeenCalledWith(
            JSON.stringify(
                {
                    stage: 'target',
                    plans: [
                        {
                            definitionKey: 'profiles',
                            schemaName: 'profiles',
                            stage: 'target',
                            storageModel: 'application_like'
                        }
                    ],
                    compiledArtifacts: [
                        {
                            plan: {
                                definitionKey: 'profiles',
                                schemaName: 'profiles',
                                stage: 'target',
                                storageModel: 'application_like'
                            },
                            artifacts: [
                                {
                                    schemaQualifiedName: 'system_app_compiled.schema.target.profiles.profiles'
                                }
                            ]
                        }
                    ]
                },
                null,
                2
            )
        )
        expect(mockDestroyKnex).toHaveBeenCalledTimes(1)
    })

    it('bootstraps registered system app metadata when requested', async () => {
        const command = new SystemAppSchema([], {} as never)
        jest.spyOn(command, 'parse').mockResolvedValue({
            flags: {
                action: 'bootstrap',
                stage: 'target',
                keys: 'profiles'
            }
        } as never)
        const logSpy = jest.spyOn(command, 'log').mockImplementation()

        await command.run()

        expect(mockGetKnex).toHaveBeenCalledTimes(1)
        expect(mockPlanRegisteredSystemAppSchemaGenerationPlans).not.toHaveBeenCalled()
        expect(mockCompileRegisteredSystemAppSchemaDefinitionArtifacts).not.toHaveBeenCalled()
        expect(mockApplyRegisteredSystemAppSchemaGenerationPlans).not.toHaveBeenCalled()
        expect(mockBootstrapRegisteredSystemAppStructureMetadata).toHaveBeenCalledWith(
            { tag: 'knex' },
            {
                stage: 'target',
                keys: ['profiles']
            }
        )
        expect(logSpy).toHaveBeenCalledWith(
            JSON.stringify(
                {
                    bootstrapped: [
                        {
                            definitionKey: 'profiles',
                            schemaName: 'profiles',
                            stage: 'target',
                            storageModel: 'application_like',
                            metadataObjectCount: 1,
                            metadataAttributeCount: 12,
                            systemTables: ['_app_migrations', '_app_settings', '_app_objects', '_app_components']
                        }
                    ]
                },
                null,
                2
            )
        )
        expect(mockDestroyKnex).toHaveBeenCalledTimes(1)
    })

    it('applies registered system app schema waves when requested', async () => {
        const command = new SystemAppSchema([], {} as never)
        jest.spyOn(command, 'parse').mockResolvedValue({
            flags: {
                action: 'apply',
                stage: 'current',
                keys: 'profiles'
            }
        } as never)
        const logSpy = jest.spyOn(command, 'log').mockImplementation()

        await command.run()

        expect(mockGetKnex).toHaveBeenCalledTimes(1)
        expect(mockCompileRegisteredSystemAppSchemaDefinitionArtifacts).not.toHaveBeenCalled()
        expect(mockApplyRegisteredSystemAppSchemaGenerationPlans).toHaveBeenCalledWith(
            { tag: 'knex' },
            {
                stage: 'current',
                keys: ['profiles']
            }
        )
        expect(logSpy).toHaveBeenCalledWith(
            JSON.stringify(
                {
                    applied: [
                        {
                            definitionKey: 'profiles',
                            schemaName: 'profiles',
                            stage: 'target',
                            storageModel: 'application_like',
                            tablesCreated: ['_app_settings']
                        }
                    ]
                },
                null,
                2
            )
        )
        expect(mockDestroyKnex).toHaveBeenCalledTimes(1)
    })

    it('logs and rethrows command failures', async () => {
        const command = new SystemAppSchema([], {} as never)
        const error = new Error('plan failed')
        jest.spyOn(command, 'parse').mockResolvedValue({
            flags: {
                action: 'plan',
                stage: 'target',
                keys: undefined
            }
        } as never)
        mockPlanRegisteredSystemAppSchemaGenerationPlans.mockImplementation(() => {
            throw error
        })

        await expect(command.run()).rejects.toThrow('plan failed')

        expect(mockLoggerError).toHaveBeenCalledWith('[system-app-schema] Command failed', error)
        expect(mockDestroyKnex).toHaveBeenCalledTimes(1)
    })
})
