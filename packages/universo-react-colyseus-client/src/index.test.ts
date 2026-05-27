import { describe, expect, it } from 'vitest'

import { Client } from './index'

describe('@universo-react/colyseus-client', () => {
    it('re-exports the Colyseus client SDK API', () => {
        expect(Client).toBeTypeOf('function')
    })
})
