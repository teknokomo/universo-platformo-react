import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

/**
 * Interface for CustomTemplate entity
 */
export interface ICustomTemplate {
    id: string
    name: string
    flowData: string
    description?: string
    badge?: string
    framework?: string
    usecases?: string
    type?: string
    unikId?: string
    createdDate: Date
    updatedDate: Date
}

/**
 * CustomTemplate entity for storing user-created canvas/tool templates
 *
 * This table stores templates that users save from their Canvas or Tools
 * for later reuse. Templates are scoped to a Unik (workspace).
 *
 * NOTE: The unik_id column, FK constraint, and index are added by the
 * AddUniksAndLinked migration from @universo/uniks-backend package.
 * This follows the same pattern as tool, credential, assistant, etc.
 */
@Entity('custom_template')
export class CustomTemplate implements ICustomTemplate {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column()
    name!: string

    @Column({ type: 'text' })
    flowData!: string

    @Column({ nullable: true, type: 'text' })
    description?: string

    @Column({ nullable: true, type: 'text' })
    badge?: string

    @Column({ nullable: true, type: 'text' })
    framework?: string

    @Column({ nullable: true, type: 'text' })
    usecases?: string

    @Column({ nullable: true, type: 'text' })
    type?: string

    /**
     * Foreign key to Unik (workspace)
     * Column is added by AddUniksAndLinked migration
     */
    @Column({ name: 'unik_id', type: 'uuid', nullable: true })
    unikId?: string

    @CreateDateColumn()
    createdDate!: Date

    @UpdateDateColumn()
    updatedDate!: Date
}
