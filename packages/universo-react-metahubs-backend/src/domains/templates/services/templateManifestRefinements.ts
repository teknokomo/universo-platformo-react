import { z } from 'zod'
import type { MetahubTemplateSeed } from '@universo-react/types'
import { CURRENT_STRUCTURE_VERSION_SEMVER } from '../../metahubs/services/structureVersions'
import { collectMarketingPageSeedIntegrityErrors } from './marketingPageSeedIntegrity'

export function validateTemplateMinimumStructureVersion(manifest: { minStructureVersion: string }, ctx: z.RefinementCtx): void {
    if (manifest.minStructureVersion !== CURRENT_STRUCTURE_VERSION_SEMVER) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['minStructureVersion'],
            message: `Template requires unsupported structure version ${manifest.minStructureVersion}; current platform requires ${CURRENT_STRUCTURE_VERSION_SEMVER}`
        })
    }
}

export function validateMarketingPageSeedIntegrity(seed: MetahubTemplateSeed, ctx: z.RefinementCtx): void {
    for (const error of collectMarketingPageSeedIntegrityErrors(seed)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['seed', 'layoutZoneWidgets'],
            message: error
        })
    }
}

export function validateTemplatePresetReferences(manifest: { presets?: Array<{ presetCodename: string }> }, ctx: z.RefinementCtx): void {
    const presetCodenameSet = new Set<string>()
    for (let index = 0; index < (manifest.presets?.length ?? 0); index++) {
        const preset = manifest.presets?.[index]
        if (!preset) continue
        if (presetCodenameSet.has(preset.presetCodename)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['presets', index, 'presetCodename'],
                message: `Duplicate preset reference: ${preset.presetCodename}`
            })
        }
        presetCodenameSet.add(preset.presetCodename)
    }
}
