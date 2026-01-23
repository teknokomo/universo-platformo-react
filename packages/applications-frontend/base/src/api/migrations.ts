/**
 * Universo Platformo | Migrations API Client
 *
 * API functions for application schema migrations management.
 */

import apiClient from './apiClient'

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface MigrationListItem {
    id: string
    name: string
    appliedAt: string
    hasDestructive: boolean
    summary: string
    changesCount: number
    hasSeedWarnings?: boolean
}

export interface MigrationChangeRecord {
    type: string
    entityCodename?: string
    fieldCodename?: string
    tableName?: string
    columnName?: string
    isDestructive: boolean
    description: string
}

export interface MigrationDetail {
    id: string
    name: string
    appliedAt: string
    hasDestructive: boolean
    summary: string
    changes: MigrationChangeRecord[]
    snapshotBefore: Record<string, unknown> | null
    snapshotAfter: Record<string, unknown>
    seedWarnings?: string[]
}

export interface MigrationsListResponse {
    items: MigrationListItem[]
    total: number
    limit: number
    offset: number
}

export interface RollbackAnalysis {
    migrationId: string
    migrationName: string
    canRollback: boolean
    blockers: string[]
    warnings: string[]
    rollbackChanges: string[]
}

export interface RollbackResult {
    status: 'rolled_back' | 'pending_confirmation'
    message: string
    warnings?: string[]
    rollbackChanges?: string[]
    changesApplied?: number
    rolledBackMigrations?: string[]
    currentMigration?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// API Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch list of migrations for an application
 */
export async function fetchMigrations(
    applicationId: string,
    params?: { limit?: number; offset?: number }
): Promise<MigrationsListResponse> {
    const response = await apiClient.get<MigrationsListResponse>(
        `/application/${applicationId}/migrations`,
        { params }
    )
    return response.data
}

/**
 * Fetch a single migration with full details
 */
export async function fetchMigration(
    applicationId: string,
    migrationId: string
): Promise<MigrationDetail> {
    const response = await apiClient.get<MigrationDetail>(
        `/application/${applicationId}/migration/${migrationId}`
    )
    return response.data
}

/**
 * Analyze if rollback to a migration is possible
 */
export async function analyzeMigrationRollback(
    applicationId: string,
    migrationId: string
): Promise<RollbackAnalysis> {
    const response = await apiClient.get<RollbackAnalysis>(
        `/application/${applicationId}/migration/${migrationId}/analyze`
    )
    return response.data
}

/**
 * Rollback to a specific migration
 */
export async function rollbackMigration(
    applicationId: string,
    migrationId: string,
    confirmDestructive = false
): Promise<RollbackResult> {
    const response = await apiClient.post<RollbackResult>(
        `/application/${applicationId}/migration/${migrationId}/rollback`,
        { confirmDestructive }
    )
    return response.data
}
