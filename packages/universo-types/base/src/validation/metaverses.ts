/**
 * Metaverse Zod Schemas
 *
 * Validation schemas for Metaverse, Section, and Entity entities.
 * Used for runtime validation and OpenAPI documentation generation.
 */

import { z } from 'zod'

/**
 * Role schema for metaverse members
 * Uses the same roles as MetaverseRole type from common/roles.ts
 */
export const MetaverseRoleSchema = z.enum(['owner', 'admin', 'editor', 'member'])

/**
 * Metaverse entity schema
 * Top-level container for sections and entities
 */
export const MetaverseSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional().nullable(),
    ownerId: z.string().uuid(),
    sectionsCount: z.number().int().min(0).optional(),
    entitiesCount: z.number().int().min(0).optional(),
    membersCount: z.number().int().min(0).optional(),
    createdAt: z.string().datetime(), // ISO string from API
    updatedAt: z.string().datetime()
})

/**
 * Schema for creating a new metaverse
 */
export const CreateMetaverseSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
    description: z.string().max(1000, 'Description must be less than 1000 characters').optional()
})

/**
 * Schema for updating an existing metaverse
 */
export const UpdateMetaverseSchema = CreateMetaverseSchema.partial()

/**
 * Section entity schema
 * Container for entities within a metaverse
 */
export const SectionSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional().nullable(),
    entitiesCount: z.number().int().min(0).optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
})

/**
 * Schema for creating a new section
 */
export const CreateSectionSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
    description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
    metaverseId: z.string().uuid('Invalid metaverse ID')
})

/**
 * Schema for updating an existing section
 */
export const UpdateSectionSchema = CreateSectionSchema.omit({ metaverseId: true }).partial()

/**
 * Entity schema
 * Leaf node in the metaverse hierarchy
 */
export const EntitySchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
})

/**
 * Schema for creating a new entity
 */
export const CreateEntitySchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
    description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
    sectionId: z.string().uuid('Invalid section ID')
})

/**
 * Schema for updating an existing entity
 */
export const UpdateEntitySchema = CreateEntitySchema.omit({ sectionId: true }).partial()

// Type inference exports
// Note: MetaverseRole type is already exported from common/roles.ts
export type Metaverse = z.infer<typeof MetaverseSchema>
export type CreateMetaverse = z.infer<typeof CreateMetaverseSchema>
export type UpdateMetaverse = z.infer<typeof UpdateMetaverseSchema>
export type Section = z.infer<typeof SectionSchema>
export type CreateSection = z.infer<typeof CreateSectionSchema>
export type UpdateSection = z.infer<typeof UpdateSectionSchema>
export type Entity = z.infer<typeof EntitySchema>
export type CreateEntity = z.infer<typeof CreateEntitySchema>
export type UpdateEntity = z.infer<typeof UpdateEntitySchema>
