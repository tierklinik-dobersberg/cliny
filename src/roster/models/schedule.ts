import {Column, PrimaryGeneratedColumn, ManyToOne, ManyToMany, Entity, JoinTable, OneToMany, OneToOne, JoinColumn} from 'typeorm';
import { Roster, IRoster } from './roster';
import { User, IUser } from '../../users';
import { RosterScheduleType } from './roster-types';

export interface IRosterSchedule {
    id: number;
    start: number;
    end: number;
    color: string | null;
    roster: IRoster;
    users: IUser[];
}

@Entity()
export class RosterSchedule implements IRosterSchedule {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    start: number;

    @Column()
    end: number
    
    @Column()
    weekDay: number;
    
    @Column('varchar', {nullable: true})
    color: string | null;

    @ManyToOne(() => Roster, roster => roster.schedules)
    roster: Roster;
    
    @ManyToMany(() => User, user => user.rosterSchedules)
    @JoinTable()
    users: User[];
    
    @ManyToOne(() => RosterScheduleType)
    type: RosterScheduleType
    
    setID(id?: number): this {
        if (id !== undefined) {
            this.id = id;
        }
        return this;
    }

    setRoster(roster: Roster): this {
        this.roster = roster;
        return this;
    }
    
    setType(type: number|RosterScheduleType) {
        if (typeof type === 'object') {
            this.type = type;
        } else {
            this.type = {id: type} as any;
        }
        
        return this;
    }
    
    setWeekDay(day: number): this {
        this.weekDay = day;
        return this;
    }
    
    setStart(start: number): this {
        this.start = start;
        return this;
    }
    
    setEnd(end: number): this {
        this.end = end;
        return this;
    }
    
    setColor(color?: string): this {
        this.color = color || null;
        return this;
    }
    
    setUsers(users: User[]): this {
        this.users = users;
        return this;
    }
}
