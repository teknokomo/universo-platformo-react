import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import type { VersionedLocalizedContent } from '@universo/types'

/**
 * Locale entity for dynamic language management
 *
 * Supports both localized content fields and UI i18n localization.
 * System locales (en, ru) cannot be deleted.
 */
@Entity({ schema: 'admin', name: 'locales' })
export class Locale {
    @PrimaryGeneratedColumn('uuid')
    id: string

    /** ISO 639-1 locale code (e.g., 'en', 'ru', 'de') */
    @Column({ type: 'varchar', length: 10, unique: true })
    code: string

    /** Localized display name in structured format */
    @Column({ type: 'jsonb', default: {} })
    name: VersionedLocalizedContent<string>

    /** Native name of the language (e.g., 'English', 'Русский') */
    @Column({ type: 'varchar', length: 100, nullable: true, name: 'native_name' })
    nativeName: string | null

    /** Whether this locale is available for localized content fields */
    @Column({ type: 'boolean', default: true, name: 'is_enabled_content' })
    isEnabledContent: boolean

    /** Whether this locale is available for UI translations (informational) */
    @Column({ type: 'boolean', default: false, name: 'is_enabled_ui' })
    isEnabledUi: boolean

    /** Whether this is the default locale for localized content */
    @Column({ type: 'boolean', default: false, name: 'is_default_content' })
    isDefaultContent: boolean

    /** Whether this is the default locale for UI */
    @Column({ type: 'boolean', default: false, name: 'is_default_ui' })
    isDefaultUi: boolean

    /** System locales cannot be deleted */
    @Column({ type: 'boolean', default: false, name: 'is_system' })
    isSystem: boolean

    /** Display order in locale lists */
    @Column({ type: 'integer', default: 0, name: 'sort_order' })
    sortOrder: number

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt: Date

    @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
    updatedAt: Date
}
