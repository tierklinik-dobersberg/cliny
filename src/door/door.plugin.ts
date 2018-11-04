import { Plugin, Provider } from '@jsmon/core';
import { HttpServer } from '@jsmon/net/http/server';
import { provideConfigKey } from '../services';
import { BoardConfig, BoardController, BOARD_CONFIG, DummyBoardController } from './board';
import { DoorController } from './door.controller';
import { Scheduler } from './scheduler';
import { API, NotOpenMiddleware } from './server';
import { Ticker } from './ticker';

export interface DoorPluginConfig {
    useDummyBoard?: boolean;
    boardConfig?: BoardConfig;
}

@Plugin({
    providers: [
        DoorController,
        API,
        NotOpenMiddleware,
        Ticker,
        Scheduler,
        provideConfigKey('door'),
    ]
})
export class DoorPlugin {
    static forConfig(cfg: DoorPluginConfig): Provider[] {
        let providers: Provider[] = [];

        if (!!cfg.boardConfig) {
            providers.push({
                provide: BOARD_CONFIG,
                useValue: cfg.boardConfig
            });
        }
        
        if (!!cfg.useDummyBoard) {
            providers.push({
                provide: BoardController,
                useClass: DummyBoardController
            });
        } else {
            providers.push(BoardController);
        }
        
        return providers;
    }

    static setupRoutes(prefix: string, srv: HttpServer) {
        srv.mount(prefix, API);
    }
}
