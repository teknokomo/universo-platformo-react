import { createHash } from 'node:crypto'
import { isUuidV7 } from '@universo-react/utils'

/**
 * Derive a stable UUID-v7 lineage identity for a sync-generated widget.
 *
 * Generated runtime widgets do not have a source snapshot row id. Their
 * source lineage must therefore be deterministic across every materialization
 * of the same source layout and lineage key.
 */
export const stableLineageUuidV7 = (layoutId: string, lineageKey: string): string => {
    if (!isUuidV7(layoutId)) {
        throw new Error('[SchemaSync] Generated widget lineage requires a UUID v7 layout id')
    }

    const digest = createHash('sha256').update(`application-layout-widget:${lineageKey}`, 'utf8').digest('hex')
    const timestamp = layoutId.replace(/-/gu, '').slice(0, 12)
    const variant = ['8', '9', 'a', 'b'][Number.parseInt(digest[16] ?? '0', 16) % 4]
    return `${timestamp.slice(0, 8)}-${timestamp.slice(8, 12)}-7${digest.slice(13, 16)}-${variant}${digest.slice(17, 20)}-${digest.slice(
        20,
        32
    )}`
}
