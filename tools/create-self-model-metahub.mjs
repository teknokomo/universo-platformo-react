#!/usr/bin/env node
/**
 * tools/create-self-model-metahub.mjs
 *
 * Development utility: creates a "Metahub Self-Model" — a regular metahub that models
 * the metahub system's own complete structure via the planned 13 sections. Demonstrates self-referential
 * capability, then creates a publication + version, exports the snapshot to a fixture.
 *
 * Usage:
 *   node tools/create-self-model-metahub.mjs [--base-url http://localhost:3000] [--cookie "..."]
 *
 * The script requires an authenticated session. Supply the session cookie via --cookie.
 */

import fs from 'node:fs'
import path from 'node:path'

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
    console.error('Example: node tools/create-self-model-metahub.mjs --cookie "connect.sid=s%3A..."')
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

const SECTIONS = [
    { codename: 'metahubs', name: 'Metahubs', kind: 'catalog' },
    { codename: 'catalogs', name: 'Catalogs', kind: 'catalog' },
    { codename: 'attributes', name: 'Attributes', kind: 'catalog' },
    { codename: 'elements', name: 'Elements', kind: 'catalog' },
    { codename: 'hubs', name: 'Hubs', kind: 'hub' },
    { codename: 'sets', name: 'Sets', kind: 'set' },
    { codename: 'enumerations', name: 'Enumerations', kind: 'enumeration' },
    { codename: 'enum_values', name: 'Enum Values', kind: 'catalog' },
    { codename: 'constants', name: 'Constants', kind: 'catalog' },
    { codename: 'branches', name: 'Branches', kind: 'catalog' },
    { codename: 'publications', name: 'Publications', kind: 'catalog' },
    { codename: 'layouts', name: 'Layouts', kind: 'catalog' },
    { codename: 'settings', name: 'Settings', kind: 'catalog' }
]

function getAttributesForCatalog(codename) {
    const shared = { dataType: 'STRING', isRequired: true }
    const defs = {
        metahubs: [
            { codename: 'name', name: 'Name', ...shared },
            { codename: 'description', name: 'Description', dataType: 'STRING' },
            { codename: 'slug', name: 'Slug', ...shared },
            { codename: 'is_public', name: 'Is Public', dataType: 'BOOLEAN' },
            { codename: 'storage_mode', name: 'Storage Mode', dataType: 'STRING' }
        ],
        catalogs: [
            { codename: 'name', name: 'Name', ...shared },
            { codename: 'codename', name: 'Codename', ...shared },
            { codename: 'kind', name: 'Kind', dataType: 'STRING' }
        ],
        attributes: [
            { codename: 'name', name: 'Name', ...shared },
            { codename: 'codename', name: 'Codename', ...shared },
            { codename: 'data_type', name: 'Data Type', ...shared },
            { codename: 'is_required', name: 'Is Required', dataType: 'BOOLEAN' },
            { codename: 'is_display', name: 'Is Display', dataType: 'BOOLEAN' }
        ],
        elements: [
            { codename: 'name', name: 'Name', ...shared },
            { codename: 'codename', name: 'Codename', ...shared },
            { codename: 'sort_order', name: 'Sort Order', dataType: 'NUMBER' }
        ],
        enum_values: [
            { codename: 'name', name: 'Name', ...shared },
            { codename: 'codename', name: 'Codename', ...shared },
            { codename: 'sort_order', name: 'Sort Order', dataType: 'NUMBER' }
        ],
        constants: [
            { codename: 'name', name: 'Name', ...shared },
            { codename: 'codename', name: 'Codename', ...shared },
            { codename: 'data_type', name: 'Data Type', dataType: 'STRING' }
        ],
        branches: [
            { codename: 'name', name: 'Name', ...shared },
            { codename: 'codename', name: 'Codename', ...shared },
            { codename: 'is_default', name: 'Is Default', dataType: 'BOOLEAN' }
        ],
        publications: [
            { codename: 'name', name: 'Name', ...shared },
            { codename: 'version_number', name: 'Version Number', dataType: 'NUMBER' },
            { codename: 'is_active', name: 'Is Active', dataType: 'BOOLEAN' }
        ],
        layouts: [
            { codename: 'name', name: 'Name', ...shared },
            { codename: 'template_key', name: 'Template Key', dataType: 'STRING' },
            { codename: 'is_default', name: 'Is Default', dataType: 'BOOLEAN' },
            { codename: 'sort_order', name: 'Sort Order', dataType: 'NUMBER' }
        ],
        settings: [
            { codename: 'key', name: 'Key', ...shared },
            { codename: 'value', name: 'Value', dataType: 'STRING' },
            { codename: 'category', name: 'Category', dataType: 'STRING' }
        ]
    }
    return defs[codename] ?? []
}

function getSectionPath(metahubId, section) {
    if (section.kind === 'hub') return `/metahub/${metahubId}/hubs`
    if (section.kind === 'set') return `/metahub/${metahubId}/sets`
    if (section.kind === 'enumeration') return `/metahub/${metahubId}/enumerations`
    return `/metahub/${metahubId}/catalogs`
}

function buildSectionPayload(section, hubId) {
    const payload = {
        codename: section.codename,
        name: section.name,
        namePrimaryLocale: 'en'
    }

    if ((section.kind === 'set' || section.kind === 'enumeration') && hubId) {
        payload.hubIds = [hubId]
        payload.isSingleHub = true
    }

    return payload
}

/* ────── Main flow ────── */

async function main() {
    console.log('─── Metahub Self-Model Creation Script ───')
    console.log(`API: ${API}\n`)

    // 1. Obtain CSRF
    console.log('1. Fetching CSRF token...')
    await fetchCsrf()

    // 2. Create metahub
    console.log('\n2. Creating metahub "Metahub Self-Model"...')
    const metahub = await api('POST', '/metahubs', {
        name: 'Metahub Self-Model',
        namePrimaryLocale: 'en',
        description: 'A metahub that models its own complete structure — demonstrates self-referential capability.',
        descriptionPrimaryLocale: 'en'
    })
    const metahubId = metahub.id ?? metahub.data?.id
    if (!metahubId) throw new Error('Failed to get metahub ID from response')
    console.log(`  ✓ Metahub created: ${metahubId}`)

    // 3. Create self-model sections
    console.log('\n3. Creating the planned 13 self-model sections...')
    const sectionMap = {}
    let hubSectionId
    let enumerationSectionId
    for (const sectionDef of SECTIONS) {
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

        const attrs = sectionDef.kind === 'catalog' ? getAttributesForCatalog(sectionDef.codename) : []
        for (const attr of attrs) {
            await api('POST', `/metahub/${metahubId}/catalog/${sectionId}/attributes`, {
                codename: attr.codename,
                name: attr.name,
                namePrimaryLocale: 'en',
                dataType: attr.dataType ?? 'STRING',
                isRequired: attr.isRequired ?? false
            })
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

    // 4. Create layout, then persist runtime view settings after widget sync
    console.log('\n4. Creating layout with runtime view settings...')
    const layout = await api('POST', `/metahub/${metahubId}/layouts`, {
        templateKey: 'dashboard',
        name: 'Self-Model Dashboard',
        namePrimaryLocale: 'en',
        isDefault: true,
        config: {
            showViewToggle: true,
            showFilterBar: true,
            defaultViewMode: 'card',
            cardColumns: 3,
            rowHeight: 'auto'
        }
    })
    const layoutId = layout.id ?? layout.data?.id
    console.log(`  ✓ Layout created: ${layoutId}`)

    // Add side menu widget
    if (layoutId) {
        try {
            await api('PUT', `/metahub/${metahubId}/layout/${layoutId}/zone-widget`, {
                zone: 'left',
                widgetKey: 'menuWidget',
                config: {
                    autoShowAllCatalogs: true,
                    showTitle: true,
                    title: { en: 'Catalogs' }
                }
            })
            console.log('  ✓ Side menu widget added')
        } catch (e) {
            console.warn(`  ⚠ Could not add menu widget: ${e.message}`)
        }

        // Add details table widget
        try {
            await api('PUT', `/metahub/${metahubId}/layout/${layoutId}/zone-widget`, {
                zone: 'center',
                widgetKey: 'detailsTable'
            })
            console.log('  ✓ Details table widget added')
        } catch (e) {
            console.warn(`  ⚠ Could not add details table widget: ${e.message}`)
        }

        try {
            const currentLayout = await api('GET', `/metahub/${metahubId}/layout/${layoutId}`)
            const currentConfig = currentLayout?.config && typeof currentLayout.config === 'object' ? currentLayout.config : {}

            await api('PATCH', `/metahub/${metahubId}/layout/${layoutId}`, {
                config: {
                    ...currentConfig,
                    showOverviewTitle: false,
                    showOverviewCards: false,
                    showSessionsChart: false,
                    showPageViewsChart: false,
                    showDetailsTitle: true,
                    showDetailsTable: true,
                    showFooter: false,
                    showViewToggle: true,
                    defaultViewMode: 'card',
                    showFilterBar: true,
                    enableRowReordering: true,
                    cardColumns: 3,
                    rowHeight: 'auto'
                }
            })
            console.log('  ✓ Runtime view settings saved after widget sync')
        } catch (e) {
            console.warn(`  ⚠ Could not persist runtime view settings: ${e.message}`)
        }
    }

    // 5. Create publication + version
    console.log('\n5. Creating publication + version...')
    const publication = await api('POST', `/metahub/${metahubId}/publications`, {
        name: 'Self-Model Publication',
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
            description: 'Initial self-model snapshot',
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
        const exportData = await exportRes.json()
        const fixturePath = path.join(fixturesDir, 'self-model-metahub-snapshot.json')
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
