import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const readMainRoutesSource = () => readFileSync(join(currentDir, 'MainRoutes.tsx'), 'utf8')

describe('MainRoutes route ordering', () => {
    it('places the chrome-free PlayCanvas Editor fullscreen route before the general metahub layout', () => {
        const source = readMainRoutesSource()
        const routeExport = source.match(/export default \[([^\]]+)\]/)?.[1] ?? ''

        expect(routeExport).toContain('MinimalRoutes')
        expect(routeExport).toContain('MainRoutes')
        expect(routeExport.indexOf('MinimalRoutes')).toBeLessThan(routeExport.indexOf('MainRoutes'))
    })

    it('matches fullscreen editor paths before the generic resources page inside the metahub layout', () => {
        const source = readMainRoutesSource()
        const fullscreenRouteIndex = source.indexOf("path: 'resources/packages/:packageSlug/editor/fullscreen'")
        const resourcesRouteIndex = source.indexOf("path: 'resources'")

        expect(fullscreenRouteIndex).toBeGreaterThanOrEqual(0)
        expect(resourcesRouteIndex).toBeGreaterThanOrEqual(0)
        expect(fullscreenRouteIndex).toBeLessThan(resourcesRouteIndex)
    })
})
