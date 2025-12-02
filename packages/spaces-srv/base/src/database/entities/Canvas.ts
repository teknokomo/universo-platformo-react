import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, OneToMany } from 'typeorm'
import { SpaceCanvas } from './SpaceCanvas'
import { CanvasType } from '../../types'

@Entity('canvases')
export class Canvas {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ default: 'Canvas 1' })
    name!: string

    @Column({ type: 'text' })
    flowData!: string

    // ═══════════════════════════════════════════════════════════════════════
    // Canvas-specific fields (from ChatFlow)
    // ═══════════════════════════════════════════════════════════════════════
    @Column({ nullable: true })
    deployed?: boolean

    @Column({ nullable: true })
    isPublic?: boolean

    @Column({ nullable: true })
    apikeyid?: string

    @Column({ nullable: true, type: 'text' })
    chatbotConfig?: string

    @Column({ nullable: true, type: 'text' })
    apiConfig?: string

    @Column({ nullable: true, type: 'text' })
    analytic?: string

    @Column({ nullable: true, type: 'text' })
    speechToText?: string

    @Column({ nullable: true, type: 'text' })
    followUpPrompts?: string

    @Column({ nullable: true, type: 'text' })
    category?: string

    @Column({ nullable: true, type: 'text' })
    type?: CanvasType

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
    @OneToMany(() => SpaceCanvas, (spaceCanvas) => spaceCanvas.canvas)
    spaceCanvases?: SpaceCanvas[]
}
