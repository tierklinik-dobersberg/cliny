import { Injectable, Logger } from '@jsmon/core';
import { Database } from '../database';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { RostaSchedule, Rosta, IRosta, IRostaSchedule, RostaScheduleType } from './models';
import moment from 'moment';
import { NotFoundError } from 'restify-errors';

@Injectable()
export class RostaController {
    public readonly ready: Promise<void>;
    private _resolve: () => void;
    private _rostaSchedulesRepo: Repository<RostaSchedule>;
    private _rostaRepo: Repository<Rosta>;
    private _rostaTypesRepo: Repository<RostaScheduleType>;

    constructor(private _database: Database,
                private _log: Logger) {
        this._log = this._log.createChild('db:rosta');
        
        this.ready = new Promise(resolve => this._resolve = resolve);
        this._setup();
    }
    
    async getTypes(): Promise<RostaScheduleType[]> {
        return await this._rostaTypesRepo.find();
    }
    
    async createType(name: string, color: string = ''): Promise<RostaScheduleType> {
        const type = new RostaScheduleType()
            .setType(name)
            .setColor(color);

        let result = await this._rostaTypesRepo.save(type);
        return result; 
    }
    
    async deleteType(id: string|number): Promise<void> {
        await this._rostaTypesRepo.delete({id: +id});
    }
    
    async editType(id: number, name: string, color: string = ''): Promise<RostaScheduleType> {
        const type = new RostaScheduleType()
            .setType(name)
            .setColor(color)
            .setID(id);

        let result = await this._rostaTypesRepo.save(type);
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
        
            let rosta = await this._rostaRepo.findOne({where: {
                calendarWeek: `${isoCal}/${year}`,
            }});

            if (!rosta) {
                let startDate = m.startOf('isoWeek').toDate();
                let endDate = m.endOf('isoWeek').toDate();

                rosta = new Rosta()
                    .setCalendarWeek(`${isoCal}/${year}`)
                    .setStartDate(startDate)
                    .setEndDate(endDate);
                    
                await this._rostaRepo.save(rosta);
            }
            
            let rostaType: RostaScheduleType | undefined;
            if (typeof type === 'string') {
                rostaType = await this._rostaTypesRepo.findOne({type: type});
            } else {
                rostaType = await this._rostaTypesRepo.findOne({id: type});
            }
            
            if (rostaType === undefined) {
                throw new NotFoundError(`Invalid type for schedule`);
            }
            
            let schedule = new RostaSchedule()
                .setID(id)
                .setColor(color || '')
                .setEnd(end)
                .setStart(start)
                .setRosta(rosta)
                .setType(rostaType)
                .setUsers(users.map(user => ({username: user}) as any))
                .setWeekDay(weekday);
                
            await this._rostaSchedulesRepo.save(schedule);
        } catch (err) {
            console.error(err);
            throw err;
        }
    }
    
    async getAllSchedules(): Promise<RostaSchedule[]> {
        return await this._rostaSchedulesRepo.find({relations: ['rosta', 'type']});
    }
    
    async deleteSchedule(id: number) {
        await this._rostaSchedulesRepo.remove({id: id} as any);
    }
    
    async getSchedulesBetween(start: string|number|Date|moment.Moment, end: string|number|Date|moment.Moment): Promise<IRosta[]> {
        if (typeof start !== 'number') {
            start = moment(start).valueOf();
        }
        if (typeof end !== 'number') {
            end = moment(end).valueOf();
        }
        
        const rostas = await this._rostaRepo.find({
            where: {
                startDate: MoreThan(start - 1),
                endDate: LessThan(end + 1)
            },
            relations: ['schedules', 'schedules.users', 'schedules.type']
        });

        if (!rostas || rostas.length === 0) {
            return [];
        }
        
        return rostas;
    }
    
    private async _setup() {
        await this._database.ready;
        
        this._rostaRepo = this._database.getRepository(Rosta);
        this._rostaSchedulesRepo = this._database.getRepository(RostaSchedule);
        this._rostaTypesRepo = this._database.getRepository(RostaScheduleType);
        

        // ensure we have at least one rosta schedule type configured
        const countTypes = await this._rostaTypesRepo.count();
        
        if (countTypes === 0) {
            this._log.info(`Creating default rosta schedule type: Default`);
            await this.createType('Default', '#f0f0f0');
        }

        this._resolve();
        this._log.info(`Rosta database initialized`);
    }
}