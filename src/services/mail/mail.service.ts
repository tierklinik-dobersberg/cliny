import { Injectable, Logger, Inject, Optional } from "@jsmon/core";
import { MailConfig, MAIL_CONFIG } from "./config";
import { createTransport } from "nodemailer";
import Mail from "nodemailer/lib/mailer";
import { MailOptions } from "nodemailer/lib/sendmail-transport";

@Injectable()
export class MailService {
    private _transport: Mail;
    private _enabled: boolean;
    
    constructor(private _log: Logger,
                @Optional() @Inject(MAIL_CONFIG) private _cfg: MailConfig) {
        this._log = this._log.createChild('mail');
        
        if (this._cfg === undefined) {
            this._log.warn(`No email configuration provided. Disabling mail service`);
            this._enabled = false;
            return;
        }
        
        this._transport = createTransport(this._cfg);
    }

    /**
     * Sends a text message using the configured mail transport
     * 
     * @param to - One or more receipients in the format of either "name@domain.tld" or "Name <name@domain.tld>"
     * @param subject - The subject for the mail message
     * @param message  - The mail text message itself
     */
    sendMail(to: string|string[], subject: string, message: string): Promise<void> {
        if (!this._enabled) {
            this._log.warn(`E-Mail service disabled`);
            return Promise.reject('E-Mail service disabled');
        }
        
        const opts: MailOptions = {
            from: this._cfg.sender,
            to: Array.isArray(to) ? to.join(' ,') : to,
            subject: subject,
            text: message
        };

        return this._transport.sendMail(opts)
    }
}