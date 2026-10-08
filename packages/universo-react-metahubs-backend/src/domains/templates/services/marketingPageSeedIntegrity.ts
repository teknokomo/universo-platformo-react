import { getLayoutWidgetDefinition, parseApplicationLayoutWidgetConfig, validateWidgetBindings } from '@universo-react/types'
import type { MetahubTemplateSeed, TemplateSeedElement, WidgetBindingSlotDefinition, WidgetBindingTarget } from '@universo-react/types'

type SeedTargetContext = {
    seed: MetahubTemplateSeed
    bindingsBySlot: ReadonlyMap<string, readonly WidgetBindingTarget[]>
    definitionBySlot: ReadonlyMap<string, WidgetBindingSlotDefinition>
    failures: string[]
    widgetKey: string
}

const readSeedRecords = (seed: MetahubTemplateSeed, entityCodename: string): TemplateSeedElement[] => seed.elements?.[entityCodename] ?? []

const readComponentCodename = (slot: WidgetBindingSlotDefinition, field: string): string | undefined =>
    slot.requirements.components.find((component) => component.field === field)?.componentCodename

const resolveSeedTargetRecords = (
    target: WidgetBindingTarget,
    slot: WidgetBindingSlotDefinition,
    context: SeedTargetContext
): TemplateSeedElement[] => {
    const entity = context.seed.entities?.find(({ codename }) => codename === target.entityCodename)
    const allowedEntityKinds: readonly string[] = slot.requirements.entityKinds ?? []
    if (!entity || !allowedEntityKinds.includes(entity.kind) || entity.kind !== target.entityKind) {
        context.failures.push(
            `${context.widgetKey}/${slot.key}: target Entity ${target.entityCodename} is missing or has an incompatible kind`
        )
        return []
    }

    const records = readSeedRecords(context.seed, target.entityCodename)
    const selector = target.selector
    if (selector.kind === 'semantic-key') {
        const componentCodename = readComponentCodename(slot, selector.field)
        if (!componentCodename) {
            context.failures.push(`${context.widgetKey}/${slot.key}: semantic selector field ${selector.field} is not registered`)
            return []
        }
        const selected = records.filter(({ data }) => data[componentCodename] === selector.value)
        if (selected.length !== 1) {
            context.failures.push(
                `${context.widgetKey}/${slot.key}: semantic selector ${selector.value} resolves to ${selected.length} seeded records; expected exactly one`
            )
        }
        return selected
    }

    if (selector.kind === 'record-set') {
        if (records.length === 0)
            context.failures.push(`${context.widgetKey}/${slot.key}: record-set Entity ${target.entityCodename} has no seeded records`)
        return records
    }

    if (selector.kind === 'learner-enrollment-set') {
        // Learner assignments are actor-scoped runtime data, so an LMS template may seed none.
        return records
    }

    const relation = slot.relation
    const parentSlot = context.definitionBySlot.get(selector.parentSlot)
    const parentTargets = context.bindingsBySlot.get(selector.parentSlot) ?? []
    if (!relation || relation.parentSlot !== selector.parentSlot || !parentSlot || parentTargets.length === 0) {
        context.failures.push(`${context.widgetKey}/${slot.key}: relation parent slot ${selector.parentSlot} is not bound`)
        return []
    }

    const parentRecords = parentTargets.flatMap((parentTarget) => resolveSeedTargetRecords(parentTarget, parentSlot, context))
    const parentCodenames = new Set(parentRecords.map(({ codename }) => codename))
    const relationComponentCodename = readComponentCodename(slot, relation.field)
    const relationComponent = entity.components?.find(({ codename }) => codename === relationComponentCodename)
    if (
        !relationComponent ||
        relationComponent.dataType !== 'REF' ||
        !parentTargets.every((parentTarget) => relationComponent.targetEntityCodename === parentTarget.entityCodename)
    ) {
        context.failures.push(
            `${context.widgetKey}/${slot.key}: relation Component ${relation.field} does not target its bound parent Entity`
        )
        return []
    }

    const related = records.filter(
        ({ data }) =>
            typeof data[relationComponentCodename ?? ''] === 'string' &&
            parentCodenames.has(data[relationComponentCodename ?? ''] as string)
    )
    if (related.length !== records.length || related.length < slot.cardinality.min) {
        context.failures.push(
            `${context.widgetKey}/${slot.key}: ${related.length} of ${records.length} seeded records resolve to the bound relation parent; minimum is ${slot.cardinality.min}`
        )
    }
    return related
}

export const collectMarketingPageSeedIntegrityErrors = (seed: MetahubTemplateSeed): string[] => {
    const errors: string[] = []
    const templateKeyByLayout = new Map(seed.layouts.map(({ codename, templateKey }) => [codename, templateKey]))
    for (const layout of seed.scopedLayouts ?? []) templateKeyByLayout.set(layout.codename, layout.templateKey)

    for (const [layoutCodename, widgets] of Object.entries(seed.layoutZoneWidgets)) {
        if (templateKeyByLayout.get(layoutCodename) !== 'marketing-page') continue

        for (const widget of widgets) {
            let rendererConfig: Record<string, unknown>
            try {
                rendererConfig = parseApplicationLayoutWidgetConfig(widget.widgetKey, widget.rendererConfig)
            } catch {
                continue
            }

            const definition = getLayoutWidgetDefinition(widget.widgetKey, rendererConfig)
            if (!definition?.bindingSlots?.length) continue

            let bindings: ReturnType<typeof validateWidgetBindings>
            try {
                bindings = validateWidgetBindings(definition, widget.bindings)
            } catch {
                continue
            }

            const bindingsBySlot = new Map(bindings.slots.map(({ slot, targets }) => [slot, targets]))
            const definitionBySlot = new Map(definition.bindingSlots.map((slot) => [slot.key, slot]))
            const context: SeedTargetContext = { seed, bindingsBySlot, definitionBySlot, failures: errors, widgetKey: widget.widgetKey }

            for (const slot of definition.bindingSlots) {
                const targets = bindingsBySlot.get(slot.key) ?? []
                if (targets.length < slot.cardinality.min) {
                    errors.push(
                        `${widget.widgetKey}/${slot.key}: required binding has ${targets.length} targets; minimum is ${slot.cardinality.min}`
                    )
                    continue
                }

                for (const target of targets) {
                    const resolvedRecords = resolveSeedTargetRecords(target, slot, context)
                    const entity = seed.entities?.find(({ codename }) => codename === target.entityCodename)
                    const requiredComponents = slot.requirements.components
                        .filter(({ required }) => required)
                        .map(({ componentCodename }) => componentCodename)
                    for (const record of resolvedRecords) {
                        for (const componentCodename of requiredComponents) {
                            if (
                                !entity?.components?.some(({ codename }) => codename === componentCodename) ||
                                !(componentCodename in record.data)
                            ) {
                                errors.push(
                                    `${widget.widgetKey}/${slot.key}: seeded ${target.entityCodename}:${record.codename} is missing required Component ${componentCodename}`
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    return errors
}

export const assertMarketingPageSeedIntegrity = (seed: MetahubTemplateSeed): void => {
    const errors = collectMarketingPageSeedIntegrityErrors(seed)
    if (errors.length > 0) throw new Error(`Marketing page seed integrity failed:\n${errors.map((error) => `- ${error}`).join('\n')}`)
}
