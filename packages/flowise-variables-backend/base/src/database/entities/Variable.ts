import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm'
import { Unik } from '@universo/uniks-backend'

/**
 * Variable entity for storing configurable variables in Universo Platformo
 * Variables can be used in Custom Tool, Custom Function, Custom Loader, If Else Function
 * and in Text Field parameter of any node.
 * 
 * Migrated from packages/flowise-core-backend/base/src/database/entities/Variable.ts
 */
@Entity('variable')
export class Variable {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column()
    name!: string

    @Column({ nullable: true, type: 'text' })
    value!: string

    @Column({ default: 'static', type: 'text' })
    type!: string

    @Column({ type: 'timestamp' })
    @CreateDateColumn()
    createdDate!: Date

    @Column({ type: 'timestamp' })
    @UpdateDateColumn()
    updatedDate!: Date

    @ManyToOne(() => Unik, { onDelete: 'CASCADE', nullable: false })
    @JoinColumn({ name: 'unik_id' })
    unik!: Unik
}
