import { z } from 'zod'
import { MODULE_ATTACHMENT_KIND_PATTERN } from './modules'

export const widgetVisibilitySchema = z
    .object({
        sectionIds: z.array(z.string().trim().min(1).max(128)).min(1).max(32).optional(),
        sectionCodenames: z.array(z.string().trim().min(1).max(128)).min(1).max(32).optional(),
        objectCollectionIds: z.array(z.string().trim().min(1).max(128)).min(1).max(32).optional(),
        objectCollectionCodenames: z.array(z.string().trim().min(1).max(128)).min(1).max(32).optional()
    })
    .strict()

export const moduleAttachmentKindSchema = z.string().trim().regex(MODULE_ATTACHMENT_KIND_PATTERN).nullable().optional()

export const sharedBehaviorSchema = z
    .object({
        canDeactivate: z.boolean().optional(),
        canExclude: z.boolean().optional(),
        positionLocked: z.boolean().optional()
    })
    .strict()

export const moduleBackedWidgetConfigSchema = z
    .object({
        moduleCodename: z.string().nullable().optional(),
        attachedToKind: moduleAttachmentKindSchema,
        mountMethodName: z.string().nullable().optional(),
        emptyStateTitle: z.string().nullable().optional(),
        emptyStateDescription: z.string().nullable().optional(),
        serverModuleCodename: z.string().trim().min(1).max(128).nullable().optional(),
        visibleFor: widgetVisibilitySchema.optional(),
        sharedBehavior: sharedBehaviorSchema.optional()
    })
    .strict()
