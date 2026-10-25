/** Authenticated persistence scope kept outside the renderer-safe placement graph. */
export type AuthenticatedRuntimePlacementScope = {
    widgetId: string
    layoutId: string
}

export type AuthenticatedRuntimePlacementScopes = Readonly<Record<string, AuthenticatedRuntimePlacementScope>>
