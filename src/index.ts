import { Command, Option, run } from '@jsmon/cli';
import { Runnable } from '@jsmon/cli/interfaces';
import { App, Bootstrap, ConsoleAdapter, forwardRef, Inject, Injector, Logger, LogLevel, useLoggingAdapter } from '@jsmon/core';
import { HttpServer, HTTPServerPlugin } from '@jsmon/net/http/server';
import { MqttPlugin } from '@jsmon/net/mqtt';
import { createTestAccount } from 'nodemailer';
import { plugins } from 'restify';
import 'restify-cookies';
import { CalendarPlugin } from './calendar';
import { DatabasePlugin } from './database';
import { DoorPlugin } from './door';
import { OpeningHoursPlugin } from './openinghours';
import { RosterPlugin } from './roster';
import { ConfigPlugin, ConfigService, MailConfig, MailServicePlugin, RPCPlugin } from './services';
import { GoogleAPIPlugin, GoogleAuthorizationService } from './services/google';
import { UserPlugin } from './users';
import { IntegrationPlugin } from './integration';
import { FileConsoleAdapter } from './utils';

// Unfortunately the typedefinitions for restify-cookies lacks the CookieParser
// default export (e.g. there's no "parse" method)
const CookieParser = require('restify-cookies');

@App({
    plugins: [
        DoorPlugin,
        DatabasePlugin,
        OpeningHoursPlugin,
        HTTPServerPlugin,
        RosterPlugin,
        UserPlugin,
        MailServicePlugin,
        ConfigPlugin,
        RPCPlugin,
        MqttPlugin,
        GoogleAPIPlugin,
        CalendarPlugin,
        IntegrationPlugin
    ]
})
export class Cliny {
    private _main: ClinyBootstrap;

    constructor(private _logger: Logger,
                private _httpServer: HttpServer,
                private _googleAuth: GoogleAuthorizationService,
                @Inject(forwardRef(() => ClinyBootstrap)) main: any) {
                
        this._main = main;                 
        
        this._httpServer.server.use(plugins.bodyParser());
        this._httpServer.server.use(plugins.queryParser());
        this._httpServer.server.use(CookieParser.parse)
        
        DoorPlugin.setupRoutes('/door', this._httpServer);
        OpeningHoursPlugin.setupRoutes('/openinghours', this._httpServer);
        UserPlugin.setupRoutes('/users', this._httpServer);
        RosterPlugin.setupRoutes('/roster', this._httpServer);
        CalendarPlugin.setupRoutes('/calendar', this._httpServer);
        IntegrationPlugin.setupRoutes('/config/integration', this._httpServer);
        
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
        useLoggingAdapter(FileConsoleAdapter),
    ]
})
export class ClinyBootstrap implements Runnable {

    @Option({
        name: 'loglevel',
        short: 'l',
        argType: 'string',
        description: 'The log level (debug, info, warn, error)'
    })
    private logLevel: LogLevel|undefined;

    @Option({
        name: 'port',
        short: 'p',
        argType: 'number',
        description: 'The port to listen on for incoming API requests (HTTP)',
        valuePlaceholder: 'PORT',
    })
    public readonly port: number = 8081;
    
    @Option({
        name: 'config',
        short: 'c',
        argType: 'string',
        description: 'Path to the configuration file',
        valuePlaceholder: 'CONFIG',
        required: true
    })
    public readonly configPath: string = '';
    
    @Option({
        name: 'sync-db',
        description: 'Whether or not the database schema should be synced',
        argType:'boolean'
    })
    public readonly syncDb: boolean = false;

    @Option({
        name: 'test-mail',
        description: 'Create and use a test-account for mails',
        argType: 'boolean'
    })
    public readonly testMailAccount: boolean = false;

    constructor(private _injector: Injector,
                private _log: Logger) {
    }
    
    async run() {
        // Setup logging
        let logDBQueries = false;
        if (!!this.logLevel) {
            if ((this.logLevel as string) === 'trace') {
                this.logLevel = 'debug';
                logDBQueries = true;
            }
            this._log.setLogLevel(this.logLevel);
            this._log.debug(`setting log-level to ${this.logLevel}`);
        }
        
        // Setup mail config
        let mailConfig: MailConfig | null = null;
        if (this.testMailAccount) {
            let result = await createTestAccount();

            mailConfig = {
                host: 'smtp.ethereal.email',
                port: 465,
                secure: true,
                auth: {
                    user: result.user,
                    pass: result.pass
                },
                sender: result.user,
                templateDirectory: ''
            }
            
            this._log.info("=============================================");
            this._log.info("          [- Test Mail Account -]");
            this._log.info(`Username: ${result.user}`);
            this._log.info(`Password: ${result.pass}`);
            this._log.info("=============================================");
        }
        
        const appInjector = this._injector.createChild([
            DatabasePlugin.useConfig({
                sync: this.syncDb,
                logQueries: logDBQueries,
            }),
            ConfigPlugin.useConfigFile(this.configPath),
            ConfigService,
            ...(mailConfig !== null ? [MailServicePlugin.withConfig(mailConfig)] : [])
        ]);
        
        const configService = appInjector.get<ConfigService>(ConfigService);
        
        const bootstrapper = new Bootstrap()
            .withInjector(appInjector)
            .withProvider(Cliny)
            .withLogger(this._log.createChild('cliny'))

        const mqttConfig = await configService.getConfig<{url?: string}>('mqtt');
        if (!!mqttConfig) {
            if (!!mqttConfig.url)
            bootstrapper.withProvider(RPCPlugin.useMQTTBroker(mqttConfig.url));
        }
        
        // bootstrap and run cliny
        const app = bootstrapper.create(Cliny);
            
        await app.waitForTermination();
        this._log.info('Shutdown');
    }
}

run(ClinyBootstrap);