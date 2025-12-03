import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import { IDocumentStoreFileChunk } from '../../Interface'

@Entity('document_store_file_chunk')
export class DocumentStoreFileChunk implements IDocumentStoreFileChunk {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Index()
    @Column({ type: 'uuid' })
    docId: string

    @Index()
    @Column({ type: 'uuid' })
    storeId: string

    @Column()
    chunkNo: number

    @Column({ nullable: false, type: 'text' })
    pageContent: string

    @Column({ nullable: true, type: 'text' })
    metadata: string
}
