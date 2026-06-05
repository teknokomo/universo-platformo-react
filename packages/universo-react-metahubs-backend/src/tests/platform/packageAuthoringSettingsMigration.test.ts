jest.mock('@universo-react/database', () => ({
    createKnexExecutor: jest.fn(() => ({ tag: 'executor' })),
    qSchemaTable: jest.fn((schema: string, table: string) => `"${schema}"."${table}"`)
}))

jest.mock('../../domains/packages/services/PackageSeeder', () => ({
    playCanvasEditorPackageName: `@universo-react/${'playcanvas-editor-frontend'}`,
    packageAuthoringSettingsSeedChecksumSource: `builtin-metahub-package-authoring-settings-seed-migration-v1:@universo-react/${'playcanvas-editor-frontend'}:playcanvasEditor`,
    seedPackages: jest.fn(async () => undefined)
}))

import { createKnexExecutor } from '@universo-react/database'
import { seedPackages } from '../../domains/packages/services/PackageSeeder'
import { addPackageAuthoringSettingsMigration } from '../../platform/migrations'

describe('addPackageAuthoringSettingsMigration', () => {
    it('adds package authoring columns, reseeds packages, and backfills legacy empty attachment configs', async () => {
        const knex = {
            raw: jest.fn(async () => undefined)
        }

        await addPackageAuthoringSettingsMigration.up({
            knex: knex as never,
            logger: console,
            runId: 'run-1',
            scope: addPackageAuthoringSettingsMigration.scope,
            raw: jest.fn()
        })

        expect(createKnexExecutor).toHaveBeenCalledWith(knex)
        expect(seedPackages).toHaveBeenCalledWith(
            { tag: 'executor' },
            expect.objectContaining({
                failFast: true,
                packageFilter: expect.any(Function)
            })
        )
        const packageFilter = jest.mocked(seedPackages).mock.calls[0]?.[1]?.packageFilter
        expect(packageFilter?.({ packageName: `@universo-react/${'playcanvas-editor-frontend'}` } as never)).toBe(true)
        expect(packageFilter?.({ packageName: `@universo-react/${'playcanvas-engine'}` } as never)).toBe(false)
        expect(knex.raw).toHaveBeenCalledWith(expect.stringContaining('ADD COLUMN IF NOT EXISTS authoring_surface'))
        expect(knex.raw).toHaveBeenCalledWith(expect.stringContaining('ADD COLUMN IF NOT EXISTS config JSONB'))
        expect(knex.raw).toHaveBeenCalledWith(expect.stringContaining('enforce_authoring_package_slug_owner'))
        expect(knex.raw).toHaveBeenCalledWith(expect.stringContaining('trg_obj_packages_authoring_slug_owner'))
        expect(knex.raw).toHaveBeenCalledWith(expect.stringContaining("authoring_surface ->> 'packageSlug'"))
        expect(knex.raw).toHaveBeenCalledWith(expect.stringContaining("authoring_surface ->> 'kind' = 'playcanvasEditor'"))
        expect(knex.raw).toHaveBeenCalledWith(expect.stringContaining('existing.package_name <> NEW.package_name'))
        expect(knex.raw).toHaveBeenCalledWith(expect.stringContaining("attachment.config = '{}'::jsonb"))
        expect(knex.raw).toHaveBeenCalledWith(expect.stringContaining("pkg.authoring_surface -> 'defaultConfig'"))
        expect(knex.raw).toHaveBeenCalledWith(expect.stringContaining('_upl_version = attachment._upl_version + 1'))
    })
})
