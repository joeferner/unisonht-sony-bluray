import { SonyBlurayClient } from './SonyBlurayClient';
import * as wol from 'wol';
import * as xpath from 'xpath';
import { SelectedValue } from 'xpath';
import * as xmldom from 'xmldom';
import * as getmac from 'getmac';
import axios from 'axios';
import Debug from 'debug';
import { SonyBlurayStatus } from './SonyBlurayStatus';
import { SonyBlurayButton } from './SonyBlurayButton';

const debug = Debug('UnisonHT:SonyBluray:Client');

interface RemoteCommandList {
    [command: string]: string;
}

export interface SonyBlurayClientImplOptions {
    authCode: string;
    address: string;
    mac: string;
    irccPort: number;
    port: number;
    deviceIdPrefix: string;
    deviceName: string;
    setAuthCode: (newAuthCode: string) => void;
    promptForAuthCode: () => Promise<string>;
}

export class SonyBlurayClientImpl implements SonyBlurayClient {
    private commandList: RemoteCommandList | undefined;
    private macAddress: string | undefined;
    private options: SonyBlurayClientImplOptions;

    constructor(options: SonyBlurayClientImplOptions) {
        this.options = options;
        this.commandList = {};
    }

    public async start(): Promise<void> {
        this.macAddress = await this.getMacAddress();
    }

    public async buttonPress(button: SonyBlurayButton): Promise<void> {
        const commandValue = this.translateButton(button);
        if (!commandValue) {
            debug(`commandList %o`, this.commandList);
            throw new Error(`Could not find mapping for button ${button}/${commandValue}`);
        }
        const irccXml = SonyBlurayClientImpl.createIRCCXML(commandValue);

        debug(`sending ircc code ${button}/${commandValue}`);
        const response = await axios.post(
            `http://${this.options.address}:${this.options.irccPort}/upnp/control/IRCC`,
            irccXml,
            {
                validateStatus: () => {
                    return true;
                },
                headers: {
                    Connection: 'close',
                    'X-CERS-DEVICE-ID': this.getDeviceId(),
                    'X-CERS-DEVICE-INFO': 'Android4.4.2/TVSideViewForAndroid2.5.1/SM-G900V',
                    'User-Agent': 'Dalvik/1.6.0 (Linux; U; Android 4.4.2; SM-G900V Build/KOT49H)',
                    'content-type': 'text/xml; charset=utf-8',
                    soapaction: '"urn:schemas-sony-com:service:IRCC:1#X_SendIRCC"',
                    'Content-Length': irccXml.length,
                },
            },
        );
        console.log('response', response);
    }

    public async on(): Promise<void> {
        await this.ensureOnRepeat(3);
    }

    public async off(): Promise<void> {
        // TODO handle off
        return Promise.resolve();
    }

    public async getStatus(): Promise<SonyBlurayStatus> {
        debug('getStatus');
        const status = await this.getPage('/getStatus', false);
        console.log(status);
        return {};
    }

    private async ensureOnRepeat(retryCount: number): Promise<void> {
        try {
            debug(`ensureOnRepeat(retryCount: ${retryCount})`);
            await this.sendWakeOnLan();
            this.commandList = await this.getRemoteCommandList();
        } catch (err) {
            console.error(`could not connect (retry: ${retryCount})`, err);
            if (retryCount === 0) {
                throw err;
            }
            await this.sleep(1000);
            await this.ensureOnRepeat(retryCount - 1);
        }
    }

    private sleep(time: number): Promise<void> {
        return new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, time);
        });
    }

    private sendWakeOnLan(): Promise<void> {
        debug(`sendWakeOnLan(mac: ${this.options.mac})`);
        return new Promise<void>((resolve, reject) => {
            wol.wake(this.options.mac, (err) => {
                if (err) {
                    console.error(`send wol failed: ${this.options.mac}`, err);
                    return reject(err);
                }
                resolve();
            });
        });
    }

    private async getRemoteCommandList(): Promise<RemoteCommandList> {
        debug('getRemoteCommandList');
        const xml = await this.getPage('/getRemoteCommandList');
        const commandList: RemoteCommandList = {};
        const commands: SelectedValue[] = xpath.select(`//command`, xml);
        for (const command of commands) {
            const commandElement = command as Element;
            const name = commandElement.getAttribute('name');
            const value = commandElement.getAttribute('value');
            if (name && value) {
                commandList[name.toUpperCase()] = value;
            }
        }
        return commandList;
    }

    private async getPage(url: string, retryOnFailure = true): Promise<Document> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const headers: any = {
            Connection: 'close',
            'X-CERS-DEVICE-ID': this.getDeviceId(),
            'X-CERS-DEVICE-INFO': 'Android4.4.2/TVSideViewForAndroid2.5.1/SM-G900V',
            'User-Agent': 'Dalvik/1.6.0 (Linux; U; Android 4.4.2; SM-G900V Build/KOT49H)',
        };
        if (this.options.authCode) {
            const pass = new Buffer(`:${this.options.authCode}`).toString('base64');
            headers.Authorization = `Basic ${pass}`;
        }

        const absoluteUrl = `http://${this.options.address}:${this.options.port}${url}`;
        debug(`sending ${absoluteUrl}`);
        const response = await axios.get(absoluteUrl, {
            validateStatus: () => {
                return true;
            },
            headers,
        });
        console.log('response', response);
        const responseData = '';

        if (response.status === 403 && retryOnFailure) {
            await this.tryRegistrationRenewal();
            return await this.getPage(url);
        }
        if (response.status !== 200) {
            const error = new Error(`invalid response code: ${response.status}: ${response.data}`);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (error as any).statusCode = response.status;
            throw error;
        }
        try {
            return new xmldom.DOMParser().parseFromString(responseData);
        } catch (err) {
            console.error(`invalid xml ${responseData}`);
            throw err;
        }
    }

    private getDeviceId(): string {
        return `${this.options.deviceIdPrefix}:${this.macAddress}`;
    }

    private translateButton(button: SonyBlurayButton): string {
        if (!this.commandList || Object.keys(this.commandList).length === 0) {
            throw new Error('command list not initialized');
        }
        return this.commandList[button.toString().toUpperCase()];
    }

    private getMacAddress(): Promise<string> {
        return new Promise((resolve, reject) => {
            getmac.getMac((err, macAddress) => {
                if (err || !macAddress) {
                    return reject(err);
                }
                macAddress = macAddress.replace(/:/g, '-');
                resolve(macAddress);
            });
        });
    }

    private async tryRegistrationRenewal(): Promise<void> {
        try {
            await this.getPage(this.getRegistrationUrl('renewal'), false);
        } catch (err) {
            if (err.statusCode && err.statusCode === 403) {
                await this.tryRegistrationInitial();
                return;
            }
            throw err;
        }
    }

    private async tryRegistrationInitial(): Promise<void> {
        try {
            await this.getPage(this.getRegistrationUrl('initial'), false);
        } catch (err) {
            if (err.statusCode && err.statusCode === 401) {
                const code = await this.getRegistrationCodeFromUser();
                this.options.setAuthCode(code);
                await this.tryRegistrationInitial();
                return;
            }
            throw err;
        }
    }

    private getRegistrationUrl(type: string): string {
        const deviceName = encodeURIComponent(this.options.deviceName);
        const deviceId = encodeURIComponent(this.getDeviceId());
        return `/register?name=${deviceName}&registrationType=${type}&deviceId=${deviceId}&wolSupport=true`;
    }

    private async getRegistrationCodeFromUser(): Promise<string> {
        debug('registration required from user');
        return await this.options.promptForAuthCode();
    }

    private static createIRCCXML(commandValue: string) {
        return `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:X_SendIRCC xmlns:u="urn:schemas-sony-com:service:IRCC:1">
      <IRCCCode>${commandValue}</IRCCCode>
    </u:X_SendIRCC>
  </s:Body>
</s:Envelope>`;
    }
}
