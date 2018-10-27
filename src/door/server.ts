import {Injectable, Inject, forwardRef, Logger} from '@jsmon/core';
import {Use, Get, Post, Delete, Put, HTTPServerPlugin, Middleware} from '@jsmon/net/http/server';
import {Request, Response, Next} from 'restify';
import {Scheduler} from './scheduler';
import {BoardController} from './board';
import { Authenticated } from '../users';

export class NotOpenMiddleware implements Middleware<never> {
    constructor(@Inject(forwardRef(() => API)) private _api: any,
                private _log: Logger) {
        this._log = this._log.createChild('api:door');
    }
    
    handle(options: never, req: Request, res: Response, next: Next) {
        if (this._api.isOpen) {
            res.send(405, 'Door is currently opened');
            next(false);
            return;
        }
        
        next();
    }
}

export function GuardOpen(): any {
    return (...args: any[]) => {
        return Use(NotOpenMiddleware)(...args);
    }
}


@Injectable()
export class API {
    private _open: boolean = false;
    
    get isOpen(): boolean {
        return this._open;
    }

    constructor(private _scheduler: Scheduler,
                private _board: BoardController) {}
    
    @Get('/status')
    @Authenticated()
    status(req: Request, res: Response, next: Next) {
        try {
            let current = this._scheduler.getConfigForDate(new Date());
            
            if (this._open) {
                current.state = 'open';
                current.until = new Date().getTime();
            }

            res.send(200, {
                current: current,
                config: this._scheduler.config,
            });
            next();
        } catch (err) {
            next(err);
        }
    }
    
    @Post('/test')
    test(req: Request, res: Response, next: Next) {
        try {
            let current = this._scheduler.getConfigForDate(new Date(req.body));
            
            if (this._open) {
                current.state = 'open';
                current.until = new Date().getTime();
            }

            res.send(200, {
                current: current,
                config: this._scheduler.config,
            });
        next();
        } catch (err) {
            next(err);
        }
    }
    
    @Post('/open')
    @Authenticated()
    async open(req: Request, res: Response, next: Next) {
        try {
            this._open = true;
            this._scheduler.pause(true);
            
            await this._board.open();

            // Wait for 5 seconds before we may send an additional
            // lock/unlock signal based on the configuration
            setTimeout(() => {
                this._scheduler.pause(false);
                this._open = false;

                res.send(204);
                next();
            }, 10000);
        } catch (err) {
            this._scheduler.pause(false);
            this._open = false;
            
            next(err)
        }
    }
    
    @Put('/set/:state')
    @Authenticated()
    @GuardOpen()
    setOverwrite(req: Request, res: Response, next: Next) {
        try {
            const until = req.body;
            
            if (req.params.state === 'open') {
                res.send(405, 'Overwrite cannot use OPEN state');
                next();
                return;
            }

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
    @Authenticated()
    @GuardOpen()
    async reset(req: Request, res: Response, next: Next) {
        try {
            this._scheduler.pause(true);
            
            this._scheduler.clearOverwrite();
            
            await this._board.lock();
            const desired = this._scheduler.getConfigForDate(new Date());
            
            switch(desired.state) {
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
            // Make sure we don't keep the scheduler in paused state
            this._scheduler.pause(false);
            
            next(err);
        }
    }
}