import {Plugin, Provider} from '@jsmon/core';
import {Scheduler, SCHEDULER_FILE} from './scheduler';
import {BOARD_CONFIG, BoardConfig, BoardController, DummyBoardController} from './board';
import {DoorController} from './door.controller';
import {API, NotOpenMiddleware} from './server';
import {Ticker} from './ticker';

export interface DoorPluginConfig {
    useDummyBoard?: boolean;
    schedulerConfig?: string;
    boardConfig?: BoardConfig;
}

@Plugin({
    providers: [
        DoorController,
        API,
        NotOpenMiddleware,
        Ticker,
        Scheduler,
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
        
        if (!!cfg.schedulerConfig) {
            providers.push({
                provide: SCHEDULER_FILE,
                useValue: cfg.schedulerConfig,
            });
        }
        
        return providers;
    }
}
