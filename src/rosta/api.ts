import { Injectable, Logger } from '@jsmon/core';
import { RostaController } from './rosta.controller';
import { Get, Post, Delete, Put } from '@jsmon/net/http/server';
import { Request, Response, Next } from 'restify';

@Injectable()
export class RostaAPI {
    constructor(private _controller: RostaController,
                private _log: Logger) {
        this._log = this._log.createChild('api:rosta');
    }

    @Get('/schedules')
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
    async createSchedule(req: Request, res: Response, next: Next) {
        try {
            const start = req.body.start;
            const end = req.body.end;
            const date = new Date(req.body.date);
            const users = req.body.users;
            const color = req.body.color;

            await this._controller.createSchedule(start, end, date, users, color);
            
            res.send(204);
            next();

        } catch (err) {
            next(err);
        }
    }
    
    @Put('/schedules/:id')
    async editSchedule(req: Request, res: Response, next: Next) {
        try {
            const start = req.body.start;
            const end = req.body.end;
            const date = new Date(req.body.date);
            const users = req.body.users;
            const color = req.body.color;

            await this._controller.editSchedule(+req.params.id, start, end, date, users, color);
            
            res.send(204);
            next();
        } catch (err) {
            next(err);
        }
    }
    
    @Delete('/schedules/:id')
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