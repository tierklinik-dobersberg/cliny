import {Injector, Provider} from '@jsmon/core';
import {Command, run, Option} from '@jsmon/cli';
import {Logger, LogLevel, ConsoleAdapter, useLoggingAdapter} from '@jsmon/core';
import {Runnable} from '@jsmon/cli/interfaces';
import {HTTPServerPlugin, HTTPServer} from '@jsmon/plugin-httpserver';
import {readFileSync} from 'fs';
import {BoardController, BOARD_CONFIG, BoardConfig, DummyBoardController} from './board';
import {Request, Response} from 'restify';
import {Scheduler, SCHEDULER_FILE} from './scheduler';
import {Ticker} from './ticker';

@Command({
    name: 'Door controller for Tierklinik Dobersberg',
    description: 'Runs the built-in HTTP server to control the entry door',
    version: '0.0.1',
    imports: [
        HTTPServerPlugin
    ],
    providers: [
        Logger,
        useLoggingAdapter(ConsoleAdapter),
    ]
})
export class DoorControlCommand implements Runnable {

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
                private _server: HTTPServer,
                private _log: Logger) {
    }
    
    async run() {
        const providers: Provider[] = [
            this.useDummyBoard ? {provide: BoardController, useClass: DummyBoardController} : BoardController,
            Scheduler,
            Ticker,
        ];

        if (!!this.logLevel) {
            this._log.setLogLevel(this.logLevel);
            this._log.debug(`setting log-level to ${this.logLevel}`);
        }
        
        this._log = this._log.createChild(`door`);

        if (!!this.boardConfig) {
            const configContent = readFileSync(this.boardConfig);
            try {
                const config: BoardConfig = JSON.parse(configContent.toString());
                // TODO(ppacher): validate board configuration
                
                // TODO(ppacher): update @jsmon/core to ensure we cannot pass a wrong token to useValue
                // e.g. implement a similar concept to angulars InjectionToken (and enfore use of it)
                providers.push({
                    provide: BOARD_CONFIG,
                    useValue: config,
                });
            } catch(err) {
                this._log.error(`Failed to parse board configuration: ${err}`);
                return;
            }
        }
        
        if (!!this.schedulerConfigPath) {
            providers.push({
                provide: SCHEDULER_FILE,
                useValue: this.schedulerConfigPath
            });
        }
        
        const child = this._injector.createChild(providers);
        
        let ctrl: BoardController;
        try {
            ctrl = child.get<BoardController>(BoardController);
        } catch(err) {
            this._log.error(`Failed to setup board controller: ${err}`);
            return;
        }
        
        let scheduler: Scheduler;
        try {
            scheduler = child.get<Scheduler>(Scheduler);
        } catch (err) {
            this._log.error(`Failed to create scheduler: ${err}`);
            return;
        }
        
        scheduler.state
            .subscribe(async state => {
                try {
                    switch(state) {
                    case 'lock':
                        await ctrl.lock();
                        break;
                    case 'unlock':
                        await ctrl.unlock();
                        break;
                    case 'open':
                        await ctrl.open();
                        break;
                    }
                } catch (err) {
                    this._log.error(`Failed to set door state to ${state}: ${err}`);
                }
            });
        
        // Health check endpoint
        // TODO(ppacher): add the current state of the board controller
        this._server.register('get', '/status', (_, res) => {
            res.sendRaw(204);
        });
        
        // Door control endpoints
        this._server.register('post', '/open', this._makeRequestHandler(ctrl, 'open'));
        this._server.register('post', '/lock', this._makeRequestHandler(ctrl, 'lock'));
        this._server.register('post', '/unlock', this._makeRequestHandler(ctrl, 'unlock'));

        // Start serving
        this._log.info(`Listening on ${this.port}`);
        this._server.listen(this.port);
    }
    
    private _makeRequestHandler(ctrl: BoardController, signal: 'open'|'lock'|'unlock'): (_: Request, res: Response) => void {
        return async (_: Request, res: Response) => {
            try {
                switch(signal) {
                case 'open':
                    await ctrl.open();
                    break;
                case 'lock':
                    await ctrl.lock();
                    break;
                case 'unlock':
                    await ctrl.unlock();
                    break;
                default:
                    throw new Error(`Invalid door signal ${signal}`);
                }
                
                res.send(204);
            } catch (err) {
                res.send(500, err);
            }
        }
    }
}

run(DoorControlCommand);