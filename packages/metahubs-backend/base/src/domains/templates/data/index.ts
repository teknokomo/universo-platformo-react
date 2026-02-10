import type { MetahubTemplateManifest } from '@universo/types'
import { basicTemplate } from './basic.template'

/**
 * Registry of all built-in template manifests.
 * Add new templates here — the seeder will process all of them at startup.
 */
export const builtinTemplates: MetahubTemplateManifest[] = [
    basicTemplate
]

/** Default template codename used when no template is explicitly chosen. */
export const DEFAULT_TEMPLATE_CODENAME = 'basic'
