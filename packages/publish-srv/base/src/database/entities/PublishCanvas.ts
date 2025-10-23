import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn
} from 'typeorm'

type UnikReference = { id: string }
type SpaceReference = { id: string }
type CanvasReference = { id: string }

type PublishTargetType = 'group' | 'version'

type PublishTechnology = 'arjs' | 'playcanvas' | 'generic'

@Entity({ name: 'publish_canvases', schema: 'uniks' })
export class PublishCanvas {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ name: 'unik_id', type: 'uuid' })
    unikId!: string

    @ManyToOne('Unik', { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'unik_id' })
    unik!: UnikReference

    @Column({ name: 'space_id', type: 'uuid', nullable: true })
    spaceId!: string | null

    @ManyToOne('Space', { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'space_id' })
    space!: SpaceReference | null

    @Column({ name: 'technology', type: 'varchar', length: 64 })
    technology!: PublishTechnology

    @Column({ name: 'target_type', type: 'varchar', length: 16 })
    targetType!: PublishTargetType

    @Column({ name: 'version_group_id', type: 'uuid', nullable: true })
    versionGroupId!: string | null

    @Column({ name: 'target_canvas_id', type: 'uuid', nullable: true })
    targetCanvasId!: string | null

    @ManyToOne('Canvas', { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'target_canvas_id' })
    targetCanvas!: CanvasReference | null

    @Column({ name: 'target_version_uuid', type: 'uuid', nullable: true })
    targetVersionUuid!: string | null

    @Column({ name: 'base_slug', type: 'varchar', length: 32, unique: true })
    baseSlug!: string

    @Column({ name: 'custom_slug', type: 'varchar', length: 64, nullable: true, unique: true })
    customSlug!: string | null

    @Column({ name: 'is_public', type: 'boolean', default: true })
    isPublic!: boolean

    @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
    updatedAt!: Date
}

export type { PublishTargetType, PublishTechnology }
