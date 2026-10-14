export type SnapshotEntity = {
    id?: string
    codename?: unknown
    kind?: string
    fields?: Array<Record<string, unknown>>
    config?: Record<string, unknown>
    presentation?: {
        name?: unknown
    }
}
export type SnapshotElement = { id?: string; data?: Record<string, unknown> }
export type SnapshotModule = Record<string, unknown>
export type SnapshotLayoutWidget = Record<string, unknown>

export type SnapshotEnvelope = Record<string, unknown> & {
    bundleVersion?: unknown
    snapshot?: {
        version?: unknown
        entities?: Record<string, SnapshotEntity>
        entityTypeDefinitions?: Record<string, Record<string, unknown>>
        elements?: Record<string, SnapshotElement[]>
        fixedValues?: Record<string, Array<Record<string, unknown>>>
        optionValues?: Record<string, Array<Record<string, unknown>>>
        modules?: SnapshotModule[]
        layouts?: Array<Record<string, unknown>>
        scopedLayouts?: Array<Record<string, unknown>>
        layoutZoneWidgets?: SnapshotLayoutWidget[]
        defaultLayoutId?: unknown
        runtimePolicy?: {
            workspaceMode?: unknown
        }
        versionEnvelope?: {
            structureVersion?: unknown
            templateVersion?: unknown
            snapshotFormatVersion?: unknown
        }
    }
    metahub?: {
        name?: unknown
        description?: unknown
        codename?: unknown
    }
    snapshotHash?: string
}
