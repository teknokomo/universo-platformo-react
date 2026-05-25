import { describe, expect, it } from 'vitest'
import { extractImportErrorMessage } from '../importErrorMessage'

describe('extractImportErrorMessage', () => {
    it('formats structured import rollback details instead of returning object text', () => {
        const error = {
            response: {
                data: {
                    error: 'Snapshot import failed and created resources were cleaned up',
                    details: {
                        metahubId: 'metahub-1',
                        importError: 'duplicate key value violates unique constraint'
                    }
                }
            }
        }

        expect(extractImportErrorMessage(error)).toBe(
            'Snapshot import failed and created resources were cleaned up: duplicate key value violates unique constraint'
        )
    })

    it('uses cleanup failure details when both import and cleanup compensation fail', () => {
        const error = {
            response: {
                data: {
                    error: 'Snapshot import failed and cleanup did not complete',
                    details: {
                        importError: 'restore failed',
                        cleanupError: 'drop schema failed'
                    }
                }
            }
        }

        expect(extractImportErrorMessage(error)).toBe(
            'Snapshot import failed and cleanup did not complete: restore failed; drop schema failed'
        )
    })
})
