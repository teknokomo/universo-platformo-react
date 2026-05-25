import { z } from 'zod'

export const schemas = {
    position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
    rotation: z.object({ x: z.number(), y: z.number(), z: z.number() }),
    baseObject: z
        .object({
            id: z.string(),
            name: z.string(),
            type: z.string(),
            position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
            rotation: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional(),
            scale: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional()
        })
        .passthrough(),
    object: z
        .object({
            id: z.string(),
            name: z.string(),
            type: z.string(),
            position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
            rotation: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional(),
            scale: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional(),
            geometry: z
                .object({
                    width: z.number().optional(),
                    height: z.number().optional(),
                    depth: z.number().optional(),
                    radius: z.number().optional(),
                    segments: z.number().optional()
                })
                .partial()
                .optional(),
            material: z
                .object({
                    color: z.object({ r: z.number(), g: z.number(), b: z.number(), a: z.number().optional() }).optional(),
                    texture: z.string().optional(),
                    opacity: z.number().optional(),
                    metalness: z.number().optional(),
                    roughness: z.number().optional()
                })
                .partial()
                .optional(),
            model: z.object({ src: z.string(), format: z.string().optional() }).optional()
        })
        .passthrough(),
    entity: z
        .object({
            id: z.string(),
            name: z.string().optional(),
            entityType: z.string().optional(),
            transform: z
                .object({
                    position: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional(),
                    rotation: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional(),
                    scale: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional()
                })
                .partial()
                .optional(),
            tags: z.array(z.string()).optional(),
            components: z
                .array(
                    z
                        .object({
                            id: z.string(),
                            componentType: z.string(),
                            primitive: z.string().optional(),
                            color: z.string().optional(),
                            scriptName: z.string().optional(),
                            props: z.record(z.any()).optional()
                        })
                        .passthrough()
                )
                .optional()
        })
        .passthrough()
}
