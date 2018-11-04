import {Injectable, Inject, Optional} from '@jsmon/core';
import { ConfigService } from '../config';
import { MailConfig } from './config';
import { existsSync, statSync, readFileSync, readFile } from 'fs';
import { join, resolve as resolvePath } from 'path';
import { template, templateSettings } from 'dot';
import { Attachment } from 'nodemailer/lib/mailer';

export interface CompiledTemplate {
    content: string;
    attachments: Attachment[];
}

@Injectable()
export class MailTemplateService {
    private _templateDir: string;
    private _ready: Promise<void>;
    
    get ready(): Promise<void> {
        return this._ready;
    }

    constructor(private _configService: ConfigService) {
        this._ready = new Promise((resolve, reject) => {
            this._configService.getConfig<MailConfig>('mail')
                .then(cfg => {
                    if (!cfg || !cfg.templateDirectory) {
                        throw new Error(`Missing template directory or not mail configuration provided`);
                    }
                    
                    this._templateDir = resolvePath(cfg.templateDirectory);
                    this._checkTemplateDirectory();
                    resolve();
                })
                .catch(err => reject(err));
        });
    }
    
    async hasTemplate(name: string): Promise<boolean> {
        await this.ready;
        
        const path = join(this._templateDir, name);
        return existsSync(path);
    }
    
    async readTemplate(name: string, defaultTemplate?: string): Promise<string> {
        await this.ready;
        
        try {
            const path = join(this._templateDir, name);
            const data = readFileSync(path);
            return data.toString();
        } catch (err) {
            if (!!defaultTemplate) {
                return defaultTemplate;
            }
            
            throw err
        }
    }

    async compileTemplate(name: string, context: any, defaultTemplate?: string): Promise<CompiledTemplate> {
        const content = await this.readTemplate(name, defaultTemplate);
        const temp = template(content, {
            ...templateSettings,
            strip: false,
        });
        let compiledContent = temp(context);
        
        let attachments: Attachment[] = [];

        // search for all src="" attributes and create attachments and cids for them
        compiledContent = compiledContent.replace(/src\s*=\s*"(.+?)"/, (_, src) => {
            attachments.push({
                path: resolvePath(join(this._templateDir, src)),
                cid: src,
                filename: src,
            });
            
            return `src="cid:${src}"`;
        });
        
        attachments.forEach(attachment => {
            if (!existsSync(attachment.path as string)) {
                throw new Error(`Image "${attachment.path} not found"`);
            }
        })
        
        return {
            content: compiledContent,
            attachments: attachments,
        }
    }
    
    private _checkTemplateDirectory() {
        if (!existsSync(this._templateDir)) {
            throw new Error(`Template directory does not exist`);
        }
        
        const stat = statSync(this._templateDir);
        if (!stat.isDirectory()) {
            throw new Error(`Invalid template directory path. It's a file`);
        }
    }
}