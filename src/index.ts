import {Command, run} from '@jsmon/cli';
import {Logger, ConsoleAdapter, useLoggingAdapter} from '@jsmon/core';
import {Runnable} from '@jsmon/cli/interfaces';
import {HTTPServerPlugin, HTTPServer} from '@jsmon/plugin-httpserver';

@Command({
    name: 'Door controller for Tierklinik Dobersberg',
    description: 'Runs the built-in HTTP server to control the entry door',
    version: '0.0.1',
    imports: [
        HTTPServerPlugin
    ],
    providers: [
        Logger,
        useLoggingAdapter(ConsoleAdapter)
    ]
})
export class DoorControlCommand implements Runnable {
    constructor(private _server: HTTPServer,
                private _log: Logger) {

    }
    
    async run() {
        this._log.info(`Listening on 0.0.0.0:8081`);
        this._server.listen(8081);
    }
}

run(DoorControlCommand);