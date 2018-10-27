import {Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn} from 'typeorm';
import {OpeningHour} from './opening-hours';

@Entity()
export class TimeFrame {
    @PrimaryGeneratedColumn()
    public id: number;
    
    /**
     * Number of minutes from the beginning of the day
     */
    @Column()
    public start: number;

    /**
     * Number of minutes from the beginning of the day
     */
    @Column()
    public end: number;
    
    @ManyToOne(type => OpeningHour, hour => hour.times)
    openingHour: OpeningHour;

    setStart(n: number): this {
        this.start = n;
        return this;
    }
    
    setEnd(e: number): this {
        this.end = e;
        return this;
    }
    
    setOpeningHour(h: OpeningHour): this {
        this.openingHour = h;
        return this;
    }
}

export interface ITimeFrame {
    start: number;
    end: number;
}