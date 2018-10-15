import {Injectable, Optional, Inject, Logger, NoopLogAdapter, OnDestroy} from '@jsmon/core';
import {writeFileSync, readFileSync, existsSync} from 'fs';
import {Subscription, Subject, Observable} from 'rxjs';
import {join} from 'path';
import {Ticker} from './ticker';

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

/**
 * TimeFrame represents a span between a start and end time
 */
export interface TimeFrame {
    /**
     * Beginning of the time frame
     */
    from: Time;
    
    /**
     * End of the time frame
     */
    to: Time;
}

/**
 * Injection token for the scheduler file path
 */
export const SCHEDULER_FILE = 'SCHEDULER_FILE';

export interface UnlockSchedule {
    monday: TimeFrame[];
    tuesday: TimeFrame[];
    wednesday: TimeFrame[];
    thursday: TimeFrame[];
    friday: TimeFrame[];
    saturday: TimeFrame[];
    sunday: TimeFrame[];
}

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
    until: Time;
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

    // The default schedules to unlock the door based
    // on a per week-day basis
    unlockSchedules: UnlockSchedule;
    
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

    constructor(private _ticker: Ticker,
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
        
        this._readAndParseConfig();
    }
    
    public pause(pause: boolean) {
        this._pause = pause;
    }
    
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
        const configErrors = Scheduler.validateSchedulerConfig(cfg);
        if (configErrors.length > 0) {
            throw new Error(configErrors.join('; '));
        }

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
    }
    
    /**
     * Configures the current overwrite configuration
     * 
     * @param state - The desired door state for the overwrite
     * @param until - Time until the overwrite is valid and should be applied
     * @param safeConfig  - Whether or not the config should be safed to disk
     */
    public setOverwrite(state: DoorState, until: Time, safeConfig: boolean = true): void {
        const copy = this.copyConfig();

        copy.currentOverwrite = {
            state: state,
            until: until,
        };
        
        this.setConfig(copy, safeConfig);
    }
    
    /**
     * Adds a new unlock time-frame for a given weekday and optionally saves the configuration
     * file to disk
     * 
     * @param day - The number or name of the weekday to add a new time frame to
     * @param frame - The time frame to add to the weekday
     * @param [saveConfig] - Wether or not the config should be safed to disk (defaults to true)
     */
    public addTimeFrame(day: number|keyof UnlockSchedule, frame: TimeFrame, saveConfig: boolean = true): void {
        if (typeof day === 'number') {
            day = Scheduler._getKeyFromWeekDay(day);
        }
        
        const schedule = this.config.unlockSchedules[day];
        
        // we can assert that the must already exist in the scheduler configuration
        if (schedule === undefined) {
            throw new Error(`${day} does not exist in config.unlockSchedules`);
        }
        
        // check if there is any time frame that overlaps the new one
        const fromOverlaps = schedule.some(ref => Scheduler.isInTimeFrame(frame.from[TimeIndex.Hour], frame.from[TimeIndex.Hour], ref));
        const toOverlaps = schedule.some(ref => Scheduler.isInTimeFrame(frame.to[TimeIndex.Hour], frame.to[TimeIndex.Minute], ref));
        
        if (fromOverlaps || toOverlaps) {
            throw new Error(`The "${fromOverlaps ? 'from' : 'to'}" time overlaps with an existing time-frame`);
        }
        
        const copy = this.copyConfig();
        
        copy.unlockSchedules[day].push(frame);
        
        this.setConfig(copy, saveConfig);
    }
    
    /**
     * Delete a unlock time frame from a given weekday
     * 
     * @param day - The number of the name of the weekday
     * @param timeFrame  - The time frame to delete
     * @param safeConfig  - Whether or not the new configuration should be safed
     */
    public deleteSchedule(day: number|keyof UnlockSchedule, timeFrame: TimeFrame, safeConfig: boolean = true): void {
        if (typeof day === 'number') {
            day = Scheduler._getKeyFromWeekDay(day);
        }
        
        const schedule = this.config.unlockSchedules[day];

        if (schedule === undefined) {
            throw new Error(`${day} does not exist in config.unlockSchedules`);
        }
        
        if (schedule.length === 0) {
            return;
        }        
        
        const copy = this.copyConfig();
        copy.unlockSchedules[day] = copy.unlockSchedules[day].filter(frame => {
            return !(frame.to[TimeIndex.Hour] === timeFrame.to[TimeIndex.Hour] &&
                   frame.to[TimeIndex.Minute] === timeFrame.to[TimeIndex.Minute] &&
                   frame.from[TimeIndex.Hour] === timeFrame.from[TimeIndex.Hour] &&
                   frame.from[TimeIndex.Minute] === timeFrame.from[TimeIndex.Minute]);
        });

        this.setConfig(copy, safeConfig);
    }
    
    /**
     * Removes all unlock schedules from a given weekday and optionally safes the configuration
     * 
     * @param day - The number or name of the weekday
     * @param safeConfig 
     */
    public clearWeekdayConfig(day: number|keyof UnlockSchedule, safeConfig: boolean = true): void {
        if (typeof day === 'number') {
            day = Scheduler._getKeyFromWeekDay(day);
        }
        
        const schedule = this.config.unlockSchedules[day];

        // We can assert that there must at least be an empty array
        if (schedule === undefined) {
            throw new Error(`${day} does not exist in config.unlockSchedules`)
        }
        
        // Bail out if there is nothing to do
        if (schedule.length === null) {
            return;
        }
        
        const copy = this.copyConfig();
        copy.unlockSchedules[day] = [];

        this.setConfig(copy, safeConfig);
    }
    
    /**
     * Returns a writeable copy of the current configuration
     */
    public copyConfig(): SchedulerConfig {
        return {
            reconfigureInterval: this.config.reconfigureInterval,
            unlockSchedules: { ... this.config.unlockSchedules },
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
        const weekDay = date.getDay();
        const hour = date.getHours();
        const minutes = date.getMinutes();
        const currentTime: Time = [hour, minutes];
        
        let currentState: DoorState = 'lock';
        let until: Date;
        let isOverride: boolean = false;

        const toDate = (t: Time, dateOffset?: number) => {
            let now = new Date();
            now.setMilliseconds(0),
            now.setSeconds(0);
            now.setHours(t[TimeIndex.Hour]);
            if (dateOffset !== undefined) {
                now.setDate(now.getDate() + dateOffset);
            }
            now.setMinutes(t[TimeIndex.Minute]);
            
            return now;
        }

        // check if we have a overwrite config and if we are still in it's time-frame
        if (!!this.config.currentOverwrite && Scheduler.isTimeBefore(currentTime, this.config.currentOverwrite.until)) {
            currentState = this.config.currentOverwrite.state;
            isOverride = true;

            until = toDate(this.config.currentOverwrite.until);
        } else {
            // If we still have a overwrite but are after it's until time,
            // clear it
            if (!!this.config.currentOverwrite) {
                const copy: SchedulerConfig = {...this.config};
                copy.currentOverwrite = null;
                
                this.setConfig(copy, true);
            }
            
            const currentDayConfig = this.config.unlockSchedules[Scheduler._getKeyFromWeekDay(weekDay)];

            // We now have to check a set of "unlock" time-frames and if we are in the middle of one
            const currentTimeFrame = currentDayConfig.find(frame => Scheduler.isInTimeFrame(hour, minutes, frame));

            if (!!currentTimeFrame) {
                currentState = 'unlock';
                until = toDate(currentTimeFrame.to);
            } else {
                currentState = 'lock';
                const next = this._getNextFrame(date);
                
                if (next === null) {
                    until = null as any;
                } else {
                    let [dayOffset, untilTime] = next;
                    until = toDate(untilTime.from, dayOffset);
                }
            }
        }
        
        return {
            state: currentState,
            until: until!.getTime(),
            untilISO: until!.toISOString(),
        };
    }
    
    /**
     * Searches for the next time-frame that becomes active
     * 
     * @param refDate - The reference date to use
     */
    private _getNextFrame(refDate: Date): [number, TimeFrame]|null {
        let current = refDate.getDay();
        let offset = 0;
        while(offset <= 6) {
            const name = Scheduler._getKeyFromWeekDay(current);
            const config = this.config.unlockSchedules[name];
            
            const next = config.find(frame => {
                let ref = new Date(refDate.getTime());
                const from = Scheduler._dateFromOffset(frame.from[TimeIndex.Minute], frame.from[TimeIndex.Hour], offset, ref);
                
                return from > refDate;
            });
            
            if (!!next) {
                return [offset, next];
            }

            current = (current + 1) % 7;
            offset++;
        }
        
        return null;
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
     * Checks wether a time (t1) is before another time (t2)
     * 
     * @param t1 - The time to check if it's before t2
     * @param t2 - The reference time
     */
    public static isTimeBefore(t1: Time, t2: Time): boolean {
        const min1 = Scheduler._toTimestamp(t1);
        const min2 = Scheduler._toTimestamp(t2);

        return min1 < min2;
    }
    
    /**
     * Checks wether a time (t1) is after another time (t2)
     * 
     * @param t1 - The time to check if it's after t2
     * @param t2 - The reference time
     */
    public static isTimeAfter(t1: Time, t2: Time): boolean {
        const min1 = Scheduler._toTimestamp(t1);
        const min2 = Scheduler._toTimestamp(t2);

        return min1 > min2;
    }


    /**
     * Checks if the given hours and minutes are within an specified time-frame
     * 
     * @param hour   - The current hour
     * @param minute - The current minute
     * @param frame  - The time frame to check against
     */
    public static isInTimeFrame(hour: number, minute: number, frame: TimeFrame): boolean {
        if (hour < frame.from[TimeIndex.Hour]) {
            return false;
        }
        
        if (hour === frame.from[TimeIndex.Hour] && minute < frame.from[TimeIndex.Minute]) {
            return false;
        }
        
        if (hour > frame.to[TimeIndex.Hour]) {
            return false;
        }
        
        if (hour === frame.to[TimeIndex.Hour] && minute > frame.to[TimeIndex.Minute]) {
            return false;
        }
        
        // We are in the middle of the specified time frame
        return true;
    }
    
    /**
     * Validates a scheduler configuration and returns a list of errors if any
     * 
     * @param config - The scheduler configuration to validate
     */
    public static validateSchedulerConfig(config: SchedulerConfig): Error[] {
        let result: Error[] = [];
        
        if (!config.unlockSchedules) {
            result.push(new Error(`Missing "unlockSchedules" configuration`));
        } else {
            const days: (keyof UnlockSchedule)[]= [
                'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
            ];
            
            days.forEach(key => {
                const frames = config.unlockSchedules[key];
                if (frames === undefined || frames === null) {
                    result.push(new Error(`No unlock schedule for ${key} defined. Use [] to signal no unlock-schedules`));
                    return;
                }
                
                frames.forEach(frame => {
                    const frameErrors = Scheduler.isValidTimeFrame(frame);
                    if (!!frameErrors) {
                        result = result.concat(...frameErrors);
                    }
                });
            });
        }

        return result;
    }
    
    /**
     * Validates the times and the time-span of a {@link TimeFrame} for correctness
     * 
     * @param frame - The {@link TimeFrame} to validate
     */
    public static isValidTimeFrame(frame: TimeFrame): Error[]|null {
        let errors: Error[] = [];
        
        errors = errors.concat(...Scheduler.validateTime(frame.from, 'from'));
        errors = errors.concat(...Scheduler.validateTime(frame.to, 'to'));
        
        // Make sure that to is not before from
        
        const start = Scheduler._toTimestamp(frame.from);
        const end = Scheduler._toTimestamp(frame.to);

        if (end < start) {
            errors.push(new Error(`invalid time frame. "to" MUST NOT be before "from"`));
        }
        
        if (end === start) { 
            errors.push(new Error(`invalid time frame. "to" MUST NOT be equal to "from"`));
        }
        
        return errors.length === 0 ? null : errors;
    }
    
    /**
     * @internal 
     *
     * Converts a time into an absolute number of minutes (starting form 00:00)
     * 
     * @param time - The time to convert into minutes
     */
    private static _toTimestamp(time: Time): number {
        return Scheduler._dateFromOffset(time[TimeIndex.Minute], time[TimeIndex.Hour]).getTime();
    }

    private static _dateFromOffset(minutes = 0, hours = 0, days = 0, ref = new Date()): Date {
        ref.setDate(ref.getDate() + (days || 0));
        ref.setHours(hours || 0);
        ref.setMinutes(minutes || 0);
        ref.setSeconds(0);
        ref.setMilliseconds(0);
        
        return ref;
    }
    
    /**
     * Validates a {@link Time} and returns a set of errors found
     * 
     * @param time - The time to validate
     * @param key  - The key to use for error messages (e.g. TimeFrame.${key}[hour|minute])
     */
    public static validateTime(time: Time, key: string): Error[] {
        const errors: Error[] = [];
        const [hour, minute] = [time[TimeIndex.Hour], time[TimeIndex.Minute]];

        if (hour < 0) {
            errors.push(new Error(`TimeFrame.${key}[hour] MUST be positive; got "${hour}"`));
        }
        if (minute < 0) {
            errors.push(new Error(`TimeFrame.${key}[minute] MUST be positive; got "${minute}"`));
        }
        
        return errors;
    }

    /**
     * @internal
     * 
     * Returns the day key for {@link UnlockSchedule} based on the
     * week-day number
     * 
     * @param day - The number of the week-day (0-6)
     */
    private static _getKeyFromWeekDay(day: number): keyof UnlockSchedule {
        switch(day) {
            case 0:
                return 'sunday';
            case 1:
                return 'monday';
            case 2:
                return 'tuesday';
            case 3:
                return 'wednesday';
            case 4:
                return 'thursday';
            case 5:
                return 'friday';
            case 6:
                return 'saturday';
            default:
                throw new Error(`Invalid week day number: ${day}`);
        }
    }
    
    private static _getNumberFromKey(day: keyof UnlockSchedule): number {
        let keys: (keyof UnlockSchedule)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        return keys.indexOf(day);
    }

    /**
     * @internal
     * 
     * Reads and validates the scheduler configuration
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