import { z } from 'zod'
import { MODULE_ATTACHMENT_KIND_PATTERN } from './modules'

export const moduleAttachmentKindSchema = z.string().trim().regex(MODULE_ATTACHMENT_KIND_PATTERN).nullable().optional()

export const moduleBackedWidgetConfigSchema = z
    .object({
        moduleCodename: z.string().nullable().optional(),
        attachedToKind: moduleAttachmentKindSchema,
        mountMethodName: z.string().nullable().optional(),
        emptyStateTitle: z.string().nullable().optional(),
        emptyStateDescription: z.string().nullable().optional(),
        serverModuleCodename: z.string().trim().min(1).max(128).nullable().optional()
    })
    .strict()
