export const SHARED_OBJECT_KINDS = {
    SHARED_CATALOG_POOL: 'shared-catalog-pool',
    SHARED_SET_POOL: 'shared-set-pool',
    SHARED_ENUM_POOL: 'shared-enumeration-pool'
} as const

export type SharedObjectKind = (typeof SHARED_OBJECT_KINDS)[keyof typeof SHARED_OBJECT_KINDS]

export const SHARED_ENTITY_KINDS = ['attribute', 'constant', 'value'] as const
export type SharedEntityKind = (typeof SHARED_ENTITY_KINDS)[number]

export const SHARED_POOL_TO_ENTITY_KIND: Record<SharedObjectKind, SharedEntityKind> = {
    'shared-catalog-pool': 'attribute',
    'shared-set-pool': 'constant',
    'shared-enumeration-pool': 'value'
}

export const SHARED_POOL_TO_TARGET_KIND: Record<SharedObjectKind, string> = {
    'shared-catalog-pool': 'catalog',
    'shared-set-pool': 'set',
    'shared-enumeration-pool': 'enumeration'
}

export const SHARED_ENTITY_KIND_TO_POOL_KIND: Record<SharedEntityKind, SharedObjectKind> = {
    attribute: SHARED_OBJECT_KINDS.SHARED_CATALOG_POOL,
    constant: SHARED_OBJECT_KINDS.SHARED_SET_POOL,
    value: SHARED_OBJECT_KINDS.SHARED_ENUM_POOL
}

export interface SharedBehavior {
    canDeactivate?: boolean
    canExclude?: boolean
    positionLocked?: boolean
}

export const DEFAULT_SHARED_BEHAVIOR: Required<SharedBehavior> = {
    canDeactivate: true,
    canExclude: true,
    positionLocked: false
}

export const resolveSharedBehavior = (raw?: Partial<SharedBehavior>): Required<SharedBehavior> => ({
    ...DEFAULT_SHARED_BEHAVIOR,
    ...(raw ?? {})
})
