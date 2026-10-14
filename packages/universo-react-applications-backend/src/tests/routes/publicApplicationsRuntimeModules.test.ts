import {
    applicationId,
    schemaName,
    withPublicApplication,
    buildDataSource,
    buildApp,
    request,
    installPublicApplicationsTestHooks
} from './publicApplicationsRoutes.testSupport'

describe('Public Applications Routes: runtime modules', () => {
    installPublicApplicationsTestHooks()

    it('rejects a malformed module id with a generic body before any module lookup', async () => {
        const moduleLookupQueries: string[] = []
        const dataSource = buildDataSource(
            withPublicApplication((sql) => {
                if (sql.includes('_app_modules') || sql.includes('to_regclass')) {
                    moduleLookupQueries.push(sql)
                }
                return undefined
            })
        )

        const app = buildApp(dataSource)
        const response = await request(app).get(`/public/a/${applicationId}/runtime/modules/not-a-uuid/client`).expect(404)

        expect(response.body).toEqual({ error: 'Runtime module not found' })
        expect(JSON.stringify(response.body)).not.toMatch(/invalid input syntax|pg_|constraint/i)
        expect(moduleLookupQueries).toEqual([])
    })

    it('rejects malformed public runtime module filters before opening the application context', async () => {
        const dataSource = buildDataSource()
        const app = buildApp(dataSource)

        const response = await request(app)
            .get(`/public/a/${applicationId}/runtime/modules?attachedToKind=bad%20kind&attachedToId=not-a-uuid`)
            .expect(400)

        expect(response.body.error).toBe('Invalid runtime module query')
        expect(dataSource.query).not.toHaveBeenCalled()
    })

    it('returns the existing generic not-found contract for a valid but missing module id', async () => {
        const missingModuleId = '019ccefc-2f7b-7b36-82f4-85cdb1312272'
        let moduleLookupRan = false
        const dataSource = buildDataSource(
            withPublicApplication((sql) => {
                if (sql.includes('to_regclass')) {
                    return [{ table_name: `${schemaName}._app_modules` }]
                }
                if (sql.includes(`FROM "${schemaName}"."_app_modules"`)) {
                    moduleLookupRan = true
                    return []
                }
                return undefined
            })
        )

        const app = buildApp(dataSource)
        const response = await request(app).get(`/public/a/${applicationId}/runtime/modules/${missingModuleId}/client`).expect(404)

        expect(moduleLookupRan).toBe(true)
        expect(response.body).toEqual({ error: 'Runtime module not found' })
        expect(JSON.stringify(response.body)).not.toMatch(/invalid input syntax|pg_|constraint/i)
    })

    it('redacts raw database errors from anonymous client bundle requests and logs them server-side', async () => {
        const moduleId = '019ccefc-2f7b-7b36-82f4-85cdb1312272'
        const dataSource = buildDataSource(
            withPublicApplication((sql) => {
                if (sql.includes('to_regclass')) {
                    return [{ table_name: `${schemaName}._app_modules` }]
                }
                if (sql.includes(`FROM "${schemaName}"."_app_modules"`)) {
                    throw new Error(
                        'invalid input syntax for type uuid: "019ccefc" (relation "pg_catalog.pg_class" constraint "obj_application_aliases_pkey")'
                    )
                }
                return undefined
            })
        )
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)

        try {
            const app = buildApp(dataSource)
            const response = await request(app).get(`/public/a/${applicationId}/runtime/modules/${moduleId}/client`).expect(404)

            expect(response.body).toEqual({ error: 'Runtime module not found' })
            expect(JSON.stringify(response.body)).not.toMatch(/invalid input syntax|pg_|constraint/i)
            expect(consoleError).toHaveBeenCalledWith(expect.stringContaining(moduleId), expect.any(Error))
        } finally {
            consoleError.mockRestore()
        }
    })
})
