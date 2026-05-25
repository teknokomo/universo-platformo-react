import { apiClient } from '../../shared'
import type { StructuredBlocker } from '@universo/types'

export type TemplateCleanupMode = 'keep' | 'dry_run' | 'confirm'

export interface TemplateCleanupSummary {
    entitiesDeleted: number
    componentsDeleted: number
    elementsDeleted: number
    settingsDeleted: number
}

export interface TemplateCleanupResult {
    mode: TemplateCleanupMode
    hasChanges: boolean
    blockers: StructuredBlocker[]
    notes: string[]
    summary: TemplateCleanupSummary
}

export interface MetahubMigrationItem {
    id: string
    name: string
    appliedAt: string
    fromVersion: string
    toVersion: string
    meta: Record<string, unknown> | null
}

export interface MetahubMigrationsListResponse {
    items: MetahubMigrationItem[]
    total: number
    limit: number
    offset: number
    branchId: string
    schemaName: string
}

export interface MetahubMigrationsPlanResponse {
    branchId: string
    schemaName: string
    currentStructureVersion: string
    targetStructureVersion: string
    structureUpgradeRequired: boolean
    structurePlan: {
        steps: {
            fromVersion: string
            toVersion: string
            summary: string
            additive: string[]
            destructive: string[]
        }[]
        additive: string[]
        destructive: string[]
        blockers: StructuredBlocker[]
    }
    templateId: string | null
    currentTemplateVersionId: string | null
    currentTemplateVersionLabel: string | null
    targetTemplateVersionId: string | null
    targetTemplateVersionLabel: string | null
    templateUpgradeRequired: boolean
    templatePlan: {
        minStructureVersion: string | null
        structureCompatible: boolean
        seedDryRun: {
            layoutsAdded: number
            zoneWidgetsAdded: number
            settingsAdded: number
            entitiesAdded: number
            constantsAdded: number
            componentsAdded: number
            elementsAdded: number
            skipped: string[]
            hasChanges: boolean
        } | null
        cleanup: TemplateCleanupResult
        blockers: StructuredBlocker[]
    }
}

/** Re-exported from @universo/types for backward compatibility */
export type { MetahubMigrationStatusResponse as MetahubMigrationsStatusResponse } from '@universo/types'

export interface ApplyMetahubMigrationsResponse {
    status: 'dry_run' | 'applied'
    plan?: MetahubMigrationsPlanResponse
    branchId?: string
    schemaName?: string
    structureVersion?: string
    templateVersionId?: string | null
    cleanupMode?: TemplateCleanupMode
    cleanup?: TemplateCleanupResult | null
    latestMigrations?: MetahubMigrationItem[]
}

export const listMetahubMigrations = async (
    metahubId: string,
    params?: { limit?: number; offset?: number; branchId?: string }
): Promise<MetahubMigrationsListResponse> => {
    const response = await apiClient.get<MetahubMigrationsListResponse>(`/metahub/${metahubId}/migrations`, { params })
    return response.data
}

export const planMetahubMigrations = async (
    metahubId: string,
    payload?: { branchId?: string; targetTemplateVersionId?: string; cleanupMode?: TemplateCleanupMode }
): Promise<MetahubMigrationsPlanResponse> => {
    const response = await apiClient.post<MetahubMigrationsPlanResponse>(`/metahub/${metahubId}/migrations/plan`, payload ?? {})
    return response.data
}

export const getMetahubMigrationsStatus = async (
    metahubId: string,
    params?: { branchId?: string; targetTemplateVersionId?: string; cleanupMode?: TemplateCleanupMode }
): Promise<MetahubMigrationsStatusResponse> => {
    const response = await apiClient.get<MetahubMigrationsStatusResponse>(`/metahub/${metahubId}/migrations/status`, { params })
    return response.data
}

export const applyMetahubMigrations = async (
    metahubId: string,
    payload?: { branchId?: string; targetTemplateVersionId?: string; dryRun?: boolean; cleanupMode?: TemplateCleanupMode }
): Promise<ApplyMetahubMigrationsResponse> => {
    const response = await apiClient.post<ApplyMetahubMigrationsResponse>(`/metahub/${metahubId}/migrations/apply`, payload ?? {})
    return response.data
}
