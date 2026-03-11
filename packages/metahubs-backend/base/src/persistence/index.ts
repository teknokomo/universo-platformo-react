// Row types and shared contracts
export type {
    SqlQueryable,
    UplSystemFields,
    MhbSystemFields,
    MetahubRow,
    MetahubBranchRow,
    MetahubUserRow,
    PublicationRow,
    PublicationVersionRow,
    PublicationAccessMode,
    PublicationSchemaStatus,
    TemplateRow,
    TemplateVersionRow
} from './types'
export { uplFieldAliases, mhbFieldAliases } from './types'

// Metahub + MetahubUser store
export {
    findMetahubById,
    findMetahubForUpdate,
    updateMetahubFieldsRaw,
    findMetahubByIdNotDeleted,
    findMetahubByCodename,
    findMetahubBySlug,
    findPublicMetahubBySlug,
    listMetahubs,
    createMetahub,
    updateMetahub,
    incrementBranchNumber,
    findMetahubMembership,
    findMetahubMemberById,
    listMetahubMembers,
    addMetahubMember,
    updateMetahubMember,
    removeMetahubMember,
    countMetahubMembers
} from './metahubsStore'
export type {
    MetahubListItem,
    CreateMetahubInput,
    UpdateMetahubInput,
    MetahubMemberListItem,
    AddMetahubMemberInput
} from './metahubsStore'

// Branch store
export {
    findBranchById,
    findBranchByIdNotDeleted,
    findBranchByIdAndMetahub,
    findBranchByCodename,
    findBranchBySchemaName,
    findBranchesByMetahub,
    findBranchForUpdate,
    listBranches,
    listAllBranches,
    createBranch,
    updateBranch,
    countBranches,
    deleteBranchById,
    getMaxBranchNumber,
    countMembersOnBranch,
    clearMemberActiveBranch
} from './branchesStore'
export type {
    BranchListItem,
    CreateBranchInput,
    UpdateBranchInput
} from './branchesStore'

// Publication + PublicationVersion store
export {
    findPublicationById,
    findPublicationByIdNotDeleted,
    listPublications,
    listPublicationsByMetahub,
    createPublication,
    updatePublication,
    findPublicationVersionById,
    findActivePublicationVersion,
    listPublicationVersions,
    getMaxPublicationVersionNumber,
    createPublicationVersion,
    deactivatePublicationVersions,
    activatePublicationVersion
} from './publicationsStore'
export type {
    PublicationListItem,
    CreatePublicationInput,
    UpdatePublicationInput,
    CreatePublicationVersionInput
} from './publicationsStore'

// Template + TemplateVersion store
export {
    findTemplateById,
    findTemplateByCodename,
    findTemplateByIdNotDeleted,
    listActiveTemplatesForCatalog,
    listTemplates,
    createTemplate,
    updateTemplate,
    findTemplateVersionById,
    findActiveTemplateVersion,
    listTemplateVersions,
    getMaxTemplateVersionNumber,
    createTemplateVersion,
    deactivateTemplateVersions
} from './templatesStore'
export type {
    TemplateCatalogItem,
    TemplateListItem,
    CreateTemplateInput,
    CreateTemplateVersionInput
} from './templatesStore'

// SQL-first soft delete helpers
export {
    softDeleteCondition,
    softDelete,
    restoreDeleted,
    purgeOldDeleted,
    countDeleted,
    setPurgeAfter
} from './metahubsQueryHelpers'
export type { SoftDeleteFilterOptions } from './metahubsQueryHelpers'

// Cross-package application queries (SQL-first, no entity imports)
export {
    findApplicationById,
    updateApplicationFields,
    createApplication,
    findApplicationUser,
    createApplicationUser,
    findConnectorsByApplicationId,
    findFirstConnectorByApplicationId,
    createConnector,
    findConnectorPublications,
    findFirstConnectorPublication,
    createConnectorPublication,
    notifyLinkedAppsUpdateAvailable,
    resetLinkedAppsToSynced
} from './applicationQueriesStore'
export type {
    AppRow,
    AppUserRow,
    ConnectorRow,
    ConnectorPublicationRow
} from './applicationQueriesStore'
