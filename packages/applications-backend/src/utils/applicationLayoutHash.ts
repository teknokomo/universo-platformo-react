import { createHash } from 'node:crypto'
import stableStringify from 'json-stable-stringify'
import type { ApplicationLayout, ApplicationLayoutWidget } from '@universo/types'

export interface ApplicationLayoutHashInput {
    layout: Pick<ApplicationLayout, 'templateKey' | 'name'> &
        Partial<Pick<ApplicationLayout, 'description' | 'config' | 'isActive' | 'isDefault' | 'sortOrder'>> & {
            scopeEntityId?: string | null
        }
    widgets?: Array<
        Partial<Pick<ApplicationLayoutWidget, 'id' | 'layoutId' | 'version'>> &
            Pick<ApplicationLayoutWidget, 'zone' | 'widgetKey' | 'sortOrder' | 'config' | 'isActive'>
    >
}

export function normalizeApplicationLayoutForHash(input: ApplicationLayoutHashInput): Record<string, unknown> {
    const widgets = (input.widgets ?? [])
        .map((widget) => ({
            zone: widget.zone,
            widgetKey: widget.widgetKey,
            sortOrder: widget.sortOrder,
            config: widget.config ?? {},
            isActive: widget.isActive !== false
        }))
        .sort((left, right) => {
            if (left.zone !== right.zone) return left.zone.localeCompare(right.zone)
            if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
            return left.widgetKey.localeCompare(right.widgetKey)
        })

    return {
        layout: {
            scopeEntityId: input.layout.scopeEntityId ?? null,
            templateKey: input.layout.templateKey,
            name: input.layout.name ?? {},
            description: input.layout.description ?? null,
            config: input.layout.config ?? {},
            isActive: input.layout.isActive !== false,
            isDefault: input.layout.isDefault === true,
            sortOrder: input.layout.sortOrder ?? 0
        },
        widgets
    }
}

export function hashApplicationLayoutContent(input: ApplicationLayoutHashInput): string {
    const payload = stableStringify(normalizeApplicationLayoutForHash(input)) ?? '{}'
    return createHash('sha256').update(payload).digest('hex')
}
