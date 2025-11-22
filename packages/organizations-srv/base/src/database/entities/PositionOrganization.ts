import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Column, Unique } from 'typeorm'
import { Position } from './Position'
import { Organization } from './Organization'

// Comments in English only
@Entity({ name: 'positions_organizations', schema: 'organizations' })
@Unique(['position', 'organization'])
export class PositionOrganization {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => Position, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'position_id' })
    position!: Position

    @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organization_id' })
    organization!: Organization

    @Column({ name: 'sort_order', default: 1 })
    sortOrder!: number

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
