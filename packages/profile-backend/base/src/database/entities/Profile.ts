import 'reflect-metadata'
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'
import type { UserSettingsData } from '../../types'

@Entity({ name: 'profiles' })
export class Profile {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column('uuid', { unique: true })
    @Index('idx_profiles_user_id')
    user_id!: string // Foreign key to auth.users in Supabase

    @Column({ type: 'varchar', length: 50, nullable: false, unique: true })
    @Index('idx_profiles_nickname', { unique: true })
    nickname!: string

    @Column({ type: 'varchar', length: 100, nullable: true })
    first_name?: string

    @Column({ type: 'varchar', length: 100, nullable: true })
    last_name?: string

    @Column({ type: 'jsonb', nullable: false, default: () => "'{}'" })
    settings!: UserSettingsData

    @Index('idx_profiles_onboarding_completed')
    @Column({ type: 'boolean', default: false })
    onboarding_completed!: boolean

    // Consent tracking fields - added for Terms of Service and Privacy Policy acceptance
    @Index('idx_profiles_terms_accepted')
    @Column({ type: 'boolean', default: false })
    terms_accepted!: boolean

    @Column({ type: 'timestamptz', nullable: true })
    terms_accepted_at?: Date

    @Index('idx_profiles_privacy_accepted')
    @Column({ type: 'boolean', default: false })
    privacy_accepted!: boolean

    @Column({ type: 'timestamptz', nullable: true })
    privacy_accepted_at?: Date

    @CreateDateColumn()
    created_at!: Date

    @UpdateDateColumn()
    updated_at!: Date
}
