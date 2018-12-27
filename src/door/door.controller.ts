import { Injectable, Logger } from '@jsmon/core';
import { DoorControllerRPC } from '../services';
import { Scheduler } from './scheduler';

@Injectable()
export class DoorController {
    constructor(private _log: Logger,
                private _scheduler: Scheduler,
                private _board: DoorControllerRPC) {
        this._log = this._log.createChild('door-controller');
        
        this._runServer();
    }
    
    private async _runServer() {
        this._log.info(`Starting door controller ...`);
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
                    
                    this._log.info(`Door state updated to ${state}`);
                } catch (err) {
                    this._log.error(`Failed to set door state to ${state}: ${err}`);
                }
                
                running = false;
            });
    }
}