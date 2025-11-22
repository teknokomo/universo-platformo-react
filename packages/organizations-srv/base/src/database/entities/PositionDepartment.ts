import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Unique } from 'typeorm'
import { Position } from './Position'
import { Department } from './Department'

// Comments in English only
@Entity({ name: 'positions_departments', schema: 'organizations' })
@Unique(['position', 'department'])
export class PositionDepartment {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => Position, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'position_id' })
    position!: Position

    @ManyToOne(() => Department, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'department_id' })
    department!: Department

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
