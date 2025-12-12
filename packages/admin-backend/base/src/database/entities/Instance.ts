import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import type { VersionedLocalizedContent } from '@universo/types'

/**
 * Instance entity for platform instances
 * Stored in admin.instances table
 *
 * MVP: Single pre-seeded "Local" instance representing current installation
 * Future: Support for remote instances
 */
@Entity({ name: 'instances', schema: 'admin' })
export class Instance {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'varchar', length: 100, unique: true })
    codename!: string

    @Column({ type: 'jsonb', name: 'name', default: {} })
    name!: VersionedLocalizedContent<string>

    @Column({ type: 'jsonb', nullable: true })
    description?: VersionedLocalizedContent<string>

    @Column({ type: 'varchar', length: 255, nullable: true })
    url?: string

    @Column({ type: 'varchar', length: 20, default: 'active' })
    status!: 'active' | 'inactive' | 'maintenance'

    @Column({ type: 'boolean', name: 'is_local', default: false })
    is_local!: boolean

    @CreateDateColumn({ name: 'created_at' })
    created_at!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updated_at!: Date
}
