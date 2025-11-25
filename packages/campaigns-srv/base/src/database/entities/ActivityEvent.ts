import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Unique } from 'typeorm'
import { Activity } from './Activity'
import { Event } from './Event'

// Comments in English only
@Entity({ name: 'activities_events', schema: 'campaigns' })
@Unique(['activity', 'event'])
export class ActivityEvent {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => Activity, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'activity_id' })
    activity!: Activity

    @ManyToOne(() => Event, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'event_id' })
    event!: Event

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
