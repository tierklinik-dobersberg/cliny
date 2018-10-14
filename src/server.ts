import {Injectable} from '@jsmon/core';
import {Get, Post, Delete} from '@jsmon/net/http/server';
import {Request, Response, Next} from 'restify';
import {Scheduler} from './scheduler';

@Injectable()
export class API {
    constructor(private _scheduler: Scheduler) {}
    
    @Get('/status')
    status(req: Request, res: Response, next: Next) {
        const current = this._scheduler.getConfigForDate(new Date());
        res.send(200, {
            current: current,
            config: this._scheduler.config,
        });
        next();
    }
    
    @Post('/config/:weekday')
    addFrame(req: Request, res: Response, next: Next) {
        try {
            const frame = req.body;
            
            this._scheduler.addTimeFrame(req.params.weekday, frame, true);
            res.send(204);

            next();
            return;
        } catch (err) {
            next(err);
        }
    }
    
    @Delete('/config/:weekday')
    deleteTimeframe(req: Request, res: Response, next: Next) {
        try {
            const frame = req.body;
            
            if (frame === 'null') {
                this._scheduler.clearWeekdayConfig(req.params.weekday, true);
            } else {
                this._scheduler.deleteSchedule(req.params.weekday, frame, true);
            }

            res.send(204);
            
            next();
            return;
        } catch(err) {
            next(err);
        }
    }
}