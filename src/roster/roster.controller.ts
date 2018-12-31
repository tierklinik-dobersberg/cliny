import { Injectable, Logger } from '@jsmon/core';
import { Database } from '../database';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { RosterSchedule, Roster, IRoster, RosterScheduleType } from './models';
import moment from 'moment';
import { NotFoundError } from 'restify-errors';

@Injectable()
export class RosterController {
    public readonly ready: Promise<void>;
    private _resolve: () => void;
    private _rosterSchedulesRepo: Repository<RosterSchedule>;
    private _rosterRepo: Repository<Roster>;
    private _rosterTypesRepo: Repository<RosterScheduleType>;

    constructor(private _database: Database,
                private _log: Logger) {
        this._log = this._log.createChild('db:roster');
        
        this.ready = new Promise(resolve => this._resolve = resolve);
        this._setup();
    }
    
    async getTypes(): Promise<RosterScheduleType[]> {
        return await this._rosterTypesRepo.find();
    }
    
    async createType(name: string, color: string = ''): Promise<RosterScheduleType> {
        const type = new RosterScheduleType()
            .setType(name)
            .setColor(color);

        let result = await this._rosterTypesRepo.save(type);
        return result; 
    }
    
    async deleteType(id: string|number): Promise<void> {
        await this._rosterTypesRepo.delete({id: +id});
    }
    
    async editType(id: number, name: string, color: string = ''): Promise<RosterScheduleType> {
        const type = new RosterScheduleType()
            .setType(name)
            .setColor(color)
            .setID(id);

        let result = await this._rosterTypesRepo.save(type);
        return result;
    }
    
    async editSchedule(id: number, start: number, end: number, date: Date, users: string[], type: string|number, color: string|null = null): Promise<void> {
        return this.createSchedule(start, end, date, users, type, color, id);
    }
    
    async createSchedule(start: number, end: number, date: Date, users: string[], type: string|number, color: string|null = null, id?: number): Promise<void> {
        let m = moment(date);
        let isoCal = m.isoWeek();
        let year = date.getFullYear();
        let weekday = m.isoWeekday();

        try {
        
            let roster = await this._rosterRepo.findOne({where: {
                calendarWeek: `${isoCal}/${year}`,
            }});

            if (!roster) {
                let startDate = m.startOf('isoWeek').toDate();
                let endDate = m.endOf('isoWeek').toDate();

                roster = new Roster()
                    .setCalendarWeek(`${isoCal}/${year}`)
                    .setStartDate(startDate)
                    .setEndDate(endDate);
                    
                await this._rosterRepo.save(roster);
            }
            
            let rosterType: RosterScheduleType | undefined;
            if (typeof type === 'string') {
                rosterType = await this._rosterTypesRepo.findOne({type: type});
            } else {
                rosterType = await this._rosterTypesRepo.findOne({id: type});
            }
            
            if (rosterType === undefined) {
                throw new NotFoundError(`Invalid type for schedule`);
            }
            
            let schedule = new RosterSchedule()
                .setID(id)
                .setColor(color || '')
                .setEnd(end)
                .setStart(start)
                .setRoster(roster)
                .setType(rosterType)
                .setUsers(users.map(user => ({username: user}) as any))
                .setWeekDay(weekday);
                
            await this._rosterSchedulesRepo.save(schedule);
        } catch (err) {
            console.error(err);
            throw err;
        }
    }
    
    async getAllSchedules(): Promise<RosterSchedule[]> {
        return await this._rosterSchedulesRepo.find({relations: ['roster', 'type']});
    }
    
    async deleteSchedule(id: number) {
        await this._rosterSchedulesRepo.remove({id: id} as any);
    }
    
    async getSchedulesBetween(start: string|number|Date|moment.Moment, end: string|number|Date|moment.Moment): Promise<IRoster[]> {
        if (typeof start !== 'number') {
            start = moment(start).valueOf();
        }
        if (typeof end !== 'number') {
            end = moment(end).valueOf();
        }
        
        const rosters = await this._rosterRepo.find({
            where: {
                startDate: MoreThan(start - 1),
                endDate: LessThan(end + 1)
            },
            relations: ['schedules', 'schedules.users', 'schedules.type']
        });

        if (!rosters || rosters.length === 0) {
            return [];
        }
        
        return rosters.map(r => {
            return {
                ...r,
                schedules: r.schedules.map(s => {
                    return {
                        ...s,
                        users: s.users.map(u => {
                            return {
                                ...u,
                                icon: null,
                                iconData: null,
                            }
                        })
                    }
                })
            }
        });
    }
    
    private async _setup() {
        await this._database.ready;
        
        this._rosterRepo = this._database.getRepository(Roster);
        this._rosterSchedulesRepo = this._database.getRepository(RosterSchedule);
        this._rosterTypesRepo = this._database.getRepository(RosterScheduleType);
        

        // ensure we have at least one roster schedule type configured
        const countTypes = await this._rosterTypesRepo.count();
        
        if (countTypes === 0) {
            this._log.info(`Creating default roster schedule type: Default`);
            await this.createType('Default', '#f0f0f0');
        }

        this._resolve();
        this._log.info(`Roster database initialized`);
    }
}