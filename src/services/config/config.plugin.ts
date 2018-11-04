import { Plugin, Provider } from '@jsmon/core';
import { ConfigService, CLINY_CONFIG_FILE } from './config.service';

@Plugin({
    providers: [
        ConfigService
    ]
})
export class ConfigPlugin {
    static useConfigFile(path: string): Provider {
        return {
            provide: CLINY_CONFIG_FILE,
            useValue: path
        };
    }
}