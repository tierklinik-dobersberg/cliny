import { Plugin } from '@jsmon/core';
import { provideEntity } from '../database';
import { Roster, RosterSchedule, RosterScheduleType } from './models';
import { RosterController } from './roster.controller';
import { HttpServer } from '@jsmon/net/http/server';
import { RosterAPI } from './api';

@Plugin({
    providers: [
        provideEntity(Roster),
        provideEntity(RosterSchedule),
        provideEntity(RosterScheduleType),
        RosterController,
        RosterAPI
    ]
})
export class RosterPlugin {
    static setupRoutes(prefix: string, srv: HttpServer) {
        srv.mount(prefix, RosterAPI);
    }
}