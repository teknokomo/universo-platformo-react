import { z } from 'zod';
export declare const schemas: {
    eventPacket: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"system.join" | "system.leave" | "combat.hit" | "economy.transfer">;
        tServerMs: z.ZodNumber;
        payload: z.ZodObject<{
            playerId: z.ZodString;
            worldId: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            playerId: string;
            worldId: string;
        }, {
            playerId: string;
            worldId: string;
        }> | z.ZodObject<{
            playerId: z.ZodString;
            reason: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            playerId: string;
            reason?: string | undefined;
        }, {
            playerId: string;
            reason?: string | undefined;
        }> | z.ZodObject<{
            attacker: z.ZodString;
            target: z.ZodString;
            amount: z.ZodNumber;
            damageType: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            attacker: string;
            target: string;
            amount: number;
            damageType?: string | undefined;
        }, {
            attacker: string;
            target: string;
            amount: number;
            damageType?: string | undefined;
        }> | z.ZodObject<{
            from: z.ZodString;
            to: z.ZodString;
            currency: z.ZodString;
            amount: z.ZodNumber;
            ref: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            amount: number;
            from: string;
            to: string;
            currency: string;
            ref?: string | undefined;
        }, {
            amount: number;
            from: string;
            to: string;
            currency: string;
            ref?: string | undefined;
        }>;
    }, "strict", z.ZodTypeAny, {
        type: "system.join" | "system.leave" | "combat.hit" | "economy.transfer";
        tServerMs: number;
        payload: {
            playerId: string;
            worldId: string;
        } | {
            playerId: string;
            reason?: string | undefined;
        } | {
            attacker: string;
            target: string;
            amount: number;
            damageType?: string | undefined;
        } | {
            amount: number;
            from: string;
            to: string;
            currency: string;
            ref?: string | undefined;
        };
    }, {
        type: "system.join" | "system.leave" | "combat.hit" | "economy.transfer";
        tServerMs: number;
        payload: {
            playerId: string;
            worldId: string;
        } | {
            playerId: string;
            reason?: string | undefined;
        } | {
            attacker: string;
            target: string;
            amount: number;
            damageType?: string | undefined;
        } | {
            amount: number;
            from: string;
            to: string;
            currency: string;
            ref?: string | undefined;
        };
    }>, ...z.ZodObject<{
        type: z.ZodLiteral<"system.join" | "system.leave" | "combat.hit" | "economy.transfer">;
        tServerMs: z.ZodNumber;
        payload: z.ZodObject<{
            playerId: z.ZodString;
            worldId: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            playerId: string;
            worldId: string;
        }, {
            playerId: string;
            worldId: string;
        }> | z.ZodObject<{
            playerId: z.ZodString;
            reason: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            playerId: string;
            reason?: string | undefined;
        }, {
            playerId: string;
            reason?: string | undefined;
        }> | z.ZodObject<{
            attacker: z.ZodString;
            target: z.ZodString;
            amount: z.ZodNumber;
            damageType: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            attacker: string;
            target: string;
            amount: number;
            damageType?: string | undefined;
        }, {
            attacker: string;
            target: string;
            amount: number;
            damageType?: string | undefined;
        }> | z.ZodObject<{
            from: z.ZodString;
            to: z.ZodString;
            currency: z.ZodString;
            amount: z.ZodNumber;
            ref: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            amount: number;
            from: string;
            to: string;
            currency: string;
            ref?: string | undefined;
        }, {
            amount: number;
            from: string;
            to: string;
            currency: string;
            ref?: string | undefined;
        }>;
    }, "strict", z.ZodTypeAny, {
        type: "system.join" | "system.leave" | "combat.hit" | "economy.transfer";
        tServerMs: number;
        payload: {
            playerId: string;
            worldId: string;
        } | {
            playerId: string;
            reason?: string | undefined;
        } | {
            attacker: string;
            target: string;
            amount: number;
            damageType?: string | undefined;
        } | {
            amount: number;
            from: string;
            to: string;
            currency: string;
            ref?: string | undefined;
        };
    }, {
        type: "system.join" | "system.leave" | "combat.hit" | "economy.transfer";
        tServerMs: number;
        payload: {
            playerId: string;
            worldId: string;
        } | {
            playerId: string;
            reason?: string | undefined;
        } | {
            attacker: string;
            target: string;
            amount: number;
            damageType?: string | undefined;
        } | {
            amount: number;
            from: string;
            to: string;
            currency: string;
            ref?: string | undefined;
        };
    }>[]]>;
    baseIntent: z.ZodObject<{
        seq: z.ZodNumber;
        clientTimeMs: z.ZodNumber;
        type: z.ZodEnum<[string, ...string[]]>;
        payload: z.ZodUnknown;
    }, "strict", z.ZodTypeAny, {
        type: string;
        seq: number;
        clientTimeMs: number;
        payload?: unknown;
    }, {
        type: string;
        seq: number;
        clientTimeMs: number;
        payload?: unknown;
    }>;
    ack: z.ZodObject<{
        seq: z.ZodNumber;
        serverTimeMs: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        seq: number;
        serverTimeMs: number;
    }, {
        seq: number;
        serverTimeMs: number;
    }>;
    snapshot: z.ZodObject<{
        tick: z.ZodNumber;
        serverTimeMs: z.ZodNumber;
        entities: z.ZodRecord<z.ZodString, z.ZodObject<{
            transform: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
                rotation: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
                scale: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
                velocity: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
            }, "strict", z.ZodTypeAny, {
                position: [number, number, number];
                rotation: [number, number, number, number];
                scale?: [number, number, number] | undefined;
                velocity?: [number, number, number] | undefined;
            }, {
                position: [number, number, number];
                rotation: [number, number, number, number];
                scale?: [number, number, number] | undefined;
                velocity?: [number, number, number] | undefined;
            }>>>;
            visual: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                model: z.ZodOptional<z.ZodString>;
                tint: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
            }, "strict", z.ZodTypeAny, {
                model?: string | undefined;
                tint?: [number, number, number] | undefined;
            }, {
                model?: string | undefined;
                tint?: [number, number, number] | undefined;
            }>>>;
            health: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                current: z.ZodNumber;
                max: z.ZodNumber;
            }, "strict", z.ZodTypeAny, {
                current: number;
                max: number;
            }, {
                current: number;
                max: number;
            }>>>;
        }, "strict", z.ZodTypeAny, {
            transform?: {
                position: [number, number, number];
                rotation: [number, number, number, number];
                scale?: [number, number, number] | undefined;
                velocity?: [number, number, number] | undefined;
            } | undefined;
            visual?: {
                model?: string | undefined;
                tint?: [number, number, number] | undefined;
            } | undefined;
            health?: {
                current: number;
                max: number;
            } | undefined;
        }, {
            transform?: {
                position: [number, number, number];
                rotation: [number, number, number, number];
                scale?: [number, number, number] | undefined;
                velocity?: [number, number, number] | undefined;
            } | undefined;
            visual?: {
                model?: string | undefined;
                tint?: [number, number, number] | undefined;
            } | undefined;
            health?: {
                current: number;
                max: number;
            } | undefined;
        }>>;
        events: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    }, "strict", z.ZodTypeAny, {
        serverTimeMs: number;
        tick: number;
        entities: Record<string, {
            transform?: {
                position: [number, number, number];
                rotation: [number, number, number, number];
                scale?: [number, number, number] | undefined;
                velocity?: [number, number, number] | undefined;
            } | undefined;
            visual?: {
                model?: string | undefined;
                tint?: [number, number, number] | undefined;
            } | undefined;
            health?: {
                current: number;
                max: number;
            } | undefined;
        }>;
        events?: any[] | undefined;
    }, {
        serverTimeMs: number;
        tick: number;
        entities: Record<string, {
            transform?: {
                position: [number, number, number];
                rotation: [number, number, number, number];
                scale?: [number, number, number] | undefined;
                velocity?: [number, number, number] | undefined;
            } | undefined;
            visual?: {
                model?: string | undefined;
                tint?: [number, number, number] | undefined;
            } | undefined;
            health?: {
                current: number;
                max: number;
            } | undefined;
        }>;
        events?: any[] | undefined;
    }>;
    deltaEntityUpdate: z.ZodObject<{
        entityId: z.ZodString;
        components: z.ZodOptional<z.ZodObject<{
            transform: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
                rotation: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
                scale: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
                velocity: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
            }, "strict", z.ZodTypeAny, {
                position: [number, number, number];
                rotation: [number, number, number, number];
                scale?: [number, number, number] | undefined;
                velocity?: [number, number, number] | undefined;
            }, {
                position: [number, number, number];
                rotation: [number, number, number, number];
                scale?: [number, number, number] | undefined;
                velocity?: [number, number, number] | undefined;
            }>>>;
            visual: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                model: z.ZodOptional<z.ZodString>;
                tint: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
            }, "strict", z.ZodTypeAny, {
                model?: string | undefined;
                tint?: [number, number, number] | undefined;
            }, {
                model?: string | undefined;
                tint?: [number, number, number] | undefined;
            }>>>;
            health: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                current: z.ZodNumber;
                max: z.ZodNumber;
            }, "strict", z.ZodTypeAny, {
                current: number;
                max: number;
            }, {
                current: number;
                max: number;
            }>>>;
        }, "strict", z.ZodTypeAny, {
            transform?: {
                position: [number, number, number];
                rotation: [number, number, number, number];
                scale?: [number, number, number] | undefined;
                velocity?: [number, number, number] | undefined;
            } | undefined;
            visual?: {
                model?: string | undefined;
                tint?: [number, number, number] | undefined;
            } | undefined;
            health?: {
                current: number;
                max: number;
            } | undefined;
        }, {
            transform?: {
                position: [number, number, number];
                rotation: [number, number, number, number];
                scale?: [number, number, number] | undefined;
                velocity?: [number, number, number] | undefined;
            } | undefined;
            visual?: {
                model?: string | undefined;
                tint?: [number, number, number] | undefined;
            } | undefined;
            health?: {
                current: number;
                max: number;
            } | undefined;
        }>>;
        removedComponents: z.ZodOptional<z.ZodArray<z.ZodEnum<["transform", "visual", "health"]>, "many">>;
    }, "strict", z.ZodTypeAny, {
        entityId: string;
        components?: {
            transform?: {
                position: [number, number, number];
                rotation: [number, number, number, number];
                scale?: [number, number, number] | undefined;
                velocity?: [number, number, number] | undefined;
            } | undefined;
            visual?: {
                model?: string | undefined;
                tint?: [number, number, number] | undefined;
            } | undefined;
            health?: {
                current: number;
                max: number;
            } | undefined;
        } | undefined;
        removedComponents?: ("transform" | "visual" | "health")[] | undefined;
    }, {
        entityId: string;
        components?: {
            transform?: {
                position: [number, number, number];
                rotation: [number, number, number, number];
                scale?: [number, number, number] | undefined;
                velocity?: [number, number, number] | undefined;
            } | undefined;
            visual?: {
                model?: string | undefined;
                tint?: [number, number, number] | undefined;
            } | undefined;
            health?: {
                current: number;
                max: number;
            } | undefined;
        } | undefined;
        removedComponents?: ("transform" | "visual" | "health")[] | undefined;
    }>;
    delta: z.ZodObject<{
        tick: z.ZodNumber;
        baseTick: z.ZodNumber;
        added: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        updated: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        removed: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strict", z.ZodTypeAny, {
        tick: number;
        baseTick: number;
        added?: any[] | undefined;
        updated?: any[] | undefined;
        removed?: string[] | undefined;
    }, {
        tick: number;
        baseTick: number;
        added?: any[] | undefined;
        updated?: any[] | undefined;
        removed?: string[] | undefined;
    }>;
};
