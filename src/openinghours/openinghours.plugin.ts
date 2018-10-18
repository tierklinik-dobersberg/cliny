import {Plugin} from '@jsmon/core';
import {OpeningHoursController} from './openinghours.controller';
import {provideEntity} from '../database';
import {OpeningHour, TimeFrame} from './models';
import {OpeningHoursAPI} from './api';
import {HttpServer} from '@jsmon/net/http/server';

@Plugin({
    providers: [
        OpeningHoursController,
        OpeningHoursAPI,
        provideEntity(OpeningHour),
        provideEntity(TimeFrame),
    ]
})
export class OpeningHoursPlugin {
    static setupRoutes(prefix: string, srv: HttpServer) {
        srv.mount(prefix, OpeningHoursAPI);
    }
}