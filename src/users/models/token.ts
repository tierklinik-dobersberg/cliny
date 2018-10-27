import {Entity, PrimaryGeneratedColumn, ManyToOne, Column} from 'typeorm';
import { User, IUser } from './user';


@Entity()
export class AuthToken {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    tokenValue: string;

    @ManyToOne(() => User, user => user.tokens)
    user: User;


    setValue(value: string): this {
        this.tokenValue = value;
        return this;
    }
    
    setUser(user: Partial<IUser>): this {
        this.user = user as User;
        return this;
    }
}