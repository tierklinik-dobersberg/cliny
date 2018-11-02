import { Injectable, Logger } from '@jsmon/core';
import { RosterController } from './roster.controller';
import { Get, Post, Delete, Put } from '@jsmon/net/http/server';
import { Request, Response, Next } from 'restify';
import { Authenticated, RoleRequired } from '../users';
import moment from 'moment';

@Injectable()
export class RosterAPI {
    constructor(private _controller: RosterController,
                private _log: Logger) {
        this._log = this._log.createChild('api:er');
    }
    
    @Get('/types')
    @Authenticated()
    async getTypes(req: Request, res: Response, next: Next) {
        try {
            let types = await this._controller.getTypes();

            res.send(200, types)
            next();
        } catch (err) {
            next(err);
        }
    }
    
    @Put('/types/:id')
    @RoleRequired('admin')
    async editType(req: Request, res: Response, next: Next) {
        try {
            const name = req.body.name;
            const color = req.body.color || '';

            let result = await this._controller.editType(+req.params.id, name, color);
            
            res.send(200, result);
            next();
        } catch (err) {
            next(err);
        }
    }
    
    @Post('/types')
    @RoleRequired('admin')
    async createType(req: Request, res: Response, next: Next) {
        try {
            const name = req.body.name;
            const color = req.body.color || '';

            let result = await this._controller.createType(name, color);
            
            res.send(200, result);
            next();
        } catch (err) {
            next(err);
        }
    }
    
    @Delete('/types/:id')
    @RoleRequired('admin')
    async deleteType(req: Request, res: Response, next: Next) {
        try {
            await this._controller.deleteType(+req.params.id);
            res.send(204);
            next();
        } catch (err) {
            next(err);
        }
    }
    
    @Get('/current')
    @Authenticated()
    async getCurrentSchedules(req: Request, res: Response, next: Next) {
        try {
            const startOfWeek = moment().startOf('isoWeek');
            const endOfWeek = moment().endOf('isoWeek');

            let result = await this._controller.getSchedulesBetween(startOfWeek, endOfWeek);

            res.send(200, result);
            next();
        } catch (err) {
            next(err);
        }
    }

    @Get('/schedules')
    @Authenticated()
    async getSchedules(req: Request, res: Response, next: Next) {
        try {
            let from = req.query.from || -1;
            let to = req.query.to || Infinity;
            
            if (!isNaN(+from)) {
                from = +from;
            }
            
            if (!isNaN(+to)) {
                to = +to;
            }
            
            console.log(`Searching for schedules between ${from} and ${to}`);
            let result = await this._controller.getSchedulesBetween(from, to);
            
            res.send(200, result);
            next();
        } catch(err) {
            next(err);
        }
    }
    
    @Post('/schedules')
    @RoleRequired('admin')
    async createSchedule(req: Request, res: Response, next: Next) {
        try {
            const start = req.body.start;
            const end = req.body.end;
            const date = new Date(req.body.date);
            const users = req.body.users;
            const color = req.body.color;
            const type = req.body.type;

            await this._controller.createSchedule(start, end, date, users, type, color);
            
            res.send(204);
            next();

        } catch (err) {
            next(err);
        }
    }
    
    @Put('/schedules/:id')
    @RoleRequired('admin')
    async editSchedule(req: Request, res: Response, next: Next) {
        try {
            const start = req.body.start;
            const end = req.body.end;
            const date = new Date(req.body.date);
            const users = req.body.users;
            const color = req.body.color;
            const type = req.body.type;

            await this._controller.editSchedule(+req.params.id, start, end, date, users, type, color);
            
            res.send(204);
            next();
        } catch (err) {
            next(err);
        }
    }
    
    @Delete('/schedules/:id')
    @RoleRequired('admin')
    async deleteSchedule(req: Request, res: Response, next: Next) {
        try {
            await this._controller.deleteSchedule(+req.params.id);

            res.send(204);
            next();
        } catch (err) {
            next(err);
        }
    }
}