import { Injectable, OnDestroy, Logger } from '@jsmon/core';

@Injectable()
export class CacheService implements OnDestroy {
    constructor(private _log: Logger) {
        this._log = this._log.createChild(`cache`);
    }
    
    onDestroy() {
    
    }
}