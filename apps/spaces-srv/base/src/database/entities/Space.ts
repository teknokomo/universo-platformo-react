import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm'
import { Unik } from '@universo/uniks-srv'
import { SpaceCanvas } from './SpaceCanvas'

@Entity('spaces')
export class Space {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column()
    name!: string

    @Column({ type: 'text', nullable: true })
    description?: string

    @Column({ default: 'private' })
    visibility!: string

    // Align with DB column created_date (snake_case)
    @CreateDateColumn({ name: 'created_date' })
    createdDate!: Date

    // Align with DB column updated_date (snake_case)
    @UpdateDateColumn({ name: 'updated_date' })
    updatedDate!: Date

    // Foreign key to link with Unik
    @ManyToOne(() => Unik, { onDelete: 'CASCADE', nullable: false })
    @JoinColumn({ name: 'unik_id' })
    unik!: Unik

    // Relationship with SpaceCanvas
    @OneToMany(() => SpaceCanvas, spaceCanvas => spaceCanvas.space)
    spaceCanvases!: SpaceCanvas[]
}
