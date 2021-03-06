import { Injectable, Logger } from '@jsmon/core';
import { Delete, Get, Post, Put } from '@jsmon/net/http/server';
import { Next, Request, Response } from 'restify';
import { BadRequestError, ForbiddenError, NotAuthorizedError, InternalServerError, PreconditionFailedError, LockedError, NotFoundError } from 'restify-errors';
import { Authenticated, CLINY_COOKIE, getAuthenticatedUser, RoleRequired } from './auth';
import { IUser } from './models';
import { UserController } from './user.controller';
import { MailService, ConfigService, GlobalConfig, CacheService } from '../services';
import { LRUCache } from '../services/cache/lru-cache';

const defaultInvitationTemplate = `
<html>
<body>
<img src="logo.png"> <br />
Hallo {{= it.fullname}},<br />
<br />
Ein neuer Account in der Tierklinik Dobersberg wurde für dich erstellt.<br />
<br />
Benutzername: <b>{{= it.username}}</b> <br />
Passwort: <b>{{= it.password}}</b> <br />
<br />
Du kannst dich jederzeit unter der folgenden Web-Adresse anmelden:<br />
<br />
{{= it.host}}<br />
<br />
Dein<br />
cliny<br />
<br />
----<br />
Dies ist einen automatisch generierte Nachricht
</body>
</html>
`;

interface Icon {
    mimetype: string;
    data: Buffer;
}

@Injectable()
export class UserAPI {
    private _iconCache: LRUCache<string, Icon>;

    constructor(private _log: Logger,
                private _userCtrl: UserController,
                private _configService: ConfigService,
                private _cacheService: CacheService,
                private _mailService: MailService) {
        this._log = this._log.createChild('api:user');
        this._iconCache = this._cacheService.create('lru', 'usericons', {
            maxSize: 15,
            loader: (key: string) => this._getUserIcon(key),
        });
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
                
                const user = await this._userCtrl.getUser(username);
                
                if (user!.mustChangePassword) {
                    this._log.info(`User ${username} authenticated and password change required`);
                } else {
                    this._log.info(`User ${username} authenticated successfully`);
                }
                
                // check if the user is allowed to login
                if (!user!.enabled) {
                    res.setCookie(CLINY_COOKIE, '', {expires: new Date(1), httpOnly: true, path: '/'});
                    next(new LockedError());
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
            
            if (authenticatedUser.mustChangePassword) {
                this._log.info(`User ${authenticatedUser.username} already authenticated but must change password`);
            } else {
                this._log.info(`User ${authenticatedUser.username} already authenticated`)
            }

            res.send(200, authenticatedUser);
        } catch (err) {
            next(err);
        }
    }
    
    @Get('/icons/:username')
    @Authenticated()
    async getUserIcon(req: Request, res: Response, next: Next) {
        try {
            // If the icon is not already cached, it will be loaded and cached by the
            // cache loader function (this._getUserIcon)
            const cachedIcon = await this._iconCache.get(req.params.username);
            res.sendRaw(200, cachedIcon!.data, {
                'Content-Type': cachedIcon!.mimetype,
                'Cache-Control': 'public, max-age=600'
            });
            next();
            
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
            // TODO(ppacher): may default to false instead of true
            const sendMail = req.body.sendMail || true;
            
            await this._userCtrl.createUser(user, user.password);
            
            if (sendMail) {
                if (!user.mailAddress) {
                    this._log.warn(`Cannot send invitation mail as no mail address was provided`);
                } else {
                    const global = this._configService.config<GlobalConfig>('global');
                    let host = `http://${req.header('host')}`;
                    if (!!global && !!global.host) {
                        host = `${global.protocol || 'http'}://${global.host}`;
                    }
                    
                    this._mailService.sendMailTemplate(user.mailAddress, 'Benutzerkonto erstellt', 'invitation_mail', {
                        username: user.username,
                        password: user.password,
                        fullname: !!user.firstname ? `${user.firstname} ${user.lastname}` : user.username,
                        host: host,
                    }, undefined, defaultInvitationTemplate)
                        .then(() => this._log.info(`Invitation mail for user ${user.username} sent`))
                        .catch(err => this._log.error(`Failed to send invitation mail for user ${user.username}: ${err}`));
                }
            }

            res.send(204);
            next();
        } catch(err) {
            next(err);
        }
    }
    
    @Put('/:username/password')
    @Authenticated()
    async changePassword(req: Request, res: Response, next: Next) {
        try {
            // If the authenticated user is not an admin it is only
            // allowed to update it self;
            const authenticated = getAuthenticatedUser(req)!;

            if (authenticated.role !== 'admin' && authenticated.username !== req.params.username) {
                next( new ForbiddenError() );
                return;
            }

            let currentPassword = req.body.current;
            let newPassword = req.body.newPassword;

            if (authenticated.role !== 'admin' || authenticated.username === req.params.username) {
                if (! (await this._userCtrl.checkUserPassword(req.params.username, currentPassword))) {
                    next(new PreconditionFailedError('Current password is wrong'));
                    return
                }
            }
            
            await this._userCtrl.updateUserPassword(req.params.username, newPassword);
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
            // Delete all properties that only an administrator may change
            if (authenticated.role !== 'admin') {
                delete user.hoursPerWeek;
                delete user.type;
                delete user.role;
            }
            
            delete (user as any)['password']; 
            await this._userCtrl.updateUser(user);
            
            this._iconCache.delete(user.username);
            
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

    private async _getUserIcon(username: string): Promise<Icon> {
        let icon = await this._userCtrl.getUserIcon(username);
        if (icon === null) {
            throw new NotFoundError(`No icon for user ${username}`);
        }

        // data uris should start with data:<mimetype>;base64,
        if (!icon.startsWith('data:')) {
            throw new InternalServerError(`Invalid user icon format`)
        }
        
        icon = icon.substr('data:'.length);

        // next, there should be the mimetype
        let i = 0;
        while(icon[++i] !== ';' || icon[i] === undefined) {};
        
        const mime = icon.substr(0, i);
        icon = icon.substr(mime.length);
        
        if (!icon.startsWith(';base64,')) {
            throw new InternalServerError(`Invalid user icon format`);
        }
        
        icon = icon.substr(';base64,'.length);
        const payload = Buffer.from(icon, 'base64');
        
        return {
            data: payload,
            mimetype: mime,
        };
    }
}
