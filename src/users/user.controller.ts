import { Injectable, Logger } from '@jsmon/core';
import { Repository } from 'typeorm';
import { Database } from '../database';
import { IUser, User } from './models';
import { compareSync } from 'bcrypt-nodejs';

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
        
        await this._ensureAdminUser();
        
        this._log.info(`User database initialized`);
        this._resolve();
    }
    
    private async _ensureAdminUser() {
        const count = await this._repo.count({role: 'admin'});
        
        if (count === 0) {
            const password = Math.random().toString(36).substring(2, 15);            
            await this.createUser({
                username: 'admin',
                color: '',
                enabled: true,
                hoursPerWeek: 0,
                icon: '',
                role: 'admin',                
                type: 'other'
            }, password);
            
            this._log.info(`Created administration user with name 'admin' and password ${password}`);
        }
    }
    
    /**
     * Creates a new user in the database
     * 
     * @param user - The new user object
     * @param password - The password for the new user
     */
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
    
    /**
     * Deletes a user from the database
     * 
     * @param user - The name of the user or the user object
     */
    async deleteUser(user: string|IUser) {
        if (typeof user === 'object') {
            user = user.username;
        }
        
        await this._repo.delete(user);
    }
    
    /**
     * Checks if a given password is valid for a user
     * 
     * @param username - The name of the user
     * @param password - The plaintext password to validate
     */
    async checkUserPassword(username: string, password: string): Promise<boolean> {
        const user = await this._repo.findOne(username);
        if (!user) {
            throw new Error('Unknown user');
        }
        
        return compareSync(password, user.password)
    }
    
    /**
     * Updates the password of a user
     * 
     * @param username - The username of the user
     * @param newPassword  - The new password for the user
     */
    async updateUserPassword(username: string, newPassword: string) {
        const user = await this._repo.findOne(username);
        if (!user) {
            throw new Error(`Unknown user`);
        }
        
        user.setPassword(newPassword);

        await this._repo.update(username, user);
    }

    /**
     * Updates a user in the database and fails if
     * the user does not exist.
     * 
     * This function will NOT update passwords
     * 
     * @param user - The user to update
     */
    async updateUser(user: IUser) {
        // Make sure we do not update the user password
        delete (user as any)['password'];
        await this._repo.update(user.username, user);
    }

    /**
     * Returns a user object identified by name.
     * Does not return secret information like passwords
     * 
     * @param name - The name of the user to return
     */
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
    
    /**
     * Returns a list of all users stored in the database.
     * Does not return secret information like passwords
     */
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

