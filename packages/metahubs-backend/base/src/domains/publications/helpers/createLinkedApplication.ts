import { localizedContent } from '@universo/utils'
import type { VersionedLocalizedContent } from '@universo/types'
import { generateSchemaName } from '../../ddl'
import {
    createApplication,
    updateApplicationFields,
    createApplicationUser,
    createConnector,
    createConnectorPublication
} from '../../../persistence'
import type { SqlQueryable, AppRow, ConnectorRow, ConnectorPublicationRow } from '../../../persistence'

const { buildLocalizedContent } = localizedContent

/**
 * Options for creating a linked Application with Connector for a Publication
 */
export interface CreateLinkedApplicationOpts {
    exec: SqlQueryable
    publicationId: string
    publicationName: VersionedLocalizedContent<string> | null
    publicationDescription?: VersionedLocalizedContent<string> | null
    metahubName: VersionedLocalizedContent<string> | null
    metahubDescription?: VersionedLocalizedContent<string> | null
    userId: string
}

/**
 * Result of creating a linked Application
 */
export interface CreateLinkedApplicationResult {
    application: AppRow
    connector: ConnectorRow
    connectorPublication: ConnectorPublicationRow
    appSchemaName: string
}

/**
 * Shared helper: creates Application + ApplicationUser (owner) + Connector + ConnectorPublication
 * within the given SQL-queryable context (transaction).
 *
 * Used by:
 * - Publication CREATE handler (auto-create application)
 * - POST .../publication/:publicationId/applications endpoint
 */
export async function createLinkedApplication(opts: CreateLinkedApplicationOpts): Promise<CreateLinkedApplicationResult> {
    const { exec, publicationId, publicationName, publicationDescription, metahubName, metahubDescription, userId } = opts

    // 1. Create Application
    const application = await createApplication(exec, {
        name: publicationName ?? buildLocalizedContent({ en: 'Application' }, 'en')!,
        description: publicationDescription ?? undefined,
        userId
    })

    // 2. Set schemaName and slug
    const appSchemaName = generateSchemaName(application.id)
    const appSlug = `pub-${application.id.slice(0, 8)}`
    const updatedApp = await updateApplicationFields(exec, application.id, {
        schemaName: appSchemaName,
        slug: appSlug
    })

    // 3. Create ApplicationUser (owner)
    await createApplicationUser(exec, {
        applicationId: application.id,
        userId,
        role: 'owner'
    })

    // 4. Create Connector
    const connector = await createConnector(exec, {
        applicationId: application.id,
        name: metahubName ?? buildLocalizedContent({ en: 'Connector' }, 'en')!,
        description: metahubDescription ?? undefined,
        sortOrder: 0,
        userId
    })

    // 5. Create ConnectorPublication
    const connectorPublication = await createConnectorPublication(exec, {
        connectorId: connector.id,
        publicationId,
        sortOrder: 0,
        userId
    })

    return {
        application: updatedApp ?? application,
        connector,
        connectorPublication,
        appSchemaName
    }
}
