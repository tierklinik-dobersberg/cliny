import {Injectable, Logger, OnDestroy, Type, Inject, Provider} from '@jsmon/core';
import {createConnection, Connection, Repository} from 'typeorm';

export const DB_ENTITY = 'DB_ENTITY';
export const DB_CONFIG = 'DB_CONFIG';
export interface DatabaseConfig {
    sync?: boolean;
}

export function provideEntity(e: Type<any>): Provider {
    return {
        provide: DB_ENTITY,
        multi: true,
        useValue: e,
    };
}

@Injectable()
export class Database implements OnDestroy {
    private _db: Connection | null = null;
    private _ready$: Promise<void>;
    private _resolve: () => void;

    get ready(): Promise<void> { return this._ready$; }
    
    get db(): Connection {
        if (!this._db) {
            throw new Error(`Database not yet ready`);
        }
        return this._db!;
    }
    
    getRepository<T>(type: string|Type<T>): Repository<T> {
        if (!this._db) {
            throw new Error(`Database not yet ready`);
        }
        
        return this._db.getRepository(type)
    }
    
    constructor(private _log: Logger,
                @Inject(DB_CONFIG) private _config: DatabaseConfig,
                @Inject(DB_ENTITY) private _entities: Type<any>[]) {
        this._log = this._log.createChild('db');
        this._ready$ = new Promise((resolve) => this._resolve = resolve);
        
        this._log.debug('Enties', this._entities.map(e => e.name).join(', '));
        
        this._setupDB();
    }
    
    async onDestroy() {
        if (!!this._db) {
            await this._db.close();
        }
    }
    
    private async _setupDB() {
        this._log.debug(`Opening SQLITE database`);
        
        try {
            this._db = await createConnection({
                type: 'sqlite',
                database: './cliny.db',
                synchronize: this._config.sync || false,
                //logging: true,
                entities: [
                    ...this._entities
                ]
            });
            
            //await this._db.synchronize();
            
            this._log.info(`Database initialized`);
            this._resolve();
        } catch (err) {
            this._log.error(`failed to initialize database: ${err}`);
            console.error(err);
        }
    }
}