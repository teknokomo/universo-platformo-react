import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'

@Entity({ name: 'profiles' })
export class Profile {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column('uuid', { unique: true })
    @Index('idx_profiles_user_id')
    user_id!: string // Foreign key to auth.users in Supabase

    @Column({ type: 'varchar', length: 50, nullable: true })
    nickname?: string

    @Column({ type: 'varchar', length: 100, nullable: true })
    first_name?: string

    @Column({ type: 'varchar', length: 100, nullable: true })
    last_name?: string

    @CreateDateColumn()
    created_at!: Date

    @UpdateDateColumn()
    updated_at!: Date
}
