/**
 * Projects Zod Schemas
 *
 * Validation schemas for Project, Milestone, and Task entities.
 * Used for runtime validation and OpenAPI documentation generation.
 */

import { z } from 'zod'

/**
 * Role schema for project members
 * Uses the same roles as ProjectRole type from common/roles.ts
 */
export const ProjectRoleSchema = z.enum(['owner', 'admin', 'editor', 'member'])

/**
 * Project entity schema
 * Top-level container for milestones and tasks
 */
export const ProjectSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional().nullable(),
    ownerId: z.string().uuid(),
    milestonesCount: z.number().int().min(0).optional(),
    tasksCount: z.number().int().min(0).optional(),
    membersCount: z.number().int().min(0).optional(),
    createdAt: z.string().datetime(), // ISO string from API
    updatedAt: z.string().datetime()
})

/**
 * Schema for creating a new project
 */
export const CreateProjectSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
    description: z.string().max(1000, 'Description must be less than 1000 characters').optional()
})

/**
 * Schema for updating an existing project
 */
export const UpdateProjectSchema = CreateProjectSchema.partial()

/**
 * Milestone entity schema
 * Container for tasks within a project
 */
export const MilestoneSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional().nullable(),
    tasksCount: z.number().int().min(0).optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
})

/**
 * Schema for creating a new milestone
 */
export const CreateMilestoneSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
    description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
    projectId: z.string().uuid('Invalid project ID')
})

/**
 * Schema for updating an existing milestone
 */
export const UpdateMilestoneSchema = CreateMilestoneSchema.omit({ projectId: true }).partial()

/**
 * Task entity schema
 * Leaf node in the project hierarchy
 */
export const TaskSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
})

/**
 * Schema for creating a new task
 */
export const CreateTaskSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
    description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
    milestoneId: z.string().uuid('Invalid milestone ID')
})

/**
 * Schema for updating an existing task
 */
export const UpdateTaskSchema = CreateTaskSchema.omit({ milestoneId: true }).partial()

// Type inference exports
// Note: ProjectRole type is already exported from common/roles.ts
export type Project = z.infer<typeof ProjectSchema>
export type CreateProject = z.infer<typeof CreateProjectSchema>
export type UpdateProject = z.infer<typeof UpdateProjectSchema>
export type Milestone = z.infer<typeof MilestoneSchema>
export type CreateMilestone = z.infer<typeof CreateMilestoneSchema>
export type UpdateMilestone = z.infer<typeof UpdateMilestoneSchema>
export type Task = z.infer<typeof TaskSchema>
export type CreateTask = z.infer<typeof CreateTaskSchema>
export type UpdateTask = z.infer<typeof UpdateTaskSchema>
