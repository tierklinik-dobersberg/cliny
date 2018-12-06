import { Injectable, Logger } from '@jsmon/core';
import { ConfigService } from '../config';
import { google, GoogleApis } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { readFile, readFileSync, fstat, writeFileSync } from 'fs';
import readline from 'readline';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = 'token.json';

@Injectable()
export class GoogleAuthorizationService {
    private _client: OAuth2Client | null = null;

    constructor(private _configService: ConfigService,
                private _log: Logger) {
        this._log = this._log.createChild(`google:auth`);
    }
    
    async authorize(): Promise<OAuth2Client> {
        if (this._client !== null) {
            return this._client;
        }
        
        const content = readFileSync('google-credentials.json');
        const creds = JSON.parse(content.toString());
        const client = await this._authorize(creds);
        this._log.info(`Successfully authenticated against Google`);
        
        this._client = client;
        
        return client;
    }
    
    private _authorize(credentials: any): Promise<OAuth2Client>  {
        const { client_secret, client_id, redirect_uris } = credentials.installed;

        const oAuth2Client = new google.auth.OAuth2(
            client_id, client_secret, redirect_uris[0]
        );
        
        return new Promise<OAuth2Client>((resolve, reject) => {
            readFile(TOKEN_PATH, (err, token) => {
                if (!!err) {
                    this._getAccessToken(oAuth2Client)
                        .then(() => resolve(oAuth2Client))
                        .catch(err => {
                            this._log.error(`Failed to get access token for Google authentication`);
                            reject(err);
                        });
                } else {
                    oAuth2Client.setCredentials(JSON.parse(token.toString()));
                    resolve(oAuth2Client);
                }
            });
        });
    }

    private _getAccessToken(client: OAuth2Client): Promise<void> {
        const authUrl = client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES
        });
        
        console.log(`Authorize this app by visiting the url: ${authUrl}`);
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        
        return new Promise<void>((resolve, reject) => {
            rl.question(`Enter the code from that page here: `, async (code: string) => {
                try {
                    rl.close();
                    const response = await client.getToken(code);
                    client.setCredentials(response.tokens);
                    writeFileSync(TOKEN_PATH, JSON.stringify(response.tokens));
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        });
    }
}