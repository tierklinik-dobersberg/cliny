import { Plugin, Provider } from '@jsmon/core';
import { HttpServer } from '@jsmon/net/http/server';
import { provideConfigKey } from '../services';
import { DoorController } from './door.controller';
import { Scheduler } from './scheduler';
import { API, NotOpenMiddleware } from './server';
import { Ticker } from './ticker';

@Plugin({
    providers: [
        DoorController,
        API,
        NotOpenMiddleware,
        Ticker,
        Scheduler,
        provideConfigKey('door'),
    ]
})
export class DoorPlugin {
    static setupRoutes(prefix: string, srv: HttpServer) {
        srv.mount(prefix, API);
    }
}
