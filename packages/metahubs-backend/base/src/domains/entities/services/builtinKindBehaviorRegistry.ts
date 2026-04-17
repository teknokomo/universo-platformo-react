import {
    ENTITY_SURFACE_KEYS,
    ENTITY_SURFACE_LABELS,
    resolveBuiltinEntityKindFromSurface,
    resolveEntitySurfaceKey,
    type BuiltinEntityKind
} from '@universo/types'

import { getBehaviorService as lookupBehaviorService, registerBehavior } from './behaviorRegistry'
import type { EntityBehaviorService } from './EntityBehaviorService'
import { buildBuiltinKindBlockingState, buildBuiltinKindDeletePlan, resolveBuiltinGeneratedTableName } from './builtinKindCapabilities'

const BUILTIN_BEHAVIOR_KINDS: BuiltinEntityKind[] = ENTITY_SURFACE_KEYS.map((surface) => resolveBuiltinEntityKindFromSurface(surface))

const resolveBehaviorLabel = (kindKey: BuiltinEntityKind): string => {
    const surfaceKey = resolveEntitySurfaceKey(kindKey)
    return surfaceKey ? ENTITY_SURFACE_LABELS[surfaceKey].singular : 'Entity'
}

let registryInitialized = false

const createStandardBehavior = (kindKey: BuiltinEntityKind): EntityBehaviorService => ({
    kindKey,
    entityLabel: resolveBehaviorLabel(kindKey),
    aclEntityType: kindKey,
    resolveGeneratedTableName: (objectId) => resolveBuiltinGeneratedTableName(kindKey, objectId),
    buildBlockingState: (context) => buildBuiltinKindBlockingState(kindKey, context),
    buildDeletePlan: (context) => buildBuiltinKindDeletePlan(kindKey, context)
})

export const ensureStandardKindBehaviorsRegistered = (): void => {
    if (registryInitialized && BUILTIN_BEHAVIOR_KINDS.every((kindKey) => lookupBehaviorService(kindKey))) {
        return
    }

    for (const kindKey of BUILTIN_BEHAVIOR_KINDS) {
        registerBehavior(createStandardBehavior(kindKey))
    }

    registryInitialized = true
}

export const getEntityBehaviorService = (kindKey: string): EntityBehaviorService | null => {
    ensureStandardKindBehaviorsRegistered()
    return lookupBehaviorService(kindKey)
}
