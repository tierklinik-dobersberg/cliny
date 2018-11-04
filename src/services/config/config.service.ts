import { Injectable, Inject, InjectionToken, Provider, Optional } from '@jsmon/core';
import { readFile, writeFile } from 'fs';

export const CLINY_CONFIG_FILE = new InjectionToken<string>('CLINY_CONFIG_FILE');
export const CLINY_CONFIG_KEY = new InjectionToken<string>('CLINY_CONFIG_KEY');

export function provideConfigKey(key: string): Provider {
    return {
        provide: CLINY_CONFIG_KEY,
        useValue: key,
        multi: true
    };
}

@Injectable()
export class ConfigService {
    private _configPromise: Promise<{[key: string]: any}>;
    private _config: {[key: string]: any};
    private _resolve: (cfg: {[key: string]: any}) => void;
    private _reject: (err: any) => void;

    constructor(@Inject(CLINY_CONFIG_FILE) private _configFilePath: string,
                @Optional() @Inject(CLINY_CONFIG_KEY) private _keys: string[]) {
        this._configPromise = new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });

        this._loadConfig();
    }
    
    async config() {
        return await this._configPromise;
    }
    
    async getConfig<T>(key: string): Promise<T|undefined> {
        return (await this._configPromise)[key];
    }
    
    setConfig(key: string, value: any): Promise<void> {
        this._config[key] = value;

        return new Promise((resolve, reject) => {
            writeFile(this._configFilePath, JSON.stringify(this._config, undefined, 4), (err) => {
                if (!!err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
                
    private _loadConfig() {
        readFile(this._configFilePath, (err, data) => {
            if (!!err) {
                this._reject(err);
                return;
            }
            
            try {
                const config = JSON.parse(data.toString());
                this._config = config;
                
                this._resolve(this._config);
            } catch (coughtError) {
                this._reject(coughtError);
            }
        });
    }
}