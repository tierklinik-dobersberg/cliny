import { Injectable, Logger } from '@jsmon/core';
import { Repository } from 'typeorm';
import { Database } from '../database';
import { IUser, User } from './models';
import { compareSync } from 'bcrypt-nodejs';
import { AuthToken } from './models/token';
import { NotFoundError } from 'restify-errors';

@Injectable()
export class UserController {
    private _userRepo: Repository<User>;
    private _tokenRepo: Repository<AuthToken>;
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
    
    /**
     * @internal
     * Prepares the user database
     */
    private async _setup() {
        this._log.debug(`initializing user database`);
        
        try {
            this._userRepo = this._database.getRepository(User);
            this._tokenRepo = this._database.getRepository(AuthToken);
            
            await this._ensureAdminUser();
            
            this._log.info(`User database initialized`);
            this._resolve();
        } catch (err) {
            this._log.error(`Failed to setup user database: ${err}`);
        }
    }
    
    /**
     * @internal
     * Creates a new admin user with a random password if
     * there's not at least one administrator available
     */
    private async _ensureAdminUser() {
        this._log.debug(`Checking for administration user ...`);

        const count = await this._userRepo.count({role: 'admin'});
        
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
        
        await this._userRepo.save(u);
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
        
        await this._userRepo.delete(user);
    }
    
    /**
     * Checks if a given password is valid for a user
     * 
     * @param username - The name of the user
     * @param password - The plaintext password to validate
     */
    async checkUserPassword(username: string, password: string): Promise<boolean> {
        const user = await this._userRepo.findOne(username);
        if (!user) {
            // Do not throw NotFoundError here because this would allow
            // username enumeration and assist in attacks
            return false;
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
        const user = await this._userRepo.findOne(username);
        if (!user) {
            throw new NotFoundError(`User ${username} not found`);
        }
        
        user.setPassword(newPassword);

        await this._userRepo.update(username, user);
    }

    /**
     * Generates a new authentication token for a user
     * 
     * @param username - The name of the user
     */
    async generateTokenForUser(username: string): Promise<string> {
        const token = Math.random().toString(36).substring(2, 15) +
                      Math.random().toString(36).substring(2, 15) +
                      Math.random().toString(36).substring(2, 15);
                      
        let authToken = new AuthToken()
            .setUser({username: username})
            .setValue(token);
            
        await this._tokenRepo.save(authToken);

        return token;
    }
    
    /**
     * Returns the user object for a given authentication token
     * 
     * @param token - The authentication token value
     */
    async getUserForToken(token: string): Promise<IUser|null> {
        const authToken = await this._tokenRepo.findOne({tokenValue: token}, {relations: ['user']});

        if (!authToken) {
            return null;
        }
        
        delete authToken.user.password;

        return {
            ...(authToken.user as IUser),
        };
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
        await this._userRepo.update(user.username, user);
    }

    /**
     * Returns a user object identified by name.
     * Does not return secret information like passwords
     * 
     * @param name - The name of the user to return
     */
    async getUser(name: string): Promise<IUser|null> {
        let user = await this._userRepo.findOne(name)
        
        if (!user) {
            throw new NotFoundError(`User ${name} not found`);
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
        let users = await this._userRepo.find();
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

