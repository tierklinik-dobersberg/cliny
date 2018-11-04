import {Injectable, Inject, Optional} from '@jsmon/core';
import { ConfigService } from '../config';
import { MailConfig } from './config';
import { existsSync, statSync, readFileSync, readFile } from 'fs';
import { join, resolve } from 'path';
import { template, templateSettings } from 'dot';

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
                    
                    this._templateDir = cfg.templateDirectory;
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

    async compileTemplate(name: string, context: any, defaultTemplate?: string): Promise<string> {
        const content = await this.readTemplate(name, defaultTemplate);
        const temp = template(content, {
            ...templateSettings,
            strip: false,
        });
        return temp(context);
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