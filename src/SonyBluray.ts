import {
    RouteHandlerRequest,
    RouteHandlerResponse,
    StandardButton,
    SupportedButton,
    SupportedButtons,
    UnisonHT,
    UnisonHTDevice,
} from '@unisonht/unisonht';
import { SonyBlurayClientImpl } from './SonyBlurayClientImpl';
import { SonyBlurayClient } from './SonyBlurayClient';
import { SonyBlurayClientMock } from './SonyBlurayClientMock';
import { SonyBlurayStatus } from './SonyBlurayStatus';
import { SonyBlurayButton } from './SonyBlurayButton';

export interface SonyBlurayOptions {
    useMockClient?: boolean;
    address: string;
    mac: string;
    irccPort?: number;
    port?: number;
    deviceIdPrefix?: string;
    deviceName?: string;
}

export const DEFAULT_OPTIONS: SonyBlurayOptions = {
    useMockClient: false,
    address: '',
    mac: '',
    irccPort: 50001,
    port: 50002,
    deviceIdPrefix: 'UnisonHT',
    deviceName: 'UnisonHT',
};

export class SonyBluray implements UnisonHTDevice {
    private readonly deviceName: string;
    private readonly options: SonyBlurayOptions;
    private client: SonyBlurayClient | undefined;

    constructor(deviceName: string, options: SonyBlurayOptions) {
        this.deviceName = deviceName;
        this.options = options;
    }

    public async initialize(unisonht: UnisonHT): Promise<void> {
        unisonht.post(this, 'on', {
            handler: this.handleOn.bind(this),
        });
        unisonht.post(this, 'off', {
            handler: this.handleOff.bind(this),
        });

        this.client = this.options.useMockClient
            ? new SonyBlurayClientMock()
            : new SonyBlurayClientImpl({
                  authCode: unisonht.getSetting(this, 'authCode'),
                  address: this.options.address,
                  mac: this.options.mac,
                  irccPort: this.options.irccPort || 50001,
                  port: this.options.port || 50002,
                  deviceIdPrefix: this.options.deviceIdPrefix || 'UnisonHT',
                  deviceName: this.options.deviceName || 'UnisonHT',
                  setAuthCode: (newAuthCode) => {
                      unisonht.setSetting(this, 'authCode', newAuthCode);
                  },
                  promptForAuthCode: async () => {
                      return await unisonht.prompt('Sony Bluray Auth Code?');
                  },
              });
        await this.client.start();
    }

    private async handleOn(request: RouteHandlerRequest, response: RouteHandlerResponse): Promise<void> {
        if (!this.client) {
            throw new Error('client not initialized');
        }
        await this.client.on();
        response.send();
    }

    private async handleOff(request: RouteHandlerRequest, response: RouteHandlerResponse): Promise<void> {
        if (!this.client) {
            throw new Error('client not initialized');
        }
        await this.client.off();
        response.send();
    }

    public getStatus(): Promise<SonyBlurayStatus> {
        if (!this.client) {
            throw new Error('client not initialized');
        }
        return this.client.getStatus();
    }

    public getDeviceName(): string {
        return this.deviceName;
    }

    public getSupportedButtons(): SupportedButtons {
        return {
            [StandardButton.SELECT]: this.createButton('Select', SonyBlurayButton.SELECT),
            [StandardButton.FORWARD]: this.createButton('Fast Forward', SonyBlurayButton.FASTFORWARD),
            SKIP: this.createButton('Skip', SonyBlurayButton.SKIP),
            [StandardButton.INSTANT_REPLAY]: this.createButton('Replay', SonyBlurayButton.REPLAY),
        };
    }

    private createButton(name: string, sonyButton: SonyBlurayButton): SupportedButton {
        return {
            name,
            handleButtonPress: async () => {
                if (!this.client) {
                    throw new Error('client not initialized');
                }
                await this.client.buttonPress(sonyButton);
            },
        };
    }
}
