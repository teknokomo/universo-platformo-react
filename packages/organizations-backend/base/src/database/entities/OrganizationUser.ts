import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Unique } from 'typeorm'
import { Organization } from './Organization'

@Entity({ name: 'organizations_users', schema: 'organizations' })
@Unique(['organization', 'user_id'])
export class OrganizationUser {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column('uuid')
    organization_id!: string

    @Column('uuid')
    user_id!: string

    @Column({ type: 'varchar', length: 50, default: 'owner' })
    role!: string

    @Column({ type: 'text', nullable: true })
    comment?: string

    @CreateDateColumn({ name: 'created_at' })
    created_at!: Date

    @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organization_id' })
    organization!: Organization
}
