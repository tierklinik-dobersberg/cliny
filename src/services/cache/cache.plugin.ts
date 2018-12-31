import { Plugin } from '@jsmon/core';
import { CacheService } from './cache.service';

@Plugin({
    providers: [
        CacheService
    ]
})
export class CachePlugin {}