import { Plugin } from '@jsmon/core';
import { provideEntity } from '../database';
import { Rosta, RostaSchedule, RostaScheduleType } from './models';
import { RostaController } from './rosta.controller';
import { HttpServer } from '@jsmon/net/http/server';
import { RostaAPI } from './api';

@Plugin({
    providers: [
        provideEntity(Rosta),
        provideEntity(RostaSchedule),
        provideEntity(RostaScheduleType),
        RostaController,
        RostaAPI
    ]
})
export class RostaPlugin {
    static setupRoutes(prefix: string, srv: HttpServer) {
        srv.mount(prefix, RostaAPI);
    }
}