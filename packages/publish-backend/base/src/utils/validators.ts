// Minimal runtime validators for MVP
import { CreatePublishLinkDto, UpdatePublishLinkDto } from '../types/publishLink.types'

export function validateCreateLinkDto(payload: unknown): string[] | null {
    const errors: string[] = []

    if (!payload || typeof payload !== 'object') {
        return ['payload must be an object']
    }

    const candidate = payload as Partial<CreatePublishLinkDto>

    if (!candidate.unikId || typeof candidate.unikId !== 'string') {
        errors.push('unikId is required and must be string')
    }

    if (candidate.customSlug && typeof candidate.customSlug !== 'string') {
        errors.push('customSlug must be string')
    }

    if (candidate.isPublic !== undefined && typeof candidate.isPublic !== 'boolean') {
        errors.push('isPublic must be boolean when provided')
    }

    if (candidate.technology && typeof candidate.technology !== 'string') {
        errors.push('technology must be string when provided')
    }

    if (candidate.versionGroupId !== undefined && candidate.versionGroupId !== null && typeof candidate.versionGroupId !== 'string') {
        errors.push('versionGroupId must be string when provided')
    }

    if (candidate.targetCanvasId !== undefined && candidate.targetCanvasId !== null && typeof candidate.targetCanvasId !== 'string') {
        errors.push('targetCanvasId must be string when provided')
    }

    if (
        candidate.targetVersionUuid !== undefined &&
        candidate.targetVersionUuid !== null &&
        typeof candidate.targetVersionUuid !== 'string'
    ) {
        errors.push('targetVersionUuid must be string when provided')
    }

    return errors.length ? errors : null
}

export function validateUpdateLinkDto(payload: unknown): string[] | null {
    const errors: string[] = []
    if (!payload || typeof payload !== 'object') {
        return ['payload must be an object']
    }

    const candidate = payload as Partial<UpdatePublishLinkDto>

    if (candidate.customSlug !== undefined && candidate.customSlug !== null && typeof candidate.customSlug !== 'string') {
        errors.push('customSlug must be string when provided')
    }

    if (candidate.isPublic !== undefined && typeof candidate.isPublic !== 'boolean') {
        errors.push('isPublic must be boolean when provided')
    }

    if (candidate.targetCanvasId !== undefined && candidate.targetCanvasId !== null && typeof candidate.targetCanvasId !== 'string') {
        errors.push('targetCanvasId must be string when provided')
    }

    if (
        candidate.targetVersionUuid !== undefined &&
        candidate.targetVersionUuid !== null &&
        typeof candidate.targetVersionUuid !== 'string'
    ) {
        errors.push('targetVersionUuid must be string when provided')
    }

    return errors.length ? errors : null
}
