/** Typed runtime mutation failure shared without importing the runtime helper facade. */
export class UpdateFailure extends Error {
    constructor(public readonly statusCode: number, public readonly body: Record<string, unknown>) {
        super('Update failed')
    }
}
