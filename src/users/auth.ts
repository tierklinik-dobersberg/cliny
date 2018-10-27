import { Injectable } from '@jsmon/core';
import { Middleware, Use } from '@jsmon/net/http/server';
import { Next, Request, Response } from 'restify';
import { Role, IUser } from './models';
import { UserController } from './user.controller';
import { getContext } from '../utils';

export const CLINY_COOKIE = 'cliny';
export const CLINY_AUTH_CONTEXT = 'cliny-user';

export function getAuthenticatedUser(req: Request): IUser|null {
    const user = getContext(req).get<IUser>(CLINY_AUTH_CONTEXT);

    if (!user) {
        return null;
    }
    
    return user;
}

export interface AuthOptions {
    roles?: Role[];
}

@Injectable()
export class AuthenticationMiddleware implements Middleware<AuthOptions> {
    constructor(private _userController: UserController) {}
    
    async handle(options: AuthOptions|undefined, req: Request, res: Response, next: Next) {
        try {
            let authTokenValue = req.cookies[CLINY_COOKIE];
            
            if (!authTokenValue) {
                // check if there's an Authorization header
                const header = req.header('authorization');
                if (!!header) {
                    const [type, ...rest] = header.trim().split(' ');

                    if (type.toLowerCase() === 'bearer') {
                        authTokenValue = rest.join(' ');
                    }
                }
            }
            
            let user = await this._userController.getUserForToken(authTokenValue || '');
            if (!user) {
                res.send(401, 'Authorization required');
                next(false);
                return;
            }
            
            if (!!options && !!options.roles) {
                if (!options.roles.includes(user.role)) {
                    res.send(403, 'Not allowed');
                    next(false);
                    return;
                }
            } 
            
            getContext(req)
                .set(CLINY_AUTH_CONTEXT, user);
            
            next();
        } catch (err) {
            next(err);
        }
    }
}

export function Authenticated() {
    return function(...args: any[]) {
        return Use(AuthenticationMiddleware)(...args);
    }
}

export function RoleRequired(userRole: Role|Role[]) {
    return function(...args: any[]) {
        return Use(AuthenticationMiddleware, {
            roles: Array.isArray(userRole) ? userRole : [userRole]
        });
    }
}
