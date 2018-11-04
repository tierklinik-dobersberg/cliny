import { Injectable, Logger, Inject, Optional } from "@jsmon/core";
import { MailConfig, MAIL_CONFIG } from "./config";
import { createTransport } from "nodemailer";
import Mail from "nodemailer/lib/mailer";
import { MailOptions } from "nodemailer/lib/sendmail-transport";
import { ConfigService } from "../config";
import { MailTemplateService } from "./template.service";

@Injectable()
export class MailService {
    private _transport: Mail;
    private _enabled: boolean;
    
    constructor(private _log: Logger,
                private _templateService: MailTemplateService,
                @Optional() @Inject(MAIL_CONFIG) private _cfg: MailConfig,
                private _configService: ConfigService) {
        this._log = this._log.createChild('mail');
        
        if (this._cfg === undefined) {
            this._configService.getConfig<MailConfig>('mail')
                .then(cfg => {
                    if (!cfg) {
                        this._log.warn(`No email configuration provided. Disabling mail service`);
                        this._enabled = false;
                        return;
                    }

                    this._cfg = cfg;
                    this._setup();
                });
        } else {
            this._setup();
        }
    }

    private _setup() {
        try {
            this._transport = createTransport(this._cfg);
            this._enabled = true;
            
            this._log.info(`using "${this._cfg.auth!.user}" via "${this._cfg.host}"`);
        } catch (err) {
            this._log.error(err);
            this._enabled = false;
        }
    }

    /**
     * Sends a text message using the configured mail transport
     * 
     * @param to - One or more receipients in the format of either "name@domain.tld" or "Name <name@domain.tld>"
     * @param subject - The subject for the mail message
     * @param message  - The mail text message itself
     */
    sendMail(to: string|string[], subject: string, message: string, sender?: string): Promise<void> {
        if (!this._enabled) {
            this._log.warn(`E-Mail service disabled`);
            return Promise.reject('E-Mail service disabled');
        }
        
        const opts: MailOptions = {
            from: sender || this._cfg.sender,
            to: Array.isArray(to) ? to.join(' ,') : to,
            subject: subject,
            text: '',
            html: message
        };

        return this._transport.sendMail(opts)
    }
    
    async sendMailTemplate(to: string|string[], subject: string, template: string, context: any, sender?: string, defaultTemplate?: string): Promise<void> {
        const message = await this._templateService.compileTemplate(template, context, defaultTemplate);
        console.log(message);
        return await this.sendMail(to, subject, message, sender);
    }
}