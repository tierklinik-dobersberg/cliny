import { InjectionToken } from "@jsmon/core";
import { Options } from 'nodemailer/lib/smtp-transport';

export const MAIL_CONFIG = new InjectionToken<MailConfig>('MAIL_CONFIG');

export interface MailConfig extends Options {
    sender: string;
}
