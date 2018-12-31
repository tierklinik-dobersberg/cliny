import { Injectable, Logger } from '@jsmon/core';
import { CacheService, Cache } from '../cache';
import { ConfigService } from '../config';

const baseURL = 'https://date.nager.at/api/v1/get/{{country}}/{{year}}';

export function getHolidayAPIURL(country: string, year: string) {
    return baseURL
        .replace('{{country}}', country)
        .replace('{{year}}', year);
}

export interface HolidaysServiceConfig {
    /** Whether or not the holidays API should be enabled */
    enabled?: boolean;
    
    /** The two-letter country code to use for loading public holidays. Defaults to Austria (AT) */
    country?: string;
}

export interface Holiday {
    date: string;
    localName: string;
    name: string;
    countryCode: string;
    fixed: boolean;
    countyOfficialHoliday: boolean; // seems like a typo in the upstream service
    countyAdministrationHoliday: boolean; // seems like a type in the upstream service
    global: boolean;
    countries: string[],
    launchYear: number;
}

@Injectable()
export class HolidayService {
    private _cache: Cache<number, Holiday[]>;
    private _enabled: boolean = true;
    private _country: string = 'AT';

    constructor(private _log: Logger,
                private _config: ConfigService,
                private _cacheService: CacheService) {
                
        this._config.getConfig<HolidaysServiceConfig>('holidays')
                    .then(cfg => {
                        if (!!cfg) {
                            this._enabled = cfg.enabled || true;
                            this._country = cfg.country || this._country;
                        }
                        
                        if (!!this._enabled && (!this._country || this._country.length !== 2)) {
                            this._log.error(`Invalid country configured for holidays API. Expected a two-letter country code but got "${this._country}"`)
                            this._enabled = false;
                        }
                        
                        if (!!this._enabled) {
                            this._log.info(`Holidays API configured for country ${this._country}`);
                        } else {
                            this._log.warn(`Holidays API disabled`);
                        }
                    });

        // There's no need to cache more than two years of holidays
        this._cache = this._cacheService.create('lru', 'holidaysByYear', {
            maxSize: 2,
        });

        this._log = this._log.createChild(`holidays`);
    }
                
    async getHolidaysForYear(year: number): Promise<Holiday[]> {
        if (!this._enabled) {
            return [];
        }
        
        const holidays = this._cache.get(year);    
        
        if (holidays !== undefined) {
            return holidays;
        }
        
        throw new Error(`not yet implemented`);
    }
}