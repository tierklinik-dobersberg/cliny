import { Injectable, Logger } from '@jsmon/core';
import { Database } from '../database';
import { OpeningHour, TimeFrame, ITimeFrame } from './models';
import { Repository, Transaction, TransactionRepository, LessThan, MoreThan } from 'typeorm';

export interface OpeningHourConfig {
    [day: number]: ITimeFrame[];
}

@Injectable()
export class OpeningHoursController {
    public readonly ready: Promise<void>;
    
    private _resolve: () => void;
    private _openingHoursRepo: Repository<OpeningHour>;
    private _timeFramesRepo: Repository<TimeFrame>;
    
    constructor(private _db: Database,
                private _log: Logger) {
                
        this._log = this._log.createChild('db:opening-hours');

        this.ready = new Promise(resolve => this._resolve = resolve);
        this._setup();
    }

    /**
     * Returns a list of time frames for a given weekday
     * 
     * @param weekday - The number of the week day to retrieve time frames for
     */
    public async getTimesForDay(weekday: number): Promise<ITimeFrame[]> {
        if (weekday < 0  || weekday > 6) {
            throw new Error(`Invalid week day`);
        }
        const day = await this._openingHoursRepo.findOne(weekday, {relations: ['times']});
        
        // TODO(ppacher): assert
        
        return day!.times;
    }
    
    /**
     * Adds a time frame to the opening hours of a given weekday
     * 
     * @param weekday - The number of the weekday (0 = sunday, 6 = saturday)
     * @param t - The time frame to add
     */
    public async addTimeFrame(weekday: number, t: ITimeFrame) {
        // check if we already have a time-frame that overlaps the new one
        let overlappingFrames = await this._timeFramesRepo!.find({
            where: {
                openingHour: {
                    weekDay: weekday
                },
                start: MoreThan(t.start),
                end: LessThan(t.end)
            }
        });
        
        if (overlappingFrames.length > 1) {
            this._log.warn(`Seems like there are multiple overlapping frames within the database`);
        }
        
        if (overlappingFrames.length > 0) {
            throw new Error(`Cannot add overlapping time frame. There is already one frame defined for ${overlappingFrames[0].start} -> ${overlappingFrames[0].end}`);
        }
        
        await this._timeFramesRepo!.save(
            new TimeFrame()
                .setEnd(t.end)
                .setStart(t.start)
                .setOpeningHour({weekDay: weekday} as any)
        );
    }

    /**
     * 
     * @param weekday - The number of the weekday (0 = sunday, 6 = saturday)
     * @param t - The time frame or ID of the timeframe to delete
     */
    public async deleteTimeFrame(weekday: number, t: ITimeFrame|number) {
        if (typeof t === 'number') {
            await this._timeFramesRepo.delete(t);
            return;
        }
        
        await this._timeFramesRepo.delete({start: t.start, end: t.end, openingHour: {weekDay: weekday}});
        return;
    }
    
    /**
     * Returns the current opening hour configuraiton from the database
     */
    public async getConfig(): Promise<OpeningHourConfig> {
        let all = await this._openingHoursRepo.find({relations: ['times']});
        
        let result: OpeningHourConfig = {};

        all.forEach(config => {
            console.log(`times`, config.times);
            result[config.weekDay] = config.times || [];
        });

        console.log(result);
        return result;
    }

    
    /**
     * @internal
     * 
     * Set up the database connection and perform maintainance tasks
     */
    private async _setup() {
        await this._db.ready;

        this._openingHoursRepo = this._db.getRepository(OpeningHour);
        this._timeFramesRepo = this._db.getRepository(TimeFrame);
        
        await this._ensureAllDays();

        this._resolve();
        this._log.info(`database initialized`);
    }
    
    /**
     * @internal
     * 
     * Ensures that the database contains an entry for each day of week
     */
    private async _ensureAllDays() {
        let all = await this._openingHoursRepo.find();

        if (all.length < 7) {
            this._log.info(`Need to insert missing days`);
            let toCreate: OpeningHour[] = [];

            for (let i = 0; i < 7; i++) {
                if (all.some(o => o.weekDay === i) === false) {
                    let h = new OpeningHour();
                    h.weekDay = i;
                    toCreate.push(h);
                }
            }
            
            await this._openingHoursRepo.save(toCreate);
        } else {
            this._log.info(`All days available`);
        }
    }
}
    