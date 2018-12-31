import { Logger } from "@jsmon/core";

export class Cache<K, V> {
    /**
     * @internal
     * Map holding all cached items by key
     */
    private readonly _byId: Map<K, V> = new Map();
    
    protected _log: Logger;

    constructor(public readonly name: string, logger: Logger) {
        this._log = logger.createChild(name);
    }

    /**
     * Adds a new key-value pair to the cache
     * 
     * @param key - The key for the cache item
     * @param value - The value to cache
     */
    add(key: K, value: V): this {
        this._byId.set(key, value);
        return this;
    }

    /**
     * Deletes a key-value pair from the cache. Returns
     * the value or undefined if the key did not exist
     * 
     * @param key - The key of the cache item
     */
    delete(key: K): V | undefined {
        const value = this._byId.get(key);
        if (!!value) {
            this._byId.delete(key);
        }

        return value || undefined;
    }

    /**
     * Returns a cached value by it's key
     * 
     * @param key - The key of the cache item
     */
    get(key: K): V | undefined {
        return this._byId.get(key) || undefined;
    }
}