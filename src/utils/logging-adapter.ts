import { ConsoleAdapter, ConsoleAdapterLoggingConfig, LogLevel, Optional, Inject } from '@jsmon/core';
import { appendFileSync } from 'fs';

export interface LoggingConfig extends ConsoleAdapterLoggingConfig {
    filePath?: string;
}

export class FileConsoleAdapter extends ConsoleAdapter {
    private _filePath: string;

    constructor(@Optional() @Inject(ConsoleAdapterLoggingConfig) cfg?: LoggingConfig) {
        super(cfg);
        
        this._filePath = (cfg || {filePath: null}).filePath || 'cliny.log';
    }
    
    log(level: LogLevel, name: string, m: string, ...args: any[]) {
        super.log(level, name, m, ...args);

        const msg = (new Date()).toISOString() + ' ' + this.format(level, name, m) + (!!args && args.length > 0 ? ` (${JSON.stringify(args)})` : '') + '\n';
        try {
            appendFileSync(this._filePath, msg);
        } catch (err) {
            console.error(`Failed to write log file: `, err);
        }
    }
}