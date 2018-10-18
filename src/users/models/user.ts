import {Entity, PrimaryColumn, Column} from 'typeorm';
import {hashSync} from 'bcrypt-nodejs';

export type UserType = 'assistent' | 'doctor' | 'other';
export type Role = 'admin' | 'user';

export interface IUser {
    username: string;
    role: Role;
    type: UserType;
    hoursPerWeek: number;
    enabled: boolean;
    icon: string|null;
}

@Entity()
export class User implements IUser {
    @PrimaryColumn()
    username: string;

    @Column('varchar')
    role: Role;

    @Column('varchar')
    type: UserType;
    
    @Column()
    password: string;
    
    @Column()
    hoursPerWeek: number;
    
    @Column()
    enabled: boolean;
    
    @Column({type: 'text', nullable: true, default: null})
    icon: string|null;

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
}