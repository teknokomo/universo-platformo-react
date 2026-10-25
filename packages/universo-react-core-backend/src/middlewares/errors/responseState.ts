import type { Response } from 'express'

export const isResponseClosedBeforeFinish = (response: Pick<Response, 'destroyed' | 'writableFinished'>): boolean =>
    response.destroyed && !response.writableFinished
