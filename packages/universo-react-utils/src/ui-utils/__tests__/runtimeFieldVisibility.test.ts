import { describe, expect, it } from 'vitest'

import { isRuntimeTechnicalFieldName } from '../runtimeFieldVisibility'

describe('isRuntimeTechnicalFieldName', () => {
    it('recognizes internal codenames and IDs independent of separator style', () => {
        for (const value of ['ProjectId', 'owner_user_id', 'target-record-id', '_upl_version', 'SourceJson', 'AssignedUserId']) {
            expect(isRuntimeTechnicalFieldName(value)).toBe(true)
        }
    })

    it('keeps semantic field names available for user-facing data', () => {
        for (const value of ['Title', 'Description', 'AssignedUser', 'Valid', 'Candidate']) {
            expect(isRuntimeTechnicalFieldName(value)).toBe(false)
        }
    })
})
