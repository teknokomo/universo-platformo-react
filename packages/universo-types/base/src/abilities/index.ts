/**
 * CASL Abilities for Universo Platformo
 *
 * This module provides type definitions and utilities for building
 * CASL abilities from database permissions.
 *
 * @example
 * ```typescript
 * import { defineAbilitiesFor, AppAbility } from '@universo/types'
 *
 * const permissions = await getUserPermissions(ds, userId)
 * const ability = defineAbilitiesFor(userId, permissions)
 *
 * ability.can('update', 'Metaverse') // true/false
 * ```
 */

import {
    AbilityBuilder,
    createMongoAbility,
    MongoAbility,
    ForcedSubject
} from '@casl/ability'

// ═══════════════════════════════════════════════════════════════
// ACTION TYPES
// ═══════════════════════════════════════════════════════════════

/** CRUD actions plus 'manage' (all) */
export type Actions = 'create' | 'read' | 'update' | 'delete' | 'manage'

// ═══════════════════════════════════════════════════════════════
// SUBJECT TYPES
// ═══════════════════════════════════════════════════════════════

/** All resource types in the platform */
export type Subjects =
    | 'Metaverse'
    | 'Cluster'
    | 'Project'
    | 'Space'
    | 'Storage'
    | 'Organization'
    | 'Campaign'
    | 'Unik'
    | 'Section'
    | 'Entity'
    | 'Canvas'
    | 'Publication'
    | 'Admin'
    | 'Role'
    | 'Instance'
    | 'all'

// ═══════════════════════════════════════════════════════════════
// ABILITY TYPE
// ═══════════════════════════════════════════════════════════════

/** Main ability type for the application */
export type AppAbility = MongoAbility<[Actions, Subjects | ForcedSubject<Subjects>]>

// ═══════════════════════════════════════════════════════════════
// DATABASE PERMISSION TYPE
// ═══════════════════════════════════════════════════════════════

/** Permission record from admin.get_user_permissions() */
export interface DbPermission {
    role_name?: string
    module: string
    action: string
    conditions: Record<string, unknown>
    fields?: string[]
}

// ═══════════════════════════════════════════════════════════════
// MODULE TO SUBJECT MAPPING
// ═══════════════════════════════════════════════════════════════

/** Maps database module names to CASL subject types */
const MODULE_TO_SUBJECT: Record<string, Subjects> = {
    metaverses: 'Metaverse',
    clusters: 'Cluster',
    projects: 'Project',
    spaces: 'Space',
    storages: 'Storage',
    organizations: 'Organization',
    campaigns: 'Campaign',
    uniks: 'Unik',
    sections: 'Section',
    entities: 'Entity',
    canvases: 'Canvas',
    publications: 'Publication',
    admin: 'Admin',
    '*': 'all'
}

/** Maps database action names to CASL actions */
const ACTION_MAP: Record<string, Actions> = {
    create: 'create',
    read: 'read',
    update: 'update',
    delete: 'delete',
    '*': 'manage'
}

// ═══════════════════════════════════════════════════════════════
// ABILITY BUILDER
// ═══════════════════════════════════════════════════════════════

/**
 * Build CASL abilities from database permissions
 *
 * @param userId - Current user ID (for ABAC conditions)
 * @param permissions - Array of permissions from database
 * @returns CASL ability instance
 *
 * @example
 * ```typescript
 * const ability = defineAbilitiesFor(userId, permissions)
 * ability.can('update', 'Metaverse') // Check permission
 * ```
 */
export function defineAbilitiesFor(
    userId: string,
    permissions: DbPermission[]
): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility)

    for (const perm of permissions) {
        const subject = MODULE_TO_SUBJECT[perm.module] || (perm.module as Subjects)
        const action = ACTION_MAP[perm.action] || (perm.action as Actions)

        // Check if there are ABAC conditions
        const hasConditions =
            perm.conditions && Object.keys(perm.conditions).length > 0

        // Check if there are field restrictions
        const hasFields =
            perm.fields &&
            perm.fields.length > 0 &&
            perm.fields[0] !== '*'

        if (hasConditions && hasFields) {
            // Both conditions and fields
            can(action, subject, perm.fields, perm.conditions)
        } else if (hasConditions) {
            // Only conditions
            can(action, subject, perm.conditions)
        } else if (hasFields) {
            // Only fields
            can(action, subject, perm.fields)
        } else {
            // No restrictions
            can(action, subject)
        }
    }

    return build()
}

// ═══════════════════════════════════════════════════════════════
// RE-EXPORT CASL UTILITIES
// ═══════════════════════════════════════════════════════════════

export { ForbiddenError } from '@casl/ability'
