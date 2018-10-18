import {Entity, PrimaryColumn, OneToMany, JoinColumn} from 'typeorm';
import {TimeFrame} from './time-frame';

@Entity()
export class OpeningHour {
    @PrimaryColumn()
    weekDay: number;
    
    @OneToMany(type => TimeFrame, frame => frame.openingHour, {cascade: true})
    times: TimeFrame[];

    /**
     * Converts a week day name into a number (sunday = 0, saturday = 6)
     * 
     * @param day - The name of the day (e.g sunday)
     */
    static weekDayFromString(day: string) {
        switch (day) {
            case 'sunday':
                return 0;
            case 'monday':
                return 1;
            case 'tuesday':
                return 2;
            case 'wednesday':
                return 3;
            case 'thursday':
                return 4;
            case 'friday':
                return 5;
            case 'saturday':
                return 6;
            default:
                return NaN;
        }
    }
}
