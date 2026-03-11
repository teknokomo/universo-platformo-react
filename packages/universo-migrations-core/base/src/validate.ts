import { assertCanonicalPlatformScopeKey } from './identifiers'
import type { MigrationValidationIssue, MigrationValidationResult, PlatformMigrationFile } from './types'

const compareVersions = (left: PlatformMigrationFile, right: PlatformMigrationFile): number => {
    if (left.version === right.version) {
        return left.id.localeCompare(right.id)
    }
    return left.version.localeCompare(right.version)
}

export const sortPlatformMigrations = (migrations: PlatformMigrationFile[]): PlatformMigrationFile[] =>
    [...migrations].sort(compareVersions)

export const validatePlatformMigrations = (migrations: PlatformMigrationFile[]): MigrationValidationResult => {
    const issues: MigrationValidationIssue[] = []
    const ids = new Set<string>()
    const versions = new Map<string, string>()

    for (const migration of migrations) {
        if (!migration.id.trim()) {
            issues.push({ level: 'error', migrationId: migration.id, message: 'Migration id must not be empty' })
        }

        if (ids.has(migration.id)) {
            issues.push({ level: 'error', migrationId: migration.id, message: 'Duplicate migration id detected' })
        }
        ids.add(migration.id)

        if (!migration.version.trim()) {
            issues.push({ level: 'error', migrationId: migration.id, message: 'Migration version must not be empty' })
        }

        const versionOwner = versions.get(migration.version)
        if (versionOwner && versionOwner !== migration.id) {
            issues.push({
                level: 'error',
                migrationId: migration.id,
                message: `Migration version ${migration.version} is duplicated by ${versionOwner}`
            })
        }
        versions.set(migration.version, migration.id)

        if (migration.scope.kind === 'platform_schema') {
            try {
                assertCanonicalPlatformScopeKey(migration.scope.key)
            } catch (error) {
                issues.push({
                    level: 'error',
                    migrationId: migration.id,
                    message: error instanceof Error ? error.message : String(error)
                })
            }
        }

        if (migration.isDestructive && !migration.requiresReview) {
            issues.push({
                level: 'warning',
                migrationId: migration.id,
                message: 'Destructive migration should declare requiresReview=true'
            })
        }

        const lockMode = migration.lockMode ?? 'transaction_advisory'
        const transactionMode = migration.transactionMode ?? 'single'
        if (transactionMode === 'none' && lockMode === 'transaction_advisory') {
            issues.push({
                level: 'error',
                migrationId: migration.id,
                message: 'transactionMode="none" cannot be combined with lockMode="transaction_advisory"'
            })
        }
    }

    const sorted = sortPlatformMigrations(migrations)
    for (let index = 1; index < sorted.length; index += 1) {
        const current = sorted[index]
        const previous = sorted[index - 1]
        if (previous.version > current.version) {
            issues.push({
                level: 'error',
                migrationId: current.id,
                message: `Migration ordering is invalid: ${current.version} is before ${previous.version}`
            })
        }
    }

    return {
        ok: !issues.some((issue) => issue.level === 'error'),
        issues
    }
}
