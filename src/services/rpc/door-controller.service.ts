import { Injectable } from '@jsmon/core';
import { MqttService } from '@jsmon/net/mqtt';
import { IBoardController } from '../../door';
import { take, timeout } from 'rxjs/operators';

@Injectable()
export class DoorControllerRPC implements IBoardController {
    constructor(private _mqtt: MqttService) {}
    
    /** Sends a lock command via MQTT to the door controller */
    lock(): Promise<void> {
        return this._call('lock');
    }
    
    /** Sends an open command via MQTT to the door controller */
    open(): Promise<void> {
        return this._call('open');
    }
    
    /** Sends an unlock command via MQTT to the door controller */
    unlock(): Promise<void> {
        return this._call('unlock');
    }
    
    /**
     * @internal
     *
     * Sends a RPC request to the door controller using the MQTT service
     * 
     * @param method - The method to send
     * @param [timeoutMs] - An optional request timeout in milliseconds. Defaults to 10000
     */
    private _call(method: string, timeoutMs: number = 10000): Promise<void> {
        const reply = `cliny/rpc/response/${this._generateUUID()}`;

        return new Promise((resolve, reject) => { 
            this._mqtt.subscribe(reply)
                .pipe(
                    take(1),
                    timeout(timeoutMs),
                )
                .subscribe(([topic, payload]) => {
                    resolve();
                }, err => reject(err));
                
            this._mqtt.publish(`cliny/rpc/service/door/${method}`, Buffer.from(JSON.stringify({
                replyTo: reply
            })));
        });
    }

    /**
     * @internal
     * 
     * Generates a new random ID to be used in the reply topic
     */
    private _generateUUID(): string {
        const part = () => Math.random()
            .toString(36)
            .substr(2, 15);

        return part() + part();
    }
}