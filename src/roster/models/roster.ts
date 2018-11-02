import {Entity, PrimaryGeneratedColumn, Column, OneToMany, JoinTable} from 'typeorm';
import { RosterSchedule } from './schedule';
import moment from 'moment';

export interface IRoster {
    id: number;
    schedules: RosterSchedule[]
    
    calendarWeek: string;
    
    startDate: number;
    
    endDate: number;
}

@Entity()
export class Roster implements IRoster {
    @PrimaryGeneratedColumn()
    id: number;

    @OneToMany(() => RosterSchedule, schedule => schedule.roster)
    @JoinTable()
    schedules: RosterSchedule[];
    
    @Column()
    startDate: number;

    @Column()
    endDate: number;
    
    @Column()
    calendarWeek: string;
    

    setSchedules(schedules: RosterSchedule[]): this {
        this.schedules = schedules;
        return this;
    }
    
    setStartDate(d: number|Date|moment.Moment): this {
        let m = moment(d);
        this.startDate = m.valueOf();
        return this;
    }
    
    setEndDate(d: number|Date|moment.Moment): this {
        let m = moment(d);
        this.endDate = m.valueOf();
        return this;
    }
    
    setCalendarWeek(week: string): this {
        this.calendarWeek = week;
        return this;
    }
}