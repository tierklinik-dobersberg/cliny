import {Injectable, Optional, Inject} from '@jsmon/core';
import {writeFileSync, readFileSync, existsSync} from 'fs';
import {join} from 'path';

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

export interface OverwriteConfig {
    until: Time;
    state: DoorState;
}

/**
 * Definition of the scheduler file format
 */
export interface SchedulerConfig {
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
export class Scheduler {
    private _config: Readonly<SchedulerConfig>|null = null;

    constructor(@Inject(SCHEDULER_FILE) @Optional() private _filePath?: string) {
        if (!this._filePath) {
            if (!process.env.HOME) {
                throw new Error(`Cannot determinate default location for the scheduler file`);
            }
            
            this._filePath = join(process.env.HOME!, '.door-controller.sched');
        }
        
        this._readAndParseConfig();
    }
    
    /**
     * Updates the scheduler configuration. May throw an error if
     * the configuration is invalid
     * 
     * @param cfg - The new scheduler configuration to use
     * @param [write] - Wether the new configuration file should be written to disk as well
     */
    public setConfig(cfg: SchedulerConfig, write: boolean = false): void {
        const configErrors = this._validateSchedulerConfig(cfg);
        if (configErrors.length > 0) {
            throw new Error(configErrors.join('; '));
        }
        
        this._config = Object.freeze(cfg);
        
        if (write) {
            const content = JSON.stringify(this._config!, undefined, 4);
            writeFileSync(this.configPath, content);
        }
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
    public getConfigForDate(date: Date): DoorState {
        const weekDay = date.getDay();
        const hour = date.getHours();
        const minutes = date.getMinutes();
        const currentTime: Time = [hour, minutes];


        // check if we have a overwrite config and if we are still in it's time-frame
        if (!!this.config.currentOverwrite && this.isTimeBefore(currentTime, this.config.currentOverwrite.until)) {
            return this.config.currentOverwrite.state;
        } else {
            // If we still have a overwrite but are after it's until time,
            // clear it
            if (!!this.config.currentOverwrite) {
                const copy: SchedulerConfig = {...this.config};
                copy.currentOverwrite = null;
                
                this.setConfig(copy, true);
            }
        }
        
        const currentDayConfig = this.config.unlockSchedules[this._getKeyFromWeekDay(weekDay)];

        // We now have to check a set of "unlock" time-frames and if we are in the middle of one
        const withinTimeFrame = currentDayConfig.some(frame => this.isInTimeFrame(hour, minutes, frame));

        if (withinTimeFrame) {
            return 'unlock';
        }
        
        return 'lock';
    }
    
    /**
     * Checks wether a time (t1) is before another time (t2)
     * 
     * @param t1 - The time to check if it's before t2
     * @param t2 - The reference time
     */
    public isTimeBefore(t1: Time, t2: Time): boolean {
        if (t1[TimeIndex.Hour] > t2[TimeIndex.Hour]) {
            return false;
        }
        
        if (t1[TimeIndex.Hour] === t2[TimeIndex.Hour] && t1[TimeIndex.Minute] > t2[TimeIndex.Minute]) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Checks wether a time (t1) is after another time (t2)
     * 
     * @param t1 - The time to check if it's after t2
     * @param t2 - The reference time
     */
    public isTimeAfter(t1: Time, t2: Time): boolean {
        if (t1[TimeIndex.Hour] < t2[TimeIndex.Hour]) {
            return false;
        }
        
        if (t1[TimeIndex.Hour] === t2[TimeIndex.Hour] && t1[TimeIndex.Minute] < t2[TimeIndex.Minute]) {
            return false;
        }
        
        return true;
    }


    /**
     * Checks if the given hours and minutes are within an specified time-frame
     * 
     * @param hour   - The current hour
     * @param minute - The current minute
     * @param frame  - The time frame to check against
     */
    public isInTimeFrame(hour: number, minute: number, frame: TimeFrame): boolean {
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
     * Returns the day key for {@link UnlockSchedule} based on the
     * week-day number
     * 
     * @param day - The number of the week-day (0-6)
     */
    private _getKeyFromWeekDay(day: number): keyof UnlockSchedule {
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
    
    /**
     * @internal 
     *
     * Validates a scheduler configuration and returns a list of possible errors
     * 
     * @param config - The scheduler configuration to validate
     */
    private _validateSchedulerConfig(config: SchedulerConfig): Error[] {
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
                    const frameErrors = this._isValidTimeFrame(frame);
                    if (!!frameErrors) {
                        result = result.concat(...frameErrors);
                    }
                });
            });
        }

        return result;
    }
    
    /**
     * @internal 
     *
     * Validates the times and the time-span of a {@link TimeFrame} for correctness
     * 
     * @param frame - The {@link TimeFrame} to validate
     */
    private _isValidTimeFrame(frame: TimeFrame): Error[]|null {
        let errors: Error[] = [];
        
        errors = errors.concat(...this._validateTime(frame.from, 'from'));
        errors = errors.concat(...this._validateTime(frame.to, 'to'));
        
        // Make sure that to is not before from
        
        const start = this._timeToMinutes(frame.from);
        const end = this._timeToMinutes(frame.to);

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
     * Converts a time into an absolute number of minutes (startin for 00:00)
     * 
     * @param time - The time to convert into minutes
     */
    private _timeToMinutes(time: Time): number {
        return 60 * time[TimeIndex.Hour]
                + time[TimeIndex.Minute];
    }
    
    /**
     * @internal 
     *
     * Validates a {@link Time} and returns a set of errors found
     * 
     * @param time - The time to validate
     * @param key  - The key to use for error messages (e.g. TimeFrame.${key}[hour|minute])
     */
    private _validateTime(time: Time, key: string): Error[] {
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
}