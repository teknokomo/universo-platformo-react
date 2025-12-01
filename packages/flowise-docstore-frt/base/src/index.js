/**
 * @flowise/docstore-frt
 *
 * Frontend components for Document Store management
 */

// =============================================
// Document Store Views
// =============================================
export { default as DocumentStore } from './pages/docstore/index.jsx'
export { default as AddDocStoreDialog } from './pages/docstore/AddDocStoreDialog.jsx'
export { default as ComponentsListDialog } from './pages/docstore/ComponentsListDialog.jsx'
export { default as DeleteDocStoreDialog } from './pages/docstore/DeleteDocStoreDialog.jsx'
export { default as DocStoreAPIDialog } from './pages/docstore/DocStoreAPIDialog.jsx'
export { default as DocStoreInputHandler } from './pages/docstore/DocStoreInputHandler.jsx'
export { default as DocumentLoaderListDialog } from './pages/docstore/DocumentLoaderListDialog.jsx'
export { default as DocumentStoreDetail } from './pages/docstore/DocumentStoreDetail.jsx'
export { default as DocumentStoreStatus } from './pages/docstore/DocumentStoreStatus.jsx'
export { default as ExpandedChunkDialog } from './pages/docstore/ExpandedChunkDialog.jsx'
export { default as LoaderConfigPreviewChunks } from './pages/docstore/LoaderConfigPreviewChunks.jsx'
export { default as ShowStoredChunks } from './pages/docstore/ShowStoredChunks.jsx'
export { default as UpsertHistoryDetailsDialog } from './pages/docstore/UpsertHistoryDetailsDialog.jsx'
export { default as UpsertHistorySideDrawer } from './pages/docstore/UpsertHistorySideDrawer.jsx'
export { default as VectorStoreConfigure } from './pages/docstore/VectorStoreConfigure.jsx'
export { default as VectorStoreQuery } from './pages/docstore/VectorStoreQuery.jsx'

// =============================================
// Vector Store Views
// =============================================
export { default as UpsertHistoryDialog } from './pages/vectorstore/UpsertHistoryDialog.jsx'
export { default as UpsertResultDialog } from './pages/vectorstore/UpsertResultDialog.jsx'
export { default as VectorStoreDialog } from './pages/vectorstore/VectorStoreDialog.jsx'
export { default as VectorStorePopUp } from './pages/vectorstore/VectorStorePopUp.jsx'

// =============================================
// i18n Resources
// =============================================
export { docstoreResources, registerDocstoreI18n } from './i18n/index.ts'
