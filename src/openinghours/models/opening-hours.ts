import {Entity, PrimaryColumn, OneToMany, JoinColumn} from 'typeorm';
import {TimeFrame} from './time-frame';

@Entity()
export class OpeningHour {
    @PrimaryColumn()
    weekDay: number;
    
    @OneToMany(type => TimeFrame, frame => frame.openingHour, {cascade: true})
    times: TimeFrame[];
}
