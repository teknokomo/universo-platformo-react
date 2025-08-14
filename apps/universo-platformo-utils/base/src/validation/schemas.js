"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schemas = void 0;
const zod_1 = require("zod");
const types_1 = require("@universo-platformo/types");
const zVec3 = zod_1.z.tuple([zod_1.z.number(), zod_1.z.number(), zod_1.z.number()]);
const zQuat = zod_1.z.tuple([zod_1.z.number(), zod_1.z.number(), zod_1.z.number(), zod_1.z.number()]);
const zTransform = zod_1.z
    .object({
    position: zVec3,
    rotation: zQuat,
    scale: zVec3.optional(),
    velocity: zVec3.optional()
})
    .strict();
const zVisual = zod_1.z
    .object({
    model: zod_1.z.string().optional(),
    tint: zod_1.z.tuple([zod_1.z.number(), zod_1.z.number(), zod_1.z.number()]).optional()
})
    .strict();
const zHealth = zod_1.z
    .object({
    current: zod_1.z.number(),
    max: zod_1.z.number()
})
    .strict();
const zComponentSnapshotMap = zod_1.z
    .object({
    transform: zTransform.optional(),
    visual: zVisual.optional(),
    health: zHealth.optional()
})
    .strict();
const zEventPayloads = {
    'system.join': zod_1.z.object({ playerId: zod_1.z.string(), worldId: zod_1.z.string() }).strict(),
    'system.leave': zod_1.z.object({ playerId: zod_1.z.string(), reason: zod_1.z.string().optional() }).strict(),
    'combat.hit': zod_1.z.object({ attacker: zod_1.z.string(), target: zod_1.z.string(), amount: zod_1.z.number(), damageType: zod_1.z.string().optional() }).strict(),
    'economy.transfer': zod_1.z.object({ from: zod_1.z.string(), to: zod_1.z.string(), currency: zod_1.z.string(), amount: zod_1.z.number(), ref: zod_1.z.string().optional() }).strict()
};
const eventSchemas = Object.keys(zEventPayloads).map((t) => zod_1.z.object({ type: zod_1.z.literal(t), tServerMs: zod_1.z.number(), payload: zEventPayloads[t] }).strict());
exports.schemas = {
    eventPacket: zod_1.z.discriminatedUnion('type', eventSchemas),
    baseIntent: zod_1.z
        .object({
        seq: zod_1.z.number().int().nonnegative(),
        clientTimeMs: zod_1.z.number().nonnegative(),
        // UpIntentType is a const object; values() returns string[]; cast to tuple for z.enum
        type: zod_1.z.enum(Object.values(types_1.UpIntentType)),
        payload: zod_1.z.unknown()
    })
        .strict(),
    ack: zod_1.z
        .object({
        seq: zod_1.z.number().int().nonnegative(),
        serverTimeMs: zod_1.z.number().nonnegative()
    })
        .strict(),
    snapshot: zod_1.z
        .object({
        tick: zod_1.z.number().int().nonnegative(),
        serverTimeMs: zod_1.z.number().nonnegative(),
        entities: zod_1.z.record(zod_1.z.string(), zComponentSnapshotMap.partial()),
        events: zod_1.z.array(zod_1.z.any()).optional()
    })
        .strict(),
    deltaEntityUpdate: zod_1.z
        .object({
        entityId: zod_1.z.string(),
        components: zComponentSnapshotMap.partial().optional(),
        removedComponents: zod_1.z.array(zod_1.z.enum(['transform', 'visual', 'health'])).optional()
    })
        .strict(),
    delta: zod_1.z
        .object({
        tick: zod_1.z.number().int().nonnegative(),
        baseTick: zod_1.z.number().int().nonnegative(),
        added: zod_1.z.array(zod_1.z.any()).optional(),
        updated: zod_1.z.array(zod_1.z.any()).optional(),
        removed: zod_1.z.array(zod_1.z.string()).optional()
    })
        .strict()
};
//# sourceMappingURL=schemas.js.map