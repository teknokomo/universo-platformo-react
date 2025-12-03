/**
 * Data Transfer Objects for DocumentStore
 */
import { DocumentStore } from '../database/entities/DocumentStore'
import { DocumentStoreStatus, IDocumentStoreLoader, IDocumentStoreLoaderFile, IDocumentStoreWhereUsed, addLoaderSource } from '../Interface'

export class DocumentStoreDTO {
    id: string
    name: string
    description: string
    files: IDocumentStoreLoaderFile[]
    whereUsed: IDocumentStoreWhereUsed[]
    createdDate: Date
    updatedDate: Date
    status: DocumentStoreStatus
    chunkOverlap: number
    splitter: string
    totalChunks: number
    totalChars: number
    chunkSize: number
    loaders: IDocumentStoreLoader[]
    vectorStoreConfig: Record<string, unknown> | null
    embeddingConfig: Record<string, unknown> | null
    recordManagerConfig: Record<string, unknown> | null

    static fromEntity(entity: DocumentStore): DocumentStoreDTO {
        const documentStoreDTO = new DocumentStoreDTO()

        Object.assign(documentStoreDTO, entity)
        documentStoreDTO.id = entity.id
        documentStoreDTO.name = entity.name
        documentStoreDTO.description = entity.description
        documentStoreDTO.status = entity.status
        documentStoreDTO.totalChars = 0
        documentStoreDTO.totalChunks = 0

        if (entity.whereUsed) {
            documentStoreDTO.whereUsed = JSON.parse(entity.whereUsed) as IDocumentStoreWhereUsed[]
        } else {
            documentStoreDTO.whereUsed = []
        }

        if (entity.vectorStoreConfig) {
            documentStoreDTO.vectorStoreConfig = JSON.parse(entity.vectorStoreConfig) as Record<string, unknown>
        } else {
            documentStoreDTO.vectorStoreConfig = null
        }

        if (entity.embeddingConfig) {
            documentStoreDTO.embeddingConfig = JSON.parse(entity.embeddingConfig) as Record<string, unknown>
        } else {
            documentStoreDTO.embeddingConfig = null
        }

        if (entity.recordManagerConfig) {
            documentStoreDTO.recordManagerConfig = JSON.parse(entity.recordManagerConfig) as Record<string, unknown>
        } else {
            documentStoreDTO.recordManagerConfig = null
        }

        if (entity.loaders) {
            documentStoreDTO.loaders = JSON.parse(entity.loaders) as IDocumentStoreLoader[]
            documentStoreDTO.loaders.forEach((loader) => {
                documentStoreDTO.totalChars += loader.totalChars || 0
                documentStoreDTO.totalChunks += loader.totalChunks || 0
                loader.source = addLoaderSource(loader)
                if (loader.status !== 'SYNC') {
                    documentStoreDTO.status = DocumentStoreStatus.STALE
                }
            })
        } else {
            documentStoreDTO.loaders = []
        }

        return documentStoreDTO
    }

    static fromEntities(entities: DocumentStore[]): DocumentStoreDTO[] {
        return entities.map((entity) => this.fromEntity(entity))
    }

    static toEntity(body: Record<string, unknown>): DocumentStore {
        const docStore = new DocumentStore()
        Object.assign(docStore, body)
        docStore.loaders = '[]'
        docStore.whereUsed = '[]'
        // when a new document store is created, it is empty and in sync
        docStore.status = DocumentStoreStatus.EMPTY_SYNC
        return docStore
    }
}
