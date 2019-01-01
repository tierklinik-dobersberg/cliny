import { Injectable, OnDestroy, Logger } from '@jsmon/core';
import { LRUCache, LRUCacheSettings } from './lru-cache';
import { Cache } from './base-cache';

@Injectable()
export class CacheService implements OnDestroy {
    constructor(private _log: Logger) {
        this._log = this._log.createChild(`cache`);
    }
    
    onDestroy() {
    
    }
    
    /**
     * Creates a new LRU cache instance
     * 
     * @param type - The type of the cache. 'lru' or 'basic'
     * @param name - The name of the cache instance (for logging purposes)
     * @param options - Configuration options for the LRUCache
     */
    create<K = any, V = any>(type: 'lru', name: string, options: LRUCacheSettings<K, V>): LRUCache<K, V>;
    
    /**
     * Creates a new basic cache
     * 
     * @param type - The type of the cache. 'lru' or 'basic'
     * @param name - The name of the cache instance (for logging purposes)
     */
    create<K = any, V = any>(type: 'basic', name: string): Cache<K, V>;
    

    create(type: string, name: string, opt?: any) {
        switch (type) {
        case 'lru':
            return new LRUCache(name, this._log, opt);
        case 'basic':
            return new Cache(name, this._log);
        }
        
        throw new Error(`Unsupported cache type "${type}"`);
    }
}