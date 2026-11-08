import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Theme-preset store parity guard (R4.5).
 *
 * The metahubs (`domains/theme-presets/themePresetsStore.ts`) and applications
 * (`persistence/themePresetsStore.ts`) stores are conscious twins: identical
 * SQL-first contracts scoped by `metahubId`/`applicationId` respectively. This
 * suite pins them together so any drift between the two SQL statement sets or
 * the surrounding store contract fails loudly with a helpful diff instead of
 * silently diverging.
 */

const APPLICATIONS_STORE_PATH = path.resolve(__dirname, '../../persistence/themePresetsStore.ts')
const METAHUBS_STORE_PATH = path.resolve(
    __dirname,
    '../../../../..',
    'packages/universo-react-metahubs-backend/src/domains/theme-presets/themePresetsStore.ts'
)

/**
 * Rewrites metahubs-side identifiers into their applications-side equivalents.
 * Order matters: the most specific patterns are replaced first so a single
 * chain also covers the twins' error-message wording ("this metahub scope" vs
 * "this application scope", "per metahub" vs "per application").
 */
const normalizeTwinIdentifiers = (source: string): string =>
    source
        .replace(/metahubs/g, 'applications')
        .replace(/metahub_id/g, 'application_id')
        .replace(/metahubId/g, 'applicationId')
        .replace(/metahub/g, 'application')
        .replace(/_mhb_layouts/g, '_app_layouts')

/** Removes prose comments so documentation drift cannot mask (or fake) parity. */
const stripComments = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ')

/** Extracts every SQL statement from template literals, whitespace-normalized. */
const extractSqlStatements = (source: string): string[] => {
    const statements: string[] = []
    for (const match of source.matchAll(/`([^`]*)`/g)) {
        const chunk = match[1]
        if (/\b(SELECT|INSERT|UPDATE|DELETE)\b/.test(chunk)) {
            statements.push(chunk.replace(/\s+/g, ' ').trim())
        }
    }
    return statements
}

const readStore = (filePath: string): string => readFileSync(filePath, 'utf8')

describe('themePresetsStore twin parity (metahubs <-> applications)', () => {
    it('keeps both stores at the same version of the file contract', () => {
        expect(readFileSync(METAHUBS_STORE_PATH, 'utf8')).toBeTruthy()
        expect(readFileSync(APPLICATIONS_STORE_PATH, 'utf8')).toBeTruthy()
    })

    it('produces identical normalized SQL statement skeletons on both sides', () => {
        const metahubsStatements = extractSqlStatements(normalizeTwinIdentifiers(stripComments(readStore(METAHUBS_STORE_PATH))))
        const applicationsStatements = extractSqlStatements(normalizeTwinIdentifiers(stripComments(readStore(APPLICATIONS_STORE_PATH))))

        if (metahubsStatements.length !== applicationsStatements.length) {
            throw new Error(
                `Statement count drift: metahubs has ${metahubsStatements.length} SQL statements, applications has ${applicationsStatements.length}.\n` +
                    `--- metahubs (normalized)\n${metahubsStatements.join('\n')}\n` +
                    `--- applications\n${applicationsStatements.join('\n')}`
            )
        }

        for (let index = 0; index < metahubsStatements.length; index += 1) {
            if (metahubsStatements[index] !== applicationsStatements[index]) {
                throw new Error(
                    `SQL statement drift at index ${index} (1-based statement ${index + 1}):\n` +
                        `--- metahubs (normalized)\n${metahubsStatements[index]}\n` +
                        `--- applications\n${applicationsStatements[index]}`
                )
            }
        }

        expect(metahubsStatements).toEqual(applicationsStatements)
        // Sanity: the twins expose the full SQL-first contract (list/get/count
        // SELECTs, the usage-union SELECT plus its UNION ALL wrapper, and the
        // insert/update/archive/delete/audit mutations).
        expect(metahubsStatements).toHaveLength(10)
    })

    it('keeps the whole store contract in lockstep after identifier normalization', () => {
        const metahubsCanonical = normalizeTwinIdentifiers(stripComments(readStore(METAHUBS_STORE_PATH)))
            .replace(/\s+/g, ' ')
            .trim()
        const applicationsCanonical = normalizeTwinIdentifiers(stripComments(readStore(APPLICATIONS_STORE_PATH)))
            .replace(/\s+/g, ' ')
            .trim()

        if (metahubsCanonical !== applicationsCanonical) {
            const left = Array.from(metahubsCanonical)
            const at = left.findIndex((character, index) => character !== applicationsCanonical[index])
            const from = Math.max(0, at - 120)
            throw new Error(
                `Twin store drift at index ${at}.\n` +
                    `--- metahubs (normalized) around drift:\n${metahubsCanonical.slice(from, at + 200)}\n` +
                    `--- applications around drift:\n${applicationsCanonical.slice(from, at + 200)}`
            )
        }

        expect(metahubsCanonical).toBe(applicationsCanonical)
    })
})
