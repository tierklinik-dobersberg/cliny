import { Delete, Get, Post, Put } from "@jsmon/net/http/server";
import { Next, Request, Response } from "restify";
import { BadRequestError, NotFoundError } from "restify-errors";
import { Authenticated, RoleRequired } from "../users";
import { CalendarListEntry, CalendarService } from "./calendar.service";
import { Injectable } from "@jsmon/core";

@Injectable()
export class CalendarAPI {
    constructor(private _calendarService: CalendarService) {}
    
    @Get('/')
    @Authenticated()
    async listCalendars(req: Request, res: Response, next: Next) {
        try {
            const clas = await this._calendarService.listCalendars();

            res.send(200, clas);
            next();
        } catch (err) {
            console.error(err);
            next(err);
        }
    }
    
    @Delete('/:calendarId/events/:eventId')
    @Authenticated()
    async deleteEvent(req: Request, res: Response, next: Next) {
        try {
            const calId = req.params.calendarId;
            const eventId = req.params.eventId;

            await this._calendarService.deleteEvent(calId, eventId);
            
            res.send(204);
            next();
        } catch (err) {
            console.error(err);
            next(err);
        }
    }
    
    @Post('/:calendarId/events')
    @Authenticated()
    async createEvent(req: Request, res: Response, next: Next) {
        try {
            const id = req.params.calendarId;
            if (!id) {
                throw new BadRequestError(`Missing calendar id`);
            }
            
            const event = req.body;

            if (!event.start || typeof event.start !== 'number') {
                throw new BadRequestError(`Missing start time for the new event`)
            }
            
            if (!event.end || typeof event.end !== 'number') {
                throw new BadRequestError(`Missing end time for the new event`);
            }
            
            if (!event.summary || typeof event.summary !== 'string') {
                throw new BadRequestError(`Missing or invalid summary for the new event`);
            }
            
            if (!!event.description && typeof event.description !== 'string') {
                throw new BadRequestError(`Invalid type for the description`);
            }
            
            const eventId = await this._calendarService.createEvent(id, new Date(event.start), new Date(event.end), event.summary, event.description || '');
            
            res.send(200, {id: eventId, calendarId: id});
            next();
        } catch (err) {
            console.error(err);
            next(err);
        }
    }
    
    @Get('/:calendarId/events')
    @Authenticated()
    async listCalendarEvents(req: Request, res: Response, next: Next) {
        try {
            const id = req.params.calendarId;
            const from = req.query.from;
            const to = req.query.to;
            
            let events = await this._calendarService.getEventsForCalendar(id, {
                fromDate: !!from ? new Date(from) : undefined,
                toDate: !!to ? new Date(to) : undefined,
            });

            res.send(200, events);
            next();
        } catch (err) {
            console.error(err);
            next(err);
        }
    }
    
    @Get('/events')
    @Authenticated()
    async listEvents(req: Request, res: Response, next: Next) {
        try {
            let ids = req.query.calendarId;

            if (!Array.isArray(ids)) {
                ids = [ids];
            }
            
            const from = req.query.from;
            const to = req.query.to;
            
            let events = await this._calendarService.getEventsForCalendars(ids, {
                fromDate: !!from ? new Date(from) : undefined,
                toDate: !!to ? new Date(to) : undefined,
            });
            
            res.send(200, events);
            next();
        } catch (err) {
            console.error(err);
            next(err);
        }
    }
    
    @Post('/')
    @RoleRequired('admin')
    async createCalendar(req: Request, res: Response, next: Next) {
        try {
            const cal: CalendarListEntry & {timeZone?: string} = req.body;
            if (!cal.name) {
                throw new BadRequestError(`Missing name for the new calendar`);
            }
            
            if (!cal.color) {
                throw new BadRequestError(`Missing color for the new calendar`);
            }
            
            const result = await this._calendarService.createCalendar(cal.name, cal.color, cal.timeZone);
            
            res.send(200, result);
            next();
        } catch (err) {
            console.error(err);
            next(err);
        }
    }
    
    @Delete('/:calendarId')
    @RoleRequired('admin')
    async deleteCalendar(req: Request, res: Response, next: Next) {
        try {
            const id = req.params.calendarId;
            
            if (!id) {
                throw new BadRequestError(`Missing calendar ID`);
            }
            
            // ensure the calendar exists
            const allCalendars = await this._calendarService.listCalendars();
            if (allCalendars.find(cal => cal.id === id) === undefined) {
                throw new NotFoundError(`Calendar with ID ${id} does not exist`);
            }
            
            await this._calendarService.deleteCalendar(id);
            
            res.send(204);
            next();
        } catch (err) {
            console.error(err);
            next(err);
        }
    }
    
    @Put('/:calendarId')
    @RoleRequired('admin')
    async updateCalendar(req: Request, res: Response, next: Next) {
        try {
            const id = req.params.calendarId;
            if (!id) {
                throw new BadRequestError(`Missing calendar ID`);
            }
            
            const body = req.body;
            
            await this._calendarService.updateCalendar(id, body.name, body.color, body.timeZone);

            res.send(204);
            next();
        } catch (err) {
            console.error(err);
            next(err);
        }
    }
}