import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

@Entity({ name: 'resource_state' })
export class ResourceState {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ unique: true })
    code!: string

    @Column()
    label!: string
}
