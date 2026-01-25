import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import type { VersionedLocalizedContent } from '@universo/types'
import { Publication } from './Publication'

@Entity({ name: 'publication_versions', schema: 'metahubs' })
export class PublicationVersion {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ name: 'publication_id', type: 'uuid' })
    publicationId!: string

    @Column({ name: 'branch_id', type: 'uuid', nullable: true })
    branchId!: string | null

    @ManyToOne(() => Publication, (pub) => pub.versions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'publication_id' })
    publication!: Publication

    @Column({ name: 'version_number', type: 'integer' })
    versionNumber!: number

    @Column({ type: 'jsonb', default: {} })
    name!: VersionedLocalizedContent<string>

    @Column({ type: 'jsonb', nullable: true, default: {} })
    description!: VersionedLocalizedContent<string> | null

    /** Full metadata tree (JSON snapshot) */
    @Column({ name: 'snapshot_json', type: 'jsonb' })
    snapshotJson!: Record<string, unknown>

    /** SHA-256 hash for deduplication */
    @Column({ name: 'snapshot_hash', type: 'varchar', length: 64 })
    snapshotHash!: string

    /** Active version used for Application sync */
    @Column({ name: 'is_active', type: 'boolean', default: false })
    isActive!: boolean

    @Column({ name: 'created_by', type: 'uuid', nullable: true })
    createdBy!: string | null

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
