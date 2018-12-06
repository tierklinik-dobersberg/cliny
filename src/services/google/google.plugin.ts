import { Plugin } from '@jsmon/core';
import { GoogleAuthorizationService } from './authorization.service';
import { GoogleCalendarService } from './calendar.service';

@Plugin({
    providers: [
        GoogleAuthorizationService,
        GoogleCalendarService
    ]
})
export class GoogleAPIPlugin {}