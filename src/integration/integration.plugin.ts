import { Plugin } from '@jsmon/core';
import { HttpServer } from '@jsmon/net/http/server';
import { IntegrationController } from './integration.controller';

@Plugin({
    providers: [
        IntegrationController
    ]
})
export class IntegrationPlugin {
    static setupRoutes(prefix: string, srv: HttpServer) {
        srv.mount(prefix, IntegrationController);
    }
}