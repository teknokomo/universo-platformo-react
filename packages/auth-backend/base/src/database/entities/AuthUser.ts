import { Column, Entity, PrimaryColumn } from 'typeorm'

/**
 * Read-only entity for auth.users table (Supabase managed)
 * Used to fetch user info for member lists and status calculations
 *
 * IMPORTANT: This is a read-only view of Supabase auth.users table.
 * DO NOT use @ManyToOne relations - use separate queries instead.
 * DO NOT attempt to write to this entity.
 */
@Entity({ name: 'users', schema: 'auth' })
export class AuthUser {
    @PrimaryColumn('uuid')
    id!: string

    @Column({ type: 'text', nullable: true })
    email!: string | null

    @Column({ type: 'jsonb', nullable: true })
    raw_user_meta_data!: Record<string, unknown> | null

    @Column({ type: 'timestamptz', nullable: true })
    confirmed_at!: Date | null

    @Column({ type: 'timestamptz', nullable: true })
    last_sign_in_at!: Date | null

    @Column({ type: 'timestamptz', nullable: true })
    banned_until!: Date | null

    /**
     * Get user's full name from metadata
     */
    get fullName(): string | null {
        if (!this.raw_user_meta_data) return null
        return (this.raw_user_meta_data['full_name'] as string) || null
    }

    /**
     * Calculate user status based on auth fields
     * - banned: banned_until is set and in future
     * - pending: email not confirmed
     * - active: signed in within last 30 days
     * - inactive: no recent sign-in
     */
    get status(): 'active' | 'inactive' | 'pending' | 'banned' {
        const now = new Date()

        if (this.banned_until && this.banned_until > now) {
            return 'banned'
        }
        if (!this.confirmed_at) {
            return 'pending'
        }
        if (this.last_sign_in_at) {
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            if (this.last_sign_in_at > thirtyDaysAgo) {
                return 'active'
            }
        }
        return 'inactive'
    }
}
