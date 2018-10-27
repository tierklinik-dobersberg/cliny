import { Injectable, Logger } from '@jsmon/core';
import { Delete, Get, Post, Put } from '@jsmon/net/http/server';
import { Next, Request, Response } from 'restify';
import { IUser } from './models';
import { UserController } from './user.controller';
import { CLINY_COOKIE, Authenticated, RoleRequired, CLINY_AUTH_CONTEXT, getAuthenticatedUser } from './auth';
import { getContext } from '../utils';

@Injectable()
export class UserAPI {
    constructor(private _log: Logger,
                private _userCtrl: UserController) {
        this._log = this._log.createChild('api:user');
    }
    
    @Get('/')
    @Authenticated()
    async listUsers(req: Request, res: Response, next: Next) {
        try {
            let users = await this._userCtrl.listUsers();

            res.send(200, users);
            next();
        } catch(err) {
            next(err);
        }
    }
    
    @Post('/login')
    async login(req: Request, res: Response, next: Next) {
        try {
            const username = req.body.username;
            const password = req.body.password;

            if (await this._userCtrl.checkUserPassword(username, password)) {
                this._log.info(`User ${username} authenticated successfully`);
                
                const token = await this._userCtrl.generateAuthToken(username);

                res.setCookie(CLINY_COOKIE, token, {httpOnly: true});
                res.send(200);
            } else {
                this._log.info(`Failed to authenticate user ${username}`);

                // Make sure we clean any authentication cookie available
                res.setCookie(CLINY_COOKIE, '', {expires: new Date(1)});
                
                res.send(401, 'Invalid username or password');
            }
            next();
        } catch (err) {
            next(err);
        }
    }
    
    @Post('/:username')
    @RoleRequired('admin')
    async createUser(req: Request, res: Response, next: Next) {
        let user: IUser & {password: string} = req.body;
        
        user.username = req.params.username;

        let err = this._validateUser(user);
        if (!!err) {
            res.send(400, err);
            next(false);
            return;
        }
        
        try {
            await this._userCtrl.createUser(user, user.password);
            res.send(204);
            next();
        } catch(err) {
            next(err);
        }
    }
    
    @Put('/:username')
    @Authenticated()
    async updateUser(req: Request, res: Response, next: Next) {
        // If the authenticated user is not an admin it is only
        // allowed to update it self;
        const authenticated = getAuthenticatedUser(req)!;

        if (authenticated.role !== 'admin' && authenticated.username !== req.params.username) {
            res.send(403, 'Not allowed');
            next(false);
            return;
        }

        let user: IUser = req.body;
        
        user.username = req.params.username;

        try {
            delete (user as any)['password']; // make sure to not change the password
            await this._userCtrl.updateUser(user);
            
            res.send(204);
            next();
        } catch (err) {
            next(err);
        }
    }
    
    @Delete('/:username')
    @RoleRequired('admin')
    async deleteUser(req: Request, res: Response, next: Next) {
        let user = req.params.username

        try {
            await this._userCtrl.deleteUser(user);
            res.send(204);
            next();
        } catch (err) {
            next(err);
        }
    }
    
    private _validateUser(data: IUser): string|null {
        if (!data.username || data.username === '' || typeof data.username !== 'string') {
            return 'Invalid user name';
        }
        
        if (!data.type || (data.type as any) === '' || typeof data.type !== 'string') {
            return 'Invalid user type';
        }
        
        if (!data.role || (data.role as any) === '' || typeof data.role !== 'string') {
            return 'Invalid user role';
        }
        
        if (!data.hoursPerWeek || data.hoursPerWeek < 0 || typeof data.hoursPerWeek !== 'number') {
            return 'Invalid number of hours per week';
        }
        
        // It is allowed to not specify the state for enabled
        if (data.enabled === undefined) {
            data.enabled = true;
        }
        
        if (typeof data.enabled !== 'boolean') {
            return 'Invalid type for enabled';
        }
        
        return null;
    }
}