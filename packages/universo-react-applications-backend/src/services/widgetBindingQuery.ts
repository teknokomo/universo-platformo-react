import type { WidgetBindingProjectionField, WidgetBindingTarget } from '@universo-react/types'

export interface WidgetBindingOrderedQuery {
    readonly orderByComponentCodename: string
    readonly visibilityComponentCodename?: string
    readonly limit: number
}

/** Internal query contract between the widget-binding resolver and persistence adapters. */
export type WidgetBindingRecordQuery =
    | {
          readonly kind: 'semantic-key'
          readonly target: WidgetBindingTarget
          readonly slot: string
          readonly projection: readonly WidgetBindingProjectionField[]
          readonly selector: { readonly componentCodename: string; readonly value: string }
          readonly limit: 2
      }
    | {
          readonly kind: 'record-set'
          readonly target: WidgetBindingTarget
          readonly slot: string
          readonly projection: readonly WidgetBindingProjectionField[]
          readonly ordered: WidgetBindingOrderedQuery
      }
    | {
          readonly kind: 'learner-enrollment-set'
          readonly target: WidgetBindingTarget
          readonly slot: string
          readonly projection: readonly WidgetBindingProjectionField[]
          readonly selector: { readonly targetKind: 'course' | 'track' }
          readonly ordered: WidgetBindingOrderedQuery
      }
    | {
          readonly kind: 'relation-set'
          readonly target: WidgetBindingTarget
          readonly slot: string
          readonly projection: readonly WidgetBindingProjectionField[]
          readonly selector: {
              readonly relationComponentCodename: string
              readonly parentRecordIds: readonly string[]
              readonly parentTarget: WidgetBindingTarget
          }
          readonly ordered: WidgetBindingOrderedQuery
      }
