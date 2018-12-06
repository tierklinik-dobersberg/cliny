import { hashSync } from 'bcrypt-nodejs';
import { Column, Entity, ManyToMany, OneToMany, PrimaryColumn } from 'typeorm';
import { RosterSchedule } from '../../roster/models/schedule';
import { AuthToken } from './token';

export type UserType = 'assistent' | 'doctor' | 'other';
export type Role = 'admin' | 'user';

export interface IUser {
    username: string;
    role: Role;
    type: UserType;
    hoursPerWeek: number;
    enabled: boolean;
    icon: string|null;
    color: string;
    rosterSchedules?: RosterSchedule[];
    firstname?: string | null;
    lastname?: string | null;
    phoneNumber?: string | null;
    mailAddress?: string | null;
    mustChangePassword?: boolean;
    googleCalendarID?: string | null;
}

@Entity()
export class User implements IUser {
    @PrimaryColumn()
    username: string;

    @Column('varchar')
    role: Role;

    @Column('varchar')
    type: UserType;

    @Column('varchar', {nullable: true})
    firstname: string | null;

    @Column('varchar', {nullable: true})
    lastname: string | null;

    @Column('varchar', {nullable: true})
    mailAddress: string | null;

    @Column('varchar', {nullable: true})
    phoneNumber: string | null;
    
    @Column()
    password: string;
    
    @Column()
    hoursPerWeek: number;
    
    @Column()
    enabled: boolean;
    
    @Column({nullable: true})
    color: string;
    
    @Column({type: 'text', nullable: true, default: null})
    icon: string|null;
    
    @Column({type: 'text', nullable: true})
    googleCalendarID: string|null;
    
    @ManyToMany(() => RosterSchedule, schedule => schedule.users)
    rosterSchedules: RosterSchedule[];
    
    @OneToMany(() => AuthToken, token => token.user, {cascade: true})
    tokens: AuthToken[];
    
    @Column({nullable: true})
    mustChangePassword: boolean;
    
    setMustChangePassword(v: boolean): this {
        this.mustChangePassword = v;
        return this;
    }
    
    setGoogleCalendarID(id: string|null): this {
        this.googleCalendarID = id;
        return this;
    }
    
    setColor(color: string): this {
        this.color = color;
        return this;
    }

    setName(name: string): this {
        this.username = name;
        return this;
    }
    
    setRole(role: Role): this {
        this.role = role;
        return this;
    }
    
    setHoursPerWeek(hours: number): this {
        this.hoursPerWeek = hours;
        return this;
    }
    
    setIcon(data: string|null): this {
        this.icon = data;
        return this;
    }
    
    setPassword(password: string): this {
        this.password = hashSync(password);
        return this;
    }
    
    setType(type: UserType): this {
        this.type = type;
        return this;
    }

    setEnabled(enabled: boolean): this {
        this.enabled = enabled;
        return this;
    }

    setRosterSchedules(schedules: RosterSchedule[]): this {
        this.rosterSchedules = schedules;
        return this;
    }
    
    setFirstName(name?: string | null): this {
        this.firstname = name || null;
        return this;
    }
    
    setLastName(name?: string | null): this {
        this.lastname = name || null;
        return this;
    }
    
    setPhoneNumber(number?: string | null): this {
        this.phoneNumber = number || null;
        return this;
    }
    
    setMailAddress(mail?: string | null): this {
        this.mailAddress = mail || null;
        return this;
    }
}