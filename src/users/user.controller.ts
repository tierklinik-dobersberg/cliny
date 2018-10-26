import { Injectable, Logger } from '@jsmon/core';
import { Repository } from 'typeorm';
import { Database } from '../database';
import { IUser, User } from './models';

@Injectable()
export class UserController {
    private _repo: Repository<User>;
    private _ready: Promise<void>;
    private _resolve: () => void;
    
    get ready() {
        return this._ready;
    }

    constructor(private _log: Logger,
                private _database: Database) {
        this._log = this._log.createChild('db:users');
        this._ready = new Promise((resolve) => this._resolve = resolve);
        
        this._database.ready
                    .then(() => this._setup());
    }
    
    private async _setup() {
        this._repo = this._database.getRepository(User);
        
        this._log.info(`User database initialized`);
        this._resolve();
    }
    
    async createUser(user: IUser, password: string) {
        const u = new User();
        u.setHoursPerWeek(user.hoursPerWeek)
         .setIcon(user.icon)
         .setName(user.username)
         .setRole(user.role)
         .setType(user.type)
         .setPassword(password)
         .setColor(user.color)
         .setEnabled(user.enabled);
        
        await this._repo.save(u);
    }
    
    async deleteUser(user: string|IUser) {
        if (typeof user === 'object') {
            user = user.username;
        }
        
        await this._repo.delete(user);
    }

    async updateUser(user: IUser) {
        await this._repo.update(user.username, user);
    }

    async getUser(name: string): Promise<IUser|null> {
        let user = await this._repo.findOne(name)
        
        if (!user) {
            return null;
        }
        
        return {
            username: user.username,
            hoursPerWeek: user.hoursPerWeek,
            icon: user.icon,
            role: user.role,
            type: user.type,
            color: user.color,
            enabled: user.enabled,
            rostaSchedules: user.rostaSchedules || [],
        };
    }
    
    async listUsers(): Promise<IUser[]> {
        let users = await this._repo.find();
        return users.map(user => ({
            username: user.username,
            hoursPerWeek: user.hoursPerWeek,
            icon: user.icon,
            role: user.role,
            type: user.type,
            color: user.color,
            enabled: user.enabled,
            rostaSchedules: user.rostaSchedules || [],
        }));
    }
}

