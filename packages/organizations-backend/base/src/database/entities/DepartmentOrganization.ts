import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Unique } from 'typeorm'
import { Department } from './Department'
import { Organization } from './Organization'

// Comments in English only
@Entity({ name: 'departments_organizations', schema: 'organizations' })
@Unique(['department', 'organization'])
export class DepartmentOrganization {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => Department, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'department_id' })
    department!: Department

    @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organization_id' })
    organization!: Organization

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
