import {Injectable, NoopLogAdapter} from '@jsmon/core';
import {Logger} from '@jsmon/core';
import {Observable} from 'rxjs';

@Injectable()
export class Ticker {
    constructor(private _log: Logger = new Logger(new NoopLogAdapter)) {
        this._log = this._log.createChild('ticker');
    }
    
    /**
     * Returns an observable that emits every given interval starting from xx:00:00
     * 
     * @param interval - The number of seconds between each tick
     */
    interval(interval: number): Observable<void> {
        return new Observable<void>(observer => {
            const now = new Date();
            const seconds = now.getMinutes() * 60 + now.getSeconds();
            
            const secondsTillNext = interval - (seconds % interval);
            
            this._log.info(`First tick in ${secondsTillNext} seconds`);
            
            const tick = () => {
                this._log.debug(`tick`);
                observer.next();
            };
            
            let timer: any;
            let timeout: any = setTimeout(() => {
                tick();
                timer = setInterval(() => tick(), interval * 1000);
            }, secondsTillNext * 1000);


            return () => {
                if (!!timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                } else {
                    clearInterval(timer);
                }
            }
        });
    }
}
