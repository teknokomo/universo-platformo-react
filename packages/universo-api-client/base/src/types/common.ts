/**
 * Common API types and interfaces
 */

export interface ApiResponse<T> {
    data: T
    status: number
    statusText: string
}

export interface PaginatedResponse<T> {
    items: T[]
    total: number
    page?: number
    pageSize?: number
}

export interface ApiError {
    message: string
    code?: string
    status?: number
    details?: Record<string, unknown>
}

export interface ApiListParams {
    page?: number
    pageSize?: number
    sort?: string
    order?: 'asc' | 'desc'
    search?: string
}

export type Nullable<T> = T | null
export type Optional<T> = T | undefined

/**
 * Base entity with common fields
 */
export interface BaseEntity {
    readonly id: string
    readonly createdDate: string
    readonly updatedDate: string
}

/**
 * Entity with unik ownership
 */
export interface UnikEntity extends BaseEntity {
    readonly unikId: string
}

/**
 * Entity with space context
 */
export interface SpaceEntity extends UnikEntity {
    readonly spaceId: string | null
}
