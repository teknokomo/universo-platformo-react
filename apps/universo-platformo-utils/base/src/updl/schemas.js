"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schemas = void 0;
const zod_1 = require("zod");
exports.schemas = {
    position: zod_1.z.object({ x: zod_1.z.number(), y: zod_1.z.number(), z: zod_1.z.number() }),
    rotation: zod_1.z.object({ x: zod_1.z.number(), y: zod_1.z.number(), z: zod_1.z.number() }),
    baseObject: zod_1.z
        .object({
        id: zod_1.z.string(),
        name: zod_1.z.string(),
        type: zod_1.z.string(),
        position: zod_1.z.object({ x: zod_1.z.number(), y: zod_1.z.number(), z: zod_1.z.number() }),
        rotation: zod_1.z.object({ x: zod_1.z.number(), y: zod_1.z.number(), z: zod_1.z.number() }).optional(),
        scale: zod_1.z.object({ x: zod_1.z.number(), y: zod_1.z.number(), z: zod_1.z.number() }).optional()
    })
        .passthrough(),
    object: zod_1.z
        .object({
        id: zod_1.z.string(),
        name: zod_1.z.string(),
        type: zod_1.z.string(),
        position: zod_1.z.object({ x: zod_1.z.number(), y: zod_1.z.number(), z: zod_1.z.number() }),
        rotation: zod_1.z.object({ x: zod_1.z.number(), y: zod_1.z.number(), z: zod_1.z.number() }).optional(),
        scale: zod_1.z.object({ x: zod_1.z.number(), y: zod_1.z.number(), z: zod_1.z.number() }).optional(),
        geometry: zod_1.z
            .object({
            width: zod_1.z.number().optional(),
            height: zod_1.z.number().optional(),
            depth: zod_1.z.number().optional(),
            radius: zod_1.z.number().optional(),
            segments: zod_1.z.number().optional()
        })
            .partial()
            .optional(),
        material: zod_1.z
            .object({
            color: zod_1.z.object({ r: zod_1.z.number(), g: zod_1.z.number(), b: zod_1.z.number(), a: zod_1.z.number().optional() }).optional(),
            texture: zod_1.z.string().optional(),
            opacity: zod_1.z.number().optional(),
            metalness: zod_1.z.number().optional(),
            roughness: zod_1.z.number().optional()
        })
            .partial()
            .optional(),
        model: zod_1.z.object({ src: zod_1.z.string(), format: zod_1.z.string().optional() }).optional()
    })
        .passthrough(),
    entity: zod_1.z
        .object({
        id: zod_1.z.string(),
        name: zod_1.z.string().optional(),
        entityType: zod_1.z.string().optional(),
        transform: zod_1.z
            .object({
            position: zod_1.z.object({ x: zod_1.z.number(), y: zod_1.z.number(), z: zod_1.z.number() }).optional(),
            rotation: zod_1.z.object({ x: zod_1.z.number(), y: zod_1.z.number(), z: zod_1.z.number() }).optional(),
            scale: zod_1.z.object({ x: zod_1.z.number(), y: zod_1.z.number(), z: zod_1.z.number() }).optional()
        })
            .partial()
            .optional(),
        tags: zod_1.z.array(zod_1.z.string()).optional(),
        components: zod_1.z
            .array(zod_1.z
            .object({
            id: zod_1.z.string(),
            componentType: zod_1.z.string(),
            primitive: zod_1.z.string().optional(),
            color: zod_1.z.string().optional(),
            scriptName: zod_1.z.string().optional(),
            props: zod_1.z.record(zod_1.z.any()).optional()
        })
            .passthrough())
            .optional()
    })
        .passthrough()
};
//# sourceMappingURL=schemas.js.map