import { z } from 'zod'
import { UpIntentType } from '@universo-platformo/types'

const zVec3 = z.tuple([z.number(), z.number(), z.number()])
const zQuat = z.tuple([z.number(), z.number(), z.number(), z.number()])

const zTransform = z
    .object({
        position: zVec3,
        rotation: zQuat,
        scale: zVec3.optional(),
        velocity: zVec3.optional()
    })
    .strict()

const zVisual = z
    .object({
        model: z.string().optional(),
        tint: z.tuple([z.number(), z.number(), z.number()]).optional()
    })
    .strict()

const zHealth = z
    .object({
        current: z.number(),
        max: z.number()
    })
    .strict()

const zComponentSnapshotMap = z
    .object({
        transform: zTransform.optional(),
        visual: zVisual.optional(),
        health: zHealth.optional()
    })
    .strict()

const zEventPayloads = {
    'system.join': z.object({ playerId: z.string(), worldId: z.string() }).strict(),
    'system.leave': z.object({ playerId: z.string(), reason: z.string().optional() }).strict(),
    'combat.hit': z.object({ attacker: z.string(), target: z.string(), amount: z.number(), damageType: z.string().optional() }).strict(),
    'economy.transfer': z.object({ from: z.string(), to: z.string(), currency: z.string(), amount: z.number(), ref: z.string().optional() }).strict()
} as const

const eventSchemas = (Object.keys(zEventPayloads) as (keyof typeof zEventPayloads)[]).map((t) =>
    z.object({ type: z.literal(t), tServerMs: z.number(), payload: zEventPayloads[t] }).strict()
)

export const schemas = {
    eventPacket: z.discriminatedUnion('type', eventSchemas as unknown as [typeof eventSchemas[number], ...typeof eventSchemas[number][]]),
    baseIntent: z
        .object({
            seq: z.number().int().nonnegative(),
            clientTimeMs: z.number().nonnegative(),
            // UpIntentType is a const object; values() returns string[]; cast to tuple for z.enum
            type: z.enum(Object.values(UpIntentType) as unknown as [string, ...string[]]),
            payload: z.unknown()
        })
        .strict(),
    ack: z
        .object({
            seq: z.number().int().nonnegative(),
            serverTimeMs: z.number().nonnegative()
        })
        .strict(),
    snapshot: z
        .object({
            tick: z.number().int().nonnegative(),
            serverTimeMs: z.number().nonnegative(),
            entities: z.record(z.string(), zComponentSnapshotMap.partial()),
            events: z.array(z.any()).optional()
        })
        .strict(),
    deltaEntityUpdate: z
        .object({
            entityId: z.string(),
            components: zComponentSnapshotMap.partial().optional(),
            removedComponents: z.array(z.enum(['transform', 'visual', 'health'] as const)).optional()
        })
        .strict(),
    delta: z
        .object({
            tick: z.number().int().nonnegative(),
            baseTick: z.number().int().nonnegative(),
            added: z.array(z.any()).optional(),
            updated: z.array(z.any()).optional(),
            removed: z.array(z.string()).optional()
        })
        .strict()
}
