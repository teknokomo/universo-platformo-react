/**
 * Variable types for API client
 */

export interface Variable {
    id: string
    name: string
    value: string
    type: string
    createdDate: Date
    updatedDate: Date
}

export interface CreateVariableDto {
    name: string
    value: string
    type: string
}

export interface UpdateVariableDto {
    name: string
    value: string
    type: string
}
