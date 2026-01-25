import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import type { VersionedLocalizedContent } from '@universo/types'

@Entity({ name: 'metahubs_branches', schema: 'metahubs' })
export class MetahubBranch {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'uuid' })
    metahub_id!: string

    @Column({ type: 'uuid', nullable: true })
    source_branch_id?: string | null

    @Column({ type: 'jsonb', default: {} })
    name!: VersionedLocalizedContent<string>

    @Column({ type: 'jsonb', nullable: true })
    description?: VersionedLocalizedContent<string> | null

    @Column({ type: 'varchar', length: 100 })
    codename!: string

    @Column({ type: 'int' })
    branch_number!: number

    @Column({ type: 'varchar', length: 100 })
    schema_name!: string

    @Column({ type: 'uuid', nullable: true })
    created_by?: string | null

    @CreateDateColumn({ name: 'created_at' })
    created_at!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updated_at!: Date
}
