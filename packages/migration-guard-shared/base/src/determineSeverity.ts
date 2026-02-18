/**
 * Universo Platformo | Shared Migration Guard — Severity Determination
 *
 * Pure utility function to derive UpdateSeverity from migration flags.
 * Used by both metahub and application migration status endpoints.
 */

import { UpdateSeverity } from '@universo/types'

export interface DetermineSeverityOptions {
    /** Whether any migration is required at all. */
    migrationRequired: boolean
    /** Whether the migration involves a mandatory change (structure, missing schema, blockers, etc.). */
    isMandatory: boolean
}

/**
 * Derives the appropriate UpdateSeverity from migration flags.
 *
 * Priority order:
 *   1. If no migration is needed → OPTIONAL
 *   2. If the change is mandatory (structure upgrade, missing schema, blockers) → MANDATORY
 *   3. Otherwise → RECOMMENDED (e.g., template-only or publication-only update)
 */
export function determineSeverity(options: DetermineSeverityOptions): UpdateSeverity {
    const { migrationRequired, isMandatory } = options

    if (!migrationRequired) {
        return UpdateSeverity.OPTIONAL
    }
    if (isMandatory) {
        return UpdateSeverity.MANDATORY
    }
    return UpdateSeverity.RECOMMENDED
}
