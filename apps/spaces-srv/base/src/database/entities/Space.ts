import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm'
import { SpaceCanvas } from './SpaceCanvas'

type UnikReference = { id: string }

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

    @Column({ name: 'unik_id' })
    unikId!: string

    // Foreign key to link with Unik without importing the module to avoid package cycles
    @ManyToOne('Unik', { onDelete: 'CASCADE', nullable: false })
    @JoinColumn({ name: 'unik_id' })
    unik!: UnikReference

    // Relationship with SpaceCanvas
    @OneToMany(() => SpaceCanvas, spaceCanvas => spaceCanvas.space)
    spaceCanvases!: SpaceCanvas[]
}
