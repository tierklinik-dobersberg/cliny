import {Cache} from './base-cache';

export class LRUCache<K, V> extends Cache<K, V> {
    /** @internal - The maximum number of items allowed inside the cache */
    private _maxSize: number;

    /** @internal - List tracking how recent a cache entry has been touched */
    private _lru: K[] = [];

    constructor(name: string, max_size: number) {
        super(name);
    
        this._maxSize = max_size;
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
    get(key: K): V | undefined {
        const value = super.get(key);

        if (value !== undefined) {
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

        while(this._lru.length > this._maxSize) {
            let lastKey = this._lru[this._lru.length - 1];
            const value = this.delete(lastKey);

            if (!value) {
                console.warn(`LRU cache out of sync. Found key "${lastKey}" but no value`);
            } else {
                evicted.push([lastKey, value]);
            }
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
}