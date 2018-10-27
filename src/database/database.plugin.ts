import {Plugin, Provider} from '@jsmon/core';
import {Database, DatabaseConfig, DB_CONFIG} from './database';

@Plugin({
    providers: [Database]
})
export class DatabasePlugin {
    static useConfig(cfg: DatabaseConfig): Provider {
        return {
            provide: DB_CONFIG,
            useValue: cfg,
        };
    }
}