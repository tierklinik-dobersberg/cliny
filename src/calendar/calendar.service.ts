import { Injectable, App } from "@jsmon/core";
import { GoogleCalendarService } from "../services";
import { Holiday, HolidayService } from "../services/holidays";
import { BadRequestError } from "restify-errors";
import moment = require("moment");

export interface CalendarListEntry {
    id: string;
    name: string;
    backgroundColor: string;
    foregroundColor: string;
}

export interface Appointment {
    // The ID of the event
    id: string;
    
    // The title/summary of the event
    summary: string;
    
    // The description of the event
    description?: string;
    
    // The ID of the calendar the event belongs to
    calendarId: string;
    
    // The timestamp the event begins
    start: number;

    // The timestamp the event ends
    end: number;

    // Whether or not this is a full-day entry
    fullDay: boolean;
}

export interface AppointmentFilter {
    fromDate?: Date;
    toDate?: Date;
}

const InternHolidayCalendar = 'intern:holidays';

@Injectable()
export class CalendarService {
    constructor(private _googleCalService: GoogleCalendarService,
                private _holidayService: HolidayService) {}
    
    /**
     * Creates a new event in the given calendar and returns it's id
     * 
     * @param calendarId - The ID of the calendar that should contain the new event
     * @param start - The start date-time of the event
     * @param end - The end date-time of the event
     * @param summary - A summary/title for the event
     * @param [description] - An optional description for the event
     */
    async createEvent(calendarId: string, start: Date, end: Date, summary: string, description: string = ''): Promise<string> {
        return await this._googleCalService.createEvent(calendarId, start, end, summary, description);
    }
    
    /**
     * Deletes an event from a calendar
     * 
     * @param calendarId - The ID of the calendar the event belongs to
     * @param eventId - The ID of the event to delete
     */
    async deleteEvent(calendarId: string, eventId: string): Promise<void> {
        return await this._googleCalService.deleteEvent(calendarId, eventId);
    }

    /**
     * @internal
     * 
     * Returns all holidays for the given filter. If no filter is specified,
     * all holidays for the given year are returned.
     * 
     * @param filter - An optional appointment filter
     */
    private async _getHolidays(filter: AppointmentFilter = {}): Promise<Appointment[]> {
        let start = filter.fromDate || new Date();
        let end = filter.toDate || start;
        
        // TODO(ppacher): check if UTC year is correct here
        let startYear = start.getUTCFullYear();
        let endYear = end.getUTCFullYear();
        
        if (endYear < startYear) {
            throw new BadRequestError(`toDate is before startDate`);
        }
        
        let appointments: Appointment[] = [];
        let current = startYear;

        do {
            const res = await this._holidayService.getHolidaysForYear(current);
            let holidays: Appointment[] = res.map(h => {
                return {
                    id: h.localName,
                    summary: h.name,
                    calendarId: InternHolidayCalendar,
                    start: moment(h.date).startOf('day').valueOf(),
                    end: moment(h.date).endOf('day').valueOf(),
                    fullDay: true,
                }
            });
            
            holidays = holidays.filter(h => {
                return start === end || start.getTime() >= h.start && end.getTime() <= h.end
            });

            appointments = appointments.concat(holidays);

            current++;
        } while( current <= endYear );

        return appointments;
    }

    /**
     * Returns a list of appointments for the given calendar
     * 
     * @param calendarId - The ID of the calendar to load events from
     */
    async getEventsForCalendar(calendarId: string, filter: AppointmentFilter = {}): Promise<Appointment[]> {
        const appointments: Appointment[] = [];

        if (calendarId === InternHolidayCalendar) {
            return await this._getHolidays(filter);
        }
        
        const events = await this._googleCalService.listEvents(calendarId, {
            from: filter.fromDate,
            to: filter.toDate,
        });
        
        // TODO: check if this is a full-day event
        (events.items || []).forEach(event => {
            const ap: Appointment = {
                id: event.id!,
                calendarId: calendarId,
                description: event.description,
                summary: event.summary || '',
                start: new Date(event.start!.dateTime || event.start!.date!).getTime(),
                end: new Date(event.end!.dateTime || event.end!.date!).getTime(), 
                fullDay: false,
            };

            appointments.push(ap);
        });

        return appointments;
    }
    
    /**
     * Returns a list of appointments for a list of calendars matching the given filter
     * 
     * @param ids - A list of calendar IDs to query
     * @param filter - An optional filter for appointments
     */
    async getEventsForCalendars(ids: string[], filter: AppointmentFilter = {}): Promise<Appointment[]> {
        let appointments: Appointment[] = [];

        let p = Promise.all(
            ids.map(id => this.getEventsForCalendar(id, filter))
        );

        let result = await p;

        result.forEach(events => {
            appointments = appointments.concat(...events); 
        });

        return appointments;
    }
    
    /**
     * Returns a list of {@link CalendarListEntry} for the currently
     * logged in google user account
     */
    async listCalendars(): Promise<CalendarListEntry[]> {
        const calendars = await this._googleCalService.listCalendars();
        
        if (!calendars.items) {
            return [];
        }

        return calendars.items
            .filter(cal => {
                // filter out all calendars where the logged in
                // user is only a reader
                // those are most likely google std calendars
                return cal.accessRole !== 'reader';
            })
            .map(cal => {
                return {
                    id: cal.id!,
                    name: cal.summaryOverride || cal.summary!,
                    backgroundColor: cal.backgroundColor!,
                    foregroundColor: cal.foregroundColor!
                };
            });
    }
    
    /**
     * Creates a new secondary calendar for the current google user and returns a
     * {@link CalendarListEntry} object
     * 
     * @param name - The name for the new calendar
     * @param color - The background color for the new calendar
     * @param [timeZone] - An optional timezone for the new calendar. See {@link GoogleCalendarService#createCalendar} for more information
     */
    async createCalendar(name: string, backgroundColor: string, foregroundColor: string, timeZone?: string): Promise<CalendarListEntry> {
        const result = await this._googleCalService.createCalendar(name, backgroundColor, foregroundColor, timeZone);

        return {
            id: result.id!,
            backgroundColor: result.backgroundColor!,
            foregroundColor: result.foregroundColor!,
            name: result.summaryOverride || result.summary!
        };
    }

    /**
     * Deletes a secondary calendar from the current logged in google user account
     * 
     * @param id - The ID of the calendar to delete
     */
    async deleteCalendar(id: string): Promise<void> {
        return await this._googleCalService.deleteCalendar(id);
    }
    
    /**
     * Updates a calendar from the currently logged in google user account
     * 
     * @param id - The ID of the calendar to update
     * @param [name] - An optional new name for the calendar
     * @param [color] - An optional new color for the calendar
     * @param [timeZone] - An optional new timeZone for the calendar
     */
    async updateCalendar(id: string, name?: string, backgroundColor?: string, foregroundColor?: string, timeZone?: string): Promise<void> {
        await this._googleCalService.updateCalendar(id, name, backgroundColor, foregroundColor, timeZone);
    }
}