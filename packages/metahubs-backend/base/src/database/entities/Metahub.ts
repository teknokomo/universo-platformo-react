import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import type { VersionedLocalizedContent } from '@universo/types'

/**
 * Metahub entity - represents a configuration/module in the metadata-driven platform
 *
 * Analogous to a "Configuration" in 1C:Enterprise - contains Hubs (virtual tables)
 * and their Attributes (virtual fields) definitions.
 */
@Entity({ name: 'metahubs', schema: 'metahubs' })
export class Metahub {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    /** Localized name using VLC pattern */
    @Column({ type: 'jsonb', default: {} })
    name!: VersionedLocalizedContent<string>

    /** Localized description */
    @Column({ type: 'jsonb', nullable: true })
    description?: VersionedLocalizedContent<string>

    /** Unique codename for internal references (e.g., "crm-core") */
    @Column({ type: 'varchar', length: 100, unique: true })
    codename!: string

    /** URL-friendly identifier for public access (e.g., "ideas", "products") */
    @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
    slug?: string

    /** Default branch for this metahub */
    @Column({ name: 'default_branch_id', type: 'uuid', nullable: true })
    defaultBranchId!: string | null

    /** Monotonic counter for branch numbers (used in schema names) */
    @Column({ name: 'last_branch_number', type: 'int', default: 0 })
    lastBranchNumber!: number

    /** Whether this metahub is publicly accessible via API */
    @Column({ type: 'boolean', default: false, name: 'is_public' })
    isPublic!: boolean

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date
}
