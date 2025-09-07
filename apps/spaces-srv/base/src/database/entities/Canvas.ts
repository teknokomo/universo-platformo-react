import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, OneToMany } from 'typeorm'
import { SpaceCanvas } from './SpaceCanvas'

export type ChatflowType = 'CHATFLOW' | 'MULTIAGENT' | 'ASSISTANT'

@Entity('canvases')
export class Canvas {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ default: 'Canvas 1' })
    name!: string

    @Column({ type: 'text' })
    flowData!: string

    @Column({ nullable: true })
    deployed?: boolean

    @Column({ nullable: true })
    isPublic?: boolean

    @Column({ nullable: true })
    apikeyid?: string

    @Column({ nullable: true, type: 'text' })
    chatbotConfig?: string

    @Column({ nullable: true, type: 'text' })
    apiConfig?: string

    @Column({ nullable: true, type: 'text' })
    analytic?: string

    @Column({ nullable: true, type: 'text' })
    speechToText?: string

    @Column({ nullable: true, type: 'text' })
    followUpPrompts?: string

    @Column({ nullable: true, type: 'text' })
    category?: string

    @Column({ nullable: true, type: 'text' })
    type?: ChatflowType

    // Align with DB column created_date (snake_case)
    @CreateDateColumn({ name: 'created_date' })
    createdDate!: Date

    // Align with DB column updated_date (snake_case)
    @UpdateDateColumn({ name: 'updated_date' })
    updatedDate!: Date

    // Relationship with SpaceCanvas
    @OneToMany(() => SpaceCanvas, spaceCanvas => spaceCanvas.canvas)
    spaceCanvases!: SpaceCanvas[]
}
