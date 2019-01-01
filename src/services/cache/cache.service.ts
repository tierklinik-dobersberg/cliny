import { Injectable, OnDestroy, Logger } from '@jsmon/core';
import { LRUCache, LRUCacheSettings } from './lru-cache';
import { Cache } from './base-cache';

@Injectable()
export class CacheService implements OnDestroy {
    private _lrus: Map<string, LRUCache<any, any>> = new Map();

    constructor(private _log: Logger) {
        this._log = this._log.createChild(`cache`);
    }
    
    onDestroy() {
        // Call the OnDestroy method of all LRU caches
        this._lrus.forEach(cache => {
            cache.onDestroy();
        });
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
            if (this._lrus.has(name)) {
                return this._lrus.get(name)!;
            }
            
            const newCache = new LRUCache(name, this._log, opt);
            
            this._lrus.set(name, newCache);
            
            return newCache;
        case 'basic':
            return new Cache(name, this._log);
        }
        
        throw new Error(`Unsupported cache type "${type}"`);
    }
}