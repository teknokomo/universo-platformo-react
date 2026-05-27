import { describe, expect, it } from 'vitest'

import { Room } from './index'

describe('@universo-react/colyseus-server', () => {
    it('re-exports the Colyseus server API', () => {
        expect(Room).toBeTypeOf('function')
    })
})
