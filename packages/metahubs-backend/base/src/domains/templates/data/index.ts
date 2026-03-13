import type { MetahubTemplateManifest } from '@universo/types'
import { basicTemplate } from './basic.template'
import { basicDemoTemplate } from './basic-demo.template'

/**
 * Registry of all built-in template manifests.
 * Add new templates here — the platform migration seeder will process them.
 */
export const builtinTemplates: MetahubTemplateManifest[] = [basicTemplate, basicDemoTemplate]

/** Default template codename used when no template is explicitly chosen. */
export const DEFAULT_TEMPLATE_CODENAME = 'basic'
