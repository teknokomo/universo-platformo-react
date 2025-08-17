import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

@Entity({ name: 'metaverses' }) // Uses public schema by default
export class Metaverse {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column()
    name!: string

    @Column({ nullable: true })
    description?: string

    @Column({ default: 'private' })
    visibility!: string

    @CreateDateColumn()
    created_at!: Date

    @Column('uuid')
    created_by_user_id!: string
}
