import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm'

/**
 * AdminSetting entity for platform-wide configuration
 * Stored in admin.settings table
 *
 * Key-value store organized by category.
 * Used for metahub codename defaults, application defaults, etc.
 *
 * Value stored as JSONB with { _value: <actual value> } convention
 * matching the MetahubSettingsService pattern.
 */
@Entity({ name: 'settings', schema: 'admin' })
@Unique(['category', 'key'])
export class AdminSetting {
    @PrimaryGeneratedColumn('uuid')
    id: string

    /** Settings category (e.g., 'metahubs', 'applications') */
    @Column({ type: 'varchar', length: 50 })
    category: string

    /** Setting key within category (e.g., 'codenameStyle', 'codenameAlphabet') */
    @Column({ type: 'varchar', length: 100 })
    key: string

    /** Setting value as JSONB ({ _value: ... }) */
    @Column({ type: 'jsonb', default: {} })
    value: Record<string, unknown>

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt: Date

    @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
    updatedAt: Date
}
