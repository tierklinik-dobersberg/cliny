import {Request} from 'restify';

export class Context {
    private _values: {[key: string]: any} = {};

    get<T>(name: string): T|undefined {
        return this._values[name];
    }
    
    set(name: string, value: any): this {
        this._values[name] = value;
        
        return this;
    }
}

declare module 'restify' {
    interface Request {
        context?: Context;
    }
}

export function getContext(request: Request): Context {
    let context: Context|undefined =  request.context;

    if (!context) {
        context = new Context();
        request.context = context;
    }
    
    return context;
}
  