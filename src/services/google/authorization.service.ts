import { Injectable, Logger } from '@jsmon/core';
import { ConfigService } from '../config';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { readFile, readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';

const SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.profile'
];

const TOKEN_PATH = 'token.json';

@Injectable()
export class GoogleAuthorizationService {
    private _client: OAuth2Client | null = null;
    private _unauthorizedClient: OAuth2Client | null = null;
    private _authURL: string | null = null;

    constructor(private _configService: ConfigService,
                private _log: Logger) {
        this._log = this._log.createChild(`google:auth`);
        
        // Create a new OAuth2 client
        this._createClient();

        // Try to authenticate
        this._tryAuthenticate()
            .then(res => {
                if (!res) {
                    this._log.warn(`Not yet authorized against Google API. Please finish authorization using the Web UI`);
                    this._authURL = this._getAuthURL();
                } else {
                    this._log.info(`Successfully authorized against Google API`);
                }
            });
    }
    
    getAuthURL(): string {
        if (!!this._authURL) {
            return this._authURL;
        }
        
        throw new Error(`No pending authorization`);
    }
    
    authorize(): Promise<OAuth2Client> {
        if (!!this._client) {
            return Promise.resolve(this._client);
        }
        
        return Promise.reject(`Not authorized`);
    }

    async getProfile() {
        let auth = await this.authorize();

        let a = await google.oauth2('v2')
            .userinfo.get({auth: auth})
            
        return a.data;
    }

    async finishAuthorization(code: string) {
        const client = this._unauthorizedClient;
        this._unauthorizedClient = null;
        
        if (!client) {
            throw new Error(`No pending authorization`);
        }
        
        const response = await client.getToken(code);
        client.setCredentials(response.tokens);
        
        this._log.info(`Successfully authenticated against Google API`);
        
        this._client = client;

        writeFileSync(TOKEN_PATH, JSON.stringify(response.tokens));
    }
    
    /**
     * Checks whether we are currently authenticated against google
     * TODO(ppacher): validate the token by trying to contact a google API
     */
    async isAuthenticated(): Promise<boolean> {
        return existsSync(TOKEN_PATH) && !!this._client;
    }
    
    /**
     * Revokes the current google credentials and removes the stored token
     */
    async unauthorize(): Promise<void> {
        if (await this.isAuthenticated()) {
            unlinkSync(TOKEN_PATH);
            
            if (!!this._client) {
                // Try to revoke the access
                await this._client.revokeToken(this._client.credentials.access_token!)
                        .catch(err => {});
            }

            this._client = null;

            // Create a new unauthorized client
            this._createClient();
            this._authURL = this._getAuthURL();
        }
    }
    
    /**
     * Creates a new OAuth2 client from the configured google credentials
     * The created client is not yet authenticated
     */
    private _createClient() {
        const content = readFileSync('google-credentials.json');
        const credentials = JSON.parse(content.toString());
        const { client_secret, client_id, redirect_uris } = credentials.installed;

        const oAuth2Client = new google.auth.OAuth2(
            client_id, client_secret, redirect_uris[0]
        );
        
        this._unauthorizedClient = oAuth2Client;
    }
    
    /**
     * Tries to authenticate against the Google API using stored credentials
     * Resolves to true if the authentication was successful, false otherwise
     */
    private _tryAuthenticate(): Promise<boolean> {
        if (!!this._client) {
            return Promise.resolve(true);
        }
        
        return new Promise<boolean>((resolve, reject) => {
            readFile(TOKEN_PATH, (err, token) => {
                if (!!err) {
                    resolve(false);
                } else {
                    this._unauthorizedClient!.setCredentials(JSON.parse(token.toString()));
                    this._client = this._unauthorizedClient;
                    this._unauthorizedClient = null;
                    resolve(true);
                }
            });
        });
    }
    
    /**
     * Create a new authentication URL
     */
    private _getAuthURL(): string {
        if (!this._unauthorizedClient) {
            throw new Error(`Already authenticated`);
        }
        
        const authUrl = this._unauthorizedClient!.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES
        });
        
        return authUrl;
    }
}