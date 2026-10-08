import { z } from 'zod'
import type { DbExecutor } from '@universo-react/utils/database'
import type { ApplicationLayoutZone } from '@universo-react/types'
import type { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import type { MetahubWidgetBindingsService } from './MetahubWidgetBindingsService'
import { MetahubLayoutWidgetLifecycleService } from './layoutWidgetLifecycleService'
import {
    updateLayoutZoneSettingSchema,
    resetLayoutZoneSettingSchema,
    createLayoutSchema,
    updateLayoutSchema,
    assignLayoutZoneWidgetSchema,
    duplicateLayoutZoneWidgetSchema,
    moveLayoutZoneWidgetSchema,
    updateLayoutZoneWidgetConfigSchema,
    toggleLayoutZoneWidgetActiveSchema,
    type LayoutTemplateKey,
    type LayoutListOptions,
    type MetahubLayoutRow,
    type LayoutZoneWidgetRow,
    type LayoutWidgetScopeVisibilityRow
} from './layoutServiceContracts'
export {
    updateLayoutZoneSettingSchema,
    resetLayoutZoneSettingSchema,
    createLayoutSchema,
    updateLayoutSchema,
    assignLayoutZoneWidgetSchema,
    moveLayoutZoneWidgetSchema,
    duplicateLayoutZoneWidgetSchema,
    updateLayoutZoneWidgetConfigSchema,
    toggleLayoutZoneWidgetActiveSchema
}
export type { LayoutTemplateKey, MetahubLayoutRow, LayoutZoneWidgetRow, LayoutWidgetScopeVisibilityRow, LayoutListOptions }

/** Public facade for metahub layout operations; routes retain this stable API. */
export class MetahubLayoutsService {
    private readonly layoutService: MetahubLayoutWidgetLifecycleService
    readonly widgetBindings: MetahubWidgetBindingsService

    constructor(exec: DbExecutor, schemaService: MetahubSchemaService) {
        this.layoutService = new MetahubLayoutWidgetLifecycleService(exec, schemaService)
        this.widgetBindings = this.layoutService.widgetBindings
    }

    /** Preserves the existing internal scoped-layout resolver entry point. */
    private findOrCreateScopedLayout(...args: Parameters<MetahubLayoutWidgetLifecycleService['findOrCreateScopedLayout']>) {
        return this.layoutService.findOrCreateScopedLayout(...args)
    }

    /** Delegates listLayouts to the focused internal layout service. */
    async listLayouts(metahubId: string, options: LayoutListOptions, userId?: string) {
        return this.layoutService.listLayouts(metahubId, options, userId)
    }

    /** Delegates getLayoutById to the focused internal layout service. */
    async getLayoutById(metahubId: string, layoutId: string, userId?: string): Promise<MetahubLayoutRow | null> {
        return this.layoutService.getLayoutById(metahubId, layoutId, userId)
    }

    /** Delegates listLayoutWidgetScopeVisibility to the focused internal layout service. */
    async listLayoutWidgetScopeVisibility(
        metahubId: string,
        layoutId: string,
        widgetId: string,
        userId?: string | null
    ): Promise<LayoutWidgetScopeVisibilityRow[]> {
        return this.layoutService.listLayoutWidgetScopeVisibility(metahubId, layoutId, widgetId, userId)
    }

    /** Delegates setLayoutWidgetScopeVisibility to the focused internal layout service. */
    async setLayoutWidgetScopeVisibility(
        metahubId: string,
        layoutId: string,
        widgetId: string,
        scopeEntityId: string,
        isVisible: boolean,
        userId: string | null | undefined,
        expectedVersion: number
    ): Promise<LayoutWidgetScopeVisibilityRow[]> {
        return this.layoutService.setLayoutWidgetScopeVisibility(
            metahubId,
            layoutId,
            widgetId,
            scopeEntityId,
            isVisible,
            userId,
            expectedVersion
        )
    }

    /** Delegates createLayout to the focused internal layout service. */
    async createLayout(metahubId: string, input: z.infer<typeof createLayoutSchema>, userId?: string | null): Promise<MetahubLayoutRow> {
        return this.layoutService.createLayout(metahubId, input, userId)
    }

    /** Delegates updateLayout to the focused internal layout service. */
    async updateLayout(
        metahubId: string,
        layoutId: string,
        input: z.infer<typeof updateLayoutSchema>,
        userId?: string | null
    ): Promise<MetahubLayoutRow> {
        return this.layoutService.updateLayout(metahubId, layoutId, input, userId)
    }

    /** Delegates updateLayoutZoneSetting to the focused internal layout service. */
    async updateLayoutZoneSetting(
        metahubId: string,
        layoutId: string,
        zone: ApplicationLayoutZone,
        settingKey: string,
        value: string,
        userId: string | null | undefined,
        expectedVersion: number
    ): Promise<MetahubLayoutRow> {
        return this.layoutService.updateLayoutZoneSetting(metahubId, layoutId, zone, settingKey, value, userId, expectedVersion)
    }

    /** Delegates resetLayoutZoneSetting to the focused internal layout service. */
    async resetLayoutZoneSetting(
        metahubId: string,
        layoutId: string,
        zone: ApplicationLayoutZone,
        settingKey: string,
        userId: string | null | undefined,
        expectedVersion: number
    ): Promise<MetahubLayoutRow> {
        return this.layoutService.resetLayoutZoneSetting(metahubId, layoutId, zone, settingKey, userId, expectedVersion)
    }

    /** Delegates deleteLayout to the focused internal layout service. */
    async deleteLayout(metahubId: string, layoutId: string, expectedVersion: number, userId?: string | null): Promise<void> {
        return this.layoutService.deleteLayout(metahubId, layoutId, expectedVersion, userId)
    }

    /** Delegates listLayoutZoneWidgets to the focused internal layout service. */
    async listLayoutZoneWidgets(metahubId: string, layoutId: string, userId?: string | null): Promise<LayoutZoneWidgetRow[]> {
        return this.layoutService.listLayoutZoneWidgets(metahubId, layoutId, userId)
    }

    /** Delegates assignLayoutZoneWidget to the focused internal layout service. */
    async assignLayoutZoneWidget(
        metahubId: string,
        layoutId: string,
        input: z.infer<typeof assignLayoutZoneWidgetSchema>,
        userId?: string | null
    ): Promise<LayoutZoneWidgetRow> {
        return this.layoutService.assignLayoutZoneWidget(metahubId, layoutId, input, userId)
    }

    /** Delegates duplicateLayoutZoneWidget to the focused internal layout service. */
    async duplicateLayoutZoneWidget(
        metahubId: string,
        layoutId: string,
        input: z.infer<typeof duplicateLayoutZoneWidgetSchema>,
        userId?: string | null
    ): Promise<LayoutZoneWidgetRow> {
        return this.layoutService.duplicateLayoutZoneWidget(metahubId, layoutId, input, userId)
    }

    /** Delegates moveLayoutZoneWidget to the focused internal layout service. */
    async moveLayoutZoneWidget(
        metahubId: string,
        layoutId: string,
        input: z.infer<typeof moveLayoutZoneWidgetSchema>,
        userId?: string | null
    ): Promise<LayoutZoneWidgetRow[]> {
        return this.layoutService.moveLayoutZoneWidget(metahubId, layoutId, input, userId)
    }

    /** Delegates removeLayoutZoneWidget to the focused internal layout service. */
    async removeLayoutZoneWidget(
        metahubId: string,
        layoutId: string,
        widgetId: string,
        userId: string | null | undefined,
        expectedVersion: number
    ): Promise<void> {
        return this.layoutService.removeLayoutZoneWidget(metahubId, layoutId, widgetId, userId, expectedVersion)
    }

    /** Delegates resetLayoutZoneWidgetOverride to the focused internal layout service. */
    async resetLayoutZoneWidgetOverride(
        metahubId: string,
        layoutId: string,
        widgetId: string,
        userId: string | null | undefined,
        expectedVersion: number
    ): Promise<void> {
        return this.layoutService.resetLayoutZoneWidgetOverride(metahubId, layoutId, widgetId, userId, expectedVersion)
    }

    /** Delegates updateLayoutZoneWidgetConfig to the focused internal layout service. */
    async updateLayoutZoneWidgetConfig(
        metahubId: string,
        layoutId: string,
        widgetId: string,
        config: Record<string, unknown>,
        userId: string | null | undefined,
        expectedVersion: number
    ): Promise<LayoutZoneWidgetRow> {
        return this.layoutService.updateLayoutZoneWidgetConfig(metahubId, layoutId, widgetId, config, userId, expectedVersion)
    }

    /** Delegates toggleLayoutZoneWidgetActive to the focused internal layout service. */
    async toggleLayoutZoneWidgetActive(
        metahubId: string,
        layoutId: string,
        widgetId: string,
        isActive: boolean,
        userId: string | null | undefined,
        expectedVersion: number
    ): Promise<LayoutZoneWidgetRow> {
        return this.layoutService.toggleLayoutZoneWidgetActive(metahubId, layoutId, widgetId, isActive, userId, expectedVersion)
    }
}
