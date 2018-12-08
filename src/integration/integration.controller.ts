import { Injectable } from "@jsmon/core";
import { Get, Post, Delete } from "@jsmon/net/http/server";
import { RoleRequired, Authenticated, getAuthenticatedUser } from "../users";
import { Request, Response, Next } from "restify";
import { GoogleAuthorizationService } from "../services";
import { BadRequestError } from "restify-errors";

@Injectable()
export class IntegrationController {

    constructor(private _googleAuthService: GoogleAuthorizationService) {}

    @Get('/google')
    @Authenticated()
    async getGoolgeIntegrationStatus(req: Request, res: Response, next: Next) {
        try {
            const isAuthenticated = await this._googleAuthService.isAuthenticated()
            
            const user = getAuthenticatedUser(req);

            if (user!.role !== 'admin') {
                res.send(200, {
                    authenticated: isAuthenticated
                });
                next();
                return;
            }
            
            if (isAuthenticated) {
                const profile = await this._googleAuthService.getProfile();

                res.send(200, {
                    authenticated: true,
                    profile: profile,
                });
                next();
                return;
            }
            
            res.send(200, {
                authenticated: false,
                authURL: this._googleAuthService.getAuthURL(),
            });
            next();
        } catch (err) {
            next(err);
        }
    }
    
    @Post('/google')
    @RoleRequired('admin')
    async authorizeGoogle(req: Request, res: Response, next: Next) {
        try {
            const code = req.body.code;
            if (!code) {
                throw new BadRequestError(`Missing code to authorize against the google account`);
            }
            
            await this._googleAuthService.finishAuthorization(code);
            
            const profile = await this._googleAuthService.getProfile();

            res.send(200, {
                authenticated: true,
                profile: profile,
            });
            next();
        } catch (err) {
            next(err);
        }
    }
    
    @Delete('/google')
    @RoleRequired('admin')
    async unauthorizeGoogle(req: Request, res: Response, next: Next) {
        try {
            await this._googleAuthService.unauthorize();

            res.send(200, {
                authenticated: false,
                authURL: this._googleAuthService.getAuthURL()
            });
            next();
        } catch (err) {
            next(err);
        }
    }
}