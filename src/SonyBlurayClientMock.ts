import { SonyBlurayClient } from './SonyBlurayClient';
import Debug from 'debug';
import { SonyBlurayStatus } from './SonyBlurayStatus';

const debug = Debug('UnisonHT:SonyBluray:ClientMock');

export class SonyBlurayClientMock implements SonyBlurayClient {
  public async buttonPress(buttonName: any): Promise<void> {
    debug(`buttonPress ${buttonName}`);
  }

  public async on(): Promise<void> {
    debug('on');
  }

  public async off(): Promise<void> {
    debug('off');
  }

  public async getStatus(): Promise<SonyBlurayStatus> {
    return {};
  }

  public async start(): Promise<void> {
    debug('start');
  }
}
