import { isResponseClosedBeforeFinish } from './responseState'

describe('isResponseClosedBeforeFinish', () => {
    it('recognizes a response closed before its body finished', () => {
        expect(isResponseClosedBeforeFinish({ destroyed: true, writableFinished: false })).toBe(true)
    })

    it('keeps errors visible while the response is writable', () => {
        expect(isResponseClosedBeforeFinish({ destroyed: false, writableFinished: false })).toBe(false)
    })

    it('does not treat a normally completed response as an aborted client', () => {
        expect(isResponseClosedBeforeFinish({ destroyed: true, writableFinished: true })).toBe(false)
    })
})
