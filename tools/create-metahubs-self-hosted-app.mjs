#!/usr/bin/env node
/**
 * tools/create-metahubs-self-hosted-app.mjs
 *
 * Development utility: creates the "Metahubs Self-Hosted App" fixture metahub,
 * publishes it, and exports the snapshot used by the self-hosted E2E parity flows.
 *
 * Usage:
 *   node tools/create-metahubs-self-hosted-app.mjs [--base-url http://localhost:3000] [--cookie "..."]
 *
 * The script requires an authenticated session. Supply the session cookie via --cookie.
 */

import fs from 'node:fs'
import path from 'node:path'
import { buildVLC, validateSnapshotEnvelope } from '@universo/utils'
import {
    SELF_HOSTED_APP_CANONICAL_METAHUB,
    SELF_HOSTED_APP_FIXTURE_FILENAME,
    SELF_HOSTED_APP_LAYOUT,
    SELF_HOSTED_APP_PUBLICATION,
    SELF_HOSTED_APP_SECTIONS,
    SELF_HOSTED_APP_SETTINGS_BASELINE,
    assertSelfHostedAppEnvelopeContract,
    buildSelfHostedAppLiveMetahubCodename,
    buildSelfHostedAppLiveMetahubName,
    canonicalizeSelfHostedAppEnvelope,
    getSelfHostedAppCatalogAttributes
} from './testing/e2e/support/selfHostedAppFixtureContract.mjs'

/* ────── CLI args ────── */

const args = process.argv.slice(2)
function getArg(name) {
    const idx = args.indexOf(name)
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined
}

const BASE_URL = getArg('--base-url') || 'http://localhost:3000'
const COOKIE = getArg('--cookie') || ''
const API = `${BASE_URL}/api/v1`

if (!COOKIE) {
    console.error('ERROR: --cookie is required (pass session cookie for authenticated requests).')
    console.error('Example: node tools/create-metahubs-self-hosted-app.mjs --cookie "connect.sid=s%3A..."')
    process.exit(1)
}

/* ────── HTTP helpers ────── */

let csrfToken = ''

async function fetchCsrf() {
    const res = await fetch(`${BASE_URL}/api/v1/auth/csrf`, {
        headers: { cookie: COOKIE }
    })
    if (!res.ok) throw new Error(`CSRF fetch failed: ${res.status}`)
    const data = await res.json()
    csrfToken = data.csrfToken ?? data.token ?? ''
    if (!csrfToken) throw new Error('Could not obtain CSRF token')
    console.log('  ✓ CSRF token obtained')
}

async function api(method, urlPath, body) {
    const headers = {
        cookie: COOKIE,
        'content-type': 'application/json',
        'x-request-from': 'internal'
    }
    if (csrfToken) headers['x-csrf-token'] = csrfToken

    const res = await fetch(`${API}${urlPath}`, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {})
    })
    const text = await res.text()
    let json
    try {
        json = JSON.parse(text)
    } catch {
        json = null
    }
    if (!res.ok) {
        const msg = json?.error ?? json?.message ?? text
        throw new Error(`${method} ${urlPath} → ${res.status}: ${msg}`)
    }
    return json
}

/* ────── Data definitions ────── */

function getSectionPath(metahubId, section) {
    return `/metahub/${metahubId}/entities/${section.kind}/instances`
}

function buildSectionPayload(section, hubId) {
    const payload = {
        codename: section.codename,
        name: section.name,
        namePrimaryLocale: 'en',
        description: section.description,
        descriptionPrimaryLocale: 'en'
    }

    if ((section.kind === 'set' || section.kind === 'enumeration') && hubId) {
        payload.hubIds = [hubId]
        payload.isSingleHub = true
    }

    return payload
}

async function createCatalogElement(metahubId, catalogId, data) {
    return api('POST', `/metahub/${metahubId}/catalog/${catalogId}/elements`, { data })
}

async function seedSettingsBaseline(metahubId, catalogId) {
    for (const row of SELF_HOSTED_APP_SETTINGS_BASELINE) {
        await createCatalogElement(metahubId, catalogId, row)
    }
}

async function waitForDefaultLayoutId(metahubId, { attempts = 20, delayMs = 500 } = {}) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const response = await api('GET', `/metahub/${metahubId}/layouts?limit=20&offset=0`)
        const items = Array.isArray(response?.items) ? response.items : []
        const layoutId = items.find((layout) => layout?.isDefault)?.id ?? items[0]?.id

        if (typeof layoutId === 'string' && layoutId.length > 0) {
            return layoutId
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs))
    }

    throw new Error(`No default layout was returned for metahub ${metahubId}`)
}

/* ────── Main flow ────── */

async function main() {
    console.log('─── Metahubs Self-Hosted App Creation Script ───')
    console.log(`API: ${API}\n`)

    // 1. Obtain CSRF
    console.log('1. Fetching CSRF token...')
    await fetchCsrf()

    // 2. Create metahub
    console.log('\n2. Creating metahub "Metahubs Self-Hosted App"...')
    const liveMetahubName = buildSelfHostedAppLiveMetahubName()
    const liveMetahubCodename = buildSelfHostedAppLiveMetahubCodename()
    const metahub = await api('POST', '/metahubs', {
        name: liveMetahubName,
        namePrimaryLocale: 'en',
        codename: liveMetahubCodename,
        description: SELF_HOSTED_APP_CANONICAL_METAHUB.description,
        descriptionPrimaryLocale: 'en'
    })
    const metahubId = metahub.id ?? metahub.data?.id
    if (!metahubId) throw new Error('Failed to get metahub ID from response')
    console.log(`  ✓ Metahub created: ${metahubId}`)

    // 3. Create self-hosted sections
    console.log(`\n3. Creating the planned ${SELF_HOSTED_APP_SECTIONS.length} self-hosted sections...`)
    const sectionMap = {}
    let hubSectionId
    let enumerationSectionId
    for (const sectionDef of SELF_HOSTED_APP_SECTIONS) {
        const section = await api('POST', getSectionPath(metahubId, sectionDef), buildSectionPayload(sectionDef, hubSectionId))
        const sectionId = section.id ?? section.data?.id
        sectionMap[sectionDef.codename] = sectionId
        console.log(`  ✓ ${sectionDef.kind} "${sectionDef.codename}" → ${sectionId}`)

        if (sectionDef.kind === 'hub') {
            hubSectionId = sectionId
        }
        if (sectionDef.kind === 'enumeration') {
            enumerationSectionId = sectionId
        }

        const attrs = sectionDef.kind === 'catalog' ? getSelfHostedAppCatalogAttributes(sectionDef.codename) : []
        for (const attr of attrs) {
            await api('POST', `/metahub/${metahubId}/catalog/${sectionId}/attributes`, {
                codename: attr.codename,
                name: attr.name,
                namePrimaryLocale: 'en',
                dataType: attr.dataType ?? 'STRING',
                isRequired: attr.isRequired ?? false
            })
        }
        if (sectionDef.codename === 'settings') {
            await seedSettingsBaseline(metahubId, sectionId)
            console.log(`    + ${SELF_HOSTED_APP_SETTINGS_BASELINE.length} settings rows seeded`)
        }
        console.log(`    + ${attrs.length} attributes created`)
    }

    if (enumerationSectionId) {
        await api('POST', `/metahub/${metahubId}/enumeration/${enumerationSectionId}/values`, {
            codename: 'active',
            name: 'Active',
            namePrimaryLocale: 'en',
            isDefault: true
        })
        console.log('    + 1 enumeration value created')
    }

    // 4. Rename/configure the seeded default layout, then persist runtime view settings after widget sync
    console.log('\n4. Configuring canonical default layout with runtime view settings...')
    const layoutId = await waitForDefaultLayoutId(metahubId)
    console.log(`  ✓ Default layout located: ${layoutId}`)

    try {
        const currentLayout = await api('GET', `/metahub/${metahubId}/layout/${layoutId}`)
        const currentConfig = currentLayout?.config && typeof currentLayout.config === 'object' ? currentLayout.config : {}

        await api('PATCH', `/metahub/${metahubId}/layout/${layoutId}`, {
            name: SELF_HOSTED_APP_LAYOUT.name,
            namePrimaryLocale: 'en',
            description: SELF_HOSTED_APP_LAYOUT.description,
            descriptionPrimaryLocale: 'en',
            config: {
                ...currentConfig,
                ...SELF_HOSTED_APP_LAYOUT.runtimeConfig
            }
        })
        console.log('  ✓ Default layout renamed and configured')
    } catch (e) {
        console.warn(`  ⚠ Could not update default layout metadata/config: ${e.message}`)
    }

    try {
        const zoneWidgetsResponse = await api('GET', `/metahub/${metahubId}/layout/${layoutId}/zone-widgets`)
        const zoneWidgets = Array.isArray(zoneWidgetsResponse?.items) ? zoneWidgetsResponse.items : []
        const menuWidgets = zoneWidgets.filter((widget) => widget?.widgetKey === 'menuWidget')
        const primaryMenuWidget = menuWidgets[0]

        if (primaryMenuWidget?.id) {
            await api('PATCH', `/metahub/${metahubId}/layout/${layoutId}/zone-widget/${primaryMenuWidget.id}/config`, {
                config: {
                    ...(primaryMenuWidget.config && typeof primaryMenuWidget.config === 'object' ? primaryMenuWidget.config : {}),
                    autoShowAllSections: true,
                    showTitle: true,
                    title: buildVLC(SELF_HOSTED_APP_LAYOUT.menuTitle.en, SELF_HOSTED_APP_LAYOUT.menuTitle.ru)
                }
            })
        } else {
            await api('PUT', `/metahub/${metahubId}/layout/${layoutId}/zone-widget`, {
                zone: 'left',
                widgetKey: 'menuWidget',
                config: {
                    autoShowAllSections: true,
                    showTitle: true,
                    title: buildVLC(SELF_HOSTED_APP_LAYOUT.menuTitle.en, SELF_HOSTED_APP_LAYOUT.menuTitle.ru)
                }
            })
        }

        for (const widget of menuWidgets.slice(1)) {
            await api('DELETE', `/metahub/${metahubId}/layout/${layoutId}/zone-widget/${widget.id}`)
        }

        console.log('  ✓ Side menu widget configured')
    } catch (e) {
        console.warn(`  ⚠ Could not configure menu widget: ${e.message}`)
    }

    try {
        await api('PUT', `/metahub/${metahubId}/layout/${layoutId}/zone-widget`, {
            zone: 'center',
            widgetKey: 'detailsTable'
        })
        console.log('  ✓ Details table widget configured')
    } catch (e) {
        console.warn(`  ⚠ Could not configure details table widget: ${e.message}`)
    }

    // 5. Create publication + version
    console.log('\n5. Creating publication + version...')
    const publication = await api('POST', `/metahub/${metahubId}/publications`, {
        name: SELF_HOSTED_APP_PUBLICATION.name,
        namePrimaryLocale: 'en'
    })
    const publicationId = publication.id ?? publication.data?.id
    console.log(`  ✓ Publication created: ${publicationId}`)

    if (publicationId) {
        // Sync schema before creating version
        try {
            await api('POST', `/metahub/${metahubId}/publication/${publicationId}/sync`)
            console.log('  ✓ Schema synced')
        } catch (e) {
            console.warn(`  ⚠ Schema sync: ${e.message}`)
        }

        const version = await api('POST', `/metahub/${metahubId}/publication/${publicationId}/versions`, {
            name: SELF_HOSTED_APP_PUBLICATION.versionName,
            namePrimaryLocale: 'en',
            description: SELF_HOSTED_APP_PUBLICATION.versionDescription,
            descriptionPrimaryLocale: 'en'
        })
        const versionId = version.id ?? version.data?.id
        console.log(`  ✓ Version created: ${versionId}`)
    }

    // 6. Export snapshot
    console.log('\n6. Exporting metahub snapshot...')
    const fixturesDir = path.join(process.cwd(), 'tools', 'fixtures')
    fs.mkdirSync(fixturesDir, { recursive: true })

    const exportRes = await fetch(`${API}/metahub/${metahubId}/export`, {
        headers: {
            cookie: COOKIE,
            'x-request-from': 'internal'
        }
    })
    if (!exportRes.ok) {
        console.warn(`  ⚠ Export failed: ${exportRes.status}`)
    } else {
        const exportData = canonicalizeSelfHostedAppEnvelope(await exportRes.json())
        validateSnapshotEnvelope(exportData)
        assertSelfHostedAppEnvelopeContract(exportData)
        const fixturePath = path.join(fixturesDir, SELF_HOSTED_APP_FIXTURE_FILENAME)
        fs.writeFileSync(fixturePath, JSON.stringify(exportData, null, 2))
        console.log(`  ✓ Snapshot exported to: ${fixturePath}`)
    }

    console.log('\n─── Done ───')
    console.log(`Metahub ID: ${metahubId}`)
    console.log(`Sections: ${Object.keys(sectionMap).length}`)
}

main().catch((err) => {
    console.error('\n✗ FATAL:', err.message || err)
    process.exit(1)
})
