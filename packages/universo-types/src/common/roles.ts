/**
 * Universal role types and utilities for Universo Platformo
 * Provides consistent role definitions across all packages
 *
 * @packageDocumentation
 */

// Base role hierarchy (used by all entity types)
export const BASE_ROLES = ['owner', 'admin', 'editor', 'member'] as const
export type BaseRole = (typeof BASE_ROLES)[number]

// Role hierarchy levels (higher = more permissions)
export const ROLE_HIERARCHY: Record<BaseRole, number> = {
    owner: 4,
    admin: 3,
    editor: 2,
    member: 1
}

// Entity-specific role types
export type MetaverseRole = BaseRole
export type MetahubRole = BaseRole
export type ClusterRole = BaseRole
export type UnikRole = BaseRole
export type ProjectRole = BaseRole
export type OrganizationRole = BaseRole
export type StorageRole = BaseRole
export type CampaignRole = BaseRole
export type SectionRole = Exclude<BaseRole, 'owner'> // Sections don't have separate owners
export type EntityRole = 'viewer' | 'editor' // Entities have simpler roles

/**
 * Roles that can be assigned to new members (excludes 'owner' which is automatically assigned at creation)
 * Used in invite dialogs and role management UI
 */
export type AssignableRole = Exclude<BaseRole, 'owner'>

// Role permission interfaces
export interface BasePermissions {
    manageMembers: boolean
    manageEntity: boolean
    createContent: boolean
    editContent: boolean
    deleteContent: boolean
}

export type RolePermissions = Record<BaseRole, BasePermissions>

// Type guards
export function isValidRole(role: string): role is BaseRole {
    return BASE_ROLES.includes(role as BaseRole)
}

export function isValidMetaverseRole(role: string): role is MetaverseRole {
    return isValidRole(role)
}

export function isValidClusterRole(role: string): role is ClusterRole {
    return isValidRole(role)
}

export function isValidUnikRole(role: string): role is UnikRole {
    return isValidRole(role)
}

export function isValidProjectRole(role: string): role is ProjectRole {
    return isValidRole(role)
}

export function isValidOrganizationRole(role: string): role is OrganizationRole {
    return isValidRole(role)
}

export function isValidStorageRole(role: string): role is StorageRole {
    return isValidRole(role)
}

export function isValidCampaignRole(role: string): role is CampaignRole {
    return isValidRole(role)
}

// Role comparison utilities
export function getRoleLevel(role: BaseRole): number {
    return ROLE_HIERARCHY[role]
}

export function hasRequiredRole(actual: BaseRole, allowed: BaseRole[] = []): boolean {
    if (!allowed.length) return true
    if (allowed.includes(actual)) return true
    const actualLevel = getRoleLevel(actual)
    return allowed.some((allowedRole) => actualLevel > getRoleLevel(allowedRole))
}

export function canManageRole(managerRole: BaseRole, targetRole: BaseRole): boolean {
    return getRoleLevel(managerRole) > getRoleLevel(targetRole)
}
