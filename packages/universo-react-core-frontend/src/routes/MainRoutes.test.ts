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

    it('keeps the protected application admin branch ahead of the public runtime wildcard', () => {
        const source = readMainRoutesSource()
        const routeExport = source.match(/export default \[([^\]]+)\]/)?.[1] ?? ''
        const adminRouteIndex = routeExport.indexOf('ApplicationAdminRoute')
        const minimalRoutesIndex = routeExport.indexOf('MinimalRoutes')

        expect(source).toContain("path: 'a/:applicationId/admin'")
        expect(source).toContain("path: 'a/:applicationId/*'")
        expect(source).toContain('<AuthGuard>')
        expect(source).toContain('<ApplicationAdminResolver />')
        expect(source).toContain('resolveApplicationRuntimeReference(applicationId)')
        expect(source).toContain('return <Navigate to={target} replace />')
        expect(adminRouteIndex).toBeGreaterThanOrEqual(0)
        expect(minimalRoutesIndex).toBeGreaterThanOrEqual(0)
        expect(adminRouteIndex).toBeLessThan(minimalRoutesIndex)
    })

    it('mounts the deterministic runtime entry outside AuthGuard so public and anonymous refs resolve before authorization', () => {
        const source = readMainRoutesSource()
        // The single entry decides between the anonymous published-read
        // runtime and the authenticated guard/runtime fallback internally; the
        // wildcard route itself must stay outside AuthGuard.
        expect(source).toContain('ApplicationsApplicationRuntimeEntry')

        const runtimeRouteStart = source.indexOf("path: 'a/:applicationId/*'")
        const runtimeRouteSource = source.slice(runtimeRouteStart, runtimeRouteStart + 200)
        expect(runtimeRouteSource).toContain('component: PublicAwareApplicationRuntime')
        expect(runtimeRouteSource).not.toContain('guard: AuthGuard')
    })
})
