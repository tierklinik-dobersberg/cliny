import {SchedulerConfig, Scheduler, UnlockSchedule} from './scheduler';
import {writeFileSync, unlinkSync, existsSync, write} from 'fs';
import {randomBytes} from 'crypto';
import {join} from 'path';
import {Ticker} from './ticker';

function getRandomFileName(): string {
    while(true) {
        let name = join('/tmp', randomBytes(10).readUInt32LE(0) + '');
        
        if (!existsSync(name)) {
            return name;
        }
    }
}

function getValidConfig(): SchedulerConfig {
    return {
        unlockSchedules: {
            monday: [
                { from: [8, 0], to: [12, 0] },
            ],
            tuesday: [
                { from: [8, 0], to: [12, 0] },
            ],
            wednesday: [
                { from: [8, 0], to: [12, 0] },
            ],
            thursday: [
                { from: [8, 0], to: [12, 0] },
            ],
            friday: [
                { from: [8, 0], to: [12, 0] },
            ],
            saturday: [
                { from: [8, 0], to: [12, 0] },
            ],
            sunday: [
                { from: [8, 0], to: [12, 0] },
            ],
        },
        currentOverwrite: null
    };
}

describe('Scheduler', () => {
    let configPath: string;
    
    function prepareJSONConfig(cfg: any) {
        writeFileSync(configPath, JSON.stringify(cfg, undefined, 4));
    }
    
    function prepareConfig(cfg: any) {
        writeFileSync(configPath, cfg);
    }

    beforeAll(() => {
        configPath = getRandomFileName();
    });

    // Delete our configuration file
    afterEach(() => {
        try { unlinkSync(configPath) } catch (e) {}
    });

    describe('should throw', () => {
        it('for missing config file', () => {
            expect(() => new Scheduler(new Ticker(), '/tmp/foobar')).toThrow();
        });

        it('for missing default config file', () => {
            const HOME = process.env.HOME;
            process.env.HOME = '/tmp';
            expect(() => new Scheduler(new Ticker())).toThrow();
            process.env.HOME = HOME;
        });
        
        
        describe('for invalid config file with ', () => {
            it('invalid JSON', () => {
                prepareConfig("");

                expect(() => new Scheduler(new Ticker(), configPath)).toThrow();
            });
            
            const days: (keyof UnlockSchedule)[]= [
                'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
            ];
            
            let valid: any;
            
            beforeEach(() => {
                valid = getValidConfig();
            });

            days.forEach(day => {
                describe(`invalid "${day}" config`, () => {
                    it(`schedule set to null`, () => {
                        valid.unlockSchedules[day] = null;
                        prepareJSONConfig(valid);

                        expect(() => new Scheduler(new Ticker(), configPath)).toThrow();
                    });
                    
                    it(`missing schedule`, () => {
                        delete valid.unlockSchedules[day];
                        prepareJSONConfig(valid);

                        expect(() => new Scheduler(new Ticker(), configPath)).toThrow();
                    });
                    
                    it(`schedule includes invalid time-frame`, () => {
                        valid.unlockSchedules[day] = [
                            {
                                from: [8, 0],
                                to: [7, 0],
                            }
                        ];
                        prepareJSONConfig(valid);

                        expect(() => new Scheduler(new Ticker(), configPath)).toThrow();
                    });
                });
            });
        });
    });
});