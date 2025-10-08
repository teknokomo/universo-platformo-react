// Minimal runtime validators for MVP
import { CreatePublishLinkDto, UpdatePublishLinkDto } from '../types/publishLink.types'

export function validateCreateLinkDto(payload: Partial<CreatePublishLinkDto> | any): string[] | null {
  const errors: string[] = []

  if (!payload || typeof payload !== 'object') {
    return ['payload must be an object']
  }

  if (!payload.unikId || typeof payload.unikId !== 'string') {
    errors.push('unikId is required and must be string')
  }

  if (payload.customSlug && typeof payload.customSlug !== 'string') {
    errors.push('customSlug must be string')
  }

  if (payload.isPublic !== undefined && typeof payload.isPublic !== 'boolean') {
    errors.push('isPublic must be boolean when provided')
  }

  if (payload.technology && typeof payload.technology !== 'string') {
    errors.push('technology must be string when provided')
  }

  return errors.length ? errors : null
}

export function validateUpdateLinkDto(payload: Partial<UpdatePublishLinkDto> | any): string[] | null {
  const errors: string[] = []
  if (!payload || typeof payload !== 'object') {
    return ['payload must be an object']
  }

  if (payload.customSlug !== undefined && payload.customSlug !== null && typeof payload.customSlug !== 'string') {
    errors.push('customSlug must be string when provided')
  }

  if (payload.isPublic !== undefined && typeof payload.isPublic !== 'boolean') {
    errors.push('isPublic must be boolean when provided')
  }

  if (payload.targetCanvasId !== undefined && payload.targetCanvasId !== null && typeof payload.targetCanvasId !== 'string') {
    errors.push('targetCanvasId must be string when provided')
  }

  if (
    payload.targetVersionUuid !== undefined &&
    payload.targetVersionUuid !== null &&
    typeof payload.targetVersionUuid !== 'string'
  ) {
    errors.push('targetVersionUuid must be string when provided')
  }

  return errors.length ? errors : null
}
