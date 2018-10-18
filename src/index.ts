import {Injector, App, Bootstrap, forwardRef, Inject} from '@jsmon/core';
import {Command, run, Option} from '@jsmon/cli';
import {HTTPServerPlugin, HttpServer} from '@jsmon/net/http/server';
import {Logger, LogLevel, ConsoleAdapter, useLoggingAdapter} from '@jsmon/core';
import {Runnable} from '@jsmon/cli/interfaces';
import {DoorPlugin, DoorPluginConfig, BoardConfig, DoorController} from './door';
import {DatabasePlugin} from './database';
import {plugins} from 'restify';
import { readFileSync } from 'fs';
import { OpeningHoursPlugin } from './openinghours';
import {UserPlugin} from './users';
@App({
    plugins: [
        DoorPlugin,
        DatabasePlugin,
        OpeningHoursPlugin,
        HTTPServerPlugin,
        UserPlugin,
    ]
})
export class Cliny {
    private _main: ClinyBootstrap;

    constructor(private _logger: Logger,
                private _doorController: DoorController,
                private _httpServer: HttpServer,
                @Inject(forwardRef(() => ClinyBootstrap)) main: any) {
        this._main = main;                 
            
        this._httpServer.server.use(plugins.bodyParser());
        
        DoorPlugin.setupRoutes('/door', this._httpServer);
        OpeningHoursPlugin.setupRoutes('/openinghours', this._httpServer);
        UserPlugin.setupRoutes('/users', this._httpServer);

        // Start serving
        this._logger.info(`Listening on ${this._main.port}`);
        this._httpServer.listen(this._main.port);
    }

    waitForTermination(): Promise<void> {
        return new Promise((resolve, reject) => {
        
        });
    }
}

@Command({
    name: 'cliny - backend for the Tierklinik Dobserberg',
    description: 'Runs the built-in HTTP server to control the entry door',
    version: '0.0.1',
    providers: [
        Logger,
        useLoggingAdapter(ConsoleAdapter),
    ]
})
export class ClinyBootstrap implements Runnable {

    @Option({
        name: 'loglevel',
        short: 'l',
        argType: 'string',
        description: 'The log level (debug, info, warn, error)'
    })
    private readonly logLevel: LogLevel|undefined;

    @Option({
        name: 'port',
        short: 'p',
        argType: 'number',
        description: 'The port to listen on for incoming API requests (HTTP)',
        valuePlaceholder: 'PORT',
    })
    public readonly port: number = 8081;
    
    @Option({
        name: 'board-config',
        short: 'c',
        argType: 'string',
        description: 'Path to the board configuration (JSON format)',
        valuePlaceholder: 'CONFIG'
    })
    public readonly boardConfig: string|undefined;

    @Option({
        name: 'scheduler-config',
        short: 's',
        argType: 'string',
        description: 'Path to the scheduler configuration file',
        valuePlaceholder: 'CONFIG'
    })
    public readonly schedulerConfigPath: string|undefined;
    
    @Option({
        name: 'dummy-board',
        description: 'Use the dummy board implementation for testing',
        argType: 'boolean'
    })
    public readonly useDummyBoard: boolean = false;


    constructor(private _injector: Injector,
                private _log: Logger) {
    }
    
    async run() {
        if (!!this.logLevel) {
            this._log.setLogLevel(this.logLevel);
            this._log.debug(`setting log-level to ${this.logLevel}`);
        }
        
        this._log = this._log.createChild(`door`);
        
        const doorConfig: DoorPluginConfig = {};

        if (!!this.schedulerConfigPath) {
            doorConfig.schedulerConfig = this.schedulerConfigPath;
        }
        
        if (!!this.useDummyBoard) {
            doorConfig.useDummyBoard = this.useDummyBoard;
        }
        
        if (!!this.boardConfig) {
            const configContent = readFileSync(this.boardConfig);
            try {
                const config: BoardConfig = JSON.parse(configContent.toString());
                doorConfig.boardConfig = config;
            } catch(err) {
                this._log.error(`Failed to parse board configuration: ${err}`);
                return;
            }
        }
        
        const appInjector = this._injector.createChild(DoorPlugin.forConfig(doorConfig));
        
        const app = new Bootstrap()
            .withInjector(appInjector)
            .withProvider(Cliny)
            .withLogger(this._log.createChild('cliny'))
            .create(Cliny);
            
        await app.waitForTermination();
        this._log.info('Shutdown');

    }
}

run(ClinyBootstrap);