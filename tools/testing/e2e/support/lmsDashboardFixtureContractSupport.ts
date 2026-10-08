export type DashboardFixtureRecord = Record<string, unknown>
type FixtureRecord = DashboardFixtureRecord

type DashboardEntity = {
    id?: string
    kind?: string
    fields?: FixtureRecord[]
    presentation?: { name?: unknown }
}

type DashboardFixtureEnvelope = {
    snapshot?: {
        modules?: FixtureRecord[]
        layouts?: FixtureRecord[]
        scopedLayouts?: FixtureRecord[]
        layoutZoneWidgets?: FixtureRecord[]
        defaultLayoutId?: unknown
    }
}

export type DashboardFixtureContractArguments = {
    envelope: DashboardFixtureEnvelope
    entityByCodename: ReadonlyMap<string, DashboardEntity>
    modules: FixtureRecord[]
    errors: string[]
    readRecord: (value: unknown) => FixtureRecord | null
    readWidgetConfig: (value: unknown) => FixtureRecord
    readLocalizedText: (value: unknown, locale?: string) => string | undefined
    assertLocalizedFixtureValue: (errors: string[], value: unknown, expected: { en: string; ru: string }, label: string) => void
}

export type DashboardFixtureValidationContext = DashboardFixtureContractArguments & {
    widgets: FixtureRecord[]
    scopedLayouts: FixtureRecord[]
    learnerHomeLayout: FixtureRecord | undefined
    courseBuilderLayout: FixtureRecord | undefined
    trackBuilderLayout: FixtureRecord | undefined
    reportsLayout: FixtureRecord | undefined
    knowledgeArticlesLayout: FixtureRecord | undefined
    globalLayout: FixtureRecord | undefined
    readBindingTargets: (widget: FixtureRecord | undefined, slotKey: string) => FixtureRecord[]
}

export const createDashboardFixtureValidationContext = (
    arguments_: DashboardFixtureContractArguments
): DashboardFixtureValidationContext => {
    const { envelope, entityByCodename } = arguments_
    const widgets = Array.isArray(envelope.snapshot?.layoutZoneWidgets) ? envelope.snapshot.layoutZoneWidgets : []
    const scopedLayouts = Array.isArray(envelope.snapshot?.scopedLayouts) ? envelope.snapshot.scopedLayouts : []
    const defaultLayoutId = envelope.snapshot?.defaultLayoutId
    const findActiveScopedLayout = (scopeEntityId: string | undefined): FixtureRecord | undefined =>
        scopedLayouts.find(
            (layout) => layout?.scopeEntityId === scopeEntityId && layout?.baseLayoutId === defaultLayoutId && layout?.isActive !== false
        )
    const globalLayout = Array.isArray(envelope.snapshot?.layouts)
        ? envelope.snapshot.layouts.find((layout) => layout?.id === defaultLayoutId)
        : undefined

    return {
        ...arguments_,
        widgets,
        scopedLayouts,
        learnerHomeLayout: findActiveScopedLayout(entityByCodename.get('LearnerHome')?.id),
        courseBuilderLayout: findActiveScopedLayout(entityByCodename.get('Courses')?.id),
        trackBuilderLayout: findActiveScopedLayout(entityByCodename.get('LearningTracks')?.id),
        reportsLayout: findActiveScopedLayout(entityByCodename.get('Reports')?.id),
        knowledgeArticlesLayout: findActiveScopedLayout(entityByCodename.get('KnowledgeArticles')?.id),
        globalLayout,
        readBindingTargets: (widget, slotKey) => {
            const config = arguments_.readWidgetConfig(widget?.config)
            const neutral = arguments_.readRecord(config.__layout)
            const bindings = arguments_.readRecord(neutral?.bindings)
            const slots = Array.isArray(bindings?.slots) ? bindings.slots.map(arguments_.readRecord) : []
            const slot = slots.find((candidate) => candidate?.slot === slotKey)
            return Array.isArray(slot?.targets)
                ? slot.targets.map(arguments_.readRecord).filter((target): target is FixtureRecord => Boolean(target))
                : []
        }
    }
}
