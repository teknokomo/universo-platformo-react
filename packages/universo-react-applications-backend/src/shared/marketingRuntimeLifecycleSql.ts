import { qColumn } from '@universo-react/database'

/** Builds the shared lifecycle filter applied before published marketing rows are read. */
export const buildPublicMarketingLifecyclePredicate = (alias?: string): string => {
    const column = (name: string): string => `${alias ? `${qColumn(alias)}.` : ''}${qColumn(name)}`
    return [
        `${column('_upl_deleted')} = false`,
        `${column('_app_deleted')} = false`,
        `${column('_upl_archived')} = false`,
        `${column('_app_archived')} = false`,
        `${column('_app_published')} = true`
    ].join(' AND ')
}
