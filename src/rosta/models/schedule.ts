import {Column, PrimaryGeneratedColumn, ManyToOne, ManyToMany, Entity, JoinTable, OneToMany, OneToOne, JoinColumn} from 'typeorm';
import { Rosta, IRosta } from './rosta';
import { User, IUser } from '../../users';
import { RostaScheduleType } from './rosta-types';

export interface IRostaSchedule {
    id: number;
    start: number;
    end: number;
    color: string | null;
    rosta: IRosta;
    users: IUser[];
}

@Entity()
export class RostaSchedule implements IRostaSchedule {
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

    @ManyToOne(() => Rosta, rosta => rosta.schedules)
    //@JoinColumn()
    rosta: Rosta;
    
    @ManyToMany(() => User, user => user.rostaSchedules)
    @JoinTable()
    users: User[];
    
    @OneToOne(() => RostaScheduleType)
    @JoinColumn()
    type: RostaScheduleType
    
    setID(id?: number): this {
        if (id !== undefined) {
            this.id = id;
        }
        return this;
    }

    setRosta(rosta: Rosta): this {
        this.rosta = rosta;
        return this;
    }
    
    setType(type: number|RostaScheduleType) {
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
