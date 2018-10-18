import {Injectable, Logger} from '@jsmon/core';
import {Get, Put, Delete} from '@jsmon/net/http/server';
import {OpeningHoursController, OpeningHourConfig} from './openinghours.controller';
import {ITimeFrame, OpeningHour} from './models';
import {Request, Response, Next} from 'restify';

@Injectable()
export class OpeningHoursAPI {
    constructor(private _log: Logger,
                private _hoursController: OpeningHoursController) {}
    
    @Get('/config')
    async getOpeningHoursConfig(req: Request, res: Response, next: Next) {
        try {
            let config = await this._hoursController.getConfig();
            
            res.send(200, config);
            next();
        } catch (err) {
            this._log.error(`GET /config: failed to handle request, ${err.toString()}`);
            next(err);
        }
    } 
    
    @Put('/config/:weekday')
    async addTimeToWeekday(req: Request, res: Response, next: Next) {
        try {
            const frame: ITimeFrame = req.body;
            
            if (typeof req.params.weekday === 'string') {
                req.params.weekday = OpeningHour.weekDayFromString(req.params.weekday);
            }
            
            let err = this._validateWeekDay(req.params.weekday) ||
                      this._validateTimeFrame(frame);
                      
            if (!!err) {
                res.send(400, err);
                next(false);
                return;
            }
            
            await this._hoursController.addTimeFrame(req.params.weekday, frame);
            res.send(204);
            next();

        } catch (err) {
            this._log.error(`PUT /config/${req.params.weekday}: failed to handle request, ${err.toString()}`);
            next(err);
        }
    }
    
    @Delete('/config/:weekday')
    async deleteTimeFromWeekday(req: Request, res: Response, next: Next) {
        try {
            const frame: ITimeFrame = req.body;

            if (typeof req.params.weekday === 'string') {
                req.params.weekday = OpeningHour.weekDayFromString(req.params.weekday);
            }
            
            let err = this._validateWeekDay(req.params.weekday) ||
                      this._validateTimeFrame(frame);

            if (!!err) {
                res.send(400, err);
                next(false);
                return;
            } 
            
            await this._hoursController.deleteTimeFrame(req.params.weekday, frame);
            
            res.send(204);
            next();
        } catch(err) {
            this._log.error(`DELETE /config/${req.params.weekday}: failed to handle request, ${err.toString()}`);
            next(err)
        }
    }
    
    private _validateTimeFrame(frame: ITimeFrame): string | null {
        if (isNaN(+frame.start) || frame.start < 0 || frame.start > 23*60+59) {
            return `Invalid start time: ${frame.start}`;
        } 
        if (isNaN(+frame.end) || frame.end < 0 || frame.end > 23*60+59) {
            return 'Invalid end time';
        } 
        if (frame.start >= frame.end) {
            return 'Start time after end time';
        }
        
        return null;
    }

    private _validateWeekDay(day: number): string | null {
        if (isNaN(day) || day < 0 || day > 6) {
            return 'Invalid week day';
        };

        return null;
    }
}