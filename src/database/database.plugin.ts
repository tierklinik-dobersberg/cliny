import {Plugin} from '@jsmon/core';
import {Database} from './database';

@Plugin({
    providers: [Database]
})
export class DatabasePlugin {}