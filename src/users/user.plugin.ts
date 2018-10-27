import {Plugin} from '@jsmon/core';
import {provideEntity} from '../database';
import {User} from './models';
import {UserController} from './user.controller';
import {UserAPI} from './api';
import {HttpServer} from '@jsmon/net/http/server';
import { AuthenticationMiddleware } from './auth';
import { AuthToken } from './models/token';

@Plugin({
    providers: [
        provideEntity(User),
        provideEntity(AuthToken),
        UserController,
        UserAPI,
        AuthenticationMiddleware
    ]
})
export class UserPlugin {
    static setupRoutes(prefix: string, srv: HttpServer) {
        srv.mount(prefix, UserAPI);
    }
}