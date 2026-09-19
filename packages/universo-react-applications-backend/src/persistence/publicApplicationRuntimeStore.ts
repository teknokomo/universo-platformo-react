import { qColumn, qSchemaTable } from '@universo-react/database'
import { MARKETING_MAX_RUNTIME_RECORDS, MARKETING_SOURCE_CODENAMES, type MarketingSourceCodename } from '@universo-react/types'

export const PUBLIC_MARKETING_ROW_LIMIT = 1000
import { isUuidV7, type DbExecutor } from '@universo-react/utils'
import { resolveRuntimeCodenameText, runtimeCodenameTextSql, runtimeObjectFilterSql } from '../shared/runtimeHelpers'

export type PublicMarketingRuntimeRow = Record<string, unknown>

export type PublicMarketingRuntimeRows = ReadonlyMap<MarketingSourceCodename, readonly PublicMarketingRuntimeRow[]>

export class PublicMarketingMaterializationError extends Error {
    constructor(message = 'Public marketing materialization is invalid') {
        super(message)
        this.name = 'PublicMarketingMaterializationError'
    }
}

/**
 * Only these logical components may cross the anonymous marketing boundary.
 * The physical column names remain application metadata and are selected only
 * after the logical component has passed this allowlist.
 */
const MARKETING_COMPONENT_ALLOWLIST: Readonly<Record<MarketingSourceCodename, readonly string[]>> = {
    MarketingPageSection: ['SectionKey', 'Title', 'Description'],
    MarketingPageSiteSettings: [
        'BrandName',
        'BrandLogo',
        'HeroTitle',
        'HeroAccent',
        'HeroSubtitle',
        'HeroEmailLabel',
        'HeroEmailPlaceholder',
        'HeroPrimaryActionLabel',
        'HeroPrimaryActionHref',
        'HeroTermsText',
        'HeroTermsLinkLabel',
        'HeroTermsHref',
        'FooterDescription',
        'CopyrightText',
        'CopyrightLabel',
        'CopyrightHref',
        'NewsletterTitle',
        'NewsletterDescription',
        'NewsletterLabel',
        'NewsletterPlaceholder',
        'NewsletterActionLabel',
        'NewsletterActionHref',
        'NewsletterSuccessMessage',
        'NewsletterErrorMessage',
        'NewsletterEnabled',
        'IsVisible'
    ],
    MarketingPageLogo: ['LogoKey', 'ImageLight', 'ImageDark', 'AltText', 'SortOrder', 'IsVisible'],
    MarketingPageFeature: ['FeatureKey', 'IconKey', 'Title', 'Description', 'ImageLight', 'ImageDark', 'SortOrder', 'IsVisible'],
    MarketingPageTestimonial: [
        'TestimonialKey',
        'Name',
        'Occupation',
        'Quote',
        'AvatarUrl',
        'LogoLightUrl',
        'LogoDarkUrl',
        'SortOrder',
        'IsVisible'
    ],
    MarketingPageHighlight: ['HighlightKey', 'IconKey', 'Title', 'Description', 'SortOrder', 'IsVisible'],
    MarketingPagePricing: [
        'TierKey',
        'Title',
        'Subheader',
        'Price',
        'Period',
        'ActionLabel',
        'ActionHref',
        'Featured',
        'SortOrder',
        'IsVisible'
    ],
    MarketingPagePricingBenefit: ['BenefitKey', 'TierRef', 'TierKey', 'Label', 'SortOrder', 'IsVisible'],
    MarketingPageFaq: ['FaqKey', 'Question', 'Answer', 'SortOrder', 'IsVisible'],
    MarketingPageNavigation: ['NavKey', 'Label', 'Href', 'SectionKey', 'SortOrder', 'IsVisible'],
    MarketingPageFooterLink: ['LinkKey', 'GroupKey', 'GroupTitle', 'Label', 'BottomLabel', 'Href', 'IconKey', 'SortOrder', 'IsVisible']
}

interface RuntimeObjectMetadataRow {
    id: unknown
    codename: unknown
    tableName: unknown
}

interface RuntimeComponentMetadataRow {
    objectId: unknown
    codename: unknown
    columnName: unknown
}

const APPLICATION_RUNTIME_LIFECYCLE_SQL = `
    _upl_deleted = false
    AND _app_deleted = false
    AND _upl_archived = false
    AND _app_archived = false
    AND _app_published = true
`

const readObjectMetadata = async (executor: DbExecutor, schemaName: string): Promise<RuntimeObjectMetadataRow[]> => {
    const objectsTable = qSchemaTable(schemaName, '_app_objects')
    const rows = await executor.query<RuntimeObjectMetadataRow>(
        `
        SELECT
            o.id,
            ${runtimeCodenameTextSql('o.codename')} AS codename,
            o.table_name AS "tableName"
        FROM ${objectsTable} o
        WHERE ${runtimeObjectFilterSql('o.kind', 'o.config')}
          AND ${runtimeCodenameTextSql('o.codename')} = ANY($1::text[])
          AND o._upl_deleted = false
          AND o._app_deleted = false
          AND o._upl_archived = false
          AND o._app_archived = false
          AND o._app_published = true
        ORDER BY o.id ASC
        `,
        [MARKETING_SOURCE_CODENAMES]
    )

    const seen = new Set<string>()
    for (const row of rows) {
        const objectName = resolveRuntimeCodenameText(row.codename)
        if (!MARKETING_SOURCE_CODENAMES.includes(objectName as MarketingSourceCodename)) continue
        if (seen.has(objectName)) throw new PublicMarketingMaterializationError('Duplicate public marketing object metadata')
        seen.add(objectName)
        if (!isUuidV7(row.id)) throw new PublicMarketingMaterializationError('Public marketing object metadata has an invalid id')
    }
    return rows
}

const readComponentMetadata = async (
    executor: DbExecutor,
    schemaName: string,
    objectIds: readonly string[]
): Promise<RuntimeComponentMetadataRow[]> => {
    if (objectIds.length === 0) return []

    const componentsTable = qSchemaTable(schemaName, '_app_components')
    return executor.query<RuntimeComponentMetadataRow>(
        `
        SELECT
            c.object_id AS "objectId",
            c.codename,
            c.column_name AS "columnName"
        FROM ${componentsTable} c
        WHERE c.object_id = ANY($1::uuid[])
          AND c.parent_component_id IS NULL
          AND c._upl_deleted = false
          AND c._app_deleted = false
          AND c._upl_archived = false
          AND c._app_archived = false
          AND c._app_published = true
        ORDER BY c.object_id ASC, c.sort_order ASC, c._upl_created_at ASC, c.id ASC
        `,
        [objectIds]
    )
}

const readWorkspaceScopedTables = async (
    executor: DbExecutor,
    schemaName: string,
    tableNames: readonly string[]
): Promise<ReadonlySet<string>> => {
    if (tableNames.length === 0) return new Set()

    const rows = await executor.query<{ tableName: string }>(
        `
        SELECT table_name AS "tableName"
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = ANY($2::text[])
          AND column_name = 'workspace_id'
        ORDER BY table_name ASC
        `,
        [schemaName, tableNames]
    )
    return new Set(rows.map((row) => row.tableName))
}

const readAllowlistedObjectRows = async (
    executor: DbExecutor,
    schemaName: string,
    objectName: MarketingSourceCodename,
    object: RuntimeObjectMetadataRow,
    components: readonly RuntimeComponentMetadataRow[],
    workspaceId: string | null,
    workspaceScopedTables: ReadonlySet<string>
): Promise<PublicMarketingRuntimeRow[]> => {
    const tableName = typeof object.tableName === 'string' ? object.tableName : ''
    if (!tableName) throw new PublicMarketingMaterializationError('Public marketing object has no physical table')

    let table: string
    try {
        table = qSchemaTable(schemaName, tableName)
    } catch {
        throw new PublicMarketingMaterializationError('Public marketing object has an unsafe physical table')
    }
    const allowedLogicalComponents = new Set(MARKETING_COMPONENT_ALLOWLIST[objectName])
    const selectedColumns = new Map<string, string>()

    for (const component of components) {
        const logicalName = resolveRuntimeCodenameText(component.codename)
        if (!allowedLogicalComponents.has(logicalName)) continue

        const columnName = typeof component.columnName === 'string' ? component.columnName : ''
        if (!columnName) throw new PublicMarketingMaterializationError('Public marketing component has no physical column')
        try {
            qColumn(columnName)
        } catch {
            throw new PublicMarketingMaterializationError('Public marketing component has an unsafe physical column')
        }
        if (selectedColumns.has(logicalName)) {
            throw new PublicMarketingMaterializationError('Duplicate public marketing component metadata')
        }
        if (Array.from(selectedColumns.values()).includes(columnName)) {
            throw new PublicMarketingMaterializationError('Public marketing component columns must be unique')
        }
        selectedColumns.set(logicalName, columnName)
    }

    const columns = [qColumn('id'), ...Array.from(selectedColumns.values()).map((column) => qColumn(column))]
    const parameters: unknown[] = []
    const isWorkspaceScoped = workspaceScopedTables.has(tableName)
    if (workspaceId && !isWorkspaceScoped) {
        throw new PublicMarketingMaterializationError('Public marketing object is missing workspace isolation')
    }
    const workspaceClause = isWorkspaceScoped
        ? workspaceId
            ? (() => {
                  parameters.push(workspaceId)
                  return `AND ${qColumn('workspace_id')} = $${parameters.length}`
              })()
            : `AND ${qColumn('workspace_id')} IS NULL`
        : ''
    parameters.push(PUBLIC_MARKETING_ROW_LIMIT + 1)

    const sortColumn = selectedColumns.get('SortOrder')
    const rows = await executor.query<PublicMarketingRuntimeRow>(
        `
        SELECT ${columns.join(', ')}
        FROM ${table}
        WHERE ${APPLICATION_RUNTIME_LIFECYCLE_SQL}${workspaceClause}
        ORDER BY ${sortColumn ? qColumn(sortColumn) : qColumn('id')} ASC NULLS LAST, ${qColumn('id')} ASC
        LIMIT $${parameters.length}
        `,
        parameters
    )
    if (rows.length > PUBLIC_MARKETING_ROW_LIMIT) {
        throw new PublicMarketingMaterializationError('Public marketing object exceeds the published row limit')
    }

    return rows.map((row) => {
        if (!isUuidV7(row.id)) throw new PublicMarketingMaterializationError('Public marketing row has an invalid id')
        const normalized: PublicMarketingRuntimeRow = { id: row.id }
        for (const [logicalName, columnName] of selectedColumns.entries()) {
            if (row[columnName] !== undefined) normalized[logicalName] = row[columnName]
        }
        return normalized
    })
}

/**
 * Read the published marketing materialization in the caller's transaction.
 * The return value contains only known marketing object rows and known fields.
 */
export async function loadAllowlistedPublishedMarketingRows(
    executor: DbExecutor,
    input: { schemaName: string; workspaceId: string | null }
): Promise<PublicMarketingRuntimeRows> {
    if (input.workspaceId !== null && !isUuidV7(input.workspaceId)) {
        throw new PublicMarketingMaterializationError('Public marketing workspace id is invalid')
    }

    const objects = await readObjectMetadata(executor, input.schemaName)
    const objectIds: string[] = objects.flatMap((row) => (isUuidV7(row.id) ? [row.id] : []))
    const components = await readComponentMetadata(executor, input.schemaName, objectIds)
    const workspaceScopedTables = await readWorkspaceScopedTables(
        executor,
        input.schemaName,
        objects.flatMap((row) => (typeof row.tableName === 'string' && row.tableName ? [row.tableName] : []))
    )
    const componentsByObject = new Map<string, RuntimeComponentMetadataRow[]>()
    for (const component of components) {
        if (!isUuidV7(component.objectId)) {
            throw new PublicMarketingMaterializationError('Public marketing component has an invalid object id')
        }
        const objectComponents = componentsByObject.get(component.objectId) ?? []
        objectComponents.push(component)
        componentsByObject.set(component.objectId, objectComponents)
    }

    const rowsByObject = new Map<MarketingSourceCodename, readonly PublicMarketingRuntimeRow[]>()
    let totalRows = 0
    for (const object of objects) {
        const objectName = resolveRuntimeCodenameText(object.codename) as MarketingSourceCodename
        if (!MARKETING_SOURCE_CODENAMES.includes(objectName)) continue
        const rows = await readAllowlistedObjectRows(
            executor,
            input.schemaName,
            objectName,
            object,
            componentsByObject.get(String(object.id)) ?? [],
            input.workspaceId,
            workspaceScopedTables
        )
        totalRows += rows.length
        if (totalRows > MARKETING_MAX_RUNTIME_RECORDS) {
            throw new PublicMarketingMaterializationError('Public marketing runtime data exceeds the record limit')
        }
        rowsByObject.set(objectName, rows)
    }
    return rowsByObject
}
