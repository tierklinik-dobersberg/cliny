import { Injectable, Logger } from '@jsmon/core';
import { HttpClientFactory, HttpClient } from '@jsmon/net/http/client';
import { CacheService, Cache } from '../cache';
import { ConfigService } from '../config';

const baseURL = 'https://date.nager.at';
const apiFormat = '/api/v1/get/{{country}}/{{year}}';

export function getHolidayAPIURL(country: string, year: string) {
    return apiFormat
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
    private _http: HttpClient;

    constructor(private _log: Logger,
                private _config: ConfigService,
                private _httpClientFactory: HttpClientFactory,
                private _cacheService: CacheService) {
        
        this._http = this._httpClientFactory.create('holidays', baseURL);

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
                        
                        // we'll definitely need the holiday list for this year so fetch it right away
                        this.getHolidaysForYear((new Date()).getFullYear());
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
            this._log.debug(`Using cached holiday list for ${this._country} in ${year}`);
            return holidays;
        }
        
        const url = getHolidayAPIURL(this._country, ''+year);
        
        try {
            const response = await this._http.get<Holiday[]>(url);
            this._log.debug(`Received holiday list for ${this._country} in ${year} with ${response.length} entries`);
            this._cache.add(year, response);
            
            return response;
        } catch (err) {
            this._log.error(`Failed to retrieve holiday list for ${this._country} in ${year}`);
            return [];
        }
    }
}