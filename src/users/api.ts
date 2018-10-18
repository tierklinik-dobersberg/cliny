import {Injectable, Logger} from '@jsmon/core';
import {UserController} from './user.controller';
import {Get, Post, Put, Delete} from '@jsmon/net/http/server';
import {Request, Response, Next} from 'restify'
import { IUser } from './models';

@Injectable()
export class UserAPI {
    constructor(private _log: Logger,
                private _userCtrl: UserController) {
        this._log = this._log.createChild('api:user');
    }
    
    @Get('/')
    async listUsers(req: Request, res: Response, next: Next) {
        try {
            let users = await this._userCtrl.listUsers();

            res.send(200, users);
            next();
        } catch(err) {
            next(err);
        }
    }
    
    @Post('/:username')
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
    async updateUser(req: Request, res: Response, next: Next) {
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