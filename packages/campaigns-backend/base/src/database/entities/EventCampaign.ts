import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Unique } from 'typeorm'
import { Event } from './Event'
import { Campaign } from './Campaign'

// Comments in English only
@Entity({ name: 'events_campaigns', schema: 'campaigns' })
@Unique(['event', 'campaign'])
export class EventCampaign {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => Event, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'event_id' })
    event!: Event

    @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'campaign_id' })
    campaign!: Campaign

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
