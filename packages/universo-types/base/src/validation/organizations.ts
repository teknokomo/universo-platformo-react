import { z } from 'zod'
import { BASE_ROLES } from '../common/roles'

// Organization validation schemas
export const createOrganizationSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255),
    description: z.string().max(5000).optional()
})

export const updateOrganizationSchema = createOrganizationSchema.partial()

// Department validation schemas
export const createDepartmentSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255),
    description: z.string().max(5000).optional(),
    organizationId: z.string().uuid('Valid organization ID required')
})

export const updateDepartmentSchema = createDepartmentSchema.omit({ organizationId: true }).partial()

// Position validation schemas
export const createPositionSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255),
    description: z.string().max(5000).optional(),
    departmentId: z.string().uuid('Valid department ID required'),
    organizationId: z.string().uuid().optional(),
    metadata: z.record(z.any()).optional()
})

export const updatePositionSchema = createPositionSchema.omit({ departmentId: true, organizationId: true }).partial()

// Member management schemas
export const assignableRoles = BASE_ROLES.filter((r) => r !== 'owner')
export const memberRoleSchema = z.enum(assignableRoles as [string, ...string[]])

export const addMemberSchema = z.object({
    email: z.string().email('Valid email required'),
    role: memberRoleSchema,
    comment: z.string().max(500).optional()
})

export const updateMemberSchema = z.object({
    role: memberRoleSchema,
    comment: z.string().max(500).optional()
})

// Query parameter schemas
export const listQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    sortBy: z.enum(['name', 'created', 'updated']).default('updated'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    search: z.string().optional()
})

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>
export type CreatePositionInput = z.infer<typeof createPositionSchema>
export type UpdatePositionInput = z.infer<typeof updatePositionSchema>
export type AddMemberInput = z.infer<typeof addMemberSchema>
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>
export type ListQueryInput = z.infer<typeof listQuerySchema>
