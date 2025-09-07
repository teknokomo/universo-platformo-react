import { Entity, Column, CreateDateColumn, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm'
import { Space } from './Space'
import { Canvas } from './Canvas'

@Entity('spaces_canvases')
export class SpaceCanvas {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    // DB column is sort_order (snake_case)
    @Column({ name: 'sort_order' })
    sortOrder!: number

    @CreateDateColumn({ name: 'created_date' })
    createdDate!: Date

    // Foreign key to Space
    @ManyToOne(() => Space, space => space.spaceCanvases, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'space_id' })
    space!: Space

    // Foreign key to Canvas
    @ManyToOne(() => Canvas, canvas => canvas.spaceCanvases, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'canvas_id' })
    canvas!: Canvas
}
