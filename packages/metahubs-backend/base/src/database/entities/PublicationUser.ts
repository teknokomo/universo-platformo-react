import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm'
import { Publication } from './Publication'

/**
 * PublicationUser entity - user-publication membership association.
 *
 * Tracks which users have access to which publications and their roles.
 * Roles: owner, admin, editor, viewer
 */
@Entity({ name: 'publications_users', schema: 'metahubs' })
export class PublicationUser {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ name: 'publication_id', type: 'uuid' })
    publicationId!: string

    @ManyToOne(() => Publication, (p) => p.publicationUsers, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'publication_id' })
    publication!: Publication

    @Column({ name: 'user_id', type: 'uuid' })
    userId!: string

    @Column({ type: 'varchar', length: 50, default: 'owner' })
    role!: string

    @Column({ type: 'text', nullable: true })
    comment!: string | null

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
