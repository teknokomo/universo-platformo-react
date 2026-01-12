import { Entity as ORMEntity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import type { VersionedLocalizedContent } from '@universo/types'
import { Catalog } from './Catalog'

/**
 * Supported data types for dynamic fields
 */
export enum AttributeDataType {
    STRING = 'STRING',
    NUMBER = 'NUMBER',
    BOOLEAN = 'BOOLEAN',
    DATE = 'DATE',
    DATETIME = 'DATETIME',
    REF = 'REF',
    JSON = 'JSON'
}

/**
 * Validation rules stored as JSONB
 */
export interface AttributeValidation {
    required?: boolean
    minLength?: number
    maxLength?: number
    min?: number
    max?: number
    pattern?: string
    options?: string[]
}

/**
 * UI configuration stored as JSONB
 */
export interface AttributeUIConfig {
    widget?: 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'date' | 'datetime' | 'reference'
    placeholder?: Record<string, string>
    helpText?: Record<string, string>
    hidden?: boolean
    width?: number
}

/**
 * Attribute entity - represents a virtual field within a Catalog
 *
 * Analogous to a "Requisite" in 1C:Enterprise.
 * Defines the schema for data stored in Records.
 */
@ORMEntity({ name: 'attributes', schema: 'metahubs' })
export class Attribute {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'uuid', name: 'catalog_id' })
    catalogId!: string

    @ManyToOne(() => Catalog, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'catalog_id' })
    catalog!: Catalog

    /** Localized name */
    @Column({ type: 'jsonb', default: {} })
    name!: VersionedLocalizedContent<string>

    /** System identifier for data storage key */
    @Column({ type: 'varchar', length: 100 })
    codename!: string

    /** Data type for validation and UI rendering */
    @Column({ type: 'varchar', length: 20, name: 'data_type' })
    dataType!: AttributeDataType

    /** For REF type: target catalog UUID */
    @Column({ type: 'uuid', nullable: true, name: 'target_catalog_id' })
    targetCatalogId?: string

    @ManyToOne(() => Catalog, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'target_catalog_id' })
    targetCatalog?: Catalog

    /** Validation rules */
    @Column({ type: 'jsonb', default: {}, name: 'validation_rules' })
    validationRules!: AttributeValidation

    /** UI configuration */
    @Column({ type: 'jsonb', default: {}, name: 'ui_config' })
    uiConfig!: AttributeUIConfig

    @Column({ type: 'boolean', default: false, name: 'is_required' })
    isRequired!: boolean

    @Column({ type: 'integer', default: 0, name: 'sort_order' })
    sortOrder!: number

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date
}
