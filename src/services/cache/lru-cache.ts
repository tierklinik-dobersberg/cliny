import {Logger, OnDestroy} from '@jsmon/core';
import {Cache} from './base-cache';

export interface LRUCacheSettings<K, V> {
    maxSize?: number;
    maxAge?: number;
    gcTimeout?: number | null;
    loader?: (key: K, log: Logger) => Promise<V>;
}

export class LRUCache<K, V> extends Cache<K, V> implements OnDestroy {
    /** @internal - The maximum number of items allowed inside the cache */
    private _maxSize: number = Infinity;
    
    /** @internal - The maximum number of seconds a cache entry should be old */
    private _maxAge: number = Infinity;

    /** @internal - List tracking how recent a cache entry has been touched */
    private _lru: K[] = [];

    /** @internal - Tracks the creation time of cache entries */
    private _created: Map<K, number> = new Map();
    
    /** @internal - The next timeout to run gargbage collection */
    private _gcTimer: NodeJS.Timeout | null = null;
    
    /** @internal - The number of milliseconds between gc runs */
    private _gcTimeout: number | null = null;

    /** @internal - The loader function to use if an entry is not found inside the cache */
    private _loadFn?: (key: K, log: Logger) => Promise<V>;

    constructor(name: string, logger: Logger, {maxSize, maxAge, gcTimeout, loader}: LRUCacheSettings<K, V> = {}) {
        super(name, logger);
    
        this._maxSize = maxSize || Infinity;
        this._maxAge = maxAge || Infinity;

        if (gcTimeout !== null) {
            if (gcTimeout === undefined) {
                gcTimeout = 10 * 1000; // gcTimeout defaults to 10 seconds
            }
            this._gcTimeout = gcTimeout;
            
            this._setupGC();
        } else {
            this._gcTimeout = null;
        }

        if (!!loader) {
            this._loadFn = loader;
        }
    }

    onDestroy() {
        this.clear();
        
        if (this._gcTimer !== null) {
            clearTimeout(this._gcTimer);
            this._gcTimer = null;
        }
    }
    
    /** Removes all cache entries */
    clear() {
        super.clear();
        this._created.clear();
        this._lru = [];
    }

    /**
     * Adds a new key-value pair to the cache
     * 
     * @param key - The key of the cache value
     * @param value - The value to cache
     * @param [evict] - Whether or not the cache should be evicted
     */
    add(key: K, value: V, evict = true): this {
        super.add(key, value);
        this._created.set(key, new Date().getTime());

        this._updateKey(key);

        if (evict === true) {
            this.evict();
        }

        return this;
    }

    /**
     * Returns the cache value for the given key or undefined
     * 
     * @param key - The key of the cache item
     */
    async get(key: K): Promise<V | undefined> {
        let value = await super.get(key);
        let createdAt = this._created.get(key);

        // If the values is not cached but we have a loader function
        // use it 
        if (value === undefined && !!this._loadFn) {
            value = await this._loadFn(key, this._log);
            if (!!value) {
                this.add(key, value);
                createdAt = this._created.get(key)!;
            }
        }
        
        if (value !== undefined) {
            // if the cache entry expired, return undefined and remove it
            // from the cache
            if (createdAt! + this._maxAge < (new Date()).getTime()) {
                this._log.debug(`Cache entry "${key}" expired ${new Date().getTime() - (createdAt! + this._maxAge)} milliseconds ago`)
                this.delete(key);
                return undefined;
            }
            this._updateKey(key); 
        }

        return value;
    }

    /**
     * Deletes a cached key-value pair and returns the value
     * or undefined if the key was not cached at all
     * 
     * @param key - The key of the cache item
     */
    delete(key: K): V | undefined {
        const value = super.delete(key);
        this._created.delete(key);

        if (value !== undefined) {
            const index = this._lru.indexOf(key);
            if (index > -1) {
                this._lru.splice(index, 1);
            }
        }

        return value;
    }

    /**
     * Evicts the oldest used cache items until the cache size
     * is lower than the configured maximum number of entries
     * 
     * Evict is automatically called when addind new entries
     * and user should not need to care about calling evict()
     * themself
     */
    evict(): [K, V][] {
        let evicted: [K, V][] = [];

        const createdTimes = Array.from(this._created.entries());
        createdTimes.forEach(([key, created]) => {
            if (created + this._maxAge < (new Date()).getTime()) {
                const evictedValue = this.delete(key);
                if (!evictedValue) {
                    console.warn(`LRU cache out of sync. Found expired key "${key}" but no value`);
                } else {
                    evicted.push([key, evictedValue]);
                }
            }
        });

        while(this._lru.length > this._maxSize) {
            let lastKey = this._lru[this._lru.length - 1];
            const value = this.delete(lastKey);

            if (!value) {
                console.warn(`LRU cache out of sync. Found key "${lastKey}" but no value`);
            } else {
                evicted.push([lastKey, value]);
            }
        }

        if (evicted.length > 0) {
            this._log.debug(`Evicted ${evicted.length} items from cache: ${evicted.map(e => e[0]).join(', ')}`);
        }

        return evicted;
    }

    private _updateKey(key: K) {
        const existingIndex = this._lru.indexOf(key);
        if (existingIndex > -1) {
            this._lru.splice(existingIndex, 1);
        }

        this._lru.splice(0, 0, key);
    }

    private _setupGC() {
        if (this._gcTimeout === null) {
            return;
        }
        
        if (this._gcTimer !== null) {
            clearTimeout(this._gcTimer);
        }
        
        this._gcTimer = setTimeout(() => {
            this._log.debug(`running garbage collection ...`);
            this.evict();
            
            this._gcTimer = null;
            this._setupGC();
        }, this._gcTimeout);
    }
}