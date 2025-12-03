import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Unique } from 'typeorm'
import { Campaign } from './Campaign'

@Entity({ name: 'campaigns_users', schema: 'campaigns' })
@Unique(['campaign_id', 'user_id'])
export class CampaignMember {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column('uuid')
    campaign_id!: string

    @Column('uuid')
    user_id!: string

    @Column({ type: 'varchar', length: 50, default: 'owner' })
    role!: string

    @Column({ type: 'text', nullable: true })
    comment?: string

    @CreateDateColumn()
    created_at!: Date

    @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'campaign_id' })
    campaign!: Campaign
}
