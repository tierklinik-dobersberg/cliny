import { Injectable } from '@jsmon/core';
import { Middleware, Use } from '@jsmon/net/http/server';
import { Next, Request, Response } from 'restify';
import { Role, IUser } from './models';
import { UserController } from './user.controller';
import { getContext } from '../utils';
import { NotAuthorizedError, ForbiddenError, UnauthorizedError } from 'restify-errors';

export const CLINY_COOKIE = 'cliny';
export const CLINY_AUTH_CONTEXT = 'cliny-user';

/**
 * Returns the authenticated user object or null
 * 
 * @param req - The HTTP request
 */
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

/**
 * Middleware to ensure a HTTP request is authenticated
 * The authentication token may either be specified in the CLINY_COOKIE
 * or within the Authorization bearer
 *
 * The middleware can also be used to ensure a user has a required role set
 */
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
            if (!user || !user.enabled) {
                next(new UnauthorizedError('Authorization required'));
                return;
            }
            
            if (!!options && !!options.roles) {
                if (!options.roles.includes(user.role)) {
                    next(new ForbiddenError());
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

/**
 * Decorator to require authentication for HTTP requests
 */
export function Authenticated() {
    return function(...args: any[]) {
        return Use(AuthenticationMiddleware)(...args);
    }
}

/**
 * Decorator to require authentication for HTTP requests.
 * It also ensures the authenticated user has one of the
 * provided roles
 * 
 * @param userRole - One or more roles the user must have
 */
export function RoleRequired(userRole: Role|Role[]) {
    return function(...args: any[]) {
        return Use(AuthenticationMiddleware, {
            roles: Array.isArray(userRole) ? userRole : [userRole]
        });
    }
}
