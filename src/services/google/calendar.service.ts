import { Injectable, Logger } from "@jsmon/core";
import { GoogleAuthorizationService } from "./authorization.service";
import { google, calendar_v3 } from "googleapis";
import { PreconditionFailedError, BadRequestError, NotFoundError, InternalServerError, ForbiddenError, UnauthorizedError } from "restify-errors";

@Injectable()
export class GoogleCalendarService {
    constructor(private _log: Logger,
                private _googleAuth: GoogleAuthorizationService) {
        this._log = this._log.createChild('google:calendar');
    }
    
    /**
     * Returns an authenticated calendar API client
     */
    async calendar(): Promise<calendar_v3.Calendar> {
        const auth = await this._googleAuth.authorize();

        return google.calendar({
            version: 'v3',
            auth: auth
        });
    }
    
    /**
     * Returns all events for a calendar of currently logged in user
     * 
     * @param [calendarID] - An optional calendar ID to load events from.
     *                       Defaults to the primary calendar of the currently logged in use
     */
    async listEvents(calendarID: string = 'primary', {from, to, max}: {from?: Date, to?: Date, max?: number} = {}): Promise<calendar_v3.Schema$Events> {
        const cal = await this.calendar();
        
        const req: calendar_v3.Params$Resource$Events$List = {
            calendarId: calendarID,
            singleEvents: true,
            orderBy: 'startTime'
        };
        
        if (!!max) {
            req.maxResults = max;
        }
        
        if (!!from) {
            req.timeMin = from.toISOString();
        }
        
        if (!!to) {
            req.timeMax = to.toISOString()
        }
        
        return (await cal.events.list(req)).data;
    }
    
    /**
     * Creates a new secondary calendar for the currently logged in user
     * and return the calendar object
     * 
     * @param summary - The name of the new calendar
     * @param color - The color for the new calendar
     * @param [timezone] - The timezone for the new calendar. Defaults to "Europe/Vienna"
     */
    async createCalendar(summary: string, color: string, timezone: string = 'Europe/Vienna'): Promise<calendar_v3.Schema$CalendarListEntry> {
        const cal = await this.calendar();

        const response = await cal.calendars.insert({
            requestBody: {
                summary: summary,
                timeZone: timezone,
            }
        });
        
        if (!response.data || !response.data.id) {
            throw new InternalServerError(`Failed to create a new calendar`);
        }
        
        const listResponse = await cal.calendarList.insert({
            colorRgbFormat: true,
            requestBody: {
                backgroundColor: color,
                id: response.data.id
            }
        });
        
        if (!listResponse.data || listResponse.status >= 400) {
            throw new InternalServerError(`Failed to add the new calendar to the list: ${listResponse.statusText}`);
        }

        return listResponse.data;
    }

    /**
     * Updates a calendar for the currently logged in google user account 
     * 
     * @param id - The id of the calendar to update
     * @param [summary] - An optional new name for the calendar
     * @param [color] - An optional new color for the calendar
     * @param [timeZone] - An optional new timezone for the calendar
     */
    async updateCalendar(id: string, summary?: string, color?: string, timeZone?: string) {
        const cal = await this.calendar();

        const calendar = await cal.calendarList.get({
            calendarId: id
        });

        if (!calendar.data || calendar.status >= 300) {
            throw new NotFoundError(`Failed to get calendar with id ${id}`);
        }
        
        let changed = false;
        if (calendar.data.summary !== summary && !!summary) {
            calendar.data.summary = summary;
            changed = true;
        }
        
        if (calendar.data.timeZone !== timeZone && !!timeZone) {
            calendar.data.timeZone = timeZone;
            changed = true;
        }
        
        if (changed) {
            const updateResponse = await cal.calendars.update({
                calendarId: id,
                requestBody: {
                    summary: calendar.data.summary,
                    timeZone: calendar.data.timeZone
                }
            });
            
            if (updateResponse.status >= 300) {
                throw new InternalServerError(`Failed to update calendar with id ${id} and name ${calendar.data.summary}`);
            }
        }
        
        if (calendar.data.backgroundColor !== color && !!color) {
            const updateResponse = await cal.calendarList.update({
                calendarId: id,
                colorRgbFormat: true,
                requestBody: {
                    backgroundColor: color
                }
            });

            if (updateResponse.status >= 300) {
                throw new InternalServerError(`Failed to update calendar color: ${updateResponse.statusText}`);
            }
        }
    }
    
    /**
     * Returns a list of all calendars the currently logged in user
     * has access to
     */
    async listCalendars(): Promise<calendar_v3.Schema$CalendarList> {
        const cal = await this.calendar();
        return (await cal.calendarList.list()).data;
    }
    
    /**
     * Loads a calendars of the current user and return the ID of a
     * calendar object identified by name. If the calendar does not exist
     * and error is thrown
     * 
     * @param name - The name of the calendar (called summary in googleapis)
     */
    async getCalendarIDByName(name: string): Promise<string> {
        const calendars = await this.listCalendars();

        if (!calendars.items) {
            throw new Error(`No calendars found`);
        }
        
        const cal = calendars.items.find(c => c.summary!.toLocaleLowerCase() == name.toLocaleLowerCase());
        if (!cal) {
            throw new Error(`Failed to find calendarID for calendar with name "${name}"`);
        }
        
        if (!cal.id) {
            throw new Error(`Found calendar with name "${cal.summary}" but without an ID`);
        }
        
        return cal.id!;
    }
    
    /**
     * Deletes a secondary calendar from the currently logged in
     * google user account
     * 
     * @param id - The ID of the calendar to delete
     */
    async deleteCalendar(id: string): Promise<void> {
        const calendar = await this.calendar();
        
        if (id === 'primary') {
            throw new PreconditionFailedError(`Cannot delete the primary calendar`);
        }

        const res = await calendar.calendarList.delete({
            calendarId: id,
        });

        if (res.status >= 400) {
            switch (res.status) {
                case 401:
                    throw new BadRequestError(res.data);
                case 403:
                    throw new ForbiddenError(res.data);
                case 401:
                    throw new UnauthorizedError(res.data);
                case 404: 
                    throw new NotFoundError(res.data);
                case 500:
                    throw new InternalServerError(res.data);
                default:
                    throw new Error(`Failed to delete calendar with id ${id}: ${res.status} - ${res.statusText}`);
            }
        }
    }
    
    /**
     * Creates a new event in the given calendar and returns the newly created ID
     * 
     * @param calId - The ID of the calendar
     * @param start - The start time of the event
     * @param end - The end time of the event
     * @param summary - The summary/title for the event
     * @param [description] - An optional description for the event
     */
    async createEvent(calId: string, start: Date, end: Date, summary: string, description: string = ''): Promise<string> {
        const calendar = await this.calendar();

        const result = await calendar.events.insert({
            calendarId: calId,
            requestBody: {
                summary: summary,
                description: description,
                start: {
                    dateTime: start.toISOString(),
                    timeZone: ''
                },
                end: {
                    dateTime: end.toISOString(),
                    timeZone: ''
                }
            }
        });
        
        if (!result.data || result.status >= 300) {
            throw new InternalServerError(`Failed to create event: ${result.status} - ${result.statusText}`);
        }
        
        return result.data.id!;
    }
    
    /**
     * Deletes an event from a given calendar
     * 
     * @param calId - The ID of the calendar
     * @param eventId - The ID of the event to remove
     */
    async deleteEvent(calId: string, eventId: string): Promise<void> {
        const calendar = await this.calendar();

        const result = await calendar.events.delete({
            calendarId: calId,
            eventId: eventId
        });
        
        if (result.status >= 300) {
            throw new InternalServerError(`Failed to delete event with id ${eventId} from calendar ${calId}`);
        }
    }
}