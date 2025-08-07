import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

@Entity({ name: 'uniks' })
export class Unik {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column()
    name!: string

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at!: Date
}
