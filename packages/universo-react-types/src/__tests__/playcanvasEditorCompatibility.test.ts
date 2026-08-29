import { describe, expect, it } from 'vitest'
import {
    PLAYCANVAS_EDITOR_COMPATIBILITY_MAX_ASSET_DOCUMENT_KEYS,
    isSafePlayCanvasEditorScriptAttributeName,
    playCanvasEditorCompatibilityAssetDocumentSchema
} from '../common/playcanvasEditorCompatibility'

describe('PlayCanvas Editor compatibility asset documents', () => {
    it('accepts bounded editor documents and safe script attribute names', () => {
        const parsed = playCanvasEditorCompatibilityAssetDocumentSchema.safeParse({
            item_id: 100,
            name: 'flight-control.mjs',
            scripts: {
                FlightControl: {
                    attributes: [{ name: 'speed', type: 'number', default: 2 }]
                }
            }
        })

        expect(parsed.success).toBe(true)
        expect(isSafePlayCanvasEditorScriptAttributeName('FlightControl')).toBe(true)
        expect(isSafePlayCanvasEditorScriptAttributeName('flight-control_2')).toBe(true)
    })

    it('rejects prototype-pollution keys and unsafe script names', () => {
        const payload = JSON.parse('{"scripts":{"__proto__":{"polluted":true}}}') as Record<string, unknown>

        expect(playCanvasEditorCompatibilityAssetDocumentSchema.safeParse(payload).success).toBe(false)
        expect(isSafePlayCanvasEditorScriptAttributeName('__proto__')).toBe(false)
        expect(isSafePlayCanvasEditorScriptAttributeName('constructor')).toBe(false)
        expect(isSafePlayCanvasEditorScriptAttributeName('script name')).toBe(false)
    })

    it('rejects oversized, deeply nested, and excessively wide documents', () => {
        const deep: Record<string, unknown> = {}
        let cursor = deep
        for (let index = 0; index < 25; index += 1) {
            const child: Record<string, unknown> = {}
            cursor.child = child
            cursor = child
        }

        const wide = Object.fromEntries(
            Array.from({ length: PLAYCANVAS_EDITOR_COMPATIBILITY_MAX_ASSET_DOCUMENT_KEYS + 1 }, (_, index) => [`field-${index}`, index])
        )

        expect(playCanvasEditorCompatibilityAssetDocumentSchema.safeParse({ deep }).success).toBe(false)
        expect(playCanvasEditorCompatibilityAssetDocumentSchema.safeParse({ wide }).success).toBe(false)
        expect(playCanvasEditorCompatibilityAssetDocumentSchema.safeParse({ source: 'x'.repeat(4097) }).success).toBe(false)
    })
})
