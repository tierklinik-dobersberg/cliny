import {Plugin} from '@jsmon/core';
import { CalendarService } from './calendar.service';
import { HttpServer } from '@jsmon/net/http/server';
import { CalendarAPI } from './api';

@Plugin({
    providers: [
        CalendarService,
        CalendarAPI
    ]
})
export class CalendarPlugin {
    static setupRoutes(prefix: string, srv: HttpServer) {
        srv.mount(prefix, CalendarAPI);
    }
}