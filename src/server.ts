import {Injectable} from '@jsmon/core';
import {Get, Post, Delete, Put, HTTPServerPlugin} from '@jsmon/net/http/server';
import {Request, Response, Next} from 'restify';
import {Scheduler} from './scheduler';
import {BoardController} from './board';

@Injectable()
export class API {
    constructor(private _scheduler: Scheduler,
                private _board: BoardController) {}
    
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
            
            if (frame === null) {
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
    
    @Put('/set/:state')
    setOverwrite(req: Request, res: Response, next: Next) {
        try {
            const until = req.body;

            if (until === null) {
                this._scheduler.clearOverwrite();
            } else {
                this._scheduler.setOverwrite(req.params.state, until);
            }
            
            res.send(204);
            
            next();
            return;
        } catch(err) {
            next(err);
        }
    }
    
    @Post('/reset')
    async reset(req: Request, res: Response, next: Next) {
        try {
        
            this._scheduler.pause(true);
            
            this._scheduler.clearOverwrite();
            
            await this._board.lock();
            const desired = this._scheduler.getConfigForDate(new Date());
            
            switch(desired) {
            case 'lock':
                break;
            case 'unlock':
                await this._board.unlock();
            }

            this._scheduler.pause(false);
            
            res.send(204);
            next();
            return;
        } catch(err) {
            next(err);
        }
    }
}