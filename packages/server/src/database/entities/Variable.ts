/* eslint-disable */
import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm'
import { IVariable } from '../../Interface'
import { Unik } from '@universo/uniks-srv'

@Entity('variable')
export class Variable implements IVariable {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column()
    name: string

    @Column({ nullable: true, type: 'text' })
    value: string

    @Column({ default: 'string', type: 'text' })
    type: string

    @Column({ type: 'timestamp' })
    @CreateDateColumn()
    createdDate: Date

    @Column({ type: 'timestamp' })
    @UpdateDateColumn()
    updatedDate: Date

    // New foreign key to link with Unik
    @ManyToOne(() => Unik, { onDelete: 'CASCADE', nullable: false })
    @JoinColumn({ name: 'unik_id' })
    unik: Unik
}
