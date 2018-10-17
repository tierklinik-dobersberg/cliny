import {Injectable, Logger} from '@jsmon/core';
import {HttpServer} from '@jsmon/net/http/server';
import {API} from './server';
import {BoardController} from './board';
import {Scheduler} from './scheduler';

@Injectable()
export class DoorController {
    constructor(private _log: Logger,
                private _scheduler: Scheduler,
                private _board: BoardController) {
        this._log = this._log.createChild('door-controller');
        
        this._log.info(`Created`);
        
        let running = false;
        this._scheduler.state
            .subscribe(async state => {
                if (running) {
                    this._log.warn(`Skipping interval as tick handler is still running`);
                    return;
                }
                
                running = true;
                
                try {
                    switch(state) {
                    case 'lock':
                        await this._board.lock();
                        break;
                    case 'unlock':
                        await this._board.unlock();
                        break;
                    case 'open':
                        await this._board.open();
                        break;
                    }
                } catch (err) {
                    this._log.error(`Failed to set door state to ${state}: ${err}`);
                }
                
                running = false;
            });
    }
    
    setupRoutes(server: HttpServer): void {
        server.mount(API);
    }
}