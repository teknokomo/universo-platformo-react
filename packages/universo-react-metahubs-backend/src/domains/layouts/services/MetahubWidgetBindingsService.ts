import type { DbExecutor } from '@universo-react/utils/database'
import { z } from 'zod'
import { updateLayoutZoneWidgetBindingSchema } from '../widgetBindingSchemas'
import type { WidgetBindingRequestContext, WidgetBindingService } from '../widgetBindingService'

export class MetahubWidgetBindingsService {
    constructor(private readonly executor: DbExecutor, private readonly widgetBindingService: WidgetBindingService) {}

    private context(metahubId: string, userId?: string | null): WidgetBindingRequestContext {
        return { executor: this.executor, metahubId, userId }
    }

    async readWidgetBindings(metahubId: string, layoutId: string, widgetId: string, locale: string, userId?: string | null) {
        return this.widgetBindingService.readBinding(this.context(metahubId, userId), { layoutId, widgetId, locale })
    }

    async listWidgetBindingSources(
        metahubId: string,
        layoutId: string,
        widgetId: string,
        input: Omit<Parameters<WidgetBindingService['listSources']>[1], 'layoutId' | 'widgetId'>,
        userId?: string | null
    ) {
        return this.widgetBindingService.listSources(this.context(metahubId, userId), { ...input, layoutId, widgetId })
    }

    async discoverWidgetBindingSources(
        metahubId: string,
        layoutId: string,
        input: Omit<Parameters<WidgetBindingService['discoverSources']>[1], 'layoutId'>,
        userId?: string | null
    ) {
        return this.widgetBindingService.discoverSources(this.context(metahubId, userId), { ...input, layoutId })
    }

    async listWidgetBindingRecords(
        metahubId: string,
        layoutId: string,
        widgetId: string,
        input: Omit<Parameters<WidgetBindingService['listSemanticRecords']>[1], 'layoutId' | 'widgetId'>,
        userId?: string | null
    ) {
        return this.widgetBindingService.listSemanticRecords(this.context(metahubId, userId), { ...input, layoutId, widgetId })
    }

    async discoverWidgetBindingRecords(
        metahubId: string,
        layoutId: string,
        input: Omit<Parameters<WidgetBindingService['discoverSemanticRecords']>[1], 'layoutId'>,
        userId?: string | null
    ) {
        return this.widgetBindingService.discoverSemanticRecords(this.context(metahubId, userId), { ...input, layoutId })
    }

    async updateWidgetBinding(
        metahubId: string,
        layoutId: string,
        widgetId: string,
        input: z.infer<typeof updateLayoutZoneWidgetBindingSchema>,
        userId?: string | null
    ) {
        return this.widgetBindingService.replaceBindings(this.context(metahubId, userId), { ...input, layoutId, widgetId })
    }

    async provisionWidgetBindingSource(
        metahubId: string,
        layoutId: string,
        input: {
            widgetKey: Parameters<WidgetBindingService['provisionSource']>[1]['widgetKey']
            slot: string
            variant?: Parameters<WidgetBindingService['provisionSource']>[1]['variant']
            locale?: string
            templateSourceKey: string
            parentSourceKey?: string
            name: string
        },
        userId?: string | null
    ) {
        return this.widgetBindingService.provisionSource(this.context(metahubId, userId), { ...input, layoutId })
    }

    async getWidgetBindingUsage(
        metahubId: string,
        layoutId: string,
        input: { widgetId: string; slot: string; sourceKey: string; semanticKey?: string },
        userId?: string | null
    ) {
        return this.widgetBindingService.checkUsage(this.context(metahubId, userId), { ...input, layoutId })
    }
}
