import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { RosterSchedule } from './schedule';

@Entity()
export class RosterScheduleType {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    type: string;
    
    @Column('varchar', {nullable: true})
    color: string;

    setType(name: string): this {
        this.type = name;
        return this;
    }
    
    setColor(color: string): this {
        this.color = color;
        return this;
    }
    
    setID(id: number): this {
        this.id = id;
        return this;
    }
}