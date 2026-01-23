import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany
} from 'typeorm'
import type { VersionedLocalizedContent } from '@universo/types'
import { Metahub } from './Metahub'
import { PublicationVersion } from './PublicationVersion'

/**
 * Access mode for Publication API
 */
export enum PublicationAccessMode {
    /** Full access to all Metahub data via API */
    FULL = 'full',
    /** Restricted access based on access_config rules */
    RESTRICTED = 'restricted'
}

/**
 * Schema synchronization status for publications
 */
export enum PublicationSchemaStatus {
    /** Initial state, schema not yet created */
    DRAFT = 'draft',
    /** Schema creation/update in progress */
    PENDING = 'pending',
    /** Schema is synchronized with Metahub configuration */
    SYNCED = 'synced',
    /** Metahub configuration changed, schema needs update */
    OUTDATED = 'outdated',
    /** Schema sync failed */
    ERROR = 'error'
}

/**
 * Publication entity - external interface of a Metahub with API access control.
 *
 * Publications provide controlled access to Metahub data through generated database schemas.
 * Each Publication belongs to exactly one Metahub and can be linked to multiple Applications
 * via Connectors.
 */
@Entity({ name: 'publications', schema: 'metahubs' })
export class Publication {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ name: 'metahub_id', type: 'uuid' })
    metahubId!: string

    @ManyToOne(() => Metahub, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'metahub_id' })
    metahub!: Metahub

    @Column({ type: 'jsonb', default: {} })
    name!: VersionedLocalizedContent<string>

    @Column({ type: 'jsonb', nullable: true, default: {} })
    description!: VersionedLocalizedContent<string> | null

    @Column({
        name: 'access_mode',
        type: 'enum',
        enum: PublicationAccessMode,
        enumName: 'publication_access_mode',
        default: PublicationAccessMode.FULL
    })
    accessMode!: PublicationAccessMode

    @Column({ name: 'access_config', type: 'jsonb', nullable: true, default: {} })
    accessConfig!: Record<string, unknown> | null

    @Column({ name: 'schema_name', type: 'varchar', length: 100, unique: true, nullable: true })
    schemaName!: string | null

    @Column({
        name: 'schema_status',
        type: 'enum',
        enum: PublicationSchemaStatus,
        enumName: 'publication_schema_status',
        default: PublicationSchemaStatus.DRAFT
    })
    schemaStatus!: PublicationSchemaStatus

    @Column({ name: 'schema_error', type: 'text', nullable: true })
    schemaError!: string | null

    @Column({ name: 'schema_synced_at', type: 'timestamptz', nullable: true })
    schemaSyncedAt!: Date | null

    @Column({ name: 'schema_snapshot', type: 'jsonb', nullable: true })
    schemaSnapshot!: Record<string, unknown> | null

    @Column({ name: 'auto_create_application', type: 'boolean', default: false })
    autoCreateApplication!: boolean

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date

    /** Reference to active version */
    @Column({ name: 'active_version_id', type: 'uuid', nullable: true })
    activeVersionId!: string | null

    @OneToMany(() => PublicationVersion, (version) => version.publication)
    versions!: PublicationVersion[]
}
