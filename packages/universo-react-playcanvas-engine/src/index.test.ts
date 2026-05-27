import { describe, expect, it } from 'vitest'

import { Application, Entity } from './index'

describe('@universo-react/playcanvas-engine', () => {
    it('re-exports the PlayCanvas engine API', () => {
        expect(Application).toBeTypeOf('function')
        expect(Entity).toBeTypeOf('function')
    })
})
