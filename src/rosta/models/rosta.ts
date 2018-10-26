import {Entity, PrimaryGeneratedColumn, Column, OneToMany, JoinTable} from 'typeorm';
import { RostaSchedule } from './schedule';
import moment from 'moment';

export interface IRosta {
    id: number;
    schedules: RostaSchedule[]
    
    calendarWeek: string;
    
    startDate: number;
    
    endDate: number;
}

@Entity()
export class Rosta implements IRosta {
    @PrimaryGeneratedColumn()
    id: number;

    @OneToMany(() => RostaSchedule, schedule => schedule.rosta)
    @JoinTable()
    schedules: RostaSchedule[];
    
    @Column()
    startDate: number;

    @Column()
    endDate: number;
    
    @Column()
    calendarWeek: string;
    

    setSchedules(schedules: RostaSchedule[]): this {
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