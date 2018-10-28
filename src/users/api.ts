import { Injectable, Logger } from '@jsmon/core';
import { Delete, Get, Post, Put } from '@jsmon/net/http/server';
import { Next, Request, Response } from 'restify';
import { BadRequestError, ForbiddenError, NotAuthorizedError, InternalServerError } from 'restify-errors';
import { Authenticated, CLINY_COOKIE, getAuthenticatedUser, RoleRequired } from './auth';
import { IUser } from './models';
import { UserController } from './user.controller';

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
                
                const user = await this._userCtrl.getUser(username);
                
                // check if the user is allowed to login
                if (!user!.enabled) {
                    res.setCookie(CLINY_COOKIE, '', {expires: new Date(1), httpOnly: true, path: '/'});
                    next(new NotAuthorizedError());
                    return;
                }
                
                const token = await this._userCtrl.generateTokenForUser(username);

                res.setCookie(CLINY_COOKIE, token, {httpOnly: true, path: '/'});
                res.send(200, user);
            } else {
                this._log.info(`Failed to authenticate user ${username}`);

                // Make sure we clean any authentication cookie available
                res.setCookie(CLINY_COOKIE, '', {expires: new Date(1), httpOnly: true, path: '/'});
                
                next(new NotAuthorizedError('Invalid username or password'));
                return;
            }
            next();
        } catch (err) {
            next(err);
        }
    }

    @Get('/login')
    @Authenticated()
    async getCurrentUser(req: Request, res: Response, next: Next) {
        try {
            const authenticatedUser = getAuthenticatedUser(req);
            if (!authenticatedUser) {
                // This shouldn't happen because if the request is not authenticated
                // the middleware would already fail the request
                next( new InternalServerError() );
                return;
            }
            
            res.send(200, authenticatedUser);
        } catch (err) {
            next(err);
        }
    }
    
    @Get('/:username')
    @RoleRequired('admin')
    async getUser(req: Request, res: Response, next: Next) {
        try {
            let user = await this._userCtrl.getUser(req.params.username);
            res.send(200, user);
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
            next( new BadRequestError() );
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
            next( new ForbiddenError() );
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
