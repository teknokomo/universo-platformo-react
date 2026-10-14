export interface WidgetBindingEntityComponentMetadata {
    readonly codename: string
    readonly dataType: string
    readonly isRequired: boolean
    readonly validationRules: unknown
    readonly targetObjectId?: string | null
    readonly targetObjectKind?: string | null
    readonly targetObjectCodename?: string | null
    readonly uiConfig?: unknown
}

export interface WidgetBindingEntityCompatibilityContext {
    /** Server-resolved parent Object metadata for one validated relation-set binding. */
    readonly relationParent?: {
        readonly id: string
        readonly kind: string
        readonly codename: string
    }
}

export interface WidgetBindingPolicyRequirement {
    readonly field: string
    readonly componentCodename: string
    readonly valueType: string
    readonly allowServerOwnedRead?: boolean
    readonly requireServerOwned?: boolean
}

/** Minimal structural contract keeps the compatibility policy below the Zod registry module. */
export interface WidgetBindingPolicySlot {
    readonly selectorKinds: readonly string[]
    readonly relation?: { readonly field: string }
    readonly requirements: { readonly components: readonly WidgetBindingPolicyRequirement[] }
}
