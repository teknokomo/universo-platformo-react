import type { Request, Response, NextFunction } from 'express'
import type { DataSource, Repository } from 'typeorm'
import { UnikUser } from '@universo/uniks-backend'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { UnikRole, hasRequiredRole, isValidUnikRole } from './roles'

const membershipCacheSymbol = Symbol('workspaceAccessMembershipCache')

type MembershipCache = Map<string, Map<string, UnikUser | null>>

type RequireRoleOptions = {
    allowedRoles?: UnikRole[]
    errorMessage?: string
}

const ensureDataSource = (dataSource: DataSource): DataSource => {
    if (!dataSource?.isInitialized) {
        throw new Error('DataSource is not initialized')
    }
    return dataSource
}

const getCacheForRequest = (req: Request): MembershipCache => {
    const anyReq = req as any
    if (!anyReq[membershipCacheSymbol]) {
        anyReq[membershipCacheSymbol] = new Map()
    }
    return anyReq[membershipCacheSymbol] as MembershipCache
}

export class WorkspaceAccessService {
    constructor(private readonly getDataSourceFn: () => DataSource = () => ensureDataSource(getRunningExpressApp().AppDataSource)) {}

    private get dataSource(): DataSource {
        return ensureDataSource(this.getDataSourceFn())
    }

    private get membershipRepository(): Repository<UnikUser> {
        return this.dataSource.getRepository(UnikUser)
    }

    private async readMembership(userId: string, unikId: string): Promise<UnikUser | null> {
        if (!userId || !unikId) return null
        return this.membershipRepository.findOne({ where: { user_id: userId, unik_id: unikId } })
    }

    private async getCachedMembership(req: Request, userId: string, unikId: string): Promise<UnikUser | null> {
        const cache = getCacheForRequest(req)
        const byUser = cache.get(userId) ?? new Map<string, UnikUser | null>()
        if (!cache.has(userId)) {
            cache.set(userId, byUser)
        }

        if (byUser.has(unikId)) {
            return byUser.get(unikId) ?? null
        }
        const membership = await this.readMembership(userId, unikId)
        byUser.set(unikId, membership ?? null)
        return membership ?? null
    }

    async hasUnikAccess(req: Request, userId: string, unikId: string): Promise<boolean> {
        const membership = await this.getCachedMembership(req, userId, unikId)
        return Boolean(membership)
    }

    async requireUnikRole(req: Request, userId: string, unikId: string, options: RequireRoleOptions = {}): Promise<UnikUser> {
        const membership = await this.getCachedMembership(req, userId, unikId)
        if (!membership) {
            const err = Object.assign(new Error(options.errorMessage ?? 'Access denied: membership not found'), { status: 403 })
            throw err
        }

        // Validate role from database is a known role
        if (!isValidUnikRole(membership.role)) {
            const err = Object.assign(new Error(`Invalid role in database: ${membership.role}`), { status: 500 })
            throw err
        }

        if (options.allowedRoles?.length && !hasRequiredRole(membership.role as UnikRole, options.allowedRoles)) {
            const err = Object.assign(new Error(options.errorMessage ?? 'Access denied: insufficient role'), { status: 403 })
            throw err
        }
        return membership
    }

    async getUserMemberships(userId: string): Promise<UnikUser[]> {
        if (!userId) return []
        return this.membershipRepository.find({ where: { user_id: userId } })
    }

    async getUnikIdForCanvas(canvasId: string): Promise<string | null> {
        if (!canvasId) return null
        const result = await this.dataSource.query(
            `
            SELECT space.unik_id AS "unikId"
            FROM spaces_canvases sc
            INNER JOIN spaces space ON space.id = sc.space_id
            WHERE sc.canvas_id = $1
            LIMIT 1
            `,
            [canvasId]
        )

        const unikIdFromSpace = result?.[0]?.unikId as string | null | undefined
        if (unikIdFromSpace) {
            return unikIdFromSpace
        }

        return null
    }

    async hasCanvasAccess(req: Request, userId: string, canvasId: string): Promise<boolean> {
        if (!userId || !canvasId) return false
        const unikId = await this.getUnikIdForCanvas(canvasId)
        if (!unikId) return false
        return this.hasUnikAccess(req, userId, unikId)
    }
}

export const workspaceAccessService = new WorkspaceAccessService()

export const resolveRequestUserId = (req: Request): string | undefined => {
    const user: any = (req as any).user
    return user?.id ?? user?.sub ?? user?.user_id ?? user?.userId ?? undefined
}

type EnsureMembershipOptions = {
    roles?: UnikRole[]
    errorMessage?: string
}

export const ensureUnikMembershipResponse = async (
    req: Request,
    res: Response,
    unikId: string,
    options: EnsureMembershipOptions = {}
): Promise<string | null> => {
    const userId = resolveRequestUserId(req)
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized: User not authenticated' })
        return null
    }
    try {
        await workspaceAccessService.requireUnikRole(req, userId, unikId, {
            allowedRoles: options.roles,
            errorMessage: options.errorMessage
        })
        return userId
    } catch (error: any) {
        if (typeof error?.status === 'number') {
            res.status(error.status).json({ error: error.message })
            return null
        }
        throw error
    }
}

export const requireUnikRole = (roles: UnikRole[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = resolveRequestUserId(req)
            const unikId = (req.params?.unikId as string) || (req.params?.id as string)
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized: user not resolved' })
            }
            if (!unikId) {
                return res.status(400).json({ error: 'Unik ID is required' })
            }
            await workspaceAccessService.requireUnikRole(req, userId, unikId, { allowedRoles: roles })
            next()
        } catch (error: any) {
            if (typeof error?.status === 'number') {
                return res.status(error.status).json({ error: error.message })
            }
            next(error)
        }
    }
}

export const requireUnikMembership = () => requireUnikRole([])
