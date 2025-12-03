import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Column, Unique } from 'typeorm'
import { Activity } from './Activity'
import { Campaign } from './Campaign'

// Comments in English only
@Entity({ name: 'activities_campaigns', schema: 'campaigns' })
@Unique(['activity', 'campaign'])
export class ActivityCampaign {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => Activity, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'activity_id' })
    activity!: Activity

    @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'campaign_id' })
    campaign!: Campaign

    @Column({ name: 'sort_order', default: 1 })
    sortOrder!: number

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
