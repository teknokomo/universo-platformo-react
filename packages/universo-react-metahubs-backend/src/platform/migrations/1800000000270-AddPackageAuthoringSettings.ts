import type { PlatformMigrationFile } from '@universo-react/migrations-core'
import type { Knex } from 'knex'
import { createKnexExecutor } from '@universo-react/database'
import {
    packageAuthoringSettingsSeedChecksumSource,
    playCanvasEditorPackageName,
    seedPackages
} from '../../domains/packages/services/PackageSeeder'

export const addPackageAuthoringSettingsMigration: PlatformMigrationFile = {
    id: 'AddMetahubPackageAuthoringSettings1800000000270',
    version: '1800000000270',
    scope: {
        kind: 'platform_schema',
        key: 'metahubs'
    },
    sourceKind: 'file',
    checksumSource: packageAuthoringSettingsSeedChecksumSource,
    transactionMode: 'single',
    lockMode: 'transaction_advisory',
    summary: 'Add authoring surface metadata and per-metahub package attachment config',
    async up(ctx) {
        await ctx.knex.raw(`
            ALTER TABLE metahubs.obj_packages
                ADD COLUMN IF NOT EXISTS authoring_surface JSONB NOT NULL DEFAULT '{}'::jsonb
        `)
        await ctx.knex.raw(`
            ALTER TABLE metahubs.rel_metahub_packages
                ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb
        `)
        await ctx.knex.raw(`
            CREATE OR REPLACE FUNCTION metahubs.enforce_authoring_package_slug_owner()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $$
            DECLARE
                next_slug text := NEW.authoring_surface ->> 'packageSlug';
                next_kind text := NEW.authoring_surface ->> 'kind';
            BEGIN
                IF NEW._upl_deleted = false
                   AND NEW._app_deleted = false
                   AND NEW.is_active = true
                   AND next_kind = 'playcanvasEditor'
                   AND next_slug IS NOT NULL
                   AND next_slug <> ''
                   AND EXISTS (
                       SELECT 1
                       FROM metahubs.obj_packages existing
                       WHERE existing.id <> NEW.id
                         AND existing._upl_deleted = false
                         AND existing._app_deleted = false
                         AND existing.is_active = true
                         AND existing.authoring_surface ->> 'kind' = 'playcanvasEditor'
                         AND existing.authoring_surface ->> 'packageSlug' = next_slug
                         AND existing.package_name <> NEW.package_name
                   ) THEN
                    RAISE EXCEPTION 'authoring package slug % is already used by another package', next_slug
                        USING ERRCODE = 'unique_violation';
                END IF;

                RETURN NEW;
            END;
            $$
        `)
        await ctx.knex.raw(`
            DROP TRIGGER IF EXISTS trg_obj_packages_authoring_slug_owner
            ON metahubs.obj_packages
        `)
        await ctx.knex.raw(`
            CREATE TRIGGER trg_obj_packages_authoring_slug_owner
            BEFORE INSERT OR UPDATE OF authoring_surface, package_name, is_active, _upl_deleted, _app_deleted
            ON metahubs.obj_packages
            FOR EACH ROW
            EXECUTE FUNCTION metahubs.enforce_authoring_package_slug_owner()
        `)
        await seedPackages(createKnexExecutor(ctx.knex as Knex), {
            failFast: true,
            packageFilter: (seed) => seed.packageName === playCanvasEditorPackageName
        })
        await ctx.knex.raw(`
            UPDATE metahubs.rel_metahub_packages AS attachment
            SET config = COALESCE(pkg.authoring_surface -> 'defaultConfig', '{"schemaVersion":"1","kind":"none"}'::jsonb),
                _upl_updated_at = now(),
                _upl_version = attachment._upl_version + 1
            FROM metahubs.obj_packages AS pkg
            WHERE pkg.id = attachment.package_id
              AND attachment.is_active = true
              AND attachment._upl_deleted = false
              AND attachment._app_deleted = false
              AND (
                  attachment.config IS NULL
                  OR attachment.config = '{}'::jsonb
              )
        `)
    }
}
