// Branding helpers to create nominal types for identifiers
export type Brand<TValue, TBrand extends string> = TValue & { readonly __brand: TBrand }

export type EntityId = Brand<string, 'EntityId'>
export type WorldId = Brand<string, 'WorldId'>
export type PlayerId = Brand<string, 'PlayerId'>
export type ComponentId = Brand<string, 'ComponentId'>

// Const-safe factory for branded IDs (no runtime cost)
export const brand = <TValue extends string, TBrand extends string>(v: TValue) => v as unknown as Brand<TValue, TBrand>
