import {Injectable, Inject, Optional} from '@jsmon/core';
import { ConfigService } from '../config';
import { MailConfig } from './config';
import { existsSync, statSync, readFileSync, readFile } from 'fs';
import { join, resolve as resolvePath } from 'path';
import { template, templateSettings } from 'dot';
import { Attachment } from 'nodemailer/lib/mailer';

/**
 * CompiledTemplate represents a mail template that
 * has been compiled and all referenced images has been
 * embedded using mail attachments
 */
export interface CompiledTemplate {
    /** The compiled content of the template */
    content: string;
    
    /** Attachments for the template that includes embedded images */
    attachments: Attachment[];
}

@Injectable()
export class MailTemplateService {
    /**
     * @internal
     * The path of the template directory. Will be resolved to an absolute path
     * within the constructor
     */
    private _templateDir: string;
    
    /**
     * @internal
     * Resolved when the template service is ready. May reject the promise if
     * something goes wront
     */
    private _ready: Promise<void>;
    
    /**
     * @internal
     * A cache map that stores read templates before they are compiled
     */
    private readonly _templateCache: Map<string, string> = new Map();
    
    /**
     * Resolved when the template service is ready. May reject the promise if
     * something goes wront
     */
    get ready(): Promise<void> {
        return this._ready;
    }

    constructor(private _configService: ConfigService) {
        this._ready = new Promise(async (resolve, reject) => {
            try {
                let cfg = await this._configService.getConfig<MailConfig>('mail');
                if (!cfg || !cfg.templateDirectory) {
                    throw new Error(`Missing template directory or not mail configuration provided`);
                }
                
                this._templateDir = resolvePath(cfg.templateDirectory);
                this._checkTemplateDirectory();
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }
    
    /**
     * Checks wether a template name exists in the template cache
     * or in the filesystem
     * 
     * @param name - The name of the template
     */
    async hasTemplate(name: string): Promise<boolean> {
        if (this._templateCache.has(name)) {
            return true;
        }
        
        await this.ready;
        
        const path = join(this._templateDir, name);
        return existsSync(path);
    }
    
    /**
     * Returns the content of a template either from cache or from the filesystem
     * If a default template is provided it will be returned in case no such template
     * could be found. Otherwise an error is thrown.
     *
     * If the template is read from the filesystem it will be cache in memory for further
     * use.
     * 
     * @param name - The name of the template
     * @param [defaultTemplate] - An optional default template to use
     */
    async readTemplate(name: string, defaultTemplate?: string): Promise<string> {
        await this.ready;
        
        if (this._templateCache.has(name)) {
            return this._templateCache.get(name)!;
        }
        
        try {
            const path = join(this._templateDir, name);
            const data = readFileSync(path);
            const content = data.toString();
            
            this._templateCache.set(name, content);
            
            return data.toString();
        } catch (err) {
            if (!!defaultTemplate) {
                // we do not cache default templates because it does not make any performance
                // improvements and will prevent us from picking up templates that have been 
                // added during runtime
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