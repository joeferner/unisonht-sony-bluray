import { SonyBlurayClient } from './SonyBlurayClient';
import Debug from 'debug';
import { SonyBlurayStatus } from './SonyBlurayStatus';
import { SonyBlurayButton } from './SonyBlurayButton';

const debug = Debug('UnisonHT:SonyBluray:ClientMock');

export class SonyBlurayClientMock implements SonyBlurayClient {
  public async buttonPress(buttonName: SonyBlurayButton): Promise<void> {
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
