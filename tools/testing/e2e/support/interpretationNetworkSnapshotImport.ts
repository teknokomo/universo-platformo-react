// Interpretation Network snapshot import helper.
//
// Mirrors the LMS / MMOOMM snapshot-import flow: load the persisted
// fixture from `tools/fixtures/`, import it through the canonical
// snapshot endpoint, and create a linked application from the imported
// publication so flow / smoke / visual specs navigate the real imported
// workspace.

import { createPublicationLinkedApplication, sendWithCsrf, syncApplicationSchema } from './backend/api-session.mjs'
import type { ApiContext } from './interpretationNetworkRuntime'
import { buildSnapshotEnvelope, validateSnapshotEnvelope } from '@universo-react/utils'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { repoRoot } from './env/load-e2e-env.mjs'
import {
    assertInterpretationNetworkFixtureEnvelopeContract,
    INTERPRETATION_NETWORK_CANONICAL_METAHUB
} from './interpretationNetworkFixtureContract'

export interface ImportInterpretationNetworkSnapshotOptions {
    snapshotFilename: string
    label: string
    isPublic?: boolean
    workspacesEnabled?: boolean
}

export interface ImportInterpretationNetworkSnapshotResult {
    metahub: { id: string; codename?: string; name?: { en?: string } }
    publication: { id: string }
    linkedApplication: { application: { id: string; slug: string } }
    applicationId: string
    applicationSlug: string
}

const readLocalizedLabel = (value: unknown): string => {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object') return ''
    const locales = (value as { locales?: Record<string, { content?: string }> }).locales
    if (locales && typeof locales === 'object') {
        return locales.en?.content ?? locales.ru?.content ?? ''
    }
    const english = (value as { en?: unknown }).en
    return typeof english === 'string' ? english : ''
}

export async function importInterpretationNetworkSnapshot(
    api: ApiContext,
    options: ImportInterpretationNetworkSnapshotOptions
): Promise<ImportInterpretationNetworkSnapshotResult> {
    const snapshotPath = path.resolve(repoRoot, 'tools', 'fixtures', options.snapshotFilename)
    const raw = await readFile(snapshotPath, 'utf8')
    const fixture = JSON.parse(raw) as Record<string, unknown>
    const validatedFixture = validateSnapshotEnvelope(fixture)
    assertInterpretationNetworkFixtureEnvelopeContract(validatedFixture)

    const runId = (validatedFixture.metahub as { codename?: { en?: string } }).codename?.en ?? options.label

    const envelope = buildSnapshotEnvelope({
        metahub: validatedFixture.metahub,
        publication: validatedFixture.publication,
        sourceInstance: validatedFixture.sourceInstance,
        snapshot: validatedFixture.snapshot
    })

    const importResponse = await sendWithCsrf(api, 'POST', '/api/v1/metahubs/import', envelope)
    if (!importResponse.ok) {
        throw new Error(`Interpretation Network snapshot import failed (${importResponse.status}): ${await importResponse.text()}`)
    }

    const importBody = (await importResponse.json()) as {
        metahub?: { id?: string; codename?: string; name?: unknown }
        publication?: { id?: string }
    }
    const metahub = importBody.metahub
    const publication = importBody.publication

    if (!metahub?.id) {
        throw new Error(`Interpretation Network snapshot import did not return a metahub id for ${options.label}`)
    }
    if (readLocalizedLabel(metahub.name) !== INTERPRETATION_NETWORK_CANONICAL_METAHUB.name.en) {
        throw new Error('Interpretation Network snapshot import created a metahub with a non-canonical title')
    }
    if (!publication?.id) {
        throw new Error(`Interpretation Network snapshot import did not return a publication id for ${options.label}`)
    }

    const linkedApplication = await createPublicationLinkedApplication(api, metahub.id, publication.id, {
        name: { en: `E2E ${runId} ${options.label} Interpretation Network Import App` },
        namePrimaryLocale: 'en',
        createApplicationSchema: false,
        isPublic: options.isPublic === true
    })

    const applicationId = linkedApplication?.application?.id
    if (typeof applicationId !== 'string') {
        throw new Error(`Interpretation Network linked application did not return an id for ${options.label}`)
    }

    await syncApplicationSchema(
        api,
        applicationId,
        options.workspacesEnabled === false
            ? {}
            : {
                  schemaOptions: {
                      workspaceModeRequested: 'enabled',
                      acknowledgeIrreversibleWorkspaceEnablement: true
                  }
              }
    )

    return {
        metahub: metahub as { id: string; codename?: string; name?: { en?: string } },
        publication,
        linkedApplication,
        applicationId,
        applicationSlug: linkedApplication.application.slug
    }
}
