import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm'
import { SpaceCanvas } from './SpaceCanvas'

type UnikReference = { id: string }

@Entity('spaces')
export class Space {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column()
    name!: string

    @Column({ type: 'text', nullable: true })
    description?: string

    @Column({ default: 'private' })
    visibility!: string

    @Column({ name: 'unik_id' })
    unikId!: string

    // ═══════════════════════════════════════════════════════════════════════
    // Versioning fields
    // ═══════════════════════════════════════════════════════════════════════
    @Column({ name: 'version_group_id', type: 'uuid', default: () => 'gen_random_uuid()' })
    versionGroupId!: string

    @Column({ name: 'version_uuid', type: 'uuid', default: () => 'gen_random_uuid()' })
    versionUuid!: string

    @Column({ name: 'version_label', default: 'v1' })
    versionLabel!: string

    @Column({ name: 'version_description', type: 'text', nullable: true })
    versionDescription?: string

    @Column({ name: 'version_index', type: 'int', default: 1 })
    versionIndex!: number

    // ═══════════════════════════════════════════════════════════════════════
    // System status fields
    // ═══════════════════════════════════════════════════════════════════════
    @Column({ name: 'is_active', default: true })
    isActive!: boolean

    @Column({ name: 'is_published', default: false })
    isPublished!: boolean

    @Column({ name: 'is_deleted', default: false })
    isDeleted!: boolean

    @Column({ name: 'deleted_date', type: 'timestamptz', nullable: true })
    deletedDate?: Date

    @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
    deletedBy?: string

    // ═══════════════════════════════════════════════════════════════════════
    // Timestamps
    // ═══════════════════════════════════════════════════════════════════════
    @CreateDateColumn({ name: 'created_date' })
    createdDate!: Date

    @UpdateDateColumn({ name: 'updated_date' })
    updatedDate!: Date

    // ═══════════════════════════════════════════════════════════════════════
    // Relationships
    // ═══════════════════════════════════════════════════════════════════════
    @ManyToOne('Unik', { onDelete: 'CASCADE', nullable: false })
    @JoinColumn({ name: 'unik_id' })
    unik!: UnikReference

    @OneToMany(() => SpaceCanvas, (spaceCanvas) => spaceCanvas.space)
    spaceCanvases!: SpaceCanvas[]
}
