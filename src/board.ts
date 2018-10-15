import {Injectable, Inject, Optional, Logger} from '@jsmon/core';
import {Gpio} from 'onoff';

export interface PinConfig {
    gpioNumber: number;
    activeState: 'high' | 'low';
}

export const BOARD_CONFIG = 'BOARD_CONFIG';
export interface BoardConfig {
    open: PinConfig;
    lock: PinConfig;
    unlock: PinConfig; 
}

/**
 * Default configuration for the clinic internal wiring of the
 * entry door
 */
const defaultConfig: BoardConfig = {
    // Relay 1
    lock: {
        gpioNumber: 7,
        activeState: 'low'
    },
    // Relay 2
    unlock: {
        gpioNumber: 8,
        activeState: 'low'
    },
    // Relay 3
    open: {
        gpioNumber: 15,
        activeState: 'low'
    },
};

/**
 * Each BoardController must satisfy the following interface
 */
export interface IBoardController {
    /** Open should send a (temporary) open request to the door */
    open(): Promise<void>;
    
    /** Lock should send a lock request to the door */
    lock(): Promise<void>;
    
    /** Unlock should send a unlock request to the door */
    unlock(): Promise<void>;
}

@Injectable()
export class DummyBoardController implements IBoardController {
    constructor(private _log: Logger) {
        this._log = this._log.createChild('dummy-board');
    }
    
    async open() {
        this._log.debug(`sending an OPEN signal`);
    }
    
    async lock() {
        this._log.debug(`sending a LOCK signal`);
    }
    
    async unlock() {
        this._log.debug(`sending an UNLOCK signal`)
    }
}

@Injectable()
export class BoardController implements IBoardController {
    private _openPin: Gpio|undefined;
    private _lockPin: Gpio|undefined;
    private _unlockPin: Gpio|undefined;

    constructor(
        @Inject(BOARD_CONFIG) @Optional() private _config: BoardConfig = defaultConfig,
    ) {
        this._setupGpios();
    }
    
    /**
     * Sends an open signal to the door
     */
    open(): Promise<void> {
        return this._togglePin(this._openPin!, this._config.open);
    }
    
    /**
     * Sends a lock signal to the door
     */
    lock(): Promise<void> {
        return this._togglePin(this._lockPin!, this._config.lock);
    }
    
    /**
     * Sends an unlock signal to the door
     */
    unlock(): Promise<void> {
        return this._togglePin(this._unlockPin!, this._config.unlock);
    }
    
    /**
     * @internal
     * 
     * Opens all required GPIO ports and configures there default state
     */
    private _setupGpios(): void {
        this._openPin = this._getGpioPort(this._config.open);
        this._lockPin = this._getGpioPort(this._config.lock);
        this._unlockPin = this._getGpioPort(this._config.unlock);
    }
    
    /**
     * @internal
     * 
     * Configures a GPIO output port and returns a {@link onoff#Gpio} instance
     * 
     * @param cfg - The pin configuration for the GPIO
     */
    private _getGpioPort(cfg: PinConfig): Gpio {
        return new Gpio(
            cfg.gpioNumber,
            this._getDefaultPinState(cfg)
        );
    }
    
    /**
     * @internal
     *
     * Returns the default value for a pin configuration based on it's active state
     * 
     * @param cfg - The pin configuration
     */
    private _getDefaultPinState(cfg: PinConfig): 'high'|'low' {
        switch(cfg.activeState) {
        case 'low':
            return 'high';
        case 'high':
            return 'low';
        default:
            throw new Error(`Invalid activeState for PIN ${cfg.gpioNumber}`);
        }
    }
    
    /**
     * @internal
     * 
     * Toggles a given GPIO output pin based on the provided configuration
     * 
     * @param gpio - The Gpio instance to toggle
     * @param cfg - The pin configuration for the GPIO
     */
    private _togglePin(gpio: Gpio, cfg: PinConfig): Promise<void> {
        return new Promise((resolve, reject) => {
            const active = this._stateFromString(cfg.activeState);  
            const inactive = this._stateFromString(this._getDefaultPinState(cfg));
            
            gpio.write(active, (err, _) => {
                // TODO(ppacher): the second parameter is the actual value that is outputted
                // may check against the desired state (same for the setTimeout() method below)
                
                if (!!err) {
                    // try to reset the GPIO to it's inactive state
                    // if this doesn't work either, there's nothing we can do ...
                    gpio.writeSync(inactive);
                    reject(err);
                    return;
                }
                
                // TODO(ppacher): make the timeout configurable
                setTimeout(() => {
                    gpio.write(inactive, (err, _) => {
                        if (!!err) {
                            reject(err);
                            return;
                        }
                        
                        resolve();
                    });
                }, 1000);
            });
        });
    }

    /**
     * @internal
     * 
     * Returns the number representation of a GPIO state
     * 
     * @param state - The GPIO state to translate (either "high" or "low")
     */
    private _stateFromString(state: 'high'|'low'): number {
        switch(state) {
        case 'high':
            return 1;
        case 'low':
            return 0;
        default:
            throw new Error(`Invalid GPIO state ${state}`);
        }
    }
}