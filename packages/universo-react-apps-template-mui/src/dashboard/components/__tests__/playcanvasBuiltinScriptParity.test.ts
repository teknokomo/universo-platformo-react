import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
    assertPlayCanvasBuiltinScriptCatalog,
    PLAYCANVAS_BUILTIN_SCRIPT_ASSETS,
    readCanonicalPlayCanvasBuiltinAsset
} from '../../../../../../tools/testing/e2e/support/playcanvasBuiltinScriptParity'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../')

describe('PlayCanvas builtin script catalog', () => {
    it('keeps the canonical assets valid and free of the removed frontend duplicate', () => {
        expect(() => assertPlayCanvasBuiltinScriptCatalog(repoRoot)).not.toThrow()
        expect(PLAYCANVAS_BUILTIN_SCRIPT_ASSETS.map((asset) => asset.scriptName)).toEqual(['flightControl', 'followCamera', 'remoteShips'])
    })

    it('serves the shared flight-math library from the same canonical asset root', () => {
        expect(readCanonicalPlayCanvasBuiltinAsset(repoRoot, 'libraries/flight-math.ts')).toContain('export const normalizeForward')
    })
})
