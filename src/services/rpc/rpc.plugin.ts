import { Plugin, Provider } from '@jsmon/core';
import { MqttPlugin, MQTT_BROKER_URL } from '@jsmon/net/mqtt';
import { DoorControllerRPC } from './door-controller.service';
import { provideConfigKey } from '../config';

@Plugin({
    providers: [
        DoorControllerRPC,
        provideConfigKey('mqtt')
    ],
    exports: [
        //MqttPlugin
    ]
})
export class RPCPlugin {
    static useMQTTBroker(url: string): Provider {
        return {
            provide: MQTT_BROKER_URL,
            useValue: url
        };
    }
}