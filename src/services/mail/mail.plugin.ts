import { Plugin, Provider } from '@jsmon/core';
import { MailConfig, MAIL_CONFIG } from './config';
import { MailService } from './mail.service';
import { provideConfigKey } from '../config';
import { MailTemplateService } from './template.service';

@Plugin({
    providers: [
        MailService,
        MailTemplateService,
        provideConfigKey('mail'),
    ]
})
export class MailServicePlugin {
    constructor(private _mail: MailService) {}
    
    /**
     * Returns a dependecy injection provider for the mail
     * configuration required by {@link MailService}
     * 
     * @param cfg - The mail configuration to use
     */
    static withConfig(cfg: MailConfig): Provider {
        return {
            provide: MAIL_CONFIG,
            useValue: cfg,
        };
    }
}