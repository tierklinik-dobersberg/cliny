import {Plugin} from '@jsmon/core';
import {OpeningHoursController} from './openinghours.controller';
import {provideEntity} from '../database';
import {OpeningHour, TimeFrame} from './models';

@Plugin({
    providers: [
        OpeningHoursController,
        provideEntity(OpeningHour),
        provideEntity(TimeFrame),
    ]
})
export class OpeningHoursPlugin {}