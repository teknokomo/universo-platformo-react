import { resolveEffectiveRolePermissions, type ApplicationRole } from '../routes/guards'

export const resolveRealtimeClientCanControl = (
    accessMode: 'member' | 'public',
    role: ApplicationRole,
    settings?: Record<string, unknown> | null
): boolean => accessMode === 'member' && resolveEffectiveRolePermissions(role, settings ?? {}).editContent === true

export const selectRealtimeControllerSessionId = (
    clients: readonly { sessionId: string }[],
    clientControl: ReadonlyMap<string, boolean>,
    excludedSessionId?: string
): string | null =>
    clients.find((candidate) => candidate.sessionId !== excludedSessionId && clientControl.get(candidate.sessionId) === true)?.sessionId ??
    null

const REALTIME_MATCHMAKE_METHODS = new Set(['join', 'joinOrCreate'])

export const isRealtimeMatchmakeMethodAllowed = (method: string): boolean => REALTIME_MATCHMAKE_METHODS.has(method)
