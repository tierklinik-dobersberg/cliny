import { Injectable, Logger } from '@jsmon/core';
import { Middleware, Use } from '@jsmon/net/http/server';
import { Next, Request, Response } from 'restify';
import { Role, IUser, User } from './models';
import { UserController } from './user.controller';
import { getContext } from '../utils';
import { ForbiddenError, UnauthorizedError, LockedError } from 'restify-errors';
import { ConfigService } from '../services';
import { Netmask } from 'netmask';

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

export interface AuthConfig {
    /** A list of IP address or IPv4 subnets that should be auto-authenticated using a guest account */
    allowedIPs?: string[];
    
    /** A list of IP address or IPv4 subnets that should be excluded from the allowedIPs list */
    excludeIPs?: string[];
    
    /** The name for the guest account user. Not that the user must exist */
    guest?: string;
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
    private _allowedIPs: (string|Netmask)[] = [];
    private _excludedIPs: (string|Netmask)[] = [];
    private _guest: string|null = null;

    constructor(private _userController: UserController,
                private _log: Logger,
                private _config: ConfigService) {
                
        this._log = this._log.createChild('auth');

        this._config.getConfig('auth')
                    .then((cfg?: AuthConfig) => {
                        if (!cfg) {
                            return;
                        }

                        this._guest = cfg.guest || null;
                        
                        (cfg.allowedIPs || [])
                            .forEach(ip => {
                                if (ip.includes('/')) {
                                    this._allowedIPs.push(new Netmask(ip))
                                } else {
                                    this._allowedIPs.push(ip);
                                }
                            });

                        (cfg.excludeIPs || [])
                            .forEach(ip => {
                                if (ip.includes('/')) {
                                    this._excludedIPs.push(new Netmask(ip))
                                } else {
                                    this._excludedIPs.push(ip);
                                }
                            })
                    });
    }
    
    async handle(options: AuthOptions|undefined, req: Request, res: Response, next: Next) {
        try {
            
            let user: IUser | null = null;

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
            
            if (!!authTokenValue) {
                user = await this._userController.getUserForToken(authTokenValue);
            }
            
            if (!user && this._allowedIPs.length > 0) {
                this._log.debug(`Trying to authenticate request by IP: ${req.connection.remoteAddress}`);

                const isAllowedIP = !!req.connection.remoteAddress && this._allowedIPs.some(ip => {
                    if (ip instanceof Netmask) {
                        return ip.contains(req.connection.remoteAddress!)
                    }
                    
                    return ip === req.connection.remoteAddress!;
                });
                
                const isExcludedIP = !!req.connection.remoteAddress && this._excludedIPs.some(ip => {
                    if (ip instanceof Netmask) {
                        return ip.contains(req.connection.remoteAddress!)
                    }
                    
                    return ip === req.connection.remoteAddress!;
                });
                
                // Check if the remoteAddress is an allowed IP address and not specified as excluded
                if (isAllowedIP && !isExcludedIP) {
                    this._log.info(`Client authenticated by remote address: ${req.connection.remoteAddress}`);
                    if (!this._guest || this._guest.length === 0) {
                        this._log.warn('Request allowed by remote address but no guest user name configured');
                    } else {
                        user = await this._userController.getUser(this._guest);

                        if (!user) {
                            this._log.warn(`Guest user with name "${this._guest}" does not exist`);
                        }
                    }
                }
            }

            if (!user) {
                next(new UnauthorizedError('Authorization required'));
                return;
            }
            
            if (!user.enabled) {
                next(new LockedError('User locked'));
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
