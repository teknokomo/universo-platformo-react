/**
 * Cluster Zod Schemas
 *
 * Validation schemas for Cluster, Domain, and Resource entities.
 * Used for runtime validation and OpenAPI documentation generation.
 */

import { z } from 'zod'

/**
 * Role schema for cluster members
 * Uses the same roles as ClusterRole type from common/roles.ts
 */
export const ClusterRoleSchema = z.enum(['owner', 'admin', 'editor', 'member'])

/**
 * Cluster entity schema
 * Top-level container for domains and resources
 */
export const ClusterSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional().nullable(),
    ownerId: z.string().uuid(),
    domainsCount: z.number().int().min(0).optional(),
    resourcesCount: z.number().int().min(0).optional(),
    membersCount: z.number().int().min(0).optional(),
    createdAt: z.string().datetime(), // ISO string from API
    updatedAt: z.string().datetime()
})

/**
 * Schema for creating a new cluster
 */
export const CreateClusterSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
    description: z.string().max(1000, 'Description must be less than 1000 characters').optional()
})

/**
 * Schema for updating an existing cluster
 */
export const UpdateClusterSchema = CreateClusterSchema.partial()

/**
 * Domain entity schema
 * Container for resources within a cluster
 */
export const DomainSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional().nullable(),
    resourcesCount: z.number().int().min(0).optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
})

/**
 * Schema for creating a new domain
 */
export const CreateDomainSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
    description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
    clusterId: z.string().uuid('Invalid cluster ID')
})

/**
 * Schema for updating an existing domain
 */
export const UpdateDomainSchema = CreateDomainSchema.omit({ clusterId: true }).partial()

/**
 * Resource schema
 * Leaf node in the cluster hierarchy
 */
export const ResourceSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
})

/**
 * Schema for creating a new resource
 */
export const CreateResourceSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
    description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
    domainId: z.string().uuid('Invalid domain ID')
})

/**
 * Schema for updating an existing resource
 */
export const UpdateResourceSchema = CreateResourceSchema.omit({ domainId: true }).partial()

// Type inference exports
export type Cluster = z.infer<typeof ClusterSchema>
export type CreateCluster = z.infer<typeof CreateClusterSchema>
export type UpdateCluster = z.infer<typeof UpdateClusterSchema>
export type Domain = z.infer<typeof DomainSchema>
export type CreateDomain = z.infer<typeof CreateDomainSchema>
export type UpdateDomain = z.infer<typeof UpdateDomainSchema>
export type Resource = z.infer<typeof ResourceSchema>
export type CreateResource = z.infer<typeof CreateResourceSchema>
export type UpdateResource = z.infer<typeof UpdateResourceSchema>
