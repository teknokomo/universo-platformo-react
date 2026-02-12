import { apiClient } from '../../shared'

export type TemplateCleanupMode = 'keep' | 'dry_run' | 'confirm'

export interface TemplateCleanupSummary {
    entitiesDeleted: number
    attributesDeleted: number
    elementsDeleted: number
    settingsDeleted: number
}

export interface TemplateCleanupResult {
    mode: TemplateCleanupMode
    hasChanges: boolean
    blockers: string[]
    notes: string[]
    summary: TemplateCleanupSummary
}

export interface MetahubMigrationItem {
    id: string
    name: string
    appliedAt: string
    fromVersion: number
    toVersion: number
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
    currentStructureVersion: number
    targetStructureVersion: number
    structureUpgradeRequired: boolean
    structurePlan: {
        steps: {
            fromVersion: number
            toVersion: number
            summary: string
            additive: string[]
            destructive: string[]
        }[]
        additive: string[]
        destructive: string[]
        blockers: string[]
    }
    templateId: string | null
    currentTemplateVersionId: string | null
    currentTemplateVersionLabel: string | null
    targetTemplateVersionId: string | null
    targetTemplateVersionLabel: string | null
    templateUpgradeRequired: boolean
    templatePlan: {
        minStructureVersion: number | null
        structureCompatible: boolean
        seedDryRun: {
            layoutsAdded: number
            zoneWidgetsAdded: number
            settingsAdded: number
            entitiesAdded: number
            attributesAdded: number
            elementsAdded: number
            skipped: string[]
            hasChanges: boolean
        } | null
        cleanup: TemplateCleanupResult
        blockers: string[]
    }
}

export interface MetahubMigrationsStatusResponse {
    branchId: string
    schemaName: string
    currentStructureVersion: number
    targetStructureVersion: number
    structureUpgradeRequired: boolean
    templateUpgradeRequired: boolean
    migrationRequired: boolean
    blockers: string[]
    status: 'up_to_date' | 'requires_migration' | 'blocked'
    code: 'UP_TO_DATE' | 'MIGRATION_REQUIRED' | 'MIGRATION_BLOCKED'
    currentTemplateVersionId: string | null
    currentTemplateVersionLabel: string | null
    targetTemplateVersionId: string | null
    targetTemplateVersionLabel: string | null
}

export interface ApplyMetahubMigrationsResponse {
    status: 'dry_run' | 'applied'
    plan?: MetahubMigrationsPlanResponse
    branchId?: string
    schemaName?: string
    structureVersion?: number
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
