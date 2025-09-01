import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

@Entity({ name: 'storage_type' })
export class StorageType {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ unique: true })
    code!: string

    @Column()
    label!: string
}
