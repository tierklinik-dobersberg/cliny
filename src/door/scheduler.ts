import {Injectable, Optional, Inject, Logger, NoopLogAdapter, OnDestroy} from '@jsmon/core';
import {writeFileSync, readFileSync, existsSync} from 'fs';
import {Subscription, Subject, Observable} from 'rxjs';
import {OpeningHourConfig, OpeningHoursController, ITimeFrame} from '../openinghours';
import {join} from 'path';
import {Ticker} from './ticker';
import moment from 'moment';

/**
 * Possible door states
 */
export type DoorState = 'unlock' | 'lock' | 'open';

/**
 * Time represents a localtime in the format of [HH, MM]
 * e.g. [08, 00] for 08:00 local time
 */
export type Time = [
    /**  hour  */ number,
    /** minute */ number
];

/**
 * Constant index values for accessing the hour and minute parts
 * of a {@link Time}
 */
export enum TimeIndex {
    Hour = 0,
    Minute = 1,
}

export interface Delay {
    before: number;
    after: number;
}

/**
 * Injection token for the scheduler file path
 */
export const SCHEDULER_FILE = 'SCHEDULER_FILE';

export interface DoorConfig {
    /**
     * The current state of the door
     */
    state: DoorState;
    
    /**
     * The timestamp until the state is applied
     */
    until: number;
    
    /**
     * The ISO time format until the state is applied
     */
    untilISO: string;
}

export interface OverwriteConfig {
    until: number;
    state: DoorState;
}

/**
 * Definition of the scheduler file format
 */
export interface SchedulerConfig {
    // The number of seconds until the same door state should be sent
    // This is required as some commands will be lost if the door
    // is still open
    reconfigureInterval?: number;
    

    delays: {
        open?: number;
        close?: number;
    }
    
    // If set, the current configuration for `unlockSchedules` is ignored
    // and the door state is set according to the following {@link TimeFrame}
    // configuration. Once the time-frame passed, the configuration will reset
    // the overwrite to null and continue to use the default schedules
    currentOverwrite: OverwriteConfig|null;
}

@Injectable()
export class Scheduler implements OnDestroy {
    private _config: Readonly<SchedulerConfig>|null = null;
    private _tickerSubscription: Subscription|null = null;
    private readonly _state$: Subject<DoorState> = new Subject();
    private _pause: boolean = false;
    private _currentConfig: OpeningHourConfig;
    
    private get delayBefore(): number {
        if (!this._config) {
            return 0;
        }
        return this.config.delays.open || 0;
    } 
    
    private get delayAfter(): number {
        if (!this._config) {
            return 0;
        }
        return this.config.delays.close || 0;
    }
    
    private get delays(): {before: number, after: number} {
        return {
            before: this.delayBefore,
            after: this.delayAfter,
        };
    }

    constructor(private _ticker: Ticker,
                private _openingHours: OpeningHoursController,
                @Inject(SCHEDULER_FILE) @Optional() private _filePath?: string,
                private _log: Logger = new Logger(new NoopLogAdapter)) {
                
        this._log = this._log.createChild('scheduler');

        if (this._filePath === undefined) {
            if (!process.env.HOME) {
                throw new Error(`Cannot determinate default location for the scheduler file`);
            }
            
            this._filePath = join(process.env.HOME!, '.door-controller.sched');
        }
        
        this._log.info(`Using configuration from: ${this._filePath}`);
        
        this._openingHours.ready
            .then(() => {
                this._readAndParseConfig();

                this._openingHours.getConfig()
                    .then(config => {
                        this._currentConfig = config;
                        this._openingHours.changes
                            .subscribe(config => this._currentConfig = config);
                    });
            });
    }
    
    /**
     * Pause or unpause the scheduler. When paused no state updates will be
     * emitted via {@link Scheduler#state}
     * 
     * @param pause - Whether or not the scheduler should be paused
     */
    public pause(pause: boolean) {
        this._pause = pause;
    }
    
    /**
     * Continously emits the currently required {@link DoorState}
     */
    get state(): Observable<DoorState> {
        return this._state$;
    }
    
    /**
     * Updates the scheduler configuration. May throw an error if
     * the configuration is invalid
     * 
     * @param cfg - The new scheduler configuration to use
     * @param [write] - Wether the new configuration file should be written to disk as well
     */
    public setConfig(cfg: SchedulerConfig, write: boolean = false): void {
        // If no reconfigureInterval is set default to 5 minutes
        if (!cfg.reconfigureInterval) {
            cfg.reconfigureInterval = 5 * 60;
        }
        
        this._config = Object.freeze(cfg);
        
        this._setupInterval();
        
        if (write) {
            const content = JSON.stringify(this._config!, undefined, 4);
            writeFileSync(this.configPath, content);
        }
    }
    
    /**
     * Removes the current overwrite configuration
     * 
     * @param safeConfig - Whether or not the configuration should be safed to disk
     */
    public clearOverwrite(safeConfig: boolean = true): void {
        const copy = this.copyConfig();
        copy.currentOverwrite = null;

        this.setConfig(copy, safeConfig);
        const desiredState = this.getConfigForDate(new Date());
        this._state$.next(desiredState.state);
    }
    
    /**
     * Configures the current overwrite configuration
     * 
     * @param state - The desired door state for the overwrite
     * @param until - Time until the overwrite is valid and should be applied
     * @param safeConfig  - Whether or not the config should be safed to disk
     */
    public setOverwrite(state: DoorState, until: number, safeConfig: boolean = true): void {
        const copy = this.copyConfig();

        copy.currentOverwrite = {
            state: state,
            until: until,
        };
        
        this.setConfig(copy, safeConfig);
        this._state$.next(state);
    }
    
    /**
     * Returns a writeable copy of the current configuration
     */
    public copyConfig(): SchedulerConfig {
        return {
            delays: {...this.config.delays},
            reconfigureInterval: this.config.reconfigureInterval,
            currentOverwrite: !!this.config.currentOverwrite ? { ...this.config.currentOverwrite } : null
        };
    }

    /**
     * Returns the path to the scheduler configuration file
     */
    public get configPath(): string {
        // once the constructor executed we must have a filePath (or the constructor would have thrown)
        return this._filePath!;
    }
    
    /**
     * Returns a readonly version of the scheduler config
     * Will load the scheduler configuration if required
     * 
     * May throw an error if the configuration could not be loaded
     * or is invalid
     */
    public get config(): Readonly<SchedulerConfig> {
        if (!this._config) {
            this._readAndParseConfig();
        }
        
        return this._config!;
    }
    
    /**
     * Returns the required door state of a given point in time
     * It honors the overwrite configuration as well
     * 
     * @param date - The date to retrieve the current door state for
     */
    public getConfigForDate(date: Date): DoorConfig {
        const weekDay = moment(date).isoWeekday();
        const minutes = date.getHours() * 60 + date.getMinutes();
        
        let currentState: DoorState = 'lock';
        let until: Date;

        const toDate = (t: number, dateOffset?: number, minuteOffset: number = 0) => {
            let now = new Date();
            let minutes = t % 60;
            let hours = Math.floor(t / 60);

            now.setMilliseconds(0),
            now.setSeconds(0);
            now.setHours(hours);
            if (dateOffset !== undefined) {
                now.setDate(now.getDate() + dateOffset);
            }
            now.setMinutes(minutes);
            
            if (minuteOffset != 0) {
                now = new Date(now.getTime() + minuteOffset * 60 * 1000);
            }
            
            return now;
        }

        // check if we have a overwrite config and if we are still in it's time-frame
        if (!!this.config.currentOverwrite && date.getTime() < this.config.currentOverwrite.until) {
            currentState = this.config.currentOverwrite.state;
            until = new Date(this.config.currentOverwrite.until);
            
            this._log.info(`Using overwrite config. State should be ${currentState} until ${until}`);
        } else {
            // If we still have a overwrite but are after it's until time,
            // clear it
            if (!!this.config.currentOverwrite) {
                const copy: SchedulerConfig = {...this.config};
                copy.currentOverwrite = null;
                
                this.setConfig(copy, true);
            }
            
            const currentDayConfig = this._currentConfig[weekDay];

            // We now have to check a set of "unlock" time-frames and if we are in the middle of one
            const currentTimeFrame = currentDayConfig.find(frame => Scheduler.isInTimeFrame(this.delays, minutes, frame));

            if (!!currentTimeFrame) {
                currentState = 'unlock';
                until = toDate(currentTimeFrame.end, 0, this.delays.after);
                this._log.info(`Door state '${currentState}' configured from time-frame ${currentTimeFrame.start} - ${currentTimeFrame.end} until ${until}`)
            } else {
                currentState = 'lock';
                const next = this._getNextFrame(date);
                
                
                if (next === null) {
                    this._log.warn(`No active time frame. Current door state is 'locked' but failed to find the next active frame`);
                    until = null as any;
                } else {
                    let [dayOffset, untilTime] = next;
                    until = toDate(untilTime.start, dayOffset, -this.delays.before);
                    this._log.info(`No active time frame. Current door state is 'locked' until ${until}`);
                }
            }
        }
        
        return {
            state: currentState,
            until: !!until ? until!.getTime() : null as any,
            untilISO: !!until ? until!.toISOString() : '',
        };
    }
    
    /**
     * @internal
     * 
     * Called by the dependency injector if the scheduler is being destroyed
     */
    public onDestroy() {
        this._state$.complete();
    }


    /**
     * Checks if the given hours and minutes are within an specified time-frame
     * 
     * @param hour   - The current hour
     * @param minute - The current minute
     * @param frame  - The time frame to check against
     */
    public static isInTimeFrame(delays: Delay, minutes: number, frame: ITimeFrame): boolean {
        const fromMinutes = frame.start - delays.before;
        const afterMinutes = frame.end + delays.after;

        return minutes >= fromMinutes && minutes < afterMinutes;
    }
    
    /**
     * @internal
     * 
     * Searches for the next time-frame that becomes active
     * 
     * @param refDate - The reference date to use
     */
    private _getNextFrame(refDate: Date): [number, ITimeFrame]|null {
        let current = moment(refDate).isoWeekday();
        let offset = 0;
        while(offset <= 7) {
            const config = this._currentConfig[current];
            
            if (!config) {
                this._log.warn(`No configuration for ${current}`);
                break;
            }
            
            const next = config.find(frame => {
                let ref = new Date(refDate.getTime());
                const from = Scheduler._dateFromPreset({
                    minutes: frame.start,
                    offsetDays: offset, 
                    refDate: ref
                });
                
                return from > refDate;
            });
            
            if (!!next) {
                return [offset, next];
            }

            current = current + 1;
            if (current > 7) {
                current = 1;
            }
            
            offset++;
        }
        
        return null;
    }

    /**
     * Returns a {@link Date} with preset hours and minutes, a possible day offset and a reference
     * date. Without any arguments, this function will return today at 00:00. 
     * 
     * @param [param] - Object describing the required date
     * @param [param.minutes] - The number of minutes to set for the date (0-59). Default is 0
     * @param [param.hours] - The number of hours to set for the date (0-23). Default is 0
     * @param [param.offsetDays] - The number of days to add to the reference date. Default is 0
     * @param [param.refDate] - The reference date to use. Default is today
     */
    private static _dateFromPreset({
        minutes,
        offsetDays,
        refDate
    }: {
        minutes?: number;
        offsetDays?: number;
        refDate?: Date
    }): Date {
        if (minutes === undefined) {
            minutes = 0;
        }
        
        let result = !!refDate ? new Date(refDate.getTime()) : new Date();
        let min = minutes % 60;
        let hours = Math.floor(minutes / 60)
        
        result.setDate(result.getDate() + (offsetDays || 0));
        result.setHours(hours || 0);
        result.setMinutes(min || 0);
        result.setSeconds(0);
        result.setMilliseconds(0);
        
        return result;
    }

    /**
     * @internal
     * 
     * Reads and validates the scheduler configuration from disk
     */
    private _readAndParseConfig(): void {
        if (!existsSync(this.configPath)) {
            throw new Error(`Config file ${this.configPath} not found`);
        }
        
        const content = readFileSync(this.configPath);
        let config: SchedulerConfig;

        try {
            config = JSON.parse(content.toString());
        } catch (err) {
            throw new Error(`Failed to parse configuration file ${this.configPath}: ${err}`);
        }
        
        this.setConfig(config);
    }
    
    private _setupInterval() {
        if (!!this._tickerSubscription) {
            this._tickerSubscription.unsubscribe();
            this._tickerSubscription = null;
        }
        
        this._tickerSubscription = this._ticker.interval(this.config.reconfigureInterval || 300)
            .subscribe(() => {
                if (this._pause) {
                    return;
                }
                
                const desiredState = this.getConfigForDate(new Date());
                this._log.info(`Desired door state is ${desiredState.state}ed until ${new Date(desiredState.until).toISOString()}`);
                this._state$.next(desiredState.state);
            });
    }
}
