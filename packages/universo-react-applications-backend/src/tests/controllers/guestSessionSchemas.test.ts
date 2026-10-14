import { globalShortLinkUuidV7Schema } from '@universo-react/types'
import { createGuestSessionSchema } from '../../controllers/runtimeGuest/guestSessionSchemas'

describe('guest session workspace scope', () => {
    const validInput = { accessLinkId: '019ccefc-2f7b-7b36-82f4-85cdb1312271' }

    it('accepts only optional UUID v7 workspace scopes', () => {
        const workspaceId = '019ccefc-2f7b-7b36-82f4-85cdb1312269'
        expect(createGuestSessionSchema.parse({ ...validInput, workspaceId }).workspaceId).toBe(workspaceId)
        expect(createGuestSessionSchema.parse(validInput).workspaceId).toBeUndefined()
        expect(globalShortLinkUuidV7Schema.safeParse('019ccefc-2f7b-4b36-82f4-85cdb1312269').success).toBe(false)
        expect(createGuestSessionSchema.safeParse({ ...validInput, workspaceId: '019ccefc-2f7b-4b36-82f4-85cdb1312269' }).success).toBe(
            false
        )
    })
})
