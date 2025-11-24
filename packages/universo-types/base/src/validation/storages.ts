import { z } from 'zod'

/**
 * Validation schemas for Storages module
 * Provides type-safe validation for Storage, Container, and Slot entities
 */

// Storage schemas
export const StorageSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(255),
    description: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date()
})

export const CreateStorageSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional()
})

export const UpdateStorageSchema = CreateStorageSchema.partial()

// Container schemas
export const ContainerSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(255),
    description: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date()
})

export const CreateContainerSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional()
})

export const UpdateContainerSchema = CreateContainerSchema.partial()

// Slot schemas
export const SlotSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(255),
    description: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date()
})

export const CreateSlotSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional()
})

export const UpdateSlotSchema = CreateSlotSchema.partial()

// Type exports
export type Storage = z.infer<typeof StorageSchema>
export type CreateStorage = z.infer<typeof CreateStorageSchema>
export type UpdateStorage = z.infer<typeof UpdateStorageSchema>

export type Container = z.infer<typeof ContainerSchema>
export type CreateContainer = z.infer<typeof CreateContainerSchema>
export type UpdateContainer = z.infer<typeof UpdateContainerSchema>

export type Slot = z.infer<typeof SlotSchema>
export type CreateSlot = z.infer<typeof CreateSlotSchema>
export type UpdateSlot = z.infer<typeof UpdateSlotSchema>
