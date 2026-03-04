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

// Import existing schemas from @universo/types
import {
    // Common schemas
    PaginationMetaSchema,
    PaginationQuerySchema,
    ApiErrorSchema
} from '@universo/types'

/**
 * Register OpenAPI metadata for schemas
 *
 * TODO: The following schemas are not yet implemented in @universo/types:
 * - Metaverse schemas (will be added when metaverses-backend defines Zod schemas)
 * - Unik schemas
 * - Space schemas
 * - Canvas schemas
 * - Publication schemas
 *
 * These will be added as part of future validation infrastructure work.
 */

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
