import {Injectable, Logger, OnDestroy, Type, Inject, Provider} from '@jsmon/core';
import {createConnection, Connection, Repository} from 'typeorm';
import {OpeningHour} from '../openinghours/models';

export const DB_ENTITY = 'DB_ENTITY';

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
                @Inject(DB_ENTITY) private _entities: Type<any>[]) {
        this._log = this._log.createChild('database');
        this._ready$ = new Promise((resolve) => this._resolve = resolve);
        
        this._log.info('Enties', this._entities.map(e => e.name));
        
        this._setupDB();
    }
    
    async onDestroy() {
        if (!!this._db) {
            await this._db.close();
        }
    }
    
    private async _setupDB() {
        this._log.debug(`Opening SQLITE database`);
        this._db = await createConnection({
            type: 'sqlite',
            database: './cliny.db',
            synchronize: true,
            entities: [
                ...this._entities
            ]
        });
        
        this._db.synchronize();
        
        this._log.info(`Database initialized`);
        this._resolve();
    }
}