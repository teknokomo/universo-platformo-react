/**
 * OpenAPI Schema Generator
 *
 * Generates OpenAPI 3.1 schemas from Zod definitions in @universo/types.
 * Uses @asteasolutions/zod-to-openapi for automatic schema generation.
 *
 * TODO: Add schemas when implemented in @universo/types:
 * - WorkspaceSchema (Unik entity)
 * - SpaceSchema
 * - CanvasSchema
 * - PublicationSchema
 */

import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z)

// Import ONLY existing schemas from @universo/types
import {
    // Metaverse schemas ✅
    MetaverseSchema,
    SectionSchema,
    EntitySchema,
    CreateMetaverseSchema,
    CreateSectionSchema,
    CreateEntitySchema,
    UpdateMetaverseSchema,
    UpdateSectionSchema,
    UpdateEntitySchema,

    // Common schemas ✅
    PaginationMetaSchema,
    PaginationQuerySchema,
    ApiErrorSchema
} from '@universo/types'

/**
 * Register OpenAPI metadata for schemas
 *
 * TODO: The following schemas are not yet implemented in @universo/types:
 * - Unik schemas
 * - Space schemas
 * - Canvas schemas
 * - Publication schemas
 *
 * These will be added as part of future validation infrastructure work.
 */

// Metaverse schemas
const MetaverseSchemaWithMeta = MetaverseSchema.openapi('Metaverse', {
    description: 'Metaverse collection - thematic grouping of spaces'
})

const SectionSchemaWithMeta = SectionSchema.openapi('Section', {
    description: 'Section within metaverse - organizational unit'
})

const EntitySchemaWithMeta = EntitySchema.openapi('Entity', {
    description: '3D entity or interactive object within section'
})

const CreateMetaverseSchemaWithMeta = CreateMetaverseSchema.openapi('CreateMetaverse', {
    description: 'Metaverse creation request'
})

const UpdateMetaverseSchemaWithMeta = UpdateMetaverseSchema.openapi('UpdateMetaverse', {
    description: 'Metaverse update request'
})

const CreateSectionSchemaWithMeta = CreateSectionSchema.openapi('CreateSection', {
    description: 'Section creation request'
})

const UpdateSectionSchemaWithMeta = UpdateSectionSchema.openapi('UpdateSection', {
    description: 'Section update request'
})

const CreateEntitySchemaWithMeta = CreateEntitySchema.openapi('CreateEntity', {
    description: 'Entity creation request'
})

const UpdateEntitySchemaWithMeta = UpdateEntitySchema.openapi('UpdateEntity', {
    description: 'Entity update request'
})

// Common schemas
const PaginationMetaSchemaWithMeta = PaginationMetaSchema.openapi('PaginationMeta', {
    description: 'Pagination metadata for list responses'
})

const PaginationQuerySchemaWithMeta = PaginationQuerySchema.openapi('PaginationQuery', {
    description: 'Pagination query parameters'
})

const ApiErrorSchemaWithMeta = ApiErrorSchema.openapi('ApiError', {
    description: 'Standard API error response format'
})

/**
 * Export all registered schemas for use in OpenAPI spec generation
 */
export const openApiSchemas = {
    // Metaverse
    Metaverse: MetaverseSchemaWithMeta,
    Section: SectionSchemaWithMeta,
    Entity: EntitySchemaWithMeta,
    CreateMetaverse: CreateMetaverseSchemaWithMeta,
    UpdateMetaverse: UpdateMetaverseSchemaWithMeta,
    CreateSection: CreateSectionSchemaWithMeta,
    UpdateSection: UpdateSectionSchemaWithMeta,
    CreateEntity: CreateEntitySchemaWithMeta,
    UpdateEntity: UpdateEntitySchemaWithMeta,

    // Common
    PaginationMeta: PaginationMetaSchemaWithMeta,
    ApiError: ApiErrorSchemaWithMeta
}

/**
 * Export query parameter schemas separately
 */
export const querySchemas = {
    PaginationQuery: PaginationQuerySchemaWithMeta
}
